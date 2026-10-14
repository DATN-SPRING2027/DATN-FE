# C-03 Organization Membership FE — implementation checklist

## Contract checkpoint

- [x] Read user-approved V1 contract (`Document origin/main` `ddce1b2`) and exact OpenAPI routes/schemas.
- [x] Confirm BE runtime is not implemented; do not treat accepted contract as integration proof.
- [x] Confirm four statuses and readiness gate: invite/resend/cancel/suspend are in this UI slice; remove/resume/reinvite/right-review are BLOCKED by A7 proof dependencies.
- [x] Capture FE service/hook/UI implementation and focused tests.
- [x] Run `npm run check` and focused review; browser smoke remains unverified because Chrome DevTools MCP is not configured in this session.

## DATN-242 — list and authorization-safe context

- [x] Add `/organization/members` route and visible Organization Members navigation entry.
- [x] Implement exact membership/invitation response parsing and organization-scoped BFF list hooks.
- [x] Render only supported fields and all four membership state labels; filter only by the accepted state enum.
- [x] Cover loading, empty, success, malformed response, permission denial, Organization context changes, and no stale rows on denial; documented HTTP error states are mapped.

## DATN-243 — invite

- [x] Implement existing-user invitation with `{email, reasonCode}` only, CSRF, and idempotency key.
- [x] Do not create users/assign roles or claim email delivery. Show a success only after a valid server acknowledgement.
- [x] Cover request shape, server acknowledgement, dependency failure, and exact-key/body retry; map documented conflict, permission, validation, rate-limit, and dependency errors.

## DATN-244/245 — permitted lifecycle actions

- [x] Pending invite: resend/cancel only when a fresh invitation row is available, using the exact membership/invitation versions.
- [x] ACTIVE: suspend only with accepted reason and expected membership version; handle `LAST_ELIGIBLE_ADMIN` conflict safely, and hide self-suspend.
- [x] Do not expose normal remove/resume/reinvite while A7 proof dependencies are unavailable. No user-entered receipt IDs.
- [x] Cover exposed action request shapes and last-ADMIN conflict. Mutation errors require exact retry or successful fresh reads of both lists before a new command; valid acknowledgements invalidate scoped queries.

## DATN-246/247 — UX and acceptance

- [x] Reuse TailAdmin primitives; split UI, domain presentation logic, hooks, and API service.
- [x] Localize user-facing copy in the repository's available `en` locale; use RTL logical layout and dark variants.
- [x] Responsive/loading/empty/error states, keyboard/dialog semantics, no role/title-based authorization.
- [x] `npm run check`; inspect diff/secrets/status and run independent code review. Browser smoke at mobile/desktop and RTL/dark is not verified.
- [x] Keep C-03 In Progress until live BE integration and audit evidence are verified.
