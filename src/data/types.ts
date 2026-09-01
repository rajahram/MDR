/* ── GxP status lifecycle ─────────────────────────────────────── */
export type Status = "DRAFT" | "IN REVIEW" | "ACTIVE" | "DEPRECATED";

export const STATUS_FLOW: Record<Status, Status[]> = {
  DRAFT: ["IN REVIEW"],
  "IN REVIEW": ["ACTIVE", "DRAFT"],
  ACTIVE: ["DEPRECATED"],
  DEPRECATED: ["DRAFT"],
};

/* ── SQLite row shapes ────────────────────────────────────────── */
export interface StudyRow {
  study_id: string;
  study_name: string;
  protocol: string;
  phase: string;
  ta: string;
  crf_name: string;
  crf_version: string;
  sdtm_ig: string;
  adam_ig: string;
  status: Status;
  created_at: string;
}

export interface DomainRow {
  id: number;
  study_id: string;
  standard: string; // CDASH | SDTM | ADaM
  code: string;
  name: string;
  description: string;
  structure: string;
  cls: string;
  purpose: string;        // "Data Collection" | "Tabulation" | "Analysis"
  key_variables: string;  // comma-separated IDENTIFIER var names
  version: string;
  status: Status;
  updated_at: string;
  updated_by: string;
  change_reason: string;
}

export interface VariableRow {
  id: number;
  study_id: string;
  standard: string;
  domain: string;
  name: string;
  label: string;
  type: string;
  length: number;
  format: string;
  role: string;
  origin: string;
  derivation: string;
  codelist: string | null;
  key_seq: number | null;
  core: string;
  version: string;
  status: Status;
  effective_from: string;
  updated_at: string;
  updated_by: string;
  change_reason: string;
}

export interface VarVersionRow {
  id: number;
  var_id: number;
  version: string;
  label: string;
  type: string;
  length: number;
  role: string;
  origin: string;
  derivation: string;
  codelist: string | null;
  status: Status;
  change_reason: string;
  created_by: string;
  created_at: string;
}

export interface CodelistRow {
  code: string;
  name: string;
  type: string; // CODELIST | FORMAT
  description: string;
  nci_code: string | null;
  source: string;
  version: string;
  version_date: string;   // e.g. "2026-03-27"
  extensible: string;     // "Yes" | "No"
  status: Status;
  updated_at: string;
}

export interface CtTermRow {
  id: number;
  codelist: string;
  order_number: number;
  submission_value: string;
  display_value: string;
  definition: string;
  nci_code: string | null;
  status: Status;
  created_at: string;
}

export interface VlmRow {
  id: number;
  study_id: string;
  standard: string;
  domain: string;
  when_clause: string;
  where_clause: string;
  name: string;
  label: string;
  type: string;
  length: string;
  origin: string;
  codelist: string | null;
  method: string;
  version: string;
  status: Status;
  updated_at: string;
}

export interface CrfPageRow {
  page_id: string;
  study_id: string;
  crf_name: string;
  crf_version: string;
  page_code: string;
  page_name: string;
  form_type: string;
  repeating: string;
  status: Status;
  effective_from: string;
}

export interface CrfFieldRow {
  oid: string;
  study_id: string;
  page_id: string;
  label: string;
  data_type: string;
  required: number;
  codelist: string | null;
  status: Status;
  version: string;
}

export interface MapRow {
  id: number;
  study_id: string;
  src: string;
  tgt: string;
  method: string;
}

export interface TflRow {
  code: string;
  study_id: string;
  kind: string;
  title: string;
  adam_vars: string; // pipe-delimited
  status: Status;
  version: string;
}

export interface ReleaseRow {
  id: number;
  study_id: string;
  version: string;
  type: string;
  released_at: string;
  released_by: string;
  approved_by: string;
  notes: string;
  status: string;
  added: number;
  changed: number;
  deprecated: number;
}

export interface AuditRow {
  id: number;
  ts: string;
  actor: string;
  action: string;
  entity: string;
  record: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
  study_id: string;
}

export interface DispositionRow {
  crf_oid: string;
  reason: string;
}

/* ── trace model (built from SQLite, consumed by explorer) ────── */
export type LayerKey = "crf" | "sdtm" | "adam" | "tfl";
export interface Selection {
  kind: LayerKey;
  id: string;
}

export interface CrfField {
  id: string;
  pageCode: string;
  page: string;
  label: string;
  dataType: "text" | "coded" | "date" | "time" | "integer" | "float";
  required: boolean;
  codelist?: string;
  status?: Status;
}

export interface SdtmVar {
  id: string;
  domain: string;
  name: string;
  label: string;
  role: string;
  type: string;
  length: number;
  origin: string;
  crfFieldIds: string[];
  derivation?: string;
  codelist?: string;
  status?: Status;
}

export interface AdamVar {
  id: string;
  dataset: string;
  name: string;
  label: string;
  type: string;
  length: number;
  origin: string;
  model: string;
  sdtmVarIds: string[];
  derivation?: string;
  status?: Status;
}

export interface Tfl {
  id: string;
  code: string;
  kind: "Table" | "Figure" | "Listing";
  title: string;
  adamVarIds: string[];
}

export interface CrfGap {
  crfFieldId: string;
  reason: string;
}

export interface MdrState {
  crfFields: CrfField[];
  sdtmVars: SdtmVar[];
  adamVars: AdamVar[];
  tfls: Tfl[];
  crfGaps: CrfGap[];
}
