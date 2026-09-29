# Visual observation and revision

Use for a material user-facing UI change when the environment can render it, or when the visual evidence claim needs an exact boundary. Existing Sloar evidence and bounded-terminalization rules still apply. This reference describes agent behavior, not a mandatory browser provider or aesthetic score.

## Resolve capability at the point of use

Do not collapse these capabilities:

| Capability | What it can establish |
| --- | --- |
| Run the interface | A route/state is reachable in the observed runtime. |
| Capture output | An image or frame exists; its appearance is not yet accepted. |
| Deliver pixels to this model | The agent can inspect the actual rendered output. |
| Observe pixels | Hierarchy, grouping, legibility and product fit can be critiqued at the captured state. |
| Act on the UI | Focus, tap/click, keyboard, dismissal and transitions can be checked. |
| Re-observe after revision | The specific visible defect can be marked resolved or still present. |

DOM, accessibility tree, and geometry can establish semantics, structure or bounds; they do not prove visual balance. A static screenshot does not prove interaction or performance. A browser simulation does not prove real-device touch. Prefer available repository/provider tooling and inspect its output through the actual vision path. Do not add a generic browser abstraction for one environment. If image delivery or runtime access fails, use source/DOM evidence for the claims it can support and mark the visual claim UNVERIFIED; do not invent an inspection or wait indefinitely.

## Feedback loop within OBSERVE / MODEL / ACT / PROVE / RECONCILE

Before implementing, define the user's question, the primary visual/interaction intent, preservation constraints, and the riskiest state/content/space boundaries. Inspect an existing product screen where relevant. After implementation, render the changed surface with representative data and observe its pixels, then interact with the important path. Compare against the intended job and existing system, not an unrelated aesthetic preference.

Critique at the smallest useful scope:

- **Component:** size, hierarchy, text resilience, alignment, affordances and relevant states.
- **Page:** proportion, first visual emphasis, repeated hierarchy, density, balance and next action.
- **Product:** adjacent flows, shared primitives, navigation and interaction language. Inspect only the relevant neighboring screens for a scoped change.

Describe observed pixels before defending the design intent. A useful finding has `observation -> task impact -> evidence -> correction hypothesis -> affected recheck`. A statement about likely first gaze is an inference, not an eye-tracking result. Fix the strongest material issues; if the root cause is information architecture or product purpose, return to MODEL instead of stacking CSS.

Re-render the affected state and boundary after a coherent correction. If the first result meets the defined job, stop. One corrective pass is a useful default, not a ceiling when new observations show distinct material defects. Do not repeat an unchanged failed check or endlessly redesign for subjective polish. End with pass, a specific unresolved failure, or a precise unverified scope according to Sloar's terminalization rules.

## Acceptance is evidence-scoped

Keep distinct claims for FUNCTIONAL, VISUAL, CONTEXT, INTERACTION, and ORGANIC ADAPTATION. One run may support several claims, but no success in one cancels a failure in another. Accessibility and structural ownership apply across them. Record enough identity to tie the evidence to source/working state, build or runtime, route/surface, data/state, container/viewport, and relevant input modality. Recheck evidence affected by a later UI change. Use PASS, FAIL, UNVERIFIED, or NOT APPLICABLE (or existing equivalent), rather than a universal aesthetic score.

Scale the observation to the risk: a copy/spacing change may need one affected render; a component needs its page context and risky states/widths; a new page or shared primitive needs related product screens and transition boundaries. A backend-only change does not activate this design loop. Do not run every viewport or reference for every change. See [visual-verification.md](visual-verification.md) for rendered checks and Sloar's [rendered UI evidence contract](../../sloar-chat-coder/references/rendered-ui-evidence.md) for identity and independent automation/visual gates.
