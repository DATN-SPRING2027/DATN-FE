# Work (Task) FE Preview — TODO

## Planning and contracts

- [x] Confirm the latest BE boundary: D-03 persistence foundation exists; active Work API/OpenAPI is absent.
- [x] Record the approved FE-only scope and explicit non-persistence behavior in `plan.md` and `design.md`.

## Route and navigation

- [x] Add localized `/projects/[projectId]/work` Server Component route and render the client workspace in its selected Project.
- [x] Add a Work entry from Project detail and remove the Organization-level Work sidebar item.
- [x] Load the selected Project using the current Organization context before rendering the Work preview.

## Preview model and controls

- [x] Add Work view types, fixed status/priority presentation, and realistic fixture rows.
- [x] Add project-space heading from the selected Project, preview-data indicator, workspace tabs and responsive toolbar.
- [x] Implement shared search, status/priority/assignee filters, grouping and selection state.

## Views and creation

- [x] Implement the responsive List table with the reference fields.
- [x] Implement the status-column Board using the same filtered sample records.
- [x] Add Create Work Item dialog; append only to local in-memory preview state and show a non-persistence message.
- [x] Open a read-only detail modal from List task title/key and Board cards; return focus to the opener on close.
- [x] Use a light backdrop for both Work modals without changing other application modals.
- [x] Provide explicit empty-search and no-results states; show unsupported tabs as unavailable.

## Calendar view

- [x] Add an optional local due date to Work items, fixture records and preview creation; show the date in task details.
- [x] Add an active Calendar tab and TailAdmin month grid with Monday-first weekdays, adjacent-month dates, previous/next navigation, Today and a current-date highlight.
- [x] Initialize the calendar to the current month instead of a fixed demo month.
- [x] Show dated work on due dates; event activation opens the existing task detail modal.
- [x] Keep undated tasks visible in an Unscheduled section; share current search and filters across all views.
- [x] Verify calendar rendering, task details, month navigation and Today in the desktop browser.
- [ ] Narrow viewport and dark-mode visual checks remain for review.

## Overview view

- [x] Enable the Overview tab and render a TailAdmin-style summary dashboard.
- [x] Derive metric cards, status/priority/type breakdowns, team workload and subtask progress from the shared filtered preview items.
- [x] Add a latest-created items panel using `createdAt`; wire item buttons to the shared detail modal.
- [x] Keep summary values accessible and avoid implying rolling activity metrics or BE-backed data.
- [ ] Verify Overview updates with shared filters and fits desktop/mobile and light/dark layouts.

## Overview verification

- [x] Earlier `npm run check` checkpoint — passed before project scoping (lint, typecheck, 42 test files / 322 tests, production build).
- [x] Desktop browser accessibility snapshot shows all Overview panels and current preview counts.
- [ ] Overview filter interaction, mobile/dark-mode visual inspection and browser console inspection remain.

## Finish and handoff

- [x] Review keyboard semantics, focus visibility, TailAdmin dark-mode classes, and narrow/wide layout behavior in source.
- [x] Run `npm run lint` — passed.
- [ ] Run the standard `npm run typecheck` — blocked by malformed ignored `.next/dev/types/routes.d.ts` and `validator.ts` while the local Next server is running; source TypeScript check passed with a temporary config excluding generated `.next` types.
- [ ] Complete `npm run check` — tests passed (43 files / 324 tests) and production compilation passed, but standard type checking fails on the same generated `.next/dev/types` syntax errors.
- [x] Review full diff and status; no backend, schema, configuration, dependency, or secret changes found.

## Verification boundary

- Before this route-scope change, `npm run check` passed with 42 files / 322 tests. After the change, lint passed, the full suite passed with 43 files / 324 tests, and a source-only TypeScript check passed; standard typecheck/build type validation are blocked by malformed ignored `.next/dev/types` generated while the local Next server is running.
- The previous `http://localhost:3000/work` implementation was inspected before route scoping. Use `/projects/{projectId}/work` for subsequent browser checks; the project-scoped route has not yet been visually inspected.
- Earlier Work checks confirmed all Board columns fit, task details open from List and Board, the Create dialog backdrop is light, translations render and the Next.js issue overlay is gone.
- Narrow/mobile viewport, dark-mode calendar appearance, Overview filter interaction and direct browser console-log inspection remain unverified.
- The sample organization, project and work items are illustrative; there is no live API integration or persistence.
