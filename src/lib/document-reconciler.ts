import { compareRFC, compareLegalNames, compareAddresses, calculateSimilarity } from './string-utils';
import { getDocumentLabel } from './utils/document-labels';

export interface ReconciliationInput {
  newDocType: string;
  newDocData: Record<string, any>;
  fileRfc: string;
  fileLegalName: string;
  existingDocs: Array<{
    type: string;
    aiExtractedData: any;
  }>;
}

export interface ReconciliationOutput {
  isValid: boolean;
  criticalError?: string;
  errors: string[];
  warnings: string[];
}

/**
 * Validates document metadata against the dossier File definitions and other active documents.
 * Returns critical errors (RFC mismatch, low similarity legal name) and warnings (minor legal name spelling differences, address deviations, rep mismatches).
 */
export function reconcileDocumentUpload(input: ReconciliationInput): ReconciliationOutput {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { newDocType, newDocData, fileRfc, fileLegalName, existingDocs } = input;

  // A. RFC Validation (CRITICAL)
  if (newDocData.rfc) {
    // 1. Compare vs File Registered RFC
    if (!compareRFC(newDocData.rfc, fileRfc)) {
      const errorPayload = JSON.stringify({
        code: 'RFC_MISMATCH',
        context: { fileValue: fileRfc, docValue: newDocData.rfc }
      });
      errors.push(errorPayload);
      return {
        isValid: false,
        criticalError: `RFC mismatch: Document RFC (${newDocData.rfc}) does not match registered File RFC (${fileRfc}).`,
        errors,
        warnings,
      };
    }

    // 2. Compare vs existing documents
    for (const doc of existingDocs) {
      const docData = doc.aiExtractedData as Record<string, any> | null;
      if (docData?.rfc) {
        if (!compareRFC(newDocData.rfc, docData.rfc)) {
          const errorPayload = JSON.stringify({
            code: 'RFC_MISMATCH',
            context: { fileValue: docData.rfc, docValue: newDocData.rfc }
          });
          errors.push(errorPayload);
          return {
            isValid: false,
            criticalError: `RFC mismatch: Document RFC (${newDocData.rfc}) does not match existing ${getDocumentLabel(doc.type)} RFC (${docData.rfc}).`,
            errors,
            warnings,
          };
        }
      }
    }
  }

  // B. Legal Name Validation (STRICT - No Fuzzy Matching)
  if (newDocData.legalName) {
    const nameComp = compareLegalNames(newDocData.legalName, fileLegalName);
    if (!nameComp.matches) {
      const errorPayload = JSON.stringify({
        code: 'LEGAL_NAME_MISMATCH',
        context: { fileValue: fileLegalName, docValue: newDocData.legalName }
      });
      errors.push(errorPayload);
      const msg = `Legal name mismatch:\n- File: [${fileLegalName}]\n- Document: [${newDocData.legalName}]\n\nThe legal names do not match. Please ensure the document belongs to this company.`;
      return {
        isValid: false,
        criticalError: msg,
        errors,
        warnings,
      };
    }
  }

  // C. Legal Representative Validation (WARNING)
  const repName = newDocData.legalRepresentative || newDocData.name;
  if (repName) {
    for (const doc of existingDocs) {
      const docData = doc.aiExtractedData as Record<string, any> | null;
      const docRepName = docData?.legalRepresentative || docData?.name;
      if (docRepName) {
        const similarity = calculateSimilarity(repName, docRepName);
        if (similarity < 0.8) {
          warnings.push(`Legal Representative mismatch warning: "${repName}" does not match existing ${getDocumentLabel(doc.type)} representative "${docRepName}".`);
        }
      }
    }
  }

  // D. Address Validation (WARNING)
  if (newDocData.address) {
    for (const doc of existingDocs) {
      const docData = doc.aiExtractedData as Record<string, any> | null;
      if (docData?.address) {
        if (!compareAddresses(newDocData.address, docData.address)) {
          warnings.push(`Address mismatch warning: Address in uploaded document does not match address in existing ${getDocumentLabel(doc.type)}.`);
        }
      }
    }
  }

  return {
    isValid: true,
    errors,
    warnings,
  };
}
