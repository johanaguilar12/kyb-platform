import { prisma } from './prisma';
import { normalizeLegalName } from './string-utils';

/**
 * Evaluates dossier files for conditional document requirements.
 * Evaluates CSF vs Articles legal representative name matching and Articles shareholder complexity.
 */
export async function runConditionalDetections(fileId: string): Promise<void> {
  const documents = await prisma.document.findMany({
    where: { fileId, isActive: true },
  });

  const csf = documents.find((d) => d.type === 'tax_status_certificate');
  const articles = documents.find((d) => d.type === 'articles_of_incorporation');

  let powerOfAttorneyRequired: boolean | null = null;
  let powerOfAttorneyReason: string | null = null;
  let controllingPartyRequired: boolean | null = null;
  let controllingPartyReason: string | null = null;

  // 1. Power of Attorney Detection (Requires both CSF and Articles)
  if (csf && articles) {
    const csfData = csf.aiExtractedData as Record<string, any> | null;
    const articlesData = articles.aiExtractedData as Record<string, any> | null;

    const csfRepName = csfData?.legalRepresentative;
    const articlesRepName = articlesData?.legalRepresentative || articlesData?.administrator;

    if (csfRepName && articlesRepName) {
      const normCsf = normalizeLegalName(csfRepName);
      const normArticles = normalizeLegalName(articlesRepName);

      if (normCsf !== normArticles) {
        powerOfAttorneyRequired = true;
        powerOfAttorneyReason = `Representative name in Tax Status Certificate (${csfRepName}) differs from Articles of Incorporation (${articlesRepName}).`;
      } else {
        powerOfAttorneyRequired = false;
        powerOfAttorneyReason = '';
      }
    }
  }

  // 2. Controlling Party Detection (Requires Articles)
  if (articles) {
    const articlesData = articles.aiExtractedData as Record<string, any> | null;
    if (articlesData) {
      const complex = articlesData.hasComplexOwnership === true;
      const count = Number(articlesData.shareholdersCount || 0);

      if (complex || count > 3) {
        controllingPartyRequired = true;
        controllingPartyReason = articlesData.ownershipReason || 'Complex ownership structure, trusts, holdings, or corporate partners detected.';
      } else {
        controllingPartyRequired = false;
        controllingPartyReason = '';
      }
    }
  }

  const updateData: Record<string, any> = {};
  if (powerOfAttorneyRequired !== null) {
    updateData.powerOfAttorneyRequired = powerOfAttorneyRequired;
    updateData.powerOfAttorneyReason = powerOfAttorneyReason;
  }
  if (controllingPartyRequired !== null) {
    updateData.controllingPartyRequired = controllingPartyRequired;
    updateData.controllingPartyReason = controllingPartyReason;
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.file.update({
      where: { id: fileId },
      data: updateData,
    });
  }
}
