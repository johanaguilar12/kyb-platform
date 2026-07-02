/**
 * Normalize string for comparison.
 * - Convert to uppercase
 * - Trim whitespace
 * - Remove accents (á → a, é → e, ñ → n)
 * - Remove extra spaces
 * - Remove special characters (., -, etc.)
 *
 * @param str The input string to normalize
 * @returns The normalized string
 */
export function normalizeString(str: string): string {
  if (!str) return '';
  return str
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, ' ') // Multiple spaces → single
    .replace(/[.,\-\/]/g, '') // Remove special chars
    .trim();
}
