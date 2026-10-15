# Work (Task) FE Preview — TODO

## Planning and contracts

- [x] Confirm the latest BE boundary: D-03 persistence foundation exists; active Work API/OpenAPI is absent.
- [x] Record the approved FE-only scope and explicit non-persistence behavior in `plan.md` and `design.md`.

## Route and navigation

- [x] Add localized `/work` Server Component route and render the client workspace.
- [x] Enable the existing Work navigation item and active-route styling.

## Preview model and controls

- [x] Add Work view types, fixed status/priority presentation, and realistic fixture rows.
- [x] Add project-space heading, preview-data indicator, workspace tabs and responsive toolbar.
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

- [x] `npm run check` — passed after review fixes (lint, typecheck, 42 test files / 322 tests, production build).
- [x] Desktop browser accessibility snapshot shows all Overview panels and current preview counts.
- [ ] Overview filter interaction, mobile/dark-mode visual inspection and browser console inspection remain.

## Finish and handoff

- [x] Review keyboard semantics, focus visibility, TailAdmin dark-mode classes, and narrow/wide layout behavior in source.
- [x] Run `npm run lint` — passed.
- [x] Run `npm run typecheck` — passed.
- [x] Run `npm run build` — passed; `/[locale]/work` is included in the route manifest.
- [x] Review full diff and status; no backend, schema, configuration, dependency, or secret changes found.

## Verification boundary

- `npm run check` passed: lint, typecheck, 42 Vitest files / 322 tests, and production build. Focused Work tests cover current-month normalization, Monday-first grid boundaries, date comparison, locale-aware details and clearing a search-only criterion.
- The existing `http://localhost:3000/work` tab was inspected at desktop size before the review fix: the October 2026 Calendar renders a Monday-first month grid with five due-dated sample items and an Unscheduled section; an event opens the shared detail modal with its due date; closing it restores focus; previous-month and Today controls work. The current-date highlight is covered in source and by helper tests but was not visually re-inspected after the fix.
- Earlier Work checks confirmed all Board columns fit, task details open from List and Board, the Create dialog backdrop is light, translations render and the Next.js issue overlay is gone.
- Narrow/mobile viewport, dark-mode calendar appearance, Overview filter interaction and direct browser console-log inspection remain unverified.
- The sample organization, project and work items are illustrative; there is no live API integration or persistence.
