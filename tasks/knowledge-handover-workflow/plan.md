# Knowledge Handover Workflow — Frontend Work Package

- Date: 2026-10-28
- Owner: Thang
- Branch: `feat/Thang-knowledge-handover-workflow-fe-ui`
- Base: `origin/main` at `aa9e03c90016d98ecec6d6c6f1d0e5092c0dcde3`
- Worktree: `F:/LEARN KÌ 8/ĐATN/DATN_FE-handover-workflow`

## Design & Architecture Standards

- Strict adherence to `DATN_FE/AGENTS.md`, `design-system/MASTER.md`, `.agents/rules/06-frontend-ui-ux-visual-qa-loop.md`, and Next.js 16 App Router conventions (`async` Server Component `page.tsx` awaiting `params` + `setRequestLocale(locale)`).
- Icons strictly from `@/icons` (`src/icons/index.tsx`, e.g., `HandShakeIcon`, `CheckCircleIcon`, `AlertIcon`, `FileIcon`, `TaskIcon`); zero inline `<svg>` in feature components, zero emojis.
- All user-visible strings externalized in `src/messages/en.json` via `next-intl` (`useTranslations` / `getTranslations`); navigation via `@/i18n/navigation`; roles rendered via `<RoleLabel />`.
- Logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`, `text-end`), Tailwind v4 `@theme` tokens with full Light/Dark mode parity, and `tabular-nums` on all numeric badges, versions, dates, and counters.
- Server state via TanStack Query (`src/lib/queries/handovers/`), forwarding through `/api/backend/handover/projects/:projectId/handovers...` with `X-CSRF-Token`, strong `ETag` / `If-Match`, and stable `Idempotency-Key` per user command intent (never calling SAG directly).

## Subtasks

- [ ] F01a: Typed Handover API client, ETag/Idempotency-Key helpers, and TanStack Query hooks + unit tests.
- [ ] F01b: Project navigation integration (`AppSidebar`, `ProjectOverview`, `/projects/[projectId]/handover` list + create modal supporting nullable `B`, `/projects/[projectId]/handover/[handoverId]` detail workspace).
- [ ] F01c: Coordinator `D` / Leader views (metadata, successor/coordinator controls, source selection + AI source proposal/generation job banner + manual draft editor, publish review + gap assignment modal, task transfer & reconciliation panel, evidence review, optional gap exception + independent follow-ups, completion blockers & cancel).
- [ ] F02: Successor `B` views (published package reader respecting `UnavailableItem` opaque placeholders & `CHANGED` source warnings, package acceptance, per-item `UNDERSTOOD` / `NEEDS_CLARIFICATION` acknowledgement, text + HTTPS links evidence submission, and grounded Q&A drawer/panel).
- [ ] QA: Vitest component/hook tests covering all 8 mandatory UI states + `npm run check` (`lint`, `typecheck`, `vitest`, `next build`) + 6-phase live Browser Visual QA across `375px`, `768px`, `1280px`, `1440px` (Light & Dark) with Before/After verification.

