# Flow Current Status

> Updated: 2026-08-30 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` is the long-form historical record. GitHub current repository state is always the final source of truth; re-check `main`, open PRs, CI, and deployed Edge versions before writes.

## Repository baseline

- Repository: `hoonex/blank-app`
- Latest verified product/runtime main: `efdd77d3c2980f911831d94aa1eb0316e9f2bf78`
- PR #165 `feat: draw Transit buses on official Daegu road links`: merged on 2026-08-30 KST
- PR #165 final head: `01c7128ccdc8e05b526f00731a09c99d86dcfe6f`
- PR #165 merge commit: `efdd77d3c2980f911831d94aa1eb0316e9f2bf78`
- PR #165 was merged with a normal merge commit, not squash.
- Open PR count immediately after the runtime release: `0`
- A later docs-only merge may make `main` newer than the runtime anchor above. Treat the PR #165 merge commit as the current Transit runtime release anchor until another product/runtime PR supersedes it.

## Transit current state

School Transit combines public TAGO bus candidates and Daegu Metro candidates, dedupes/reranks them, and exposes up to five routes **only when both source and destination are inside Daegu Metropolitan City**.

Implemented scope:

- School `교통` destination and `/transit` clean route
- UI service-area label: `지원 지역 · 대구광역시`
- explicit current-location action only; no automatic geolocation prompt
- Transit-specific destination override independent from the selected school
- inline destination search/apply and `학교로 되돌리기`
- custom destination persistence in `flow-school-transit-destination-v1`
- Kakao server-side destination geocoding and coordinate-to-administrative-region lookup
- Daegu source + destination service-area gate before public routing
- structured HTTP 422 `OUT_OF_SERVICE_AREA` outside Daegu with no rail fallback bypass
- TAGO / Public Data Portal direct bus + one-transfer bus routing
- TAGO per-bus-leg arrival enrichment when available
- Daegu Metro 1/2/3 rail adapter and rail-only route schematic
- lazy bus route map
- official Daegu bus-road link geometry for supported Daegu bus legs
- raw TAGO stop-sequence fallback only when the official graph cannot safely reconstruct a leg
- actual TAGO boarding/alighting stops remain authoritative
- actual TAGO vehicle coordinates remain authoritative
- live vehicle refresh is about 15 seconds only while the map sheet is open and the document is visible
- Daegu Metro does **not** fabricate realtime train positions

## Service-area contract

Public School Transit is intentionally scoped to `대구광역시`.

- service-area ID: `daegu`
- service-area policy: `source+destination-inside`
- source coordinate is resolved to the current first-level administrative region through Kakao Local
- text destinations are geocoded, then their resolved coordinates are region-checked independently
- coordinate destinations are also region-checked
- both `대구광역시` and Kakao's shortened first-depth value `대구` are treated as Daegu
- source outside Daegu → HTTP 422 `OUT_OF_SERVICE_AREA`, `position: source`
- destination outside Daegu → HTTP 422 `OUT_OF_SERVICE_AREA`, `position: destination`
- outside-area rejection returns no routes and does not fall through to the rail adapter
- public `transit-data` owns this gate
- preserved TAGO routing core lives behind `transit-data-core`
- `transit-data-core` requires Supabase JWT verification and is called server-side with the service role key
- no service-role credential is exposed to the browser

Do not re-enable public cross-region routing without an explicit product decision.

## Official bus-road geometry contract — PR #165

The old client-side smoothed stop interpolation is no longer the primary Daegu bus trace.

Official source:

- dataset: `대구광역시_버스 노선 공간정보_20250903`
- publisher: Daegu Metropolitan City / Public Data Portal
- snapshot: `2025-09-03`
- source format: SHP
- original CRS: EPSG:5187
- original archive SHA-256: `98d6a7725e3fddbcd65c58af3fadc217378ee8bfec82e29e2931341e19f86a1e`
- recovered layers: bus stops / nodes / bus-road links
- official bus-road links: `9,927`
- compact runtime network: about `876 KB`
- deterministic builder: `scripts/build-daegu-bus-network.py`
- generated runtime snapshot: `supabase/functions/transit-map/daegu-official-network.ts`
- graph reconstruction: `supabase/functions/transit-map/official-route-geometry.ts`

Accuracy contract:

- the official link layer does **not** directly label every road link with route numbers such as `708` or `805`
- Flow therefore must not claim that the SHP directly declares per-route link membership
- current TAGO route stop order is the route constraint
- each adjacent TAGO stop pair is matched to compatible official nodes when possible, with coordinate proximity as a controlled fallback
- the path between those matched stops is reconstructed over the official Daegu bus-road link graph
- if mapping is unsafe or a pair is disconnected, Flow uses the raw TAGO stop sequence instead of inventing road geometry

Runtime response contract:

- provider: `TAGO-public-data+Daegu-official-SHP`
- primary geometry: `daegu-official-bus-link-snapshot`
- geometry snapshot: `2025-09-03`
- fallback: `route-stop-sequence`
- `route.path` contains the official reconstructed road path when available
- frontend renders `route.path` directly; it does not manufacture Catmull-Rom curvature
- route trace dataset is `official-road-geometry` or the explicit fallback state

Freshness:

- as verified on 2026-08-30 KST, the latest publicly posted official Daegu bus spatial snapshot remained `2025-09-03`
- Public Data Portal indicated the next scheduled registration date as `2026-09-01`
- after that date, check whether a newer snapshot is actually published before refreshing the generated network

## Transit provider contract

### Bus

- public routing provider: `TAGO-public-data`
- road geometry provider: Daegu official SHP snapshot
- public service area: Daegu source + Daegu destination only
- route depth: direct or one bus transfer
- realtime arrival/vehicle data: opportunistic when TAGO provides it
- live vehicle positioning: actual TAGO coordinates only
- vehicle-map refresh: ~15 seconds, open + visible only
- hidden/closed map polling: stopped
- fake vehicle interpolation: forbidden

### Rail

- provider: `KRIC-snapshot+Kakao-SW8`
- coverage: Daegu Metro 1/2/3
- station-order snapshot: `2026-06-30`
- route depth: direct subway + one transfer
- realtime train position: `false`
- wait model: `estimated`

KRIC runtime authorization remains unavailable with the existing Public Data Portal key (`resultCode: 30` / unregistered service key). Do not claim KRIC realtime/timetable access until separate authorization exists.

## Supabase production state

Latest verified production Edge state after PR #165:

- `transit-data` v18 ACTIVE, `verify_jwt=false`: public Daegu service-area gate
- `transit-data-core` v2 ACTIVE, `verify_jwt=true`: protected preserved TAGO router
- `transit-map` v4 ACTIVE, `verify_jwt=false`
- `transit-map` v4 wrapper pins exactly `efdd77d3c2980f911831d94aa1eb0316e9f2bf78/supabase/functions/transit-map/index.ts`
- `transit-rail` v1 ACTIVE
- Public Data Portal credential remains server-side as `DATA_GO_KR_SERVICE_KEY`
- Kakao REST credential remains server-side as `KAKAO_REST_KEY`
- gate-to-core service role credential remains server-side
- no paid ODsay/TMAP/Kakao Mobility Transit provider is used

`transit-map` intentionally retains `verify_jwt=false` because it was already a public endpoint; do not silently change that existing public contract without reviewing all callers.

## PR #165 validation and release gates

PR #165 final head:

`01c7128ccdc8e05b526f00731a09c99d86dcfe6f`

Final-head pull-request workflows were all GREEN. Important gates included:

- Transit live map audit #26: success
- School transit audit #103: success
- Full orientation functional audit #345: success
- Browser UX audit #561: success
- Production health check #994: success
- Cloudflare clean-route refresh audit #265: success
- Liquid Glass live stability audit #241: success
- Dashboard editor v2 audit #464: success
- University mode/theme/dashboard audits: success
- Admin / bootstrap inventory audits: success
- School landscape toolbar audit: success
- Kakao AdFit layout audit: success
- ULW polish audit: success
- Vercel REST deploy #159: success

Responsive visual verification covered:

- 390×844
- 844×390
- 768×1024
- 1024×768
- 1366×768
- 1920×1080

The dedicated official-road visual audit confirmed no map modal clipping or horizontal overflow across those viewports. The Playwright Kakao fixture is not a real road-tile accuracy proof; geometry correctness is grounded in official SHP provenance, graph reconstruction, and live `route.path` behavior.

Live integration validation observed a current Daegu bus candidate whose map response contained 4 TAGO stops and 25 official path points, proving the runtime returned official-road geometry instead of merely echoing the stop sequence.

Post-merge release state:

- PR #165 merge commit: `efdd77d3c2980f911831d94aa1eb0316e9f2bf78`
- Production health #995: success
- Vercel REST deploy #160: success
- Cloudflare clean-route refresh audit #266: success
- `transit-map` redeployed after merge and pinned to the exact merge commit
- post-redeploy Transit live map audit was manually re-run and completed successfully, including the live destination/rail/bus refresh check and six-viewport official-road capture

## Current limitations

- the official 2025-09-03 GIS snapshot can become stale relative to later road/route changes until a newer official snapshot is published and ingested
- official bus-road links do not directly carry per-route numbers, so TAGO stop order remains the route constraint
- disconnected/unsafe official graph matches fall back to the raw stop sequence
- Daegu Metro train positions are not realtime and are not animated as if they were
- rail waiting time is estimated
- no KRIC runtime timetable/realtime integration until separate authorization exists
- rail routing coverage is Daegu Metro 1/2/3, not nationwide
- public Transit routing is intentionally Daegu-only
- bus search supports at most one bus transfer
- candidate merging compares bus itineraries and subway itineraries; it does not yet construct a true bus → subway → bus journey
- live bus arrival/vehicle coverage depends on public TAGO availability
- active-trip guidance such as remaining-stop progress is not yet implemented

## Preserved product contracts

- real Optical Glass/refraction; do not replace it with blur-only imitation
- School Week stays a timetable toggle, not a primary nav destination
- School AdFit remains where currently approved; do not add/move ads without explicit user direction
- secrets stay server-side
- no automatic geolocation prompt on page load
- hidden views do not continuously rerender or poll
- no fake realtime bus or train movement
- no duplicate API fetch/runtime/MutationObserver layer without structural need
- `main` is never edited directly
- relevant RED CI blocks merge
- UI changes require six-viewport screenshot inspection, not CI-only approval

## Tooling note

The ChatGPT GitHub connector action for marking a draft PR ready for review currently fails because its GraphQL wrapper requests the nonexistent `Repository.fullDatabaseId` field. This is a connector wrapper issue, not a repository permission issue. If it persists, use GitHub's web UI only for the `Ready for review` transition; do not treat the failure as a product blocker or weaken merge checks.

## Next likely product work

Recommended order unless the user directs otherwise:

1. after 2026-09-01, check whether Daegu publishes a newer official bus spatial snapshot and refresh the generated network only if a newer file actually exists
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
Read AGENTS.md and FLOW_CURRENT_STATUS.md first; use FLOW_PROJECT_HISTORY.md only for older context.
Re-check main HEAD, open PRs, current CI, and deployed Supabase Edge versions before changes.
Continue autonomously from repository state; do not reconstruct stale chat history.
```
