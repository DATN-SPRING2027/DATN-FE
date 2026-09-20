# Continuum AI Frontend

Frontend web application for Continuum AI, an AI-powered platform for continuous project knowledge capture, verification and handover.

## Foundation

- Next.js 16 App Router, React 19 and TypeScript.
- TailAdmin Next.js Free 2.4.0 and Tailwind CSS 4.
- TanStack Query 5 for remote server state.
- Zustand 5 for shared client-only UI state.
- next-intl for locale-aware routing.

The initial UI was imported from [TailAdmin Free Next.js Admin Dashboard](https://github.com/TailAdmin/free-nextjs-admin-dashboard) at commit `4fba02489c93171220c13cd2b44cc0161ff6d2a1`. It is provided under the MIT License retained in [LICENSE](LICENSE).

## Requirements

- Node.js 20.9 or later.
- npm 10 or later.

## Local development

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run check
```

This runs ESLint, TypeScript type checking and a production build.

## Repository boundaries

- The frontend calls the approved Continuum backend/BFF contract; it does not call SAG directly.
- API request and response types must come from the shared OpenAPI contract once approved.
- Authentication tokens must be handled through HttpOnly cookies, never browser storage.
- Reuse or extend TailAdmin components before creating new UI primitives.

See [docs/SPEC.md](docs/SPEC.md) and [tasks/plan.md](tasks/plan.md) for the bootstrap scope and remaining decisions.
