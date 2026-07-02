import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { createDocumentSchema } from '@/lib/validators';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'Missing required query parameter: fileId' },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: documents });
  } catch (error: any) {
    console.error('Failed to get documents:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createDocumentSchema.parse(body);

    // Verify file exists
    const file = await prisma.file.findUnique({
      where: { id: validated.fileId },
    });
    if (!file) {
      return NextResponse.json(
        { success: false, error: `File not found with id ${validated.fileId}` },
        { status: 404 }
      );
    }

    // Set other active documents of the same type to inactive (version control)
    await prisma.document.updateMany({
      where: {
        fileId: validated.fileId,
        type: validated.type,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Find the latest version of this document type
    const latestDoc = await prisma.document.findFirst({
      where: {
        fileId: validated.fileId,
        type: validated.type,
      },
      orderBy: {
        version: 'desc',
      },
    });
    const nextVersion = latestDoc ? latestDoc.version + 1 : 1;

    // Create the new document
    const document = await prisma.document.create({
      data: {
        fileId: validated.fileId,
        type: validated.type,
        name: validated.name,
        url: validated.url ?? undefined,
        issueDate: validated.issueDate ? new Date(validated.issueDate) : undefined,
        expirationDate: validated.expirationDate ? new Date(validated.expirationDate) : undefined,
        isActive: true,
        version: nextVersion,
      },
    });

    // Log the upload in Audit Log
    await logAuditAction({
      action: 'document_uploaded',
      actor: 'SYSTEM_USER',
      fileId: validated.fileId,
      afterState: document,
      reason: `Uploaded new version (v${nextVersion}) of document type ${validated.type}`,
    });

    return NextResponse.json({ success: true, data: document });
  } catch (error: any) {
    console.error('Failed to upload document metadata:', error);
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
