export type LegalDocLanguage = "vi" | "en";

export type LegalTabId = "terms" | "privacy";

export interface LegalTableData {
  caption?: string;
  headers: string[];
  numericColumnIndices?: number[];
  rows: string[][];
}

export interface LegalCalloutData {
  variant: "info" | "brand" | "warning";
  title: string;
  body: string;
  externalLinkLabel?: string;
  externalLinkHref?: string;
}

export interface LegalSubSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalArticle {
  id: string;
  number: string;
  shortTitle: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subSections?: LegalSubSection[];
  table?: LegalTableData;
  callout?: LegalCalloutData;
}

export interface LegalDocumentBundle {
  tabLabel: string;
  badgeLabel: string;
  title: string;
  subtitle: string;
  versionLabel: string;
  versionValue: string;
  effectiveLabel: string;
  effectiveValue: string;
  operatorLabel: string;
  operatorValue: string;
  tldrTitle: string;
  tldrSubtitle: string;
  tldrItems: string[];
  tldrDisclaimer: string;
  crossNavEyebrow: string;
  crossNavTitle: string;
  crossNavDescription: string;
  crossNavCta: string;
  articles: LegalArticle[];
}

export interface LegalUiCopy {
  headerBadge: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  governingLanguageNotice: string;
  langViLabel: string;
  langEnLabel: string;
  langGroupAria: string;
  printCta: string;
  signInCta: string;
  signUpCta: string;
  homeCta: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  clearSearchAria: string;
  searchResultsCount: string;
  emptySearchTitle: string;
  emptySearchDescription: string;
  emptySearchResetCta: string;
  tocHeading: string;
  tocMobileToggle: string;
  copyLinkAria: string;
  copiedLinkLabel: string;
  contactCardTitle: string;
  contactCardDescription: string;
  contactEmailLabel: string;
  slaAckLabel: string;
  slaAckValue: string;
  slaDeleteLabel: string;
  slaDeleteValue: string;
  slaAuditLabel: string;
  slaAuditValue: string;
  footerCopyright: string;
  footerJurisdiction: string;
}

export interface LegalCorpus {
  ui: LegalUiCopy;
  terms: LegalDocumentBundle;
  privacy: LegalDocumentBundle;
}
