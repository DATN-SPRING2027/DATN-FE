# Spec: Continuum AI Frontend Bootstrap

## Objective

Create the first runnable frontend repository for Continuum AI. This bootstrap provides the approved dashboard foundation and development conventions without implementing business workflows or inventing backend API contracts.

## Tech Stack

- Next.js 16 App Router, React 19 and TypeScript.
- TailAdmin Next.js Free 2.4.0 with Tailwind CSS 4.
- TanStack Query 5 for server state.
- Zustand for shared client-only UI state.
- next-intl for locale-aware routing.

## Commands

- Install: `npm ci`
- Develop: `npm run dev`
- Lint: `npm run lint`
- Type-check: `npm run typecheck`
- Build: `npm run build`
- Full verification: `npm run check`

## Project Structure

- `src/app`: App Router routes and layouts.
- `src/components`: TailAdmin and shared presentation components.
- `src/features`: Continuum business features added in later tasks.
- `src/lib`: Shared infrastructure such as providers and the future typed API client.
- `src/stores`: Zustand stores for client-only UI state.
- `docs`: Specifications and architecture notes local to this repository.
- `tasks`: Implementation plans and task checklists.

## Code Style

```tsx
export function KnowledgeList({ items }: { items: KnowledgeSummary[] }) {
  return <ul>{items.map((item) => <li key={item.id}>{item.title}</li>)}</ul>;
}
```

Use strict TypeScript, semantic HTML, accessible interactions, TailAdmin tokens and the `@/*` import alias. Server Components are the default; add `"use client"` only at interaction boundaries.

## Testing Strategy

The bootstrap gate is lint, TypeScript and production build. Feature tasks must add focused unit/component tests and browser tests when behavior is introduced. The exact Vitest and Playwright setup is deferred to a dedicated testing-foundation task.

The imported TailAdmin 2.4.0 theme, sidebar, calendar and menu files have narrowly scoped ESLint compatibility exceptions for `react-hooks/set-state-in-effect`. New Continuum code does not inherit those exceptions; remove each exception when its imported component is replaced or refactored.

## Boundaries

- Always: reuse TailAdmin first, preserve accessibility, run `npm run check`, and keep server/client state ownership clear.
- Ask first: add UI systems, change framework versions, change auth strategy, or introduce an API payload not defined by approved OpenAPI.
- Never: commit secrets, store tokens in browser storage, call SAG directly, or treat frontend guards as authorization.

## Success Criteria

- A clean checkout installs with `npm ci`.
- Lint, type-check and production build pass.
- TailAdmin dashboard runs locally through Next.js App Router.
- TanStack Query and Zustand are available for future feature work.
- Repository history starts with one project-owned commit on `main`.

## Open Questions

- Shared OpenAPI contract and backend base paths.
- Authentication endpoint and cookie lifecycle.
- Which TailAdmin demo pages remain once Continuum feature implementation starts.
- Whether Vietnamese becomes the default locale in the localization task.
