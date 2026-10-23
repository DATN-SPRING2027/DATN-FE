# Workspace Work task remediation plan

## Baseline and boundary

- Review basis: FE PR #69 at `19ccadc` and BE PR #86 at `d418ccc`, fetched on 2026-10-23.
- The FE task branch starts from current `origin/main`, then includes FE PR #69. The existing uncommitted Work task patch was copied into this isolated worktree for validation; the original checkout is untouched.
- BE PR #86 is available locally on `feat/Thang-workspace-api-audit-be-api` at `6c66e50`; this remediation has not added BE or database changes.
- Use the approved `/api/v1/tasks` contract in BE `docs/workspace/04-api-inventory.yaml`. Do not make a successful-looking local mutation when the server rejects it.
- FE and BE changes, and any database migration, require separate branches and review. No automatic push or merge.

## Delivery slices

### 1. Work task data integrity (highest priority)

- [x] Save and reload parent and subtask comments/worklogs from the Task API. Preserve full timestamps and author identity.
- [x] Accept only 1–1440 whole minutes; provide quick duration choices and a clear validation/error state. Keep the form values on request failure.
- [x] Load full parent/subtask detail including description and checklist before editing. Generate unique checklist IDs after deletion/reload.
- [x] Preserve exact backend status including `BLOCKED` for transitions; handle cancellation with children without hiding them.
- [x] Show loading, empty, 403 and retryable server errors for task list/detail/activity; load comments/worklogs beyond the first page.
- [x] Load real task history. The All tab shows fetched comments, history and worklogs in timestamp order.
- [x] Add regression tests for persistence, invalid durations, failed requests, status conflicts and checklist IDs.

### 2. Work task actions and navigation

- [x] Make row Log work open the real worklog form and remove hardcoded success messages/times.
- [x] Disable subtask reorder for real tasks until an approved ordering contract exists.
- [x] Keep Create another open after success; support task deep links and title edits; fetch every project-member page for assignee choices.
- [x] Replace misleading task deletion with confirmed cancellation; keep cancelled tasks visible and report the actual result.
- [x] Remove misleading preview labels from live task views and translate new copy in configured locales.

### 3. Other Workspace modules

- [x] Keep Sprint actions unavailable for live projects until the Sprint API is wired; the affected Timeline view is clearly marked preview-only.
- [x] Mark Timeline, Reports, Docs, Forms, Development and AI as preview-only/disabled for live projects until their approved data contracts exist; hide preview-only automation and AI actions on persisted tasks.
- [x] Hide filename-only CSV import for real projects; full parse-and-create flow remains to be implemented.

### 4. Backend/runtime and verification

- [x] Confirmed the BE PR branch registers `TaskWorkspaceModule` in the monolith and `GatewayTaskWorkspaceController` in `GatewayModule`.
- [ ] Resolve the split-runtime gap in a separate BE change: Helm deploys no Task workspace service and does not set `TASK_SERVICE_URL`; the standalone Task entrypoint currently loads the legacy `TaskRuntimeModule`, not `TaskWorkspaceModule`. Follow BE runtime/security gates before wiring deployment.
- [x] Run FE `npm run check` (lint, typecheck, 102 test files / 750 tests, production build) and BE `npm run check` (passed on the BE audit branch).
- [ ] Browser interaction checks with an authenticated live API at 375, 768, 1280 and 1440 px, including console and failed requests. Isolated visual QA captured all four widths but redirected to the session-unavailable page because no authenticated session was available.
- [x] Inspect the final diff, run secret/debug-output scans, confirm no DB/config/security files changed, and complete a five-axis self-review. `git diff --check` passes.

## Acceptance

1. A comment and worklog on a parent or subtask remain after refresh, show author and local date/hour/minute, and match API records.
2. Invalid or failed Work log submissions cannot produce a success entry or clear the user's input.
3. Existing checklist entries survive a subtask edit and IDs remain unique.
4. Blocked tasks can be viewed and transitioned without a false `fromStatus` conflict.
5. Empty, loading and failed API states are visibly different; fake Workspace success states are absent.
