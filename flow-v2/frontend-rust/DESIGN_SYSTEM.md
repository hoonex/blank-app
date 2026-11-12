# Flow School V2 — Kinetic Edition / Design System

Status: isolated Rust/Leptos WebAssembly prototype on draft PR #273, **NOT production**.

## Creative brief

- User instruction (November 12): abandon generic dashboard design, **no visible borders**, use visually bold, real design and animation references.
- Core job: school timetable, lunch, events in a readable functional daily flow; never sacrifice keyboard/touch affordances and real data for a visual gimmick.
- Identity: kinetic typography × editorial grid × inverted printed matter. Inspired by expressive studio sites, adapted to school utility. **Not a clone.**

## References — visual language and implementation details

| Source inspected | Source | Decision we actually applied | Explicit non-copy |
| --- | --- | --- | --- |
| Studio Edgar | https://edgar.studio/ | Bold black/white type, oversized date numerals, constrained kinetic reveal | No copied lettering/assets, layout, branding, source or motion code |
| Codrops — Bisous editorial CGI | https://tympanus.net/codrops/2026/06/29/inside-bisous-designing-an-editorial-experience-for-cinematic-cgi/ | Asymmetric 2-column editorial hierarchy; narrow technical microtext vs large display text; quiet neutral palette | Avoid CGI assets/photography and original identity |
| Codrops — custom transitions | https://tympanus.net/codrops/2026/04/08/creating-custom-page-transitions-in-astro-with-barba-js-and-gsap/ | Two-phase incoming mask and exit, overlapping display typography | No Astro/Barba/GSAP runtime copied into Rust app |
| Codrops — clip-path layers | https://tympanus.net/codrops/2023/10/31/image-layer-animations-with-clip-path/ | Native CSS clip-path reveal applied as section transition (not a global blur) | Do not reproduce licensed image layers |
| MDN — View Transitions API | https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using | Future upgrade path for browser-native shared-element continuity; current Rust-keyed transition is CSS to avoid JS dependency | Don't claim View Transitions API is being used when it is not |
| Material motion | https://m1.material.io/motion/duration-easing.html | Input state ~190–480ms; large cross-screen scene can be ~820ms if user can continue interacting | No long blocking loads |
| Chrome Modern Web Motion | https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/motion | Prefer opacity/transform; use clip masks only on overlays; honor reduced motion and focus visibility | No endless ambient loops |

## Four invariants

1. **No decorative borders anywhere**. Layout distinction relies on dramatic typographic scale, ink vs paper field, negative space and a single highlighted dark/lime panel. Focus rings are allowed for accessibility.
2. **No dashboard cards**. Timetable is a continuous typographic list; lunch becomes an editorial lime slab; events a free-standing text composition.
3. **One coherent transition model**. Rust updates the tab immediately, mounts a unique indexed CSS-only sweep overlay; an 820ms two-phase mask crosses the viewport with huge type. It is pointer-events:none and is interrupted/replaced on a new tab click.
4. **Motion must encode a change**. Date numerals reenter on date change, seven-day selector travels on selection, lesson rows stagger only on redraw, mobile dock uses a sliding liquid plate; no random waves or ornamental parallax.

## Visual roles

- Base paper: #f1f0ea; ink: #141513; near-white #f9f9f3.
- Accent: electric citron #d8ff5b. One accent; used for active selection, date-related focus, the lunch panel and transition sheet.
- Display: Inter/Pretendard system fallback (no third-party font hosted). 79–206px numerals in hero desktop/mobile variable. Section 32–57px, lesson names 19–29px, metadata 10–13px.
- Navigation: global header integrated into black band; on mobile a single suspended black bar with shared moving active plate, no card frames.
- Screen composition: black date canvas / cream timetable field / lime lunch composition. Avoid English decoration on everyday school information; short monospaced-ish technical indices are allowed in display-only context.

## Motion contract

| Trigger | Motion | Time | Fallback |
| --- | --- | --- | --- |
| Tab change | Full-viewport mask enters, brief hold, exits toward top, with moving oversized "flow" typography | 820ms | Fade/instant on reduced motion |
| Date change | Date numerals rise from masked baseline and rotate to rest | 800ms | Immediate content |
| Day selection | Single lime capsule travels between seven dates | 480ms | Direct active button |
| Bottom navigation | Single lime capsule follows active tab | 550ms | Direct active button |
| Lesson list | Rows arrive from below with 40ms interval | 620ms base | Static rows |
| Lunch | 720ms downward reveal of single contrasting composition | 720ms | Static block |
| Press/hover | Scale or translate ~190–300ms, immediate input | 190–300ms | Focus-visible outline remains |

Rust is the only controller of tab/date/theme state. CSS owns visual motion; no animation-library JavaScript or DOM observers. Nothing plays continuously during idle.

## Responsive and performance QA

- Matrix: 390x844, 844x390, 768x1024, 1024x768, 1366x768, 1920x1080. No horizontal overflow.
- 390x844 must show date, day chooser and top of timetable before scrolling. Seven classroom periods must remain reachable and real data visible.
- Short mobile landscape nav must not obscure actions; UI still scrolls naturally.
- Week view: all five weekdays accessible, no horizontally hiding selected day; viewport-based list/grid.
- Motion: test programmatic tab change and confirm overlay exists, default returns to visible state, user can trigger new tab during ongoing animation.
- The app supports reduced-motion by globally disabling animation and transition.
- Font scaling and text wrapping, keyboard focus and selected state must be understandable without animation.
- No visual source/code/asset from references has been copied or included.

## Out of scope and preservation

Existing production Flow domain, AdFit, original School/University/Transit/Admin APIs and PWA remain unchanged. Rust frontend still defaults to original school-data API and Rust Worker native NEIS path remains isolated. Do not merge before full functional parity, live NEIS integration and visual/interaction QA.
