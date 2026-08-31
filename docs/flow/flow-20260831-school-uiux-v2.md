# Flow School UI/UX v2 — 2026-08-31

## Why this exists

Spatial Motion v1 improved interaction physics but deliberately left the School information architecture mostly intact. That made the release feel almost unchanged when the actual product request was a visible UI/UX overhaul.

School UI/UX v2 therefore changes composition and hierarchy first. Motion remains progressive enhancement, not the redesign itself.

## Product hierarchy

### Today

The Today destination is one student workspace, not a stack of unrelated dashboard cards.

1. A compact school/date masthead establishes context.
2. `지금` and `다음 일정` share one balanced overview shelf.
3. The timetable is the dominant object.
4. Meal and upcoming schedule are secondary utility regions in the same workspace.
5. Week remains a timetable mode/control rather than a primary production destination.

Do not restore the old large-hero + multiple floating-card composition without an explicit product decision.

### Navigation

- Desktop uses a narrow app rail with restrained active-state emphasis.
- Mobile uses one shared bottom navigation material rather than independent floating controls.
- Production navigation remains `오늘 / 일정 / 학교 / 설정`; Transit remains dormant outside the localhost lab.

### Responsive behavior

- 390×844: compact masthead, balanced two-state shelf, timetable-first workspace, bottom app bar.
- 844×390: timetable takes the full workspace width; meal and upcoming schedule follow below as two equal utility panes.
- 768×1024: timetable-first single-column reading order.
- 1024×768: desktop rail remains, but the main Today workspace avoids a cramped right utility column; timetable is full width and meal/schedule follow below as two equal panes.
- 1366×768 and 1920×1080: timetable and the utility region can share the main workspace side-by-side.

A responsive layout must not make action labels such as `알레르기` or `전체 보기` wrap vertically merely to preserve a two-column composition.

## Visual language

- Prefer one cohesive surface with internal dividers over many rounded cards.
- Neumorphism is no longer the dominant visual metaphor; controls are restrained pills/system controls.
- The school hero is context, not the page's dominant content block.
- Timetable rows receive the strongest reading hierarchy.
- Avoid decorative motion that changes hit geometry or delays rapid navigation.
- Preserve reduced-motion behavior and the existing Optical/Spatial Motion contracts.

## Runtime and release contract

School UI/UX v2 loads after `school-surface-cleanup.js` through `school-metrics.js`.

Production assets:

- `school-uiux-v2.js`
- `school-uiux-v2.css`
- `school-uiux-v2-system.css`

These assets are part of the School service-worker shell and critical runtime set. The post-merge Cloudflare clean-route audit must require their deployed bytes to match `main` exactly.

## Preserved behavior

This redesign does not change:

- NEIS School data requests or response contracts
- timetable/meal/schedule/school-info data semantics
- user time/settings persistence
- production Transit retirement or localhost Transit lab behavior
- AdFit placement contracts
- Optical Glass / Spatial Motion behavior

## Validation gate

Before merge:

- School home cleanup audit across all six required viewports
- School landscape toolbar audit
- Browser UX audit
- Full orientation functional audit
- Liquid Glass / Spatial Motion compatibility through the existing suites
- direct visual inspection of the six viewport screenshots, including full-page short-landscape composition

CI GREEN alone is not sufficient for this redesign.