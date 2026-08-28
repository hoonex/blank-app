# Flow Current Status

> Updated: 2026-08-28 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. GitHub current repository state is always the final source of truth; re-check main/open PRs/CI before writes.

## Repository baseline

- Repository: `hoonex/blank-app`
- Transit rail release anchor: `1448592441a97556ef59ca5af6fff965088f6860`
- PR #154 `feat: add Daegu subway routes to Transit`: squash merged
- PR #154 final branch head before merge: `4b208fe9cdbedeeedaa0bf3c187b0b8752cbf97a`
- The status-only docs commit that updates this file may make current `main` newer than the release anchor above. Verify GitHub before starting new work.

## Transit release state

School Transit is merged and now combines bus and Daegu Metro route candidates.

Implemented scope:

- School `교통` navigation destination
- current-location opt-in only after explicit user action
- destination geocoding through Kakao
- stable TAGO / Public Data Portal bus routing retained
- direct bus + one-transfer bus routing
- TAGO per-bus-leg arrival enrichment when available
- separate Supabase `transit-rail` Edge adapter
- Daegu Metro lines 1, 2, and 3
- nearby subway-station discovery with Kakao Local category `SW8`
- route graph from a 2026-06-30 KRIC station-order snapshot
- direct subway routes
- one-transfer subway routes through Daegu transfer stations
- bus + subway candidate merge, dedupe, reranking, and maximum five returned routes
- walking legs, boarding/alighting stations, station counts, transfer counts, duration, and arrival estimates
- rail waiting time explicitly modeled as an estimate; no rail realtime claim
- existing lazy TAGO bus-map adapter retained
- responsive map sheet/dialog instead of inline map card expansion
- `/transit` clean-route support and PWA shell caching

## Transit data/provider contract

### Bus

- routing provider: `TAGO-public-data`
- realtime: opportunistic per bus leg when available
- existing bus route/search behavior must not regress while rail expands

### Rail

- production adapter: `transit-rail`
- provider contract: `KRIC-snapshot+Kakao-SW8`
- coverage: `Daegu-1-2-3`
- station-order snapshot: `2026-06-30`
- supported route modes: direct subway + one transfer
- rail realtime: `false`
- wait model: `estimated`

KRIC runtime compatibility finding:

- the existing `DATA_GO_KR_SERVICE_KEY` was tested against the KRIC Open API
- KRIC returned `resultCode: 30` / unregistered service key
- this does **not** mean the Public Data Portal credential is broken
- KRIC requires separate service authorization, so Flow must not claim KRIC realtime/timetable runtime access until that authorization exists
- current rail routing therefore uses the verified station-order snapshot plus Kakao station discovery

## Supabase production state

Verified during PR #154 work:

- `transit-data` v13 ACTIVE
- `transit-map` v1 ACTIVE
- `transit-rail` v1 ACTIVE
- secrets remain server-side
- Public Data Portal credential: `DATA_GO_KR_SERVICE_KEY`
- Kakao credential: `KAKAO_REST_KEY`
- no paid ODsay/TMAP/Kakao Mobility Transit provider is part of this release

The retired KRIC compatibility diagnostic is not a runtime dependency and remains non-public/disabled rather than exposing credentials or pretending realtime support exists.

## Transit validation

PR #154 final head: `4b208fe9cdbedeeedaa0bf3c187b0b8752cbf97a`

All relevant PR checks were GREEN before merge, including:

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

Live adapter validation on the final PR state confirmed:

- Transit integrations healthy
- 5 live normalized bus route candidates in the validation query
- 5 live normalized Daegu rail route candidates in the validation query
- rail routes contain subway segments and use the estimated wait contract
- live bus-map validation returned 4 route stops and 2 vehicles for the sampled route
- bus realtime data remained present after bus + rail candidate merging

Merged Transit browser coverage passed all six standard viewports:

- 390×844
- 844×390
- 768×1024
- 1024×768
- 1366×768
- 1920×1080

Observed browser contract:

- 5 combined route cards in the tested state
- subway candidate visible and eligible to become the recommendation
- bus realtime rows preserved
- one bus request + one rail request for a route search in the fixture audit
- horizontal overflow: 0
- page errors: 0
- lazy map request remains deferred until the user opens a bus map

Manual screenshot inspection also passed. Specifically checked:

- no giant blank regions or first-fold displacement
- no map-induced route-card height explosion
- mobile portrait and mobile landscape hierarchy
- tablet portrait/landscape composition
- desktop 1366×768 and 1920×1080 composition
- bus/subway information hierarchy
- sheet clipping and wrapping
- bottom navigation stacking against the map dialog
- transfer route map with one shared transfer marker rather than duplicate boarding/alighting markers
- `승차` / `환승` / `하차` labels remain visually separated from route polylines in the fixture

Post-merge validation for release commit `1448592441a97556ef59ca5af6fff965088f6860`:

- Production health run `33168382121` (#936): success
- Cloudflare clean-route refresh run `33168382109` (#211): success

Vercel REST deployment is not a Flow release-success criterion unless explicitly requested; repository contract plus Production health / Cloudflare clean-route are the release gates.

## Current limitations

- rail waiting time is estimated, not realtime
- no KRIC runtime timetable/realtime integration until separate KRIC authorization exists
- rail routing coverage in this adapter is Daegu Metro 1/2/3, not a nationwide multimodal rail router
- live bus arrival coverage remains opportunistic and may fall back to baseline estimates where the public provider has no usable realtime result
- active-trip guidance such as remaining-stop progress is not yet part of the release

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

1. improve live arrival quality and bus/rail reranking signals without fabricating rail realtime
2. active-trip guidance (`N stops remaining`, boarding/alighting progress)
3. expand rail/regional adapters only where provider contracts and credentials are legitimate
4. integrate useful Transit context more deeply into School Today
5. remove remaining English UI residue across visible + hidden views
6. expand real-user retention measurement before stronger monetization decisions
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
