# Member / Manager / Leader permission audit

Follow-up: [Codex review and live role QA, 2026-10-25–26](role-permission-review-qa-2026-10-26.md)
supersedes this initial record's validation counts and signed-out browser
limitations. It records the additional fixes, real authorized role sessions,
reversible Development fixture writes and remaining unexecuted scenarios.

## Scope and execution plan

User request: audit and fix visibility and authorization for Member, Manager and
Leader, including Settings and feature actions. FE and BE are in scope. Existing
accepted policies and API contracts define permissions; this task does not grant
new privileges, change schemas, seed roles, or change authentication mechanics.

Baseline after `git fetch origin` (clean working trees):

- FE: `2954e7df6523bc209cade905ff144bb18f2e6d1f`;
  branch `feat/Danh-role-permission-audit-fe-ui`.
- BE: `026fca536f625430d66d07ed6b11ca27830b6e7a`;
  branch `feat/Danh-role-permission-audit-be-api`.
- Docs: `b08110f88f48599484e400e3bdb3386466ebfadb`;
  branch `feat/Danh-role-permission-audit-docs` (created after the scoped policy
  decision below).

Plan:

1. Trace current role sources, scopes, navigation, routes, action controls and
   server enforcement. Distinguish current contracts from historical research.
2. Cover confirmed defects with failing regression tests.
3. Fix shared permission decisions and the affected consumers. Denied, revoked,
   unknown and failed permission probes must not reveal administrative controls.
4. Audit Organization, Project, Team, Task, Work Notes, Documents, Reports, Chat,
   Notifications and Platform boundaries; test negative and cross-scope cases.
5. Run FE/BE configured checks and diff checks. Browser-check reachable routes
   using an existing authorized session; record unavailable role sessions.
6. Record changes, test evidence and remaining limitations below.

## Current contract matrix

Technical identifiers stay unchanged: Manager = organization `ADMIN`, Leader =
project `TEAM_LEADER` (`LEADER` is a display/DTO alias), Member = `MEMBER`.
Platform authority is separate and cannot be inferred from these roles.

| Function                                                        | Member                                          | Manager                                                           | Leader                                              |
| --------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Personal profile / preferences                                  | Own account                                     | Own account                                                       | Own account                                         |
| Organization settings / membership administration / invitations | Denied                                          | Current organization, current server authority                    | Denied by leadership alone                          |
| Create Project                                                  | Active organization membership                  | Active organization membership                                    | Active organization membership                      |
| Read Project                                                    | Approved discovery/membership scope             | Approved manager metadata scope; feature contracts govern content | Assigned Project scope                              |
| Update Project name / description                               | Denied                                          | Denied by organization role alone                                 | Matching active Project role + `project.update`     |
| Project visibility / membership actions                         | Read member list where permitted; no management | Explicit permission in current organization                       | Matching active Project role and action permission  |
| Appoint / revoke Project Leaders                                | Denied                                          | `project.leader.manage`                                           | Denied by leadership alone                          |
| Team management                                                 | Server Team permissions                         | No implicit Project leadership                                    | Current server Team permissions in matching Project |
| Tasks / notes / documents / reports                             | Ownership, membership and response permissions  | Current feature contract and response permissions                 | Matching Project and response permissions           |
| Platform Console                                                | Denied                                          | Denied by organization role alone                                 | Denied by project role alone                        |

Sources: `product_docs/research-docs/02_ACTORS_ROLES_AND_PERMISSIONS.md`,
current BE `authorization.policy.ts`, Organization membership policies,
Team policies, and the accepted Workspace / Work Notes contracts. Older research
that says guards do not exist or that Project creation needs `project.create`
does not describe this baseline.

## Initial findings before implementation

The following is the plan-time snapshot. Its pending statuses are superseded by
the execution results below.

| Finding                                                             | Effect                                                                                                           | Correction / evidence |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| Project Settings links and tabs are unconditional                   | A Member sees Leader/Manager settings, including read-only administrative forms                                  | Pending               |
| Header infers Project leadership from unscoped session role strings | A role name can produce leadership UI without proof for the current Project                                      | Pending               |
| `/auth/me` returns organization roles from the access token         | A demoted Manager can retain old role UI and affect feature consumers that trust `/auth/me` until token rotation | Pending               |
| Sidebar consumes cached identity even after access is rejected      | Administrative navigation may remain visible after access loss                                                   | Pending               |

## Execution results

All eight confirmed defects were corrected:

1. Project sidebar links, tabs and direct Settings content now require the
   existing scoped settings/visibility probes. Member, denied and unknown
   permission states do not render administrative forms.
2. Header Leader tools use the current Project's server decision and link to
   that Project. Unscoped `TEAM_LEADER`/`LEADER` strings confer no UI authority.
3. `/auth/me` resolves current Organization roles rather than returning token
   issuance-time roles. Invalid/mismatched Organization resolution is rejected;
   Project and display role codes cannot become Organization roles.
4. Sidebar discards identity data after access denial before deriving Manager
   destinations.
5. Task IAM authorization requires the current Organization assignment and active
   membership. The stale `identity.roles.includes('ADMIN')` fallback was removed.
   Accepted G4 Manager Task access is preserved.
6. Task/Subtask UI reflects current Project scope and creator/assignee ownership.
   Other actors' items are read-only in inline controls, detail and bulk mutation;
   Board dragging/status and Sprint completion respect the same role boundary.
7. Team management UI requires effective leadership of the matching Project.
   Create/edit routes and create/archive/restore actions no longer appear merely
   because an actor can open the route or has an Organization Manager label.
   Backend Team permission checks remain authoritative.
8. Organization role/membership and Project Leader/member mutations invalidate
   identity, Project summaries and scoped permission probes as appropriate.

Regression tests reproduced navigation leakage, stale roles, Task Manager
fallback and missing cache invalidation before correction. New tests cover
Member denial, current Manager authority, matching/cross-Project Leader,
inactive membership, cross-Organization resolution, failed/revoked permission
probes, direct Settings/Team URLs, and Task/Subtask read-only behavior.

Runtime code adds no role, endpoint, API payload, schema, migration or dependency.
`readOnly` is a projection of current context rather than a saved authority
snapshot; BE guards remain the enforcement boundary.

### Manager content review decision

The audit found a conflict between the generic confidential-content baseline and
the existing Work Notes runtime. On 2026-10-25 the user explicitly confirmed:
“Có; Manager được đọc/review mọi Project trong Organization”. A current Manager
may therefore read/review Work Notes and Project Documents in any active Project
of the current Organization without Project Membership. This does not grant
cross-Organization, Team or Project Leader authority, or redefine unrelated
content/configuration permissions.

The decision is recorded in product_docs `02_ACTORS_ROLES_AND_PERMISSIONS.md`
and `04_WORK_NOTE_WORKFLOWS.md`. The existing runtime behavior was retained;
regressions now exercise an actual `ADMIN` identity without Project Membership
and deny a different Organization. A misleading older test description claiming
to test an ADMIN while supplying no ADMIN role was corrected.

## Feature coverage

The table records source and automated-test coverage, not authenticated browser
acceptance.

| Feature / routes | Current authority reviewed | Result |
| --- | --- | --- |
| Shell, header, sidebar | Current identity, Organization role, scoped Project probes | Navigation leaks fixed |
| Dashboard, Organization settings/members/invitations/role actions | Organization read/command services, repository authority, FE guards | Manager boundary retained; authority cache revalidation fixed |
| Projects list/create/overview | Active Organization membership and approved Project read/create policies | Member creation remains allowed; no Manager-only creation restriction added |
| Project Settings | `project.update`, `project.visibility.manage`, active scope, explicit deny | Member UI hidden, direct route denied, editable sections retain separate server checks |
| Project membership and Leader appointment | ProjectAccessAuthorizationGuard and per-action permission | Read, add/remove and appoint remain distinct; permission probes revalidate after mutations |
| Team routes and lifecycle | TeamAuthorizationPolicy, active memberships, explicit deny, `team:children.manage` | Administrative UI fixed; Manager alone is not Project Leader |
| Workspace, Tasks, Subtasks, Sprint | Current IAM assignment, accepted G4/G7 contract, creator/assignee policy | Stale Manager fallback and UI action leakage fixed |
| Work Notes, Documents, Reports | WorkNotesAuthorizationService/WorkNotesService, response permissions and author/reviewer rules | Existing ownership/review/configuration checks retained; fresh identity roles remove stale Manager authority from these consumers |
| Chat, realtime, attachments | Actor, Organization and conversation membership in Chat services/repository | No additional confirmed defect in reviewed paths; existing scope/negative tests pass |
| Notifications | Authenticated recipient identity, recipient-filtered reads/mutations, cookie CSRF | No additional confirmed defect in reviewed paths; existing suites pass |
| Platform Console | Separate Platform context and explicit Platform permission guards | Organization roles do not grant Platform access; existing suites pass |
| Profile/preferences, sample utilities | Self/account scope or authenticated static sample UI | No new administrative permission inferred; public Landing/sign-in source files unchanged |

## Validation record

- BE `npm run check`: PASS, including lint, typecheck, Organization role
  reconciliation planner tests, development DB safety tests, unit tests, E2E and
  production build. Unit: **1,454 passed / 135 skipped**, 153 passing suites and
  14 skipped suites. E2E: **108 passed / 4 skipped**, 14 passing suites and 2
  skipped suites. Conditional Mongo/integration skips were not counted as run.
- FE `npm run check`: PASS. Lint, typecheck, **852 tests** across **121 suites**,
  and production build passed on the final runtime source.
- Live FE `/signin`: HTTP 200; BE `/api/v1/health`: HTTP 200.
- FE/BE `git diff --check`: PASS at source review; repeated after this record.
- No dependency installation, migration, seed, or account-data mutation.

## Authenticated browser acceptance remaining

The available browser is signed out at `http://localhost:3000/signin`.
Historical role fixtures belong to a disposable QA environment and are not
current login sessions. No Member/Manager/Leader visual PASS is claimed.

With authorized sessions, verify these desktop/mobile scenarios:

1. Member cannot see Organization administration or Project Settings; direct
   URLs show denial. Own/assigned Tasks remain editable; other Tasks/Subtasks
   are read-only and Sprint completion is absent.
2. Manager sees current Organization administration and accepted Manager
   Task/Report actions. Organization authority does not imply Project metadata
   editing or Team leadership.
3. Leader manages only the matching Project. Another Project or Organization
   must not inherit Settings, Team or Task authority.
4. Revoke/downgrade a role or membership through the approved workflow, then
   revalidate navigation, open routes and direct API writes. A hidden button is
   not evidence of server enforcement.
5. Exercise keyboard/mobile navigation, permission errors and concurrent scope
   changes using isolated authorized test data.

## Delivery state

Changes are local on the three task branches above, based on fetched `origin/main`.
No commit, push, PR approval or merge has occurred. The scoped business decision
above is not a PR approval. No `.sage` configuration,
repository safeguard, populated environment file, public auth page, schema or
historical migration was modified. PR review remains a handoff step. Working
trees were clean at task start; no unrelated changes were discarded.

The documentation repository's mandatory pre-PR review refers to the
`code-review-and-quality` skill (`product_docs/AGENTS.md`, Mandatory
post-implementation review gate). It is absent from the installed skill catalog,
the local skill roots and the project skill search. A manual final-diff review
can be recorded here; invocation of that required skill is still a PR gate,
and this record does not claim that gate passed.
