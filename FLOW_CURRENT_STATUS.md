# Flow Current Status

> Updated: 2026-08-29 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. GitHub current repository state is always the final source of truth; re-check main/open PRs/CI before writes.

## Repository baseline

- Repository: `hoonex/blank-app`
- Latest verified runtime release main: `cb323c78ef2a50c7e1ffa6e6fcb9f418af6f5a20`
- PR #154 `feat: add Daegu subway routes to Transit`: squash merged
- PR #156 `fix: restore cross-region School Transit routes`: squash merged
- PR #158 `feat: show Transit rail sheets and refresh live buses`: squash merged
- A status-only docs follow-up may make current `main` newer than the runtime release anchor above. Verify GitHub before starting new work.

## Transit current state

School Transit combines TAGO bus candidates and Daegu Metro candidates, then dedupes/reranks the combined set to a maximum of five routes.

Implemented scope:

- School `교통` destination and `/transit` clean route
- current-location opt-in only after explicit user action
- Kakao destination geocoding
- TAGO / Public Data Portal bus routing
- direct bus + one-transfer bus routing
- coordinate-owned source/destination region discovery
- cross-municipality one-transfer continuity through exact TAGO node IDs or short walkable physical stop matching
- TAGO per-bus-leg arrival enrichment when available
- separate `transit-rail` Edge adapter for Daegu Metro 1/2/3
- nearby subway station discovery with Kakao Local `SW8`
- 2026-06-30 KRIC station-order snapshot graph
- direct subway + one-transfer subway candidates
- bus routing failure can preserve a usable rail fallback
- lazy TAGO bus map
- rail-only routes expose `노선도 보기` instead of silently losing map affordance
- real TAGO bus vehicle markers refresh approximately every 15 seconds while the bus map is open and the document is visible
- bus vehicle refresh stops when the map closes, Transit is left, or the document becomes hidden
- Daegu Metro rail sheets explicitly do **not** fabricate realtime train movement
- PWA shell caching retained

## Cross-region production hotfix — PR #156

A real phone request exposed a production failure outside central Daegu: `transit-data` returned HTTP 502 and the client stopped before `transit-rail` could provide a fallback.

Fixed root causes:

1. Source-stop fallback incorrectly inherited the destination region hint. Source discovery now resolves from the source coordinate region.
2. One-transfer bus routing required identical TAGO node IDs. Municipality boundaries can represent the same physical transfer area with different IDs.
3. Transfer sampling could overrepresent one stop and route-stop caching was not scoped by city + route.
4. A bus 502 discarded resolved destination coordinates before rail fallback.

Current transfer contract:

- exact node-ID transfer remains valid
- otherwise nearby physical stops can connect through an explicit short walk
- route-stop caches are keyed by city + route
- nearby-stop line sampling is diversified across stops
- bus failure responses preserve resolved destination metadata
- rail fallback is gated to the explicit `TAGO-public-data` contract

The live public regression uses a public 신동역-area start toward 정동고 and requires a real `250 → 708` cross-region connection. No real-user coordinates are stored in repository tests or docs.

## Transit map / realtime release — PR #158

PR #158 fixes the map gap exposed by rail fallback and separates real realtime data from schematic-only rail data.

### Bus map

- provider remains the existing public TAGO adapter
- route/stop overlays remain stable while vehicle overlays refresh independently
- actual TAGO vehicle coordinates refresh every 15 seconds while the map is open and visible
- refresh is suspended on close, navigation away from Transit, and `document.hidden`
- returning to a visible open bus map schedules a short delayed refresh
- no MutationObserver or hidden-view continuous polling was added
- no automatic geolocation behavior changed

### Rail sheet

- rail-only routes are map-capable and show `노선도 보기`
- the sheet renders line, station count, direction, station order, and transfer structure
- portrait phone/tablet uses a compact content-height bottom sheet to avoid a large empty canvas
- landscape/desktop keeps the larger dialog composition
- the rail path does not load the Kakao map SDK solely to draw the schematic
- realtime train position is explicitly unavailable and is not simulated

Daegu Metro moving train markers must not be added until Flow has a verified, authorized live train-position source.

## Transit data/provider contract

### Bus

- provider: `TAGO-public-data`
- route depth: direct or one bus transfer
- realtime arrival/vehicle data: opportunistic when available
- vehicle-map refresh: ~15 seconds only while open + visible
- regional source/destination discovery: coordinate-owned
- cross-region transfer matching: node ID + walkable stop proximity

### Rail

- production adapter: `transit-rail`
- provider: `KRIC-snapshot+Kakao-SW8`
- coverage: `Daegu-1-2-3`
- station-order snapshot: `2026-06-30`
- supported route modes: direct subway + one transfer
- realtime train position: `false`
- wait model: `estimated`

KRIC runtime compatibility finding remains unchanged:

- the existing `DATA_GO_KR_SERVICE_KEY` returns KRIC `resultCode: 30` / unregistered service key
- this does not mean the Public Data Portal credential is broken
- KRIC requires separate authorization, so Flow must not claim KRIC realtime/timetable access until that exists

## Supabase production state

Server adapters were not changed by PR #158.

- `transit-data` v15 ACTIVE
  - imports immutable runtime source from release `54d51dec72b4717a1a7ce32428bddd468d859023`
  - `verify_jwt=false`, matching the existing public client-call contract
- `transit-map` v1 ACTIVE
- `transit-rail` v1 ACTIVE
- Public Data Portal credential remains `DATA_GO_KR_SERVICE_KEY`
- Kakao credential remains `KAKAO_REST_KEY`
- secrets remain server-side
- no paid ODsay/TMAP/Kakao Mobility Transit provider is used

## PR #158 validation

Final PR head: `20959442469a218ea2b2c8307e85874d31088743`

All relevant final-head checks were GREEN before merge:

- Transit live map audit #6
- School Transit audit #70
- Browser UX audit #528
- Full Orientation functional audit #312
- Liquid Glass live stability audit #208
- Production health check #950
- Cloudflare clean-route refresh audit #225
- University mode #517
- University theme/dashboard audits
- Admin / Admin bootstrap & inventory audits
- Dashboard editor v2 audit
- School landscape toolbar audit
- Kakao AdFit layout audit
- ULW polish audit

The first Full Orientation and University/Campus attempts had isolated REDs. The exact same final head was rerun without a source change; both workflows completed fully GREEN, classifying those failures as transient rather than product regressions.

Focused browser validation confirmed:

- rail-only fallback exposes and opens a rail schematic across 390×844, 844×390, 768×1024, 1024×768, 1366×768, and 1920×1080
- final portrait rail sheets do not leave a giant blank canvas
- bus map makes a second TAGO request after the refresh interval
- a real vehicle marker changes position when the returned TAGO coordinates change
- the status shows running-bus count plus the refresh timestamp
- no horizontal overflow or first-fold displacement regression

Manual screenshot inspection was performed for the six rail viewports and the live bus-marker state before merge.

Runtime squash merge:

- PR #158 → `cb323c78ef2a50c7e1ffa6e6fcb9f418af6f5a20`

## Current limitations

- Daegu Metro train positions are not realtime and are not animated as if they were
- rail waiting time is estimated, not realtime
- no KRIC runtime timetable/realtime integration until separate KRIC authorization exists
- rail routing coverage is Daegu Metro 1/2/3, not nationwide
- bus search still supports at most one bus transfer; it is not an arbitrary-depth journey planner
- the candidate merger compares bus itineraries and subway itineraries; it does not yet construct true mixed bus → subway → bus itineraries
- live bus arrival/vehicle coverage remains dependent on public TAGO availability
- active-trip guidance such as remaining-stop progress is not yet implemented

## Preserved product contracts

Do not regress these while extending Transit or the rest of Flow:

- real Optical Glass/refraction; do not replace it with blur-only imitation
- School Week stays a timetable toggle, not a restored primary nav destination
- School AdFit remains where currently approved; do not add or move ads without explicit user direction
- secrets stay server-side
- no automatic geolocation prompt on page load
- hidden views do not continuously rerender or poll
- no duplicate API fetch/runtime/MutationObserver layer without structural need
- main is never edited directly
- relevant RED CI blocks merge
- UI changes require six-viewport screenshot inspection, not CI-only approval

## Next likely product work

Recommended order unless the user directs otherwise:

1. design true mixed-mode bus ↔ subway journey construction without a paid provider
2. improve live arrival/vehicle quality and reranking signals without fabricating rail realtime
3. add active-trip guidance (`N stops remaining`, boarding/alighting progress)
4. expand regional adapters only where public-provider contracts are legitimate
5. integrate useful Transit context more deeply into School Today
6. remove remaining English UI residue across visible + hidden views
7. keep `FLOW_PROJECT_HISTORY.md` for durable history and this file for fast-changing state

## Minimal future-chat handoff

```text
Repository: https://github.com/hoonex/blank-app
ULW.
GitHub current state is source of truth.
Read AGENTS.md, FLOW_CURRENT_STATUS.md, and FLOW_PROJECT_HISTORY.md first.
Re-check main HEAD, open PRs and current CI before changes.
Continue autonomously from repository state; do not reconstruct stale chat history.
```
