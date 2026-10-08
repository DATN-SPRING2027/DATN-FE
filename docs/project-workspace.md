# B-01 Project Workspace

Routes: `/projects`, `/projects/new`, and `/projects/[projectId]`. Create opens a dedicated page from the list; Cancel returns to the list and a successful POST navigates to the backend-returned Project ID. The sidebar exposes Projects for authenticated organization users; role names do not authorize access.

## Accepted contract

The implementation follows the Project create/list/detail portion of `DATN-BE/docs/openapi/iam-v1.openapi.json`, `project-foundation-read-mvp.md`, and `project-access-visibility-v1.md`.

- List: GET `/api/v1/iam/projects`, with `page`, `pageSize`, and optional `status` (`ACTIVE` or `ARCHIVED`). Reads `{ data, pagination }`.
- Create: POST `/api/v1/iam/projects`, with required `name` and `code`, and optional `description`. Reads the returned Project. No organization, visibility, status, membership, or role override is sent.
- Detail: GET `/api/v1/iam/projects/{projectId}`. Reads only Project metadata; no nested content or access-management controls are exposed.
- Browser calls use the existing API client/BFF (`/api/backend/iam/projects`); server upstream base includes `/api/v1`. Existing HttpOnly-cookie authentication and session recovery are reused.

Organization identity comes from `/auth/me`. Query keys separate organization caches, local form/filter state resets when identity or organization changes, and stale list/detail data is hidden during backend revalidation. Zustand's active Project selection is not authorization evidence. List filtering and permissions remain backend responsibilities. Error states conceal Project data, including cached data after a denied refetch.

## Verification

`src/components/projects/ProjectWorkspace.spec.tsx` uses the real query hooks and UI with mocked API responses. It covers accepted paths and create payloads, pagination/status filtering, loading/empty/success, form validation, pending submissions, 401/403/404/409/422/server and network failures, retry, create invalidation, stale-cache denial, and organization switching.

Run `npm run check` for ESLint, TypeScript, Vitest and production build. These are local tests with simulated backend responses; validation against a running authenticated backend requires its configured environment and provisioned MEMBER role with `project.read`.

## Workspace design

UI UX Pro Max informed a flat, readable workspace using existing TailAdmin brand, typography and spacing tokens. The reference card grid is adapted to one column on mobile, two on medium screens and three on large screens, with status text, visibility, project code, description and a localized update date. Dates use UTC consistently. The status filter and pagination remain server-side; no unsupported search, ownership tabs, task timelines or administration actions are implied.

Create remains inline with a multiline description and preserves the accepted payload unchanged. Detail uses a responsive metadata grid. Loading includes reduced-motion-aware skeletons; empty, retry and backend denial states remain explicit. Current routing supports English only; copy is centralized in the existing English dictionary. No packages, backend, database or authentication configuration were changed.

Validation on 2026-10-05: `npm run check` passed ESLint, TypeScript, all 91 tests (30 Project tests), and the production build. Five-axis review found no outstanding code blockers. Opening `/projects` in the local browser redirected to `/signin` without an authenticated session, so authenticated visual checks at the target breakpoints and live backend integration remain unverified.

## Create form reference update

Adapted the user-supplied Stitch HTML (TailAdmin - Create Project) to a centered form with a white Project Details card, two-column name/code fields, full-width description, a private-default information panel, and a separate Cancel/Create footer. Code remains an editable required field; only code, not name, has an organization uniqueness requirement. The reference's repository/runtime/leader/draft controls are outside B-01's accepted create contract and are omitted. Visibility remains server-owned and is not sent in the create request. Existing TailAdmin tokens and font are retained, including dark and RTL-compatible styling. Validation is linked to inputs for assistive technology.

`npm run check` passed after the update: ESLint, TypeScript, all 92 tests (31 Project tests), and production build. Review found no outstanding blockers. Authenticated browser visual verification remains outstanding as described above. No backend, database, dependencies, or environment settings changed.

## Separate create route and page headers

The list and create pages share a breadcrumb-first header with a large title and supporting text on the page background. The redundant Projects card header was removed. The list links to `/projects/new`; its form no longer appears inline. The create page resolves trusted identity/organization before showing the form, resets input when that identity changes, and preserves the existing create contract. Static `new` routing takes precedence over `[projectId]`. Existing backend authorization, query invalidation, and session guards remain in force.

Validation after routing/header update: `npm run check` passed lint, TypeScript, 97 tests (36 Project tests), and production build including `/projects/new`. Changes remain unstaged and uncommitted.

Typography and toolbar alignment: Project pages inherit the system Outfit font, with the standard text-xl page heading and text-sm supporting copy. Project codes no longer use a separate monospace font. Status label, filter and result count are grouped in a responsive toolbar beside the Create link; filter and link share the h-11 control height. No API behavior or Git staging changed.

## Detail overview reference update

The user-provided TailAdmin detail HTML informed a breadcrumb/name/status header, three summary cards (code, visibility, updated time), a description card and a project-context sidebar. Only metadata from the accepted detail response is rendered; creator is labeled as a user ID and never inferred to be an owner. Unsupported deployment, pipeline, telemetry, repository, runtime and membership controls are omitted. Existing Outfit font, theme tokens, dark mode and responsive grids are reused. Denied or pending revalidation continues to hide Project metadata.

## Responsive sizing update

List, create and detail components now use Tailwind container queries based on available content width, including when the admin sidebar is expanded. Cards scale from one to two/three columns; metadata summaries become three columns only with sufficient space. The detail sidebar appears alongside description at a 56rem content width. Controls, pagination and create actions wrap/stack on narrow screens. Card padding reduces on mobile and unbroken names/codes/descriptions wrap. The admin main-content flex child uses min-w-0 to prevent intrinsic content widths from stretching the shell. Existing max-widths remain in force on large displays.

`npm run check` passed: 98 tests, lint, TypeScript and production build. Authenticated browser checks across device widths remain outstanding; automated component tests do not measure rendered geometry. No branch, staging, commit or push operations were performed.

## Shared admin breadcrumb and navigation

Project list, create and detail routes render the shared PageBreadcrumb before content, with translated titles/Home label and a Projects parent link for child pages. Feature-specific breadcrumbs were removed to avoid duplication. Sidebar matching keeps Projects active for the exact /projects path and descendants beginning /projects/; similar prefixes do not match and other navigation entries retain exact matching. Added nine matching regression cases. npm run check passed 107 tests, lint, TypeScript and production build. All changes remain unstaged and uncommitted.

Latest UI direction: PageBreadcrumb was removed from all three Project routes at the user’s request. Sidebar descendant matching remains unchanged.
