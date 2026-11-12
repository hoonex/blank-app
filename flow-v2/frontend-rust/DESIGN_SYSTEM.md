# Flow Design System — Wayfinding (v3 exploratory)

Status: **isolated Rust preview** (PR #273); not approved for production.

## Product job

A student should answer three questions within one glance: "What classes do I have today?", "What's for lunch?", and "What's coming up?" Avoid marketing-style UI, large hero banners, decorative numbers, duplicated headings, and the old three equal-size stat cards. The portal is an everyday instrument, not a landing page.

## Primary direction

**Calm utility + decisive interaction.** Inspiration is drawn from current real products and platform guidance, never their original pixels/source/assets. Functional style: softly warm, near-neutral surfaces; coral only for navigational emphasis and meaningful interactions. Most boundaries are subtle 1px lines rather than stacked cards.

### References inspected and interpretation

| Real reference | Design insight transferred | Do not copy |
| --- | --- | --- |
| [Linear's 2026 UI refresh](https://linear.app/now/behind-the-latest-design-refresh) | Reduce sidebar contrast, let task data dominate, compact control rows, clear location | Linear logos, icons, exact spacing/color |
| [Linear 2024 redesign](https://linear.app/now/how-we-redesigned-the-linear-ui) | Align labels and actions, consistent density between screens | Issue-tracker-specific hierarchy |
| [Notion Calendar](https://www.notion.com/product/calendar) | Date cells and events share a visual grammar; keep current date salient | Color-coded event data unless real types exist |
| [Apple HIG: design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/) | Clear focus, agency, robust mobile interactions | Platform-specific control art |
| [Apple HIG: motion](https://developer.apple.com/design/human-interface-guidelines/motion) | Motion conveys state and causality, is never an interaction blocker | Nonessential looping animation |
| [Material motion: duration and easing](https://m1.material.io/motion/duration-easing.html) | Fast 150–300 ms controls; distance-aware longer transitions | Slow, unconditional 600ms page wipes |
| [MDN View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using) | Shared-context transitions are possible with a feature-detected fallback | Do not force global snapshot transitions for tiny control changes |
| [Geist typography](https://vercel.com/geist/typography) | Consistent type roles, caps used only sparingly | Vercel brand type/style or English UI copy |

### Design decisions by screen

- **Today, mobile:** compact contextual header, seven-day strip, one flat summary line, visible timetable starting immediately. Meal and future event follow the timetable rather than preceding it.
- **Today, desktop:** same information in a clear timetable + secondary column. No huge empty headline or three equal KPI cards.
- **Week:** each column conveys subjects, not merely count and first subject. On mobile and tablet, five compact day rows keep the selected day's subjects discoverable without sideways scrolling. Five columns appear only on wide desktop.
- **Calendar:** user must distinguish current day, selected day, and event-bearing days by semantic style. Do not hide event names unless the cell is genuinely narrow.
- **School / Settings / Onboarding:** share the same typography, spacing, corner radii and accent; no independent theme.

## Tokens and spacing

- Surface / background: #ffffff / #f7f8f6. Text: #1b211e. Muted: #6b746d.
- Accent: #d94a32 (dark #ff8169) only for focus, state, hairline, and rare CTA.
- Text / surface proportions: 11–12px metadata, 13–14px regular information, 16–19px section titles, 27–43px contextual headings.
- Spacing based on 4/8/12/16/20/24 units; radius 9/10/14.
- One background surface per logical module; no multiple nested shadowed cards.

## Motion rules

- Screen entry: 320ms, translate 10px, opacity change; **not** a cinematic full-screen wipe.
- Row entrance: 270ms with bounded stagger <= 150ms, primarily on list arrival, not on every hover.
- Press response: 160–200ms, scaled to 0.93–0.95.
- Selected day: immediate data update and a single moving dark selection plate (330ms, CSS :has progressive enhancement); accent underline tracks the chosen cell. Press interaction remains immediate.
- Sidebar active: 230ms hairline grow. Tab switches should not block input.
- Prefer transform and opacity, no full-page blur or canvas. Disable motion via prefers-reduced-motion.

## Test / release acceptance

1. 390×844 first fold must display header, date strip, summary, timetable title and most/all timetable rows with normal seven-period fixture; no large empty region.
2. 844×390 landscape and tablet/desktop widths cannot overflow horizontally.
3. Today/week, date pager, calendar month selection, dark toggle and keyboard focus remain functional.
4. Long subject and school names wrap/clamp intentionally; 200% zoom remains navigable.
5. Console errors zero. Reduced-motion must remove animations without hiding information.
6. Keep original domain, current Cloudflare service, AdFit, school-data API, university, transit and admin untouched until explicit parity review.

## Change note — selected date marker

In Chromium and other modern :has-supporting browsers, the seven-day selector uses one moving highlight plate with fallback static selected states. No JavaScript animation loop, no canvas and no repeated DOM observers.

## QA correction: week view

A six-viewport screenshot review exposed an empty-first-column problem: the fixture has subjects only on Thursday, so a horizontally scrollable five-column mobile layout hid real subjects. Switched the compact week view to vertical day rows and added a first-fold check for the selected day. In genuinely wide desktop, five columns remain comparable without horizontal scrolling.
