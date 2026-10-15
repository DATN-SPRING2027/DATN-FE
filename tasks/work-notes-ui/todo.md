# Project Work Notes — TODO

## Scope and docs

- [x] Inspect current Project and Work route patterns and existing TailAdmin components.
- [x] Verify Work Notes BE contract boundary; document FE-only preview behavior.
- [x] Record role views, shared filters, route, accessibility, and API boundary in `design.md`.
- [x] Record implementation phases in `plan.md`.

## Project navigation and workspace

- [x] Add localized `/projects/[projectId]/work-notes` route.
- [x] Add Work Notes beside Work in Project section navigation.
- [x] Load Project context and render standard loading/error/unauthorized states.
- [x] Add role preview switcher and shared Activity / Weekly reports / Knowledge tabs; Admin Configuration tab.
- [x] Add preview disclosure and shared search/member/task/type/week/attention filters.

## Member experience

- [x] Implement Activity timeline and note creation for four note types with conditional fields.
- [x] Support optional Task link and local conversion from work update to knowledge draft.
- [x] Implement weekly report form with completed, unfinished/blocked, and next-week sections.
- [x] Show knowledge review statuses.

## Leader experience

- [x] Show blocked work, missing reports, pending knowledge, and reports reviewed metrics.
- [x] Implement attention-only filter and mark-as-viewed action.
- [x] Show weekly reports by member with read-only details.
- [x] Implement local approve/request-changes actions for knowledge; no member content editing.

## Admin experience

- [x] Add separate Configuration tab with templates, reminder schedule, submission rules, approval flow, and role permission matrix.
- [x] Label configuration controls as preview-only and unsaved.

## Finish and handoff

- [x] Review keyboard/focus/dialog behavior, accessible status labels, responsive classes, and dark-mode classes in source.
- [x] Run lint, typecheck, and production build; tests were not run because they were not requested.
- [ ] Manually inspect rendered light/dark and narrow-screen states in an authenticated browser.
- [x] Review final diff, changed paths, Git status/history, and check for secrets/generated files.
- [x] Summarize branch, commit, checks, API/database/config/security impact, and remaining risks.
