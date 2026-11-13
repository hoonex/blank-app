# Flow Current Status

> **2026-11-13 KST — LIVE native kinetic / magnetic infinite date rail:** Cloudflare Worker `blank-app` version **`94994baf-8fe6-4efa-8d14-7f79cfa3afbc`** serves immutable Rust release **`8c024bcf54e5e414607633e7f90ba8daee4289d4`** (branch `flow-v2-monograph-v4-443dd5794e76`). Source `443dd5794e76051d04d507f8c8261bf8c5c3aa4f`; Chromium/Trunk run `43342438372` **passed seven viewports**, including real CDP touch left/right kinetic scrolling, magnetic CSS center snap, ongoing 181-date cache rebasing, return-to-today, and no adjacent tab gesture collision. Screen captures `today-fold-1536x960.png`, `today-fold-390x844.png` and `today-fold-844x390.png` visually reviewed. Dates move using **native browser momentum + `scroll-snap-type:x mandatory`** (browser-defined deceleration/snap threshold; no custom fixed velocity constant), and a 181-cell rolling window recenters once settled, so dates remain navigable indefinitely. It retains 5/7/11 visible-day density, original marked Today state and native app School/University/bus behavior. Cloudflare preview and live root verified new `flow-school-web-9f65b1a72b74471d.js` + `style-57854dd3cb4cce96.css` and WASM mount. **Previous production Worker version for rollback:** `e272e8fc-cdc7-4c57-b32b-56f9a82be987`. PR #273 remains draft/unmerged, as was the previous production UI. Physical-device browser momentum and dynamic Android toolbar still need user-device acceptance.

> **2026-11-13 KST — Latest VERIFIED LIVE responsive date release:** Cloudflare Worker `blank-app` version **`e272e8fc-cdc7-4c57-b32b-56f9a82be987`** serves immutable Rust static release `8edad6033f0d518e6b397893d7c6691730df62b5` (`flow-v2-monograph-v4-bf2324c41c56`) at **https://blank-app.agfvrd.workers.dev/**. Verified Rust/Chromium CI `43339873290` passed **seven** viewports, including **1536×960 from the user's Galaxy Tab screenshot**; final capture visibly shows full unclipped `11.13`, centered labeled “오늘”, and 11 equally spaced dates across the full hero width. Other widths show 5 or 7 dates. Date rail follows finger during touch and one swipe can move multiple days by distance; a quiet “오늘로 돌아가기” appears when away, including mobile landscape. Preview and production browser rendering verified new JS `flow-school-web-9c7186877f120f5c.js` / CSS `style-b524a04a0eefda2f.css` / Rust WASM, original University route HTTP 200 and BIS stop search (11 real hits). **Previous production Worker** for rollback: `d276815e-cd8f-4018-9df0-3eb35d92d7c4`. Existing native timetable editor, menus, events, bus info, and University-only visible external link retained. NEIS official catalog research below is **planning only**, not newly integrated data.

> **2026-11-13 LIVE — Native School UI, University-only link:** Cloudflare Worker `blank-app` version `d276815e-cd8f-4018-9df0-3eb35d92d7c4` serves immutable release `c96fc8a5f80a9e82f22ec9486e5b6f835133abe7` at the unchanged https://blank-app.agfvrd.workers.dev/ URL. Rust source `636f782e849f4c3dd65b9771b0bde2e360a9fc36` and browser matrix run `43334884116` **passed on all 6 viewports**, including a native 1–9 period timetable editor with local persistence, reload and official-data restoration. Every old Flow/Transit/School Info link and "previous version" message is removed from the Rust UI; the **only** UI anchor is `/university`. The older routes may still resolve for compatibility but are no longer exposed. Production Browser Rendering verified new JS `flow-school-web-21ea350cd6a75012.js`, CSS `style-f9f6bb3ab8545581.css` and app mount. Existing public bus-source proxy preserved. **Previous Worker rollback:** `5840c44b-27aa-4cfc-a320-45051adb82d9`. School timetable overrides are **device-local, not cloud-synced**; this migration does not assert all legacy-only features are implemented. PR #273 remains draft, unmerged.

> **Latest verified production patch — 2026-11-13 KST:** Cloudflare Worker `blank-app` **version `5840c44b-27aa-4cfc-a320-45051adb82d9`** now serves the same passed Rust release `bf350345ba852081c64cf7e9c61d9164c9820f9f` and normalizes two cryptic BIS statuses (`전`, `전전`) to **‘접근 중’**, displaying the provider's remaining-stop count separately. Real preview `/api/bus/arrivals?stopId=7011006700` returned 13 buses and correctly displayed ‘접근 중’; other states and minute counts are unchanged. The previous production version `d63380ab-8424-4b9d-817d-1c66077ea5cd` is the immediate rollback candidate. The original URL remains https://blank-app.agfvrd.workers.dev/; full details [BUS_SOURCE_AND_STATUS.md](flow-v2/deploy/BUS_SOURCE_AND_STATUS.md). Physical Samsung Chrome gesture bar remains pending user-device acceptance.

> **LIVE 2026-11-13 KST:** Cloudflare Worker `blank-app` version `d63380ab-8424-4b9d-817d-1c66077ea5cd` now serves the verified Rust release `bf350345ba852081c64cf7e9c61d9164c9820f9f` at the **unchanged** https://blank-app.agfvrd.workers.dev/ URL. Rust source commit `792d9da04540d57b77e3c3e6eae113e72e47937e`; GitHub Actions browser CI run `43331188145` **passed**. Changes include genuine low fixed floating bottom nav with adequate page-end padding, mobile logo top/line-height, no visible mobile month chevrons (touch-swipe to change months), and post-tab DOM scroll reset. Flow's `School` tab now includes live Daegu BIS stop-search and arrival data, locally saved favorite and manual refresh via the Cloudflare Worker `/api/bus/*` bridge; public BIS APIs independently returned real data in preview. Production Browser Rendering verified new JS/CSS/WASM and 200 responses for `/`, `/legacy`, `/transit`, `/university`, `/admin`. **Rollback:** prior Worker version `07054114-b7a9-4867-a39b-c1f880134371`. PR #273 remains draft/unmerged; original legacy-only tools stay at `/legacy`. Dynamic address-bar behavior still awaits user's actual Samsung Chrome check. Read [bus source/status](flow-v2/deploy/BUS_SOURCE_AND_STATUS.md) and [next-chat handoff](flow-v2/DESIGN_REFERENCES_AND_RESUME.md).

> **2026-11-13 KST — VERIFIED LIVE:** Existing address `https://blank-app.agfvrd.workers.dev/` serves the **five-day touch carousel + non-overlapping bottom dock** Rust frontend. Cloudflare production Worker version `07054114-b7a9-4867-a39b-c1f880134371`, immutable release pin `6b4047e474e54e7edf2209876d1b5c704f80dc55`, source commit `a129568051c0e26de5c5780c0dcbfac43f85caaf`. Final WASM+Chromium 6-viewport run `43255818992` **passed**; preview and production browser rendering verified new JS `flow-school-web-ccfc802621f311b1.js`, CSS `style-a20f63d55a370120.css` and WASM. `/`, `/legacy`, `/transit`, `/university`, `/admin` HTTP 200. **Previous Worker version for rollback:** `d5d7e086-73fd-4c87-ad30-9036db5c2bbf`. Mobile content scrolling is isolated to `.flow-main`, nav is a non-overlapping flex sibling. **Actual Samsung/Chrome physical-device dynamic browser toolbar not yet verified**. PR #273 remains draft/unmerged; original extras remain in `/legacy`. Resume details: [flow-v2/DESIGN_REFERENCES_AND_RESUME.md](flow-v2/DESIGN_REFERENCES_AND_RESUME.md).

> **2026-11-13 KST — LIVE:** `https://blank-app.agfvrd.workers.dev/` serves **Rust Monograph V5.1** (5-day timetable matrix, muted coral accent, bullet-free centered lunch, fixed mobile tab dock, geometric route entrance, swipe and press interactions). Cloudflare Worker version `d5d7e086-73fd-4c87-ad30-9036db5c2bbf`. Immutable static release `a4cfcfdabe3a21f7b02f4d400b5628d11fe68843` (`flow-v2-monograph-v4-bc5827f5aeea`). GitHub browser CI `43248789531` passed across 6 viewport sizes including mobile vertical-scroll tab bar, nav drag and day/week drag. Cloudflare preview and live rendering verified Rust JS/CSS/WASM and route `/`; `/legacy`, `/transit`, `/university`, `/admin` all HTTP 200. PREVIOUS production Worker version `60641088-6f68-48e4-9826-13cc4e49ccf8` is rollback. Feature PR #273 remains draft/unmerged, backend Rust migration incomplete, original school features still in Legacy. **Physical Samsung browser dynamic toolbar behavior remains untested**, despite emulation checks. 19 design references and next steps: [flow-v2/DESIGN_REFERENCES_AND_RESUME.md](flow-v2/DESIGN_REFERENCES_AND_RESUME.md).

> **Production status — 2026-11-12 KST:** New Flow Rust Monograph V5 release `ee45530dd9ba94318bbf12678218f29701b0c8ed` has passed six-viewport Chromium and actual touch swipe tests. Live deployed Cloudflare version `60641088-6f68-48e4-9826-13cc4e49ccf8` serves that pinned release at the unchanged canonical URL `https://blank-app.agfvrd.workers.dev/`. Former V4 rollback Worker version: `b217a752-5ab8-4f29-8b3a-c9a10fd22703`. `/legacy`, `/transit`, `/university`, and `/admin` preserve the original UIs. PR #273 stays draft; server-side Rust NEIS API and feature parity remain incomplete.

Updated: 2026-09-07 (KST)

This file describes the current operational baseline. Historical implementation notes belong in `FLOW_PROJECT_HISTORY.md`; GitHub `main`, deployed Cloudflare health checks, and current CI remain the source of truth when they disagree with prose.

## Production and routing

- Canonical production origin: `https://blank-app.agfvrd.workers.dev`
- Cloudflare Worker: `cloudflare-worker.mjs`
- Cloudflare configuration: `wrangler.jsonc`
- School clean routes resolve to `/index.html`.
- University clean routes resolve to `/university/index.html`.
- `/admin` resolves to `/admin/index.html`.
- Vercel is retained only as a secondary preview/compatibility target through `vercel.json` and `scripts/vercel-static-build.mjs`; it is not the canonical production origin.

## Current product surfaces

### School

The School experience includes Today, schedule/week flows, transit, school information, settings, responsive phone/tablet/desktop layouts, PWA caching, and the shared Flow navigation/material system.

PR #219 integrated School Settings into the common document/shell flow instead of a standalone fixed overlay and hardened Samsung Internet/Android WebView host-dark behavior. The shared-shell and responsive Settings contracts are part of the active CI baseline.

### University

The University experience includes university search/profile, timetable, dashboard widgets, campus map/route editing, settings, and related responsive browser audits. Supabase Edge Functions provide University search/campus APIs.

The Everytime public-share import depends on an external service and is treated as a non-blocking availability probe. Core University search/campus API failures remain blocking.

### Transit

Transit is currently focused on Daegu behavior. Keep live-arrival freshness and official route geometry distinct from deterministic/fallback presentation; do not present synthetic data as live. The checked-in official Daegu bus network snapshot remains an explicit data contract and should only be replaced through a deliberate data refresh.

### Admin

The Admin surface remains authenticated and backed by the Flow Admin Supabase function/migrations. Public unauthenticated access to protected admin data is a CI-tested boundary.

## Deployment and cache contracts

- Service worker cache: `flow-school-shell-v16`
- Cloudflare School recovery target must match the active service-worker cache.
- Cloudflare release IDs use the `school-shell-vN-YYYYMMDD` format and are exposed through `x-flow-release`.
- School critical production assets use no-store/revalidation behavior at the Cloudflare layer.
- `manifest.webmanifest`, `sw.js`, clean-route shells, and release/cache IDs must be reviewed together when PWA shell behavior changes.

## CI baseline

- GitHub JavaScript actions use the current v7 generation for checkout/setup-node/upload-artifact where applicable.
- Audited Node jobs use Node 24.
- Browser audit workflows use Playwright 1.63.0.
- Wrangler dry-run verification is pinned for reproducibility rather than floating on every CI invocation.
- Dependabot tracks GitHub Actions weekly.

External availability checks must not mask application regressions. Core runtime/API contracts remain blocking; third-party availability probes may be non-blocking when the application cannot control the dependency.

## Maintenance rule

Before changing deployment-sensitive code, re-read `AGENTS.md`. Keep Cloudflare and Vercel-preview route contracts aligned, avoid direct edits to `main`, and verify the canonical Cloudflare deployment after merge.
