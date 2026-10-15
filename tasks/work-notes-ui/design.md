# Project Work Notes — Design

## Scope

Add a Project-scoped Work Notes workspace at `/projects/[projectId]/work-notes`. Keep the global Organization sidebar unchanged. Use the current TailAdmin visual language, tokens, typography, buttons, borders, dark-mode classes, and responsive patterns. Reference screenshots guide information hierarchy and actions; they are not pixel targets.

## Product model

- Work Notes belong to the selected Project and link optionally to a Work item.
- Select the Member / Leader / Admin view from the signed-in user's `/auth/me.roles`; never let a user change roles from the Work Notes UI. Map `ADMIN` to Admin, `TEAM_LEADER` to Leader, and `MEMBER` to Member, with that precedence if multiple roles are present. If none is recognized, show an error instead of defaulting to Member.
- This PR follows the user-approved temporary `/auth/me.roles` mapping. The BE contract documents those as Organization roles while `TEAM_LEADER` assignments are Project-scoped, so the current response may not identify a Project Leader. Do not treat this FE mapping as authorization; Project endpoints remain the security boundary. A future BE contract is needed for exact per-Project role resolution.
- Work Notes, weekly reports, review actions, and configuration remain local preview state. Do not call an API or imply persistence until a matching BE contract exists.
- Attribute newly created notes and the member's weekly report to the signed-in user's identity from `/auth/me`; preview fixtures for other members remain illustrative.
- Existing Project authorization remains the boundary for viewing content. Leader review actions are limited to mark-as-viewed and knowledge approve/request-changes; Leaders cannot edit member-authored note/report content.

## Navigation and page structure

- Add Work Notes next to Work in the Project section row.
- Use a compact project breadcrumb/header, a non-interactive badge for the authenticated role, and the primary create-note action when the role is Member.
- Shared workspace tabs: Activity, Weekly reports, Knowledge. Admin also gets a distinct Configuration tab.
- Shared filters: search, member, task, note type, week, and attention-only. Keep controls wrap-safe on narrow screens.
- Show a persistent, concise preview notice near the workspace controls so users understand edits are temporary.

## Role variants

### Member

- Activity timeline with work updates, decisions, weekly summaries, and knowledge notes.
- Create Work update, Weekly summary, Knowledge, or Decision; adapt fields by type and optionally link a Project task.
- Convert an activity update to a Knowledge draft without discarding the original update.
- Submit a weekly report with Completed, Unfinished / blocked, and Next week fields.
- See knowledge review status: Pending review, Published, or Needs changes.

### Leader

- Summary cards for blocked tasks, missing weekly reports, knowledge awaiting review, and reports reviewed this week.
- Attention-only filter and mark-as-viewed action on activity updates.
- Weekly report table grouped/listed by member, with read-only report details.
- Approve or request changes on knowledge. No direct editing of member content.

### Admin

- Can review the same Project content views as allowed by existing Project permissions.
- Separate Configuration tab for note templates, weekly reminder schedule, submission rules, knowledge approval flow, and role permission matrix.
- Configuration is a UI preview only and must be labeled as unsaved/unconnected.

## Interaction and accessibility

- Keyboard-operable tabs, filters, cards, and dialogs; visible focus states and semantic labels. The current-role badge is labelled for assistive technology and is not interactive.
- Dialog close returns focus to its trigger; backdrop remains lightly dimmed to match current Work dialogs.
- Statuses use text and icon/shape in addition to color.
- Empty and filtered states explain how to recover; announce local actions through a polite live region.
- Layout uses responsive card columns and contained table overflow rather than page-level horizontal scrolling.
- Support TailAdmin dark mode and logical CSS properties for RTL compatibility.

## Data and API boundary

- Use clearly labeled, illustrative in-memory records only.
- Do not reuse the legacy `/work-notes` capture query API: it models a different global daily-capture feature.
- No matching Project Work Notes / weekly report / review / configuration endpoints were found in the current BE; API wiring is deferred until a contract is available.
- No schema, DB, environment, or dependency changes are in scope.
