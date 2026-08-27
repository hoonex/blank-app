# Flow Current Status

> Updated: 2026-08-28 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. If a status statement in the history file is older than this file, use this file, then verify against current GitHub state.

## Repository baseline

- Repository: `hoonex/blank-app`
- Latest verified main after Transit release: `06d96d6460a63b7dc40b1aef0386ae5f99378096`
- PR #148 `feat: add live School transit routes`: squash merged
- Merge commit: `06d96d6460a63b7dc40b1aef0386ae5f99378096`
- GitHub current state is always the final source of truth; re-check main/open PRs/CI before writes.

## Transit release state

School Transit is now merged into main.

Implemented first-release scope:

- School `교통` navigation destination
- current-location opt-in after explicit user action
- destination geocoding through Kakao
- TAGO / Public Data Portal bus routing
- up to five normalized route candidates
- direct bus + one-transfer bus routing
- walking legs
- boarding/alighting stops
- estimated duration / arrival time
- recommendation and secondary route badges
- TAGO arrival enrichment when available
- visible-view refresh without hidden-view continuous polling
- `/transit` clean-route support and PWA shell caching

Current limitation:

- first release is bus-oriented; subway/multimodal routing is not complete yet
- realtime arrival coverage is opportunistic/partial and may fall back to baseline wait estimates
- regional adapters / GTFS-based expansion remain future work

## Transit root cause that blocked release

The long-running address-only `502` was not a Kakao coordinate, TAGO coverage, pagination, or region-name failure.

The actual defect was input parsing:

```ts
Number(null) === 0
```

The old `finite()` helper therefore interpreted missing `ex`/`ey` query parameters as valid zero coordinates. Address-only requests skipped Kakao geocoding and attempted destination stop discovery around `(0, 0)`.

Release fix:

```ts
if (value === null || !value.trim()) return null;
```

After the fix, missing destination coordinates correctly enter the Kakao geocode path.

Supabase production function:

- `transit-data` v12 ACTIVE
- secrets remain server-side
- canonical Public Data Portal credential: `DATA_GO_KR_SERVICE_KEY`
- Kakao credential: `KAKAO_REST_KEY`

Temporary diagnostic `transit-daegu-probe` was retired after release:

- v17
- `verify_jwt=true`
- no external API calls or secrets returned
- static HTTP 410 diagnostic-disabled response

## Transit validation

Final PR head before merge: `811958441ecfe407c6952b3befcc8dca79e66e7b`

All relevant PR checks were GREEN before merge, including:

- School Transit live-route audit
- Browser UX
- Full Orientation
- Production health
- Cloudflare clean-route refresh
- University mode/theme/dashboard
- Admin / Admin bootstrap & inventory
- Liquid Glass stability
- Kakao AdFit layout
- School landscape toolbar
- ULW polish
- Campus route editor
- Dashboard editor v2

Transit responsive audit passed all six standard viewports:

- 390×844
- 844×390
- 768×1024
- 1024×768
- 1366×768
- 1920×1080

Observed contract:

- 5 route cards rendered in tested route state
- horizontal overflow: 0
- page errors: 0
- visual review: no release-blocking clipping, blank-region, or hierarchy regression

Post-merge main validation:

- Production health run `33094591081`: success
- Cloudflare clean-route refresh run `33094591153`: success

Vercel REST deployment is not a Flow release-success criterion unless explicitly requested; use the repository contract and production/clean-route health as the primary gate.

## Preserved product contracts

Do not regress these while extending Transit:

- real Optical Glass/refraction; do not replace it with blur-only imitation
- School Week stays a timetable toggle, not a restored primary nav destination
- School AdFit remains where currently approved; do not add more ads without explicit user direction
- secrets stay server-side
- no automatic geolocation prompt on page load
- hidden views do not continuously rerender or poll
- no duplicate API fetch/runtime/MutationObserver layer without structural need
- main is never edited directly
- relevant RED CI blocks merge
- UI changes require six-viewport screenshot inspection

## Next likely product work

Recommended order unless the user directs otherwise:

1. Transit subway/multimodal architecture and regional adapters
2. better live arrival/reranking coverage
3. active-trip guidance (`N stops remaining`, boarding/alighting progress)
4. integrate Transit context more deeply into School Today
5. remove remaining English UI residue across visible + hidden views
6. expand real-user retention measurement before stronger monetization decisions
7. keep `FLOW_PROJECT_HISTORY.md` for durable mock-startup evidence and update this file for fast-changing state

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
