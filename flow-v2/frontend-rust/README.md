# Flow V2 Rust migration / motion direction

Status: **separate candidate**, not deployed and not a full feature-parity replacement.
The existing Cloudflare Worker, endpoints, advertising unit IDs, live site, PWA and university/admin/transit systems have not been changed.

## Target architecture

- Frontend: Leptos 0.8 Rust CSR, compiled to WebAssembly via Trunk.
- Backend: Cloudflare workers-rs, initially an API facade; must migrate NEIS and other provider services before any "all-Rust backend" production claim.
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
