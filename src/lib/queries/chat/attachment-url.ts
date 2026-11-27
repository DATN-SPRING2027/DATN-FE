/**
 * Rewrites backend-relative `/api/v1/...` attachment content URLs to the
 * Next.js BFF proxy prefix `/api/backend/...` so browser `<img>` and `<a download>`
 * requests resolve through the authenticated same-origin BFF instead of hitting
 * Next.js `/api/v1/...` (404).
 */
export function normalizeChatAttachmentUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("/api/v1/")) {
    return `/api/backend/${trimmed.slice("/api/v1/".length)}`;
  }
  return trimmed;
}
