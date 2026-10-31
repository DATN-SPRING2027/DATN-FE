# Mind Map review corrections — 2026-10-31

Scope: follow-up fixes for PR #115 at `232bb15`, requested by Thang after the
cross-repository review of FE #115, BE #121 and SAG #55. The paired SAG change
ranks topic evidence before the per-document cap. BE #121 has no changes in
this correction.

## Corrected behavior

- Unmount the Mind Map panel as soon as the workspace receives a Project/auth
  access error. Removing a QueryCache entry alone does not hide the result
  retained by an already-mounted disabled query observer.
- Capture the query entry at mutation start. Success/error callbacks may write
  or clear cache only while that same entry remains present. Logout, access
  revocation, or a newly created session entry invalidates the old request, even
  after unmount. A late error cannot purge the new session's maps either.
- Fit uses the actual viewport/tree ratio, including scales below 40%. Manual
  zoom can return to that fit scale without jumping back to the old minimum.
- Register a native non-passive wheel listener and remove it on unmount so
  Ctrl/Cmd+wheel can cancel browser zoom without a passive-listener warning.

## Regression checks

- RED before the fix: seven new FE cases failed (access-error unmount, late
  success after logout/revocation, late error in a new session, two fit sizes,
  and cancelable wheel/cleanup).
- GREEN after the fix: all 19 focused workspace/hook/canvas cases passed.
- `npm run check` -> **passed**: lint (zero errors, five pre-existing unused
  variable/import warnings in `ProjectDocumentsWorkspace.tsx`), typecheck,
  **1,068 tests**, and the Next.js 16.3.4 production build.
- The first isolated build rejected a cross-drive dependency junction.
  Dependencies were copied locally without changing the lockfile, after which
  the complete quality gate passed.
- CodeRabbit follow-up raised **one minor UX suggestion**: forget the open-panel
  preference after access recovery. The render guard immediately unmounts on
  access loss; after recovery the cleared scope is regenerated through the
  authorized backend. Retaining the user's open-panel preference is intentional,
  so this optional behavior change was not applied. It does not permit stale
  request callbacks to repopulate cache; those are independently guarded and
  regression-tested.

## Browser evidence

Actual React components and theme CSS were exercised in an isolated Chrome
harness with explicitly labelled fixture data. No backend responses were
mocked in production code. This is component QA, not live FE/BE/SAG acceptance.

| Viewport | Before | After |
| --- | --- | --- |
| 375px | [Before](mind-map-review-qa-assets/before-375.png) | [After](mind-map-review-qa-assets/after-375.png) |
| 768px | [Before](mind-map-review-qa-assets/before-768.png) | [After](mind-map-review-qa-assets/after-768.png) |
| 1280px | [Before](mind-map-review-qa-assets/before-1280.png) | [After](mind-map-review-qa-assets/after-1280.png) |
| 1440px | [Before](mind-map-review-qa-assets/before-1440.png) | [After](mind-map-review-qa-assets/after-1440.png) |

For a supported 57-node tree in a 300px-high docked canvas, 49 nodes were
outside the viewport before correction; zero were outside after correction at
all four widths. Ctrl+wheel no longer emitted the passive-listener warning.
The panel harness covered loading, empty, success, validation error, server
error, permission denied, fullscreen open/Escape close, and long text at 375px
and 1440px, plus success at 768px/1280px. No horizontal page overflow, uncaught
JavaScript exceptions, or failed fixture requests were observed.

## Impact and limitations

No API, database schema, migration, dependency, environment, or stored
credential changes. Server authorization remains unchanged. Revert the fix
commit to roll back these UI/cache corrections. The local BE/SAG services were
not running, so real login, live model generation and end-to-end source
authorization still require service-backed acceptance.
