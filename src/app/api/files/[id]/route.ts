import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { updateFileSchema } from '@/lib/validators';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const file = await prisma.file.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        satListChecks: {
          orderBy: { checkedAt: 'desc' },
        },
        riskScore: true,
        auditLogs: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: file });
  } catch (error: any) {
    console.error('Failed to get file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateFileSchema.parse(body);

    const fileBefore = await prisma.file.findUnique({
      where: { id },
    });

    if (!fileBefore) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    const updatedFile = await prisma.file.update({
      where: { id },
      data: {
        status: validated.status,
        legalName: validated.legalName ?? undefined,
      },
    });

    // Determine audit action type
    let actionType: 'update' | 'approve' | 'reject' = 'update';
    if (validated.status === 'approved') actionType = 'approve';
    if (validated.status === 'rejected') actionType = 'reject';

    // Log update in Audit Log
    await logAuditAction({
      action: actionType,
      actor: 'SYSTEM_USER',
      fileId: updatedFile.id,
      beforeState: fileBefore,
      afterState: updatedFile,
      reason: `File updated to status ${validated.status}`,
    });

    return NextResponse.json({ success: true, data: updatedFile });
  } catch (error: any) {
    console.error('Failed to update file:', error);
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
