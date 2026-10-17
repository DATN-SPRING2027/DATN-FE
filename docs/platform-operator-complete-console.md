# Platform Operator — FE ↔ BE Integration Handoff

## Scope and handoff

This is a continuation of the existing Antigravity Platform UI. The single
`/platform` console, route files, TailAdmin shell, navigation, cards, tables,
detail layouts, pagination, and shared loading/empty/error components remain the
base. Codex connected the supported screens through the existing API client and
TanStack Query; no second console or duplicate route was added. The original FE
checkout containing Antigravity's uncommitted work was left untouched.

The FE branch is `feat/Thang-platform-operator-integration-fe-ui`, based on the
updated FE `origin/main` plus the existing Platform UI commits. The BE reference
branch is `feat/Thang-platform-operator-v1-be-api` at
`d0ff992703631fcde3ce1d0ab7dd428f22c02e3b`.

The BE controller and capability matrix are the evidence for runtime routes.
The checked-in `docs/openapi/iam-v1.openapi.json` is behind that implementation:
it currently describes only Platform login, Organization collection, health,
and the legacy audit feed. It does not describe the newer users, sessions,
projects, dashboard, services, jobs, AI, integrations, incidents, diagnostics,
or paginated audit operations consumed here. This contract mismatch is a
handoff blocker for a fully synchronized OpenAPI contract; this FE task does
not modify the BE repository.

## Capability matrix

`FE connected` means a real endpoint is called through the existing API client
and its response drives the UI. It does not claim that the endpoint was reached
against a live authenticated BE, MongoDB, or audit store during this task.

| Capability         | Antigravity UI                                                      | FE logic                                                                                                                                                                                  | Runtime Platform API                                                                                                                                                      | BE capability                                                                     | DB evidence                                                                                                 | Audit evidence                                                                                               | Browser | Status |
| ------------------ |---|---|---|---|---|---|---|---|
| User               | Existing Users route/table/detail layout retained                   | Search, status filter, paging, safe detail, paginated organizations, effective permissions, paginated sessions/detail, status mutation                                                    | `GET /users`, `/users/:userId`, `/users/:userId/organizations`, `/users/:userId/sessions`, `/users/:userId/sessions/:sessionId`; `PATCH /users/:userId/status`            | `account.read`, `account.manage`; PLATFORM scope                                  | BE matrix maps reads/status writes to Mongo user, membership and session data; not live-verified | BE matrix documents audited status changes; not live-verified | BLOCKED | PARTIAL |
| Organization       | Existing directory/detail/create flow retained                      | List/detail/create, first-ADMIN exact lookup, metadata edit, members, invitation read                                                                                                     | `GET/POST /organizations`, `GET/PATCH /organizations/:organizationId`, `GET /organizations/:organizationId/invitations`, membership APIs                                  | `organization.read`, `organization.create`, `organization.manage`; PLATFORM scope | BE matrix maps Organization metadata writes to Mongo; not live-verified | BE matrix documents audited writes; not live-verified                                              | BLOCKED | PARTIAL |
| Membership         | Existing organization-scoped page/table/dialog retained             | Paginated member list and confirmed suspend with version/reason; invitation metadata read on Organization detail                                                                          | `GET /organizations/:organizationId/memberships`, `GET /memberships`, `POST /organizations/:organizationId/memberships/:membershipId/suspend`                             | `membership.read`, `lifecycle.manage`; PLATFORM scope                             | BE matrix maps suspension to Mongo with CAS; not live-verified | BE matrix documents suspension audit; not live-verified                                         | BLOCKED | PARTIAL |
| Project            | Existing Projects route retained and populated from safe projection | Search, visibility filter, paging, detail/member summary, confirmed visibility edit                                                                                                       | `GET /projects`, `/projects/:projectId`; `PATCH /projects/:projectId`                                                                                                     | `project.read`, `project.manage`; PLATFORM scope                                  | BE matrix maps Project metadata writes to Mongo; not live-verified | BE matrix documents audited metadata writes; not live-verified                                        | BLOCKED | PARTIAL |
| Session & Security | Existing Security page and account identity display retained        | Current operator sessions and safe detail; cross-user session list/detail/revoke available in User detail; own-session revoke hidden because the API does not identify the active session | `GET /users/:userId/sessions`, `/users/:userId/sessions/:sessionId`; `POST /users/:userId/sessions/:sessionId/revoke` plus current Platform session/logout                | `session.read`, `session.manage`; PLATFORM scope                                  | BE matrix maps session state to refresh-session families; not live-verified | BE matrix documents session-revoke audit; not live-verified                            | BLOCKED | PARTIAL |
| Dashboard          | Existing dashboard cards retained                                   | API aggregates for organizations/users/memberships/projects/service health and recent safe activity                                                                                       | `GET /dashboard`                                                                                                                                                          | `dashboard.summary.read`; PLATFORM scope                                          | BE matrix reads aggregate projections; not live-verified | No mutation; audit not applicable                                               | BLOCKED | PARTIAL |
| Services           | Existing Services route/card layout retained                        | Safe service status, availability, readiness, dependencies and bounded diagnostics                                                                                                        | `GET /services`                                                                                                                                                           | `service.read`; PLATFORM scope                                                    | BE matrix reads service health sources; not live-verified | No mutation; audit not applicable                     | BLOCKED | PARTIAL |
| Job / Queue        | Existing Jobs route/table retained                                  | Queue/job pages, safe failure summary, confirmed retry/cancel with expected status                                                                                                        | `GET /queues`, `/jobs`; `POST /jobs/:queueId/:jobId/retry`, `/cancel`                                                                                                     | `job.read`, `job.manage`; PLATFORM scope                                          | Runtime queue provider state; not live-verified | BE matrix documents audited job commands; not live-verified                                          | BLOCKED | PARTIAL |
| RAG / AI           | Existing AI route/card retained                                     | SAG operational readiness and safe dependency summary                                                                                                                                     | `GET /ai/operations`                                                                                                                                                      | `ai.operations.read`; PLATFORM scope                                              | No live DB verification; SAG does not expose provider/model/job state | No mutation/audit capability for the unexposed SAG states                     | BLOCKED | PARTIAL |
| Integration        | Existing Integrations route/table retained                          | Safe provider/org/project/status/sync/failure summary                                                                                                                                     | `GET /integrations`                                                                                                                                                       | `integration.read`; PLATFORM scope                                                | Persisted integration metadata; not live-verified | Test/reconnect remains gated; no live audit verification                 | BLOCKED | PARTIAL |
| Incident           | Existing Incidents route/table/detail retained                      | List/detail/history/create, confirmed acknowledge/resolve, notes                                                                                                                          | `GET /incidents`, `/incidents/:incidentId`, `/incidents/:incidentId/history`; `POST /incidents`, `/:incidentId/acknowledge`, `/:incidentId/resolve`, `/:incidentId/notes` | `incident.read`, `incident.manage`; PLATFORM scope                                | BE matrix maps incident/history writes to Mongo; not live-verified | BE matrix maps incident actions to audit; not live-verified                                | BLOCKED | PARTIAL |
| Diagnostics        | Existing Diagnostics route retained                                 | Request-ID trace view with server-bounded redacted events                                                                                                                                 | `GET /diagnostics/traces/:requestId`                                                                                                                                      | `diagnostics.trace.read`; PLATFORM scope                                          | Trace reads use indexed audit data; not live-verified | Read-only audit projection; no live verification                                                   | BLOCKED | PARTIAL |
| Audit              | Existing Audit route/table retained                                 | Server pagination, action/actor/resource/time filters, event detail and resource history; no export                                                                                       | `GET /audit/events`, `/audit/events/:eventId`, `/audit/resources/:resourceType/:resourceId/history`                                                                       | `audit.read`; PLATFORM scope                                                      | Reads the BE audit collection; not live-verified | Mutations rely on BE audit producers; not live-verified                   | BLOCKED | PARTIAL |
| Platform Account   | Existing account page and sign-out retained                         | Current validated Platform identity, effective permissions, own session state, sign-out                                                                                                   | Current Platform session and logout routes                                                                                                                                | Current authenticated Platform subject                                            | No live session persistence verification | Logout/audit behavior not live-verified                                           | BLOCKED | PARTIAL |

The browser column is BLOCKED for all capabilities: the production FE smoke request to `/platform/signin` receives a 307 redirect back to the same path while rewriting internally to `/en/platform/signin`, including when `NEXT_LOCALE=en` is sent; the browser reports `ERR_TOO_MANY_REDIRECTS`. No authenticated BE/BFF or Platform browser session was available, so capability interactions were not verified in a real browser.

The implementation intentionally leaves these operations without callable
controls: Organization lifecycle (no approved state model), invitation
invite/resend/cancel while BE notification/cutover gates are closed, membership
remove/restore/role change, Platform authority grant/revoke, and integration
test/reconnect while the external provider gate is unavailable. It does not
reuse organization-scoped User/Project APIs, fabricate records, or expose
tenant content, job payloads, credentials, raw errors, or raw audit events.
The FE also withholds revoking a session belonging to the current operator,
because the session list/API response does not mark which session is the active
browser session.

## Mutation and session handling

- FE controls are shown only for the exact permission and scope returned by the
  current Platform session. BE authorization remains authoritative.
- Cookie mutations use the shared CSRF header. Mutations that require replay
  safety include an idempotency key; versioned writes send the current CAS
  value and reason code required by the controller.
- Every Platform API request has a 15-second abort timeout; an abort is rendered
  through the same safe request error state and is not retried automatically.
- `409` conflicts invalidate Platform and audit queries so the next render uses
  current server state. Mutation failures do not trigger blind retries.
- Successful mutations invalidate the relevant Platform projections and audit
  queries. FE never fabricates audit events.
- Platform `401` handling clears private query cache and the route guard hides
  cached console data while the session is unresolved or invalid. Tokens are
  not read from browser storage or rendered.
- User status, session revoke, job commands, project visibility and incident
  acknowledge/resolve ask for confirmation. Membership suspension retains its
  confirmation dialog.

## Validation and remaining blockers

`npm run check` passed: ESLint, TypeScript, all 393 Vitest tests in 53 files,
and the production build. `git diff --check` also passed. The repository has no
Playwright/Cypress E2E script or test suite. Browser smoke was attempted against
the local production FE and is blocked by the locale redirect loop documented
above. The FE worktree had no `.env.local`, and no BE listener was available on
the configured local port, so authenticated BE, Mongo persistence and audit
production were not verified. A passing unit/build suite proves FE behavior
only; BE matrix/tests are repository evidence, not live acceptance.

The main contract blocker is the stale checked-in OpenAPI JSON noted above. The
external readiness gates for invitations, Jira actions, and unavailable SAG
details are backend constraints. Organization lifecycle and unapproved
membership/authority changes remain out of scope until a reviewed BE state
model, permissions, audit contract, and migration exist.

## Impact

FE-only change. No Mongo schema, database migration, BE source, configuration,
dependency, or production/staging data was changed. Rollback is reverting the
FE commit; no data rollback is needed.
