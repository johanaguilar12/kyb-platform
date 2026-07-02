/**
 * Types of SAT fiscal blacklists and compliance lists to check.
 */
export type SATListType =
  | 'list_69'        // Non-compliant taxpayers (CFF 69)
  | 'list_69_b'      // Presumed non-existent operations (CFF 69-B)
  | 'list_69_b_bis'  // Definitive non-existent operations (CFF 69-B Bis)
  | 'list_49_bis';   // Subcontracting (CFF 49 Bis)

/**
 * Result of a single check against a specific SAT list.
 */
export interface SATListCheck {
  id: string;
  expedienteId: string;
  rfc: string;
  listType: SATListType;
  found: boolean;
  checkedAt: Date;
  source: string;
  reference: string;
}

/**
 * Overall check results summary for a given RFC.
 */
export interface SATCheckResult {
  checkedAt: Date;
  rfc: string;
  isBlacklisted: boolean;
  checks: SATListCheck[];
}
