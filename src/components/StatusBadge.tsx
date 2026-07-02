import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-350',
    pending_review: 'bg-amber-100 text-amber-800 border-amber-300',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-rose-100 text-rose-800 border-rose-300',
    needs_update: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const labels: Record<string, string> = {
    draft: 'DRAFT',
    pending_review: 'PENDING REVIEW',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    needs_update: 'NEEDS UPDATE',
  };

  const styleClass = styles[status] || styles.draft;
  const labelText = labels[status] || status.toUpperCase();

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold border tracking-wider ${styleClass}`}>
      {labelText}
    </span>
  );
}
