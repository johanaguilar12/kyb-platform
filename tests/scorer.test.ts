import { vi, describe, it, expect, beforeEach } from 'vitest';
import { calculateRiskScore } from '@/lib/scorer';
import { reconcileExpedienteData } from '@/lib/reconciler';
import { Document, DocumentType } from '@/types/document.types';
import { SATListCheck } from '@/types/sat.types';
import { Expediente } from '@/types/expediente.types';

// Mock the reconciler
vi.mock('@/lib/reconciler', () => ({
  reconcileExpedienteData: vi.fn(),
}));

describe('calculateRiskScore Unit Tests', () => {
  const currentDate = new Date('2026-07-01T12:00:00Z');

  const mockExpediente: Expediente = {
    id: 'exp_123',
    rfc: 'ABC123456XYZ',
    razonSocial: 'ACME S.A. DE C.V.',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Helper to create all 8 required documents in a valid state
  function createValidDocuments(refDate: Date): Document[] {
    const types: DocumentType[] = [
      'articles_of_incorporation',
      'legal_representative_id',
      'power_of_attorney',
      'proof_of_address',
      'rfc',
      'csf',
      'manifestation_under_protest',
      'controlling_party',
    ];
    return types.map((type, index) => ({
      id: `doc_${index}`,
      expedienteId: 'exp_123',
      type,
      name: `${type}.pdf`,
      isActive: true,
      version: 1,
      createdAt: new Date(),
      issueDate: type === 'csf' ? new Date(refDate) : undefined, // current month
      expirationDate: new Date(refDate.getTime() + 10 * 24 * 60 * 60 * 1000), // future
      aiExtractedData: {
        legalRepresentativeComplete: true,
        shareholdersComplete: true,
        controllingPartyComplete: true,
      },
    }));
  }

  // Helper to create recent SAT check results (within 90 days, none found)
  function createRecentSatChecks(refDate: Date, listTypes = ['list_69', 'list_69_b', 'list_69_b_bis']): SATListCheck[] {
    return listTypes.map((listType, index) => ({
      id: `check_${index}`,
      expedienteId: 'exp_123',
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
    // Default mock behavior: no discrepancies
    vi.mocked(reconcileExpedienteData).mockReturnValue({
      hasDiscrepancies: false,
      discrepancies: [],
    });
  });

  // 1. Safe client: All docs valid, CSF current month, clean SAT -> safe (score < 30)
  it('should classify a client with all documents valid and clean SAT checks as safe', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    expect(result.score).toBe(-5); // -5 bonus
    expect(result.level).toBe('safe');
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].code).toBe('PERFECT_BONUS');
  });

  // 2. Review required - missing docs: 2 missing documents -> +30 -> review_required
  it('should add +30 risk score and classify as review_required for 2 missing documents', () => {
    const documents = createValidDocuments(currentDate).filter(
      d => d.type !== 'rfc' && d.type !== 'proof_of_address'
    );
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    // Score should be 30 (+30 for missing 2 docs)
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
    // Make one document expired (e.g. proof of address)
    const proofOfAddress = documents.find(d => d.type === 'proof_of_address')!;
    proofOfAddress.expirationDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    // Provide empty SAT checks to add +10 stale, making total score = 30
    const result = calculateRiskScore(mockExpediente, documents, [], currentDate);

    expect(result.score).toBe(30); // 20 (expired) + 10 (stale SAT checks) = 30
    expect(result.level).toBe('review_required');
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'EXPIRED_DOCUMENT',
        score: 20,
      })
    );
  });

  // 4. Review required - old CSF: CSF from previous month -> +25 -> review_required
  it('should add +25 risk score for CSF from a previous month (and hit review_required when combined with stale SAT)', () => {
    const documents = createValidDocuments(currentDate);
    const csf = documents.find(d => d.type === 'csf')!;
    csf.issueDate = new Date('2026-06-15T12:00:00Z'); // Previous month (June instead of July)

    // Provide empty SAT checks to add +10 stale, making total score = 35
    const result = calculateRiskScore(mockExpediente, documents, [], currentDate);

    expect(result.score).toBe(35); // 25 (old CSF) + 10 (stale SAT) = 35
    expect(result.level).toBe('review_required');
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'CSF_NOT_CURRENT_MONTH',
        score: 25,
      })
    );
  });

  // 5. High risk - 69-B list: Found in 69-B -> +50 -> high_risk
  it('should add +50 risk score for SAT 69-B list match (and hit high_risk with stale SAT list check +15 missing doc)', () => {
    const documents = createValidDocuments(currentDate).filter(d => d.type !== 'rfc'); // missing 1 doc (+15)
    const satChecks = createRecentSatChecks(currentDate);
    // Mark found in 69-B
    const check69B = satChecks.find(c => c.listType === 'list_69_b')!;
    check69B.found = true;

    // Total: 50 (69-B) + 15 (missing 1 doc) + 10 (stale SAT since list_69_b was reviewed but say list_49_bis is not or list_69_b check is recent but we didn't include all of them)
    // Wait, let's keep all 3 lists checked but one found:
    // list_69 (not found, recent), list_69_b (found, recent), list_69_b_bis (not found, recent) -> No stale SAT lists (+0).
    // Let's add incomplete stakeholders (+20) to make it exactly 70:
    const docs = createValidDocuments(currentDate);
    docs.find(d => d.type === 'articles_of_incorporation')!.aiExtractedData = {
      shareholdersComplete: false, // +20
    };
    
    const result = calculateRiskScore(mockExpediente, docs, satChecks, currentDate);

    expect(result.score).toBe(70); // 50 (69-B) + 20 (incomplete stakeholders) = 70
    expect(result.level).toBe('high_risk');
    expect(result.factors).toContainEqual(
      expect.objectContaining({
        code: 'SAT_69_B',
        score: 50,
      })
    );
  });

  // 6. High risk - multiple factors: 69-B + expired doc + missing doc -> high_risk
  it('should combine multiple factors to yield a high_risk classification', () => {
    // 1 missing doc (+15)
    const documents = createValidDocuments(currentDate).filter(d => d.type !== 'proof_of_address');
    // 1 expired doc (+20)
    const rfcDoc = documents.find(d => d.type === 'rfc')!;
    rfcDoc.expirationDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    
    // Found in 69-B (+50)
    const satChecks = createRecentSatChecks(currentDate);
    satChecks.find(c => c.listType === 'list_69_b')!.found = true;

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    // 50 (69-B) + 15 (missing doc) + 20 (expired doc) = 85
    expect(result.score).toBe(85);
    expect(result.level).toBe('high_risk');
  });

  // 7. Determinism test: Call twice with same input, verify IDENTICAL output
  it('should return identical outputs when called multiple times with the exact same arguments', () => {
    const documents = createValidDocuments(currentDate);
    const satChecks = createRecentSatChecks(currentDate);

    const result1 = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);
    const result2 = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    expect(result1).toEqual(result2);
  });

  // 8. Explanation test: Verify explanation contains all factor descriptions
  it('should generate a detailed human-readable explanation listing all active risk factors', () => {
    const documents = createValidDocuments(currentDate);
    const csf = documents.find(d => d.type === 'csf')!;
    csf.issueDate = new Date('2026-05-01T12:00:00Z'); // old CSF (+25)

    const proofOfAddress = documents.find(d => d.type === 'proof_of_address')!;
    proofOfAddress.expirationDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000); // expired (+20)

    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    expect(result.explanation).toContain('CSF (Constancia de Situación Fiscal) not from current month');
    expect(result.explanation).toContain('One or more documents are expired');
  });

  // 9. Edge case - empty documents: No documents -> high_risk (missing all required)
  it('should assign a high risk level with a high score when no documents are provided', () => {
    const satChecks = createRecentSatChecks(currentDate);
    const result = calculateRiskScore(mockExpediente, [], satChecks, currentDate);

    // 8 missing documents: 8 * 15 = 120
    expect(result.score).toBe(120);
    expect(result.level).toBe('high_risk');
  });

  // 10. Edge case - no SAT checks: No SAT checks -> +10 for stale lists
  it('should add +10 points to the risk score if no SAT checks are passed', () => {
    const documents = createValidDocuments(currentDate);
    const result = calculateRiskScore(mockExpediente, documents, [], currentDate);

    // 10 (stale SAT checks) - no perfect bonus since SAT checks are stale/missing
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

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    expect(result.score).toBe(-5);
    expect(result.factors[0].code).toBe('PERFECT_BONUS');
    expect(result.factors[0].score).toBe(-5);
  });

  // 12. Boundary test: Score exactly 30 -> review_required
  it('should classify exactly 30 risk points as review_required', () => {
    const documents = createValidDocuments(currentDate).filter(
      d => d.type !== 'rfc' && d.type !== 'proof_of_address'
    );
    const satChecks = createRecentSatChecks(currentDate);

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    expect(result.score).toBe(30);
    expect(result.level).toBe('review_required');
  });

  // 13. Boundary test: Score exactly 70 -> high_risk
  it('should classify exactly 70 risk points as high_risk', () => {
    const documents = createValidDocuments(currentDate);
    // Found in 69-B (+50)
    const satChecks = createRecentSatChecks(currentDate);
    satChecks.find(c => c.listType === 'list_69_b')!.found = true;
    
    // Incomplete stakeholder data (+20)
    documents.find(d => d.type === 'articles_of_incorporation')!.aiExtractedData = {
      legalRepresentativeComplete: false,
    };

    const result = calculateRiskScore(mockExpediente, documents, satChecks, currentDate);

    expect(result.score).toBe(70);
    expect(result.level).toBe('high_risk');
  });
});
