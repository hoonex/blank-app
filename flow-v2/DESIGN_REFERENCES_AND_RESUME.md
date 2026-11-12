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
