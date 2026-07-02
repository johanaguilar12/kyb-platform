import React from 'react';

interface RiskFactor {
  code: string;
  score: number;
  description: string;
  category: string;
}

interface RiskScore {
  level: string;
  score: number;
  factors: RiskFactor[];
  explanation: string;
  suggestedAction: string;
  calculatedAt: string | Date;
}

interface RiskScoreCardProps {
  score?: RiskScore;
  onRecalculate?: () => void;
  isLoading?: boolean;
}

export function RiskScoreCard({ score, onRecalculate, isLoading }: RiskScoreCardProps) {
  if (!score) {
    return (
      <div className="bg-white border border-slate-200 text-sat-muted rounded p-6 text-center text-sm shadow-sm">
        No risk score calculated yet. Click the recalculate button to run scoring models.
      </div>
    );
  }

  const levelColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
    safe: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      border: 'border-emerald-350',
      label: 'SAFE',
    },
    review_required: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-350',
      label: 'REVIEW REQUIRED',
    },
    high_risk: {
      bg: 'bg-rose-100',
      text: 'text-rose-800',
      border: 'border-rose-350',
      label: 'HIGH RISK',
    },
  };

  const level = levelColors[score.level] || levelColors.safe;

  return (
    <div className="bg-white rounded border border-slate-350 shadow-sm overflow-hidden">
      {/* Header Info - SAT Blue */}
      <div className="bg-sat-primary text-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm tracking-wide uppercase">DETERMINISTIC COMPLIANCE RISK ASSESSMENT</h3>
          <p className="text-[11px] text-slate-300 font-medium mt-0.5">
            Evaluation Date: {new Date(score.calculatedAt).toLocaleString()}
          </p>
        </div>
        {onRecalculate && (
          <button
            onClick={onRecalculate}
            disabled={isLoading}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold bg-white text-sat-primary hover:bg-slate-100 rounded transition duration-150 disabled:opacity-50 uppercase tracking-wider"
          >
            {isLoading ? 'Processing...' : 'Recalculate Score'}
          </button>
        )}
      </div>

      {/* Main Score Visual */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Score Ring */}
        <div className="flex flex-col items-center justify-center border-r border-slate-200 pr-6">
          <div className="relative flex items-center justify-center">
            <div className={`w-28 h-28 rounded-full border-8 flex flex-col items-center justify-center transition-all ${
              score.level === 'high_risk'
                ? 'border-rose-500/20 bg-rose-50/30'
                : score.level === 'review_required'
                  ? 'border-amber-500/20 bg-amber-50/30'
                  : 'border-emerald-500/20 bg-emerald-50/30'
            }`}>
              <span className="text-4xl font-extrabold tracking-tight text-sat-dark">
                {score.score}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-sat-muted">
                POINTS
              </span>
            </div>
          </div>
          <span className={`mt-3 inline-flex px-3 py-1 rounded text-xs font-bold border tracking-wider ${level.bg} ${level.text} ${level.border}`}>
            {level.label}
          </span>
        </div>

        {/* Explanation & Action */}
        <div className="md:col-span-2 space-y-4">
          <div>
            <h4 className="font-bold text-xs text-sat-muted uppercase tracking-wider">COMPLIANCE DIAGNOSIS</h4>
            <p className="text-sm text-sat-dark mt-1 leading-relaxed font-medium">{score.explanation}</p>
          </div>
          <div>
            <h4 className="font-bold text-xs text-sat-muted uppercase tracking-wider">MANDATORY COMPLIANCE ACTION</h4>
            <p className="text-sm font-bold text-sat-secondary mt-1 uppercase tracking-wide">{score.suggestedAction}</p>
          </div>
        </div>
      </div>

      {/* Scoring Factors breakdown */}
      <div className="p-6 border-t border-slate-200 bg-slate-50/60">
        <h4 className="font-bold text-xs text-sat-muted uppercase tracking-wider mb-3">SCORING FACTOR REGISTER</h4>
        <div className="space-y-2">
          {score.factors.map((factor, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded border border-slate-300 bg-white text-xs"
            >
              <div className="flex items-center space-x-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                  factor.score > 0
                    ? factor.score >= 40
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {factor.code}
                </span>
                <span className="text-slate-700 font-semibold">{factor.description}</span>
              </div>
              <span className={`font-extrabold text-sm tabular-nums ${
                factor.score > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}>
                {factor.score > 0 ? `+${factor.score}` : factor.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
