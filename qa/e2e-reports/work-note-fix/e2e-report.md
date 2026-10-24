# Work Note review-fix E2E report

Run time: 2026-10-24T05:26:40.039Z

Environment: disposable local MongoDB 7 replica set and Redis 7; synthetic DEV_SAMPLE accounts only.

Runtime boundary: the workflow E2E uses the modular monolith API through the FE BFF. The separate Gateway forwarding routes for Task Note PATCH/DELETE and Project Document file PUT/GET were added and checked by `gateway-capture.controller.spec.ts` (2 tests). A browser E2E through the standalone Gateway was not run.

## Verified

- PASS — Project Documents responsive 375px
- PASS — Project Documents responsive 390px
- PASS — Project Documents responsive 768px
- PASS — Project Documents responsive 1280px
- PASS — Project Documents responsive 1440px
- PASS — Failed upload preserves the draft and retry editor
- PASS — upload PDF and download current version (HTTP 200)
- PASS — Member reads submitted version 1 (HTTP 200)
- PASS — Leader approves version 1 (HTTP 200)
- PASS — Member creates version 2 from approved Document (HTTP 200)
- PASS — Member submits version 2 (HTTP 200)
- PASS — Leader approves replacement version (HTTP 200)
- PASS — Leader archives approved Document (HTTP 200)
- PASS — Member reads scheduler-created periodic report (HTTP 200)
- PASS — Member reads report cadence (HTTP 200)
- PASS — Create QA Task for Task Note test (HTTP 201)
- PASS — Member creates Task Note (HTTP 201)
- PASS — Owner edits Task Note (HTTP 200)
- PASS — Owner archives Task Note (HTTP 204)
- PASS — Member creates Task Note for Leader ACL test (HTTP 201)
- PASS — Leader edits Task Note in project scope (HTTP 200)
- PASS — Leader archives Task Note in project scope (HTTP 204)
- PASS — Leader reads archived Project Document (HTTP 200)
- PASS — Project Document archived status is queryable (HTTP 200)

Browser console errors: 0
Failed browser requests: 0
Navigation cancellations: 4
Expected upload failure requests: 2

Screenshots: Project Documents list and create form at actual 375, 390, 768, 1280, and 1440px viewports; failed-upload retry at 375 and 1280px; successful PDF upload at 1280px. Responsive list measurements are in `responsive-browser-check.json`, and the BFF create/upload/download smoke is in `browser-ui-upload-smoke.json`.

## Integration boundary

Archive and replacement events are emitted to the Capture outbox. A downstream knowledge index consumer is not present in this deployment, so its actual removal of archived/replaced content remains outside this E2E run.

## Follow-up browser and UI smoke

Run time: 2026-10-24. A fresh Playwright Chromium session used the synthetic Member account through the Next.js BFF and modular monolith.

- Authentication: login 200; `/auth/me` 200; Project Documents list 200.
- Required-field validation: saving without content and file was blocked with the inline required-fields message; no mutation was sent.
- Create, upload, and download: draft POST 201, PDF upload PUT 200, download GET 200 with `application/pdf` and `attachment; filename*=UTF-8''worknote-ui-smoke.pdf`.
- Browser console and page errors: 0.
- Responsive captures: list and create form at 375, 390, 768, 1280, and 1440 CSS pixels. The list document width matched the requested viewport at every breakpoint. Visual inspection found no clipped form fields, footer actions, or horizontal overflow.
- The run created one synthetic Draft Project Document in the disposable QA database. Screenshots use the real browser viewport and are linked in the report folder.

Harness note: an earlier retry used a standalone MongoDB container and returned 500 because the API workflow requires transactions. The final smoke used a fresh, disposable single-node replica set with the task workspace migration dry-run clean at 0 existing tasks; create/upload/download then passed. This was a test-environment correction.

A focused follow-up request through the FE BFF confirmed the same PDF download returns HTTP 200 with its `Content-Disposition` filename. The browser workflow still used the modular monolith; standalone Gateway browser integration remains unverified and Gateway forwarding is covered by BE unit tests.
