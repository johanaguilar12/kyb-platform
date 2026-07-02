import { NextRequest, NextResponse } from 'next/server';
import { runMasterStatusCheck } from '@/lib/status-transitions';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verify dossier File exists
    const file = await prisma.file.findUnique({
      where: { id },
    });
    if (!file) {
      return NextResponse.json(
        { success: false, error: `File not found with id ${id}` },
        { status: 404 }
      );
    }

    // Run compliance master status check
    const report = await runMasterStatusCheck(id);

    // Fetch the updated file to log correct status transition if any
    const updatedFile = await prisma.file.findUnique({
      where: { id },
    });

    // Log the manual check in AuditLog
    await logAuditAction({
      action: 'update',
      actor: 'SYSTEM_USER',
      fileId: id,
      beforeState: file as any,
      afterState: updatedFile as any,
      reason: `Manual compliance status check executed. Needs update: ${report.needsUpdate}`,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error: any) {
    console.error('Failed manual status check:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
