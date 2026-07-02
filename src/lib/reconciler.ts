import { Document } from '@/types/document.types';

/**
 * Reconciliation result detailing any discrepancies found during verification.
 */
export interface ReconciliationResult {
  hasDiscrepancies: boolean;
  discrepancies: string[];
}

/**
 * Compares data across uploaded documents and input form values to flag material discrepancies
 * (RFC, corporate name, legal representative, address, dates).
 *
 * @param documents List of documents containing extracted data
 * @param formValues Values supplied during registration (e.g. RFC, corporate name)
 * @returns Result outlining whether any material discrepancies were detected
 */
export function reconcileExpedienteData(
  documents: Document[],
  formValues: {
    rfc: string;
    razonSocial: string;
    legalRepresentativeName?: string;
    address?: string;
  }
): ReconciliationResult {
  // Stub implementation
  return {
    hasDiscrepancies: false,
    discrepancies: [],
  };
}
