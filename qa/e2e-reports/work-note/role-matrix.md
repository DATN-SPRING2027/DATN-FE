# Work Note Role Matrix

Roles are taken from the local IAM/platform data and the actual API permission objects. “Member” in the project sidebar reflects the organization membership role; Leader A’s project role is `TEAM_LEADER` even though the sidebar says Member.

## Synthetic actors

| Actor | Identity / ID | Stored authority | FE label / context | Membership |
|---|---|---|---|---|
| Manager A | `admin@datn-dev.example.test` / `850dbf46d92a708bd0c55194` | Organization role `ADMIN` | Manager | Org A; Project A accessible |
| Leader A | `leader@datn-dev.example.test` / `3682eefb2892ba1da34db022` | Org `MEMBER`; Project `TEAM_LEADER` | Member in organization shell; Leader review/config actions in project | Project A |
| Member A | `member@datn-dev.example.test` / `d4bb2c495a7d81ff75481713` | Org and Project `MEMBER` | Member | Project A |
| Member B | `member-b@datn-dev-b.example.test` / `6adc06f38cd59a96cc5599f5` | Org and Project `MEMBER` | Member | Org B / Project B only |
| Leader B | `leader-b@datn-dev-b.example.test` / `6adc0c93a7bb0d84aa7ab4b1` | Org `MEMBER`; Project `TEAM_LEADER` | Member in shell; Leader project actions | Project B |
| Org A outsider | `outsider@datn-dev.example.test` / `6adc06f38cd59a96cc5599f6` | Org `MEMBER`; no Project A membership | Member | Org A only; denied access to private Project A |
| Platform Operator | `operator@datn-dev.example.test` / `6adc06f38cd59a96cc5599f7` | Platform context, `organization.create` | Platform Operator | No active organization session |

## Effective authorization observed

| Feature / action | Member | Project Leader | Organization Admin / Manager | Platform Operator / outsider |
|---|---|---|---|---|
| Task Note: view | 200 for own project/task | 200 | 200 when project accessible | Platform operator 401 without org session; outsider 404 `PROJECT_NOT_FOUND` |
| Task Note: create | POST 201 | POST 201 | POST 201 | 401 / 404 |
| Task Note: edit/delete | No controls; direct PATCH/DELETE 404 | No controls/routes | No controls/routes | No controls/routes; access denied at project boundary |
| Project Document: view | GET 200 | GET 200 | GET 200 | Cross-org/outside-project GET 404 |
| Project Document: create/edit/submit own | Create 201; own draft edit and submit 200 | Project review permissions observed; leader created/reviewed as policy allows | Create 201; own draft edit 200; submit 200; `canReview=false` | No accessible project; create action hidden after denied response |
| Project Document: approve/request changes/reject | No review buttons; direct approve 403 | Review buttons available; lifecycle actions 200; comments required for changes/reject | No review controls; direct approve 403 | Project document API 401 / 404 |
| Project Document: archive | No archive action | Approved document archived 200 | No review/configure action | Denied at project boundary |
| Work Report: view own / project | Own report 200; cross-org Project A request 404 | Project reports available for review | Settings visible 200; another member’s report detail 404 | Platform 401; outsider 404 |
| Work Report: create/edit/submit own | Save 200; reload preserved all fields; submit 200 | Review role | Own draft save 200; reload preserved all fields; submit 200; `canReview=false` | Denied |
| Work Report: approve/request changes/reject | No review UI; direct self-approve 403 | Review UI; actions 200; request/reject require comment | No review UI; direct approve 403 | Denied |
| Work Report: configure frequency | UI control absent; PATCH 403 | UI control present; valid PATCH 200 | `canConfigure=false`; button absent; PATCH 403 | No project session/access |

## Evidence and interpretation

- Work Note authorization is enforced by the BE. FE visibility is not treated as the security boundary: negative cases were sent to the authenticated API.
- The Org A outsider authenticated successfully and held an active Org A session, but had no Project A membership. Direct Task Note, Project Document, and Work Report requests all returned 404 `PROJECT_NOT_FOUND`, with no title/content response.
- Member B used Project B successfully; direct Project A document, report, and task-note requests returned 404. Task B under Project A also returned 404 `TASK_NOT_FOUND`.
- The platform account authenticated in `PLATFORM` context with `organization.create`. It has no active organization session, so Work Note capture API returned 401 `UNAUTHORIZED`. This does not grant tenant access.
- Current model does not define Task Note edit/delete actions, nor document file upload/download/delete. These are recorded as unavailable rather than presumed-denied permissions.
