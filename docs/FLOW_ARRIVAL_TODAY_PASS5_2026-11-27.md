# Flow School — arrival-first bus and contextual timetable, pass 5

## Baseline and scope

- Production pin b840d431ee93dbd81ba9c4f3fd0def50591efc67; previous Worker 24ab6909-8f40-4159-aecc-38a9cb0ad00c; branch tip 037bc43dcfe7e2d5e59ca5afc9d7cd7a73ec11b3. Live release header and clean branch verified before edits.
- Live browser inspection with fixed 2026-11-26 09:30 KST clock and real NEIS rows showed the narrow inline period banner forcing fragmented Korean text; the bus map auto-opened ahead of arrivals and hid the native toggle. A real night-time BIS query for 09060 returned route status 운행종료; do not infer an arrival time.

## Implementation

- Today: mount status outside the heading controls, use full timetable width. Show current and next actual subject from daily/weekly NEIS DOM, only for observed periods supported by the reference bell clock. Explicit estimated-time/official bell-time-unverified note. Before school show next known lesson; during lesson show reference remaining minutes; after end and other dates no current indicator. Weekly emphasis restricted to today's actual cell, not an entire multi-day row. No high-school bell fallback for elementary/unknown school types.
- Bus: remove automatic map opening and hidden native toggle. Keep exact native map instance, accessible expanded state, and manual refresh. Periodic arrival refresh is no longer gated on presence of map. Optional map follows arrival rows visually; explicit open scrolls/focuses map heading and a map-local close action restores native button focus. Map dimensions reduced. Desktop bus panel max 1000px, arrivals 2 columns; mobile remains one column. Existing bookmarks, search, nearby chooser, school profile, routes, data APIs, Wasm, and campus map project unchanged.
- No new stylesheet or dependency; existing four active runtime assets edited and cache-busted. Existing CSS integrity unchanged.

## Candidate QA

- Static contracts 6/6 action icons and 10/10 design groups.
- scripts/qa-flow-arrival-today.mjs: 3/3, 60 assertions, 320 light/390 dark/1366 light. Real APIs, browser clock simulation only; actual current and next subjects, full width status, before/during/after and non-today, weekly cell, map default closed/no SDK before opt-in, manual refresh with closed map, map visual order, open and close focus, no JS/static HTTP errors. Earlier 54-check run passed before map focus enhancement. Final screenshot evidence in vector-qa/pass6-final/arrival-today-candidate/.
- scripts/qa-flow-browser.mjs: final 16/16 widths 320/360/390/590/768/871/1366/1920 x light/dark. One earlier 15/16 failure was an immediate assertion before native dialog close event; test now awaits both actual dialog closed and aria-expanded=false. Final run passed, no runtime JS/static HTTP errors.
- scripts/qa-flow-school-bus.mjs: final 3/3, 63 assertions, real school and stop search/bookmark reload/removal; no JS/static HTTP errors.
- Candidate uses production APIs with only local static asset interception. Physical touch, screen reader speech, automatic refresh timing under real lifecycle/backgrounding, map tile/network reliability, official bell times, live daytime ETA accuracy, and arbitrary schools not exhaustively verified. Visual flex order places map after arrival rows; full assistive-technology reading-order audit remains. Do not claim complete product redesign.

## Deployment

After final candidate passes, push the static asset commit, verify GitHub byte equality, repin only V2_RELEASE in blank-app while preserving legacy SHA and Worker settings. Verify live changed assets and rerun all three browser suites without interception. Record actual deployed SHA, version, percentage, results in follow-up.

## Production sign-off

- UI pin: `c8ca10ca983a93fee47a19bcdb70449a1900279f`; Worker `8166c92f-c46b-4e8b-8415-e5f2af8ea5df`; deployment `20c88e57-8be5-4bac-ac21-e08ca66fcdab`, 100%, 2026-11-26T15:13:21.776689Z. Rollback version `24ab6909-8f40-4159-aecc-38a9cb0ad00c`. Legacy pin unchanged.
- Changed runtime files: 5/5 GitHub raw and production HTTP 200, byte-for-byte match against Git blobs; production release header `c8ca10ca983a`. HTML SHA256 `99532d33e313b37e2ebb805472c9d8b964f7dd61479ca97bf91b107e3c52cdcb`.
- Live browser: arrival/today 3/3 (60 assertions), global matrix 16/16, school/bus 3/3 (63 assertions), exit 0, zero JS/static HTTP errors. No candidate interception. Evidence `vector-qa/pass6-final/{arrival-today-live,live,school-bus-live}/result.json`. This documentation-only follow-up does not change the deployed pin.
