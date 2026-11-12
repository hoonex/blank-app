# Flow Current Status

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
