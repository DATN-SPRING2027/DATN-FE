## Problem and behavior

Adds the Knowledge Handover workspace through the Continuum BFF: list/create, draft curation and AI assistance, immutable publishing, recipient acknowledgements and evidence, explicit task transfer, cited Q&A and independent follow-ups.

Review round 2 fixes the member picker stopping at 100 by loading all membership pages, retaining inactive departing members and existing active-recipient/owner rules. Successor B may also coordinate as D. Tab and Shift+Tab now leave the portaled picker in the correct direction while staying inside its dialog. Successful AI jobs and Q&A show a localized partial-source-coverage warning returned by BE.

## Validation

- `npm run check`: PASS — ESLint, TypeScript, 143 Vitest suites / 969 tests, Next.js production build.
- New regressions cover 120 members, later-page failure, B=D without clearing the recipient, native-event portal Tab directions, successful-job warnings and Q&A warnings.
- Live Chrome on existing `localhost:3000` against existing BE: 15 screenshots across 375, 768, 1280 and 1440 px, Light/Dark, validation and picker states; 0 console/hydration/JS errors, 0 failed/unexpected HTTP requests, 0 horizontal overflow.
- Native Chrome Tab moves A picker → D; Shift+Tab moves A picker → title. Both close the portal and retain focus in the dialog. B=D was selected successfully in the real UI without persisting a test handover.
- CodeRabbit: 0 issues in the tracked diff.

## Database and configuration

No database or environment change. Uses existing `CONTINUUM_API_BASE_URL` through BFF. Optional `warnings` matches the BE [contract addendum](https://github.com/DATN-SPRING2027/DATN-BE/pull/110); no client-side authorization replaces BE checks.

## Risks, limitations and rollback

Deploy after BE #110 and SAG #47. Source-coverage banners are covered by component tests; the existing running BE process was not restarted. A separate FE process with a dedicated proxy was blocked by automatic approval review (`blocked by policy`), so no isolated live banner integration is claimed. Error/permission/loading states retain existing component coverage; the browser run above covers the changed modal/keyboard flows. Safe to revert this frontend commit without data rollback.
