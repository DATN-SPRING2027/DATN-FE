# Knowledge Handover Workflow — Frontend Todo

## Review round 2 (2026-10-29)

- [x] R2-FE01: load every membership page, preserving inactive departing members and active recipient/owner filtering.
- [x] R2-FE02: allow successor B to also coordinate as D; preserve the separate evidence reviewer rule.
- [x] R2-FE03: keep forward/reverse Tab focus inside the dialog when closing the member picker portal.
- [x] R2-X01: show coverage warnings for successful AI jobs and Q&A.
- [x] Regression tests, full quality gates and responsive modal/keyboard browser QA; the live coverage-banner limitation is recorded in the handoff for PR #102.

- [x] Fast-forward `main` (`ec95852eae163cf1723aa1f8c52387cb4442798a`), create isolated worktree `DATN_FE-handover-workflow` on `feat/Thang-knowledge-handover-workflow-fe-ui`, preserve active AI Chat checkout (`DATN_FE`), and install dependencies (`npm ci`).
- [x] Implement `src/lib/queries/handovers/` (`handover.types.ts`, `handover.service.ts`, `useHandovers.ts`) + unit tests (`handover.service.spec.ts`, `useHandovers.spec.tsx`) for ETag, `If-Match`, stable `Idempotency-Key` retention across retries (`F09`), `Idempotency-Replayed`, CSRF token forwarding, and error envelopes.
- [x] Add `handover` namespace in `src/messages/en.json` and wire project navigation (`AppSidebar.tsx`, `AppSidebar.spec.tsx`, `ProjectOverview.tsx`, `ProjectWorkspace.spec.tsx`).
- [x] Implement `/projects/[projectId]/handover` list page (`HandoverListWorkspace.tsx`, `CreateHandoverModal.tsx`, `HandoverDialogShell.tsx`, `HandoverMemberSelect.tsx`) supporting nullable `B`, `INACTIVE` departed `A` (`A01`/`A02`), `useProjectLeadersQuery`-verified coordinator `D`, rich avatar/email comboboxes without native `<select>` clipping, `+7d/+14d/+30d` UTC date presets, KPI summary strip (`tabular-nums`), responsive desktop table (`>= 1024px`) & mobile/tablet cards (`375px` / `768px`), and all 8 UI states.
- [x] Implement `/projects/[projectId]/handover/[handoverId]` workspace (`HandoverDetailWorkspace.tsx`, `HandoverDraftEditor.tsx`, `HandoverPublishModal.tsx`, `HandoverPublishedView.tsx`, `HandoverTaskTransfersPanel.tsx`, `HandoverQaPanel.tsx`, `HandoverFollowUpsPanel.tsx`) covering server `DraftItemDto.contentVersion` publish (`F07`), exact `CHUNK | PAGE | LINE | SECTION` citation preservation & provenance editor (`F08`), Coordinator `D`, Successor `B`, Org Manager safe coordinator recovery (`A16`), fail-closed `UNAVAILABLE` items (`A04`, `A13`), AI jobs & manual fallback (`A12`, `P-08`), cited Q&A, explicit task transfer & reconciliation (`A10`, `A11`), HTTPS-only evidence review (`A09`), optional gap exceptions (`A08`), and independent post-completion follow-ups (`A15`).
- [x] Add Vitest suites (`HandoverListWorkspace.spec.tsx`, `HandoverDetailWorkspace.spec.tsx`, `handover.service.spec.ts`, `useHandovers.spec.tsx` — `142/142` files / `962/962` tests total) and pass full `npm run check` (`eslint`, `tsc --noEmit`, `vitest`, `next build`).
- [x] Execute mandatory 6-phase runtime Visual QA (`375px`, `768px`, `1280px`, `1440px`, Light & Dark, `0` console errors, `0` hydration warnings, `0` JS exceptions, `0` unexpected failed network requests, `0` horizontal overflow) against live local `FE` + `BE` + `SAG`, apply Phase 4 visual polish fixes, and verify Before vs. After screenshots.
