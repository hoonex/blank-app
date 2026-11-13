# Flow School — Reference Atlas and Resumption Notes

Updated: 2026-11-13 KST. Working branch: `feat/flow-v2-rust-bun-redesign-20261112`, PR #273. This page is a product-specific reference map, **not** a list of visual assets to copy.

## Decisions locked by user

- Everyday school portal, not a marketing landing page. Focus: Today, 5-day Timetable, Meals, Events, School, Settings.
- Round 28px primary areas / 16px interactive items / pill controls. No decorative borders and no invented widgets.
- Black + warm off-white background; accent shifted from fluorescent lime to restrained terracotta **#D98570** (dark **#E5A492**). Don't switch colors or shape systems without a concrete need.
- Week view = a 5-column by period matrix; keep all weekdays simultaneously visible on narrow portrait devices. A selected-day highlight uses one consistent color.
- Lunch shows menu names without bullets or decorative separators; centered and balanced.
- Native bottom tab bar must remain anchored through scrolling/viewport height changes. Real swipe/drag remains working, reduced motion respected.
- Existing domain: `https://blank-app.agfvrd.workers.dev/`. Legacy: `/legacy`; preserve old Transit, Admin, University routes.
- No fabricated bus arrival data. Bus API integration remains separately validated and should not delay the UI fixes.

## Reference collection (studied for behavior, not for copyrighted UI/source reuse)

### Week scheduling & visual data density
1. [Notion Calendar — weekly layout](https://www.notion.com/product/calendar): balanced day columns, time-aligned rows, data-first.
2. [Notion — calendar layout documentation](https://www.notion.com/ko/help/calendars): predictable day/week change semantics, current date.
3. [Fantastical — shared calendar week view](https://flexibits.com/blog/2022/06/be-on-the-same-page-with-shared-calendars-in-fantastical/): weekday columns and consistent scanning rhythm.
4. [Things 3 — interaction and layout language](https://culturedcode.com/things/features/): focused hierarchy, the content reorganizes rather than a new decorative card.
5. [Linear 2026 UI refresh](https://linear.app/now/behind-the-latest-design-refresh): useful density, softened secondary chrome, hierarchy that does not compete for attention.

### Tab movement, press feedback & page entrance
6. [Motion — shared layout animation](https://motion.dev/docs/react-layout-animations): single spatial indicator sliding between selections; conceptual reference only, **no React dependency**.
7. [Motion — vanilla layout animation](https://motion.dev/docs/layout-animations): transform-based FLIP and shared element motion; interruption/scroll caution.
8. [GSAP Flip](https://gsap.com/docs/v3/Plugins/Flip/): position interpolation after changing state; inspiration, **no GSAP shipped**.
9. [Material — Shared Axis](https://developer.android.com/reference/com/google/android/material/transition/MaterialSharedAxis): directional X transition and related enter/exit semantics.
10. [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion): feedback should signal status, reduced motion and stable frames.
11. [Codrops Interlude](https://github.com/codrops/interlude): layered old/new navigation scenes and choreography; no code copied.
12. [MDN — View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using): snapshot transitions have gesture/scroll/interruptibility tradeoffs; current architecture keeps Rust state + CSS.
13. [Material 3 expressive motion](https://developer.android.com/design/ui/wear/guides/get-started/levels-expression): pressed morphing is purposeful when it communicates direct manipulation.

### Touch, navigation, platform behavior
14. [Apple HIG — Tab Bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): top-level tabs stable, labels always visible; do not bury or let scroll arbitrarily displace the dock.
15. [Android — System Bars](https://developer.android.com/design/ui/mobile/guides/foundations/system-bars): gesture insets, edge-to-edge and bottom navigation protection.
16. [MDN — touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action): preserve vertical pan while intercepting intentional horizontal app swipes.
17. [MDN — scrollbar-gutter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scrollbar-gutter): avoid layout jumps when scrolling conditions change.
18. [Radix — accessible tabs](https://www.radix-ui.com/primitives/docs/components/tabs): keyboard orientation and focus/selected state; conceptual behavior only.
19. [Geist typography](https://vercel.com/geist/typography): disciplined typography roles and weights; don't import brand fonts.

## QA expectations and known risks

- Rust/WebAssembly typecheck and production static build required; independent **browser** checks required for 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080.
- Visual review of home / 5-column week / calendar / dark theme; no clipping or hidden week data at 390px.
- Touch test: header selects a weekday, nav thumb can drag, page horizontal swipe changes route, vertical scroll does not move fixed nav.
- Actual Android browser has dynamic toolbars: Playwright desktop-mobile emulation is helpful but not identical to hardware. Do not claim an Android real-device fix without device test.
- Existing features may still be legacy-only. Do not silently remove working endpoints.

## Resume checklist if the session ends

1. Read `AGENTS.md`, `FLOW_CURRENT_STATUS.md`, this file, and PR #273 head/CI.
2. Confirm immutable GitHub Rust static release SHA and review screenshots from the newest successful `Flow V2 Rust web` CI.
3. If browser checks are green, update `flow-v2/deploy/cloudflare-bridge.mjs` to the verified static release commit. Test separate Cloudflare preview Worker first, then update `blank-app`; compare existing deployment version before writing.
4. Browser-test live `/`, `/legacy`, `/university`, `/admin`, `/transit`, and WASM/CSS after launch.
5. Check on real Galaxy mobile browser for dynamic address-bar scroll jitter and touch highlight. If a mismatch persists, report it explicitly and keep previous deployed version for instant rollback.
6. Next independent project: assess official Daegu bus stop arrival API quota/caching; no invented ETA.

## November 13 — date/dock correction validated against Android screenshots

- **Reference screenshots** from Chrome mobile showed: 7 days compressed with previous/today/next buttons; system gesture bar crossing floating navigation; content visible *behind* dock; unsatisfying full-screen route curtain.
- **Date interaction**: five evenly-sized day buttons (selected in center); swipe left/right changes date by one day. On touch move the row follows the finger up to a 65px rubber-band limit. No previous/today/next controls. Buttons can be tapped, keep accessible date labels and immediate pressed feedback.
- **Dock**: fixed-overlay approach was rejected after screenshot QA. App shell is a column with independently scrollable main viewport and bottom navigation as a *separate grid/flex row*; bottom gutter reserves room for Android system gestures. The tab thumb still tracks finger-drag; scrolling cannot put a lesson or event behind the dock.
- **Transitions**: removed 720ms whole-screen portal and generic full-screen label. Route content enters in 360ms with a bounded directional clip/translate. Date row keyed by day gets a 300ms one-step slide. Reduced-motion users see content immediately. Hover decoration is gated to mouse-like pointers only.
- **CI evidence**: Rust WASM + Chromium 390x844,844x390,768x1024,1024x768,1366x768,1920x1080 passed run 43255818992; a separate captured nav-at-content-bottom image visually confirms meal and next event remain readable above the dock. Test additionally emulates a shrinking viewport and verifies dock stays in the expected row.
- **Caveat**: simulated viewport resizing is not identical to Samsung Internet/Chrome physical dynamic toolbar. Do not claim hardware verification until the user checks on device.

### If resumed in a new session

1. Get current PR #273 branch HEAD, production Cloudflare Worker version, and this documentation.
2. Check whether static release `6b4047e474e54e7edf2209876d1b5c704f80dc55` is pinned in `flow-v2/deploy/cloudflare-bridge.mjs`. If only the bridge was committed, **preview and deploy**; do not assume GitHub code changes equal production.
3. Check live `/`, `/legacy`, `/transit`, `/university`, `/admin` and verify new CSS/JS asset hashes and WASM. Rollback to recorded previous Worker version on any regression.
4. User physical Chrome/Samsung screenshot for scroll + gesture bar is the final acceptance test. Follow up on left/right swipe tactile animation only if still deficient on device.

## 2026-11-13 — completed final production rollout

- **Live site:** https://blank-app.agfvrd.workers.dev/ — Worker version `d63380ab-8424-4b9d-817d-1c66077ea5cd`, built Rust asset pin `bf350345ba852081c64cf7e9c61d9164c9820f9f`.
- **CI:** run `43331188145` succeeded across all six responsive viewports, real touch swipe, fixed floating dock scroll, tab-switch scroll reset, calendar, mocked bus UI and reduced-motion. Verified actual screen captures, notably `schedule-390x844`, `today-fold-390x844`, `nav-at-content-bottom-390x844`, `bus-390x844`.
- **Preview real source:** BIS stop search for 동대구역 returned multiple named stops and IDs. Arrivals for stop `7011006800` returned source route 708/805/818/402 and other values. This independently verifies the server API, not just mocked browser fixtures. Live UI is enabled; do not call its predictions authoritative beyond provider response.
- **Production:** browser rendering verified correct JS `flow-school-web-52618af9f2f706b0.js`, CSS `style-6e347386e303d1ae.css`, wasm mounted. Legacy/Transit/University/Admin all HTTP 200.
- **Rollback:** old production Worker version `07054114-b7a9-4867-a39b-c1f880134371`, previous Rust release `6b4047e474e54e7edf2209876d1b5c704f80dc55`.
- **Next priorities:** physical Samsung browser scroll/gesture bar screenshot; BusInfo real data freshness states and route-map feature if requested; integration of legacy subject editing and PWA; replace Github raw proxy with native Cloudflare Assets. The bus site's internal web endpoints are undocumented and may change; authenticated official public-data API is a planned fallback, not the current live source.

## 2026-11-13 — exact Galaxy Tab horizontal complaint closed

- Source verified `bf2324c41c5694c4015dcbd410f0d88a0f91bae9`. CI `43339873290` passed 390×844, 844×390, 768×1024, 1024×768, 1366×768, **1536×960**, 1920×1080.
- Removed numeral clipping: the date motion wrapper is no longer overflow-hidden, glyph line-height and padding were corrected. Visual capture at 1536×960 reviewed, large numbers complete.
- Hero date band fills available width; 5/7/11 visible dates by CSS breakpoint, selected date stays centered. Touchmove translates the rail directly; release selects a proportional number of days from the gesture distance, not the old hardcoded ±1. This is continuous finger-following with multi-day snapping; it is **not** a long virtualized native momentum scroll list.
- Current day has an explicit “오늘” tag and `aria-current=date`; a contextual today-reset appears when browsing other dates, including short landscape.
- Kept mobile bottom nav / native lesson editor / bus proxy unchanged and did not reintroduce old-version links. Official NEIS datasets were researched, but no new endpoints were added: school basic info, class info, high school timetable (including course/room fields where supplied), event names/details/grade applicability, meal dishes/calories/allergy codes and school department info. Official catalog: https://open.neis.go.kr/portal/data/dataset/searchDatasetPage.do . Public NEIS OpenAPI differs from NEIS+ private student portal; no grades/records access is asserted.
- Production Worker version `e272e8fc-cdc7-4c57-b32b-56f9a82be987`; previous rollback version `d276815e-cd8f-4018-9df0-3eb35d92d7c4`. User's physical browser dynamic toolbar remains untested; Chromium 1536×960 matches the content viewport, not Android chrome.

### Next user-requested feature priorities

1. If requested, expose existing NEIS allergy numbers as friendly names with clear data provenance, add available event description without inventing text, and optionally show official classroom/room data only if underlying API actually supplies it.
2. Review high school timetable data for grade/class identity correctness and preserve current device-local manual corrections.
3. Continue visual/on-device QA for the responsive 5/7/11-day strip and bottom navigation.
