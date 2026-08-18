# Mobile hotfix scope

Based on Android real-device screenshots from 2026-08-19.

Only narrow fixes are included:
- guard timetable/calendar MutationObserver subtree loops
- remove expensive mobile fixed-element backdrop blur
- remove per-cell week timetable shadows on mobile
- add extra bottom safe area so fixed navigation does not cover content
- collapse repeated holiday timetable rows (for example 대체공휴일) into a single day state

No product redesign, schema change, or new monetization work is included.
