import { describe, it, expect } from 'vitest';
import { reconcileDocuments } from '@/lib/reconciler';
import { Document } from '@/types';

describe('Document Reconciler Unit Tests', () => {
  // Helper to generate a valid base set of documents
  function createConsistentDocuments(): Document[] {
    return [
      {
        id: 'doc_tax_cert',
        fileId: 'file_123',
        type: 'tax_status_certificate',
        name: 'tax_cert.pdf',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        aiExtractedData: {
          rfc: 'AAA010101AAA',
          legalName: 'TEST COMPANY SA DE CV',
          address: 'AV. JUAREZ 123, CENTRO, CDMX',
        },
      },
      {
        id: 'doc_articles',
        fileId: 'file_123',
        type: 'articles_of_incorporation',
        name: 'articles.pdf',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        aiExtractedData: {
          rfc: 'AAA010101AAA',
          legalName: 'TEST COMPANY S.A. DE C.V.', // minor spacing/period differences
          issueDate: '2020-01-15T00:00:00.000Z',
        },
      },
      {
        id: 'doc_power_of_attorney',
        fileId: 'file_123',
        type: 'power_of_attorney',
        name: 'power.pdf',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        aiExtractedData: {
          legalRepresentative: 'JUAN PEREZ LOPEZ',
          issueDate: '2020-02-20T00:00:00.000Z', // after articles
        },
      },
      {
        id: 'doc_legal_rep_id',
        fileId: 'file_123',
        type: 'legal_representative_id',
        name: 'id.pdf',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        aiExtractedData: {
          name: 'Juan Perez Lopez', // lowercase/uppercase accent difference
        },
      },
      {
        id: 'doc_proof_address',
        fileId: 'file_123',
        type: 'proof_of_address',
        name: 'proof.pdf',
        isActive: true,
        version: 1,
        createdAt: new Date(),
        aiExtractedData: {
          address: 'Av. Juarez 123, Centro, CDMX.', // minor differences
        },
      },
    ];
  }

  // 1. All consistent -> no discrepancies
  it('should return isConsistent=true with zero discrepancies when all documents align', () => {
    const documents = createConsistentDocuments();
    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  // 2. RFC mismatch -> high severity
  it('should flag an RFC mismatch with high severity', () => {
    const documents = createConsistentDocuments();
    const articles = documents.find(d => d.type === 'articles_of_incorporation')!;
    articles.aiExtractedData!.rfc = 'MISMATCHRFC12';

    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(false);
    const rfcCheck = result.discrepancies.find(d => d.field === 'rfc');
    expect(rfcCheck).toBeDefined();
    expect(rfcCheck?.severity).toBe('high');
    expect(rfcCheck?.description).toContain('RFC mismatch');
  });

  // 3. Legal name mismatch -> high severity
  it('should flag a legal name mismatch with high severity', () => {
    const documents = createConsistentDocuments();
    const articles = documents.find(d => d.type === 'articles_of_incorporation')!;
    articles.aiExtractedData!.legalName = 'DIFFERENT LEGAL NAME S.A. DE C.V.';

    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(false);
    const nameCheck = result.discrepancies.find(d => d.field === 'legal_name');
    expect(nameCheck).toBeDefined();
    expect(nameCheck?.severity).toBe('high');
  });

  // 4. Legal representative mismatch -> high severity
  it('should flag a legal representative mismatch with high severity', () => {
    const documents = createConsistentDocuments();
    const legalRepId = documents.find(d => d.type === 'legal_representative_id')!;
    legalRepId.aiExtractedData!.name = 'MARIA GOMEZ PEREZ';

    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(false);
    const repCheck = result.discrepancies.find(d => d.field === 'legal_representative');
    expect(repCheck).toBeDefined();
    expect(repCheck?.severity).toBe('high');
  });

  // 5. Address major mismatch -> medium severity
  it('should flag a major address mismatch with medium severity', () => {
    const documents = createConsistentDocuments();
    const proofOfAddress = documents.find(d => d.type === 'proof_of_address')!;
    proofOfAddress.aiExtractedData!.address = 'REFORMA 500, JUAREZ, CDMX';

    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(false);
    const addrCheck = result.discrepancies.find(d => d.field === 'address');
    expect(addrCheck).toBeDefined();
    expect(addrCheck?.severity).toBe('medium');
  });

  // 6. Address minor mismatch -> no discrepancy (normalization works)
  it('should ignore minor differences in spacing, case, accents, and punctuation', () => {
    const documents = createConsistentDocuments();
    
    // Add accents and casing differences to the legal name & rep
    const taxCert = documents.find(d => d.type === 'tax_status_certificate')!;
    taxCert.aiExtractedData!.legalName = 'TÉST CÓMPÁNY, S.A. DE C.V. -';
    
    const powerOfAttorney = documents.find(d => d.type === 'power_of_attorney')!;
    powerOfAttorney.aiExtractedData!.legalRepresentative = 'Júán Pérez López';

    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  // 7. Empty documents -> graceful handling (isConsistent: true)
  it('should handle empty document lists gracefully', () => {
    const result = reconcileDocuments([]);
    expect(result.isConsistent).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  // 8. Missing documents -> skip comparison for missing types
  it('should skip comparison rules for missing document types', () => {
    const documents = createConsistentDocuments().filter(
      d => d.type !== 'tax_status_certificate'
    );
    
    const result = reconcileDocuments(documents);

    // Should skip RFC, Name, and Address comparisons since tax_status_certificate is missing
    expect(result.isConsistent).toBe(true);
    expect(result.discrepancies).toHaveLength(0);
  });

  // 9. Date inconsistency (Power before Articles) -> high severity
  it('should flag if the power of attorney was issued before the articles of incorporation', () => {
    const documents = createConsistentDocuments();
    const powerOfAttorney = documents.find(d => d.type === 'power_of_attorney')!;
    powerOfAttorney.aiExtractedData!.issueDate = '2019-12-01T00:00:00.000Z'; // before articles (2020-01-15)

    const result = reconcileDocuments(documents);

    expect(result.isConsistent).toBe(false);
    const dateCheck = result.discrepancies.find(d => d.field === 'issue_dates');
    expect(dateCheck).toBeDefined();
    expect(dateCheck?.severity).toBe('high');
  });
});
