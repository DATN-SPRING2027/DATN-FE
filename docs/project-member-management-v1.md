# Project member management V1 — frontend

## Scope and entry point

Open a Project detail page and choose **Project members**, or visit
`/projects/{projectId}/members`. The route remains inside the localized admin
shell and uses the current authenticated Organization context through the BFF.
This change does not add backend operations, schema, migrations or permission
provisioning.

The accepted references are DATN-BE's
`docs/decisions/project-access-visibility-v1.md` and
`docs/openapi/iam-v1.openapi.json`. Historical Workspace membership research is
not used to invent endpoints or additional fields.

## Accepted operations

| Action | Backend operation                                                    | Request/result                                                                  |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| List   | `GET /api/v1/iam/projects/{projectId}/memberships`                   | `page`, `pageSize=20`, optional `status`; membership projection plus pagination |
| Add    | `POST /api/v1/iam/projects/{projectId}/memberships`                  | Body contains only `userId`; successful membership response                     |
| Remove | `DELETE /api/v1/iam/projects/{projectId}/memberships/{membershipId}` | Confirmation required in UI; `204` has no JSON body                             |

Browser requests use the existing `/api/backend/iam/...` BFF. Membership rows
show only the documented User ID, membership status and joined timestamp.
There is no user-directory dependency, profile lookup, role editor, membership
PATCH, leader appointment or visibility mutation. Inactive records remain
visible in the appropriate filter; only active records offer removal.

Resource IDs are opaque according to the accepted OpenAPI. FE rejects missing
or whitespace-only inputs and encodes path segments; BE validates storage
format, eligibility, membership state and scope.

## Authorization presentation

The accepted response schemas do not include an upfront action-permission
projection. The FE therefore uses the documented responses themselves:

- Before a mutation response is known, the control permits submitting an action
  for server evaluation. It does not represent a local authorization grant.
- A list success never grants add/remove permission. A denied list does not
  infer denial of the independent add action.
- A `403` locks the corresponding add/remove control and displays an explicit
  denial. A denied list is shown as an error, never an empty list.
- **Check access again** clears previous mutation results and refreshes the
  list. The next requested mutation is independently reauthorized by BE; this
  button does not assert that its permissions have been granted.
- No role code, title, Project visibility or creator identity is used for
  authorization. The server remains authoritative for every request.
- Organization ADMIN does not implicitly gain Project member management.
  Archived Projects and invalid/inactive memberships remain subject to BE's
  fail-closed decisions.

This provides response-driven controls within the accepted FE-only scope.
If a future requirement is to hide or enable actions based on permissions
_before the first attempt_, it needs a separately accepted server permission
projection. This implementation does not fabricate such a field or endpoint.

## Errors, state and concurrency

The UI handles loading, success, empty results, permission denial, expired
session, unavailable scope, validation, conflict, rate limiting, server failure,
network errors and timeouts. The leader-removal conflict explains the existing
backend safeguard without exposing appointment actions. Server error messages
are mapped to localized safe copy.

Requests time out after 15 seconds. Mutations are not automatically retried or
queued offline. A network failure may leave server outcome unknown; the UI asks
the user to refresh the list before repeating a change. Pending actions block
duplicate submissions; successful changes invalidate only the Project's
membership queries. Failed adds preserve input.

Query keys include Organization, Project and filters. Components reset their
local state when the authenticated user, Organization or Project changes.
Rows are hidden while refetching and on errors, including a denial following a
previous successful fetch. Response projection and scope are validated before
rendering. Membership caches are not retained after their final observer
unmounts.

Removal confirmation uses the existing modal with focus transfer, a keyboard
focus loop, Escape cancellation and focus restoration.
Theme tokens, existing TailAdmin form/table/button/card components, localized
copy and logical directional utilities are reused. The table has its own
horizontal scroll area on narrow screens.

## Verification

Automated coverage lives in:

- `src/components/projects/members/ProjectMembers.spec.tsx`
- `src/lib/queries/projects/useProjectMembers.spec.tsx`

Coverage includes successful list/add/remove; independent denied actions;
Organization/Project scope changes and errors; malformed responses; local and
server input validation; archived Project denial; conflict; rate limiting;
expired session; network/server failures; mutation concurrency; preserving
input; filter/pagination; and keeping unsupported operations out of the UI.

Browser smoke testing uses an isolated in-memory localhost API fixture. It
verifies successful add, confirmed remove, add denial, keyboard focus and
responsive layout. It does not test a live backend database or production
permission provisioning. Run `npm run check` for lint, typecheck, all tests and
production build.

Final local verification on 2026-10-13: `npm run check` passed lint,
typecheck, all 204 tests and production build. The 35 member-management tests
also passed after a mutation experiment: changing the denial check from `403`
to `402` made the denied-add control test fail; the original source was restored
byte-for-byte before rerunning the tests. Browser checks at 375px and 1440px
passed, including dark mode, with no console errors. Final review found no
blocking correctness, architecture, security or performance issues within this
FE-only scope.

Git handoff: the existing checkout is
`feat/Tien-project-member-management-fe-ui`, based on `origin/main` at
`f6380a4`. This completion turn did not create or switch branches, stage, commit,
push, create a PR or merge. All changes remain local for the user's review.

## Reference layout update

The member page now follows the supplied reference's list-and-detail layout:
member selection cards on the left, selected membership information on the
right, a status accent card, the existing add form, and a current-page records
table. Initial markers are derived from opaque User IDs; no profile photograph,
name, email, role or additional API is fabricated. Selection uses the already
loaded page and does not make a backend request. Remove remains an explicit
confirmed action for the selected active membership. On narrow layouts the
panels stack; the records table retains its own scrolling area.

The existing application sidebar/header, TailAdmin components, theme tokens,
backend operations, payloads, query hooks and authorization presentation are
retained. This visual update creates or switches no branches and performs no
stage, commit, push or merge.

Reference-layout validation: `npm run check` passed lint, typecheck, all 205
tests and production build. Browser smoke checks passed selection, add and
confirmed removal with the isolated fixture. Desktop 1440px, mobile 375px and
dark mode were inspected; mobile document width stayed at 375px and the browser
reported no console warnings/errors. A deliberate regression that ignored the
selected membership failed the new selection test; original source was restored
byte-for-byte and all 29 UI tests passed again. Final local review found no
blocking issue with this visual update.

## Stitch HTML adaptation

The supplied Stitch HTML is a visual reference. Its inline JavaScript, mock
members, administrative-role assumptions, token protocol, GPU/session telemetry,
policy expiry, audit events and compliance downloads are not production
contracts and were not imported. The page reuses the existing application shell
and TailAdmin components with a unified canvas, status filter buttons, current-
page User ID search, a selected-member header, membership details/overview,
status summary, existing add form, safeguards and current-page records table.
Only documented membership fields and accepted business rules are shown.
Searching filters already loaded User IDs and does not add a backend operation.
The remove confirmation now uses the existing Modal and useModal, including
keyboard focus, Escape cancellation and pending-request protection.

Stitch adaptation validation: `npm run check` passed lint, typecheck, all
207 tests and production build. The browser fixture confirmed current-page
search, the selected membership details, modal focus looping and Escape
cancellation without removal. Desktop 1440px, mobile 375px and dark mode were
inspected; the mobile document stayed at 375px with a separate horizontally
scrollable records table. No browser console warnings/errors were reported.
A deliberate mutation disabling search filtering failed the search regression
test; source was restored byte-for-byte and all 31 member UI tests passed again.
Final review found no blocking issue. Backend code, membership API operations
and payloads remain unchanged. No branch creation/switch, staging, commit or
push was performed for this adaptation.

## Remove optional introduction panel

Removed the page introduction header, Project details link, Project ID subtitle
and always-visible permission explanation at the user request. These are not
required by the member-management task. Check access again now appears only
after an operation error, preserving recovery from denied actions. API calls,
backend authorization, member controls and payloads are unchanged.

## Inline Project detail tab

Project members now switches the content beneath the Project detail tabs,
using the existing member component. The Project URL stays unchanged; Overview
remains available and membership data is loaded only when its tab is selected.
Tabs support arrow keys, Home/End and associated tab panels. No backend, API
operation or payload changed. `npm run check` passed all 208 tests and build;
browser fixture checks confirmed switching both ways without navigation.
A deliberate reversed-panel mutation failed the new tab regression test; the
source was restored byte-for-byte and all 39 Project workspace tests passed.

## Table layout reference update

The member tab now follows the supplied table layout: current-page User ID
search, an ACTIVE/INACTIVE status dropdown, membership rows with initials,
status badges, UTC join dates and explicit Remove actions, followed by the
existing Add form. Selecting a User ID reveals its existing membership details.
Removed decorative summary/safeguard/record cards stay removed. No fabricated
profiles, role editing, access-level claims, invitations or new API operations
are introduced. The misleading All filter was removed because the backend
defaults omitted status to ACTIVE; both supported filters send explicit status.

`npm run check` passed lint, typecheck, all 211 tests and production build.
The new row-action test verifies removal uses the selected membership ID; a
deliberate wrong-row mutation failed it and source was restored byte-for-byte.
Desktop and mobile layouts were inspected using an isolated fixture; mobile
keeps the document at 375px and scrolls the 672px table independently. Browser
fixture removal targeted the expected row; no console warnings/errors appeared.
The API hooks and backend remain unchanged.

## Project members dashboard reference

The project header now keeps only the Overview and Project members tabs. The
Members tab shows summary cards, current-page search, a disabled role filter, a
status filter backed by the supported ACTIVE/INACTIVE query, and a table with
User name, User ID, project membership, project scope, status, join date and
remove action. The membership response has no user name, so that cell displays
an em dash; the FE does not call the separate organization directory API. The
top Add member action opens the Members tab and displays the existing User ID form
in a centered dialog with the User ID field focused. The dialog is hidden until requested. Sharing, role
filtering and bulk selection remain disabled because the accepted Project
member contract does not support them. Unknown access counts use an em dash; no
mock users, profiles, roles or permissions are mixed into API results. No
backend files, endpoints or payloads changed.

`npm run lint`, `npm run typecheck`, and the Project member/workspace suites pass
(73 tests). A production build was not rerun; an earlier attempt produced no
output for more than two minutes and was stopped.
