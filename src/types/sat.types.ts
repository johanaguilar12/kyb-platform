export type SATListType = 
  | 'list_69_not_located'
  | 'list_69_b'
  | 'list_69_b_bis'
  | 'csd_revoked'
  | 'article_49_bis';

export interface SATListCheck {
  id: string;
  fileId: string;
  rfc: string;
  listType: SATListType;
  found: boolean;
  checkedAt: Date;
  source: string;
  reference: string;
  status?: 'completed' | 'unavailable' | 'no_public_dataset';
  reason?: string;
  metadata?: Record<string, any>;
}

export interface SATCheckResult {
  rfc: string;
  signals: {
    not_located: boolean;
    list_69b: boolean;
    list_69b_bis: boolean;
    csd_revoked: boolean;
  };
  art_49_bis_status: 'not_verifiable_with_current_public_sources' | 'verified_compliant' | 'verified_non_compliant';
  checks: SATListCheck[];
  checkedAt: Date;
  recommendation: string;
}

export interface SATListCache {
  id: string;
  listType: SATListType;
  data: string[];
  downloadedAt: Date;
  source: string;
}
