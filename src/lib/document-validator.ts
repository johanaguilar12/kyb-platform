import { Document, DocumentType } from '@/types';

export interface DocumentValidityResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a single document's metadata (e.g., expiration date, whether a tax status certificate is from the current month).
 *
 * @param document The document object to validate
 * @returns An object containing the validation state and any error messages
 */
export function validateDocument(document: Document): DocumentValidityResult {
  // Stub implementation
  return {
    isValid: true,
    errors: [],
  };
}

/**
 * Verifies if the list of documents satisfies all mandatory KYB document requirements.
 *
 * @param documents List of uploaded active documents
 * @returns A list of missing DocumentType values
 */
export function getMissingRequiredDocuments(documents: Document[]): DocumentType[] {
  // Stub implementation
  return [];
}
