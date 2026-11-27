import type { McpKeyScopeMode } from "@/lib/queries/mcp-keys/mcp-keys.types";

export type DocsLanguage = "vi" | "en";

export type McpToolDomainId =
  | "iam-projects"
  | "tasks-sprints"
  | "capture"
  | "handover"
  | "sag-knowledge"
  | "chat-notifications";

export interface McpToolAnnotations {
  readOnlyHint: boolean;
  idempotentHint: boolean;
  destructiveHint: boolean;
}

export interface McpToolParamDoc {
  name: string;
  type: string;
  required: boolean;
  description: Record<DocsLanguage, string>;
}

export interface McpToolDoc {
  name: string;
  domain: McpToolDomainId;
  minScope: McpKeyScopeMode;
  escalationNote?: Record<DocsLanguage, string>;
  annotations: McpToolAnnotations;
  summary: Record<DocsLanguage, string>;
  params: readonly McpToolParamDoc[];
  exampleArgs: Record<string, unknown>;
}

export interface DocsArchitectureStage {
  id: string;
  step: string;
  title: string;
  protocolTag: string;
  summary: string;
  invariants: readonly string[];
}

export interface DocsSecurityTierCard {
  scope: McpKeyScopeMode;
  title: string;
  badge: string;
  summary: string;
  capabilities: readonly string[];
}

export interface DocsResourceItem {
  uri: string;
  kind: "STATIC" | "TEMPLATE";
  mimeType: string;
  title: string;
  description: string;
}

export interface DocsPromptItem {
  name: string;
  argumentsSignature: string;
  title: string;
  description: string;
}

export interface DocsPlaybookItem {
  id: string;
  badge: string;
  title: string;
  scenario: string;
  steps: readonly {
    tool: string;
    detail: string;
  }[];
}

export interface DocsLocalizedCorpus {
  metaTitle: string;
  ui: {
    headerBadge: string;
    searchPlaceholder: string;
    searchAriaLabel: string;
    clearSearchAria: string;
    langGroupAria: string;
    langViLabel: string;
    langEnLabel: string;
    manageKeysCta: string;
    workspaceCta: string;
    signInCta: string;
    getStartedCta: string;
    tocHeading: string;
    mobileTocToggle: string;
    copyCta: string;
    copiedCta: string;
    copyJsonRpcCta: string;
    copiedJsonRpcCta: string;
    expandAllTools: string;
    collapseAllTools: string;
    inspectSchemaCta: string;
    hideSchemaCta: string;
    paramsHeading: string;
    noParamsNote: string;
    paramColName: string;
    paramColType: string;
    paramColRequired: string;
    paramColDesc: string;
    requiredYes: string;
    requiredNo: string;
    examplePayloadHeading: string;
    allDomainsLabel: string;
    allScopesLabel: string;
    matchingToolsCount: string;
    jumpToMatchingTools: string;
    emptyToolsTitle: string;
    emptyToolsDesc: string;
    resetFiltersCta: string;
    endpointDirectLabel: string;
    endpointBffLabel: string;
    targetFileLabel: string;
    subsystemToolsCount: string;
    endpointCardHeading: string;
    endpointModeAriaLabel: string;
    filterDomainAriaLabel: string;
    filterScopeAriaLabel: string;
    footerCopyright: string;
    footerHomeLink: string;
    footerIntegrationsLink: string;
    footerTermsLink: string;
    footerPrivacyLink: string;
  };
  sections: readonly {
    id: string;
    number: string;
    shortTitle: string;
    title: string;
  }[];
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    protocolStatLabel: string;
    protocolStatValue: string;
    toolsStatLabel: string;
    toolsStatValue: string;
    subsystemsStatLabel: string;
    subsystemsStatValue: string;
    authStatLabel: string;
    authStatValue: string;
  };
  overview: {
    rationaleTitle: string;
    rationaleParagraphs: readonly string[];
    subsystemsTitle: string;
    subsystems: readonly {
      code: string;
      domain: McpToolDomainId;
      name: string;
      toolCount: number;
      summary: string;
    }[];
    pipelineTitle: string;
    pipelineSubtitle: string;
    stages: readonly DocsArchitectureStage[];
  };
  quickstart: {
    subtitle: string;
    steps: readonly {
      step: string;
      title: string;
      body: string;
    }[];
    configuratorTitle: string;
    configuratorSubtitle: string;
  };
  security: {
    subtitle: string;
    controls: readonly {
      code: string;
      title: string;
      body: string;
    }[];
    tiersTitle: string;
    tiers: readonly DocsSecurityTierCard[];
  };
  toolsExplorer: {
    subtitle: string;
    domainLabels: Record<McpToolDomainId, string>;
    hintLabels: {
      readOnly: string;
      mutating: string;
      idempotent: string;
      destructive: string;
    };
  };
  resourcesAndPrompts: {
    subtitle: string;
    resourcesHeading: string;
    resources: readonly DocsResourceItem[];
    promptsHeading: string;
    prompts: readonly DocsPromptItem[];
    playbooksHeading: string;
    playbooksSubtitle: string;
    playbooks: readonly DocsPlaybookItem[];
  };
}
