# Flow School — surface & interaction system, 2026-11-26

## User requirement
Flow previously used visually inconsistent cards: some had shadow and hover effects; others did not, without a semantic reason. Research must influence **roles, states, geometry, spacing and motion**, not simply copy screenshots. Apply to Flow School only; preserve the separate campus map project.

## Research inspected and its meaning
- [Atlassian — design tokens](https://atlassian.design/foundations/tokens/design-tokens): a centrally managed token is a single source of truth, particularly for color, elevation, radius and motion.
- [Atlassian — motion](https://atlassian.design/foundations/motion): semantic interaction states rather than arbitrary animation added per page.
- [Atlassian — elevation](https://atlassian.design/foundations/elevation): distinguish flat, elevated and floating roles.
- [Carbon — tiles](https://www.carbondesignsystem.com/building-blocks/core/components/tile/guidelines): informational tiles can remain on the same plane without a lift effect; active components use interactive feedback.
- [Refactoring UI skill](https://github.com/edisonmbli/refactoring-ui-skill): information hierarchy, grouping and consistent visual language.

Flow-specific numeric tokens below are **our design decisions**, not copied measurements or endorsed values from those references. References do not authorize copying their icons, proprietary imagery or layout source.

## Semantic component contract

| Role | Examples | Radius | Border/shadow | Interaction |
|---|---|---|---|---|
| Passive information surface | Month event ledger, desktop bus panel, meal panel | 24px | Faint border + subtle surface shadow | No lift/press/hover |
| Spatial calendar surface | The rotational month card and visible adjacent months | 24px | Controlled wheel shadow | Calendar motion only; no decorative lift |
| Inverse information surface | Selected day's event detail, actual selected bus stop | 24px | Inverse color, no new shadow | Its buttons behave individually; whole surface is not a button |
| Interactive element | School shortcuts, event rows, verified bus stop choices, date filter | 14px or pill for compact chips | Subtle hover tint, common pressed scale | State 160ms, keyboard focus, disabled state |
| Floating overlay | Mobile five-tab dock; modal/picker | Existing component radius | Floating shadow token, stronger than passive surface | Elevation used to indicate layering, not to embellish every card |

Tokens: `--flow-surface-radius:24px`, `--flow-action-radius:14px`, `--flow-surface-border`, `--flow-surface-shadow`, `--flow-wheel-shadow`, `--flow-floating-shadow`, `--flow-motion-state:160ms`, `--flow-motion-layout:240ms`, `--flow-motion-enter:300ms`, `--flow-press-scale:.985`, `--flow-target-size:44px`. Dark variants are centrally supplied. Reduced motion turns shared duration tokens to zero and removes scale; special carousel motion has its own existing reduced-motion behavior.

**Exceptions are explicit:** the rotational calendar card needs spatial depth; a dark selected-day card needs contrast; the mobile Bus screen intentionally has **no parent card** to avoid nested cards. Different purposes can use different containers; they should not accidentally produce different shadows or easing.

## UI changes shipped in this candidate
1. Normalize the above across existing CSS assets: base stylesheet, calendar wheel, month ledger, Bus surfaces and School shortcuts. No new cumulative stylesheet is added; existing selectors now consume central variables.
2. Schedule's existing complete month-event list gets three filters: `전체`, `시험·평가`, `휴업·방학`. These match **words in the actual event title only**. They are not official event type classifications, and there are no new backend/API calls.
3. Bus screen shows native stop search **before** the optional nearest-stop chooser. Current location is never requested without pressing its existing button. The verified BIS 3-stop lookup, actual stop identifiers, manual search, selected stop and map logic are unchanged. Empty helper text is reduced.
4. All linked changed assets require URL cache-busting; the root stylesheet's SHA384 SRI value must be recomputed from the committed Git blob. Do not remove the integrity check to make QA pass.

## Limitations and follow-up
- This is the first shared-token pass across **Schedule/Bus/School and the calendar wheel**, not a completed audit of every component, onboarding flow, menu, and all legacy motion.
- Event filters cannot classify unnamed/nonstandard school event types. On a partial API response, the interface explicitly says the list is partial.
- No location is inferred, and Bus arrival estimates must come only from actual BIS data. Offline or unsupported cities should not show synthetic ETAs.
- All current data is user-specific; screenshot audit used an explicit test profile, not evidence that every school has equivalent data.
- Continue with a component inventory for onboarding, meal segments, settings, desktop navigation and the five-tab dock. Remove duplicate rules gradually **after tests**, not by creating more overlays.
- Real Samsung touch/gesture tests remain unverified and must not be reported as passed.

## QA checklist (required before deploy)
- CSS SRI valid with the new stylesheet blob; dark/light computed backgrounds and panel radius.
- 320, 390, 590, 800 and 1366px layouts without horizontal overflow.
- Month event title filter shows only matching real rows; count reflects filtered/total and partial status.
- Native calendar dates and month wheel swipe still work; event row selection still chooses the original Leptos date.
- Bus search can be used without GPS; nearby location prompt is optional; existing stop search/selection not broken.
- Five tabs, today's timetable, meal week/month, school shortcuts, focus, reduced motion and desktop layout.
- Compare visible screenshots before release, and verify **actual production assets after deployment**.

## QA outcome on the candidate (local browser routing, before deployment)

- 7 matrix runs: 320, 390, 590, 800, 1366px in light, plus 390 and 1366px in dark; 7/7 completed with no uncaught page errors or horizontal overflow. Evaluated computed radius for both month wheel and month ledger: **24px**; School shortcut **14px**; Bus search **14px**. All nine changed assets loaded.
- 2026-11 calendar had 5 actual event rows in the tested school's data: '시험·평가' matched the one school-event title containing 시험, while '휴업·방학' matched four 토요휴업일 rows. Clicking the exam row selected the real Leptos calendar date **11.19**.
- Today week-date selection, menu Week→Month→Week, native timetable edit input and five-tab navigation tested at 320, 390 and 1366px.
- Actual native Daegu BIS search returned 11 동대구역-name candidates at 390 and 1366px in a separate query test. Choosing 정류장 09060 mounted the stop-position map and a 24px inverse surface without JS errors; this did **not** verify a live bus ETA.
- The primary CSS integrity hash is calculated from the staged Git blob (not the local CRLF working copy); the candidate HTML and browser route preserve SRI enforcement. No Rust/Wasm integrity, private bindings or navigation code changed.
- The actual deployed Worker version and a real Samsung phone have **not** been verified at the time of this written candidate report.
