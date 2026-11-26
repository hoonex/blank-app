# Flow School — Today V3 editorial pass (2026-11-26)

## Decision

The first priority is not more widgets or decorative motion. A student should find the selected day, classes and lunch without deciphering competing controls. This is phase 1 (Today screen) of the wider Flow product redesign; Schedule, School and Bus remain unchanged.

## Source and implementation

- Baseline production release: 08f028b0dbf63a7c02b8f13b1a500abf1cf6b4c8.
- Keep the tested Rust/Leptos and NEIS-derived timetable, calendar and meals. No guesses about official bell times, and no new network calls.
- Replace flow-editorial-refine-v1.css with flow-editorial-refine-v2.css, retaining the existing School utility styles. Replace flow-date-ribbon-v2.css with flow-date-ribbon-v3.css for desktop gutter alignment; reference these replacements in index.html. Do not add another cumulative CSS layer.
- The 21 linked stylesheets and 14 external non-module scripts remain the same count. No other app/project is touched.

## Design differences

1. One consistent grid. Desktop week ribbon and two Today columns share a centered 1140px maximum width.
2. Structured only where useful. The lesson list is a compact timeline of actual assigned class periods. Its circles are course numbers, not invented bell times. Existing active/done classes remain functional when reference-time detection is available.
3. Less control competition. Editing becomes a secondary text action. The existing day/week segmented control stays functional.
4. Lunch as content, not repeated cards. A two-column food list is primary. The week selector becomes a thin strip of actual days rather than repeated menu teasers; accessibility labels still describe menus. Monthly meal view remains available.
5. Keep the floating dock and scroll space. No changes to the five-tab gesture engine; mobile Today retains scroll padding below the dock.
6. Light/dark consistency. Reuse existing theme tokens; no new fonts or imagery.

## Grounded pre-deploy QA

On Chrome/Playwright against the real deployed app, routing only the two replacement CSS files in the browser:

- Responsive widths: 320, 360, 390, 590, 768, 1366, 1920px — 7/7.
- Native date selection/reversal; meal day selection; Week/Month/Week toggles; all five navigation tabs; existing subject editor; dark mode — passed.
- No uncaught JS errors or horizontal overflow in these viewport tests.
- At 390px, timetable height reduced from about 261px to about 239px and lunch moved from y503 to y483. Lunch panel height reduced from about 379px to about 328px.
- At 1366px, ribbon, left timetable and right lunch card share an x=113px/1140px alignment.
- Not verified: actual Samsung touch feel, screen-reader announcements, and first-time onboarding over slow networks.

## Product constraints and next phases

Visual polish is not proof of retention. Future phases should measure time to locate today's lesson, lunch and bus stop, and week-on-week voluntary return; no gamification just for engagement. Schedule should optimize event search; School should optimize links; Bus should prioritize actual BIS data. Avoid duplicating an inferior map service.

Rollback: pin Worker release to baseline SHA; previous assets remain available.
