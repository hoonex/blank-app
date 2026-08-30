# Flow Spatial Motion v1 — 2026-08-31

## Intent
Move Flow away from static card-and-button interactions toward a more app-like spatial interaction model without changing School/University data contracts.

## Product behavior
- Motion defaults on unless the user explicitly disables `flow-motion-v1`.
- Interactive controls use magnetic attraction toward the current pointer/finger position and exponentially decay back to rest after release.
- The shared bottom navigation owns a material field that follows direct drag input and settles back onto the active destination.
- The settings experience exposes a direct-manipulation Spatial Motion playground plus explicit Motion, Ambient, and Haptics controls.
- Ambient light is more visible and can react to time, scroll velocity, and supported device-orientation input.
- Haptics now report unsupported browser environments instead of presenting a misleading enabled state.
- `prefers-reduced-motion: reduce` suppresses magnetic/navigation/content motion while preserving functionality.

## Motion language
Primary release curve: `cubic-bezier(.16,1,.3,1)`.

The interaction engine also uses requestAnimationFrame interpolation (`34%` of remaining distance each frame) for magnetic return. This intentionally produces the requested feel: large initial movement, then a long decelerating tail rather than linear movement or a hard stop.

## Validation
- Dedicated `Spatial motion audit` verifies magnetic displacement, decaying release, draggable navigation field, settings playground, preference toggling, haptic capability reporting, and reduced-motion behavior.
- Existing Full orientation, Browser UX, Liquid Glass, School/University, AdFit, and responsive audits remain required.
- Cloudflare post-merge health now requires production `flow-experience.js` and `flow-experience.css` bytes to match `main` exactly.
