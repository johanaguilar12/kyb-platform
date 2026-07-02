import { prisma } from './prisma';

export interface StatusReport {
  fileId: string;
  expiredDocuments: Array<{ id: string; type: string; expirationDate: Date }>;
  isCsfCurrentMonth: boolean;
  daysSinceLastSATCheck: number | null;
  needsUpdate: boolean;
}

/**
 * Checks for any expired active documents.
 * Updates file status to 'needs_update' if any are found.
 */
export async function checkDocumentExpiration(fileId: string): Promise<Array<{ id: string; type: string; expirationDate: Date }>> {
  const expiredDocs = await prisma.document.findMany({
    where: {
      fileId,
      isActive: true,
      expirationDate: {
        lt: new Date(),
      },
    },
    select: {
      id: true,
      type: true,
      expirationDate: true,
    },
  });

  const formattedExpired = expiredDocs.map((d) => ({
    id: d.id,
    type: d.type,
    expirationDate: d.expirationDate as Date,
  }));

  if (formattedExpired.length > 0) {
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'needs_update', lastStatusCheck: new Date() },
    });
  }

  return formattedExpired;
}

/**
 * Verifies that the CSF document issue date is in the current month and year.
 * Updates file status to 'needs_update' if not.
 */
export async function checkCSFCurrentMonth(fileId: string): Promise<boolean> {
  const csf = await prisma.document.findFirst({
    where: {
      fileId,
      type: 'tax_status_certificate',
      isActive: true,
    },
    select: {
      id: true,
      issueDate: true,
    },
  });

  if (!csf || !csf.issueDate) {
    return false;
  }

  const issueDate = new Date(csf.issueDate);
  const now = new Date();

  const isCurrentMonth =
    issueDate.getFullYear() === now.getFullYear() &&
    issueDate.getMonth() === now.getMonth();

  if (!isCurrentMonth) {
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'needs_update', lastStatusCheck: new Date() },
    });
  }

  return isCurrentMonth;
}

/**
 * Validates how many days have elapsed since the last SAT list check.
 * Updates file status to 'needs_update' if over 90 days.
 */
export async function checkSATListsRecency(fileId: string): Promise<number | null> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { lastSATCheck: true },
  });

  if (!file || !file.lastSATCheck) {
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'needs_update', lastStatusCheck: new Date() },
    });
    return null;
  }

  const lastCheck = new Date(file.lastSATCheck);
  const diffTime = Math.abs(new Date().getTime() - lastCheck.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 90) {
    await prisma.file.update({
      where: { id: fileId },
      data: { status: 'needs_update', lastStatusCheck: new Date() },
    });
  }

  return diffDays;
}

/**
 * Runs expiration, CSF month recency, and SAT list checks.
 * Transitions file to 'needs_update' and returns the report.
 */
export async function runMasterStatusCheck(fileId: string): Promise<StatusReport> {
  const expiredDocs = await checkDocumentExpiration(fileId);
  const isCsfCurrent = await checkCSFCurrentMonth(fileId);
  const daysSinceSAT = await checkSATListsRecency(fileId);

  const needsUpdate =
    expiredDocs.length > 0 ||
    !isCsfCurrent ||
    daysSinceSAT === null ||
    daysSinceSAT > 90;

  if (needsUpdate) {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: 'needs_update',
        lastStatusCheck: new Date(),
      },
    });
  } else {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        lastStatusCheck: new Date(),
      },
    });
  }

  return {
    fileId,
    expiredDocuments: expiredDocs,
    isCsfCurrentMonth: isCsfCurrent,
    daysSinceLastSATCheck: daysSinceSAT,
    needsUpdate,
  };
}
