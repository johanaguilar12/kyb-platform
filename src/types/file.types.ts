import { Document } from './document.types';
import { SATListCheck } from './sat.types';
import { RiskScore } from './scoring.types';
import { AuditLog } from './audit.types';

export type FileStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'needs_update';

export interface File {
  id: string;
  rfc: string;
  legalName: string;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
  documents?: Document[];
  satListChecks?: SATListCheck[];
  riskScore?: RiskScore;
  auditLogs?: AuditLog[];
  powerOfAttorneyRequired?: boolean | null;
  powerOfAttorneyReason?: string | null;
  controllingPartyRequired?: boolean | null;
  controllingPartyReason?: string | null;
}

export interface CreateFileData {
  rfc: string;
  legalName: string;
}

export interface UpdateFileData {
  status?: FileStatus;
  legalName?: string;
}
