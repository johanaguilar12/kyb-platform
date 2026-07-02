export type RiskLevel = 'safe' | 'review_required' | 'high_risk';

export interface RiskFactor {
  code: string;
  score: number;
  description: string;
  category: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  metadata?: Record<string, any>;
}

export interface RiskScore {
  id: string;
  fileId: string;
  level: RiskLevel;
  score: number;
  factors: RiskFactor[];
  explanation: string;
  suggestedAction: string;
  calculatedAt: Date;
}
