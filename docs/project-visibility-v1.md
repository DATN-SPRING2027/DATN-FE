# Project visibility — completed approved amendment

> **Current-contract note (2026-10-20):** The earlier Admin-only visibility rule below is superseded. Both an Organization ADMIN with the exact Organization-scoped permission and a Project-scoped TEAM_LEADER with the exact Project permission may manage visibility. See `DATN-BE/docs/decisions/project-access-visibility-v1.md` and `research-docs/Workspace/13-project-mvp-contract-v1.md` for the canonical contract.

## Current scope

The requester approved PRIVATE to PUBLIC and PUBLIC to PRIVATE, then authorized
resolving the permission-signal gap to complete the live UI. This supersedes the
initial one-way/no-backend-change scope. References are the latest amendment in
DATN-BE/docs/decisions/project-access-visibility-v1.md and
DATN-BE/docs/openapi/iam-v1.openapi.json.

## Server authority

GET /api/v1/iam/projects/{projectId}/visibility uses exactly the existing PATCH
authorization guard. A 200 returns {canManageVisibility:true}; 403 means denied.
This is a read-only access check, not a mutation probe, and does not create audit
entries. PATCH on the same path accepts only visibility PRIVATE or PUBLIC. Both
directions use `project.visibility.manage` and an ACTIVE OrganizationMembership.
Authorization accepts either an Organization-scoped ADMIN assignment or a
Project-scoped TEAM_LEADER assignment with the permission in its proper scope.
Mutation authorization is checked again inside the MongoDB transaction with audit.
A same-state request returns 409. Archived/cross-organization Projects fail closed.
No new permission, role, persistent field, schema or migration is introduced.

FE disables the action until a fresh API allow response. Role names, titles,
creator/owner labels and client state never authorize it. Denial greys out the
control with a safe message and no Refresh button. Access results are scoped by
Organization/Project, revalidated on focus and not retained after unmount.
User/Organization/Project changes reset the detail UI through its existing keys.

## Live UI

Overview displays authoritative PRIVATE/PUBLIC. Private offers Make public;
Public offers Make private. Each opens a direction-specific confirmation using
the dark, non-blurred Add member backdrop. Making private warns about revocation
of PUBLIC-only metadata access, including possible loss of the actor's own read
access. Content ACLs remain unchanged. Modal supports focus entry/trapping/
restoration and Escape cancellation. Pending requests block dismissal and duplicate
submission; a withdrawn server access signal disables confirmation.

Mutations time out after 15 seconds and are never automatically replayed or queued
offline. Responses are validated before updating caches, with no optimistic success.
Success cancels stale detail reads, updates detail and invalidates lists. PRIVATE
also revalidates detail, hides metadata when read permission is lost and keeps a
success notice separate from the resulting read denial. Late responses update only
the original Project scope. Conflict and uncertain errors offer explicit Refresh
project before another attempt; backend denial displays no false success. Raw server
messages are not rendered. Localized copy lives in the configured en dictionary.

## Tests and verification

ProjectVisibility.spec.tsx exercises the live API-driven control: permission loading,
upfront denial for both states, malformed capability, both confirmations/cancel,
both payloads, success/cache, archived Projects, mutation denial after allow,
conflict/HTTP errors/network/timeout, cross-scope responses, pending protection and
permission withdrawal while the dialog is open.
ProjectWorkspace.spec.tsx adds live-page integration cases for both transitions,
conflict reconciliation, read revocation, rejecting an ADMIN label without API
permission and late responses after Project navigation.
The new BE HTTP test exercises the real guard/policy, read-only allow, permission
absence despite ADMIN labels, reauthorization, both targets, cross-Organization
selectors, archived Projects and expired sessions. Existing MongoDB integration
covers both transitions, denial/conflict and atomic audit persistence.

Browser smoke: on the user's local Chrome session, Development Admin loaded TEST
as PUBLIC, received an enabled Make private action, opened the correct confirmation
with dark non-blurred backdrop and Cancel focus, and cancelled back to unchanged
PUBLIC with focus restored. No live Project mutation was submitted by this work.

Final verification on 2026-10-14: FE npm run check passed all 253 tests, lint,
typecheck and production build. BE lint/typecheck, 25 smoke-safety tests and 469
enabled unit tests passed; production build passed. All 62 enabled e2e tests passed
from a working directory without .env and with infrastructure disabled, including
7 new visibility HTTP cases. The repo-root gate still exposes the existing
missing-JWT test fixture issue: ConfigModule reloads JWT_SECRET from the developer
.env after that test deletes it; no runtime/auth configuration was modified to
mask it. The latest bidirectional MongoDB mutation/audit integration passed using
disposable databases. Five-axis self-review and both git diff --check checks found
no blocking visibility implementation issue. No branch, commit, push or PR was
created in this completion turn.

## Success notification update

Visibility success now uses the existing MemberNotification portal in the top-end
corner, matching Add member (colors, shadow, countdown and dark mode). It dismisses
after four seconds and restarts for each new successful mutation. The inline
success paragraph has been removed. Error/denial feedback remains unchanged.
Live-page tests verify both success messages render in the body portal with corner
positioning; a focused timer test verifies dismissal. npm run check passed lint,
typecheck, all 254 tests and production build after this update.
