## Summary

Implements the complete **Knowledge Handover** frontend workspace (`F01`, `F02`) in `DATN_FE`, integrated end-to-end with the Continuum BFF proxy, Backend Handover V2 API, Task Transfer reconciliation, and bounded SAG AI assistance.

### Scope
- **Typed Query & Mutation Layer (`src/lib/queries/handovers/`)**:
  - Full client coverage for all 28 Handover operations with `ETag` (`If-Match`), `Idempotency-Key`, `Idempotency-Replayed`, and `X-CSRF-Token` forwarding.
  - Stable `Idempotency-Key` retention across command retries for identical canonical command intent (`useCommandIdempotencyKey`), rotating cleanly when intent changes or after mutation success, while keeping read-only `askHandoverQuestion` free of mutation idempotency headers (`F09`).
- **Navigation & Localization**:
  - Added project-level `Handover` sidebar link (`AppSidebar.tsx`) and overview quick-access card (`ProjectOverview.tsx`), backed by `next-intl` keys in `src/messages/en.json` (including localized `Expected Version` fallback and citation editor labels).
- **Workspace UI (`src/components/handover/*` & App Router pages)**:
  - `/projects/[projectId]/handover`: KPI summary strip (`tabular-nums`), search/status/member filters, nullable-`B` handover creation modal with Leader-filtered coordinator options and accurate `<RoleLabel />` display, desktop data table (`>= 1024px`), and responsive mobile/tablet cards (`375px` / `768px`).
  - `/projects/[projectId]/handover/[handoverId]`:
    - Coordinator `D` draft curation & AI source proposal/draft synthesis with manual fallback, preserving `CHUNK | PAGE | LINE | SECTION` citation locators verbatim across non-citation edits and exposing explicit per-citation provenance editing without fabricating default locators (`F08`).
    - Immutable revision publishing driven directly by server `DraftItemDto.contentVersion` (`F07`) with item review (`UNCHANGED | CHANGED`) & gap owner/due assignments.
    - Fail-closed `UNAVAILABLE` item rendering, Successor `B` package receipt + item understanding + HTTPS-only evidence submission, Leader evidence review & optional gap exceptions, explicit Task Transfer + `PENDING | UNKNOWN` fence reconciliation, grounded Cited Q&A, post-completion Follow-ups, and Org Manager safe coordinator recovery (`403` flow).

### Tests & Visual QA Run
- `npm run check`: `eslint .` (`0` errors/warnings), `tsc --noEmit` (`0` errors), `vitest run` (`142/142` suites, `961/961` tests passed — including `handover.service.spec.ts`, `useHandovers.spec.tsx`, `HandoverListWorkspace.spec.tsx`, and `HandoverDetailWorkspace.spec.tsx`), and `next build` succeeded.
- **6-Phase Live Browser Visual QA**: Verified across `375px`, `768px`, `1280px`, and `1440px` in Light & Dark modes against live local `FE + BE + SAG` (`0` console errors, `0` hydration warnings, `0` uncaught exceptions, `0` unexpected failed network requests, `0` horizontal overflow).

### Database, Configuration & Rollback Impact
- **Database / Config**: Frontend-only PR; zero database or environment variable changes (reuses existing `CONTINUUM_API_BASE_URL` BFF proxy).
- **Deployment Order & Rollback**: Merge/deploy after Backend PR ([`DATN-BE#110`](https://github.com/DATN-SPRING2027/DATN-BE/pull/110)) and SAG PR ([`sag-laya-integration#47`](https://github.com/DATN-SPRING2027/sag-laya-integration/pull/47)). Safe to revert independently without data side effects.
