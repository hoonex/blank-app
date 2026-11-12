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

## V5 swipe / touch / portal release — 2026-11-12 KST

- Built release SHA `ee45530dd9ba94318bbf12678218f29701b0c8ed` from source `e7a06bfa6492cf368ab84e6362382216bd2fe09e`, published branch `flow-v2-monograph-v4-e7a06bfa6492`, with exactly one WASM (`flow-school-web-e928c418a6091364_bg.wasm`), JS (`flow-school-web-42b5c0ff67a86d3c.js`), CSS (`style-10b39c7dee145566.css`) and `index.html`.
- CI `Flow V2 Rust web` run `43242013684`: compile, release, mobile swipe CDP Chromium, six responsive screenshots, reduced motion, dark mode and layout tests **success**. Static publish run `43241801705`: success.
- Live preview Worker `flow-v2-kinetic-preview` version `d8c3979a-d053-42e5-a7fb-e507806f4dcc` verified actual mounted WASM, new JS/CSS and `/`, `/legacy`, `/transit`, `/university`, `/admin` all HTTP 200.
- Original hostname `https://blank-app.agfvrd.workers.dev/` retained. UI gesture logic implemented directly in Leptos Rust using browser TouchEvent, no JavaScript gesture framework.
- Original school/university/admin assets remain pinned at old release `b1ac095b47baa0c09430559bf127e7c873fa9263`, preserving old routes and data integrations. `/legacy` remains the real previous school front end, not a static screenshot.
- Daegu city-run bus information `https://businfo.daegu.go.kr/` is the authoritative arrival link in Today and Settings; old transit remains `/transit`. Do not display invented ETA or draw unverified bus route geometries. Public API keys (if added later) must be stored as Worker secrets.
- Rollback if needed to prior verified Cloudflare Worker `b217a752-5ab8-4f29-8b3a-c9a10fd22703` (V4).

## Verified V5 live release

- Same canonical URL: `https://blank-app.agfvrd.workers.dev/`.
- Current Cloudflare Worker version `60641088-6f68-48e4-9826-13cc4e49ccf8`, 100% traffic; previous V4 Worker version `b217a752-5ab8-4f29-8b3a-c9a10fd22703` retained in deployment history for rollback.
- Exactly tested code release `ee45530dd9ba94318bbf12678218f29701b0c8ed` / `flow-v2-monograph-v4-e7a06bfa6492`; immutable JS `flow-school-web-42b5c0ff67a86d3c.js`, WASM `flow-school-web-e928c418a6091364_bg.wasm`, CSS `style-10b39c7dee145566.css`.
- Real browser on live root: WASM initialized, new style applied, blue-tap highlight reported transparent, `/`, `/legacy`, `/transit`, `/university`, `/admin` all HTTP 200; old School page's `#todayView` and school JS initialized through `/legacy`.
- CDP touch-gesture test on source commit `e7a06bfa6492cf368ab84e6362382216bd2fe09e`, CI `43242013684` passed with six viewports. Static release `43241801705` succeeded.
- No paid Kakao dependency added; the fallback bus link is the Daegu City official BIS, not a made-up ETA.

## 2026-11-13: compact weekly matrix / coral / fixed dock

- Rust source: `819f6b9574ed5d82507c9a6fd6b1fbf2706ab584`; immutable published static branch `flow-v2-monograph-v4-819f6b9574ed`, commit `a4cfcfdabe3a21f7b02f4d400b5628d11fe68843` (same built output as test-source `bc5827f5aeea`).
- Muted terracotta `#D98570`, dark `#E5A492`. Five-day × 7–9-period timetable calendar, weekday selection, bullet-free centered meals, mobile tab dock anchored left/right rather than transform.
- Responsive UI QA: full Chromium run `43248789531` passed at 390x844, 844x390, 768x1024, 1024x768, 1366x768, 1920x1080. Fixed obsolete smoke selector after visual layout migration; first failed run is recorded in Actions and not hidden.
- Prior deployed Rust asset pin: `ee45530dd9ba94318bbf12678218f29701b0c8ed`; use previous Cloudflare deployed version `60641088-6f68-48e4-9826-13cc4e49ccf8` for rollback if new deployment fails.
- Actual Android dynamic browser chrome is not identical to Chromium viewport automation; further real-device touch behavior needs user verification.
- Full 19-link design reference atlas and resume checklist: `flow-v2/DESIGN_REFERENCES_AND_RESUME.md`.

## Verified deployed state (2026-11-13 KST)

- Public URL (unchanged): https://blank-app.agfvrd.workers.dev/
- Cloudflare Worker version: `d5d7e086-73fd-4c87-ad30-9036db5c2bbf`
- Rust static pin: `a4cfcfdabe3a21f7b02f4d400b5628d11fe68843` (verified immutable source SHA)
- CI: workflow `43248789531` passed all 6 browser viewports; earlier stale-selector failure was repaired, not suppressed.
- Preview first, production second: new CSS/JS observed, WASM mounted. Legacy routes `/legacy`, `/transit`, `/university`, `/admin` all HTTP 200.
- Rollback Worker version: `60641088-6f68-48e4-9826-13cc4e49ccf8`; rollback is a separate Cloudflare deployments action, not a GitHub PR revert.
- Open issues: Real Android address bar resizing/scroll interaction still requires a physical-device check; incomplete original-feature parity and native Worker asset migration; original bus information needs its own accuracy/quotas review.
- Reference and resumable-next-task file: `flow-v2/DESIGN_REFERENCES_AND_RESUME.md`.

## 2026-11-13: five-day swipe rail and non-overlapping mobile dock

- Immutable GitHub static release `flow-v2-monograph-v4-a129568051c0`, `6b4047e474e54e7edf2209876d1b5c704f80dc55` with Rust JS `flow-school-web-ccfc802621f311b1.js`, CSS `style-a20f63d55a370120.css` and WASM `flow-school-web-85d2d2af64e82934_bg.wasm`.
- Rust source `a129568051c0e26de5c5780c0dcbfac43f85caaf`, CI `43255818992` passed wasm32 typecheck, Trunk release build and six Chromium viewports including real touch dispatch on the date rail, dock swipe, tab navigation, reduced motion and keyboard focus.
- Replaced crowded 7-day strip + previous/today/next arrows with one five-day centered swipe rail. Swipes advance one day, tap re-centers; the date choice does not change top-level tabs.
- **Mobile scroll architecture**: `.flow-shell` uses a 100dvh flex column; only `.flow-main` scrolls. Bottom dock is a non-overlapping sibling flex row instead of a position:fixed overlay. It reserves an Android gesture-safe bottom gutter, and a content scroll no longer pushes the dock offscreen. Real Chrome device confirmation is still required.
- Changed page entrance from full-screen portal overlay to 360ms directional masked view reveal. Removed sticky hover color on mobile and fixed brand header width and per-tab scroll reset. No extra data requests or new controls.
- Prior production Worker version `d5d7e086-73fd-4c87-ad30-9036db5c2bbf` and old source pin `a4cfcfdabe3a21f7b02f4d400b5628d11fe68843` remain as rollback reference.

## Production verification — live 2026-11-13 KST

- Public URL unchanged: `https://blank-app.agfvrd.workers.dev/`.
- Worker version `07054114-b7a9-4867-a39b-c1f880134371` deployed to `blank-app`, using the same bridge tested on `flow-v2-kinetic-preview`.
- Rust source `a129568051c0e26de5c5780c0dcbfac43f85caaf`, static pin `6b4047e474e54e7edf2209876d1b5c704f80dc55`.
- Final test `43255818992`: WASM typecheck, release build, six responsive viewport checks, real CDP touch swipe, tab drag, changed-screen scroll reset, dock at scroll end, viewport shrink, accessible date tap, reduced-motion passed.
- Cloudflare Browser Rendering verified production root mounted WASM, correct CSS/JS and 200 responses for original `/legacy`, `/transit`, `/university`, `/admin`; no claim of entire old API feature parity.
- Previous Worker version (immediate rollback target): `d5d7e086-73fd-4c87-ad30-9036db5c2bbf`.
- Physical-device acceptance remains open: Samsung Chrome/Internet dynamic address bar and bottom Android system gesture inset. Report precise screenshot/device reproduction and reconcile before further motion redesign.

## 2026-11-13 — real floating dock and in-app Daegu bus deployed release

- Tested Rust source `792d9da04540d57b77e3c3e6eae113e72e47937e` with Chromium CI https://github.com/hoonex/blank-app/actions/runs/43331188145 (**success**, all 6 viewport sizes).
- Immutable static commit `bf350345ba852081c64cf7e9c61d9164c9820f9f`, published to `flow-v2-monograph-v4-792d9da04540`: `flow-school-web-52618af9f2f706b0.js`, `flow-school-web-49ea575743f22da7_bg.wasm`, `style-6e347386e303d1ae.css`.
- Fixed viewport-anchored rounded bottom tab bar, lower placement, CSS page-bottom padding, corrected logo line-height/top padding, mobile calendar month arrows hidden and month slider retained. End-of-page and viewport-resize smoke assertions passed.
- New `School` tab contains Daegu bus stop search and stop-specific live arrivals. Raw public BIS website endpoints are proxied by Cloudflare with 1-hour stop-search cache and 20-second arrival cache, exact validation and honest API errors. Both search and arrivals returned real data on Cloudflare preview; details in `BUS_SOURCE_AND_STATUS.md`.
- Prior deployed Cloudflare Worker version: `07054114-b7a9-4867-a39b-c1f880134371`. Restore that version if live smoke fails. Device-specific Samsung Chrome screenshot still needs user confirmation after production deployment.
