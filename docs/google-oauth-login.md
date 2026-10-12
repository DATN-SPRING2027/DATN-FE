# Google sign-in and signup

The Google button on both auth screens navigates to the same-origin BFF route
`GET /api/auth/google`. Do not point the browser at the Nest API directly:
the FE BFF and backend Gateway must preserve the 302 response and forward
OAuth cookies. Configure the backend `GOOGLE_CALLBACK_URL` to the exact FE
callback URI, such as `http://localhost:3000/api/auth/google/callback` when the
frontend is served on port 3000.

The callback BFF forwards the browser-bound state cookie to IAM and relays the
normal application session cookies. The state cookie is encrypted,
`__Host-` prefixed, Secure, HttpOnly, SameSite=Lax, scoped to `/`, and has no
Domain attribute. Google access/refresh tokens stay on the backend and are not
persisted. If a verified account has more than one active
Organization Membership, the user selects one and performs a fresh OAuth
round-trip; IAM verifies the selected membership again.

The callback BFF creates an `x-request-id` and passes it through the Gateway to
IAM. Its structured `google_oauth.callback` events report backend response and
session-cookie relay status without recording query parameters or cookie
values. Next development-server request logging ignores this callback path so
the automatic request line does not print Google's authorization code or state.

A Google registration creates only a User identity. It does not provision an
Organization, membership, role, or platform permission. Users without active
Organization access need an administrator invitation. See the
[backend setup and security notes](../../DATN_BE/docs/google-oauth-login.md)
for provider registration, configuration, account linking, and migration steps.
