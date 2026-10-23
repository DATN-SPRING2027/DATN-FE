# Platform Project administration: functional test controls

Open `/platform/projects` in an authenticated PLATFORM session. An Organization
ADMIN or Project TEAM_LEADER session cannot open the Platform console.

Required permissions:

- `platform.projects.project.read`: list/detail and Project member identities.
- `platform.projects.project.manage`: edit name, code and visibility.
- `platform.audit.read`: inspect resulting audit events through the existing Audit page.

## Manual workflow

1. Open Projects and select **Details** for a persisted project.
2. Select **View members**. Test **Search**, the Membership status filter,
   pagination, **Refresh members**, and **Hide members**. Membership status and
   account status are separate columns. Missing accounts display a fallback.
3. Edit **Project name**, **Project code**, and/or **Visibility**. Select an
   **Audit reason**, then **Save metadata**. Name/code edits do not require a
   visibility change. The form sends only changed fields plus expectedUpdatedAt
   and reasonCode. CSRF and request ID headers come from the existing mutation
   client; no bearer token is stored in browser local storage.
4. Confirm the success message, updated project directory/detail and loaded
   version timestamp. Saving unchanged values produces a no-change message
   without another mutation.
5. Open two tabs for the same project. Save different changes in the first;
   attempt the second tab's edit against its older loaded version. The second
   should report a conflict and disable Save until **Reload latest metadata**
   loads the current server version. Review and re-enter the desired changes.
6. For duplicate code, use a code belonging to another project in the same
   organization. The form reports a conflict while retaining the draft.
7. A read-only Platform account can view members but cannot see the edit form.
   Without Project read permission, neither list nor member fetch is enabled.
8. For audit verification, use the existing Platform Audit page with resource
   type PROJECT, the target project ID and action
   `platform.project.metadata.changed`. Authority to read audit is checked
   separately. A successful changed mutation writes a safe audit event; the
   Mongo integration regression tests verify rollback when audit cannot commit.

Network, 401/403, CSRF, 404, stale version, duplicate code and invalid input
errors do not display a success message. Failed saves retain the draft. Member
queries expose a Retry button. Browser form constraints validate required names
and uppercase 2–32-character codes; the backend remains authoritative.

## Automated verification

- `PlatformProjectAdministration.spec.tsx`: uses the real directory/view model,
  query hooks and form controls with a mocked HTTP transport (14 tests).
- `usePlatformProjectMembers.spec.tsx`: safe projection, missing accounts,
  malformed/cross-scope responses and disabled queries (8 tests).
- `platform-project-proxy.spec.ts`: BFF membership filters, cookies, role-header
  stripping, metadata payload, CSRF/request ID and backend result forwarding
  (6 tests).
- Backend: Project Mongo transaction/projection tests, application-boundary
  tests and HTTP authentication/permission/CSRF tests added in
  `codex/platform-project-administration`. See DATN-BE's
  `docs/platform-project-backend.md` for database ownership and API details.

Frontend lint, typecheck and all 777 tests passed on 2026-10-23. These transport
mock tests do not establish that a particular logged-in development user has
Platform permissions. A live unauthenticated request to the local backend
Projects endpoint returned 401. The inspected in-app browser session was a
Development Project Leader account; live Platform read/write verification needs
an existing authorized Platform account, without changing or granting authority
as part of this feature.

Production build also passed (`npm run build`, 2026-10-23). The first build
attempt was stopped after stalling under sandbox restrictions; running the same
build with the required compiler/network access completed successfully. No
application configuration or dependency changes were needed.
