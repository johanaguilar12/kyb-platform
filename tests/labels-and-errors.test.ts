import { describe, it, expect } from 'vitest';
import { getDocumentLabel } from '@/lib/utils/document-labels';
import { getUserFriendlyError } from '@/lib/utils/error-messages';
import { replaceTechnicalNames, formatFactorCode, getFriendlyAction } from '@/components/RiskScoreCard';

describe('Document Labels and Error Mappings', () => {
  describe('Document Labels Mapping', () => {
    it('should map all 8 technical document types to human-readable names', () => {
      expect(getDocumentLabel('articles_of_incorporation')).toBe('Articles of Incorporation');
      expect(getDocumentLabel('legal_representative_id')).toBe('Legal Representative ID');
      expect(getDocumentLabel('proof_of_address')).toBe('Proof of Address');
      expect(getDocumentLabel('tax_status_certificate')).toBe('Tax Status Certificate');
      expect(getDocumentLabel('manifestation_under_protest')).toBe('Manifestation Under Protest');
      expect(getDocumentLabel('power_of_attorney')).toBe('Power of Attorney');
      expect(getDocumentLabel('controlling_party')).toBe('Controlling Party Information');
      expect(getDocumentLabel('rfc')).toBe('RFC Document');
    });

    it('should fall back gracefully to formatted name for unknown document types', () => {
      expect(getDocumentLabel('custom_unknown_doc_type')).toBe('Custom Unknown Doc Type');
      expect(getDocumentLabel('some_random_file')).toBe('Some Random File');
    });
  });

  describe('User Friendly Error Mappings', () => {
    it('should translate basic error codes correctly', () => {
      expect(getUserFriendlyError('RFC_MISMATCH')).toBe('RFC does not match the registered company RFC');
      expect(getUserFriendlyError('LEGAL_NAME_MISMATCH')).toBe('Legal name does not match the registered company name');
      expect(getUserFriendlyError('DOCUMENT_EXPIRED')).toBe('This document has expired');
      expect(getUserFriendlyError('CSF_NOT_CURRENT_MONTH')).toBe('Tax Status Certificate is not from the current month');
      expect(getUserFriendlyError('SAT_CHECK_OUTDATED')).toBe('SAT blacklist check is older than 90 days');
    });

    it('should format placeholder context parameters for missing required documents', () => {
      const err = getUserFriendlyError('MISSING_REQUIRED_DOCUMENT', { documentType: 'legal_representative_id' });
      expect(err).toBe('Missing required document: Legal Representative ID');
    });

    it('should format placeholder context parameters with custom document names', () => {
      const err = getUserFriendlyError('MISSING_REQUIRED_DOCUMENT', { documentName: 'Articles of Incorporation' });
      expect(err).toBe('Missing required document: Articles of Incorporation');
    });

    it('should append context values to output strings if present', () => {
      const err = getUserFriendlyError('RFC_MISMATCH', { fileValue: 'ABC123456XYZ', docValue: 'XYZ987654ABC' });
      expect(err).toBe('RFC does not match the registered company RFC (File: ABC123456XYZ, Document: XYZ987654ABC)');
    });

    it('should fallback to formatting the code for unknown error codes', () => {
      expect(getUserFriendlyError('SOME_NEW_ERROR_CODE')).toBe('Some New Error Code');
    });
  });

  describe('Risk Score Display Mappings', () => {
    it('should replace technical keys in explanation texts', () => {
      const explanation = 'Missing required documents: articles_of_incorporation, legal_representative_id';
      const clean = replaceTechnicalNames(explanation);
      expect(clean).toBe('Missing required documents: Articles of Incorporation, Legal Representative ID');
    });

    it('should convert technical factor codes into title case and override MISSING_REQUIRED_DOCUMENT', () => {
      expect(formatFactorCode('MISSING_REQUIRED_DOCUMENT')).toBe('Missing Required Document');
      expect(formatFactorCode('EXPIRED_DOCUMENT')).toBe('Expired Document');
      expect(formatFactorCode('FOUND_IN_69B')).toBe('Found In 69b');
    });

    it('should translate mandatory actions to a less technical description', () => {
      expect(getFriendlyAction('Block approval immediately. Escalate to compliance officer for formal review.')).toBe('Block approval. Escalate to compliance officer for review.');
      expect(getFriendlyAction('Perform manual review of the flagged items and request updates if necessary.')).toBe('Perform manual review of the flagged items.');
      expect(getFriendlyAction('Proceed with standard approval.')).toBe('Proceed with standard approval.');
    });
  });
});
