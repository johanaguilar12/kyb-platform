import React from 'react';

interface AuditLog {
  id: string;
  action: string;
  actor: string;
  timestamp: string | Date;
  reason?: string;
}

interface AuditTableProps {
  logs?: AuditLog[];
}

export function AuditTable({ logs = [] }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 text-sat-muted rounded p-6 text-center text-sm shadow-sm">
        No administrative or compliance logs registered for this file.
      </div>
    );
  }

  const formatAction = (action: string) => {
    return action
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="overflow-x-auto rounded border border-slate-350 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-slate-300 text-left text-sm">
        <thead className="bg-slate-100 text-xs font-bold text-sat-dark uppercase tracking-wider border-b border-slate-350">
          <tr>
            <th className="px-4 py-3 border-r border-slate-300">Timestamp</th>
            <th className="px-4 py-3 border-r border-slate-300">Action</th>
            <th className="px-4 py-3 border-r border-slate-300">Actor</th>
            <th className="px-4 py-3">Reason / Details</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {logs.map((log, idx) => (
            <tr 
              key={log.id} 
              className={`hover:bg-slate-100/50 transition-colors ${
                idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
              }`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-xs text-sat-muted border-r border-slate-200">
                {new Date(log.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3 font-semibold text-sat-dark whitespace-nowrap border-r border-slate-200">
                {formatAction(log.action)}
              </td>
              <td className="px-4 py-3 text-slate-700 whitespace-nowrap border-r border-slate-200 font-medium">
                {log.actor}
              </td>
              <td className="px-4 py-3 text-slate-600 font-medium">
                {log.reason || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
