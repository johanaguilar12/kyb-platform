import { vi, describe, it, expect, beforeEach } from 'vitest';
import { normalizeString, calculateSimilarity, compareRFC, compareLegalNames, compareAddresses } from '@/lib/string-utils';
import { reconcileDocumentUpload } from '@/lib/document-reconciler';

vi.mock('@/lib/prisma', () => {
  const mockPrismaInstance = {
    document: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    file: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    prisma: mockPrismaInstance,
  };
});

import { prisma } from '@/lib/prisma';
import { checkDocumentExpiration, checkCSFCurrentMonth, checkSATListsRecency } from '@/lib/status-transitions';

const mockPrisma = prisma as any;

describe('Document Reconciliation & Status Transition Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. String normalization and similarity functions
  describe('String Utils', () => {
    it('should normalize strings correctly (remove accents, capitalize, strip special chars)', () => {
      expect(normalizeString('Crème Brûlée! S.A. de C.V.')).toBe('CREME BRULEE SA DE CV');
      expect(normalizeString('  Accented   Café   ')).toBe('ACCENTED CAFE');
    });

    it('should calculate Levenshtein similarity correctly', () => {
      // Exact match
      expect(calculateSimilarity('TEST', 'TEST')).toBe(1.0);
      // Completely different
      expect(calculateSimilarity('ABCD', 'WXYZ')).toBe(0.0);
      // Close matching
      expect(calculateSimilarity('COMPANIA TEST', 'COMPANIA TAST')).toBe(12/13);
    });

    it('should compare RFCs exactly case-insensitive and dash-insensitive', () => {
      expect(compareRFC('ABC-010101-ABC', 'abc010101abc')).toBe(true);
      expect(compareRFC('ABC010101AB1', 'abc010101abc')).toBe(false);
    });

    it('should ignore corporate suffix punctuation, spacing, accents, and special characters', () => {
      // Test that "EMPRESA SA DE CV" matches "EMPRESA S.A. DE C.V."
      expect(compareLegalNames('EMPRESA SA DE CV', 'EMPRESA S.A. DE C.V.').matches).toBe(true);

      // Test that "EMPRESA, S.A." matches "EMPRESA SA"
      expect(compareLegalNames('EMPRESA, S.A.', 'EMPRESA SA').matches).toBe(true);

      // Test that "EMPRESA ABC" does NOT match "EMPRESA XYZ"
      expect(compareLegalNames('EMPRESA ABC', 'EMPRESA XYZ').matches).toBe(false);

      // Test that accents are ignored (COMPAÑIA vs COMPAÑÍA)
      expect(compareLegalNames('COMPAÑIA', 'COMPAÑÍA').matches).toBe(true);

      // Test that punctuation is ignored
      expect(compareLegalNames('EMPRESA,, S..A..!!', 'EMPRESA SA').matches).toBe(true);

      // Test '&' conversion to 'Y'
      expect(compareLegalNames('M & M', 'M Y M').matches).toBe(true);
    });

    it('should compare addresses allowing street abbreviation differences', () => {
      // Calle vs C., Avenida vs Av.
      expect(compareAddresses('CALLE BENITO JUAREZ NUM 10', 'C. Benito Juarez No. 10')).toBe(true);
      expect(compareAddresses('AVENIDA INSURGENTES INT 4', 'AV INSURGENTES INT 4')).toBe(true);
      expect(compareAddresses('CALLE BENITO JUAREZ', 'CALLE MIGUEL HIDALGO')).toBe(false);
    });
  });

  // 2. Reconciliation Engine Rules
  describe('Reconciliation Engine', () => {
    const fileRfc = 'ABC010101ABC';
    const fileLegalName = 'TEST LOGISTICS SA DE CV';

    it('should reject document if RFC is mismatched', () => {
      const newDocData = { rfc: 'XYZ020202XYZ', legalName: fileLegalName };
      const output = reconcileDocumentUpload({
        newDocType: 'tax_status_certificate',
        newDocData,
        fileRfc,
        fileLegalName,
        existingDocs: [],
      });

      expect(output.isValid).toBe(false);
      expect(output.criticalError).toContain('RFC mismatch');
    });

    it('should accept document if RFC matches', () => {
      const newDocData = { rfc: 'abc010101abc', legalName: fileLegalName };
      const output = reconcileDocumentUpload({
        newDocType: 'tax_status_certificate',
        newDocData,
        fileRfc,
        fileLegalName,
        existingDocs: [],
      });

      expect(output.isValid).toBe(true);
    });

    it('should reject if legal names do not match (strict validation)', () => {
      const newDocData = { rfc: fileRfc, legalName: 'TOTALLY DIFFERENT COMPANY NAME' };
      const output = reconcileDocumentUpload({
        newDocType: 'tax_status_certificate',
        newDocData,
        fileRfc,
        fileLegalName,
        existingDocs: [],
      });

      expect(output.isValid).toBe(false);
      expect(output.criticalError).toContain('Legal name mismatch');
      expect(output.criticalError).toContain('- File: [TEST LOGISTICS SA DE CV]');
      expect(output.criticalError).toContain('- Document: [TOTALLY DIFFERENT COMPANY NAME]');
    });

    it('should accept if legal names match with punctuation/spacing formatting differences', () => {
      const newDocData = { rfc: fileRfc, legalName: 'TEST LOGISTICS, S.A. DE C.V.' };
      const output = reconcileDocumentUpload({
        newDocType: 'tax_status_certificate',
        newDocData,
        fileRfc,
        fileLegalName,
        existingDocs: [],
      });

      expect(output.isValid).toBe(true);
      expect(output.warnings.length).toBe(0);
    });
  });

  // 3. Auto Status Transitions
  describe('Auto Status Transitions', () => {
    const fileId = 'file-123';

    it('should trigger needs_update if any document is expired', async () => {
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 5); // 5 hours ago

      mockPrisma.document.findMany.mockResolvedValueOnce([
        { id: 'doc-expired', type: 'legal_representative_id', expirationDate: expiredDate },
      ]);

      const expiredDocs = await checkDocumentExpiration(fileId);

      expect(expiredDocs.length).toBe(1);
      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { status: 'needs_update', lastStatusCheck: expect.any(Date) },
      });
    });

    it('should trigger needs_update if CSF is not from current month and year', async () => {
      const pastMonthDate = new Date();
      pastMonthDate.setMonth(pastMonthDate.getMonth() - 2); // 2 months ago

      mockPrisma.document.findFirst.mockResolvedValueOnce({
        id: 'doc-csf',
        issueDate: pastMonthDate,
      });

      const isCurrent = await checkCSFCurrentMonth(fileId);

      expect(isCurrent).toBe(false);
      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { status: 'needs_update', lastStatusCheck: expect.any(Date) },
      });
    });

    it('should trigger needs_update if last SAT check is older than 90 days', async () => {
      const oldCheckDate = new Date();
      oldCheckDate.setDate(oldCheckDate.getDate() - 95); // 95 days ago

      mockPrisma.file.findUnique.mockResolvedValueOnce({
        lastSATCheck: oldCheckDate,
      });

      const days = await checkSATListsRecency(fileId);

      expect(days).toBeGreaterThanOrEqual(95);
      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: fileId },
        data: { status: 'needs_update', lastStatusCheck: expect.any(Date) },
      });
    });
  });
});
