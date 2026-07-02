import { vi, describe, it, expect, beforeEach } from 'vitest';
import { calculateRiskScore } from '@/lib/scorer';
import { runConditionalDetections } from '@/lib/conditional-detection';
import { File, Document, SATListCheck } from '@/types';

// Mock the Prisma client
vi.mock('@/lib/prisma', () => {
  const mockPrismaInstance = {
    document: {
      findMany: vi.fn(),
    },
    file: {
      update: vi.fn(),
    },
  };
  return {
    prisma: mockPrismaInstance,
  };
});

import { prisma } from '@/lib/prisma';
const mockPrisma = prisma as any;

describe('Conditional Document Visibility and Scoring Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // UI Dropdown Visibility simulation helper
  const hasUploadedType = (documents: Document[], type: string) => {
    return documents.some(d => d.type === type && d.isActive);
  };

  const getVisibleDocTypes = (fileData: {
    powerOfAttorneyRequired?: boolean | null;
    controllingPartyRequired?: boolean | null;
    documents: Document[];
  }) => {
    const showPoA = fileData.powerOfAttorneyRequired === true || hasUploadedType(fileData.documents, 'power_of_attorney');
    const showControllingParty = fileData.controllingPartyRequired === true || hasUploadedType(fileData.documents, 'controlling_party');

    const visible = [
      'tax_status_certificate',
      'articles_of_incorporation',
      'legal_representative_id',
      'proof_of_address',
      'manifestation_under_protest'
    ];
    if (showPoA) visible.push('power_of_attorney');
    if (showControllingParty) visible.push('controlling_party');
    return visible;
  };

  describe('UI Dropdown Visibility Logic', () => {
    it('shows exactly 5 documents initially', () => {
      const fileData = {
        powerOfAttorneyRequired: null,
        controllingPartyRequired: null,
        documents: [],
      };
      const visible = getVisibleDocTypes(fileData);
      expect(visible).toHaveLength(5);
      expect(visible).toContain('tax_status_certificate');
      expect(visible).toContain('articles_of_incorporation');
      expect(visible).toContain('legal_representative_id');
      expect(visible).toContain('proof_of_address');
      expect(visible).toContain('manifestation_under_protest');
      expect(visible).not.toContain('power_of_attorney');
      expect(visible).not.toContain('controlling_party');
    });

    it('shows 5 documents after uploading Articles with simple structure', () => {
      const fileData = {
        powerOfAttorneyRequired: null,
        controllingPartyRequired: false,
        documents: [
          {
            id: 'doc_1',
            fileId: 'file_1',
            type: 'articles_of_incorporation' as any,
            name: 'Articles.pdf',
            isActive: true,
            version: 1,
            createdAt: new Date(),
          } as Document
        ],
      };
      const visible = getVisibleDocTypes(fileData);
      expect(visible).toHaveLength(5);
      expect(visible).not.toContain('controlling_party');
    });

    it('shows 6 documents (adds Controlling Party) after uploading Articles with complex structure', () => {
      const fileData = {
        powerOfAttorneyRequired: null,
        controllingPartyRequired: true,
        documents: [
          {
            id: 'doc_1',
            fileId: 'file_1',
            type: 'articles_of_incorporation' as any,
            name: 'Articles.pdf',
            isActive: true,
            version: 1,
            createdAt: new Date(),
          } as Document
        ],
      };
      const visible = getVisibleDocTypes(fileData);
      expect(visible).toHaveLength(6);
      expect(visible).toContain('controlling_party');
    });

    it('does not add Power of Attorney when CSF has matching representative', () => {
      const fileData = {
        powerOfAttorneyRequired: false,
        controllingPartyRequired: null,
        documents: [
          {
            id: 'doc_1',
            fileId: 'file_1',
            type: 'articles_of_incorporation' as any,
            name: 'Articles.pdf',
            isActive: true,
            version: 1,
            createdAt: new Date(),
          } as Document,
          {
            id: 'doc_2',
            fileId: 'file_1',
            type: 'tax_status_certificate' as any,
            name: 'CSF.pdf',
            isActive: true,
            version: 1,
            createdAt: new Date(),
          } as Document
        ],
      };
      const visible = getVisibleDocTypes(fileData);
      expect(visible).toHaveLength(5);
      expect(visible).not.toContain('power_of_attorney');
    });

    it('adds Power of Attorney when CSF has different representative', () => {
      const fileData = {
        powerOfAttorneyRequired: true,
        controllingPartyRequired: null,
        documents: [
          {
            id: 'doc_1',
            fileId: 'file_1',
            type: 'articles_of_incorporation' as any,
            name: 'Articles.pdf',
            isActive: true,
            version: 1,
            createdAt: new Date(),
          } as Document,
          {
            id: 'doc_2',
            fileId: 'file_1',
            type: 'tax_status_certificate' as any,
            name: 'CSF.pdf',
            isActive: true,
            version: 1,
            createdAt: new Date(),
          } as Document
        ],
      };
      const visible = getVisibleDocTypes(fileData);
      expect(visible).toHaveLength(6);
      expect(visible).toContain('power_of_attorney');
    });
  });

  describe('Conditional Detection Execution logic', () => {
    it('detects simple vs complex structures on Articles upload', async () => {
      // Mock documents findMany to return complex articles
      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc_articles',
          fileId: 'file_1',
          type: 'articles_of_incorporation',
          isActive: true,
          aiExtractedData: {
            shareholdersCount: 5,
            hasComplexOwnership: true,
            ownershipReason: 'Mentions investment fund.',
          },
        },
      ]);

      await runConditionalDetections('file_1');

      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: 'file_1' },
        data: {
          controllingPartyRequired: true,
          controllingPartyReason: 'Mentions investment fund.',
        },
      });
    });

    it('detects different representative names on CSF + Articles upload', async () => {
      // Mock documents findMany to return CSF with diff rep
      mockPrisma.document.findMany.mockResolvedValueOnce([
        {
          id: 'doc_articles',
          fileId: 'file_1',
          type: 'articles_of_incorporation',
          isActive: true,
          aiExtractedData: {
            legalRepresentative: 'JUAN PEREZ',
            shareholdersCount: 2,
            hasComplexOwnership: false,
          },
        },
        {
          id: 'doc_csf',
          fileId: 'file_1',
          type: 'tax_status_certificate',
          isActive: true,
          aiExtractedData: {
            legalRepresentative: 'MARIA GOMEZ',
          },
        },
      ]);

      await runConditionalDetections('file_1');

      expect(mockPrisma.file.update).toHaveBeenCalledWith({
        where: { id: 'file_1' },
        data: {
          powerOfAttorneyRequired: true,
          powerOfAttorneyReason: 'Representative name in Tax Status Certificate (MARIA GOMEZ) differs from Articles of Incorporation (JUAN PEREZ).',
          controllingPartyRequired: false,
          controllingPartyReason: '',
        },
      });
    });
  });

  describe('Scoring Penalties for Conditional and Mandatory Documents', () => {
    const mockFile: File = {
      id: 'file_123',
      rfc: 'ABC123456XYZ',
      legalName: 'ACME S.A. DE C.V.',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      powerOfAttorneyRequired: false,
      controllingPartyRequired: false,
    };

    const refDate = new Date('2026-07-01T12:00:00Z');
    const satChecks: SATListCheck[] = [
      { id: '1', fileId: 'file_123', listType: 'list_69_not_located', found: false, checkedAt: refDate, reference: 'ref', createdAt: new Date() },
      { id: '2', fileId: 'file_123', listType: 'list_69_b', found: false, checkedAt: refDate, reference: 'ref', createdAt: new Date() },
      { id: '3', fileId: 'file_123', listType: 'list_69_b_bis', found: false, checkedAt: refDate, reference: 'ref', createdAt: new Date() },
    ];

    it('penalizes missing always-visible/mandatory documents', () => {
      // Empty documents list should penalize 5 documents (+75 pts)
      const scoreResult = calculateRiskScore(mockFile, [], satChecks, refDate);
      expect(scoreResult.score).toBe(75);
    });

    it('does not penalize missing conditional documents when not required', () => {
      const docs: Document[] = [
        { id: 'doc1', fileId: 'file_123', type: 'articles_of_incorporation', name: 'art.pdf', isActive: true, version: 1, createdAt: new Date() },
        { id: 'doc2', fileId: 'file_123', type: 'legal_representative_id', name: 'id.pdf', isActive: true, version: 1, createdAt: new Date() },
        { id: 'doc3', fileId: 'file_123', type: 'proof_of_address', name: 'address.pdf', isActive: true, version: 1, createdAt: new Date() },
        { id: 'doc4', fileId: 'file_123', type: 'tax_status_certificate', name: 'csf.pdf', isActive: true, version: 1, createdAt: new Date(), issueDate: refDate },
        { id: 'doc5', fileId: 'file_123', type: 'manifestation_under_protest', name: 'aml.pdf', isActive: true, version: 1, createdAt: new Date() },
      ];

      // File has powerOfAttorneyRequired: false, controllingPartyRequired: false. Qualifies for perfect bonus (-5)
      const scoreResult = calculateRiskScore(mockFile, docs, satChecks, refDate);
      expect(scoreResult.score).toBe(-5);
    });

    it('penalizes missing conditional documents when they are required', () => {
      const docs: Document[] = [
        { id: 'doc1', fileId: 'file_123', type: 'articles_of_incorporation', name: 'art.pdf', isActive: true, version: 1, createdAt: new Date() },
        { id: 'doc2', fileId: 'file_123', type: 'legal_representative_id', name: 'id.pdf', isActive: true, version: 1, createdAt: new Date() },
        { id: 'doc3', fileId: 'file_123', type: 'proof_of_address', name: 'address.pdf', isActive: true, version: 1, createdAt: new Date() },
        { id: 'doc4', fileId: 'file_123', type: 'tax_status_certificate', name: 'csf.pdf', isActive: true, version: 1, createdAt: new Date(), issueDate: refDate },
        { id: 'doc5', fileId: 'file_123', type: 'manifestation_under_protest', name: 'aml.pdf', isActive: true, version: 1, createdAt: new Date() },
      ];

      const modifiedFile = {
        ...mockFile,
        powerOfAttorneyRequired: true,
        controllingPartyRequired: true,
      };

      // Missing powerOfAttorney (+15) and controlling_party (+15). Total = 30
      const scoreResult = calculateRiskScore(modifiedFile, docs, satChecks, refDate);
      expect(scoreResult.score).toBe(30);
    });
  });
});
