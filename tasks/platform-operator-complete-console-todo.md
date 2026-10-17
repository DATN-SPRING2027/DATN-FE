# Platform Operator Complete Console — Todo

## Preparation

- [x] Read workspace rules, FE `AGENTS.md`, project spec and task history.
- [x] Inspect FE/BE Platform API implementation and current branch/worktree state.
- [x] Fetch and verify `origin/main`; create fresh `feat/Thang-platform-operator-integration-fe-ui` from updated `main`.
- [x] Preserve the unrelated `package-lock.json` modification in the original FE checkout.
- [x] Write research, plan and API dependency matrix before implementation.
- [x] Reuse the existing Platform Console implementation commits from the previous task branch.
- [x] Install dependencies from the unchanged lockfile and read the installed Next.js 16 App Router documentation before coding.

## Implementation

- [x] Build route-aware Platform Console shell with grouped navigation for all 14 domains.
- [x] Dashboard: show real BE aggregates, service health, and bounded operational activity.
- [x] Organizations: preserve list/create/first-ADMIN lookup; connect detail, metadata update, invitation metadata, membership list/suspend.
- [x] Users: connect directory/search/status filter/pagination, safe detail, organization/effective-permission projection, sessions and guarded status mutation.
- [x] Memberships: preserve paginated organization-scoped list/suspend; keep invitation commands gated and unapproved role/remove/restore actions unavailable.
- [x] Projects: connect safe list/detail/member summary and visibility/metadata update; do not call Organization-scoped Project APIs.
- [x] Sessions & Security: connect current operator sessions and safe revoke; expose eligible cross-user sessions in User detail; hide self-revoke.
- [x] Services: connect safe service/dependency projection while retaining health boundaries.
- [x] Jobs/Queue: connect queue/job read and confirmed CAS/idempotent retry/cancel commands.
- [x] RAG/AI, Integrations, Incidents, Diagnostics: connect supported safe projections/commands; keep provider-gated and unexposed capabilities disabled with reasons.
- [x] Audit: connect server pagination, filters, event detail and resource history; no export/raw event view.
- [x] Account: display current session identity, approved permissions and sign-out.
- [x] Add localized copy keys in the supported locale dictionary; maintain responsive and accessible states.

## Verification / review

- [x] Add regression tests for all navigation groups, supported API behavior, unsupported actions, safe states and privacy boundaries.
- [x] Run focused query-hook and Platform Console tests, including pagination and invalid Organization route handling.
- [x] Run `npm run check` after final code changes: ESLint, typecheck, 393 tests across 53 files, production build all pass.
- [x] Review `git diff --check`, full diff, changed files and status; commit history recorded at handoff.
- [x] Review authorization boundaries, endpoint use, response projections and secret/tenant-data exposure.
- [x] Attempt production browser smoke and record blocker: `/platform/signin` repeats a 307 self-redirect and the browser reports `ERR_TOO_MANY_REDIRECTS`; no authenticated BE/BFF was available.
- [x] Update the as-built documentation, API dependency matrix, check results and known blockers.
- [x] Report exact next push command; do not push automatically.

## Exit criteria

Do not report completion while an FE page, supported operation, test, review, documentation item, or feasible visual check remains open. Backend-dependent operations may remain unavailable only after the corresponding safe FE page is complete and the exact missing Platform API/permission/contract is documented.

## Completion notes

- All 14 requested capability routes use the existing Platform console and Antigravity shared shell; supported BE projections and mutations are connected through query hooks.
- User/org/project/session/job/incident mutations carry the required server preconditions, and query invalidation refreshes state/audit projections. Provider and state-model gates remain documented.
- `npm run check` passes (53 test files, 393 tests, lint, typecheck, build). `git diff --check` passes. Browser smoke is blocked by the reproducible locale redirect loop; Mongo persistence and live audit verification were not possible without a running authenticated BE/test DB.
- No E2E runner exists in this FE repository. The BE runtime controller/capability matrix includes more routes than the checked-in static IAM OpenAPI JSON; no BE contract files were changed in this FE task.
