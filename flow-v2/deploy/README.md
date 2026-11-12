# Flow V2 production bridge

This Worker entrypoint was actually released to the isolated Cloudflare test Worker first. It proxies ONLY a pinned public Github-hosted Rust Trunk build (`4edbec6ae36837aec3a581fb2f41d81efaba4d61`) through the same origin as `blank-app`, while retaining the production static `ASSETS` binding.

- Production school routes: `/`, `/v2`, `/home`, `/week`, `/schedule`, `/school` -> built Rust UI.
- Legacy school: `/legacy`; transit: `/transit` -> old `/index.html` through existing Cloudflare `ASSETS`.
- `/university`, `/admin` -> old HTML shell via same existing `ASSETS` binding.
- Static Rust files: `/flow-v2/frontend-rust/dist/*` -> immutable revision from `raw.githubusercontent.com` with JS/CSS/WASM MIME and cache headers.
- Other static requests -> existing `ASSETS` untouched. `/sw.js` and `/manifest.webmanifest` continue from original assets for compatibility (old browser cache might require refresh).
- Private keys: none. NEIS search & dashboard remain via existing Supabase Edge Function; Rust-native NEIS Worker remains a separate unconnected feature.
- Current documented previous Cloudflare deployment (rollback): deployment `72116fd3-fa54-46d1-86c8-93d431f82068`, version `5525fd47-f635-463f-82b3-159945d79f16`.

Cloudflare upload metadata: `main_module=worker.mjs`, `compatibility_date=2026-11-12`, `keep_assets=true`, `keep_bindings=['assets']`. **Never upload without the preservation fields**; doing so may detach historical production assets. Cloudflare version deployment rollback is the immediate recovery mechanism; restore GitHub source separately in PR if permanent.

Deployment caveats: This is explicit user-authorized early rollout, not a full feature-parity merge. Old school settings, subject overrides, comprehensive media and allergy flows remain in `/legacy`. Existing service worker cache can show stale shell until a browser refresh. The app will depend on pinned Github raw assets until Cloudflare-native assets are later uploaded.
