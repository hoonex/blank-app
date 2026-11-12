# Deployed Rust Flow bridge (user-authorized early rollout)

Two immutable public-source pins:
- Rust WASM, JS and CSS: `4edbec6ae36837aec3a581fb2f41d81efaba4d61` (`flow-v2-kinetic-static-prod-20261112`)
- Legacy complete site: `b1ac095b47baa0c09430559bf127e7c873fa9263` (`main` as of 2026-10-20, verified same index.html byte count as prior production assets: 17899)

Origin proxy uses no Cloudflare Static Assets binding. Reason: existing `blank-app` Worker had `ASSETS` with `serve_directly: true`, and `keep_assets:true` preserved `run_worker_first:false`; the Worker only ran for unmatched routes while `/` silently served the old index. A prior attempt to upload with `assets.config.run_worker_first=true` plus `keep_assets=true` was accepted but version runtime still reported `raw_run_worker_first:false`. Replaced route handling with assetless Worker and SHA-pinned old content to avoid deleting essential legacy functionality.

Routes: `/` (Rust), `/v2` (Rust), `/legacy` (old School), `/transit` (old school transit), `/university` (old University), `/admin` (old Admin), `/flow-v2/frontend-rust/dist/*` (Rust static). All other public assets are provided from pinned old source with MIME classification, same-origin responses and edge caching. `/sw.js` remains the exact old file; the old SW uses network-first fetch for navigations.

**Caveat**: Proxying GitHub raw means upstream availability is required on cache misses. It is a temporary deployment arrangement; later migrate all static files to Cloudflare's native asset upload path. This deployment is NOT the full Rust backend migration: Supabase is still used for school API. Keep the feature PR draft. Full subject edit, allergy, offline PWA and other legacy-specific controls remain through `/legacy`.

Emergency rollback: previous Cloudflare Worker version `5525fd47-f635-463f-82b3-159945d79f16` or later intact-ASSETS version `19f5668c-3641-4eed-bcf6-57e5b4c8f170` through the Cloudflare deployments API. Do not merge or remove legacy source while unfinished.
