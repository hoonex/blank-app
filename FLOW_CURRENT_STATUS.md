# Flow Current Status

> Updated: 2026-08-29 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. GitHub current repository state is always the final source of truth; re-check main/open PRs/CI before writes.

## Repository baseline

- Repository: `hoonex/blank-app`
- Latest verified runtime release main: `029822091597b1fe667e320cfa7eef84c9ee2965`
- PR #154 `feat: add Daegu subway routes to Transit`: squash merged
- PR #156 `fix: restore cross-region School Transit routes`: squash merged
- PR #158 `feat: show Transit rail sheets and refresh live buses`: squash merged
- PR #160 `feat: refine Transit map and destination controls`: squash merged
- A status-only docs follow-up may make current `main` newer than the runtime release anchor above. Verify GitHub before starting new work.

## Transit current state

School Transit combines TAGO bus candidates and Daegu Metro candidates, dedupes/reranks them, and exposes up to five routes.

Implemented scope:

- School `교통` destination and `/transit` clean route
- current-location opt-in only after explicit user action
- Transit-specific destination override independent from the selected school
- inline `변경` → destination search/apply flow and `학교로 되돌리기`
- custom destination persistence in `flow-school-transit-destination-v1`
- changing destination reuses the last known coordinates when available instead of prompting for geolocation again
- Kakao server-side destination geocoding through the existing Transit contract
- TAGO / Public Data Portal bus routing
- direct bus + one-transfer bus routing
- coordinate-owned source/destination region discovery
- cross-municipality transfer continuity through exact TAGO node IDs or short walkable physical stop matching
- TAGO per-bus-leg arrival enrichment when available
- Daegu Metro 1/2/3 rail adapter and rail-only route schematic
- bus-routing failure can preserve a usable rail fallback
- lazy TAGO bus map
- bus route map uses a restrained smoothed guide through the real TAGO stop sequence instead of rigid stop-to-stop chords
- real stop coordinates and real TAGO vehicle coordinates remain unchanged
- the smoothed route line is explicitly labelled as an approximate guide, **not** exact road geometry
- real TAGO vehicle markers refresh about every 15 seconds only while the bus map is open and the document is visible
- Daegu Metro rail sheets do **not** fabricate realtime train movement

## Destination contract — PR #160

Transit no longer has to use the School profile destination permanently.

- default remains the currently selected school
- `변경` opens an inline destination editor
- user can enter a place name or road address
- resolved custom destination name/address is stored separately from the School profile
- `학교로 되돌리기` clears the custom override and restores the selected school
- if a current coordinate was already obtained, changing/resetting the destination immediately reroutes from that coordinate
- if no current coordinate exists yet, destination can still be set and the user is asked to press `현재 위치에서 찾기`
- no automatic geolocation prompt was added

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

Do not later claim that this line follows the exact roadway unless Flow gains a legitimate road-route geometry provider.

## Transit provider contract

### Bus

- provider: `TAGO-public-data`
- route depth: direct or one bus transfer
- realtime arrival/vehicle data: opportunistic when available
- vehicle-map refresh: ~15 seconds, open + visible only
- route-map geometry source: real TAGO stop sequence
- displayed route trace: smoothed approximate stop-sequence guide
- regional discovery: coordinate-owned source + destination
- cross-region transfer matching: node ID + walkable stop proximity

### Rail

- provider: `KRIC-snapshot+Kakao-SW8`
- coverage: Daegu Metro 1/2/3
- station-order snapshot: `2026-06-30`
- route depth: direct subway + one transfer
- realtime train position: `false`
- wait model: `estimated`

KRIC runtime authorization remains unavailable with the existing Public Data Portal key (`resultCode: 30` / unregistered service key). Do not claim KRIC realtime/timetable access until separate authorization exists.

## Supabase production state

PR #160 changed client UI/map presentation/tests only; no Edge adapter redeploy was required.

- `transit-data` v15 ACTIVE
- `transit-map` v1 ACTIVE
- `transit-rail` v1 ACTIVE
- Public Data Portal credential remains server-side as `DATA_GO_KR_SERVICE_KEY`
- Kakao REST credential remains server-side as `KAKAO_REST_KEY`
- no paid ODsay/TMAP/Kakao Mobility Transit provider is used

## PR #160 validation

Final PR head: `0db562d7039e1521afaff6ebdbd54b6912199224`

All relevant final-head checks were GREEN before merge, including:

- Transit live map audit #7
- School Transit audit #72
- Browser UX audit #530
- Full Orientation functional audit #314
- Liquid Glass live stability audit #210
- Production health check #956
- Cloudflare clean-route refresh audit #229
- University mode/theme/dashboard audits
- Admin / Admin bootstrap & inventory audits
- Dashboard editor v2 audit
- School landscape toolbar audit
- Kakao AdFit layout audit
- ULW polish audit

School Transit audit #72 initially failed only because the public Transit map upstream returned `가용한 세션이 존재하지 않습니다. (30/30)`. Re-running the exact same job on the exact same PR head completed fully GREEN; no source change was needed.

Browser/visual validation:

- destination editor inspected at 390×844, 844×390, 768×1024, 1024×768, 1366×768, and 1920×1080
- no destination-editor horizontal overflow or first-fold explosion
- rail schematic retained the same six-viewport coverage without regression
- mobile bus-map screenshot directly inspected after smoothing
- map regression proves the displayed guide trace contains more sampled points than the raw stop sequence
- destination regression changes to `동대구역`, confirms the query reaches Transit routing, persists the resolved address, then resets to the School destination
- live bus regression still makes a second map request after the refresh interval and updates the vehicle marker
- no browser page errors in the focused Transit audit

Runtime squash merge:

- PR #160 → `029822091597b1fe667e320cfa7eef84c9ee2965`
- post-merge Production health #957: success
- post-merge Cloudflare clean-route #230: success
- Vercel REST deploy #142 failed, but Vercel REST is explicitly not a Flow release-success criterion unless requested; Production + Cloudflare are the release gates.

## Current limitations

- the smoothed bus route line is an approximate stop-sequence guide, not exact road geometry
- Daegu Metro train positions are not realtime and are not animated as if they were
- rail waiting time is estimated
- no KRIC runtime timetable/realtime integration until separate authorization exists
- rail routing coverage is Daegu Metro 1/2/3, not nationwide
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

1. if exact road-following bus geometry becomes necessary, find a legitimate public/provider contract instead of presenting the smooth guide as exact
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
