# Flow Spatial Motion v1 — 2026-08-31

## Intent
Move Flow away from static card-and-button interactions toward a more app-like spatial interaction model without changing School/University data contracts. The interaction rule is **fast acquisition, slow visual settling**: direct controls react immediately, while decorative material and light may retain a longer tail.

## Product behavior
- Motion defaults on unless the user explicitly disables `flow-motion-v1`.
- Interactive controls use magnetic attraction toward the current pointer/finger position and exponentially decay back to rest after release.
- Directly interactive hit geometry must remain interruptible. Long-tail view settling must not translate or scale a parent that contains controls.
- The shared bottom navigation owns a pseudo-element material field that follows direct drag input and settles back onto the active destination. It is visual-only, uses `pointer-events:none`, and must not add a destination node to navigation DOM.
- The settings experience exposes a direct-manipulation Spatial Motion playground plus explicit Motion, Ambient, and Haptics controls.
- Ambient light is more visible and can react to time, scroll velocity, and supported device-orientation input.
- Haptics report unsupported browser environments instead of presenting a misleading enabled state.
- `prefers-reduced-motion: reduce` suppresses magnetic/navigation/content motion while preserving functionality.

## Motion language
Primary release curve: `cubic-bezier(.16,1,.3,1)`.

The interaction engine also uses requestAnimationFrame interpolation (`34%` of remaining distance each frame) for magnetic return. This intentionally produces the requested feel: large initial movement, then a long decelerating tail rather than linear movement or a hard stop.

Long-tail content settling is opacity-only. Spatial translation is reserved for direct magnetic controls and non-interactive material/light layers so an entering view never makes a button's hit box move while the user is trying to press it.

## Performance / interaction guardrail
The existing Browser UX latency threshold is the interruptibility gate. Rapid School view changes must remain below it; animation is never allowed to make the browser wait for a moving hit target. A regression discovered on mobile `Today → 주간` reached about 918 ms when `.today-grid` translated/scaled during entry. Removing geometry movement from content settling restored the Browser UX interaction/performance step without weakening the test.

## Validation
- Dedicated `Spatial motion audit` verifies magnetic displacement, decaying release, draggable navigation material, settings playground, preference toggling, haptic capability reporting, and reduced-motion behavior.
- Browser UX verifies interaction latency and interruptible native gestures.
- Existing Full orientation, Liquid Glass, School home/landscape/Transit/mixed-mode, University, AdFit, ULW, Admin, production-health, Cloudflare, and Vercel audits remain required.
- Cloudflare post-merge health requires production `flow-experience.js` and `flow-experience.css` bytes to match `main` exactly.
