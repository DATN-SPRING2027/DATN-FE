# Platform overview and organization management

## Research and accepted boundaries

These two screens belong to the system administrator (`PLATFORM_OPERATOR`),
with a PLATFORM cookie session. Organization ADMIN does not imply Platform
access. Every server operation remains protected by its existing permission.

Sources inspected: Document's Platform V1 contract, the FE integration handoff,
BE `platform.controller.ts`, `platform-dashboard-overview.service.ts`, the
organization provisioning and metadata mutation code, and the IAM OpenAPI.
The handoff's PARTIAL labels are historical snapshots; current controller and
validated response contracts already expose the operations required here.
No endpoint, payload, lifecycle state, role grant, or database is added.

| Feature | Existing API under `/api/v1` | Required permission |
| --- | --- | --- |
| Overview | GET `/iam/platform/dashboard` | `platform.dashboard.summary.read` |
| Organization list/detail | GET `/iam/platform/organizations[/:id]` | `platform.organizations.organization.read` |
| First manager lookup | POST `/iam/platform/users/lookup` | `platform.users.account.read` |
| Organization creation | POST `/iam/platform/organizations` | `organization.create` |
| Name/slug edit | PATCH `/iam/platform/organizations/:id` | `platform.organizations.organization.manage` |

## Analysis and implementation

The previous dashboard omitted membership totals, mixed service aggregates with
an IAM liveness description, and could show loading/zero or stale counts without
a valid read result. It now shows the four backend totals, their supported
breakdowns, report generation time, nullable service counts, last check time,
and bounded operational activity. Audit unavailability is distinct from an
empty audit projection. Navigation is shown only with the destination's exact
permission. Refresh errors hide stale aggregates; unavailable data is not zero.

The old Organization UI derived detail from a directory row and rendered edit
controls without consistent permission gating. It also closed create on failed
requests. The screen is split into directory, authoritative detail, create,
metadata edit and accessible dialog components using the existing theme,
form/button/modal and pagination primitives.

- The directory uses server pagination. Search/plan filtering is explicitly
  scoped to the current page because the API supports only page/pageSize.
- Organization names are keyboard-accessible links to the detail route.
- Detail uses the GET-by-id projection, rejects invalid ids and does not
  substitute another record or a stale directory row on failure.
- Create requires a verified active-account lookup matching the current email.
  Failed create retains the dialog and inputs; only confirmed success closes it.
  First-manager bootstrap remains the backend transaction's responsibility.
- Successful create invalidates directory, overview and other Platform projections.
- Edit supports only name/slug, not plan or lifecycle. It sends the exact fetched
  `expectedUpdatedAt` plus `ACCESS_REVIEW`, preserving CAS and backend audit.
  409 retains input and requires close/refresh/reopen before a new attempt.
- Dialogs have labels, keyboard focus containment/return, pending state and
  inline errors. Read, create, manage and lookup permissions are independent.

No Organization ACTIVE status is invented from plan metadata. No user account
is created implicitly, no organization is created in a live environment for
verification, and no database migration or seed is run.

## Verification

- `npm run check`: passed (lint, typecheck, 651 tests across 78 files, production build).
- `git diff --check`: passed.
- Regression tests cover authoritative detail, permission-denied cached data,
  keyboard-accessible detail links, create failure/success, lookup email fencing,
  edit CAS/409 handling, refresh, missing service data and dashboard failures.
- Browser access with the existing Development Project Leader session correctly
  leaves the Platform area and returns to the account/organization flow.
  No real Platform operator credentials were used, and no live organization
  create/edit was performed. Authenticated production writes remain unverified.
- No BE or DB change. No commit, push, pull request or merge was performed.
