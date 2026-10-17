# Platform Operator Complete Console — Todo

## Preparation

- [x] Read workspace rules, FE `AGENTS.md`, project spec and task history.
- [x] Inspect FE/BE Platform API implementation and current branch/worktree state.
- [x] Fetch and verify `origin/main`; create fresh `feat/Thang-platform-operator-complete-fe-ui` from updated `main`.
- [x] Preserve the unrelated `package-lock.json` modification in the original FE checkout.
- [x] Write research, plan and API dependency matrix before implementation.
- [x] Reuse the existing Platform Console implementation commits from the previous task branch.
- [x] Install dependencies from the unchanged lockfile and read the installed Next.js 16 App Router documentation before coding.

## Implementation

- [x] Build route-aware Platform Console shell with grouped navigation for all 14 domains.
- [x] Dashboard: show only real Organization count, IAM process liveness and bounded recent audit data; mark unavailable metrics explicitly.
- [x] Organizations: preserve list/create/first-ADMIN lookup; add detail route, pagination and membership list/suspend.
- [x] Users: support only exact active-account lookup for Organization creation; explain that directory, detail and status actions are unavailable.
- [x] Memberships: support paginated list/suspend scoped to a selected Organization; explain unsupported invite/resend/revoke/remove/role/history actions.
- [x] Projects: render metadata/access-policy unavailable state; do not call Organization-scoped Project APIs.
- [x] Sessions & Security: show current Platform session/permissions and sign-out; mark other sessions, revoke, anomaly handling and security events unavailable.
- [x] Platform Health/Services: preserve IAM liveness; identify dependency/service diagnostics as unavailable.
- [x] Jobs/Queue, RAG/AI, Integrations, Incidents, Diagnostics: build explicit no-data/no-action unavailable pages, with privacy boundaries.
- [x] Audit: preserve fixed bounded projection; add local filters only against loaded records; no export/raw event detail.
- [x] Account: display current session identity, approved permissions and sign-out.
- [x] Add localized copy keys in the supported locale dictionary; maintain responsive and accessible states.

## Verification / review

- [x] Add regression tests for all navigation groups, supported API behavior, unsupported actions, safe states and privacy boundaries.
- [x] Run focused component/API tests, including pagination and invalid Organization route handling.
- [x] Run `npm run check` (lint, typecheck, Vitest, production build) after final code changes.
- [x] Review `git diff --check`, full diff, changed files, status and commit history.
- [x] Review authorization boundaries, endpoint use, response rendering and secret/tenant-data exposure.
- [x] Perform the available browser smoke/visual checks and record the authenticated-console limitation.
- [x] Update as-built documentation, API dependency matrix, checks and blockers.
- [x] Report exact next push command; do not push automatically.

## Exit criteria

Do not report completion while an FE page, supported operation, test, review, documentation item, or feasible visual check remains open. Backend-dependent operations may remain unavailable only after the corresponding safe FE page is complete and the exact missing Platform API/permission/contract is documented.

## Completion notes

- 14 routes are wired to the shared Platform shell and navigation.
- Real Platform Organization and Membership lists can page through the API's `totalPages`; malformed Organization IDs show a bounded validation message without a stuck loading state or request.
- An unauthenticated browser smoke check verified that Platform routes return to `/platform/signin` without repeated session refresh requests. The authenticated console could not be visually checked in the browser because no authenticated Platform session was available during this run; component, hook, route-build and access-boundary tests cover it.
- Backend-dependent operations remain explicitly deferred as listed in the research/as-built document.
