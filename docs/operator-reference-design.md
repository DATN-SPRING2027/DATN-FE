# Operator reference design

The user's supplied reference drives the Platform interface: top navigation,
white full-width workspace, two-column dashboard, flat sections, thin dividers,
compact table, dark typography and green status graphics. Existing Continuum
branding, tokens, light/dark mode and common primitives are retained.

## Implementation

- Replaces the fixed sidebar and previous header. All Platform modules remain
  reachable through top-level links and the native keyboard-accessible More menu.
  Narrow screens expose remaining links in More and stack dashboard columns.
- Uses the actual session name/email and existing account/logout flow. There is
  no email-specific UI gate, credential change, role grant or authentication bypass.
- Dashboard left: actual organization/user/project/membership totals, categorical
  status distributions and backend service health. Dashboard right: Organization
  directory with its existing pagination/filter/detail flow and bounded activity.
- No revenue, invoice, historical series, growth percentages, export endpoint or
  synthetic production records are invented. Bars use counts in the API snapshot.
- Existing create/edit Organization behavior, CSRF, request contracts, query
  validation, timeouts and authorization remain intact. The directory on overview
  has its own exact organization-read gate in addition to dashboard permission.
- Styling is scoped to Platform. Organization-context member screens and their
  dashboard are not repurposed as system administration.

## Verification and limits

Desktop and 390px mobile layout were inspected using an isolated HTML render of
real components with clearly labeled test fixtures. The fixture renderer is not
included in the app, and no test data was inserted into MongoDB. The preview is
visual verification, not a live operator login or a live mutation test.

Frontend tests cover navigation, current-route state, keyboard Escape/focus,
session-derived profile, sign-out callback, dashboard authorization/error/null
states, and Organization create/detail/edit behavior. The backend repository and
database are unchanged. No commit, push or merge is performed by this task.

Final validation: `npm run check` passed (ESLint, TypeScript, 653 tests in
79 files, production build). `git diff --check` passed. Final review under
`code-review-and-quality` found no blocking issue in the frontend diff.
Branch: `feat/Tien-operator-reference-design-fe-ui`, based on `origin/main`
`e179ffb`. The branch retains the prior uncommitted overview/organization work.

## Compact reference pass

Removed visible descriptive paragraphs, repeated breakdown sentences and
secondary table labels; retained accessible labels and essential errors.
Shortened section/table titles and timestamps. Reused the existing local Inter
asset only within Platform, reduced heading weight and toolbar height, added
organization initials, and rendered membership counts as a categorical bar chart.
The source reference's financial time series remains outside the existing API.
An isolated render with test fixtures was inspected again. Final full check:
653 tests, lint, typecheck and production build passed; backend remains unchanged.

## Four-image section alignment and authorized simulation

The user explicitly selected “allow simulated data with labels” for missing
historical charts. This supersedes the earlier instruction to omit synthetic
chart series, while preserving real backend KPIs and records.

- Removed the entire Updated/Refresh strip and all dashboard Open shortcuts.
  Organization record links and form operations remain available.
- Added reference-style KPI sparklines, three-series line/area charts, bar mode,
  tooltips, series toggles and previous-period comparison using existing ApexCharts.
- Every simulated chart is labeled “Simulated chart”; the accessible description
  and tooltip distinguish chart simulation from actual API totals. Simulation is
  local in `operator-demo.ts` and never enters API requests or database writes.
- Project chart labels use Active/Archived rather than inventing Project states.
- Organization table has a three-part summary, segmented plan filters, search,
  current server pagination and existing detail links. Plan summaries explicitly
  say “this page”; only pagination.totalItems is a global count.
- Services use real backend status/counts and a real count-based segmented bar.
- Existing forms, permission checks, CAS, CSRF and backend contracts are retained.

Interactive visual verification used a standalone React preview of the actual
components with fixture API hooks. Switching line/bar and filtering Organization
rows were verified in browser; no live database was accessed by that preview.

Final section-pass validation: full `npm run check` passed with 655 tests in
80 files, lint, typecheck and production build. The subsequent domain-label/color
refinement passed typecheck and both chart-control tests. Final five-axis review
found no blocking issue. No backend/database change, commit, push or merge.


### UI polish — 2026-10-21

Removed visible simulated-chart badges, the directory refresh button, and service checked timestamp. Simulation remains identified in accessible chart descriptions. Search is a compact 12rem control aligned to the inline end. Charts share brand blue, light blue and gray tokens. Shared dashboard grid rows align Activity with Users/Projects and the Services bottom edge; mobile returns to a single column. API contracts and backend files are unchanged. Directory network errors retain an explicit retry action.


### Organization table simplification

Removed the simulated previous-period comparison. Plan summary labels now read Free and Enterprise; the existing current-page scope remains in accessible help. Organizations and Services share a subtly rounded segmented distribution bar. Organization rows use normal-weight names without initial avatars and a keyboard-operable native disclosure linking to the existing detail/edit flow. Creation remains in the Organizations header. No delete action is exposed because the accepted backend contract has no Organization delete endpoint. Full npm run check passed (655 tests, lint, types, production build); visually verified with fixture preview.


### Dashboard pagination and palette

Removed Organizations from the top navigation. The dashboard requests five organizations per server page with a page-size-specific query key; directory controls remain visible for a single or empty page. Free/Ready use brand blue, Enterprise/Degraded use light blue, Total uses dark gray and Unavailable uses gray; metric dots and values identify each category. View and Edit are separate disclosure links. Edit deep-links to the organization detail and opens only after the matching authoritative record loads and the manage permission is present. Escape closes the row disclosure and returns focus. Backend contracts and files remain unchanged.


### Focus, compact pagination and single-series charts

Search uses one inset focus border to avoid stacked rings outside the field. Dashboard pagination defaults to ten rows, supports 5/10/20/50, and displays Show by plus current/total pages and arrow controls; changing size resets to page one. Each chart now shows one simulated total series with a fixed chart type and no mode or series toggles. Removed metric dots. Each Organizations/Services metric has a corresponding colored track; zero counts retain a pale track without an artificial filled quantity. Services and Activity remain useful operator signals for service availability and administrative audit changes, alongside dedicated navigation for deeper inspection.


### Replace Dribbble demo content with project backend data

The existing two-column card composition is retained and light background is white. Removed delivery KPIs, financial charts, invoice demo rows, fake company contacts, arbitrary dates, fake last-update text and inactive report/layout buttons. The summary comes from GET /iam/platform/dashboard; Memberships/Users/Projects charts use its actual status aggregates. The directory uses GET /iam/platform/organizations with existing pagination, detail and permission-gated edit flows. There is one real Organizations directory, replacing the invoice card, without a duplicate below it. Service health and recent activity remain backend projections. No backend files or contracts changed. The API does not supply daily history, so categorical snapshots replace fabricated financial trend lines while keeping chart-card space. Regression test proves visible chart counts change when backend aggregates change and that finance demo labels are absent. npm run check passed: 661 tests, lint, types, production build. Live browser access remains blocked by the current Development Project Leader session; visual component verification uses explicit fixture API responses, not a live operator session.


### Approved reference simulation and continuous layout

The user explicitly chose labelled simulation to reproduce the reference chart shapes. Removed rounded card outlines and shadows and joined the dashboard columns with thin shared separators. Reference charts use green/black/pink lines, translucent green area fill, fine grids, a crosshair tooltip, green/pink balance columns with dark target marks, compact equalizer/gauge/sparkline visuals, and a green/lime/pale category strip. Demo series live in reference-series.ts and chart-local constants only; they never feed totals, API query caches or writes. Each simulated chart has a visible notice; real totals and the Organizations directory still use backend queries. The line tooltip supports keyboard navigation and has a readable data-table disclosure. Mobile tooltip is constrained to its chart. Full check passed: 662 tests, lint, typecheck and production build. Component proof uses fixture API responses; no backend or database modifications, commits or pushes.
