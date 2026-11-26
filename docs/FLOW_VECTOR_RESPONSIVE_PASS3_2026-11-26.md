# Flow School — vector and responsive consistency, pass 3

## Baseline and boundaries

- Starting branch: `flow-vector-controls-20261126`, commit `176e3a9c65135468b288e9a0ce30155950b30e44` (remote verified). Default branch HEAD `b1ac095b47baa0c09430559bf127e7c873fa9263` is not the deployed UI.
- Previous user handoff `b447d58` / Worker `4a16bd8c` was already superseded. Fresh production GET reported `176e3a9c6513`; Cloudflare deployment `70bd481c-6fea-436f-9fb0-ee154b289614` at 100%, confirmed before changes. Worker pins GitHub static UI and legacy SHA separately.
- Worktree contains shipped static assets, not Rust source. Wasm, generated bindings, NEIS endpoints, campus-map project, existing wheel engine and five-tab navigation are unchanged. No new CSS overlay, library, or API.

## Reference review and design decisions

Reviewed public product pages/help, public pattern-library descriptions and component guidance; not installed native apps or authenticated/private libraries. The decisions are Flow-specific interpretations, not claims of a full hands-on competitor test.

| Source | Problem and hierarchy | Control/interaction model; responsive distinction | Adopt / reject |
|---|---|---|---|
| [Haksi](https://www.haksi.kr/start), [guide](https://www.haksi.kr/blog/학교시간표com-사용-가이드) | School/class once, timetable and meals immediately | Compact daily information; wide views can put information side by side, narrow views stack it | Keep current school profile, timetable and menu priority; do not clone visual identity or add unrelated exam products |
| [Structured](https://structured.app/) | Daily timeline ordered by time and next action | Timeline and task completion; phone focus vs broader desktop workspace | Current/next class prominence only with qualified data; reject manual task-management UI and timeline on all tabs |
| [Fantastical](https://flexibits.com/fantastical/help/calendar-views) | Upcoming events quickly, larger calendar for planning | Mini window, keyboard shortcut, full multi-view calendar; compact vs full workspace | Month movement visible and keyboard-accessible; reject natural-language event creation for official read-only NEIS data |
| [Things 3](https://culturedcode.com/things/) | Today vs Upcoming, selective emphasis | Quiet grouped list, separate date scopes; mobile single-column, larger screens use sidebar | Flat settings and event list, distinct selection; reject task completion for school events |
| [Notion Calendar](https://www.notion.com/en-gb/help/notion-calendar-apps) | Calendar first; workspace controls secondary | Desktop keyboard and multi-column workspace, mobile has fewer capabilities | Keep desktop calendar/detail split and compact mobile wheel; no account/workspace integration |
| [Mobbin](https://mobbin.com/) | Real shipped screen and flow comparison | Search by flows and UI elements across mobile/web; public library description only | Use as pattern taxonomy for date-picker and settings flows; do not copy private screenshots or claim paid-library inspection |
| [Refero](https://refero.design/) | Searchable real product screens and UI patterns | Web/iOS filtering, UI elements and page flows; public description only | Compare dashboard hierarchy by task; no visual cloning or unsupported claims of individual screens inspected |
| [Apple HIG buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | Legible controls with meaningful actions | Consistent button states, recommended 44pt targets; pointer and touch differ | 44 CSS px product target, SVG and accessible names; no platform chrome imitation |
| [Material 3](https://m3.material.io/), [Android touch targets](https://support.google.com/accessibility/android/answer/7101858?hl=en) | Selection/state and input clarity | Icon smaller than touch hit region, 48dp recommendation; adaptive layout | Separate symbol size from target size; 44px existing web contract, no claim of native 48dp compliance or wholesale Material theme |
| [Atlassian tokens](https://atlassian.design/foundations/tokens/), [elevation](https://atlassian.design/foundations/elevation/) | Shared semantics and purposeful layer depth | Surface roles, tokenized states; shared semantics across layouts | Fix unresolved tokens, reserve floating shadow for actual raised UI; no enterprise dashboard chrome |
| [Carbon tile](https://carbondesignsystem.com/components/tile/usage/) | Informational vs actionable tiles | Different interaction and selection semantics, responsive grid | Passive 24px surfaces vs 14px actionable school tiles, no hover-lift; avoid unnecessary nesting |
| [Refactoring UI Skill](https://github.com/edisonmbli/refactoring-ui-skill) | Hierarchy, spacing, contrast before decoration | Content-first diagnostic, not a platform-specific interaction library | 4/8/12/16/24/32 spacing, contrast and role-based styling; no runtime plugin, templates or decorative gimmicks |

## Implementation

- Existing action SVG supplier extended with close, help, sun and moon. Native month buttons use SVG and accessible names; existing Rust-owned text nodes retained for reactive theme updates. No change to event handlers.
- Shared 44px targets, 14px action radius, 24px surface radius, shared press/focus and floating shadow. School cards had undefined `--flow-ref-*` variables: replace with defined `--flow-space-*`, `--flow-surface-border`, and muted colors. Verify computed padding/gap and border, not just source.
- Guide keyboard close/focus restore and SVG close/help; date picker, meal arrows, bus controls, flat settings. Dark dock uses actual Flow selection classes rather than Rust active class (bus is supplemental).
- 591–870px: wheel only runs at <=590px; native month arrows were hidden at <=870px. Restore arrows on tablets. Keep mobile wheel and desktop calendar layout unchanged.
- Current class is explicitly estimated when only reference bell times available. Only existing timetable periods are considered; elementary/unknown profiles do not inherit high-school hours. No new school or bus data fabricated.
- Recompute core CSS SHA384 from staged Git blob; cache-bust changed static assets.

## QA (candidate)

- `node scripts/qa-flow-action-icons.mjs`: 6/6 groups; `node scripts/qa-flow-design-system.mjs`: 10/10 groups.
- `node scripts/qa-flow-browser.mjs`: final candidate 16/16, exit 0. 320/360/390/590/768/871/1366/1920 x light/dark. 32 checks per case, 33 on 768. Zero JS page exceptions, zero static asset HTTP errors. Uses real origin/NEIS with only changed candidate static assets intercepted; main stylesheet SRI checked.
- Earlier candidate runs: 10/16 (desktop native glyph arrows); 14/16 (768px light/dark, missing month navigation). Both product defects corrected, final full matrix rerun. Dark bus selected label checked as dark foreground; school card spacing measured.
- Harness covers tabs, picker expanded/collapsed, date and meal selection, keyboard month movement, settings theme toggling and reactive icons, guide focus trap/Escape/focus restoration, visible glyph scan, and no horizontal overflow. Screenshots 390/1366 each theme, all scenes and guide. Evidence on Windows under `flow-v3-design-20261126/vector-qa/pass4/candidate/` (not bundled into production).
- On this machine set `FLOW_PLAYWRIGHT` to installed Playwright index.mjs, `FLOW_CHROME` to installed Chrome executable and `FLOW_QA_DIR` to evidence folder. With a locally installed Playwright browser the defaults can be used. `--live` disables interception for production recheck.

## Remaining work / do not overstate

Actual finger swipes and animation frame timing on physical phones, screen-reader speech, multiple schools and onboarding/search, school phone missing-field UX, frequent-stop favorites and live GPS/BIS arrival scenarios, time-of-day simulations, and deeper product-reference hands-on research remain unverified or unimplemented. Do not label these complete. No wholesale redesign of the already-shipped date ribbon and wheel; no changes to the separate campus map. Production release/QA recorded separately after successful deployment.

## Production sign-off (2026-11-26 23:00 KST)

- Deployed UI pin: `4738405dee674c4b4ad6638a4cc3ad6fefa356d1`, pushed to `flow-vector-controls-20261126`. Legacy pin remains `b1ac095b47baa0c09430559bf127e7c873fa9263`.
- Cloudflare Worker `blank-app`: version `93dab987-c7e6-4313-9e2a-3c1bb923c490`, deployment `7c88c9d2-cff8-4719-9684-d862ece4614d`, 100%, timestamp `2026-11-26T14:00:36.521552Z`. Previous version `70bd481c-6fea-436f-9fb0-ee154b289614` is the rollback point. Only `V2_RELEASE` changed in worker module, other settings retained.
- Public GET `https://blank-app.agfvrd.workers.dev/` and eleven changed CSS/JS assets: **12/12 HTTP 200**, each `x-flow-ui-release: 4738405dee67`, byte-for-byte equal to pinned Git blobs. HTML SHA256 `529739c11a71cfc0d1e62b48548bc8c09bd1a4d7279d5dd01549fdcc3dc43af8`; core CSS SHA256 `f30832c626c425c89f38c92159796a8b9b0f233da93bee36d3b428fe87e8c9c5`.
- `node scripts/qa-flow-browser.mjs --live`: **16/16**, exit 0, 31 checks per case (32 at 768px), zero page exceptions and zero static asset HTTP errors. No request interception. Evidence at `vector-qa/pass4/live/result.json` and corresponding screenshots on the local machine.
- This sign-off is a documentation-only follow-up commit; the deployed code SHA remains `4738405...` rather than the subsequent documentation branch tip. Do not repin production simply to include this note.
