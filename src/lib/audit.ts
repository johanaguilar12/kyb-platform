import { AuditAction, AuditLog } from '@/types/audit.types';

/**
 * Creates a compliance audit entry in the audit database.
 * Every administrative or scoring action must call this function to log history.
 *
 * @param params Audit parameters including action type, actor, and state changes
 * @returns A promise resolving to the created AuditLog entry
 */
export async function logAuditAction(params: {
  action: AuditAction;
  actor: string;
  expedienteId?: string | null;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  reason?: string | null;
}): Promise<AuditLog> {
  // Stub implementation
  return {
    id: 'stub-audit-id',
    expedienteId: params.expedienteId ?? null,
    action: params.action,
    actor: params.actor,
    timestamp: new Date(),
    beforeState: params.beforeState ?? null,
    afterState: params.afterState ?? null,
    reason: params.reason ?? null,
  };
}
