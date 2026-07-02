export type AuditAction = 
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'score_calculated'
  | 'document_uploaded'
  | 'sat_check_performed';

export interface AuditLog {
  id: string;
  fileId?: string;
  action: AuditAction;
  actor: string;
  timestamp: Date;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  reason?: string;
}
