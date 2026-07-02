/**
 * The 8 mandatory document types required for a complete KYB folder (Expediente).
 */
export type DocumentType =
  | 'articles_of_incorporation'
  | 'legal_representative_id'
  | 'power_of_attorney'
  | 'proof_of_address'
  | 'rfc'
  | 'csf'
  | 'manifestation_under_protest'
  | 'controlling_party';

/**
 * Represents a document uploaded to an Expediente.
 */
export interface Document {
  id: string;
  expedienteId: string;
  type: DocumentType;
  name: string;
  url?: string | null;
  aiExtractedData?: Record<string, any> | null;
  issueDate?: Date | null;
  expirationDate?: Date | null;
  isActive: boolean;
  version: number;
  createdAt: Date;
}

/**
 * Status or results of a document validity validation.
 */
export interface DocumentValidity {
  isValid: boolean;
  errors: string[];
}
