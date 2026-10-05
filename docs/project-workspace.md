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
