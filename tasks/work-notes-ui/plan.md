# Project Work Notes — Plan

## Phase 1: Scope and foundation

1. Confirm the route is Project-scoped and the global Work Notes sidebar remains unchanged.
2. Record the FE-only API boundary and role preview semantics in `design.md`.
3. Add a localized route and link from the Project section navigation.
4. Load the selected Project through the existing authenticated Project query pattern and show standard loading/error states.

## Phase 2: Shared workspace

1. Define preview-only note, weekly report, member, knowledge, and configuration types/data.
2. Implement role preview switcher, shared tabs, preview disclosure, search, and filters.
3. Keep filtering and displayed counts derived from current local state.

## Phase 3: Role views and interactions

1. Member Activity timeline, adaptive note form, task linking, and save-as-knowledge-draft interaction.
2. Member weekly report composer and report submission preview state.
3. Knowledge cards with review statuses.
4. Leader attention metrics, attention-only filtering, mark-as-viewed, member report table/details, and knowledge approval/request-changes.
5. Admin-only Configuration tab with editable local controls and permission matrix.

## Phase 4: Quality and handoff

1. Check responsive and TailAdmin dark-mode styling, focus behavior, labels, and empty states.
2. Run lint, TypeScript check, and production build (no tests unless requested).
3. Inspect complete diff, changed files, Git status/history, generated output, and secrets.
4. Report FE-only/API boundary and exact branch state; do not push unless explicitly requested.

## File map

- `src/app/[locale]/(admin)/projects/[projectId]/work-notes/page.tsx`: localized Project route.
- `src/components/work-notes/WorkNotesWorkspace.tsx`: project loading, shared state, roles and tabs.
- `src/components/work-notes/*`: focused UI panels, dialogs, local fixture data and types.
- `src/components/projects/ProjectOverview.tsx`: Project-scoped navigation entry.
- `src/messages/en.json`: labels and accessible descriptions for the new workspace.
