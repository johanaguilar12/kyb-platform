/**
 * Classification level based on the computed risk score:
 * - score < 30 -> safe
 * - 30 <= score < 70 -> review_required
 * - score >= 70 -> high_risk
 */
export type RiskLevel = 'safe' | 'review_required' | 'high_risk';

/**
 * An individual factor contributing to the overall risk score.
 */
export interface RiskFactor {
  code: string;
  score: number;
  description: string;
}

/**
 * The final risk scoring result computed for an Expediente.
 */
export interface RiskScore {
  id: string;
  expedienteId: string;
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  explanation: string;
  suggestedAction: string;
  calculatedAt: Date;
}
