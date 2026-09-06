# Flow Current Status

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
