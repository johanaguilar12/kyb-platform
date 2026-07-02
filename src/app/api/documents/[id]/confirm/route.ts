import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Support both wrapper-style { data: ... } or flat objects
    const confirmedData = body.data || body;

    const documentBefore = await prisma.document.findUnique({
      where: { id },
    });

    if (!documentBefore) {
      return NextResponse.json(
        { success: false, error: `Document not found with id ${id}` },
        { status: 404 }
      );
    }

    // Resolve date columns if present/modified in the confirmed data
    let resolvedIssueDate = documentBefore.issueDate;
    let resolvedExpirationDate = documentBefore.expirationDate;

    if (confirmedData.issueDate) {
      const parsedDate = new Date(confirmedData.issueDate);
      if (!isNaN(parsedDate.getTime())) {
        resolvedIssueDate = parsedDate;
      }
    }
    if (confirmedData.expirationDate) {
      const parsedDate = new Date(confirmedData.expirationDate);
      if (!isNaN(parsedDate.getTime())) {
        resolvedExpirationDate = parsedDate;
      }
    }

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        aiExtractedData: confirmedData,
        issueDate: resolvedIssueDate,
        expirationDate: resolvedExpirationDate,
        confirmationStatus: 'confirmed',
        confirmedAt: new Date(),
      },
    });

    // Log the confirmation in Audit Log
    await logAuditAction({
      action: 'update',
      actor: 'SYSTEM_USER',
      fileId: updatedDocument.fileId,
      beforeState: documentBefore as any,
      afterState: updatedDocument as any,
      reason: `Document type ${updatedDocument.type} was confirmed and edited by user`,
    });

    return NextResponse.json({ success: true, data: updatedDocument });
  } catch (error: any) {
    console.error('Failed to confirm document:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
