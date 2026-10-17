# Platform Operator Complete Console — Research and API Dependency Matrix

## Product boundary

The requested FE scope includes 14 Platform Operator groups. The FE may provide navigable page structure across those groups, but a visible page does not authorize new data access. The backend Platform API and permission are authoritative. No Organization-scoped endpoint is reused under a Platform session. No fake rows, fake counts, fake status, or simulated success are allowed.

Configuration remains out of scope. The console must not expose tenant content, secrets, raw audit events, job payloads, prompts, or cross-user session data.

## Repository findings

- FE: Next.js 16 App Router, React 19, TypeScript, TailAdmin, Tailwind CSS 4, TanStack Query 5 and next-intl. The configured repository currently ships English copy in `src/messages/en.json`.
- Authentication uses the same-origin backend proxy and HttpOnly-cookie flow. The FE must not read or persist bearer/refresh tokens.
- Current main did not contain the Platform Console implementation. The previous task branch contains the console implementation and its API/BFF/tests; it is being reused on this clean branch.
- The existing account-scoped User, Membership and Project routes are bound to Organization identity and are not valid Platform Operator APIs.
- No BE changes are in scope for this FE task.

## Current Platform API and permission evidence

The current Platform controller/service implementation exposes the following operations (verified in the existing BE task branch `feat/Thang-platform-operator-v1-be-api`):

| Operation | API | Required permission | FE capability |
|---|---|---|---|
| Current Platform session | `GET /api/v1/auth/platform/me` | Authenticated current Platform subject | Current account and effective permission projection |
| Sign in | `POST /api/v1/auth/platform/login` | Platform login flow | Existing Platform sign-in |
| Sign out | `POST /api/v1/auth/logout` | Current session | Current-session sign-out |
| Organization create | `POST /api/v1/iam/platform/organizations` | `organization.create` | Create Organization and select first ADMIN through exact active-account lookup |
| Organization list/detail | `GET /api/v1/iam/platform/organizations`, `GET /api/v1/iam/platform/organizations/:organizationId` | `platform.organizations.organization.read` | Bounded metadata list/detail |
| Exact active account lookup | `POST /api/v1/iam/platform/users/lookup` | `platform.users.account.read` | Lookup one exact email for first ADMIN assignment; not a directory |
| Organization memberships | `GET /api/v1/iam/platform/organizations/:organizationId/memberships` | `platform.memberships.membership.read` | List memberships for a selected Organization |
| Suspend membership | `POST /api/v1/iam/platform/organizations/:organizationId/memberships/:membershipId/suspend` | `platform.memberships.lifecycle.manage` | Suspend after confirmation with required CSRF/idempotency/version/reason contract |
| Platform health | `GET /api/v1/iam/platform/health` | `platform.health.read` | IAM process liveness only |
| Bounded audit | `GET /api/v1/iam/platform/audit` | `platform.audit.read` | Fixed projection, at most 100 records, no export/raw event |

Exact active permission catalog in the current Platform session contract:

`organization.create`, `platform.health.read`, `platform.audit.read`, `platform.organizations.organization.read`, `platform.users.account.read`, `platform.memberships.membership.read`, `platform.memberships.lifecycle.manage`.

Frontend permission checks only control visibility and affordances. The backend repeats authorization on every request.

## 14-group dependency matrix

| # | Group | Planned FE route/page | Current Platform API | FE behavior / blocker |
|---:|---|---|---|---|
| 1 | User Management | `/platform/users` | Exact-email active-account lookup only | Allow exact lookup only for Organization creation context; no directory, detail, activate/deactivate, effective membership/permission view, or cross-user session management. Requires platform user-directory and lifecycle contracts. |
| 2 | Organization Management | `/platform/organizations`, `/platform/organizations/:organizationId` | List, metadata detail, create; memberships are a separate route | Live list/detail/create and first ADMIN lookup; no metadata edit, Organization lifecycle, invite/resend/revoke, or remove/role mutation. Each missing operation requires a platform-authorized API and audit contract. |
| 3 | Membership Management | `/platform/memberships` | List and suspend for selected Organization | Live list/suspend only. Invite/resend/revoke/remove/role-change/history are unavailable; existing org-admin APIs are not called. |
| 4 | Project Management | `/platform/projects` | None | Metadata, visibility and access policy unavailable. Existing Project APIs require Organization identity; no tenant content is requested. |
| 5 | Session & Security | `/platform/security` | Current Platform session only, plus sign out | Show current session identity/permissions and sign out. Other-user sessions, revoke, anomaly handling and security events unavailable. |
| 6 | Platform Dashboard | `/platform` | Organization list, IAM health, bounded audit | Use actual available responses only. User/Project/other service metrics unavailable; do not infer totals from partial data. |
| 7 | Service Operations | `/platform/services` | IAM health only | Preserve process liveness; service dependency/availability/diagnostics unavailable. |
| 8 | Job / Queue Management | `/platform/jobs` | None | Explicit unavailable state; no payload/status/retry/cancel data or controls. |
| 9 | RAG / AI Operations | `/platform/ai` | None | Explicit unavailable state; no tenant content, prompts, model/index health or job payload. |
| 10 | Integration Management | `/platform/integrations` | None | Explicit unavailable state; never display or handle connection secrets/keys. |
| 11 | Incident Management | `/platform/incidents` | None | Explicit unavailable state; no incident list/actions/notes until approved API and audit contract. |
| 12 | Support / Diagnostics | `/platform/diagnostics` | None | Explicit unavailable state; no trace/diagnostic output until redaction contract and API exist. |
| 13 | Audit | `/platform/audit` | Fixed bounded audit projection | Existing list only; client filters may refine the loaded bounded projection. No raw event details, server query implication, or export. |
| 14 | Platform Account | `/platform/account` | Current Platform session and sign out | Show session identity/effective permissions and sign out. No profile, credentials, or secrets. |

## Risk and implementation notes

- `GET /auth/platform/me` returns current session/permission projection, not an administrative user/session directory.
- Existing Organization invitation and Project APIs are intentionally excluded because they are organization-scoped and their actor/ACL contract differs.
- The health operation describes IAM process liveness only; it must not be relabeled as database, queue, or whole-platform readiness.
- Audit’s bounded projection is not an export source. Local filters must clearly apply only to the loaded records.
- Unsupported operations require a separately approved Platform API, permission/scope, audit event and QA oracle before they become actionable.

## As-built implementation

The console now provides routes under `/platform` for Dashboard, Organizations (directory and detail), Users, Memberships, Projects, Sessions & Security, Services, Jobs & Queues, RAG & AI, Integrations, Incidents, Diagnostics, Audit, and Platform Account. The 14 entries share the existing Platform session guard and grouped responsive navigation.

Active FE/API behavior:

- Organization list/detail metadata and Membership lists use the current Platform endpoints and exact `platform.organizations.organization.read` / `platform.memberships.membership.read` permission projections. Organization and Membership results support all API pages (100 rows per page) through explicit previous/next controls.
- Organization creation remains gated by `organization.create`; first ADMIN selection is an exact email lookup gated by `platform.users.account.read`, and lookup is only shown for its approved Organization creation purpose.
- Membership suspension remains gated by `platform.memberships.lifecycle.manage`, excludes the current Platform subject in the affordance, asks for confirmation, sends CSRF + idempotency + expected membership version + fixed reason code, and trusts only the validated server acknowledgement.
- Services/Health exposes only IAM process liveness under `platform.health.read`.
- Dashboard shows exact Organization `totalItems`, IAM liveness, and the first five items from the fixed bounded audit projection when permissions allow. User/Project counts and non-IAM service readiness are explicitly unavailable.
- Audit displays only the fixed fields from the <=100 record API response. Action/actor/resource/time filters operate locally over that loaded projection; there is no export or raw event view.
- Account and Security show only the current Platform identity, effective current permissions and current session state. Sign-out uses the existing logout route. No bearer or refresh token is rendered or stored by this feature.
- Invalid Organization route IDs are rejected in the UI and query hook without issuing a request or remaining in a pending spinner state.
- The session-query cache handler now recognizes both the Platform identity query and Platform-scoped requests/mutations. When any Platform request loses its session, other private cached queries are cleared, the identity is rechecked once, and the console is hidden while the session is unresolved or failed. The failed `/auth/platform/me` query remains as the terminal error so the route guard can redirect without a retry loop.

## Remaining FE/backend blockers

The following UI groups are present and state the exact missing Platform capability, but have no list/detail/action control that could pretend to succeed:

- User directory/search/filter/detail, ACTIVE/INACTIVE lifecycle, user memberships/effective roles and cross-user sessions: requires Platform-scoped user directory, status, membership projection and session APIs/permissions/audit/QA contract. Current exact-email ACTIVE account lookup is not a directory and appears only in the Organization-create first ADMIN flow, gated by `platform.users.account.read`.
- Organization metadata edits, lifecycle/status and invitations: requires Platform-scoped mutation APIs and audit contract.
- Membership invite/resend/revoke/remove/role change/history: requires Platform APIs beyond current read + suspend.
- Project list/metadata/visibility/access policy: no Platform Project projection/API exists; Organization-scoped Project APIs are not reused.
- Other-user session/security events, service dependencies/diagnostics, Jobs/Queue, RAG/AI, Integrations, Incidents and Support/Diagnostics: no Platform API projection, permissions, audit contract or QA oracle exists. These remain unavailable; no tenant content, job payloads, prompts, secrets or diagnostic output is requested or displayed.

No Configuration UI is included. No BE files, contract, permissions, database schema, dependency, or environment setting were changed by this FE task.

## Validation and review

Validation is recorded after the final implementation pass:

- `npm ci`: completed from the existing lockfile; lockfile remains unchanged.
- `npm run check`: passed on the final implementation; lint and typecheck passed, all 49 Vitest files / 371 tests passed, and the Next.js production build generated all Platform routes successfully.
- Focused Platform Console, pagination, Platform query hook and session recovery tests cover all 14 navigation entries, permissions, active actions, safe unavailable states, local audit filters, invalid IDs, paged API URLs and one-time identity recovery after failures in Platform-scoped endpoints.
- Browser smoke: unauthenticated Platform route redirected to sign-in without a retry loop; sign-in form rendered. An authenticated Platform browser session was unavailable, so rendered authenticated module pages were not manually inspected in-browser.
- Final `git diff --check` passed. The endpoint review found only the listed existing Platform endpoints; no Organization-scoped User/Project API is used by the Platform console. Secret, token, raw tenant-content, job-payload and prompt scans found no implementation matches.

## Change impact

This is FE-only. It adds no database migration or schema change and no environment/configuration change. The app-level session cache error handling is updated to avoid retry loops for the Platform identity query while preserving terminal session failure. Rollback is reverting the FE branch; no data rollback is needed.
