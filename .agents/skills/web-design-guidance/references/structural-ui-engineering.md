# Structural UI engineering

Use this reference for substantial UI/web implementation, redesign, repeated AI-assisted edits, or reviews where a surface can look correct while its internal structure is becoming harder to reason about, extend, test, or remove.

The core rule is:

> A rendered success is not structural success. Treat visual correctness, behavioral correctness, and architectural integrity as separate claims with separate evidence.

The goal is not maximal abstraction or textbook architecture. The goal is to keep each product decision owned in one understandable place, integrate new behavior into the existing system deliberately, and prevent local patches from accumulating into hidden coupling.

## 1. Map the implementation before extending it

Before a material feature or redesign, resolve the parts that actually own the behavior:

```text
route/page ownership
-> data acquisition/cache ownership
-> domain/application state ownership
-> component boundaries
-> styling/token ownership
-> interaction/async lifecycle ownership
-> persistence/navigation side effects
```

Do not assume the closest component is the correct owner merely because it is where the symptom is visible.

For each consequential decision, identify one authoritative owner when practical. Examples:

- selected account -> route/search params or application state, not three mirrored `useState`s;
- theme color -> semantic token, not repeated literal colors;
- server resource -> query/cache layer, not duplicate component fetches;
- modal lifecycle -> one interaction owner, not independent booleans in parent and child;
- breakpoint behavior -> shared layout/component contract, not unrelated per-screen media-query patches.

If ownership is intentionally split, make the synchronization boundary explicit and test it.

## 2. Feature integration gate

When adding behavior, prefer this order:

1. extend the existing authoritative owner;
2. extend an existing variant/composition boundary;
3. create a new owner only when the semantic responsibility is genuinely new;
4. add an adapter only when a real boundary requires translation;
5. use a local workaround only as a bounded temporary measure with a named removal condition.

Do not append a new layer merely because changing the current owner is harder.

A feature is suspect when it is implemented primarily as:

- another mirrored state variable;
- another effect that synchronizes already-derivable state;
- another selector/observer watching the same semantic decision;
- another CSS override that defeats an earlier rule;
- another wrapper component with no new semantic boundary;
- another request/cache path for the same resource;
- another boolean that creates impossible state combinations;
- another dependency for behavior the current stack already owns;
- another special case that bypasses the normal component or data lifecycle.

The correct response is not automatically refactoring. First determine whether the new behavior exposes a missing abstraction, the wrong owner, or a genuinely exceptional requirement.

## 3. One source of truth per semantic decision

Duplicate representation is allowed only when a boundary requires it and synchronization semantics are explicit.

Audit for:

```text
server data <-> copied component state
URL state <-> global state <-> local state
form library state <-> local input state
CSS token <-> one-off literal override
feature flag <-> duplicated condition tree
parent open state <-> child open state
cached derived value <-> source value
```

Ask:

- Which representation is authoritative?
- Why does the other representation exist?
- What event synchronizes them?
- What happens when updates race, fail, or arrive out of order?
- Can one representation be derived instead of stored?

If those questions do not have clear answers, the structure is not proven merely because the current screenshot looks correct.

## 4. Component boundary audit

A component boundary should normally correspond to a meaningful reuse, state, rendering, interaction, or ownership boundary.

Watch for both extremes.

### God components

Warning signs:

- unrelated data fetching, domain decisions, layout, keyboard handling, analytics, persistence, and presentation in one component;
- a large render function controlled by many independent booleans;
- a change in one sub-flow repeatedly breaks unrelated parts;
- tests require constructing most of the application to exercise one local behavior.

Split by semantic responsibility, not arbitrary line count.

### Fragmentation

Warning signs:

- tiny wrapper components that only forward props and styling;
- deeply nested components created solely to avoid editing an existing primitive;
- abstractions used once with no clear semantic contract;
- prop plumbing that exists only because ownership is located too high or too far away.

Do not chase small files as a quality metric. Prefer understandable responsibility and local reasoning.

## 5. State-machine sanity

For interactions with multiple phases, model valid states instead of accumulating booleans.

Bad hidden state space:

```text
isOpen
isLoading
isClosing
hasError
isSuccess
```

when combinations such as `isClosing && isSuccess && isLoading` are nonsensical.

Prefer an explicit lifecycle when phases matter:

```text
idle -> opening -> ready -> submitting -> success
                         \-> error
ready -> closing -> closed
```

This does not require a state-machine library. It requires the implementation to make valid and invalid transitions understandable.

Audit loading, empty, error, success, cancellation, stale data, retry, navigation-away, and interrupted interaction paths when they can occur.

## 6. Effect and side-effect discipline

Effects are escape hatches, not a general data-flow primitive.

For each material effect/subscription/observer/listener, ask:

- Is this synchronizing with an external system, or merely deriving local state?
- Who owns setup and cleanup?
- Can it run twice safely under framework development behavior?
- Can stale closures or reordered async completion write obsolete state?
- Can navigation/unmount leave work alive?
- Is the dependency list expressing the real contract or suppressing it?

Do not silence dependency/lifecycle warnings merely to keep a green build.

Network requests, timers, observers, global listeners, and animation loops need explicit terminal cleanup where the platform requires it.

## 7. CSS and design-system integrity

A visually correct screenshot can hide a collapsing stylesheet.

Audit new styling for:

- specificity escalation;
- repeated `!important` used as conflict resolution;
- copied magic values that duplicate existing tokens;
- nearly identical component variants created by copy/paste;
- local z-index escalation without a layer model;
- absolute positioning used to repair hierarchy/layout mistakes;
- viewport-specific overrides that contradict the shared responsive model;
- light/dark fixes implemented as unrelated local colors instead of semantic tokens;
- orphaned classes/rules left after a component path is replaced.

A new rule should integrate with the existing cascade/token/component ownership rather than merely win against it.

## 8. Change-locality and blast radius

A healthy design usually lets a local product decision change in a bounded set of owners.

When a small feature requires edits across many unrelated pages, repeated conditional checks, or parallel CSS/data/state changes, investigate whether:

- the abstraction is missing;
- the owner is misplaced;
- a product concept lacks a first-class representation;
- a shared primitive is too rigid;
- the feature is actually cross-cutting and deserves an explicit system-level change.

Do not force an abstraction solely to reduce file count. But treat unexplained broad blast radius as architectural evidence, not inconvenience to work around.

## 9. Remove superseded structure

AI-assisted iteration often leaves both the old and new implementation alive.

After a replacement or redesign, explicitly search for:

- dead components and exports;
- stale feature flags;
- unused tokens/classes;
- duplicate request paths;
- obsolete adapters;
- legacy event listeners;
- fallback branches whose entry condition no longer exists;
- comments describing behavior that was replaced;
- dependencies no longer required.

Do not keep an obsolete path "just in case" without a concrete compatibility or rollback reason. Parallel paths increase the number of states future changes must understand.

## 10. Dependency and abstraction budget

Every new dependency and abstraction creates permanent surface area.

Before adding one, ask:

```text
Does an existing repository primitive already solve this?
Is the requirement stable enough to deserve an abstraction?
Will at least two real call sites share the same semantic contract?
Does this dependency own difficult behavior we should not reimplement?
What is the removal/migration cost if the assumption changes?
```

A dependency is justified by owned complexity, reliability, compatibility, or leverage—not by reducing ten lines of ordinary code.

## 11. Structural proof matrix

Do not collapse all validation into `build passed`.

Use evidence appropriate to the claim:

| Claim | Useful evidence |
| --- | --- |
| looks correct | rendered screenshots / visual comparison |
| interaction works | browser/device interaction evidence / behavioral tests |
| types/contracts fit | typecheck / compile |
| syntax/style rules fit | lint/static analysis |
| domain behavior holds | unit/integration tests |
| accessibility semantics hold | semantic inspection + automated/manual a11y checks |
| ownership is coherent | source inspection across the authoritative path |
| no duplicate/obsolete path remains | repository search + dependency/reference inspection |
| async lifecycle is safe | cancellation/cleanup/race-path tests or targeted inspection |
| responsive system remains coherent | viewport matrix + source/token inspection |

A green screenshot cannot prove ownership. A green test suite cannot prove visual hierarchy. A clean component tree cannot prove runtime behavior.

## 12. Architectural review pass

For substantial AI-generated or AI-modified UI, perform a short structural pass after the visible behavior works.

Review the changed feature from outside-in:

```text
product decision
-> authoritative owner
-> state/data flow
-> component boundary
-> styling/design-system boundary
-> side effects/lifecycle
-> verification
-> obsolete path removal
```

Classify findings:

```text
P0: correctness/data-loss/security/accessibility-critical structural flaw
P1: duplicate ownership, lifecycle/race bug, severe coupling, or workaround likely to break future work
P2: maintainability debt with bounded current risk
```

Fix P0/P1 before claiming high-confidence completion unless the user explicitly scopes them out. Record P2 only when it is materially relevant; do not turn every task into an unsolicited refactor.

## 13. Completion contract

For substantial UI implementation, high-confidence completion requires all of the following to be separately supportable:

```text
VISUAL: the result renders as intended
BEHAVIOR: user-visible states and interactions work
STRUCTURE: the behavior is integrated into an understandable authoritative path
RESILIENCE: responsive/accessibility/async/error states relevant to the change remain valid
HYGIENE: superseded code and accidental duplicate ownership were removed or deliberately retained
```

If tooling cannot verify one dimension, report that dimension as unverified instead of inferring it from another.

The target is not perfect architecture. The target is a codebase where the next feature can be added by understanding the system, not by discovering which pile of patches currently wins.