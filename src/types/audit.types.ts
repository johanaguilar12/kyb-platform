/**
 * The types of actions recorded in the compliance audit log.
 */
export type AuditAction =
  | 'CREATE_EXPEDIENTE'
  | 'UPDATE_EXPEDIENTE_STATUS'
  | 'UPLOAD_DOCUMENT'
  | 'REPLACE_DOCUMENT'
  | 'DELETE_DOCUMENT'
  | 'RUN_SAT_CHECK'
  | 'CALCULATE_RISK_SCORE'
  | 'MANUAL_OVERRIDE'
  | 'SYSTEM_AUTO_TRANSITION';

/**
 * Represents an entry in the compliance audit log for tracking system actions.
 */
export interface AuditLog {
  id: string;
  expedienteId?: string | null;
  action: AuditAction;
  actor: string; // e.g., user email or 'SYSTEM'
  timestamp: Date;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  reason?: string | null;
}
