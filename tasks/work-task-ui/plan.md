# Work (Task) FE Preview — Implementation Plan

## Objective

Build a professional TailAdmin-style Work workspace based on the supplied Jira-like List, Board and Calendar references. The first delivery is a frontend-only preview because the current BE exposes no active Work API or approved Work OpenAPI contract.

## Verified boundary

- BE `origin/main` contains the private D-03 Task persistence foundation, but no Task controller, active runtime registration, or `/api/v1/tasks` OpenAPI path.
- The current foundation stores only Project ID, title, creator, timestamps and version 1, with a creation event. It does not provide the status, priority, assignee, reporter, resolution, or issue key shown in the reference.
- FE therefore uses isolated sample data and local component state. It does not call a guessed endpoint or present local edits as persisted backend data.
- The Work runtime remains a BE follow-up gated by an accountable runtime owner and the migration/seed workflow required by ADR-003.

## Approved scope

- Add Work inside each Project at `/projects/{projectId}/work`; provide its entry from Project detail and remove Work as an Organization-level sidebar destination.
- Provide functional Overview, List, Board and monthly Calendar views over clearly labeled preview data.
- Implement client-side search, status/priority/assignee filters, grouping, view switching and row selection.
- Provide a Create Work Item dialog that adds an item only to in-memory preview state and clearly tells the user it is not saved.
- Add an optional preview-only due date so dated items appear on the Calendar; keep undated items visible in an unscheduled section.
- Match the supplied project-space hierarchy and task fields while using the repository's TailAdmin tokens, typography and components.
- Keep Timeline, Docs and Reports visibly unavailable until their behavior and data contracts are defined.

## Architecture decisions

1. Route: `src/app/[locale]/(admin)/projects/[projectId]/work/page.tsx` remains a Server Component and sets the request locale. `WorkWorkspace` loads the selected Project in the current Organization and remains the client interaction boundary for preview-only Work items.
2. Data: a small typed Work view model and fixture live under `src/components/work/`. The existing Project API is used only to load the current Project context; Work items remain preview-only and do not use an unapproved Task endpoint or browser storage.
3. State: Overview, List, Board and Calendar share one in-memory item collection and the same search/filter state. Calendar month navigation stays in workspace state; a full reload restores the clearly marked sample dataset.
4. Board: columns are fixed to To do, In progress, In review and Done. Cards are not draggable and status is not mutated because no workflow endpoint/contract exists.
5. UI: reuse TailAdmin buttons, table conventions, icons, theme tokens, responsive shell and dark-mode patterns. No dependency or backend change is included.
6. Calendar: use a native Monday-first month grid and JavaScript date arithmetic; keep due dates as local preview fixture data rather than proposing a backend contract or adding a calendar dependency.
7. Overview: derive status, priority, type, assignee and subtask summaries from the existing filtered Work items. Show latest-created items using `createdAt`; do not imply access to an activity stream or rolling update metrics.
8. Copy: add user-facing labels to the existing English message dictionary; English is the only configured locale today.

## Implementation sequence

1. Complete this task specification and checklist before source changes.
2. Add the project-scoped route and the Work entry on Project detail; remove the organization-level Work sidebar entry.
3. Define preview-only Work item types, status/priority display metadata, and realistic sample records.
4. Build the shared workspace header and toolbar, including search, priority/assignee filters, a separate status scope, grouping and Overview/List/Board/Calendar selection.
5. Build the dense responsive List table and status Board from the same filtered collection.
6. Add the preview-only Create dialog and its explicit non-persistence notice.
7. Add due-date fixture data and the month Calendar view, with previous/next/Today controls and task detail links.
8. Add the filter-aware Overview dashboard, using existing fixture values for its metrics, panels and latest-created list.
9. Finish responsive behavior, keyboard semantics, dark-mode styles, copy and verification; update this plan and todo with actual outcomes.

## Acceptance criteria

- `/projects/{projectId}/work` renders inside the existing authenticated admin shell, loads the Project in the current Organization, and exposes a breadcrumb back to that Project.
- Project detail links into its Work view; the Organization sidebar has no Work destination.
- Overview, List, Board and Calendar show the same sample items and respond consistently to search and filters.
- Overview displays total, completed, in-progress and unscheduled counts, plus status/priority/type distribution, team workload, latest-created items and subtask progress from the current filtered items.
- Overview task rows open the shared read-only task detail modal. Labels distinguish available preview fields from unsupported rolling metrics or backend activity history.
- List exposes Work key/title, assignee, reporter, priority, status, resolution and created date.
- Board shows status columns with item counts and cards containing project, key, assignee and subtasks preview.
- Calendar shows a Monday-first month grid, supports previous/next/Today navigation, and places each dated task on its due date; selecting an event opens the shared read-only detail modal.
- The create preview form accepts an optional due date, while undated tasks remain visible outside the month grid.
- Create adds a sample row/card only in current client state and announces that it is not persisted.
- No request is made to an unapproved Task endpoint; no FE role or local state is treated as authorization.
- Unsupported workspace tabs cannot be mistaken for working features.
- The UI follows TailAdmin tokens, is keyboard-operable, responsive, and supports the current light/dark themes.

## Verification

- `npm run lint` — passed.
- `npm test` — passed: 43 files / 324 tests, including Work sidebar removal, Project-to-Work navigation, current-Project context and background refresh behavior.
- Source TypeScript check — passed using a temporary config excluding generated `.next` types. The repository `npm run typecheck` and production build's type phase are blocked by malformed ignored `.next/dev/types/routes.d.ts` and `validator.ts` files while the local Next server is running; production compilation itself succeeded. No generated files or running server process were edited.
- `git diff --check` — passed after this route-scope correction.
- A prior CodeRabbit pass on the Work UI fixed three minor findings: active-locale date formatting, search-only clear action and documented WorkItem subtasks. This route correction was manually reviewed.
- Existing localhost Work tab was visually/accessibly checked at 1624×900 before route scoping: four Board columns fit without horizontal scrolling, translated `Status`/`Type` labels render, and the Next.js issue overlay no longer appears.
- Calendar follow-up: desktop browser showed an October 2026 Monday-first grid, five scheduled sample tasks and one undated task; event opens the existing detail modal with due date, close restores focus, Previous month changes to September, Today returns to October, and the Create dialog exposes an optional Due date field. Review fixes now initialize the grid to the current month and highlight today; date helper tests pass, though the highlight was not visually re-inspected after the change.
- Overview follow-up: the desktop browser accessibility snapshot showed the Overview tab active, four metric cards, status/priority/type/team/subtask panels, and recent work item buttons. Overview-specific browser interactions, small viewport, dark mode and direct console-log inspection remain unverified.
- The new project-scoped route was not visually inspected in a browser; Chrome DevTools MCP is unavailable and the isolated browser has no authenticated local session. Overview-specific browser interactions, small viewport, dark mode and direct console-log inspection remain unverified.
- Do not claim backend integration or persisted Work data.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Preview fields are mistaken for the future BE contract | High | Keep fixture types local to the Work UI and show a visible Preview data/non-persistence notice. |
| Preview Work items look like persisted project data | Medium | Load the real Project context, label sample Work items as preview data, and keep Work-item fixture fields local to the UI. |
| Jira-like controls imply unsupported actions | Medium | Implement only client-side view/search/filter/group/selection and preview creation; keep other tabs unavailable. |
| Preview due dates are mistaken for an approved BE contract | Medium | Keep the date field within the local Work fixture/form and retain the preview-only notice; do not call an API. |
| Dense List table overflows on narrow screens | Medium | Keep horizontal scrolling contained within the List table; reflow Board columns to one/two/four columns by viewport width. |

## Out of scope

- BE endpoints, Task schema changes, database activation, authentication/authorization changes.
- Persistence across reloads, drag-and-drop status transitions, bulk mutations and real member lookup.
- Timeline, Docs, Reports, week/day calendar views, persistent task scheduling, backend activity feed, update timestamps, rolling-period analytics and Epic records.
- New dependencies, merge or approval.
