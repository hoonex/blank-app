# School IA + Optical Glass implementation direction

Date: 2026-08-24
Base: `main@86c2028538168e196d4b92b4a3cc1050b4e7a21d`

## Constraints

- Cloudflare is the intended production direction. Vercel is backup/reference only and must not gate production decisions.
- Do not modify `main` directly.
- No duplicate renderer, unnecessary `MutationObserver`, polling layer, automatic page `scrollTo()`, or duplicate dashboard fetch.
- Preserve all existing School/University features; reorganize rather than delete.
- No ads in this change. Keep the content flow compatible with a future non-disruptive slot.
- UI changes require the full 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080 matrix and explicit Light-on-dark-OS coverage.

## Current-state findings

### Settings

PR #93 is already merged. Settings is a real fifth destination and the legacy dialog is kept closed. PR #94 subsequently hardened Settings visual QA. The current main includes those changes.

### Production

The repository documentation is stale relative to the latest product decision: README still documents a Supabase Edge Function as production and the repository homepage still points at Vercel. No checked-in Cloudflare Pages/Workers configuration or canonical Cloudflare production hostname is present on main. Therefore this branch must not perform or assume a Cloudflare production deploy until the actual Cloudflare project/hostname/deploy path is verifiable.

### Existing Optical Glass limitation

`flow-native.js` currently generates a rounded-rectangle edge map and applies it through `backdrop-filter: url(#...)` with `feDisplacementMap`. Runtime support is treated as true when computed style retains a `url(...)` filter.

That capability probe is insufficient: it proves syntax retention, not visible refraction. The current map also derives displacement mostly from an SDF edge weight multiplied by an outward normal. It does not model a surface height profile and ray bending, so displacement can be visually weak or read as a soft rim rather than curved glass. When the compositor does not expose the actual live backdrop to the SVG filter, the lens can retain the URL and still fail to visibly bend text/lines behind it.

## Reference architecture comparison

### ybouane/liquidglass

- Rasterizes non-glass DOM into a canvas using `html-to-image`/SVG `foreignObject` and draws images/canvas/video directly.
- WebGL fragment shader performs refraction, blur, chromatic aberration, Fresnel, specular rim and shadow.
- Strong visual fidelity, but DOM raster capture and dynamic invalidation are expensive.
- The library uses dirty tracking and a `MutationObserver`; that conflicts with Flow's preference to avoid a new capture/observer runtime unless absolutely necessary.

### Aave Labs — Building Glass for the Web

- Treats the displacement map as the portable core.
- Uses SVG `feDisplacementMap` on live/refracted content; map generation is shape based and reused while the lens moves.
- Uses separate chromatic/specular passes.
- For media that SVG cannot bend, uses the same map in WebGL.
- Key lesson for Flow: moving a lens should move/filter a small region; map regeneration should happen on shape change, not every pointer frame.

### Chromium backdrop-filter implementations

- `backdrop-filter: url(#filter)` can bend actual backdrop pixels in Chromium when the compositor path supports it.
- `color-interpolation-filters="sRGB"` is required for a neutral 128 displacement map to remain neutral.
- Syntax/computed-style acceptance alone is not a fidelity test.

### Outpace Studios

- Models a convex squircle dome with a flat center and curved rim.
- Uses the surface slope, Snell's law (n≈1.5), then a height field and its gradient to create a curl-free displacement map.
- Keeps center displacement near zero and concentrates bending in the bevel/rim.
- Cross-browser approach refracts a counter-positioned visual copy instead of relying on backdrop SVG support.
- Useful fallback architecture, but duplicating a full interactive Flow view is undesirable. If Flow needs a copy path, it should be a tightly scoped visual-only copy behind a small lens, never a second application renderer.

## Chosen implementation direction

1. Keep Standard glass unchanged as the default stability path.
2. Replace the current edge-weight map math with a physically motivated rounded-rect/squircle surface profile:
   - flat/near-flat center;
   - configurable rim width;
   - SDF-derived normal;
   - slope -> incident angle -> Snell-law transmitted angle;
   - integrate into a monotonic height field or equivalent smooth bend profile;
   - derive displacement along the field gradient so corners do not crease/fold.
3. Keep a single generated map per lens geometry and regenerate only on resize/shape changes.
4. Add optional RGB split as three displacement passes with small scale offsets; keep Fresnel/specular rim separate from the displacement itself.
5. Keep Chromium live-backdrop path only if a pixel-level visual probe confirms edge displacement. If the probe fails, report Optical as fallback rather than active.
6. Do not adopt ybouane-style full DOM raster capture on this branch unless the live-backdrop path fails the visual probe and a tightly scoped copy cannot satisfy the requirement.
7. If a cross-browser copy path is later needed, use one shared visual source/copy strategy and pointer-events:none; do not create a second app renderer or duplicate network/data flow.

## Visual acceptance test

Computed style is not sufficient. Add a browser test fixture with high-contrast vertical/horizontal grid lines and text crossing the lens rim. Capture:

- Standard mode baseline.
- Optical mode with lens centered over the same pattern.
- A pixel/SSIM-like edge-region comparison restricted to the bevel band.

Acceptance criteria:

- Center region remains approximately aligned with baseline.
- Bevel/rim region shows measurable spatial displacement, not only blur/brightness/color change.
- At least one text stroke or grid line visibly bends at each tested side of the lens.
- Android-Chrome-like 390×844 is included.
- Explicit Light preference under forced dark OS remains visually light.

## School information architecture target

The first School screen should answer three questions immediately: what class is next/today, what is lunch, and what is coming up.

- Replace Today vs Week as peer destinations with one `시간표` destination containing an immediate `오늘 / 주간` mode switch in the timetable header.
- Keep the existing day strip, subject editing, week table, date controls and persistence; move them under the same timetable destination instead of deleting them.
- Promote timetable, meal and upcoming schedule into the first readable fold.
- De-emphasize the large school-profile hero and four redundant status cards when they duplicate content already visible below.
- Keep school profile/basic information available as a secondary School destination, not as a first-screen learning requirement.
- Keep Settings as the fifth real destination. On mobile it remains an independent scroll surface.
- Place the Settings affordance consistently in navigation rather than adding another header card/button.
- Reserve a future insertion point between primary utility content groups where an ad could be inserted without splitting a timetable row, meal list or navigation flow; do not render an ad now.

## Theme source-of-truth target

- Persist only one preference value per mode: `light | system | dark`.
- Derive an effective theme from that preference.
- `prefers-color-scheme` may only participate when preference == `system`.
- In explicit `light`, set `data-theme=light`, `data-theme-mode=light`, `color-scheme: only light`, matching `<meta name="color-scheme">`, and ensure CSS contains no media-query override that wins over explicit data-theme selectors.
- Add a regression test that emulates a dark OS, selects Light, reloads, and checks computed background/text tokens plus screenshot output.
