import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';
import { createFileSchema } from '@/lib/validators';
import { ZodError } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const files = await prisma.file.findMany({
      include: {
        riskScore: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ success: true, data: files });
  } catch (error: any) {
    console.error('Failed to get files:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createFileSchema.parse(body);

    const file = await prisma.file.create({
      data: {
        rfc: validated.rfc.toUpperCase(),
        legalName: validated.legalName,
        status: 'draft',
      },
    });

    // Log the file creation in Audit Log
    await logAuditAction({
      action: 'create',
      actor: 'SYSTEM_USER', // Actor can be customized later, but SYSTEM_USER is a safe default
      fileId: file.id,
      afterState: file,
      reason: 'Initial file creation',
    });

    return NextResponse.json({ success: true, data: file });
  } catch (error: any) {
    console.error('Failed to create file:', error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    // Handle uniqueness constraint violation for RFC
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'A file with this RFC already exists.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Database error' },
      { status: 500 }
    );
  }
}
