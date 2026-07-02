import { File, Document, SATListCheck, RiskScore, RiskFactor, RiskLevel, DocumentType } from '@/types';
import { reconcileDocuments } from './reconciler';

/**
 * Helper to generate human-readable explanation of the risk factors.
 */
function generateExplanation(factors: RiskFactor[]): string {
  const activeFactors = factors.filter(f => f.score !== 0 || f.code === 'CSD_REVOKED' || f.code === 'ARTICLE_49_BIS_NOT_VERIFIABLE');
  if (activeFactors.length === 1 && activeFactors[0].code === 'PERFECT_BONUS') {
    return 'The company is classified as safe. All documents are valid and up-to-date.';
  }
  if (activeFactors.length === 0) {
    return 'The company is classified as safe. No risk factors identified.';
  }
  const descriptions = activeFactors.map(f => f.description).join(', ');
  return `Issues identified: ${descriptions}.`;
}

/**
 * Helper to generate suggested compliance action based on the risk level.
 */
function generateSuggestedAction(level: RiskLevel, factors: RiskFactor[]): string {
  if (level === 'high_risk') {
    return 'Block approval immediately. Escalate to compliance officer for formal review.';
  }
  if (level === 'review_required') {
    return 'Perform manual review of the flagged items and request updates if necessary.';
  }
  return 'Proceed with standard approval.';
}

/**
 * Calculates the risk score for a given File based on its documents,
 * SAT compliance checks, data discrepancies, and completeness.
 *
 * This function is 100% pure and deterministic.
 *
 * @param file The company's folder metadata
 * @param documents List of active documents associated with the File
 * @param satChecks List of recent SAT blacklist checks
 * @param currentDate Reference date for expiration/validity checks
 * @returns The computed RiskScore
 */
export function calculateRiskScore(
  file: File,
  documents: Document[],
  satChecks: SATListCheck[],
  currentDate: Date = new Date()
): RiskScore {
  const factors: RiskFactor[] = [];
  let score = 0;

  // 1. SAT checks (+50, +40, +30)
  const isFoundIn69B = satChecks.some(c => (c.listType === 'list_69_b' && c.found) || (c as any).signals?.list_69b);
  if (isFoundIn69B) {
    score += 50;
    factors.push({
      code: 'FOUND_IN_69B',
      score: 50,
      description: 'RFC found in Art. 69-B CFF list (EFOS)',
      category: 'critical',
    });
  }

  const isFoundIn69BBis = satChecks.some(c => (c.listType === 'list_69_b_bis' && c.found) || (c as any).signals?.list_69b_bis);
  if (isFoundIn69BBis) {
    score += 40;
    factors.push({
      code: 'FOUND_IN_69B_BIS',
      score: 40,
      description: 'RFC found in Art. 69-B Bis CFF list (Definitive EFOS)',
      category: 'critical',
    });
  }

  const isFoundIn69 = satChecks.some(
    c => (c.listType === 'list_69_not_located' && c.found) || (c as any).signals?.not_located
  );
  if (isFoundIn69) {
    score += 30;
    factors.push({
      code: 'FOUND_IN_69_NOT_LOCATED',
      score: 30,
      description: 'RFC found in Art. 69 CFF list (Non-compliant/Unlocated taxpayers)',
      category: 'high',
    });
  }

  // Revoked CSD Check (informational / risk signal)
  const isCsdRevoked = satChecks.some(
    c => (c.listType === 'csd_revoked' && c.found) || (c as any).signals?.csd_revoked
  );
  if (isCsdRevoked) {
    factors.push({
      code: 'CSD_REVOKED',
      score: 0,
      description: 'RFC found in revoked CSD list (risk signal, unspecified cause - may include Art. 49-Bis but not confirmed)',
      category: 'low',
    });
  }

  // Article 49 Bis not verifiable check
  const isArt49BisNotVerifiable =
    (satChecks as any).art_49_bis_status === 'not_verifiable_with_current_public_sources' ||
    satChecks.some(c => c.listType === 'article_49_bis' && (c as any).status === 'no_public_dataset');
  if (isArt49BisNotVerifiable) {
    factors.push({
      code: 'ARTICLE_49_BIS_NOT_VERIFIABLE',
      score: 0,
      description: 'Article 49-Bis subcontracting status is not verifiable with current public sources',
      category: 'low',
    });
  }

  // 2. Material discrepancy between documents (+30 per high severity discrepancy)
  const reconciliation = reconcileDocuments(documents);
  if (reconciliation.discrepancies.length > 0) {
    const highSeverityCount = reconciliation.discrepancies.filter(d => d.severity === 'high').length;
    const impact = highSeverityCount * 30;

    if (impact > 0) {
      score += impact;
      factors.push({
        code: 'DOCUMENT_DISCREPANCY',
        score: impact,
        description: `${highSeverityCount} material discrepancy(ies) detected: ${reconciliation.discrepancies
          .filter(d => d.severity === 'high')
          .map(d => d.field)
          .join(', ')}`,
        category: 'high',
      });
    }
  }

  // 3. Tax Status Certificate not from current month (+25)
  const taxCertDoc = documents.find(d => d.type === 'tax_status_certificate' && d.isActive);
  let taxCertNotCurrentMonth = false;
  if (taxCertDoc) {
    if (taxCertDoc.issueDate) {
      const issueYear = taxCertDoc.issueDate.getFullYear();
      const issueMonth = taxCertDoc.issueDate.getMonth();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      if (issueYear !== currentYear || issueMonth !== currentMonth) {
        taxCertNotCurrentMonth = true;
        score += 25;
        factors.push({
          code: 'TAX_CERTIFICATE_NOT_CURRENT_MONTH',
          score: 25,
          description: 'Tax status certificate not from current month',
          category: 'medium',
        });
      }
    } else {
      taxCertNotCurrentMonth = true;
      score += 25;
      factors.push({
        code: 'TAX_CERTIFICATE_NOT_CURRENT_MONTH',
        score: 25,
        description: 'Tax status certificate missing issue date',
        category: 'medium',
      });
    }
  }

  // 4. Any expired document (+20)
  const hasExpired = documents.some(
    d => d.isActive && d.expirationDate && d.expirationDate.getTime() < currentDate.getTime()
  );
  if (hasExpired) {
    score += 20;
    factors.push({
      code: 'EXPIRED_DOCUMENT',
      score: 20,
      description: 'One or more documents are expired',
      category: 'medium',
    });
  }

  // 5. Per missing required document (+15 per missing)
  const requiredDocs: DocumentType[] = [
    'articles_of_incorporation',
    'legal_representative_id',
    'proof_of_address',
    'tax_status_certificate',
    'manifestation_under_protest',
  ];
  const missingRequired = requiredDocs.filter(
    type => !documents.some(d => d.type === type && d.isActive)
  );
  if (missingRequired.length > 0) {
    score += 15 * missingRequired.length;
    factors.push({
      code: 'MISSING_REQUIRED_DOCUMENT',
      score: 15 * missingRequired.length,
      description: `Missing required documents: ${missingRequired.join(', ')}`,
      category: 'medium',
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
    score += 20;
    factors.push({
      code: 'INCOMPLETE_STAKEHOLDERS',
      score: 20,
      description: 'Incomplete legal representative, shareholders, or controlling party data',
      category: 'medium',
    });
  }

  // 7. SAT lists not reviewed in last 90 days (+10)
  const requiredListTypes = ['list_69_not_located', 'list_69_b', 'list_69_b_bis'];
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
    score += 10;
    factors.push({
      code: 'SAT_NOT_REVIEWED',
      score: 10,
      description: 'SAT lists not reviewed in last 90 days',
      category: 'low',
    });
  }

  // 8. Perfect bonus (-5)
  const hasNoDocIssues =
    missingRequired.length === 0 &&
    !hasExpired &&
    !taxCertNotCurrentMonth &&
    reconciliation.isConsistent &&
    !hasIncompleteStakeholders;

  const hasNoOtherIssues = factors.filter(f => f.score > 0).length === 0;

  if (hasNoDocIssues && hasNoOtherIssues) {
    score -= 5;
    factors.push({
      code: 'PERFECT_BONUS',
      score: -5,
      description: 'All documents valid and up-to-date (bonus)',
      category: 'informational',
    });
  }

  const level: RiskLevel = score >= 70 ? 'high_risk' : score >= 30 ? 'review_required' : 'safe';

  return {
    id: `score_${file.id}_${currentDate.getTime()}`,
    fileId: file.id,
    level,
    score,
    factors,
    explanation: generateExplanation(factors),
    suggestedAction: generateSuggestedAction(level, factors),
    calculatedAt: currentDate,
  };
}
