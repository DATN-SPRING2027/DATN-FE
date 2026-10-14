# Implementation Plan: C-03 Organization Membership FE

## Readiness and source of truth

- Jira `DATN-88` (C-03 FE) is assigned to KeyT and In Progress; `DATN-87` (C-02 BE) is assigned to Nguyen Hong Phuc and In Progress.
- The accepted successor contract is `Document origin/main` at `ddce1b2`, decision `research-docs/Workspace/09-organization-membership-administration-v1.md` and wire contract `research-docs/Workspace/contracts/c-02-membership-v1.openapi.json` (V1 user-approved, runtime `NOT_IMPLEMENTED`). This supersedes earlier incomplete C-01 working notes.
- The FE task branch is `feat/Thang-datn-88-organization-membership-fe-ui`, based on FE `origin/main` `9f560fc`. Do not modify BE, Document, or use a worktree.
- FE can implement against the accepted request/response schemas through its existing BFF now. BE runtime and end-to-end integration remain unverified; FE must not report C-03 done until that verification.
- A7 readiness is partial. Normal remove, resume, reinvite, and rights-review-dependent flows remain BLOCKED until the backend provides genuine handover/rights-review evidence. Do not accept typed receipt IDs or checkboxes as proof.

## Confirmed API and policy

- Organization context is obtained from the existing authenticated context. It scopes request paths/query keys only; FE roles, titles, or client state never authorize an operation.
- List memberships: `GET /api/v1/iam/organizations/{organizationId}/memberships`, page/pageSize and optional one-of-four-state filter. Response exposes membership/user fields and pagination only. No free-text search, role column, summary counts, or arbitrary sort.
- List active admin invitations separately: `GET /api/v1/iam/organizations/{organizationId}/invitations`; join current rows by `membershipId`. Invitations are not the membership lifecycle status.
- Invite existing eligible user: `POST .../invitations`, `{email, reasonCode}`. Resend/cancel invitation and suspend ACTIVE membership use only the accepted fields, expected versions, CSRF, and `Idempotency-Key`.
- The four membership states are `PENDING_INVITE`, `ACTIVE`, `SUSPENDED`, `REMOVED`. This FE slice exposes only confirmed-ready admin operations: invite, resend/cancel pending invitation, and suspend ACTIVE. Recipient acceptance is outside this admin page. Remove/resume/reinvite and rights-review are BLOCKED by A7 prerequisites.
- Backend is authoritative for read/manage permissions, Organization scope, state transition/version checks, and last-eligible-ADMIN protection. In particular, HTTP 403 is a denial, never an empty list. No optimistic mutation success.

## Implementation sequence

1. Contract types/parsers and API service: exact schemas, path validation, BFF URLs, CSRF/idempotency headers, safe error mapping. Add contract/service tests first.
2. TanStack Query hooks: organization/user-scoped keys, no stale-data display after failed/denied reads, bounded timeouts, no automatic mutation retries, invalidation only after valid acknowledgements. Add hook tests.
3. TailAdmin UI: member directory, approved status filter, invitation form/pending-invitation actions, suspend confirmation/reason selection, state-specific errors. Keep components, lifecycle presentation logic, hooks, and service separate. Add localized messages and UI tests.
4. Acceptance and verification: full FE check, responsive browser smoke (where tooling permits), RTL/dark review, diff/code review. Record BE integration and audit proof as NEED VERIFY.

## UI direction

Use the user-approved TailAdmin direction and UI UX Pro Max accessibility/responsive guidance. Keep existing theme tokens and Outfit type. Show only fields from the accepted contract. No illustrative member rows, fake counts, or success simulation in production.

## Completion gate

- Tests cover list (all four states, empty/loading/denial/malformed/scope changes), invitation, each exposed lifecycle operation, idempotent retry identity, and documented server conflicts/errors.
- Verify the FE makes no permission decision from roles/title, hides stale data after scope changes/denial, and never claims email delivery or audit persistence.
- Run `npm run check`, inspect complete diff/status/history and security-sensitive changes, and use the required code-review process.
- Do not push, create/merge a PR, alter Jira status, or report C-03 Done. Final report uses COMPLETED / BLOCKED / NEED VERIFY / NEXT STEPS.
