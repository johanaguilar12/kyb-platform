import { z } from 'zod';

export const createFileSchema = z.object({
  rfc: z.string().min(12).max(13).regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i, 'Invalid Mexican RFC format'),
  legalName: z.string().min(1, 'Legal name is required'),
});

export const updateFileSchema = z.object({
  status: z.enum(['draft', 'pending_review', 'approved', 'rejected', 'needs_update']),
  legalName: z.string().min(1).optional(),
});

export const createDocumentSchema = z.object({
  fileId: z.string().cuid(),
  type: z.enum([
    'articles_of_incorporation',
    'legal_representative_id',
    'power_of_attorney',
    'proof_of_address',
    'rfc',
    'tax_status_certificate',
    'manifestation_under_protest',
    'controlling_party',
  ]),
  name: z.string().min(1, 'Document name is required'),
  url: z.string().url().optional().nullable(),
  issueDate: z.string().datetime().optional().nullable(),
  expirationDate: z.string().datetime().optional().nullable(),
  textContent: z.string().optional().nullable(),
});

export const satCheckSchema = z.object({
  rfc: z.string().min(12).max(13).regex(/^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i, 'Invalid Mexican RFC format'),
  fileId: z.string().cuid().optional(),
});
