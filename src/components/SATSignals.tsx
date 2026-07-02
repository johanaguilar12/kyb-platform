import React from 'react';

interface SATSignalsProps {
  signals?: {
    not_located: boolean;
    list_69b: boolean;
    list_69b_bis: boolean;
    csd_revoked: boolean;
  };
  art_49_bis_status?: string;
  recommendation?: string;
  checkedAt?: string | Date;
}

export function SATSignals({
  signals,
  art_49_bis_status,
  recommendation,
  checkedAt,
}: SATSignalsProps) {
  if (!signals) {
    return (
      <div className="bg-white border border-dashed border-slate-350 text-sat-muted rounded p-6 text-center text-sm shadow-sm">
        No SAT list compliance check has been run yet for this RFC. Click the button above to perform verification.
      </div>
    );
  }

  const signalItems = [
    {
      name: 'Art. 69 CFF (Not Located)',
      active: signals.not_located,
      severity: 'high',
      description: 'Taxpayer not located at declared fiscal address.',
    },
    {
      name: 'Art. 69-B CFF (EFOS / Blacklist)',
      active: signals.list_69b,
      severity: 'critical',
      description: 'Taxpayer listed for presumed non-existent operations.',
    },
    {
      name: 'Art. 69-B Bis CFF (Definitive EFOS)',
      active: signals.list_69b_bis,
      severity: 'critical',
      description: 'Definitive blacklist for non-existent operations.',
    },
    {
      name: 'CSD Revoked List',
      active: signals.csd_revoked,
      severity: 'medium',
      description: 'Digital stamp certificate revoked or cancelled by the SAT.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Blacklist Signals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {signalItems.map((item, idx) => (
          <div
            key={idx}
            className={`p-4 rounded border transition-all duration-200 ${
              item.active
                ? item.severity === 'critical'
                  ? 'bg-rose-50 border-rose-350'
                  : 'bg-amber-50 border-amber-350'
                : 'bg-emerald-50/50 border-emerald-300'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-sm text-sat-dark">{item.name}</h4>
                <p className="text-xs text-sat-muted mt-1 leading-relaxed">{item.description}</p>
              </div>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border tracking-wider uppercase ${
                  item.active
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                }`}
              >
                {item.active ? 'FLAGGED' : 'CLEAN'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Honest statement about Article 49-Bis */}
      <div className="bg-blue-50 border border-blue-300 rounded p-5">
        <div className="flex items-start space-x-3">
          <div className="text-sat-secondary mt-0.5 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="font-bold text-sm text-sat-primary uppercase tracking-wide">Article 49-Bis CFF Subcontracting Verification</h4>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              There is currently <strong>no consolidated public dataset</strong> provided by the SAT for Article 49-Bis subcontracting. While CSD revocation status is reviewed as a risk signal, Article 49-Bis compliance is marked as{' '}
              <span className="font-bold text-sat-secondary underline uppercase">
                not verifiable with current public sources
              </span>
              .
            </p>
            <p className="text-xs text-slate-700 mt-2 font-semibold">
              Recommendation: Manually request the taxpayer's formal "Opinión de Cumplimiento de Obligaciones Fiscales" (Compliance Opinion) to fully verify subcontractor compliance.
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations Box */}
      <div className="bg-slate-100 border border-slate-350 rounded p-4">
        <h4 className="font-bold text-xs text-sat-muted uppercase tracking-wider">SAT Compliance Recommendation</h4>
        <p className="text-sm font-bold text-sat-dark mt-1">{recommendation || 'Proceed with standard approval.'}</p>
        {checkedAt && (
          <p className="text-[10px] text-sat-muted mt-2">
            Last Checked: {new Date(checkedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
