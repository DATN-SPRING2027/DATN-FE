# Platform rate-limit BFF dependency

The Platform rate limit introduced in [DATN-BE PR #103](https://github.com/DATN-SPRING2027/DATN-BE/pull/103)
returns HTTP 429 and retry/budget metadata through IAM and Gateway. Browser
requests pass through the Next.js BFF in this repository, so both changes are
required to accept the complete browser-facing flow.

Previously the BFF preserved status 429 but dropped `Retry-After`,
`X-RateLimit-Limit` and `X-RateLimit-Reset`. The response-header allowlist now
forwards these three headers unchanged when present. It does not manufacture
missing headers, retry requests or change status/body. Application UI is unchanged.

Regression tests invoke the exported GET/POST catch-all route with a mocked
upstream response. A 429 response carrying `45`, `120`, `1792972860` must retain
all three values after BFF forwarding. Additional cases verify budget metadata on
200, absent metadata on 503, and rejection of an unallowlisted upstream header.
These fixtures are not evidence of a live authenticated FE–Gateway–IAM–Redis
request exceeding the production limit.

There are no database, migration, configuration, dependency, authentication or
permission changes. The header allowlist remains explicit. Rollback consists of
reverting this BFF patch; backend enforcement continues to apply, but browsers
would again lose retry/budget metadata.

This patch does not approve or change the upstream 120-read/20-write-per-minute
policy. The Product/Owner decision reference requested in review still needs to
be supplied before that policy is marked approved. The backend PR should link
this companion FE/BFF change and state its verification and remaining limitations.
