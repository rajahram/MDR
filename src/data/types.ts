/* TRACE·MDR domain model — a four-layer CDISC traceability graph:
   CRF field -> SDTM variable -> ADaM variable -> TFL */

export type LayerKey = "crf" | "sdtm" | "adam" | "tfl";

export type SdtmRole = "IDENTIFIER" | "TOPIC" | "TIMING" | "QUALIFIER";
export type SdtmOrigin = "CRF" | "ASSIGNED" | "DERIVED" | "PREDECESSOR";
export type AdamOrigin = "SDTM" | "DERIVED" | "ASSIGNED";
export type AdamModel = "ADSL" | "BDS" | "OCCDS";
export type DataType = "text" | "integer" | "float" | "date" | "time" | "coded";

export interface CrfField {
  /** ODM OID, e.g. "VS.SYSBP" */
  id: string;
  page: string;
  pageCode: string;
  label: string;
  dataType: DataType;
  codelist?: string;
  required: boolean;
}

export interface SdtmVar {
  /** "DOMAIN.NAME", e.g. "VS.VSORRES" */
  id: string;
  domain: string;
  name: string;
  label: string;
  role: SdtmRole;
  type: "Char" | "Num";
  length: number;
  origin: SdtmOrigin;
  /** source CRF OIDs */
  crfFieldIds: string[];
  derivation?: string;
  codelist?: string;
}

export interface AdamVar {
  /** "DATASET.NAME", e.g. "ADVS.AVAL" */
  id: string;
  dataset: string;
  name: string;
  label: string;
  type: "Char" | "Num";
  length: number;
  origin: AdamOrigin;
  model: AdamModel;
  /** source SDTM variable ids */
  sdtmVarIds: string[];
  derivation?: string;
}

export interface Tfl {
  id: string;
  code: string;
  title: string;
  kind: "Table" | "Listing" | "Figure";
  adamVarIds: string[];
}

/** A CRF field that is collected but intentionally not submitted */
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

export interface Selection {
  kind: LayerKey;
  id: string;
}

export interface TraceRow {
  key: string;
  crf?: CrfField;
  sdtm?: SdtmVar;
  adam?: AdamVar;
  tfls: Tfl[];
  gap?: "CRF_NOT_MAPPED" | "SDTM_NOT_IN_ADAM";
}
