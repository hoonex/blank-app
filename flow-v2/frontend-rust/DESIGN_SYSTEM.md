# Flow School — Design Authority / Monograph v3 (2026-11-12)

## Decisive direction
**Rounded editorial utility.** Not a collage of square editorial slabs and pill controls. The design must feel like *one product*, not multiple aesthetic experiments. V3 replaces the old `Kinetic Edition` with one coherent radius/motion system. User requested a bold design but no useless decoration.

### Actual design tokens
- **Surfaces: 28px** radius. These are *few*: date canvas, lunch surface, event surface, onboarding form.
- **Rows: 16px** radius, used for hover state, school search choice, week selector. Timetable rows remain transparent until hover: a list, not separate cards.
- **Controls: 999px** pill. Active mobile dock slides as a single highlight and date selector behaves as one moving selection.
- Background `#f4f3ee`, text `#171917`, neon-tinted `#d8fc65`, dark field `#191b18`. No borders or gradient decorations. Dark mode uses separate semantic roles.
- Typography Inter / Pretendard / OS Korean fallback. Hierarchy: prominent date (max 128px desktop, 57px minimum mobile), section title 32–46px, subject 18–24px, metadata 11–13px.

### Subtractive rules
- Remove non-functional giant `F` badge and indefinite decorative background motion.
- Remove `TODAY / FLOW 01`, `01 / PERIODS`, `02 / LUNCH`, `03 / NEXT` visual noise. Korean-first copy.
- Timetable rows must not show a right-pointing arrow or repeated label '수업' when the row is not clickable.
- Never add a new card/panel just because an area looks empty. Real information defines composition.
- Do not repeat brand text in motion overlays. Route wipe spells the **destination** (오늘 / 일정 / 학교 / 설정), which explains what changed.

### Interaction and motion
- Tab change: 530ms clipped color wipe with actual destination label; doesn't intercept pointer events. User can interrupt by changing tab again.
- Date change: 560ms masked numeral rise; the date itself is the moving element.
- Day selection: 430ms shared lime plate (CSS `:has()` progressive enhancement) with immediate date state update.
- Bottom dock: 420ms selection plate, keyboard-focus visible.
- Lesson rows: 400ms entrance with 25ms stagger, no perpetual loops.
- Meal surface: 530ms single reveal, reduced motion removes it.
- All interactions have tactile `:active` feedback and `prefers-reduced-motion` option removes animation.

### Responsive checks
- 390×844 must show all seven class periods without mobile dock hiding the final row. User opens app for timetable first.
- 844×390 landscape should retain data access and a compact bottom dock.
- 768×1024, 1024×768, 1366×768, 1920×1080 have no body horizontal overflow, no cramped cards.
- Calendar is borderless, marks selection by a circular number inside a 16px hover target, is keyboard-accessible.
- First fold should show real date and school data, not a hero illustration.

## References: use as principles, not copied visuals
- [Linear Design Refresh](https://linear.app/now/behind-the-latest-design-refresh): chrome minimization and consistent navigation.
- [Notion Calendar](https://www.notion.com/product/calendar): meaningful date grid and contextual events.
- [Studio Edgar](https://edgar.studio/): typographic confidence; avoid importing oversized decorative lettering for utility flows.
- [Codrops clip-path transitions](https://tympanus.net/codrops/2026/04/08/creating-custom-page-transitions-in-astro-with-barba-js-and-gsap/): masking choreography adapted as native CSS, no GSAP/Barba dependency.
- [MDN animation accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): motion preferences and nonessential animation removal.

## Deployment ownership and limitations
Production was already deployed via the pinned Cloudflare bridge `flow-v2/deploy/cloudflare-bridge.mjs`. This branch's V3 source is not published to production until a passing Rust Trunk build and responsive Chromium audit, then the immutable build pin and Worker are updated. User-authorized early rollout is not full school feature parity: original school tools remain at `/legacy`; University, Transit, Admin, legacy PWA remain intact. No direct edits on `main`.

## V4 functional polish — selected calendar day (2026-11-12)

- Date choice must change the **existing** dark event surface, not just a number highlight. Selected day has a clear MM.DD/weekday header. If an event exists on that date, show it; otherwise show the nearest future loaded event, or a truthful empty state. No additional cards or decorative illustrations.
- Calendar now filters school events by the student's grade, consistently with Today.
- Today/lesson/meal labels refer to the selected date, not always 'today'.
- Keep Monograph V3 geometry: 28px panels, 16px row hover states, 999px controls, no visible borders. A 350ms local reveal is the only new motion; reduced-motion remains respected.

## V4 small-screen final visual adjustment

- On narrow screens, each calendar day with an event uses one 6px round, ink-colored **data marker** in place of microscopic clipped event labels. The event name stays present in the document for assistive technology and is readable at full size in the existing selected-day panel; blank days have no visible marker.
- Narrow calendar-to-detail spacing is 10px, preventing the floating bottom navigation from visually colliding with the lower edge of the selected-day surface. No new card or decoration was introduced.
