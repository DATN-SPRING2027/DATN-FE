# DATN-91 — R5 development implementation

## Baseline and scope

Source: the user-supplied Project Lead response titled “tiếp tục triển khai,
không dừng development”, supplied on 2026-10-19. It supersedes the earlier
fixture-only restriction and authorizes implementation, FE–BE integration and
acceptance-test work for Create, List, Detail, Update, Archive and Restore in
development. This is the local FE R5 implementation baseline, not a claim that
the owning OpenAPI or production release has been signed off.

R4 blob `28ad1139ca72f27d7a9a5efe727c14fcf2e72e2c` remains unchanged and
`PROPOSED_NOT_APPROVED / NOT_READY`. The implementation consumes its wire schema
as amended by the supplied B1–B8 decisions. No membership, hard deletion,
move/merge, history endpoint, permission alias or backend change is introduced.

## Run development integration

```sh
TEAM_FOUNDATION_DEV_INTEGRATION=true npm run dev
```

Configure server-only `CONTINUUM_API_BASE_URL` to the independently prepared
development Gateway. Use the normal authenticated organization session. A
development-only Teams tab appears on the Project page. It embeds the API-backed
`TeamsWorkspace` in the project context; the separate `:4173` fixture preview
uses the same Project Overview shell without making Team API requests. UI paths:

- `/projects/{projectId}/teams`
- `/projects/{projectId}/teams/new`
- `/projects/{projectId}/teams/{teamId}`
- `/projects/{projectId}/teams/{teamId}/edit`

The server layout and BFF independently require development opt-in.
`NODE_ENV=production` always denies, even with the flag `true`. With the API
flag off, the Project page shows the fixture workspace in development. When the
API flag is on, add `?teamPreview=fixture` to the Project URL to inspect the same
fixture workspace without changing `.env.local`; normal requests continue to use
the API. The `:4173` fixture preview remains separately available for visual
review and shares the app shell and Team directory presentation components.

## Wire implementation

| Operation | Gateway path (under `/api/v1`)    | Method |
| --------- | --------------------------------- | ------ |
| Create    | `/iam/projects/{projectId}/teams` | POST   |
| List      | `/iam/projects/{projectId}/teams` | GET    |
| Detail    | `/iam/teams/{teamId}`             | GET    |
| Update    | `/iam/teams/{teamId}`             | PATCH  |
| Archive   | `/iam/teams/{teamId}/archive`     | POST   |
| Restore   | `/iam/teams/{teamId}/restore`     | POST   |

The browser calls `/api/backend`, never direct IAM/SAG URLs. List uses page 1,
pageSize 20 and status ACTIVE by default; ARCHIVED/ALL reset to page 1. No client
sort/search or speculative count is added. Ordering remains createdAt DESC, id
DESC from the backend. Team responses are no-store, enforced at the BFF too.

The typed service validates response scope/public fields and strong server ETags
before using resource data. Internal fields such as archive reason and member
data are projected out. Create sends name/code/optional description; update sends
only changed name/description. Code and parent are immutable. Clearing description
explicitly sends null; unchanged null is omitted on update. Unicode validation
uses the selected normalization and code-point lengths rather than raw maxLength.
Archive/restore require a validated reason and explicit confirmation.

Each command captures its UUID key, canonical body/path/method and server ETag
for update/archive/restore. The BFF forwards If-Match, Idempotency-Key and CSRF,
and returns ETag/Idempotency-Replayed. Cookies are relayed; browser-supplied
organization/user/role/permission headers are not promoted to trusted identity.

Controls request an operation; they are not grants. No role/creator/public Project
inference is used. A read result is not proof of a write grant. Backend auth,
action, deny and parent checks remain mandatory. Denied/stale mutations stop
submission and retain input. Hidden-resource 404 and visible-action 403 come from
the backend, never a client choice. Server text/details are not shown in error UI.

## Recovery and caching

Mutation retries are never automatic, including on 401. Lost/unverified responses
or 5xx freeze the draft: explicit retry sends the identical command/key/precondition.
Within the QueryClient session, unresolved commands survive form unmount, keyed
by actor/organization/project/operation/resource. Pending requests cannot be sent
again; expiry after 24h requires reconciliation rather than a new key. Successful
commands invalidate only their original actor/project scope. Detail focus and
reconnect refetch are disabled to preserve drafts; route entry and explicit
refresh fetch anew.

This is not a durable cross-reload recovery journal. Command state is memory-only
and is lost on hard reload/new browser session. No token or command payload is
persisted in browser storage. Runtime all-writer, expiry/CAS and ambiguous-commit
recovery guarantees still require backend evidence before release.

## Evidence and remaining release work

FE tests cover service serialization with mocked HTTP responses, all six BFF
routes, CSRF/concurrency headers, context forwarding, production bypass rejection,
UI success/validation/denied/empty/network/pending states, stale versions and
same-command recovery after unmount. They do not execute Mongo transactions or
prove authorization in an independently deployed backend.

Concrete backend mismatches observed in this checkout:

1. `DATN-BE/src/services/iam/iam.module.ts` does not register Team controller,
   service or repository. `test/team-foundation-runtime-gate.e2e-spec.ts` explicitly
   checks this absence. This task does not enable the backend runtime gate.
2. `application/teams/team-authorization.policy.ts` and Mongo authorization evidence
   still check `team:children.manage`; the new baseline selects
   `team.children.manage`. No FE alias is added; IAM owners must reconcile it.

Live FE–Gateway–IAM–Mongo acceptance is not claimed. Development owners can
connect this FE to their isolated implementation. Production stays blocked until:

- Explicit grant provisioning and per-operation denial evidence.
- Authoritative parent/admission sources, writer inventory, races and fencing.
- Same/different-payload idempotency, concurrency and ambiguous-commit recovery.
- Direct canonical audit in the same session/transaction: rollback, redaction,
  durability and dedup; no Team outbox is added here.
- Gateway/BFF principal, CSRF, headers and non-disclosure evidence.
- Target-environment DB/index/legacy-data preflight and migration evidence.

No backend, schema, audit, migration, database or deployment changes were made.
Per user instruction, the existing `main` checkout is edited without creating a
branch, staging, committing, pushing or merging. Jira/authority dispositions and
runtime release are not changed by this delivery.

Run all checks with `npm run check`. Focused suite:

```sh
npm test -- --run src/components/teams src/lib/queries/teams src/app/api/backend/team-proxy.spec.ts src/lib/teams-development.spec.tsx
```

### Verification recorded 2026-10-19

- `npm run check`: PASS, including lint, typecheck, 512 tests / 62 files and build.
- R5 focused suite: 61 passing tests / 4 files; prior 16 fixture tests remain separate.
- Final production build after strong-ETag validation: PASS.
- Actual loopback HTTP against `next start` with the development flag true:
  all six Team operations returned 404 and no-store. The temporary server was stopped.
- Production-gate mutation experiment: replacing the development environment check
  with production was detected by the gate suite; source restored before passing tests.
- `code-review-and-quality` review: no blocking findings for FE development delivery;
  live backend authorization/transaction/audit and durable recovery are not certified.
- `git diff --check`: PASS. Current branch/base `main` / `374de36`; no staged
  changes, commits, new branches, pushes or merges. BE and Document remain untouched.
