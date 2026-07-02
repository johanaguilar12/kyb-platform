import { Expediente } from '@/types/expediente.types';
import { Document, DocumentType } from '@/types/document.types';
import { SATListCheck } from '@/types/sat.types';
import { RiskScore, RiskFactor, RiskLevel } from '@/types/scoring.types';
import { reconcileExpedienteData } from './reconciler';

/**
 * Calculates the risk score for a given Expediente based on its documents,
 * SAT compliance checks, data discrepancies, and completeness.
 *
 * This function is 100% pure and deterministic.
 *
 * @param expediente The company's folder metadata (including RFC and corporate name)
 * @param documents List of active documents associated with the Expediente
 * @param satChecks List of recent SAT blacklist checks
 * @param currentDate Reference date for expiration/validity checks (defaults to now)
 * @returns The computed RiskScore including level, score, contributing factors, and suggested actions.
 */
export function calculateRiskScore(
  expediente: Expediente,
  documents: Document[],
  satChecks: SATListCheck[],
  currentDate: Date = new Date()
): RiskScore {
  const factors: RiskFactor[] = [];

  // 1. SAT blacklists (+50, +40, +30)
  const isFoundIn69B = satChecks.some(c => c.listType === 'list_69_b' && c.found);
  if (isFoundIn69B) {
    factors.push({
      code: 'SAT_69_B',
      score: 50,
      description: 'Found in SAT list 69-B CFF (Presumed non-existent operations)',
    });
  }

  const isFoundIn69BBis = satChecks.some(c => c.listType === 'list_69_b_bis' && c.found);
  if (isFoundIn69BBis) {
    factors.push({
      code: 'SAT_69_B_BIS',
      score: 40,
      description: 'Found in SAT list 69-B Bis CFF (Definitive non-existent operations)',
    });
  }

  const isFoundIn69 = satChecks.some(c => c.listType === 'list_69' && c.found);
  if (isFoundIn69) {
    factors.push({
      code: 'SAT_69',
      score: 30,
      description: 'Found in SAT list 69 CFF (Non-compliant taxpayers)',
    });
  }

  // 2. Material discrepancy between documents (+30)
  const reconciliation = reconcileExpedienteData(documents, {
    rfc: expediente.rfc,
    razonSocial: expediente.razonSocial,
  });
  if (reconciliation.hasDiscrepancies) {
    factors.push({
      code: 'DISCREPANCY',
      score: 30,
      description: 'Material discrepancy between documents',
    });
  }

  // 3. CSF not from current month (+25)
  const csfDoc = documents.find(d => d.type === 'csf' && d.isActive);
  let csfNotCurrentMonth = false;
  if (csfDoc) {
    if (csfDoc.issueDate) {
      const issueYear = csfDoc.issueDate.getFullYear();
      const issueMonth = csfDoc.issueDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      
      if (issueYear !== currentYear || issueMonth !== currentMonth) {
        csfNotCurrentMonth = true;
        factors.push({
          code: 'CSF_NOT_CURRENT_MONTH',
          score: 25,
          description: 'CSF (Constancia de Situación Fiscal) not from current month',
        });
      }
    } else {
      csfNotCurrentMonth = true;
      factors.push({
        code: 'CSF_NOT_CURRENT_MONTH',
        score: 25,
        description: 'CSF (Constancia de Situación Fiscal) missing issue date',
      });
    }
  }

  // 4. Any expired document (+20)
  const hasExpired = documents.some(
    d => d.isActive && d.expirationDate && d.expirationDate.getTime() < currentDate.getTime()
  );
  if (hasExpired) {
    factors.push({
      code: 'EXPIRED_DOCUMENT',
      score: 20,
      description: 'One or more documents are expired',
    });
  }

  // 5. Per missing required document (+15 per missing)
  const requiredTypes: DocumentType[] = [
    'articles_of_incorporation',
    'legal_representative_id',
    'power_of_attorney',
    'proof_of_address',
    'rfc',
    'csf',
    'manifestation_under_protest',
    'controlling_party',
  ];
  const missingRequired = requiredTypes.filter(
    type => !documents.some(d => d.type === type && d.isActive)
  );
  if (missingRequired.length > 0) {
    factors.push({
      code: 'MISSING_REQUIRED_DOCUMENT',
      score: 15 * missingRequired.length,
      description: `Missing required documents: ${missingRequired.join(', ')}`,
    });
  }

  // 6. Incomplete legal representative, shareholders, or controlling party data (+20)
  const hasIncompleteStakeholders = documents.some(doc => {
    if (!doc.isActive || !doc.aiExtractedData) return false;
    const data = doc.aiExtractedData;
    return (
      data.legalRepresentativeComplete === false ||
      data.shareholdersComplete === false ||
      data.controllingPartyComplete === false ||
      data.incompleteStakeholders === true
    );
  });
  if (hasIncompleteStakeholders) {
    factors.push({
      code: 'INCOMPLETE_STAKEHOLDERS',
      score: 20,
      description: 'Incomplete legal representative, shareholders, or controlling party data',
    });
  }

  // 7. SAT lists not reviewed in last 90 days (+10)
  const requiredListTypes = ['list_69', 'list_69_b', 'list_69_b_bis'];
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const hasRecentCheck = (type: string) => {
    return satChecks.some(check => {
      if (check.listType !== type) return false;
      const diff = currentDate.getTime() - check.checkedAt.getTime();
      return diff >= 0 && diff < ninetyDaysMs;
    });
  };
  const satNotReviewedIn90Days = !requiredListTypes.every(type => hasRecentCheck(type));
  if (satNotReviewedIn90Days) {
    factors.push({
      code: 'SAT_NOT_REVIEWED',
      score: 10,
      description: 'SAT lists not reviewed in last 90 days',
    });
  }

  // 8. All documents valid and up-to-date bonus (-5)
  // Bonus conditions: no missing documents, no expired documents, CSF from current month, no discrepancies, no incomplete stakeholders.
  const hasNoDocIssues =
    missingRequired.length === 0 &&
    !hasExpired &&
    !csfNotCurrentMonth &&
    !reconciliation.hasDiscrepancies &&
    !hasIncompleteStakeholders;

  const hasNoOtherIssues = factors.length === 0;

  if (hasNoDocIssues && hasNoOtherIssues) {
    factors.push({
      code: 'PERFECT_BONUS',
      score: -5,
      description: 'All documents valid and up-to-date (bonus)',
    });
  }

  // Calculate final score
  const score = factors.reduce((sum, f) => sum + f.score, 0);

  // Map to RiskLevel
  let level: RiskLevel = 'safe';
  if (score >= 70) {
    level = 'high_risk';
  } else if (score >= 30) {
    level = 'review_required';
  }

  // Generate explanation and suggested actions
  let explanation = '';
  let suggestedAction = '';

  if (level === 'safe') {
    explanation = 'The company is classified as safe. No major risk factors were identified.';
    if (score < 0) {
      explanation += ' All required documents are valid and up-to-date.';
    }
    suggestedAction = 'Proceed with standard approval.';
  } else if (level === 'review_required') {
    const factorDescriptions = factors.map(f => f.description).join(', ');
    explanation = `Review required due to: ${factorDescriptions}.`;
    suggestedAction = 'Perform manual review of the flagged items and request updates if necessary.';
  } else {
    const factorDescriptions = factors.map(f => f.description).join(', ');
    explanation = `High risk detected! Blocking issues: ${factorDescriptions}.`;
    suggestedAction = 'Block approval immediately. Escalate to compliance officer for formal review.';
  }

  return {
    id: `score_${expediente.id}_${currentDate.getTime()}`,
    expedienteId: expediente.id,
    level,
    score,
    factors,
    explanation,
    suggestedAction,
    calculatedAt: currentDate,
  };
}
