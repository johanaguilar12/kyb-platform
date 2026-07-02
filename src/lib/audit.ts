import { prisma } from './prisma';
import { AuditAction, AuditLog } from '@/types';

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
  fileId?: string | null;
  beforeState?: Record<string, any> | null;
  afterState?: Record<string, any> | null;
  reason?: string | null;
}): Promise<AuditLog> {
  const log = await prisma.auditLog.create({
    data: {
      fileId: params.fileId ?? undefined,
      action: params.action,
      actor: params.actor,
      beforeState: params.beforeState ?? undefined,
      afterState: params.afterState ?? undefined,
      reason: params.reason ?? undefined,
    },
  });
  return {
    id: log.id,
    fileId: log.fileId ?? undefined,
    action: log.action as AuditAction,
    actor: log.actor,
    timestamp: log.timestamp,
    beforeState: (log.beforeState as Record<string, any>) ?? undefined,
    afterState: (log.afterState as Record<string, any>) ?? undefined,
    reason: log.reason ?? undefined,
  };
}
