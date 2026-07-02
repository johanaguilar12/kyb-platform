import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { checkRfcInSatLists } from '@/lib/sat-client';
import { satCheckSchema } from '@/lib/validators';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = satCheckSchema.parse(body);

    const rfcUpper = validated.rfc.toUpperCase();

    // Auto-resolve fileId if not provided but file exists for RFC
    let fileId = validated.fileId;
    if (!fileId) {
      const existingFile = await prisma.file.findUnique({
        where: { rfc: rfcUpper },
      });
      if (existingFile) {
        fileId = existingFile.id;
      }
    }

    // Run the SAT list checks
    const satResult = await checkRfcInSatLists(rfcUpper, prisma);

    if (fileId) {
      // 1. Delete previous checks for this file to avoid cluttering and keep only the latest compliance run
      await prisma.sATListCheck.deleteMany({
        where: { fileId },
      });

      // 2. Save the fresh check results
      const savedChecks = await Promise.all(
        satResult.checks.map(async (check) => {
          return prisma.sATListCheck.create({
            data: {
              fileId: fileId!,
              rfc: rfcUpper,
              listType: check.listType,
              found: check.found,
              checkedAt: check.checkedAt,
              source: check.source,
              reference: check.reference,
            },
          });
        })
      );

      // Return the saved checks containing the DB ids
      satResult.checks = savedChecks.map(c => ({
        id: c.id,
        fileId: c.fileId,
        rfc: c.rfc,
        listType: c.listType as any,
        found: c.found,
        checkedAt: c.checkedAt,
        source: c.source,
        reference: c.reference,
      }));

      // Log in Audit Log
      await logAuditAction({
        action: 'sat_check_performed',
        actor: 'SYSTEM_USER',
        fileId,
        afterState: satResult,
        reason: `SAT compliance blacklist query performed for RFC ${rfcUpper}`,
      });
    }

    return NextResponse.json({ success: true, data: satResult });
  } catch (error: any) {
    console.error('Failed to perform SAT check:', error);
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
