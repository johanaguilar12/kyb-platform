export type DocumentType = 
  | 'articles_of_incorporation'
  | 'legal_representative_id'
  | 'power_of_attorney'
  | 'proof_of_address'
  | 'rfc'
  | 'tax_status_certificate'
  | 'manifestation_under_protest'
  | 'controlling_party';

export type DocumentValidity = 'valid' | 'expired' | 'missing';

export interface Document {
  id: string;
  fileId: string;
  type: DocumentType;
  name: string;
  url?: string | null;
  aiExtractedData?: Record<string, any> | null;
  pdfHash?: string | null;
  issueDate?: Date | null;
  expirationDate?: Date | null;
  isActive: boolean;
  version: number;
  confirmationStatus: string;
  confirmedAt?: Date | null;
  fileSize?: number | null;
  createdAt: Date;
}

export interface CreateDocumentData {
  fileId: string;
  type: DocumentType;
  name: string;
  url?: string;
  issueDate?: string;
  expirationDate?: string;
}
