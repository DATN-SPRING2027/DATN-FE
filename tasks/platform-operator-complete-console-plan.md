# Platform Operator Complete Console — Plan

## Goal

Deliver a usable FE console shell for all 14 requested Platform Operator domains while keeping mutations and data access limited to real, current Platform APIs. Pages for domains without an approved Platform API must explain the exact unavailable capability and must not make a fake request or display mock operational data.

## Scope decisions

- Keep the current server-authorized permissions and existing Organization, IAM health, and bounded audit behavior.
- Reuse the existing Platform Console implementation from the previous FE task branch, then extend it on a fresh branch from `origin/main`.
- Use a single Platform session and the existing same-origin BFF/API client. Do not reuse Organization-scoped User, Membership, Project, invitation, or session endpoints from a Platform session.
- Render all 14 domain entries. Only activate screens/actions backed by the runtime Platform controller/capability matrix and exact permission. The checked-in OpenAPI JSON lags the controller and is recorded as a contract mismatch.
- Never show tenant content, secrets, raw audit records, or fabricated counts/rows.
- Do not change BE, permission semantics, authorization, data models, dependencies, or Configuration scope.

## Work sequence

1. Record the actual API/permission dependency matrix and repository findings in `docs/platform-operator-complete-console.md`.
2. Reuse the previous platform-console commits on this clean `origin/main` task branch.
3. Implement route-aware console navigation and pages for Dashboard, Organizations, Users, Memberships, Projects, Sessions & Security, Platform Health/Services, Jobs/Queue, RAG/AI, Integrations, Incidents, Diagnostics, Audit, and Account.
4. Wire the supported Platform API capabilities for users, organizations, memberships, projects, sessions, dashboard, services, queues/jobs, SAG operations, integrations, incidents, diagnostics, audit, and account.
5. Keep controls disabled or unavailable only where the BE gate/provider/model is genuinely unavailable or the mutation has no approved state model; do not issue fake requests or reuse tenant-scoped APIs.
6. Add/adjust focused component, API, route and behavior tests, then run lint, typecheck, unit tests, build, `npm run check`, and diff/security review.
7. Run a browser-based visual/interaction pass when a browser surface is available; record exact results and any remaining BE/API blockers.

## Acceptance checklist

- [x] All 14 requested domain groups have discoverable routes/navigation and responsive page layouts.
- [x] Every active action calls an existing, platform-authorized API and uses server-returned data; Organization and Membership lists support the API's page contract.
- [x] Unsupported operations are labeled unavailable and expose no callable/fake mutation.
- [x] Organization create/detail/membership behavior and existing health/audit remain compatible.
- [x] User lookup is exact email and does not imply a user directory or status-management capability.
- [x] Audit filtering is limited to the loaded bounded projection; no raw event detail or export.
- [x] Current session identity, effective permissions, and sign-out are available without exposing tokens.
- [x] Loading, empty, error/retry, success, confirmation, permission-denial, and unavailable states are covered.
- [x] No new dependencies, backend changes, Configuration UI, secret access, or tenant-content access.
- [x] `npm run check`, `git diff --check`, security boundary review, and the available browser smoke results are recorded below.

## Known constraints / blockers

The runtime Platform controller and capability matrix include most operations listed in the handoff. The FE consumes available projections and commands, but this task cannot claim live MongoDB/audit verification without a running authenticated BE and test database. The checked-in `docs/openapi/iam-v1.openapi.json` currently covers only login, Organization collection, health, and legacy audit, so it must be synchronized with the runtime controller in a BE-owned task. Invitation commands and Jira test/reconnect remain behind BE readiness gates; SAG model/provider/processing-job detail is not exposed; Organization lifecycle and membership role/remove/restore lack an approved Platform state model. The FE does not call organization-scoped User or Project APIs.
