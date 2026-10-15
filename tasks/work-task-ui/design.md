# Work (Task) Workspace — UI Design

## Design intent

Adapt the supplied Jira-like Work screens to the existing TailAdmin product shell. Keep task information dense and scannable, with restrained borders, white/gray surfaces, the existing brand blue for selected actions, Outfit typography and the current light/dark theme. The reference informs hierarchy and controls; it is not a pixel-for-pixel clone.

This screen is a frontend preview. A visible **Preview data** indicator and copy in the create dialog must make clear that sample tasks and new items are not stored by the backend.

## Page hierarchy

1. Existing admin shell: organization switcher, sidebar, account footer and header stay unchanged. Work is not linked as an organization-level destination.
2. Project detail section navigation sits below the Project header: Overview and Project members keep their current in-page tab behavior, Work links to the project-scoped route, and Activity and Knowledge are shown as disabled until those sections are supported.
3. Context breadcrumb: `Projects / {project name} / Work`; the selected Project name and code come from the existing Project API.
4. Project space header: small “Project space” label, project monogram, selected project name and code, and a compact preview-data badge. Keep membership/options actions absent because no matching Work contract exists.
5. View tabs: Overview, List, Board and Calendar are active views within the same page state. Timeline, Docs and Reports remain unavailable/coming soon and do not navigate to fake screens.
6. Toolbar: search, assignee filter chips, Filter control, Group control, status scope and a Create action.
7. Main content: a filter-aware Overview dashboard, dense List table, responsive status Board or month Calendar.

## Overview view

- Use the supplied Summary screen as a hierarchy reference while retaining TailAdmin spacing, typography, semantic colors, card surfaces and light/dark behavior.
- Show four compact metric cards for total items, completed items, in-progress items, and items without a due date. Calculate every value from the current filtered preview items.
- Arrange the analysis panels in a responsive two-column grid: status distribution, latest-created work items, priority distribution, work-type distribution, team workload, and subtask progress.
- Derive every chart and list from existing Work fixture fields. The latest-created panel uses `createdAt`; task rows open the existing read-only detail modal.
- Do not claim rolling 7-day created/updated counts or show an activity event stream: there is no `updatedAt` field or activity log in the preview contract.
- Keep chart values available as text and use accessible labels; color is a secondary cue. Empty states must remain clear when search or filters remove all items.

## List view

- Desktop columns: selection, Work (sample key plus title), Assignee, Reporter, Priority, Status, Resolution and Created.
- Keep the task key visually distinct and the title readable; make the title/key a keyboard-accessible button that opens the task detail modal. Use initials avatars with names for people.
- Use semantic status labels and icons/shape in addition to color. Use TailAdmin semantic colors for status and priority.
- At narrow widths, preserve the table's column integrity inside a horizontal scroll region rather than squeezing labels into illegible text.
- Selection is local presentation state only. Do not expose bulk mutation actions.

## Board view

- Four status columns: To do, In progress, In review and Done, each with a count.
- Cards open the same task detail modal and show title, project tag, sample key, assignee avatar, and a non-interactive subtasks count affordance.
- Board columns use a responsive grid: one column on narrow phones, two on medium screens and four on wide screens. The Board does not create a horizontal scrollbar or clip the final status column.
- Cards are not draggable and do not imply that status can be saved or changed.

## Calendar view

- Keep the Calendar tab beside List and Board, using the TailAdmin icon, spacing, surfaces, typography, borders and semantic color tokens.
- Use a Monday-first month grid with weekday headings, muted adjacent-month days, a clear current-date treatment, and accessible previous month, next month and Today controls.
- Place each dated Work item on its due date. Event chips show a status indicator and a truncated title; accessible names include the task key, title, status and date. Clicking an event opens the existing read-only detail modal.
- Show undated work items in an “Unscheduled” section below the grid so calendar mode never hides tasks without due dates.
- Calendar consumes the same filtered Work items as List and Board. Month navigation is retained when changing views.
- Keep the grid readable on narrow screens with compact events, and preserve TailAdmin light/dark styles. The calendar is a monthly overview; week/day modes and drag-to-reschedule are out of scope.

## Interactions

| Control | Behavior in this FE preview |
|---|---|
| Overview | Shows summary metrics and breakdowns derived from the current filtered preview items; selecting a listed item opens the shared read-only detail modal. |
| List / Board / Calendar | Switches the view without losing current search/filter state; Calendar also retains its selected month. |
| Task title/key or Board card | Opens a read-only detail modal with the preview fields currently available. Closing it returns focus to the control that opened it. |
| Calendar event | Opens the same read-only detail modal; event date is the local preview due date. |
| Calendar month controls | Previous/next navigates one month; Today returns to the current month. |
| Search | Filters sample keys, titles, assignee names and reporter names client-side. |
| Filter | Opens compact priority and assignee filters; an active count includes these and the separate status scope. |
| Assignee chips | Quickly toggle an assignee filter; keyboard-operable with pressed state. |
| Group | Changes ordering/group headers in List. Board remains grouped by its status columns. |
| Status scope | A separate toolbar select filters both views to the selected status or all statuses. |
| Row checkboxes | Select/deselect preview rows; show a selected count and a clear-selection action only. |
| Create | Opens a labeled preview form with a light backdrop. A valid submit appends one temporary item to local component state, including an optional due date, and reports “added to this preview; not saved.” Reload resets the fixture. |
| Unsupported tabs | Disabled with a visible and accessible “Coming soon” state. |

## Preview data shape

Keep this model local to `src/components/work/`; it is a presentation fixture, not a proposed API DTO:

- `id`, `key`, `title`, `type`
- `assignee` and `reporter` display names/initials
- `priority`, `status`, `resolution`, `createdAt`
- `projectName`, `dueDate` (optional local preview date), `subtasks: { completed, total }`

Populate a small realistic set resembling the supplied sample. Do not create human-readable keys from the backend ObjectId and do not treat the sample organization, project or people as current account data.

## Visual system and accessibility

- Reuse TailAdmin button, table and modal patterns; use theme tokens instead of hardcoded colors or arbitrary pixel values.
- Preserve `dark:` variants and CSS logical properties for directional spacing.
- Use one page-level heading and correctly nested section headings.
- Give icon-only controls accessible names, label every form input, preserve visible focus rings and use native buttons/selects/checkboxes. Detail and create modals use a light dim/blur backdrop, keyboard focus containment and focus return.
- Announce result counts, selection counts, form errors and preview-only create confirmation with status/live regions.
- Do not use color alone to identify status/priority.
- Stack/wrap the toolbar on mobile; keep the List table scrolling inside its own container and reflow Board columns to the viewport; avoid widening the admin shell.

## Empty and feedback states

- A real fixture is present on first render, so normal preview is populated.
- Search/filter with no matches shows a concise no-results state and a clear-filters action.
- Create validation errors remain associated with their inputs.
- Successful preview creation is announced without a backend-success message.
- No loading, permission or server-error state is fabricated for data that is not fetched.

## Exclusions

No backend API calls, persistent mutations, drag-and-drop or drag-to-reschedule, member/project fetching, editable task details, real activity history, rolling time-window metrics, real subtasks, week/day calendar modes, Timeline, Docs, Reports, or authorization decisions are part of this UI preview.
