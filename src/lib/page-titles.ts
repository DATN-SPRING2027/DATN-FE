export const BRAND_SHORT = "Continuum";
export const BRAND_AI = "Continuum AI";
export const BRAND_PLATFORM = "Continuum Platform";

/**
 * Normalizes whitespace and trims dynamic entity names so browser tabs stay readable.
 */
export function truncateTitleSegment(value: string, maxLength = 56): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}

/**
 * Standard application page (`Continuum` suffix):
 * Example: `Tổng quan tổ chức · Continuum` / `Organization Overview · Continuum`
 */
export function formatAppTitle(pageTitle: string): string {
  const clean = truncateTitleSegment(pageTitle, 72);
  return clean ? `${clean} · ${BRAND_SHORT}` : BRAND_SHORT;
}

/**
 * Project overview (`/projects/[id]` & `/projects/[id]/overview`):
 * - Loaded: `[Project Name] · Continuum`
 * - Fallback: `[Fallback Label] · Continuum`
 */
export function formatProjectOverviewTitle(
  projectName: string | null | undefined,
  fallbackLabel: string,
): string {
  const cleanProject = truncateTitleSegment(projectName ?? "", 56);
  if (cleanProject) {
    return `${cleanProject} · ${BRAND_SHORT}`;
  }
  return formatAppTitle(fallbackLabel);
}

/**
 * Project section or nested entity (Project-first Option B):
 * - Loaded: `[Project Name] · [Section / Entity] — Continuum`
 * - Fallback (while loading or unavailable): `[Section / Entity] · Continuum`
 */
export function formatProjectSectionTitle(
  projectName: string | null | undefined,
  sectionOrEntityLabel: string,
): string {
  const cleanProject = truncateTitleSegment(projectName ?? "", 44);
  const cleanSection = truncateTitleSegment(sectionOrEntityLabel, 48);
  if (cleanProject && cleanSection) {
    return `${cleanProject} · ${cleanSection} — ${BRAND_SHORT}`;
  }
  if (cleanSection) {
    return `${cleanSection} · ${BRAND_SHORT}`;
  }
  if (cleanProject) {
    return `${cleanProject} · ${BRAND_SHORT}`;
  }
  return BRAND_SHORT;
}

/**
 * AI Chat & shared AI answers (`Continuum AI` suffix):
 * - Active thread/question: `[Title] · Continuum AI`
 * - Idle / fallback: `AI Chat · Continuum AI`
 * - Streaming: prefixes `● `
 */
export function formatAiChatTitle(options: {
  threadTitle?: string | null;
  fallbackLabel: string;
  isStreaming?: boolean;
}): string {
  const cleanThread = truncateTitleSegment(options.threadTitle ?? "", 56);
  const primary =
    cleanThread || truncateTitleSegment(options.fallbackLabel, 56) || "AI Chat";
  const prefix = options.isStreaming ? "● " : "";
  return `${prefix}${primary} · ${BRAND_AI}`;
}

/**
 * Platform Operator Console (`Continuum Platform` suffix):
 * Example: `Vận hành AI · Continuum Platform` / `North Star · Continuum Platform`
 */
export function formatPlatformTitle(sectionOrEntityLabel: string): string {
  const clean = truncateTitleSegment(sectionOrEntityLabel, 56);
  return clean ? `${clean} · ${BRAND_PLATFORM}` : BRAND_PLATFORM;
}
