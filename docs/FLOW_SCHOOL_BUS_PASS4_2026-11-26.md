# Flow School — school selection and explicit bus bookmarks

## Scope and baseline

- Previous production pin 4738405dee674c4b4ad6638a4cc3ad6fefa356d1, Worker 93dab987-c7e6-4313-9e2a-3c1bb923c490; branch tip 2b087982d302c5f285623e0df1643b0b4dd42072 verified against remote and live response. Keep separate campus map, Rust/Wasm, NEIS endpoints, wheel and five tabs untouched.
- Live browser audit: original school results stayed in DOM after choosing a school, selected summary had a CSS-generated change label instead of a native button; a single native localStorage key flow-daegu-favorite-stop-v1 is actually the last selected stop. Do not reinterpret that as user-authorized bookmarking.

## Changes

- School picker: native result buttons remain authoritative; Korean IME composition postpones type-ahead; Enter searches, ArrowDown/Up navigates real buttons, Escape dismisses the list. Hide inactive results from tab order and assistive technology; focus grade selector after choosing. Real 44px change button replaces CSS pseudo-label. Grade selection continues to use existing elementary/middle/high rules. School tab exposes change action via existing settings, not a second profile store. Missing phone shows information unavailable.
- Bus: separate local key flow-daegu-saved-stops-v1, explicitly toggled by a common SVG bookmark. Up to six verified stops, de-duplicate by BIS stop ID. Name + exact stop number matched by existing search bridge when opening; distinct opposite-direction stops preserved. Storage failure is reported, not shown as success. Existing last stop, map, search, and nearby behavior remain intact. No fabricated arrivals, coordinates or server writes. Saved locations are only in browser storage.
- Existing stylesheets extended using shared action radius, 44px hit target, colors and motion; no extra stylesheet, library or binary build. Updated asset query versions and contract.

## Candidate QA

- node scripts/qa-flow-action-icons.mjs: 6/6 groups; node scripts/qa-flow-design-system.mjs: 10/10 groups.
- node scripts/qa-flow-school-bus.mjs: 3/3 (320 light, 390 dark, 1366 light), 21 assertions each, zero JS or static HTTP errors. Fresh real school search (정동고 and 정동초등학교), keyboard result selection, grade changes 6 to 3, school settings navigation, real BIS search 동대구역 and 동대구역건너 (09060, 09061), explicit bookmarking, reload, exact direction open, individual and last removal, native last stop retained. Browser uses real APIs; local candidate intercepts only static assets. The onboarding portion begins in default light before switching to dark after entering the app.
- node scripts/qa-flow-browser.mjs: 16/16, all eight widths × two themes; zero JS/static asset errors. Full regression includes changed asset list. Evidence vector-qa/pass5/{school-bus-candidate,candidate}/.
- Screenshots inspected at 390 and 1366. Remaining: map occupies excessive vertical space during selected-stop loading; real live arrival freshness, GPS permissions on physical devices, physical Korean IME, screen readers and multi-school full profile switching are not exhaustively verified. Selected-stop bookmark persistence is tested, not arrival time accuracy. No new fake data.

## Deploy gate

Commit and push only validated static assets and tests. Update only the Flow Worker V2 release pin after rechecking current version, preserve legacy pin and settings. Repeat changed asset byte comparison and browser tests without interception. Record deployment version and QA in separate follow-up.
