# Flow Current Status

> Updated: 2026-08-29 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. GitHub current repository state is always the final source of truth; re-check main/open PRs/CI before writes.

## Repository baseline

- Repository: `hoonex/blank-app`
- Latest verified current main: `12b66d38c3683612c5ce3a0de7498ac88e9b2908`
- Latest Transit product/runtime release anchor: PR #162 → `76cdeb25a0dd3fc226e6a8b6064e03e6bea9052d`
- PR #154 `feat: add Daegu subway routes to Transit`: squash merged
- PR #156 `fix: restore cross-region School Transit routes`: squash merged historically; the public Transit entrypoint is now intentionally Daegu-only under PR #162
- PR #158 `feat: show Transit rail sheets and refresh live buses`: squash merged
- PR #160 `feat: refine Transit map and destination controls`: squash merged
- PR #162 `fix: enforce Daegu-only Transit coverage`: squash merged
- PR #163 `fix: make Vercel REST deploy self-contained`: squash merged
- A status-only docs follow-up may make current `main` newer than the runtime/workflow anchors above. Verify GitHub before starting new work.

## Transit current state

School Transit combines TAGO bus candidates and Daegu Metro candidates, dedupes/reranks them, and exposes up to five routes **only when both source and destination are inside Daegu Metropolitan City**.

Implemented scope:

- School `교통` destination and `/transit` clean route
- UI service-area label: `지원 지역 · 대구광역시`
- current-location opt-in only after explicit user action
- Transit-specific destination override independent from the selected school
- inline `변경` → destination search/apply flow and `학교로 되돌리기`
- custom destination persistence in `flow-school-transit-destination-v1`
- changing destination reuses the last known coordinates when available instead of prompting for geolocation again
- Kakao server-side destination geocoding and coordinate-to-administrative-region lookup
- source and destination must both resolve inside Daegu before bus routing starts
- outside-area request returns structured HTTP 422 `OUT_OF_SERVICE_AREA`
- an outside-area rejection stops the client before the rail fallback is attempted
- TAGO / Public Data Portal bus routing
- direct bus + one-transfer bus routing
- TAGO per-bus-leg arrival enrichment when available
- Daegu Metro 1/2/3 rail adapter and rail-only route schematic
- in-area bus-routing failure can preserve a usable rail fallback
- lazy TAGO bus map
- bus route map uses a restrained smoothed guide through the real TAGO stop sequence instead of rigid stop-to-stop chords
- real stop coordinates and real TAGO vehicle coordinates remain unchanged
- the smoothed route line is explicitly labelled as an approximate guide, **not** exact road geometry
- real TAGO vehicle markers refresh about every 15 seconds only while the bus map is open and the document is visible
- Daegu Metro rail sheets do **not** fabricate realtime train movement

## Service-area contract — PR #162

Public School Transit is intentionally scoped to `대구광역시`.

- service-area ID: `daegu`
- service-area policy: `source+destination-inside`
- source coordinate is resolved to the current administrative first-level region through Kakao Local
- a text destination is geocoded, then its resolved coordinate is independently converted back to the administrative region before the gate decision
- coordinate destinations are also region-checked
- both `대구광역시` and Kakao's shortened first-depth value `대구` are treated as Daegu
- source outside Daegu → HTTP 422 `OUT_OF_SERVICE_AREA`, `position: source`
- destination outside Daegu → HTTP 422 `OUT_OF_SERVICE_AREA`, `position: destination`
- outside-area rejection returns no routes and does not fall through to the rail adapter
- the public `transit-data` Edge function owns this gate
- the preserved TAGO router lives behind `transit-data-core`
- `transit-data-core` has Supabase JWT verification enabled, preventing direct anonymous bypass of the public Daegu gate
- the public gate calls the core with server-side `SUPABASE_SERVICE_ROLE_KEY`
- no service-role credential is exposed to the browser

Do not re-enable public cross-region routing without an explicit product decision. The preserved core may still contain the earlier cross-region TAGO logic, but it is not the public service contract.

## Destination contract — PR #160

Transit does not have to use the School profile destination permanently.

- default remains the currently selected school
- `변경` opens an inline destination editor
- user can enter a place name or road address
- resolved custom destination name/address is stored separately from the School profile
- `학교로 되돌리기` clears the custom override and restores the selected school
- if a current coordinate was already obtained, changing/resetting the destination immediately reroutes from that coordinate
- if no current coordinate exists yet, destination can still be set and the user is asked to press `현재 위치에서 찾기`
- no automatic geolocation prompt was added
- PR #162 additionally applies the Daegu service-area gate to both the current coordinate and the resolved destination

## Bus map geometry contract — PR #160

The previous bus map drew one hard straight chord between every consecutive TAGO stop, which looked artificial when stop spacing was large.

Current behavior:

- the authoritative geometry remains the existing TAGO route-stop sequence
- consecutive stop coordinates are sampled into a restrained smooth guide curve for presentation
- the curve is bounded to limit spline overshoot
- route bounds are still calculated from actual stop coordinates
- boarding / transfer / alighting markers remain tied to actual stop coordinates
- live bus markers remain tied to actual TAGO vehicle coordinates
- the route line has a subtle halo for legibility over the map
- the UI states: `노선 선은 정류장 순서를 부드럽게 연결한 안내선입니다. 실제 도로 굴곡과 다를 수 있습니다.`

Do not later claim that this line follows the exact roadway unless Flow imports or obtains a legitimate bus-route road geometry source.

The identified official source for a future exact-geometry upgrade is Public Data Portal dataset `대구광역시_버스 노선 공간정보_20250903` (SHP; cpg/dbf/prj/qpj/shp/shx; Daegu Metropolitan City / 교통정보운영과). The portal's original-file download currently presents an anti-automation CAPTCHA, so the repository does not contain or pretend to contain that SHP yet.

## Transit provider contract

### Bus

- public provider: `TAGO-public-data`
- public service area: Daegu source + Daegu destination only
- route depth: direct or one bus transfer
- realtime arrival/vehicle data: opportunistic when available
- vehicle-map refresh: ~15 seconds, open + visible only
- route-map geometry source: real TAGO stop sequence
- displayed route trace: smoothed approximate stop-sequence guide
- service-area discovery: Kakao coordinate → first-level administrative region before routing
- internal preserved core can still perform the earlier TAGO regional discovery/transfer logic, but it is protected and not a public cross-region endpoint

### Rail

- provider: `KRIC-snapshot+Kakao-SW8`
- coverage: Daegu Metro 1/2/3
- station-order snapshot: `2026-06-30`
- route depth: direct subway + one transfer
- realtime train position: `false`
- wait model: `estimated`

KRIC runtime authorization remains unavailable with the existing Public Data Portal key (`resultCode: 30` / unregistered service key). Do not claim KRIC realtime/timetable access until separate authorization exists.

## Supabase production state

- `transit-data` v18 ACTIVE, `verify_jwt=false`: public Daegu service-area gate
- `transit-data-core` v2 ACTIVE, `verify_jwt=true`: protected preserved TAGO router
- `transit-map` v1 ACTIVE
- `transit-rail` v1 ACTIVE
- Public Data Portal credential remains server-side as `DATA_GO_KR_SERVICE_KEY`
- Kakao REST credential remains server-side as `KAKAO_REST_KEY`
- the gate-to-core call uses server-side `SUPABASE_SERVICE_ROLE_KEY`
- no paid ODsay/TMAP/Kakao Mobility Transit provider is used

## PR #162 validation — Daegu service area

Final PR head: `b512a58752bac8eba058b3710fcff103e25aaf5f`

All 16 final-head PR workflows were GREEN before merge, including:

- School Transit audit #78
- Transit live map audit #12
- Browser UX audit #536
- Full Orientation functional audit #320
- Liquid Glass live stability audit #216
- Production health check #964
- Cloudflare clean-route refresh audit #237
- University mode/theme/dashboard audits
- Admin / Admin bootstrap & inventory audits
- Dashboard editor v2 audit
- School landscape toolbar audit
- Kakao AdFit layout audit
- ULW polish audit

Focused service-area validation proved:

- live in-Daegu route search returns normal TAGO candidates
- live outside-Daegu source is rejected with HTTP 422 before routing
- browser outside-area regression makes one bus request, zero rail requests, and renders zero route cards
- `지원 지역 · 대구광역시` renders across 390×844, 844×390, 768×1024, 1024×768, 1366×768, and 1920×1080
- direct screenshot inspection found no horizontal overflow or mobile-landscape first-fold regression
- protected-core contract is included in the Edge secret audit

Runtime squash merge:

- PR #162 → `76cdeb25a0dd3fc226e6a8b6064e03e6bea9052d`
- post-merge Production health #965: success
- post-merge Cloudflare clean-route #238: success

## PR #163 validation — Vercel REST deployment

PR #163 did not change product UI/runtime behavior. It fixed the standalone Vercel REST deployment path that had repeatedly reported RED despite the primary Flow release gates being healthy.

Root cause of the previous Vercel RED:

- Vercel project build command is `node scripts/vercel-static-build.mjs`
- the REST collector excluded the entire `scripts/` directory
- deployment `dpl_22roSGWcoGXpsfpueDVC372bf1W9` therefore failed with `MODULE_NOT_FOUND` for `/vercel/path1/scripts/vercel-static-build.mjs`

Current deployment contract:

- REST manifest explicitly includes `scripts/vercel-static-build.mjs`
- token-free `manifest` mode runs on pull requests
- manifest CI requires the build helper, `transit/index.html`, and `/transit` clean-route verification
- actual production deployment remains main-push/workflow-dispatch only
- `/transit` is also required by `scripts/vercel-static-build.mjs`

PR #163 final head: `822ca46cfb3efde3483c3628f1717f8f08bfc619`

- all 16 PR workflows: GREEN
- Vercel REST manifest audit #144: success
- squash merge → `12b66d38c3683612c5ce3a0de7498ac88e9b2908`
- main-push Vercel REST deploy #145: success
- Vercel deployment `dpl_69348G7pnkv1aBwtiapcMGtYLqRy`: `READY`
- production alias reported by the workflow: `https://flow-student-blush.vercel.app`
- verified HTTP 200 clean routes: `/home`, `/week`, `/schedule`, `/transit`, `/school`, `/university`, `/university/timetable`, `/university/campus`, `/university/school`
- post-merge Production health #967: success
- post-merge Cloudflare clean-route refresh #240: success

## Current limitations

- the smoothed bus route line is an approximate stop-sequence guide, not exact road geometry
- exact Daegu bus road geometry is not imported until a legitimate SHP source file is available to the build process
- Daegu Metro train positions are not realtime and are not animated as if they were
- rail waiting time is estimated
- no KRIC runtime timetable/realtime integration until separate authorization exists
- rail routing coverage is Daegu Metro 1/2/3, not nationwide
- public Transit routing is intentionally Daegu-only
- bus search supports at most one bus transfer
- candidate merging compares bus itineraries and subway itineraries; it does not yet build a true bus → subway → bus journey
- live bus arrival/vehicle coverage depends on public TAGO availability
- active-trip guidance such as remaining-stop progress is not yet implemented

## Preserved product contracts

- real Optical Glass/refraction; do not replace it with blur-only imitation
- School Week stays a timetable toggle, not a primary nav destination
- School AdFit remains where currently approved; do not add/move ads without explicit user direction
- secrets stay server-side
- no automatic geolocation prompt on page load
- hidden views do not continuously rerender or poll
- no duplicate API fetch/runtime/MutationObserver layer without structural need
- `main` is never edited directly
- relevant RED CI blocks merge
- UI changes require six-viewport screenshot inspection, not CI-only approval

## Next likely product work

Recommended order unless the user directs otherwise:

1. ingest the official Daegu bus-route SHP when legitimately obtainable, then replace the approximate map guide with route geometry sliced to the selected boarding/alighting legs
2. design true mixed-mode bus ↔ subway journey construction without a paid provider
3. improve live arrival/vehicle quality and reranking without fabricating rail realtime
4. add active-trip guidance (`N stops remaining`, boarding/alighting progress)
5. integrate useful Transit context into School Today
6. remove remaining English UI residue across visible + hidden views

## Minimal future-chat handoff

```text
Repository: https://github.com/hoonex/blank-app
ULW.
GitHub current state is source of truth.
Read AGENTS.md, FLOW_CURRENT_STATUS.md, and FLOW_PROJECT_HISTORY.md first.
Re-check main HEAD, open PRs and current CI before changes.
Continue autonomously from repository state; do not reconstruct stale chat history.
```
