export const documentTypeLabels: Record<string, string> = {
  articles_of_incorporation: "Articles of Incorporation",
  legal_representative_id: "Legal Representative ID",
  proof_of_address: "Proof of Address",
  tax_status_certificate: "Tax Status Certificate",
  manifestation_under_protest: "Manifestation Under Protest",
  power_of_attorney: "Power of Attorney",
  controlling_party: "Controlling Party Information",
  rfc: "RFC Document",
};

/**
 * Returns human-readable label for a technical document type.
 * Falls back to capitalization/space formatting if the key is not in mapping.
 */
export function getDocumentLabel(type: string | null | undefined): string {
  if (!type) return '';
  if (documentTypeLabels[type]) {
    return documentTypeLabels[type];
  }
  return type
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
