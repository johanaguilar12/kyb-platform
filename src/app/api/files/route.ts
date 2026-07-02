import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const createFileSchema = z.object({
  rfc: z.string().min(12).max(13),
  legalName: z.string().min(1),
});

export async function GET() {
  try {
    const files = await prisma.file.findMany({
      include: {
        riskScore: true,
        documents: true,
      },
    });

    return NextResponse.json({ success: true, data: files });
  } catch (error: any) {
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
        rfc: validated.rfc,
        legalName: validated.legalName,
        status: 'draft',
      },
    });

    return NextResponse.json({ success: true, data: file });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Invalid data' },
      { status: 400 }
    );
  }
}
