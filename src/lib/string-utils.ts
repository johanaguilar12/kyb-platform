/**
 * Normalizes a string by converting to uppercase, removing accents/diacritics,
 * collapsing spaces, and stripping special characters.
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^A-Z0-9\s]/g, '') // remove special characters except spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const tmp = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp.push([i]);
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Calculates string similarity percentage (0.0 to 1.0) using Levenshtein distance.
 */
export function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;
  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  return (maxLen - dist) / maxLen;
}

/**
 * Compares two RFCs by removing non-alphanumeric chars and performing case-insensitive match.
 */
export function compareRFC(a: string | null | undefined, b: string | null | undefined): boolean {
  const normA = (a || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const normB = (b || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return normA === normB && normA.length > 0;
}

/**
 * Normalizes a legal name by converting to UPPERCASE, mapping & to Y, removing accents,
 * removing all spaces, and removing all punctuation/special characters.
 */
export function normalizeLegalName(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .replace(/&/g, 'Y')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^A-Z0-9]/g, ''); // remove all spaces, punctuation, and special characters
}

/**
 * Compares two legal names. Returns match status (exact match after normalization).
 */
export function compareLegalNames(
  a: string | null | undefined,
  b: string | null | undefined
): { matches: boolean; similarity: number } {
  const normA = normalizeLegalName(a);
  const normB = normalizeLegalName(b);
  const matches = normA === normB && normA.length > 0;
  return {
    matches,
    similarity: matches ? 1.0 : 0.0,
  };
}

/**
 * Compares two addresses by normalising common abbreviations and verifying 70%+ similarity.
 */
export function compareAddresses(a: string | null | undefined, b: string | null | undefined): boolean {
  let normA = normalizeString(a || '');
  let normB = normalizeString(b || '');

  const replacements: Array<[RegExp, string]> = [
    [/\bCALLE\b/g, 'C'],
    [/\bAVENIDA\b/g, 'AV'],
    [/\bCOLONIA\b/g, 'COL'],
    [/\bFRACCIONAMIENTO\b/g, 'FRACC'],
    [/\bNUMERO\b/g, 'NUM'],
    [/\bNO\b/g, 'NUM'],
    [/\bINTERIOR\b/g, 'INT'],
    [/\bEXTERIOR\b/g, 'EXT'],
  ];

  replacements.forEach(([regex, val]) => {
    normA = normA.replace(regex, val);
    normB = normB.replace(regex, val);
  });

  const sim = calculateSimilarity(normA, normB);
  return sim >= 0.7;
}
