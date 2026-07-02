import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { calculateRiskScore } from '@/lib/scorer';
import { z } from 'zod';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

const calculateScoreSchema = z.object({
  fileId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = calculateScoreSchema.parse(body);

    const fileId = validated.fileId;

    // Fetch File with Documents and SAT checks
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        documents: {
          where: { isActive: true },
        },
        satListChecks: true,
        riskScore: true,
      },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Call the pure calculateRiskScore function
    const calculatedScore = calculateRiskScore(file as any, file.documents as any, file.satListChecks as any);

    // Save or update the RiskScore record
    const savedRiskScore = await prisma.riskScore.upsert({
      where: { fileId },
      update: {
        level: calculatedScore.level,
        score: calculatedScore.score,
        factors: calculatedScore.factors as any,
        explanation: calculatedScore.explanation,
        suggestedAction: calculatedScore.suggestedAction,
        calculatedAt: calculatedScore.calculatedAt,
      },
      create: {
        fileId,
        level: calculatedScore.level,
        score: calculatedScore.score,
        factors: calculatedScore.factors as any,
        explanation: calculatedScore.explanation,
        suggestedAction: calculatedScore.suggestedAction,
        calculatedAt: calculatedScore.calculatedAt,
      },
    });

    // Handle status transitions
    let targetStatus = file.status;

    const hasExpiredDocs = calculatedScore.factors.some(f => f.code === 'EXPIRED_DOCUMENT');
    const taxCertNotCurrent = calculatedScore.factors.some(f => f.code === 'TAX_CERTIFICATE_NOT_CURRENT_MONTH');
    const satStale = calculatedScore.factors.some(f => f.code === 'SAT_NOT_REVIEWED');

    if (hasExpiredDocs || taxCertNotCurrent || satStale) {
      targetStatus = 'needs_update';
    } else if (calculatedScore.level === 'high_risk') {
      if (file.status !== 'rejected') {
        targetStatus = 'rejected';
      }
    } else if (file.status === 'draft' && calculatedScore.level === 'safe') {
      // Optional auto transition for draft safe files
      targetStatus = 'pending_review';
    }

    if (targetStatus !== file.status) {
      await prisma.file.update({
        where: { id: fileId },
        data: { status: targetStatus },
      });

      // Log status transition in Audit Log
      await logAuditAction({
        action: 'update',
        actor: 'SYSTEM',
        fileId,
        beforeState: { status: file.status },
        afterState: { status: targetStatus },
        reason: `System auto-transition status from ${file.status} to ${targetStatus} based on risk score recalculation`,
      });
    }

    // Log the score calculation in Audit Log
    await logAuditAction({
      action: 'score_calculated',
      actor: 'SYSTEM',
      fileId,
      afterState: savedRiskScore,
      reason: `Recalculated risk score: ${calculatedScore.score} (${calculatedScore.level})`,
    });

    return NextResponse.json({
      success: true,
      data: {
        score: savedRiskScore,
        fileStatus: targetStatus,
      },
    });
  } catch (error: any) {
    console.error('Failed to calculate risk score:', error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
