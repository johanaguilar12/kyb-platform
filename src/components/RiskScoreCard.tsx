import { RiskScore } from '@/types';

export function RiskScoreCard({ score }: { score: RiskScore }) {
  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-xl font-bold mb-4">Risk Score</h3>
      <div className="space-y-2">
        <p>Level: <span className="font-semibold">{score.level}</span></p>
        <p>Score: <span className="font-semibold">{score.score}</span></p>
        <p>Calculated: {score.calculatedAt.toLocaleDateString()}</p>
      </div>
      
      <div className="mt-4">
        <h4 className="font-semibold mb-2">Factors</h4>
        <ul className="space-y-1">
          {score.factors.map((factor, i) => (
            <li key={i} className="text-sm">
              +{factor.score}: {factor.description} ({factor.category})
            </li>
          ))}
        </ul>
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 rounded">
        <p className="text-sm font-semibold">Suggested Action:</p>
        <p className="text-sm">{score.suggestedAction}</p>
      </div>
    </div>
  );
}
