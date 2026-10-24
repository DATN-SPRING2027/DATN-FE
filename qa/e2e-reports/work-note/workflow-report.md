# Work Note E2E Workflow Report

## Environment

- Frontend: `http://127.0.0.1:3100` (Next.js local runtime).
- Backend: `http://127.0.0.1:3101` (real modular monolith API).
- Database: disposable Mongo replica set at `127.0.0.1:27018`; Redis at `127.0.0.1:6380`.
- Browser: Playwright Chromium, headless, CSS viewport at documented widths.
- All test organizations, accounts, projects, tasks, notes, documents, and reports were synthetic. The test database used temporary storage and no production/shared database was accessed.

## Roles and data

- Org A `DATN Development` (`02f962598527ec6f886ddac0`), private Project A `Development Sample Project` (`898f7d00f9f1e9e98da9075a`), Task A `6adc07caa072a580514ab25f`.
- Org B `Work Note QA Organization B` (`6adc06f38cd59a96cc5599f3`), private Project B `Work Note QA Project B` (`6adc06f38cd59a96cc5599f4`), Task B `6adc0891a7eada0af9cba069`.
- Tested Manager A (`ADMIN`), Leader A (`TEAM_LEADER` at project scope), Member A (`MEMBER`), Member B (Project B only), Org A outsider (no Project A membership), Leader B, and Platform Operator (`organization.create`). Full IDs and effective roles are in [`role-matrix.md`](role-matrix.md).

## Task Note

Member A created a note from Project → Task A → Task notes. The authenticated UI sent GET 200, POST 201, and GET 200 after refresh. A fresh sign-in also loaded the same title and three content fields. The project Task Notes list showed the record with Task A’s ID, author, and content. Empty required fields were blocked by browser validity; whitespace-only text was rejected by FE trimming without a mutation. A 10,001-character field was rejected by the BE with 422. Malformed task IDs and Task B under Project A both returned safe 404 responses.

Leader A and Manager A each loaded the Task A notes panel and created a note through its real form (GET 200, POST 201). The task-detail Close control dismissed the panel. The project list search returned one matching record and an empty result for a no-match query. Task Notes are append-only in the current implementation: no cancel, edit, delete, pagination, or load-more controls exist; direct PATCH and DELETE attempts return 404.

The first live run exposed a P1 defect: when `TASK_SERVICE_URL` was unset, authorization fell back to `IAM_SERVICE_URL` but called `/internal/tasks/...`; the monolith task controller is mounted under `/api/v1/internal/tasks/...`, so valid Task Note reads returned `TASK_NOT_FOUND`. The BE now prefixes the monolith fallback with `/api/v1` while leaving a separately configured Task service route unchanged. A regression test covers the fallback path. After the fix, the browser repeated GET/POST/reload/re-login successfully.

## Project Document

Member A opened and closed the create modal using both header and footer Close controls, verified required title/content validation, created a draft (POST 201), and submitted it (POST 200 → `PENDING_REVIEW`). Member A’s direct approve request returned 403. Leader A’s empty Request changes action was blocked; with a reason it returned 200 → `CHANGES_REQUESTED`. Member A edited and resubmitted (PATCH 200, POST 200). Leader A approved v1 (POST 200). Member A then created v2; v1 remained in version history. Leader A approved v2 and archived the document (POST 200). A fresh Member A login loaded the archived current v2 and both v1/v2 history records from the BE. A second draft followed `PENDING_REVIEW → REJECTED` with a required review comment; the rejected status filter found it.

Manager A could view the pending document but had `canReview=false`; Approve, Request changes, Reject, and Edit controls were absent, and direct approve returned 403. Member B’s direct request to Project A returned 404 without document title/content.

Manager A also created a Project Document through the UI (POST 201), edited the own draft (PATCH 200), and submitted it (POST 200 → `PENDING_REVIEW`). A fresh login showed the submitted document and status; Manager still had `canReview=false` and no review controls. A direct review attempt returned 403.

A P2 UI issue was found during the authenticated outsider check: API access correctly returned 404, but `New document` remained visible while the list query was denied. The create action is now shown only after the document list query succeeds. A FE regression test fails before and passes after this guard; a Playwright rerun confirmed `New document` count is zero in the 404 state and retained the denied-page screenshot.

Project Documents are versioned text in this implementation. Upload, download/file viewing, and delete controls/routes do not exist; they were recorded as unavailable rather than reported as passing actions.

## Periodic Work Report

Member A’s weekly report covered Oct 19–26, 2026 (7 days). The form enforced required accomplishments, approach, and reason fields; Save draft persisted all five fields and survived refresh. Submit returned 200 → `PENDING_REVIEW`; the Member had no Approve action and direct approve returned 403.

Leader A’s Request changes without a comment was blocked. With a reason, review returned 200 → `CHANGES_REQUESTED`; Member A revised/resubmitted (200) and Leader A approved (200 → `APPROVED`). The review history and approved report remained after re-login. A second member/report exercised Reject: empty comment blocked; a comment produced 200 → `REJECTED`, visible in the rejected filter.

Leader A exercised the schedule confirmation Cancel (closed with no mutation) and applied `EVERY_3_DAYS` (PATCH 200); refresh preserved the pending effective date/history. Leader B exercised Project B’s `DAILY` and `WEEKLY` transitions and verified persisted settings. The FE offers exactly `DAILY`, `EVERY_3_DAYS`, and `WEEKLY`. BE PATCH requests for `14_DAYS`, `30_DAYS`, and `CUSTOM_8_DAYS` all returned 422 and left the active schedule unchanged. Member A’s schedule update returned 403. Manager A’s settings response had `canConfigure=false`; schedule/review controls were absent, and direct configure/approve returned 403.

Manager A separately saved an own Work Report draft (POST 200), reloaded it with all five fields preserved, and submitted it (POST 200 → `PENDING_REVIEW`). The report detail returned `canReview=false`; a direct self-approve attempt returned 403. Manager authoring is permitted independently of report review/configuration.

Period coverage verified one-day `2026-10-24T00:41:11Z`–`2026-10-25T00:41:11Z`, three-day `2026-10-22T01:41:11Z`–`2026-10-25T01:41:11Z`, and weekly Oct 19–26 periods. The checked member/period combinations had one record each. The test-only Mongo fixture moved Project A’s schedule effective time to Oct 22 and Project B’s active daily time to Oct 24 so all three period lengths could be observed in one run; no shared data was changed.

## Authorization and isolation

- Org A outsider with an active Org A session but no membership in private Project A: Task Note, Project Document, and Work Report Project A requests each returned 404 `PROJECT_NOT_FOUND`; no title/content was returned. The Project A Document page exposed no create action after the denied list response.
- Member B in Org B / Project B: own Project B screens loaded; Project A documents, reports, and Task A notes returned 404. Task B requested under Project A returned 404 `TASK_NOT_FOUND`.
- Platform Operator login/profile returned 200 and permission `organization.create`; with no organization session, Work Note API returned 401 `UNAUTHORIZED`.
- Member and Manager direct review/configure attempts were rejected by the BE even when tested outside the FE controls.

## Responsive and UI/UX results

Playwright captured 20 feature screenshots (five widths × four surfaces): Task Note panel, document create form, Project Task Notes list, and Work Report form at 375, 390, 768, 1280, and 1440 pixels. In each captured loaded state, `documentElement.scrollWidth` and `body.scrollWidth` matched the viewport width; no page errors were observed. Mobile document modal and report form fit within the viewport, and the task-note list remained readable. Representative screenshots: [Task Note mobile](screenshots/65-member-a-task-note-375.png), [document modal mobile](screenshots/66-member-a-document-create-form-375.png), [task-note list mobile](screenshots/67-member-a-project-task-notes-list-375.png), [report form mobile](screenshots/68-responsive-work-report-form-375.png).

The report folder contains 92 accepted Playwright screenshots and 15 retained harness/loading captures under `failures/`; failure captures are excluded from the result count.

Additional browser checks exercised empty, validation, success, draft, pending, approved, changes-requested, rejected, archived, filtered, unauthorized, and persistence states. Loading skeletons were observed while requests were in flight; accepted screenshots were taken only after the target data/form was present. Expected 401/403/404 responses in denial tests were not treated as runtime errors.

## Findings and fixes

| Severity | Finding | Fix / verification |
|---|---|---|
| P1 | Task Notes failed for valid tasks when Task service URL was unset because monolith fallback omitted `/api/v1`. | Fixed BE route selection and added regression test. Targeted Jest suite passed 6/6; browser GET/POST/reload/re-login rerun passed. |
| P2 | Project Documents showed New document during an unauthorized 404 list state. | Gate action on successful list query; add FE regression test. Targeted Vitest suite passed 2/2; outsider Playwright rerun returned 404 and found zero New document buttons. |

No unresolved P0/P1/P2 findings were identified in the tested flows after these fixes.

## Final checks

Final repository checks completed:

- FE `npm run check`: passed; ESLint, TypeScript, 110 Vitest files / 782 tests, and production build (54 static pages).
- BE `npm run check`: passed; ESLint, TypeScript, role reconciliation (15), dev DB safety (25), Jest (139 suites passed, 14 skipped; 1,374 passed, 135 skipped), E2E (14 suites passed, 2 skipped; 108 passed, 4 skipped), and Nest build.
- FE Work Note targeted regression: 2/2 passed.
- BE Work Notes authorization targeted Jest: 6/6 passed.
- `git diff --check`: passed in both repositories.
- Playwright matrix: 58 documented cases; 56 PASS, one PASS/N/A (append-only Task Note edit/delete route absent), one N/A (document file upload/download/delete absent). All implemented workflow actions tested in the browser passed.
- Code review verdict: approve. The review covered correctness, readability, architecture, authorization/security, performance, regression coverage, and the real browser flows. The P1 and P2 findings above were fixed and rerun; no unresolved findings remain in the changed code.

The BE Jest log contained non-fatal existing Mongoose duplicate-index warnings and test warnings; the command exited successfully. FE Vitest emitted a non-fatal jsdom environment-count warning.

## Remaining scope

Task Note edit/delete, document file upload/download/delete, and separate report search are not implemented in the current feature surface. No controls/routes were available to exercise. The screenshots in `failures/` are harness artifacts captured before authentication/data loading completed and are not accepted as workflow evidence. See [`test-results.md`](test-results.md) for action IDs and accepted screenshots.
