# Flow V2 Rust migration / motion direction

Status: **separate candidate**, not deployed and not a full feature-parity replacement.
The existing production Cloudflare Worker, advertising unit IDs, live site, PWA and university/admin/transit systems have not been changed.

## Target architecture

- Frontend: Leptos 0.8 Rust CSR, compiled to WebAssembly via Trunk.
- Backend: Cloudflare workers-rs; the preview implements Rust-native NEIS school search, class list, timetable, meals and calendar. Media and Kakao place lookup temporarily forward to original APIs. University, transit and admin still use existing services.
- Bun: tooling/orchestration, tests, future package and release scripts (not the runtime).
- Compatibility: existing localStorage profile keys and original school-data API response shape.
- Routes: Rust frontend lives in `flow-v2/frontend-rust/` until parity and runtime verification.
- Safety: no worker route changes and no production redirect. Existing JS-based V2 preview is still available for comparison.

## Motion DNA

Clear editorial surfaces with bold, bounded motion. Avoid floating clouds, generic gradient hero, or constant decorative motion.

| Interaction | Motion rule | Rationale |
| --- | --- | --- |
| Screen entry | 550ms clip/translate, ease-out | A directional page change with clear continuity |
| Hero heading | 650ms masked rise | Highlight destination, not decorative backgrounds |
| Info columns | 620ms progressive reveal | Establish hierarchy quickly |
| Timetable rows | 420ms lateral reveal | Make new lesson data feel connected |
| Buttons | 200–360ms press & spring | Confirm interaction instantly |
| Route indicator | 420ms spring stretch | Destination follows selection |
| Reduced motion | Effectively zero durations | Accessibility and battery |

Reference reading (interpretations, not copies):
- https://tympanus.net/codrops/hub/tag/page-transition/
- https://tympanus.net/codrops/2026/06/23/podium-building-a-website-where-running-becomes-storytelling/
- https://motion.dev/docs/animate-view
- https://linear.app/

## Testing

`bun run check:rust` requires Rust target `wasm32-unknown-unknown`.
`bun run build:rust:web` additionally requires Trunk.
GitHub Actions `flow-v2-rust-web.yml` checks Rust CSR and builds the WASM bundle.

Known functional gaps before rollout: class list validation, full subject editing, allergies, bell schedules, detailed nutritional modal, media selection, advanced transit, offline PWA, University and AdFit integration. These remain on the old site, not disabled.

## Rust API preview configuration

Add Cloudflare `NEIS_KEY` as a Worker secret; never commit the key. The separate `edge-rust/wrangler.toml` deploys only the Rust preview Worker. It serves `/healthz` and `/api/v2/school?action=search|classes|dashboard` directly from Rust, with documented compatibility actions `media|place` temporarily delegated to the original implementation.

The Rust frontend defaults to the verified original API for its **unpublished** preview. Set `FLOW_RUST_EDGE_URL` at Rust frontend compile time (for example, `/api/v2/school` when both are served on one origin) to use the Rust backend. A Rust frontend and backend together have not yet been production-integrated.

## Visual redesign — Kinetic Edition

The rejected border/card dashboard was replaced on 2026-11-12 with a wholly borderless, kinetic editorial UI. The authoritative visual reference is [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md): Studio Edgar (kinetic black/white type), Codrops/Bisous editorial columns, Codrops clip-path transition choreography, native CSS and reduced-motion. Current layout: full-width dark date hero, giant rising numerals and lime brand shape, continuous flat lesson rows, contrasting lime lunch block, free-standing events, native masked page sweeps, floating mobile dock. Rust owns every interaction and state transition; CSS owns the motion. Zero GSAP runtime.

For visual review use the Playwright artifacts from `Flow V2 Rust web`: 6 viewport screenshots each for Today, Week, Schedule, Settings dark mode and a page-transition mid-frame. The screenshot script resets scroll position **only in tests**, never in the live app. Existing domain and APIs remain untouched.
