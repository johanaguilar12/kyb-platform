import { Document } from '@/types';
import { normalizeString } from './utils/string-normalizer';

export interface Discrepancy {
  field: string;
  documents: string[];
  values: Array<{ documentType: string; value: string }>;
  severity: 'high' | 'medium' | 'low';
  description: string;
}

export interface ReconciliationResult {
  discrepancies: Discrepancy[];
  isConsistent: boolean;
  summary: string;
}

/**
 * Compare data across documents and detect material discrepancies.
 */
export function reconcileDocuments(documents: Document[]): ReconciliationResult {
  const discrepancies: Discrepancy[] = [];
  
  const taxCert = documents.find(d => d.type === 'tax_status_certificate' && d.isActive);
  const articles = documents.find(d => d.type === 'articles_of_incorporation' && d.isActive);
  const powerOfAttorney = documents.find(d => d.type === 'power_of_attorney' && d.isActive);
  const legalRepId = documents.find(d => d.type === 'legal_representative_id' && d.isActive);
  const proofOfAddress = documents.find(d => d.type === 'proof_of_address' && d.isActive);
  
  // 1. Compare RFC
  if (taxCert?.aiExtractedData?.rfc && articles?.aiExtractedData?.rfc) {
    if (normalizeString(taxCert.aiExtractedData.rfc) !== normalizeString(articles.aiExtractedData.rfc)) {
      discrepancies.push({
        field: 'rfc',
        documents: ['tax_status_certificate', 'articles_of_incorporation'],
        values: [
          { documentType: 'tax_status_certificate', value: taxCert.aiExtractedData.rfc },
          { documentType: 'articles_of_incorporation', value: articles.aiExtractedData.rfc }
        ],
        severity: 'high',
        description: 'RFC mismatch between tax status certificate and articles of incorporation'
      });
    }
  }
  
  // 2. Compare Legal Name
  if (taxCert?.aiExtractedData?.legalName && articles?.aiExtractedData?.legalName) {
    if (normalizeString(taxCert.aiExtractedData.legalName) !== normalizeString(articles.aiExtractedData.legalName)) {
      discrepancies.push({
        field: 'legal_name',
        documents: ['tax_status_certificate', 'articles_of_incorporation'],
        values: [
          { documentType: 'tax_status_certificate', value: taxCert.aiExtractedData.legalName },
          { documentType: 'articles_of_incorporation', value: articles.aiExtractedData.legalName }
        ],
        severity: 'high',
        description: 'Legal name mismatch between tax status certificate and articles of incorporation'
      });
    }
  }
  
  // 3. Compare Legal Representative
  if (powerOfAttorney?.aiExtractedData?.legalRepresentative && legalRepId?.aiExtractedData?.name) {
    if (normalizeString(powerOfAttorney.aiExtractedData.legalRepresentative) !== normalizeString(legalRepId.aiExtractedData.name)) {
      discrepancies.push({
        field: 'legal_representative',
        documents: ['power_of_attorney', 'legal_representative_id'],
        values: [
          { documentType: 'power_of_attorney', value: powerOfAttorney.aiExtractedData.legalRepresentative },
          { documentType: 'legal_representative_id', value: legalRepId.aiExtractedData.name }
        ],
        severity: 'high',
        description: 'Legal representative mismatch between power of attorney and ID'
      });
    }
  }
  
  // 4. Compare Address (allow minor differences, flag major ones)
  if (taxCert?.aiExtractedData?.address && proofOfAddress?.aiExtractedData?.address) {
    const addr1 = normalizeString(taxCert.aiExtractedData.address);
    const addr2 = normalizeString(proofOfAddress.aiExtractedData.address);
    
    if (addr1 !== addr2 && addr1.length > 10 && addr2.length > 10) {
      discrepancies.push({
        field: 'address',
        documents: ['tax_status_certificate', 'proof_of_address'],
        values: [
          { documentType: 'tax_status_certificate', value: taxCert.aiExtractedData.address },
          { documentType: 'proof_of_address', value: proofOfAddress.aiExtractedData.address }
        ],
        severity: 'medium',
        description: 'Address mismatch between tax status certificate and proof of address'
      });
    }
  }
  
  // 5. Check dates consistency (Power of attorney cannot be issued before Articles)
  if (articles?.aiExtractedData?.issueDate && powerOfAttorney?.aiExtractedData?.issueDate) {
    const articlesDate = new Date(articles.aiExtractedData.issueDate);
    const powerDate = new Date(powerOfAttorney.aiExtractedData.issueDate);
    
    if (powerDate.getTime() < articlesDate.getTime()) {
      discrepancies.push({
        field: 'issue_dates',
        documents: ['articles_of_incorporation', 'power_of_attorney'],
        values: [
          { documentType: 'articles_of_incorporation', value: articlesDate.toISOString() },
          { documentType: 'power_of_attorney', value: powerDate.toISOString() }
        ],
        severity: 'high',
        description: 'Power of attorney issued before articles of incorporation (logical error)'
      });
    }
  }
  
  return {
    discrepancies,
    isConsistent: discrepancies.length === 0,
    summary: discrepancies.length === 0 
      ? 'All documents are consistent'
      : `${discrepancies.length} discrepancy(ies) detected: ${discrepancies.map(d => d.field).join(', ')}`
  };
}
