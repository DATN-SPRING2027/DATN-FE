# Platform Operator — FE ↔ BE Integration Handoff

## Scope and handoff

This task completes Platform user management V1 across the existing FE console
and IAM backend. It adds profile edit, suspend/reactivate, and archive actions
to the existing user directory and detail view, backed by versioned Platform
API mutations and atomic audit writes. The existing `/platform` console and
shared API/query patterns remain in use.

## Role display labels

The console uses business-facing labels for role codes. This is a display-only
mapping; stored role codes, API values, permissions, and authorization behavior
remain unchanged.

| Role code | Display label |
| --- | --- |
| `PLATFORM_OPERATOR` | Admin |
| `ADMIN` | Manager |
| `TEAM_LEADER` | Leader |
| `MEMBER` | Member |

The FE branch is `feat/Thang-platform-user-management-fe-ui`, based on FE
`origin/main` at `099516fc3732d212a960d25792a558d20a981a10`. The BE branch is
`feat/Thang-platform-user-management-be-api`, based on BE `origin/main` at
`59d4fb2bed0664eccdec221961df3acae67fba55`.

The BE controller and capability matrix define runtime permissions and routes.
The checked-in `docs/openapi/iam-v1.openapi.json` now documents the user profile
PATCH and archive POST routes, their `platform.users.account.manage` scope,
compare-and-set input, retained archive semantics, and safe audit fields. Other
Platform capability gaps in the wider console remain outside this task.

## Capability matrix

`FE connected` means a real endpoint is called through the existing API client
and its response drives the UI. It does not claim that the endpoint was reached
against a live authenticated BE, MongoDB, or audit store during this task.

| Capability         | Antigravity UI                                                      | FE logic                                                                                                                                                                                  | Runtime Platform API                                                                                                                                                      | BE capability                                                                     | DB evidence                                                                                                 | Audit evidence                                                                                               | Browser | Status |
| ------------------ |---|---|---|---|---|---|---|---|
| User               | Existing Users route/table/detail layout retained                   | Search, status filter (including archived), paging, safe detail, paginated organizations, effective permissions, paginated sessions/detail, profile edit, suspend/reactivate, archive confirmation | `GET /users`, `/users/:userId`, `/users/:userId/organizations`, `/users/:userId/sessions`, `/users/:userId/sessions/:sessionId`; `PATCH /users/:userId`, `/users/:userId/status`; `POST /users/:userId/archive` | `platform.users.account.read/manage`; PLATFORM scope; BE rechecks actor and permission in transaction | Mongo user profile/archive fields, memberships and sessions; covered by replica-set integration tests, not live-verified | Atomic profile/status/archive audit events; covered by integration tests, not live-verified | BLOCKED | IMPLEMENTED |
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

The browser column is BLOCKED for all capabilities. The local BE process has
active Mongo connections to non-loopback hosts, and this task could not prove
that database is disposable. No authenticated directory request or user
mutation was sent, so live FE-to-BE, Mongo, and audit behavior remains
unverified. User-management interactions were verified with FE component and
hook tests, BE contract/unit tests, and disposable Mongo integration tests.

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
- Cookie mutations use the shared CSRF header. Versioned user writes send the
  current `expectedUpdatedAt` and reason code where required. Profile and
  archive commands are not automatically retried; a repeated stale write is
  rejected by CAS.
- Every Platform API request has a 15-second abort timeout; an abort is rendered
  through the same safe request error state and is not retried automatically.
- `409` conflicts invalidate Platform and audit queries so the next render uses
  current server state. Mutation failures do not trigger blind retries.
- Successful mutations invalidate the relevant Platform projections and audit
  queries. FE never fabricates audit events.
- Platform `401` handling clears private query cache and the route guard hides
  cached console data while the session is unresolved or invalid. Tokens are
  not read from browser storage or rendered.
- User status and archive use explicit confirmation dialogs; archive also
  requires an acknowledgment checkbox. Session revoke, job commands, project
  visibility and incident acknowledge/resolve ask for confirmation.

## Validation and remaining blockers

FE `npm run check` passed: ESLint, TypeScript, 425 tests in 56 files, and the
production build. The BE `npm run check` passed and exited 0: lint, type-check,
dev database safety checks (25/25), 939 unit tests passed (101 skipped), 79 E2E
tests passed (4 skipped), and build. The Jest open-handle issue was fixed by
disabling external infrastructure for route-only test modules and closing
their app lifecycle cleanly; no `--forceExit` was used. `git diff --check`
passed. The FE repository has no Playwright/Cypress E2E script or suite. Browser
verification is blocked because the running BE has active connections to
non-loopback Mongo hosts and the database could not be confirmed disposable;
no live directory read or mutation was attempted. BE Mongo integration tests
use a disposable local replica set and do not verify writes to a deployed DB.

For this user-management scope, the OpenAPI contract is synchronized. The
external readiness gates for invitations, Jira actions, and unavailable SAG
details are backend constraints. Organization lifecycle and unapproved
membership/authority changes remain out of scope until a reviewed BE state
model, permissions, audit contract, and migration exist.

## Impact

This task changes FE and BE source and documentation. It adds no Mongo schema,
database migration, dependency, or configuration change, and does not touch
production/staging data. If rolled back before deployment, revert both code
branches. If archive has been used after deployment, retain archive markers and
audit history and use a reviewed account-recovery procedure; do not bulk-delete
or clear lifecycle data.
