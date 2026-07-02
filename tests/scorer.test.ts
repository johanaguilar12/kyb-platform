import { vi, describe, it, expect, beforeEach } from 'vitest';
import { calculateRiskScore } from '@/lib/scorer';
import { reconcileDocuments } from '@/lib/reconciler';
import { Document, DocumentType, File, SATListCheck } from '@/types';

// Mock the reconciler
vi.mock('@/lib/reconciler', () => ({
  reconcileDocuments: vi.fn(),
}));

describe('calculateRiskScore Unit Tests (English Refactored)', () => {
  const currentDate = new Date('2026-07-01T12:00:00Z');

  const mockFile: File = {
    id: 'file_123',
    rfc: 'ABC123456XYZ',
    legalName: 'ACME S.A. DE C.V.',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper to create all 5 required documents in a valid state
  function createValidDocuments(refDate: Date): Document[] {
    const types: DocumentType[] = [
      'articles_of_incorporation',
      'legal_representative_id',
      'proof_of_address',
      'tax_status_certificate',
      'manifestation_under_protest',
    ];
    return types.map((type, index) => ({
      id: `doc_${index}`,
      fileId: 'file_123',
      type,
      name: `${type}.pdf`,
      isActive: true,
      version: 1,
      createdAt: new Date(),
      issueDate: type === 'tax_status_certificate' ? new Date(refDate) : undefined, // current month
      expirationDate: new Date(refDate.getTime() + 10 * 24 * 60 * 60 * 1000), // future
      aiExtractedData: {
        legalRepresentativeComplete: true,
        shareholdersComplete: true,
        controllingPartyComplete: true,
      },
    }));
  }

  // Helper to create recent SAT check results (within 90 days, none found)
  function createRecentSatChecks(refDate: Date, listTypes = ['list_69_not_located', 'list_69_b', 'list_69_b_bis']): SATListCheck[] {
    return listTypes.map((listType, index) => ({
      id: `check_${index}`,
      fileId: 'file_123',
      rfc: 'ABC123456XYZ',
      listType: listType as any,
      found: false,
      checkedAt: new Date(refDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      source: 'http://example.com/sat',
      reference: 'SAT-Check-Ref',
    }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock behavior: consistent
    vi.mocked(reconcileDocuments).mockReturnValue({
      isConsistent: true,
      discrepancies: [],
      summary: 'Consistent',
    });
  });

  // 1. Safe client: All docs valid, tax status certificate current month, clean SAT -> safe (score < 30)
  it('should classify a client with all documents valid and clean SAT checks as safe', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(-5); // -5 bonus
    expect(result.level).toBe('safe');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].code).toBe('PERFECT_BONUS');
  });

  // 2. Review required - missing docs: 2 missing documents -> +30 -> review_required
  it('should add +30 risk score and classify as review_required for 2 missing documents', () => {
    const documents = createValidDocuments(currentDate).filter(
      d => d.type !== 'legal_representative_id' && d.type !== 'proof_of_address'
    );
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(30);
    expect(result.level).toBe('review_required');
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'MISSING_REQUIRED_DOCUMENT',
        score: 30,
      })
    );
  });

  // 3. Review required - expired doc: 1 expired document -> +20 -> review_required
  it('should add +20 risk score for an expired document (and hit review_required when combined with stale SAT list checks)', () => {
    const documents = createValidDocuments(currentDate);
    const proofOfAddress = documents.find(d => d.type === 'proof_of_address')!;
    proofOfAddress.expirationDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    const result = calculateRiskScore(mockFile, documents, [], currentDate); // no SAT -> +10

    expect(result.score).toBe(30); // 20 (expired) + 10 (stale SAT) = 30
    expect(result.level).toBe('review_required');
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'EXPIRED_DOCUMENT',
        score: 20,
      })
    );
  });

  // 4. Review required - old tax status certificate: tax status certificate from previous month -> +25 -> review_required
  it('should add +25 risk score for tax status certificate from a previous month', () => {
    const documents = createValidDocuments(currentDate);
    const taxCert = documents.find(d => d.type === 'tax_status_certificate')!;
    taxCert.issueDate = new Date('2026-06-15T12:00:00Z'); // Previous month

    const result = calculateRiskScore(mockFile, documents, [], currentDate); // +10 stale SAT

    expect(result.score).toBe(35); // 25 (old cert) + 10 (stale SAT) = 35
    expect(result.level).toBe('review_required');
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'TAX_CERTIFICATE_NOT_CURRENT_MONTH',
        score: 25,
      })
    );
  });

  // 5. High risk - 69-B list: Found in 69-B -> +50 -> high_risk
  it('should add +50 risk score for SAT 69-B list match and hit high_risk when combined with incomplete stakeholders', () => {
    const documents = createValidDocuments(currentDate);
    documents.find(d => d.type === 'articles_of_incorporation')!.aiExtractedData = {
      shareholdersComplete: false, // +20
    };

    const satChecks = createRecentSatChecks(currentDate);
    satChecks.find(c => c.listType === 'list_69_b')!.found = true;

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(70); // 50 (69-B) + 20 (incomplete stakeholders) = 70
    expect(result.level).toBe('high_risk');
  });

  // 6. High risk - multiple factors: 69-B + expired doc + missing doc -> high_risk
  it('should combine multiple factors to yield a high_risk classification', () => {
    // 1 missing doc (+15)
    const documents = createValidDocuments(currentDate).filter(d => d.type !== 'proof_of_address');
    // 1 expired doc (+20)
    const articles = documents.find(d => d.type === 'articles_of_incorporation')!;
    articles.expirationDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);

    const satChecks = createRecentSatChecks(currentDate);
    satChecks.find(c => c.listType === 'list_69_b')!.found = true; // +50

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(85); // 50 + 20 + 15 = 85
    expect(result.level).toBe('high_risk');
  });

  // 7. Determinism test: Call twice with same input, verify IDENTICAL output
  it('should return identical outputs when called multiple times with the exact same arguments', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    const result1 = calculateRiskScore(mockFile, documents, satChecks, currentDate);
    const result2 = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result1).toEqual(result2);
  });

  // 8. Explanation test: Verify explanation contains all factor descriptions
  it('should generate a detailed human-readable explanation listing all active risk factors', () => {
    const documents = createValidDocuments(currentDate);
    const taxCert = documents.find(d => d.type === 'tax_status_certificate')!;
    taxCert.issueDate = new Date('2026-05-01T12:00:00Z'); // old (+25)

    const proofOfAddress = documents.find(d => d.type === 'proof_of_address')!;
    proofOfAddress.expirationDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // expired (+20)

    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.explanation).toContain('Tax status certificate not from current month');
    expect(result.explanation).toContain('One or more documents are expired');
  });

  // 9. Edge case - empty documents: No documents -> high_risk (missing all required)
  it('should assign a high risk level with a high score when no documents are provided', () => {
    const satChecks = createRecentSatChecks(currentDate);
    const result = calculateRiskScore(mockFile, [], satChecks, currentDate);

    // 5 missing documents: 5 * 15 = 75
    expect(result.score).toBe(75);
    expect(result.level).toBe('high_risk');
  });

  // 10. Edge case - no SAT checks: No SAT checks -> +10 for stale lists
  it('should add +10 points to the risk score if no SAT checks are passed', () => {
    const documents = createValidDocuments(currentDate);
    const result = calculateRiskScore(mockFile, documents, [], currentDate);

    expect(result.score).toBe(10);
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'SAT_NOT_REVIEWED',
        score: 10,
      })
    );
  });

  // 11. Bonus test: All perfect -> -5 bonus applied
  it('should apply a -5 bonus when all documents are completely compliant and up-to-date', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(-5);
    expect(result.factors[0].code).toBe('PERFECT_BONUS');
  });

  // 12. Boundary test: Score exactly 30 -> review_required
  it('should classify exactly 30 risk points as review_required', () => {
    const documents = createValidDocuments(currentDate).filter(
      d => d.type !== 'legal_representative_id' && d.type !== 'proof_of_address'
    );
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(30);
    expect(result.level).toBe('review_required');
  });

  // 13. Boundary test: Score exactly 70 -> high_risk
  it('should classify exactly 70 risk points as high_risk', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);
    satChecks.find(c => c.listType === 'list_69_b')!.found = true; // +50

    documents.find(d => d.type === 'articles_of_incorporation')!.aiExtractedData = {
      legalRepresentativeComplete: false, // +20
    };

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.score).toBe(70);
    expect(result.level).toBe('high_risk');
  });

  // 14. Discrepancies increase score by +30 each (high severity)
  it('should increase score by +30 for one high severity discrepancy', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    vi.mocked(reconcileDocuments).mockReturnValue({
      isConsistent: false,
      discrepancies: [
        {
          field: 'rfc',
          documents: ['tax_status_certificate', 'articles_of_incorporation'],
          values: [],
          severity: 'high',
          description: 'RFC mismatch',
        },
      ],
      summary: '1 discrepancy',
    });

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    // -5 bonus is deactivated due to inconsistency. Score is 30.
    expect(result.score).toBe(30);
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'DOCUMENT_DISCREPANCY',
        score: 30,
      })
    );
  });

  // 15. Explanation includes discrepancy details
  it('should include details of the high severity discrepancies in the generated explanation', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    vi.mocked(reconcileDocuments).mockReturnValue({
      isConsistent: false,
      discrepancies: [
        {
          field: 'legal_name',
          documents: ['tax_status_certificate', 'articles_of_incorporation'],
          values: [],
          severity: 'high',
          description: 'Legal name mismatch',
        },
      ],
      summary: '1 discrepancy',
    });

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    expect(result.explanation).toContain('material discrepancy(ies) detected: legal_name');
  });

  // 16. Multiple discrepancies stack correctly (e.g. +60 for two high severity discrepancies)
  it('should stack multiple high severity discrepancies correctly (e.g. +60 for two high severity discrepancies)', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    vi.mocked(reconcileDocuments).mockReturnValue({
      isConsistent: false,
      discrepancies: [
        {
          field: 'rfc',
          documents: [],
          values: [],
          severity: 'high',
          description: 'RFC mismatch',
        },
        {
          field: 'legal_representative',
          documents: [],
          values: [],
          severity: 'high',
          description: 'Rep mismatch',
        },
        {
          field: 'address',
          documents: [],
          values: [],
          severity: 'medium', // should be ignored in score impact calculation since it is medium severity
          description: 'Address mismatch',
        },
      ],
      summary: '3 discrepancies',
    });

    const result = calculateRiskScore(mockFile, documents, satChecks, currentDate);

    // 2 high severity discrepancies * 30 = 60
    expect(result.score).toBe(60);
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'DOCUMENT_DISCREPANCY',
        score: 60,
      })
    );
  });
});
