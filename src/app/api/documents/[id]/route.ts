import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const documentBefore = await prisma.document.findUnique({
      where: { id },
    });

    if (!documentBefore) {
      return NextResponse.json(
        { success: false, error: `Document not found with id ${id}` },
        { status: 404 }
      );
    }

    await prisma.document.delete({
      where: { id },
    });

    // Log the deletion in Audit Log
    await logAuditAction({
      action: 'delete',
      actor: 'SYSTEM_USER',
      fileId: documentBefore.fileId,
      beforeState: documentBefore as any,
      reason: `Document type ${documentBefore.type} was deleted from vault`,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
