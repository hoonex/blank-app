# Organic interface design

Use this reference when information hierarchy, available container space, or interaction state changes the representation of a user-facing surface. It is a reasoning aid, not a runtime framework or a preset aesthetic. Existing product rules and explicit user constraints remain authoritative.

## Decide what the user needs to do

Identify the current job: glance, read, compare, edit, monitor, or explore. Separate the user's required information/function from a proposed shape such as a panel. If simultaneous comparison, persistent visibility, or a particular surface is explicit, preserve it. Infer only what can safely be corrected later; ask about an uncertain, consequential, costly-to-reverse choice.

For a material change, form a small context read from the user job, page purpose, related product journey, existing visual system, data and exceptional states, available container width/height, content length, text scaling, input modality, current selection/focus/edit state, and available render/inspection tools. Mark consequential facts KNOWN, INFERRED, or UNKNOWN. No persistent form is required for a small task.

## Semantic compression before shrinking controls

Ask the question the surface should answer in one glance. Assign each information unit *for this job and state*, not as a permanent schema property:

| Role | Treatment |
| --- | --- |
| Decision-critical now | Visible and legible without disclosure. Includes exceptions that change action. |
| Useful with space | Adds context or supports comparison when space permits. |
| Needed on demand | Available through a clear, accessible detail path. |
| Duplicative or irrelevant | Remove if no purpose or product identity is lost. |

Examples of compression are removing repetition, shortening without ambiguity, grouping, prioritizing, changing representation, and disclosing detail. Do not make a warning, a changed location, a cancellation, a nonzero failure, or stale data look normal. Preserve values, units, negation, time, status, relationships, and access to the original detail. Distinguish empty data from a loading failure or unknown data. If the smallest space cannot contain decision-critical information legibly, reconsider the minimum size, height, scroll strategy, or dedicated detail path; do not solve it by making controls too small or hiding the exception.

For structured data prefer predictable presentation rules. Do not require an LLM call on every resize. A wider surface should reveal only relevant context, rather than manufacture content to fill space.

## Three kinds of adaptation

1. **Fluid geometry:** available space changes wrapping, alignment, layout, and spacing.
2. **Semantic representation:** the same information can have a detailed, summarized, grouped, or focused view. A discrete transition is fine when the meaning changes; do not force every state into pixel-continuous morphing.
3. **State continuity:** selection, expanded target, edit content, focus, and reading position remain understandable across representation changes.

Let the page decide the primary job and allocate space; let the component express its content in the *actual* allocated container. Choose representation transitions by where real content and controls cease to work, rather than device names alone. Evaluate the boundary on either side, longer labels/locales, zoom/text scaling, short height, and touch/keyboard where relevant. Avoid resize oscillation, replacing a focused control, or unexpected changes to a user's chosen detail/density. The same inputs should yield a predictable representation.

When the user must compare multiple things at once, do not optimize for the fewest visible elements. A dense table or editor can be appropriate. Available space, glanceability, and simultaneous visibility serve different jobs.

## Space and continuity decisions

When crowded, first inspect the task scope, duplicate labels, unnecessary cards/surfaces, grouping, hierarchy, existing regions that could absorb the function, contextual actions, and states that need not be visible simultaneously. Then choose a useful summary with an obvious detail path, or a different layout/scroll structure. An action hidden behind hover alone is not available on touch or keyboard.

Continuity concerns the *identity and relationship* of objects, not identical DOM nodes or mandatory animation. An expansion, temporary surface, or replacement should preserve target identity, input, selection, focus and a route back. Motion can explain causal or spatial relationships; omit it when stillness is clearer. Avoid delayed input and provide reduced-motion behavior with the same meaning. Interruption, reverse action, and viewport changes must not lose the user's work.

## Example: next class in a timetable

At 09:52, the next class starts at 10:00 in room 303 instead of room 204. On a dashboard, the class, start time, current room, and change are immediately relevant. Later classes may appear when space permits; full timetable and notes can be revealed through an obvious action. A narrow widget should not abbreviate the room change away. A wide widget need not fill blank space with decorative schedules. If data fails to load, display uncertainty instead of claiming there is no class. If expanded detail is open during resize, keep the selected class and a usable focus destination. A week-comparison editor has a different primary job and may need many classes simultaneously visible.
