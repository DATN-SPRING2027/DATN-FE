# B-01 Project Workspace

Routes: `/projects` and `/projects/[projectId]`. Create opens an inline form on the list page. The sidebar exposes Projects for authenticated organization users; role names do not authorize access.

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
