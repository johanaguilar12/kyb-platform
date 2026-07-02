import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';

vi.mock('@/lib/prisma', () => {
  const mockPrismaInstance = {
    document: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    file: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn(),
    },
  };
  return {
    prisma: mockPrismaInstance,
  };
});

vi.mock('@/lib/audit', () => ({
  logAuditAction: vi.fn(),
}));

vi.mock('@/lib/ai-extractor', () => ({
  extractDocumentData: vi.fn().mockResolvedValue({
    type: 'tax_status_certificate',
    data: {
      rfc: 'ABC010101ABC',
      legalName: 'TEST SA DE CV',
      issueDate: '2026-07-01',
    },
  }),
  validateExtractedData: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/documents/route';
import { PUT } from '@/app/api/documents/[id]/confirm/route';
import { DELETE } from '@/app/api/documents/[id]/route';
import { NextRequest } from 'next/server';

const mockPrisma = prisma as any;

describe('Document Vault Confirmation Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate SHA256 correctly and create pending document without storing binary PDF', async () => {
    const mockFileContent = 'Fake PDF Binary Stream Data';
    const expectedHash = createHash('sha256').update(mockFileContent).digest('hex');

    // Mock file upload FormData
    const formData = new FormData();
    const mockBlob = new Blob([mockFileContent], { type: 'application/pdf' });
    formData.append('file', mockBlob as any, 'CSF.pdf');
    formData.append('type', 'tax_status_certificate');
    formData.append('fileId', 'file-123');

    const req = new NextRequest('http://localhost/api/documents', {
      method: 'POST',
      body: formData,
    });

    mockPrisma.file.findUnique.mockResolvedValue({ id: 'file-123', rfc: 'ABC010101ABC', legalName: 'TEST SA DE CV' });
    mockPrisma.document.findFirst.mockResolvedValue(null); // version 1
    mockPrisma.document.create.mockImplementation(({ data }) => ({
      id: 'doc-999',
      ...data,
    }));

    const response = await POST(req);
    const body = await response.json();

    expect(body.success).toBe(true);
    
    // Verify pdfHash matches and status is pending
    expect(mockPrisma.document.create).toHaveBeenCalled();
    const createArgs = mockPrisma.document.create.mock.calls[0][0].data;
    
    expect(createArgs.pdfHash).toBe(expectedHash);
    expect(createArgs.confirmationStatus).toBe('confirmed');
    expect(createArgs.aiExtractedData).toEqual({
      rfc: 'ABC010101ABC',
      legalName: 'TEST SA DE CV',
      issueDate: '2026-07-01',
    });
    
    // Verify that the binary PDF buffer itself is NOT stored in database payload
    expect(createArgs.file).toBeUndefined();
    expect(createArgs.buffer).toBeUndefined();
    expect(createArgs.content).toBeUndefined();
  });

  it('should confirm document, update status to confirmed, set confirmedAt and update issueDate/expirationDate', async () => {
    const docId = 'doc-999';
    const mockBeforeDoc = {
      id: docId,
      fileId: 'file-123',
      type: 'tax_status_certificate',
      name: 'CSF.pdf',
      aiExtractedData: {
        rfc: 'ABC010101ABC',
        legalName: 'TEST SA DE CV',
        issueDate: '2026-07-01',
      },
      pdfHash: 'abc123hash',
      confirmationStatus: 'pending',
      issueDate: null,
      expirationDate: null,
    };

    mockPrisma.document.findUnique.mockResolvedValue(mockBeforeDoc);
    mockPrisma.document.update.mockImplementation(({ data }) => ({
      ...mockBeforeDoc,
      ...data,
    }));

    const confirmedData = {
      rfc: 'ABC010101ABC',
      legalName: 'TEST SA DE CV EDITED',
      issueDate: '2026-07-05',
    };

    const req = new NextRequest(`http://localhost/api/documents/${docId}/confirm`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: confirmedData }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: docId }) });
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(mockPrisma.document.update).toHaveBeenCalled();
    
    const updateArgs = mockPrisma.document.update.mock.calls[0][0].data;
    expect(updateArgs.confirmationStatus).toBe('confirmed');
    expect(updateArgs.confirmedAt).toBeInstanceOf(Date);
    expect(updateArgs.aiExtractedData).toEqual(confirmedData);
    expect(updateArgs.issueDate).toEqual(new Date('2026-07-05'));
  });

  it('should delete document and log audit trail', async () => {
    const docId = 'doc-999';
    const mockDoc = {
      id: docId,
      fileId: 'file-123',
      type: 'tax_status_certificate',
      name: 'CSF.pdf',
    };

    mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
    mockPrisma.document.delete.mockResolvedValue(mockDoc);

    const req = new NextRequest(`http://localhost/api/documents/${docId}`, {
      method: 'DELETE',
    });

    const res = await DELETE(req, { params: Promise.resolve({ id: docId }) });
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({
      where: { id: docId },
    });
  });
});
