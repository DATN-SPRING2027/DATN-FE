# Shared sign-in

`/signin` is the single password sign-in form for account users and system
administrators (`PLATFORM_OPERATOR`). `/platform/signin` is a compatibility
redirect to `/signin`; it renders no separate login form. Platform expiry and
logout return to `/signin`.

The frontend reuses the existing backend contracts without changing payloads,
cookie attributes, grants, or authorization:

1. Submit email/password to `POST /api/v1/auth/platform/login`.
2. Only `403 FORBIDDEN` (credentials accepted but no current platform assignment)
   continues to `POST /api/v1/auth/login`. Incorrect credentials, rate limits,
   validation errors, network failures, and other permission errors stop the flow.
3. Verify the cookie session using `/auth/platform/me`, falling back to `/auth/me`
   only on 401. A verified PLATFORM session opens `/platform`; account and
   organization sessions retain Organization selection and safe invitation returns.
4. Clear prior private query cache when a login succeeds.

Normal password users therefore make two credential requests, both subject to
existing server rate limits. No role picker, email allowlist, client-side role
inference, or new privilege is introduced. Existing Google sign-in remains the
account onboarding flow; this change does not add Platform Google authentication.

No backend, database, migration, or deployed security configuration changes.
