# Flow Current Status

> Updated: 2026-08-28 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. GitHub current repository state is always the final source of truth; re-check main/open PRs/CI before writes.

## Repository baseline

- Repository: `hoonex/blank-app`
- Latest verified runtime release main: `54d51dec72b4717a1a7ce32428bddd468d859023`
- PR #154 `feat: add Daegu subway routes to Transit`: squash merged
- PR #156 `fix: restore cross-region School Transit routes`: squash merged
- This status-only docs follow-up may make current `main` newer than the runtime release anchor above. Verify GitHub before starting new work.

## Transit current state

School Transit combines TAGO bus candidates and Daegu Metro candidates, then dedupes/reranks the combined set to a maximum of five routes.

Current implemented scope:

- School `교통` navigation destination
- current-location opt-in only after explicit user action
- Kakao destination geocoding
- TAGO / Public Data Portal bus routing
- direct bus + one-transfer bus routing
- cross-municipality one-transfer continuity using exact TAGO node IDs or short walkable physical stop matching
- source stop fallback owned by the source coordinate region rather than incorrectly inheriting the destination region
- TAGO per-bus-leg arrival enrichment when available
- separate `transit-rail` Edge adapter for Daegu Metro 1/2/3
- nearby subway station discovery with Kakao Local `SW8`
- 2026-06-30 KRIC station-order snapshot graph
- direct subway + one-transfer subway candidates
- rail waiting time explicitly marked/modelled as estimated, never realtime
- bus routing failure does not automatically kill a usable rail candidate
- lazy TAGO bus-map adapter and responsive map sheet/dialog retained
- `/transit` clean-route support and PWA shell caching retained

## Cross-region production hotfix — PR #156

A real phone request exposed a production failure outside central Daegu: `transit-data` returned HTTP 502 and the client stopped before `transit-rail` could provide a fallback.

Root causes fixed:

1. Source-stop fallback incorrectly received the destination's Daegu region hint. Source discovery now resolves from the source coordinate region.
2. One-transfer bus routing required identical TAGO node IDs at the transfer point. Municipality boundaries can represent the same or nearby physical transfer stop with different node IDs.
3. Transfer route sampling could overrepresent the first nearby stop and route-stop caching was not scoped by city + route.
4. A bus 502 discarded resolved destination coordinates before the client could try rail.

Current transfer contract:

- exact node-ID transfer remains valid
- otherwise stops may connect through a short physical walk when coordinates show they are effectively the same transfer area
- a short transfer walk is represented explicitly in the route when needed
- route-stop caches are keyed by city + route
- nearby-stop line sampling is diversified across stops
- bus failure responses preserve resolved destination metadata server-side
- the client attempts rail fallback only for the explicit `TAGO-public-data` contract

The live public regression uses a public 신동역-area start toward 정동고 and requires a real `250 → 708` cross-region connection. No real-user coordinates are stored in repository tests or docs.

## Transit data/provider contract

### Bus

- provider: `TAGO-public-data`
- route depth: direct or one bus transfer
- realtime: opportunistic per bus leg when available
- regional source/destination discovery: coordinate-owned
- cross-region transfer matching: node ID + walkable stop proximity

### Rail

- production adapter: `transit-rail`
- provider: `KRIC-snapshot+Kakao-SW8`
- coverage: `Daegu-1-2-3`
- station-order snapshot: `2026-06-30`
- supported route modes: direct subway + one transfer
- realtime: `false`
- wait model: `estimated`

KRIC runtime compatibility finding remains unchanged:

- the existing `DATA_GO_KR_SERVICE_KEY` returns KRIC `resultCode: 30` / unregistered service key
- this does not mean the Public Data Portal credential is broken
- KRIC requires separate authorization, so Flow must not claim KRIC realtime/timetable access until that exists

## Supabase production state

Verified after PR #156 merge:

- `transit-data` v15 ACTIVE
  - redeployed after squash merge to import the immutable main release commit `54d51dec72b4717a1a7ce32428bddd468d859023`
  - `verify_jwt=false`, matching the existing public client-call contract
- `transit-map` v1 ACTIVE
- `transit-rail` v1 ACTIVE
- Public Data Portal credential remains `DATA_GO_KR_SERVICE_KEY`
- Kakao credential remains `KAKAO_REST_KEY`
- secrets remain server-side
- no paid ODsay/TMAP/Kakao Mobility Transit provider is used

## PR #156 validation

Final PR head: `12644d58a0a2f1b8926767bd718a34952170f695`

All relevant checks were GREEN before merge, including:

- School Transit audit
- Browser UX audit
- Full Orientation functional audit
- Liquid Glass live stability audit
- Production health check
- Cloudflare clean-route refresh audit
- University mode/theme/dashboard audits
- Admin / Admin bootstrap & inventory audits
- Dashboard editor v2 audit
- School landscape toolbar audit
- Kakao AdFit layout audit
- ULW polish audit

Live School Transit validation confirmed:

- 5 local bus candidates in the sampled route
- 4 cross-region bus candidates in the public 신동역-area regression
- the cross-region set includes a real `250 → 708` one-transfer connection toward 정동고
- 5 Daegu rail candidates in the sampled rail query
- bus map sample returned 4 route stops and 2 vehicles
- bus realtime rows remain visible when rail candidates are merged

Browser validation covered the six standard viewports:

- 390×844
- 844×390
- 768×1024
- 1024×768
- 1366×768
- 1920×1080

A dedicated 390×844 failure fixture also forces `transit-data` to return a bus 502 while preserving destination coordinates. The UI then requests rail and renders the subway route instead of the previous red terminal error.

Manual screenshot inspection passed for:

- normal route state in all six viewports
- mobile portrait bus-failure → rail fallback
- mobile landscape first fold
- no giant blank region or route-card height explosion
- no horizontal clipping/wrapping regression
- lazy map sheet in all six viewports
- transfer map with one shared transfer marker
- `승차` / `환승` / `하차` labels separated from route lines

Post-merge validation for `54d51dec72b4717a1a7ce32428bddd468d859023`:

- Production health run `33170282432` (#942): success
- Cloudflare clean-route refresh run `33170282445` (#217): success

Vercel REST deployment is not a Flow release-success criterion unless explicitly requested; repository contract plus Production health / Cloudflare clean-route are the release gates.

## Current limitations

- rail waiting time is estimated, not realtime
- no KRIC runtime timetable/realtime integration until separate KRIC authorization exists
- rail routing coverage is Daegu Metro 1/2/3, not nationwide
- bus search still intentionally supports at most one bus transfer; it is not an arbitrary-depth journey planner
- the candidate merger compares bus itineraries and subway itineraries; it does not yet construct true mixed bus → subway → bus itineraries
- live bus arrival coverage remains opportunistic and may fall back to baseline estimates
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

1. design true mixed-mode bus ↔ subway journey construction without introducing a paid provider
2. improve live arrival quality and reranking signals without fabricating rail realtime
3. add active-trip guidance (`N stops remaining`, boarding/alighting progress)
4. expand regional adapters only where public-provider contracts are legitimate
5. integrate useful Transit context more deeply into School Today
6. remove remaining English UI residue across visible + hidden views
7. keep `FLOW_PROJECT_HISTORY.md` for durable history and this file for fast-changing state

## Minimal future-chat handoff

A new chat should not receive the full old conversation. Use only:

```text
Repository: https://github.com/hoonex/blank-app
ULW.
GitHub current state is source of truth.
Read AGENTS.md, FLOW_CURRENT_STATUS.md, and FLOW_PROJECT_HISTORY.md first.
Re-check main HEAD, open PRs and current CI before changes.
Continue autonomously from repository state; do not reconstruct stale chat history.
```
