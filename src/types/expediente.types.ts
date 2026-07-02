/**
 * Status of an Expediente (KYB case/folder).
 * Transition flow: draft -> pending_review -> approved | rejected | needs_update
 */
export type ExpedienteStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'needs_update';

/**
 * Represents a Mexican company's KYB case folder (Expediente).
 */
export interface Expediente {
  id: string;
  rfc: string;
  razonSocial: string;
  status: ExpedienteStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required to create a new Expediente.
 */
export interface CreateExpedienteData {
  rfc: string;
  razonSocial: string;
}
