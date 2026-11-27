# Continuum MCP Integrations UI, `/docs` Hub & Production Deployment Guide

## 1. Implemented Frontend Features (`DATN-FE`)

### A. Public Bilingual Developer & MCP Docs (`/docs` — `/en/docs`, `/vi/docs`)
- **Route & Entry Points:** `src/app/[locale]/(full-width-pages)/docs/page.tsx` rendering `src/components/docs/DeveloperDocsView.tsx`.
- **Linked From:**
  - Landing Navbar glassy animated button (`src/components/landing/scotch/ScotchNavigation.tsx`) & Landing Footer (`ScotchFooter.tsx`).
  - Authenticated App Header Help Drawer (`src/components/header/HeaderHelpDrawer.tsx`), Organization Switcher / Sidebar (`AppSidebar.tsx`, `SidebarOrganizationSwitcher.tsx`), and Legal Center footer (`LegalCenterView.tsx`).
- **Design & Interactive Features:**
  - Architectural zero-rounded-container ledger (`docs-notebook.module.css` ruled Continuum Work Notes canvas in Light `#fcfcfd` & Dark `#0b101b` mode; only buttons use pill radii).
  - Live client-side search (`/` shortcut, `Escape` clear/blur), 7-client WAI-ARIA config generator (**Google Antigravity, Claude Code CLI, Cursor, Claude Desktop, VS Code Copilot, Windsurf, JSON-RPC curl**), Direct vs. Same-Origin BFF endpoint switcher, filterable 36-tool schema/JSON-RPC explorer (including `continuum_ask_knowledge` `persistThread` escalation notes), 2 resources, 4 prompts, and 3 multi-step playbooks.

### B. Organization Integrations & MCP API Key Vault (`/organization/integrations`)
- **Route & Component:** `src/app/[locale]/(admin)/organization/integrations/page.tsx` rendering `src/components/organization-integrations/OrganizationIntegrationsManager.tsx`.
- **Capabilities:**
  - Unlocks organization navigation item (`AppSidebar.tsx`) and queries `src/lib/queries/mcp-keys/` (`/api/backend/iam/mcp-api-keys`).
  - Mints `ctm_mcp_...` personal API keys scoped to `READ_ONLY` (20 tools), `READ_WRITE` (26 tools + `persistThread`), or `FULL_OPERATIONS` (all 36 tools), with optional `allowedProjectIds` project restriction and expiration presets.
  - Shows one-time secret in the IDE config generator (never persisted in Redux/localStorage across org switches) and supports instant key revocation.

### C. Streamable HTTP BFF Proxy Hardening (`src/lib/bff-proxy.ts`, `src/app/api/backend/forward.ts`)
- Forwards MCP headers (`mcp-session-id`, `mcp-protocol-version`, `last-event-id`, `authorization`, `x-request-id`, `allow`, `www-authenticate`).
- Sets `cache-control: no-store` on all `/api/backend/mcp` responses.
- Maps upstream failures on `/api/backend/mcp` to JSON-RPC 2.0 HTTP `503` payloads (`jsonrpc: "2.0", error.code: -32000`) instead of crashing Next.js route handlers.

---

## 2. Production DNS & Domain Deployment Notes (DO NOT SKIP)

### A. Endpoint URL Resolution in `src/lib/mcp-client-configs.ts`
`resolvePublicMcpEndpoints(origin, "/api/v1/mcp")` inspects two values:
1. Build/runtime public env var `NEXT_PUBLIC_CONTINUUM_API_URL`
2. Runtime browser `window.location.origin` (populated post-mount so SSR HTML never mismatches React hydration)

Choose **one** of the two production DNS patterns:

| Deployment Topology | Example Domains | `NEXT_PUBLIC_CONTINUUM_API_URL` | `CONTINUUM_API_BASE_URL` (Server BFF) | Recommended IDE URL Shown on `/docs` |
| :--- | :--- | :--- | :--- | :--- |
| **Single Domain (Proxy via FE BFF)** | FE + `/api/backend/*`: `https://app.yourdomain.com` | *(leave blank / unset)* | `http://api-gateway:3000` (private network URL to BE) | `https://app.yourdomain.com/api/backend/mcp` |
| **Split Subdomain (FE + dedicated API domain)** | FE: `https://app.yourdomain.com`, API: `https://api.yourdomain.com` | `https://api.yourdomain.com` | `http://api-gateway:3000` (or `https://api.yourdomain.com`) | `https://api.yourdomain.com/api/v1/mcp` |

> **Important (`NEXT_PUBLIC_*` build-time baking):** Because `NEXT_PUBLIC_CONTINUUM_API_URL` is inlined into client bundles during `npm run build` in Next.js, set it **at container/CI build time** (not only runtime) if deploying Topology B! Also ensure `DATN-BE` includes `https://app.yourdomain.com` in `CORS_ALLOWED_ORIGINS`.

### B. Required Environment Variables Checklist (FE Production)

- `CONTINUUM_API_BASE_URL`: Internal or private-network URL to BE Gateway (`http://api-gateway:3000` or `http://backend:3001`). Do **not** leave as `http://localhost:3001` in containers/cloud!
- `NEXT_PUBLIC_CONTINUUM_API_URL`: Leave blank for Single Domain BFF (`https://app.yourdomain.com/api/backend/mcp`), or set to `https://api.yourdomain.com` (without trailing `/api/v1`) for Split Domain Direct API.
- `CONTINUUM_TRUSTED_EDGE_HOPS`: Keep `1` (or exact proxy hop count) in production when behind Nginx/Cloudflare/ALB (already required by `forward.ts` for auth mutations).

### C. Reverse Proxy & WAF Notes for `/api/backend/mcp` (Topology A)
If IDE clients connect directly to `https://app.yourdomain.com/api/backend/mcp`:
1. Ensure Nginx / Ingress / ALB read & send timeout on `/api/backend/mcp` is **`>= 180s`** (so `continuum_ask_knowledge` does not receive HTTP `504 Gateway Timeout`).
2. Disable response buffering (`proxy_buffering off`) on `/api/backend/mcp`.
3. **Exempt `/api/backend/mcp` from Cloudflare Bot Fight Mode / JS CAPTCHA** — CLI/IDE MCP clients cannot solve browser challenges.
4. Keep `Mcp-Session-Id`, `MCP-Protocol-Version`, `Authorization`, and `WWW-Authenticate` headers unstripped.

### D. Static Site Generation (SSG) Reminder
- Both `/en/docs` and `/vi/docs` are statically pre-rendered during `next build`. `DeveloperDocsView` intentionally initializes `browserOrigin` to `""` on the server and resolves `window.location.origin` inside `useEffect` on mount — do not break this invariant or React Error `#418` will trigger in `next start`.
