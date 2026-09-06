# Flow

Flow is a static, responsive student dashboard with separate School and University experiences plus an authenticated Admin surface.

## Production

- Canonical production: `https://blank-app.agfvrd.workers.dev`
- Cloudflare Worker entrypoint: `cloudflare-worker.mjs`
- Cloudflare deployment config: `wrangler.jsonc`
- Supabase Edge Functions provide School, University, Transit, and Admin server APIs.
- Vercel remains a secondary preview/compatibility target. It is not the canonical production origin.

## Application surfaces

- School: `/`, `/home`, `/week`, `/schedule`, `/transit`, `/school`
- University: `/university`, `/university/timetable`, `/university/campus`, `/university/school`
- Admin: `/admin`

Cloudflare clean routes are defined in `cloudflare-worker.mjs`. Vercel preview rewrites in `vercel.json` intentionally stay in lockstep with those routes.

## Local development

No application build step is required for the main static runtime.

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

Browser audits install Playwright in CI as needed; there is no root npm application dependency graph.

## PWA and caching

- Manifest: `manifest.webmanifest`
- Service worker: `sw.js`
- School shell cache: versioned by `CACHE` in `sw.js`
- Cloudflare School recovery injection: `SCHOOL_RECOVERY_SCRIPT` in `cloudflare-worker.mjs`

When changing shell/cache behavior, keep the service-worker cache contract, Cloudflare recovery target, and the corresponding CI assertions synchronized.

## Verification

GitHub Actions under `.github/workflows/` cover responsive browser behavior, School real-device layouts, University mode, Cloudflare clean routes, production health, campus maps, transit, and related visual/runtime contracts.

Production-sensitive changes should not be considered complete until the relevant PR audits are green and the post-merge Cloudflare clean-route check confirms the deployed release and critical assets.

## Repository status

See `FLOW_CURRENT_STATUS.md` for the current operational baseline and `FLOW_PROJECT_HISTORY.md` for historical project notes.
