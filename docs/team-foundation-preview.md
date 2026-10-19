# DATN-91 — integrated fixture preview

The original fixture-only delivery is retained as a design reference. Its earlier implementation restriction is superseded by the user-supplied Project Lead response: implement/integrate/test all six operations in development; production release remains controlled.

See [R5 development implementation and evidence](team-foundation-r5-development.md) for the current delivery. This preview is not live integration evidence.

```sh
node node_modules/vite/bin/vite.js --config previews/team-foundation/vite.config.ts
```

Open `http://127.0.0.1:4173/`. The Vite harness reuses the app's `AppSidebar`, `AppHeader`, `Backdrop` and `ProjectOverview`, then mounts the fixture Teams UI in the project context. It uses fixtures only and never sends Team API requests or writes browser storage. Use `?scenario=denied` (or `loading`, `empty`, `network`, `validation`, `save-denied`, `save-network`, `save-pending`) to inspect the corresponding state; use `?theme=dark` or `?dir=rtl` for visual checks. The local account and organization come from isolated static adapters. `TeamPreview` keeps fixture mutations in the current page session. Its presentation/boundary tests remain separate from the R5 service, proxy and development UI tests. Vite is supplied by existing dependencies; no dependency/lockfile update is required.

The chosen Shadcn Admin visual direction uses TailAdmin primitives and theme tokens. No Shadcn package or copied source was introduced. English is the sole currently enabled application locale; copy remains in project translation dictionaries.

The fixture Team row menu is intentionally limited to **View** and **Delete**. Delete asks for a short confirmation and removes only the selected fixture from the current preview session; it does not represent or call a production Team lifecycle operation. The app and preview share the same directory table, action-menu and detail-dialog components. With the development API flag off, the authenticated app can show this fixture workspace at `/projects/{projectId}?teamPreview=fixture`; with the API flag on, the app uses the contract-backed workspace and its lifecycle label remains **Archive**.
