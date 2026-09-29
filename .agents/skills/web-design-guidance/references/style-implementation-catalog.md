# Implementable visual-style reference catalog (22 directions)

This is a **research-backed implementation reference**, not a list of required presets and not a ready-made stylesheet. Entries record a concrete visual reference or a primary implementation reference, transferable visual grammar, a viable web implementation path, and a falsifiable acceptance check. Reference links were located for this task; their CSS and images are **not** automatically authorized for copying. Some are aesthetic examples, others are technical primary sources: distinguish these before reuse.

## Selection and reference protocol

1. Honor explicit user direction, repository design/brand/tokens, and shipped behavior before selecting a style; the catalog does not override them. Identify the primary *axis*: philosophy, aesthetic, surface/material, composition, or typography. Do not indiscriminately combine 22 styles.
2. For a substantial new visual direction, inspect 2–5 **task-relevant** references: at least one authentic visual specimen and one implementable source/component or platform reference where possible. Inspect layout, typography, surface, content density, state behavior and responsive behavior; save a bounded note identifying what NOT to copy. A reference link is a starting point, not proof that a particular target product will look right.
3. Translate the chosen style to the actual stack: existing CSS variables/theme, existing component states, existing breakpoint convention, real content, and asset/license budget. If the reference uses 3D/WebGL/complex imagery but there is no corresponding content or performance budget, choose a static authored asset or a different direction; CSS gradients are not an equivalent substitute for a photograph or illustration.
4. Implement a **vertical slice** first: one representative hero/module and one real interactive control with hover, active, focus-visible, disabled when applicable, dark/light if supported, narrow/mobile layout, and long/translated text. Verify pixels and interactions before propagating style through the app.
5. Keep effects in decorative or contextual layers, not across all content. Motion must preserve reduced-motion; busy materials need solid readable foregrounds. Underlying HTML semantics, reading/tab order, loading/error/empty states and existing business behavior must remain valid. Check WCAG 2.2 text contrast 4.5:1 for normal text and 3:1 for large text where applicable, plus appropriate non-text contrast and existing stricter rules.
6. Stop and report as partially verified if no browser/rendering path exists: a catalog entry, CSS draft or green unit test does not prove the finished style is visually successful.

## 22 distinct directions

### 01. Claymorphism

- **Axis:** material / playful.
- **Reference:** [Inspect design or implementation](https://www.smashingmagazine.com/2022/03/claymorphism-css-ui-design-trend/).
- **Visual grammar:** A soft, convex *object* with an outer drop shadow and two inset highlights/shades; rounded silhouette, coherent light direction.
- **Implement:** Tokenize fill, radius (start ~28–48px), one tinted outer and two inset `box-shadow` layers. Apply to a few hero objects/buttons, not every input.
- **Acceptance:** Compare convex vs pressed state; body copy stays crisp, 320px layout fits.

### 02. Cybercore

- **Axis:** aesthetic / retro-digital.
- **Reference:** [Inspect design or implementation](https://trends.daisyui.com/trend/cybercore/).
- **Visual grammar:** Early-digital nostalgia: icy cobalt, chrome, compact window-like panels and *curated* hardware/digital artifacts. Not interchangeable with dark dystopian cyberpunk.
- **Implement:** Build static SVG/optimized WebP art plus CSS pixel-aligned window frames, selective chrome gradients and mono metadata. Reserve noisy overlay for decorative hero only.
- **Acceptance:** Controls remain readable without artifacts; licensed/original imagery only.

### 03. Neo-brutalism

- **Axis:** visual attitude / material.
- **Reference:** [Inspect design or implementation](https://neobrutalism.com/docs).
- **Visual grammar:** Flat saturated fills, thick near-black outlines, zero-blur hard offset shadow and intentionally conspicuous controls.
- **Implement:** Shared CSS tokens for 2–4px border, 4–6px hard shadow, compact radius; `:active` translates into the shadow; preserve `:focus-visible` outline.
- **Acceptance:** No soft shadow/gradient substitution; pressed/focus and small-screen states work.

### 04. Scrapbook

- **Axis:** aesthetic / collage.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Scrapbook.html).
- **Visual grammar:** Hand-assembled hierarchy: layered photo/paper cutouts, tape, slight rotations and handwritten *annotation* (not body text).
- **Implement:** Layer positioned decorative SVG/PNG only inside a bounded hero; use CSS `clip-path`/pseudo-elements for torn edge and tape; normal-flow DOM for articles and buttons.
- **Acceptance:** At 320px and 200% zoom no overlap with text/controls; assets have source and rights.

### 05. Surrealism

- **Reference:** [Inspect Lynn Fisher's layered-SVG site case study](https://lynnandtonic.com/thoughts/entries/case-study-2021-refresh/).
- **Axis:** art direction, spatial storytelling, and imagery. A museum article defining the art movement is **not** evidence of how to implement a web surface.
- **Inspected implementation reference:** [Lynn Fisher's 2021 site case study](https://lynnandtonic.com/thoughts/entries/case-study-2021-refresh/) documents scenes constructed from stacked inline SVG artworks with cutouts, ordered visibility/scale changes and resize-responsive transitions. It also documents browser performance problems from heavy CSS-only resizing and blur, mobile affordance limits, and multi-viewport testing. This is a *vector-illustration art direction*, not evidence that photographic surrealism can be produced from primitive SVG shapes.
- **Inspected product reference:** [Hello Monday's MoMA Magritte exhibition case study](https://hellomonday.com/work/moma-magritte) describes a layered narrative with sound, motion and transitions informed by the artist. This is a product/art-direction precedent, **not** a claim that its original assets, source code, or exact composition are reusable.
- **Visual grammar:** One intelligible impossible relationship (e.g. a room inside an object) backed by consistent silhouette, lighting/perspective, overlap and occlusion; a readable independent control/navigation plane. State a chosen aesthetic: vector collage, photographic composite, or modeled 3D. They are not interchangeable.
- **Asset feasibility gate:** Before coding, inventory each hero object/scene, its required silhouette, material, shadow/occlusion, background, and animation layers. Assign each a real source or production path: original authored SVG for stylized vector; licensed/owned image composites for photographic realism; available modeling/rendering tool for 3D. Record source and license. If essential material cannot be made with available tools, either explicitly scope the deliverable to stylized vector or report the photorealistic design as blocked. Never call CSS primitives or generic gradients an equivalent substitute for photographic/3D realism.
- **Implement:** Draft one complete reference-matched hero scene *before* the remaining page: real artwork layers inside a stable aspect-ratio stage, masks/clipping/occlusion, consistent perspective and composited shadows where applicable. Use source assets rather than tracing/copying reference art. Design a usable small-screen interaction alternative; don't rely on desktop browser resizing as the only navigation mechanism. Avoid fullscreen filter/blur animation; provide a static poster and reduced-motion behavior.
- **Acceptance:** Compare the rendered hero side by side with **the selected technique and art-direction criteria**, not merely the theme label: subject silhouette, material fidelity at intended style, light/perspective consistency, negative space, typography placement, occlusion, and focal point. Check at 320/390/768/1440px, keyboard/touch, disabled/empty/error states when present, performance and reduced motion. Record which criteria were visually checked; a functioning responsive page is not proof that the style or asset fidelity succeeded.

### 06. Y2K aesthetic

- **Axis:** aesthetic / 1997–2004 retro-futurism.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Y2K_Futurism.html).
- **Visual grammar:** Optimistic chrome, translucent plastic, glossy highlights and curved/techno typography rather than generic neon sci-fi.
- **Implement:** Design a finite 3–5-stop metallic gradient token and specular edge; render hero motifs as authored SVG/WebP; keep functional UI on opaque surface.
- **Acceptance:** Highlight is controlled; text/background contrast and mobile rendering pass.

### 07. Pixel art

- **Axis:** illustration / raster discipline.
- **Reference:** [Inspect design or implementation](https://developer.mozilla.org/en-US/docs/Games/Techniques/Crisp_pixel_art_look).
- **Visual grammar:** Deliberate low-resolution sprites with visible square pixels and restrained palette, not a blurry photo under `pixelated`.
- **Implement:** Author true small raster sprite/sprite sheet, scale by integer factors where possible and set `image-rendering: pixelated`; keep body and controls normal-resolution.
- **Acceptance:** Sprites remain crisp at target zoom/DPR; alt text and non-pixel text remain readable.

### 08. Synthwave

- **Axis:** aesthetic / 1980s retro-futurism.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/designs/Synthwave.html).
- **Visual grammar:** Horizon grid, deep violet sky, sunset gradient and pink/cyan highlights; distinct from Y2K's chrome and Cyberpunk's gritty signage.
- **Implement:** One perspective grid via `transform: perspective(...) rotateX(...)` in hero or SVG poster; background gradient + limited accents; no infinite animation required.
- **Acceptance:** Grid never crosses text; mobile uses simplified still art; reduced motion respected.

### 09. Glassmorphism

- **Axis:** material / contextual translucency.
- **Reference:** [Inspect design or implementation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter).
- **Visual grammar:** A small number of translucent surfaces reveal useful scene context through actual background blur.
- **Implement:** Opaque fallback first, then `@supports (backdrop-filter: blur(1px))` for isolated nav/sheet; translucent fill, hairline rim, restrained blur. Do not blur nested scrolling cards.
- **Acceptance:** Check variable backgrounds, contrast and low-end/mobile GPU; opaque fallback remains usable.

### 10. Neumorphism

- **Axis:** material / subtle extrusion.
- **Reference:** [Inspect design or implementation](https://neumorphism.io/).
- **Visual grammar:** A surface seemingly pressed out of *the same-color* canvas using opposing light/dark shadows; unlike clay's separate convex object.
- **Implement:** Tokenize base fill, symmetric paired soft shadows, inset pressed variant and an independent clear focus/selected indicator.
- **Acceptance:** Button borders/states remain identifiable without relying on low-contrast shadow alone.

### 11. Bento grid

- **Axis:** composition / modular hierarchy.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Bento_Grid.html).
- **Visual grammar:** Unequal tiles encode genuinely unequal module importance, with a consistent gutter; not a synonym for many rounded cards.
- **Implement:** Use CSS Grid with explicit `grid-column: span 2` for important modules, `minmax(0,1fr)` and content-derived reflow to two/one columns.
- **Acceptance:** DOM/tab order remains logical after reflow; content fits without fixed heights.

### 12. Editorial design

- **Axis:** composition / narrative typography.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/designs/Editorial_Magazine_Layout.html).
- **Visual grammar:** Magazine-like scale contrast, rhythm, captions, image cropping, multi-column reading and clear typographic roles.
- **Implement:** Establish fluid display/body sizes, article `max-inline-size` in characters, two-column headline/media hero and caption pattern; keep long reading in a single measure.
- **Acceptance:** Reading order, heading outline, mobile line lengths and zoom remain correct.

### 13. Swiss design

- **Axis:** philosophy / systematic graphic grid.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/designs/International_Typographic_Style.html).
- **Visual grammar:** Rational asymmetry, strong sans typography, measurable baseline/column rhythm, minimal ornament. Not simply all-black minimalism.
- **Implement:** Define 8/12-column grid, explicit alignment and a strict type scale; establish display/caption roles and asymmetric but structured placement.
- **Acceptance:** No arbitrary offsets; reading order and responsive grid survive translation.

### 14. Minimalism

- **Axis:** philosophy / reduction.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/designs/Neo_Minimalism.html).
- **Visual grammar:** Emphasis through removal, proportion and whitespace rather than empty screens with giant text.
- **Implement:** Reduce controls and decorative elements first, set one hierarchy/one accent, constrain measure, reveal secondary actions contextually without hiding essentials.
- **Acceptance:** Every remaining item has a job; actions and empty/error/focus states stay discoverable.

### 15. Maximalism

- **Axis:** philosophy / expressive density.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/designs/Digital_Collage.html).
- **Visual grammar:** Abundance coordinated by a focal hierarchy, distinct type scales, layers and bounded motif repetition.
- **Implement:** Budget 1 dominant region and 2 supporting patterns; use design tokens for 3–4 accent roles; isolate texture/art layers from the reading/control plane.
- **Acceptance:** Can identify primary CTA/heading in one scan; small screens simplify layers rather than shrinking everything.

### 16. Luxury typography

- **Axis:** typography / refined identity.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Quiet_Luxury.html).
- **Visual grammar:** Display typography carries identity with exact kerning, contrast and proportion; restrained palette and calibrated whitespace.
- **Implement:** Use a licensed display serif/variable family only for large headings, optical-size/features where available, measured `clamp()` and neutral readable body; preload/subset where licensing allows.
- **Acceptance:** Korean/Latin fallback and glyph coverage verified; no tiny thin body type or faux luxury tracking.

### 17. Conceptual sketch

- **Axis:** illustration / process language.
- **Reference:** [Inspect design or implementation](https://roughjs.com/).
- **Visual grammar:** Deliberately provisional linework, callouts, arrows and measured annotations imply ideation or process, not a sloppy finished layout.
- **Implement:** Draw static SVG strokes and dashed rulers first; add Rough.js only when reproducible hand-drawn geometry is truly needed; seed/render once, not every frame.
- **Acceptance:** Text, controls and technical dimensions remain precise; decorative strokes are aria-hidden.

### 18. Ethereal

- **Axis:** atmosphere / soft light.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Ethereal.html).
- **Visual grammar:** Airy tonal transitions, softly lit imagery, restrained glow and generous space with legible foreground text.
- **Implement:** Layer 2–3 stationary radial gradients behind content, selectively diffuse hero art (not text), use solid foreground panels/ink text.
- **Acceptance:** Text contrast remains valid over every gradient stop; no blanket blur on UI.

### 19. Bohemian

- **Axis:** aesthetic / crafted eclecticism.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Global_Village_Coffeehouse.html).
- **Visual grammar:** Warm earth pigments, textile/craft rhythm and layered handwork, distinct from Scrapbook's literal paper collage.
- **Implement:** Choose an authentic original/appropriately licensed craft motif, reusable warm color tokens and border/background pattern limited to framing. Use simple humanist body text.
- **Acceptance:** Avoid treating distinct cultures as interchangeable decor; use provenance and keep pattern away from body copy.

### 20. Victorian

- **Axis:** historical / ornamental typography.
- **Reference:** [Inspect design or implementation](https://chrislemke.github.io/website_designs/examples/Victorian.html).
- **Visual grammar:** Formal axis, ornate framed title blocks, engraved ornaments and dense serif hierarchy rather than generic gold-on-black.
- **Implement:** Prepare reusable SVG corner/filigree assets and formal display serif; place ornamental borders only on hero/section breaks, with normal controls below.
- **Acceptance:** Decorations hide/reduce on mobile; text is real HTML and art assets are original/licensed.

### 21. Cyberpunk

- **Axis:** world-building / dystopian technology.
- **Reference:** [Inspect an actual Cyberpunk CSS component demo](https://alddesign.github.io/cyberpunk-css/demo/).
- **Visual grammar:** Nocturnal urban infrastructure, industrial HUD/scarred surfaces and purposeful hazard/information color; unlike nostalgic Cybercore or sunset Synthwave.
- **Implement:** Create layered signage/HUD using crisp SVG panels, grid/rule geometry and 1–2 status accents; put glitch in occasional nonessential artwork only.
- **Acceptance:** Critical state is labeled, not color-only; focus and status never flicker.

### 22. Wabi-sabi

- **Axis:** philosophy / material imperfection.
- **Reference:** [Inspect design or implementation](https://www.webfx.com/blog/web-design/wabi-sabi/).
- **Visual grammar:** Restrained asymmetry, quiet natural textures, material variation and meaningful imperfection, not random CSS jitter or merely beige.
- **Implement:** Use photographed/illustrated original material once, off-axis image placement within a stable grid, warm-neutral semantic tokens and unforced generous reading space.
- **Acceptance:** Organic surface does not impair precise alignment of interactive controls; imagery rights recorded.

## Viable CSS starting recipes (adapt values to product tokens, never paste as a universal theme)

```css
/* Clay (convex object) != neumorphism (same-color extrusion) != hard neo-brutalism. */
.clay-object {
  border-radius: 32px;
  background: #f4a4ae;
  box-shadow: 10px 12px 20px #b66a7959,
    inset -8px -8px 12px #a33b4d45,
    inset 7px 7px 12px #ffffff9c;
}
.neumorphic-button {
  background: var(--canvas, #e7e8eb);
  border: 2px solid transparent; /* add distinct contrast/focus/pressed treatment */
  box-shadow: 7px 7px 16px #b9bac1, -7px -7px 16px #ffffff;
}
.neumorphic-button[aria-pressed="true"] {
  box-shadow: inset 5px 5px 10px #b9bac1, inset -5px -5px 10px #ffffff;
}
.brutalist-button {
  background: #ffdf52; color: #171717; border: 3px solid #171717;
  box-shadow: 5px 5px 0 #171717; border-radius: 4px;
}
.brutalist-button:active { transform: translate(5px, 5px); box-shadow: none; }
.brutalist-button:focus-visible, .neumorphic-button:focus-visible {
  outline: 3px solid #0755b8; outline-offset: 4px;
}

/* Opaque readable fallback FIRST. Do not blur every card or moving backdrop. */
.glass-panel { background: #f3f5f8; color: #17202a; }
@supports (backdrop-filter: blur(10px)) {
  .glass-panel {
    background: rgb(243 245 248 / 88%);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgb(255 255 255 / 65%);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .glass-panel { background: #f3f5f8; backdrop-filter: none; -webkit-backdrop-filter: none; }
}
```

```css
/* DOM order is semantic order; visual tile spans are never a substitute. */
.bento { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
.bento > * { min-width: 0; }
.bento .feature { grid-column: span 2; }
@media (max-width: 800px) { .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 480px) { .bento { grid-template-columns: minmax(0, 1fr); }
  .bento .feature { grid-column: auto; }
}
.pixel-sprite { image-rendering: pixelated; }
@media (prefers-reduced-motion: reduce) {
  .decorative-motion { animation: none; transition: none; }
}
```

## Implementation evidence and licensing

- Platform/behavior sources: [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter), [MDN reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-transparency) (**limited support; opaque fallback required**), [MDN pixel scaling](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/image-rendering), [MDN CSS grid areas](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Grid_template_areas), [web.dev performant animation](https://web.dev/articles/animations-guide), [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- Record reference URL + inspected feature + implementation decision; do not claim a library is maintained, compatible, licensed for a specific use, or a page is a live production example without checking its current state. For original/art-heavy styles, secure suitable asset licenses and preserve attribution where required. Do not hotlink third-party demo assets or copy logos, exact branded compositions, proprietary artwork, or reference product copy.
- A style is **implemented**, not merely named, only after it changes the actual target surface's layout/type/material/asset/component grammar, includes applicable interaction and responsive variants, and has rendered evidence at the target source revision. A CSS-token-only recolor is not evidence that Surrealism, Scrapbook, Victorian or Cyberpunk is realized.
