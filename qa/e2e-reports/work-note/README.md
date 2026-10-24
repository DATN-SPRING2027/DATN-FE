# Work Note E2E QA

Historical Playwright QA evidence for the initial Task Note, Project Document, and Periodic Work Report workflows. Those records predate file upload and Task Note edit/archive support. For the corrected implementation, start with [`../work-note-fix/e2e-report.md`](../work-note-fix/e2e-report.md); use [`workflow-report.md`](workflow-report.md), [`test-results.md`](test-results.md), and [`role-matrix.md`](role-matrix.md) only as earlier baseline evidence.

## Evidence

- `screenshots/`: accepted browser screenshots, including workflow states and responsive captures.
- `failures/`: screenshots captured during invalid harness attempts or before asynchronous content finished loading. They are retained for traceability and are not counted as product failures or PASS evidence.
- The delivered run contains 92 accepted screenshots and 15 retained harness/loading captures.
- Screenshots were taken by Playwright Chromium against the running Next.js application. The responsive run covered 375, 390, 768, 1280, and 1440 CSS pixels for the task-note panel, document-create modal, project task-note list, and report form.

## Environment and safety

The run used the local FE at `http://127.0.0.1:3100`, BE at `http://127.0.0.1:3101`, a disposable MongoDB replica set on port 27018, and a disposable Redis instance on port 6380. All records were synthetic. The MongoDB data directory used temporary storage; no production or shared database was accessed.

Several schedule timestamps in that isolated database were moved forward to make daily and three-day reporting periods testable during the same session. The fixture and temporary Playwright scripts were kept outside the repositories; no test credentials or scripts are included here.

## Verdict

The workflows passed after fixing one backend fallback-route defect and one unauthorized-state UI defect. See the final verification and remaining scope notes in [`workflow-report.md`](workflow-report.md).
