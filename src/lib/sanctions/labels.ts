/**
 * Human-readable labels for OpenSanctions maritime risk categories.
 *
 * The raw codes (`mare.shadow;poi`, `mare.detained;reg.warn`) are dataset
 * plumbing and were leaking into the fleet table and dossier verbatim.
 * Client-safe.
 */

export interface RiskCategoryLabel {
  /** Short uppercase badge text. */
  label: string;
  /** One-line plain-English meaning for tooltips and dossiers. */
  meaning: string;
  /** Tailwind text color class for the badge. */
  tone: 'red' | 'purple' | 'rose' | 'amber';
}

const LABELS: Record<string, RiskCategoryLabel> = {
  'sanction': {
    label: 'Sanctioned',
    meaning: 'Directly designated by a government sanctions authority',
    tone: 'red',
  },
  'mare.shadow;poi': {
    label: 'Shadow fleet',
    meaning: 'Identified as part of the shadow fleet; entity of interest',
    tone: 'purple',
  },
  'mare.detained': {
    label: 'Detained',
    meaning: 'Detained by port state control',
    tone: 'rose',
  },
  'mare.detained;reg.warn': {
    label: 'Detained · reg. warning',
    meaning: 'Detained by port state control with regulatory warnings',
    tone: 'rose',
  },
  'poi': {
    label: 'Entity of interest',
    meaning: 'Listed as an entity of interest; not directly sanctioned',
    tone: 'amber',
  },
  'reg.warn': {
    label: 'Regulatory warning',
    meaning: 'Regulatory warning on record; not directly sanctioned',
    tone: 'amber',
  },
};

const UNKNOWN: RiskCategoryLabel = {
  label: 'Listed',
  meaning: 'Appears on a maritime watch list without a specific risk category',
  tone: 'amber',
};

/** Label for a raw risk category code. Null/empty means "listed, uncategorised". */
export function riskCategoryLabel(code: string | null | undefined): RiskCategoryLabel {
  if (!code) return UNKNOWN;
  return LABELS[code] ?? { ...UNKNOWN, label: code.replace(/[;.]/g, ' · ') };
}

/** Sanctions dataset ids → the authority a reader recognises. */
export const AUTHORITY_LABELS: Record<string, string> = {
  us_ofac_sdn: 'OFAC SDN', us_ofac_cons: 'OFAC Non-SDN', us_trade_csl: 'US CSL',
  eu_fsf: 'EU FSF', eu_sanctions_map: 'EU Sanctions', eu_journal_sanctions: 'EU Journal',
  gb_fcdo_sanctions: 'UK FCDO', ca_dfatd_sema_sanctions: 'Canada SEMA',
  ch_seco_sanctions: 'Swiss SECO', un_1718_vessels: 'UN 1718',
  ua_war_sanctions: 'Ukraine War', fr_tresor_gels_avoir: 'France Trésor',
  be_fod_sanctions: 'Belgium FOD', mc_fund_freezes: 'Monaco',
  ae_local_terrorists: 'UAE',
};

export function authorityLabel(dataset: string): string {
  return AUTHORITY_LABELS[dataset] ?? dataset.replace(/_/g, ' ');
}
