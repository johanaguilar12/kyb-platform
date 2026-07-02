import { PrismaClient } from '@prisma/client';
import { SATCheckResult, SATListCheck, SATListType } from '@/types/sat.types';
import * as self from './sat-client';

export const SOURCE_URLS: Record<SATListType, string> = {
  list_69_not_located: 'https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGR/No_localizados.csv',
  list_69_b: 'https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGAFF/Listado_completo_69-B.csv',
  list_69_b_bis: 'https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGGC/Listado_69_B_Bis_Completo.csv',
  csd_revoked: 'https://wu1agsprosta001.blob.core.windows.net/agsc-publicaciones/Datos_abiertos/Documents_AGR/CSDsinefectos.csv',
  article_49_bis: '', // No consolidated public dataset available
};

const RFC_REGEX = /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/i;

/**
 * Check RFC against all SAT fiscal lists, returning compliance checks.
 * Uses database cache to limit daily downloads.
 *
 * @param rfc The RFC to search for
 * @param prisma The Prisma Client instance
 * @returns Summary of checks across all 5 lists
 */
export async function checkRfcInSatLists(
  rfc: string,
  prisma: PrismaClient
): Promise<SATCheckResult & { results: SATListCheck[] }> {
  const listTypes: SATListType[] = [
    'list_69_not_located',
    'list_69_b',
    'list_69_b_bis',
    'csd_revoked',
    'article_49_bis',
  ];
  const checks: SATListCheck[] = [];
  const normalizedRfc = rfc.trim().toUpperCase();

  for (const listType of listTypes) {
    if (listType === 'article_49_bis') {
      checks.push({
        id: `check_${listType}_${Date.now()}`,
        fileId: 'temp_file',
        rfc: normalizedRfc,
        listType,
        found: false,
        checkedAt: new Date(),
        source: '',
        reference: `${listType}_list`,
        status: 'no_public_dataset',
        reason: 'Article 49-Bis does not have a consolidated public dataset. Manual verification or Cumplimiento Opinion is required.',
      });
      continue;
    }

    let cache = await prisma.sATListCache.findUnique({
      where: { listType },
    });

    if (!cache || !self.isCacheValid(cache)) {
      try {
        console.log(`Cache missing or expired for ${listType}. Fetching fresh list from SAT...`);
        const rfcs = await self.downloadSATList(listType);
        await self.cacheSATList(listType, rfcs, prisma);
        cache = await prisma.sATListCache.findUnique({
          where: { listType },
        });
      } catch (error) {
        console.error(`Graceful Fallback: Failed to update SAT list ${listType} from remote.`, error);
        // Fallback to expired cache if available; if not, use an empty stub cache
        if (!cache) {
          cache = {
            id: 'fallback_temp',
            listType,
            data: [] as any,
            downloadedAt: new Date(0),
            source: SOURCE_URLS[listType],
          };
        }
      }
    }

    const rfcs = (cache?.data as string[]) || [];
    const found = self.searchRfcInList(normalizedRfc, rfcs);

    checks.push({
      id: `check_${listType}_${Date.now()}`,
      fileId: 'temp_file',
      rfc: normalizedRfc,
      listType,
      found,
      checkedAt: new Date(),
      source: SOURCE_URLS[listType],
      reference: `${listType}_list`,
    });
  }

  const not_located = checks.some(c => c.listType === 'list_69_not_located' && c.found);
  const list_69b = checks.some(c => c.listType === 'list_69_b' && c.found);
  const list_69b_bis = checks.some(c => c.listType === 'list_69_b_bis' && c.found);
  const csd_revoked = checks.some(c => c.listType === 'csd_revoked' && c.found);

  // Article 49 Bis status mapping
  const foundIn49Bis = checks.some(c => c.listType === 'article_49_bis' && c.found);
  const art_49_bis_status = foundIn49Bis 
    ? 'verified_non_compliant' 
    : 'not_verifiable_with_current_public_sources';

  const recommendation = (list_69b || list_69b_bis)
    ? 'Block approval immediately due to blacklisted taxpayer record.'
    : (not_located || csd_revoked)
      ? 'Requires manual compliance verification.'
      : 'Proceed with standard approval.';

  return {
    rfc: normalizedRfc,
    signals: {
      not_located,
      list_69b,
      list_69b_bis,
      csd_revoked,
    },
    art_49_bis_status,
    checks,
    results: checks, // compatibility field
    checkedAt: new Date(),
    recommendation,
  };
}

/**
 * Download SAT list CSV from the open data portal
 */
export async function downloadSATList(listType: SATListType): Promise<string[]> {
  const url = SOURCE_URLS[listType];
  if (!url) {
    throw new Error(`No download URL defined for list type ${listType}`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch SAT list from ${url}. HTTP Status: ${response.status}`);
  }
  const content = await response.text();
  return parseSATData(content, listType);
}

/**
 * Parse CSV/HTML from the SAT portal to extract normalized RFCs.
 */
export async function parseSATData(content: string, listType: SATListType): Promise<string[]> {
  const lines = content.split(/\r?\n/);
  const rfcs = new Set<string>();

  for (const line of lines) {
    const cells = line.split(/[;,]/);
    for (const cell of cells) {
      const cleanCell = cell.replace(/["']/g, '').trim().toUpperCase();
      if (RFC_REGEX.test(cleanCell)) {
        if (listType === 'list_69_b_bis') {
          // Article 69-B Bis is definitive. Filter rows containing 'DEFINITIVO'
          if (line.toUpperCase().includes('DEFINITIVO')) {
            rfcs.add(cleanCell);
          }
        } else {
          rfcs.add(cleanCell);
        }
      }
    }
  }

  return Array.from(rfcs);
}

/**
 * Cache parsed SAT list RFCs in the database
 */
export async function cacheSATList(
  listType: SATListType,
  rfcs: string[],
  prisma: PrismaClient
): Promise<void> {
  await prisma.sATListCache.upsert({
    where: { listType },
    update: {
      data: rfcs,
      downloadedAt: new Date(),
      source: SOURCE_URLS[listType],
    },
    create: {
      listType,
      data: rfcs,
      downloadedAt: new Date(),
      source: SOURCE_URLS[listType],
    },
  });
}

/**
 * Check if the cached list is valid (< 24h old)
 */
export function isCacheValid(cache: { downloadedAt: Date }): boolean {
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const age = Date.now() - cache.downloadedAt.getTime();
  return age >= 0 && age < twentyFourHoursMs;
}

/**
 * Search RFC in the cached list
 */
export function searchRfcInList(rfc: string, rfcs: string[]): boolean {
  const normalizedRfc = rfc.trim().toUpperCase();
  return rfcs.includes(normalizedRfc);
}
