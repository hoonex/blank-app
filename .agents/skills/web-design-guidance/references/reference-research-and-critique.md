# Reference research and design critique

Use this reference when a consequential visual direction is not already determined by explicit user direction or a coherent repository-owned design system.

The core assumption is deliberately skeptical:

```text
the agent's first design idea is a hypothesis, not an authority
plausible-looking output is not evidence of strong design
```

Strong coding models are optimized to produce plausible completions. In visual work, plausibility often converges toward common patterns. When the design decision is high-impact and the local evidence is weak, reduce uncertainty by inspecting real references before committing.

## When reference research is warranted

Research is useful when one or more of these are true:

- the task creates a new product surface, brand language, navigation shell, dashboard system, marketing direction, or other expensive-to-reverse visual foundation;
- the repository has little or contradictory design evidence;
- the user delegates taste with `you decide`, `알아서`, or equivalent and product context alone does not clearly select a direction;
- two or more materially different design representations seem equally plausible;
- the first rendered result looks generic, template-like, over-designed, or suspiciously similar to the agent's usual defaults;
- identity/logo/icon work is requested and no authoritative brand system exists;
- a dark/light/responsive variant exposes that the assumed system is not actually coherent.

Do not browse merely to decorate a trivial component or imitate trends. Small reversible changes inside a strong existing system should normally stay inside that system.

## Reference hierarchy

Prefer sources that reveal real constraints and durable systems:

1. user-supplied screenshots/sites/reference products;
2. the target product's existing shipped screens and repository assets;
3. official design systems, brand guidelines, component documentation, or mature products with a comparable interaction model;
4. high-quality open-source products or specialized design-agent references with concrete reasoning and examples;
5. design galleries/social inspiration only as weak exploratory input.

A popular screenshot is not automatically a good reference. Prefer sources where you can explain what problem the design is solving.

## Research budget

Keep the pass bounded. Usually 2-5 references are enough.

For each useful reference, extract only the dimensions that can change the decision:

```text
reference:
why relevant:
hierarchy:
density / spacing rhythm:
typography behavior:
material / color roles:
component grammar:
interaction / motion:
responsive behavior:
identity cue:
what NOT to copy:
```

Do not collect a moodboard of interchangeable screenshots with no conclusion. Stop when the references make the direction materially more specific or when additional sources stop changing the decision.

## Implementation-reference and asset-feasibility gate (mandatory for named visual styles)

A URL that defines an art movement, a gallery thumbnail, or a generic CSS technique **does not establish that a visual style can be implemented**. When a user asks for a named style with visual fidelity, do not advance from research to a full-page implementation until one representative scene or component is evidenced. This is a gate for consequential style fidelity, not added ceremony for a minor change within an existing system.

1. **Inspect, do not merely locate.** Visit the actual visual specimen (page, representative screenshot or video), and inspect an implementation case study, source/demo, or component with enough detail to identify how the effect is produced. Distinguish first-hand observations from author statements or inferred implementation. If external viewing is unavailable, report the constraint; do not claim the source was inspected.
2. **Record a tiny reference-to-build matrix** in the task's working evidence, using these fields: reference and observed visual feature; asset dependency (photo, texture, illustration, SVG, 3D/model, font); feasible source/creation tool and license; target layout/component and interaction; failure mode; rendered acceptance observation. Don't pollute the target repository with a permanent document unless the design system or long-running work needs one.
3. **Choose the medium honestly.** A vector illustration, photorealistic composite, and 3D scene can share a concept but do not have interchangeable material fidelity. If required art/3D cannot be obtained or authored with the actual tools, do not silently replace it with CSS boxes, simplistic gradients or primitive shapes while claiming reference fidelity. Select an explicitly declared, feasible stylized interpretation or report the blocked portion and why. An optional image tool should be requested only after identifying a genuine asset gap.
4. **Build and render one vertical slice before broad implementation.** Produce a representative hero/scene or component with real target assets, not a generic placeholder, plus one genuine control state at narrow and desktop widths. Inspect the pixels against the observed reference's *transferable* hierarchy, spatial relationships, typography, material/asset quality and interaction. Rework a substantive mismatch once; if the reference-matched slice cannot be achieved, stop extending that direction and report the gap instead of applying polish to unrelated page elements.
5. **Keep independent evidence labels.** Code compilation and responsive/functional tests prove their own claims. They do not establish art-direction fidelity. Only inspected rendered evidence can support the latter, and a screenshot alone does not prove interactivity or performance. Do not call an uninspected link an implementable reference, or a completed CSS structure a faithful style implementation.

**Example: Surrealism.** [Lynn Fisher's illustrated site case study](https://lynnandtonic.com/thoughts/entries/case-study-2021-refresh/) explicitly discusses layered SVG artwork, cutout-based spatial travel, responsive scene transitions and performance challenges; it supports a stylized-vector implementation path. [Hello Monday's MoMA Magritte project](https://hellomonday.com/work/moma-magritte) documents surrealist motion/layering and narrative in a museum site; it offers art-direction and interaction precedent, not reusable production artwork or a ready-made source implementation. The design must choose which medium to pursue and create/license the corresponding assets.

## Extract rules, not trade dress

References are evidence, not templates.

Do not copy:

- another product's logo, trademark, unique iconography, illustrations, proprietary assets, or distinctive copy;
- a signature composition so literally that the result becomes a clone;
- arbitrary pixel values just because they appeared in the reference.

Instead extract transferable relationships:

- what is visually dominant and why;
- how many hierarchy levels are competing;
- how information density changes by task;
- whether surfaces are separated by spacing, contrast, border, elevation, or material;
- how typography distinguishes reading, command, data, and navigation roles;
- how color carries brand versus semantic state;
- what interaction feedback communicates state change;
- what disappears, compresses, or reprioritizes on smaller screens.

## Reference synthesis

After research, do not average every reference together. Choose a coherent product-specific direction.

A useful synthesis can be as small as:

```text
Keep from product/repo: <authoritative existing traits>
Borrow as principle: <2-4 relationships learned from references>
Reject: <generic/trendy moves that do not fit>
Signature product decision: <one choice tied to real content/workflow/state>
```

If the references disagree, the product's user job and repository authority decide. Do not create style soup.

## Epistemic humility gate

Before implementation or before calling a substantial visual result complete, challenge the agent's own design rather than defending it.

Ask:

1. **What am I assuming is good only because it looks familiar?**
2. **Which visible element exists because the composition felt empty rather than because the product needs it?**
3. **Which choice is an inherited framework/model default rather than an intentional system decision?**
4. **Could this exact layout/identity be moved to an unrelated product with only the name and accent color changed?**
5. **Did I create a local token/component/style because it was convenient instead of because the system needed it?**
6. **Is the design merely polished, or does it reveal the product's actual priority and workflow?**
7. **What would a strong designer remove, simplify, or make more specific?**

The purpose is not self-criticism theater. Change the result only when the critique identifies a material weakness.

## Render -> critique -> one corrective pass

When rendered evidence is available:

1. inspect the actual pixels at relevant viewport/state/theme boundaries;
2. compare against the committed Design DNA/system and the extracted reference principles;
3. identify the strongest 1-3 problems, not a long cosmetic list;
4. make one coherent corrective pass;
5. re-render the affected boundaries.

Do not endlessly redesign. If the result is coherent, product-specific, state-complete, and supported by evidence, stop.

## When browsing is unavailable

Use the strongest local evidence available: shipped screens, tokens, component examples, accepted screenshots, repository history, and product assets. Record that external reference research was unavailable if the task materially depended on it.

Never pretend the model's internal familiarity with a brand/product is equivalent to having inspected the relevant reference.
