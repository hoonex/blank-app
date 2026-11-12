# Deployed Rust Flow bridge (user-authorized early rollout)

Two immutable public-source pins:
- Rust WASM, JS and CSS: `516f2ca51236ba1f3794eaa441bdea64713004d4` (`flow-v2-kinetic-static-prod-20261112`)
- Legacy complete site: `b1ac095b47baa0c09430559bf127e7c873fa9263` (`main` as of 2026-10-20, verified same index.html byte count as prior production assets: 17899)

Origin proxy uses no Cloudflare Static Assets binding. Reason: existing `blank-app` Worker had `ASSETS` with `serve_directly: true`, and `keep_assets:true` preserved `run_worker_first:false`; the Worker only ran for unmatched routes while `/` silently served the old index. A prior attempt to upload with `assets.config.run_worker_first=true` plus `keep_assets=true` was accepted but version runtime still reported `raw_run_worker_first:false`. Replaced route handling with assetless Worker and SHA-pinned old content to avoid deleting essential legacy functionality.

Routes: `/` (Rust), `/v2` (Rust), `/legacy` (old School), `/transit` (old school transit), `/university` (old University), `/admin` (old Admin), `/flow-v2/frontend-rust/dist/*` (Rust static). All other public assets are provided from pinned old source with MIME classification, same-origin responses and edge caching. `/sw.js` remains the exact old file; the old SW uses network-first fetch for navigations.

**Caveat**: Proxying GitHub raw means upstream availability is required on cache misses. It is a temporary deployment arrangement; later migrate all static files to Cloudflare's native asset upload path. This deployment is NOT the full Rust backend migration: Supabase is still used for school API. Keep the feature PR draft. Full subject edit, allergy, offline PWA and other legacy-specific controls remain through `/legacy`.

Emergency rollback: previous Cloudflare Worker version `5525fd47-f635-463f-82b3-159945d79f16` or later intact-ASSETS version `19f5668c-3641-4eed-bcf6-57e5b4c8f170` through the Cloudflare deployments API. Do not merge or remove legacy source while unfinished.

## Monograph V3 update — 2026-11-12

The new V3 frontend uses a single rounded shape language: 28px major surfaces, 16px item hover shapes and pill controls. Removed giant F ornament, fake timetable arrows, repeating technical indices and overly long intro wipe. Rust UI automated checks passed for mobile portrait, landscape, tablet and desktop. The pinned standalone GitHub Actions static release is `flow-v2-monograph-v3-20261112` at `516f2ca51236ba1f3794eaa441bdea64713004d4`. Retain the previous Cloudflare Worker versions as rollback options.

## V4 visual refinement — ad02e0f5001f731590f1e8700b7d61a697e0f0bd

- Published GitHub Actions release branch `flow-v2-monograph-v4-624aec2f265c`; immutable commit `ad02e0f5001f731590f1e8700b7d61a697e0f0bd` with verified `index.html`, `*.wasm`, `*.js` and `*.css`.
- Rounded monograph language preserved, no new ornamental cards. Date selection changes the existing contextual event sheet. Current day now uses time-correct labels; calendar event filtering matches the student's grade.
- Browser smoke passed on 390x844, 844x390, 768x1024, 1024x768, 1366x768 and 1920x1080; includes clicked date detail, theme, mask transition, keyboard/ARIA controls, reduced-motion, horizontal overflow.
- Prior live V3 static pin `516f2ca51236ba1f3794eaa441bdea64713004d4` retained in public release history. Deployment bridge now references the new pin and can be rolled back to previous Worker version if necessary.

## V4 final polish release 314bd256ae5e

- Immutable GitHub static branch `flow-v2-monograph-v4-2a7ff123d2d5`, commit `314bd256ae5e8f705a46b76509c92e14a2559184`, built from Rust source commit `2a7ff123d2d57484979a0fed0847db4e684f37aa`.
- Final small-screen design: event labels below day numerals become compact high-contrast 6px status dots, while the selected-day panel displays the event's full name; detail-to-calendar gap reduced to 10px to keep the floating dock clear.
- Production deploy sequence: verify GitHub static files, run Rust browser smoke on six viewports, publish preview Worker, verify preview SSR-equivalent hydration and legacy path, then update `blank-app` Worker.
- Previous release available for rollback: `ad02e0f5001f731590f1e8700b7d61a697e0f0bd`.

## Verified final production Worker version

- Cloudflare deployed version: `b217a752-5ab8-4f29-8b3a-c9a10fd22703` on `blank-app.agfvrd.workers.dev`.
- Prior intact live Monograph V4 version (rollback target): `f26cd9af-baa9-4653-9c95-d5b26c21b6e8`. Earlier production Monograph V3: `eccc4d87-b287-4d10-9654-58dee546c599`.
- Cloudflare Browser Rendering verified final root `/` contains `style-a5b5c26dabd3c61b.css`, `flow-school-web-80fe49608c9f505a.js`, mounted WASM, and rendered onboarding. Legacy, Transit, University and Admin all responded HTTP 200.
- Rust CI passed run `43218336207` on source `2a7ff123d2d57484979a0fed0847db4e684f37aa`, and static publish run `43218325272` succeeded.
