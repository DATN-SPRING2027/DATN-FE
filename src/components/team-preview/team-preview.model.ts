/** Local view models only; not Team API DTOs, permissions or lifecycle rules. */
export const previewScenarios = [
  "success",
  "loading",
  "empty",
  "denied",
  "network",
  "validation",
  "save-denied",
  "save-network",
  "save-pending",
] as const;
export type PreviewScenario = (typeof previewScenarios)[number];
export type PreviewSaveResult =
  "success" | "validation" | "denied" | "network" | "pending";
export interface TeamPreviewItem {
  fixtureKey: string;
  name: string;
  code: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED";
}
export const teamFixtures: readonly TeamPreviewItem[] = [
  {
    fixtureKey: "product",
    name: "Product Engineering",
    code: "PRODUCT_ENG",
    description: "Product delivery and engineering.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "platform",
    name: "Platform",
    code: "PLATFORM",
    description: "Shared tooling and developer experience.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "quality",
    name: "Quality Engineering",
    code: "QUALITY",
    description: "Quality and release confidence.",
    status: "ARCHIVED",
  },
  {
    fixtureKey: "data-platform",
    name: "Data Platform",
    code: "DATA_PLATFORM",
    description: "Reliable data products and shared pipelines.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "applied-ai",
    name: "Applied AI",
    code: "APPLIED_AI",
    description: "Applied research and AI product experiences.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "design-systems",
    name: "Design Systems",
    code: "DESIGN_SYSTEMS",
    description: "Shared components and product interface patterns.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "developer-experience",
    name: "Developer Experience",
    code: "DEV_EXPERIENCE",
    description: "Tools and workflows for product engineering.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "product-operations",
    name: "Product Operations",
    code: "PRODUCT_OPS",
    description: "Planning and coordination across product teams.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "customer-success",
    name: "Customer Success",
    code: "CUSTOMER_SUCCESS",
    description: "Customer onboarding and product outcomes.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "infrastructure",
    name: "Infrastructure",
    code: "INFRASTRUCTURE",
    description: "Core systems and runtime foundations.",
    status: "ACTIVE",
  },
  {
    fixtureKey: "research",
    name: "Research",
    code: "RESEARCH",
    description: "Product research and technical exploration.",
    status: "ACTIVE",
  },
];
