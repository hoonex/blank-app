# Flow V2 — isolated redesign

This folder is a **non-production preview**, not a replacement for the existing Flow site.

## Technical choices

- Frontend: framework-free ES modules, one CSS design system; Bun for build and tests.
- API: existing Supabase school-data function, unchanged and with no keys shipped to clients.
- Rust: experimental workers-rs edge facade in `edge-rust/`, **not deployed** to the production hostname.
- School profile / theme / subject overrides: reuse Flow V1 localStorage key formats. No migration or reset.
- University, transit, admin, AdFit, service worker, domain and other original features remain untouched in the parent repository. The preview links back to classic Flow where parity is not implemented.
- No artificial data. The UI displays empty/loading/error/stale states explicitly.
- The V2 page does **not** register its own service worker, avoiding any production cache takeover.

## Preview

Serve the repository root and open `/flow-v2/index.html`. Running the full existing Worker locally is optional because the frontend uses the existing published school-data API.

```sh
cd flow-v2
bun test
bun run build
```

Building emits `flow-v2/dist/app.js` for future deployment, but the isolated preview intentionally loads the source `app.js` so branch review needs no build artifact.

## Rollout (not yet authorized / not yet complete)

1. Validate actual endpoint contracts and cached/preconfigured profiles in the preview.
2. Bring university, transit, ad placement, accessibility, settings, and offline PWA behavior to feature parity before switching the canonical routes.
3. Validate mobile portrait/landscape, tablets, desktop and keyboard use with browser screenshots and CI.
4. Deploy an isolated Rust Worker for parity/performance tests. Only then consider routing APIs to it.
5. Gate a production switch behind successful checks, with the original Worker/HTML as rollback.
