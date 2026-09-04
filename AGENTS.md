# Flow Ultraworker Rules

This file is the operating contract for AI/code-agent work in this repository. Read it before changing code.

## 0. The agent owns implementation

- When the user asks to implement, fix, change, polish, refactor, test, deploy, or otherwise modify Flow, the agent must perform the repository work directly with the available GitHub/code tools.
- Do **not** hand the task back as a prompt, developer instruction sheet, checklist for another agent, or "copy this into Codex" response unless the user explicitly asks for a prompt or handoff document.
- Do **not** claim GitHub write access is unavailable until the installed GitHub connector/tools have actually been checked and a real tool/permission failure has occurred.
- If the user says `ULW`, continue autonomously through preflight, branch creation, implementation, focused tests, relevant regression CI, screenshot inspection, PR, and merge when the repository rules permit it. Do not stop merely to ask whether to continue.
- If a real blocker prevents implementation, report the exact failing tool/permission/check and preserve the branch/PR state. Do not substitute hypothetical instructions for work that can still be performed.
- A user-provided screenshot or concrete UI complaint is an acceptance-test input. Reproduce and fix it in the repository rather than only explaining what should be changed.
- Keep chat handoffs compact. Put durable history in `FLOW_PROJECT_HISTORY.md` and fast-changing state in `FLOW_CURRENT_STATUS.md`; ordinary ULW updates should normally contain only the current SHA/state, meaningful change, and blocker/result rather than replaying long reasoning history.

## 1. Never edit `main` directly

- Create a feature/fix branch **before the first write**.
- All code, test, workflow, and documentation changes happen on that branch.
- Open a PR, run CI, then merge only after required checks pass.
- If a write accidentally lands on `main`, stop immediately, revert that write, explain what happened, and restart from a fresh branch based on the repaired `main`.
- For long or disposable-session work, preserve a durable checkpoint only at a coherent working milestone when losing the current session would be expensive, especially before long browser/CI/remote verification. Do **not** publish every micro-step merely for continuity.
- Keep task identities distinct: the task-start `main`/origin baseline is not the same thing as an intermediate checkpoint or the final PR head. Do not redefine the origin after a checkpoint.

## 2. Preflight before touching code

Before each ULW task:

1. Confirm the current `main`/production state.
2. Read `FLOW_CURRENT_STATUS.md` when present, then use `FLOW_PROJECT_HISTORY.md` only for longer historical context; GitHub current state overrides both if they are stale.
3. Identify the smallest files that actually need changes.
4. Reuse existing data flows/components before adding new runtime layers.
5. Do not introduce duplicate API requests, duplicate renderers, extra MutationObservers, automatic scroll resets, or hotfix stacks.
6. Do not expose Vercel, NEIS, Kakao, Supabase, Public Data Portal, or other secret keys in client code or logs.

## 2A. Engineering judgment before implementation

- Identify the authoritative owner of consequential state, geometry, data, lifecycle, and persistence decisions before adding a workaround. Fix the owner when possible instead of synchronizing multiple downstream copies.
- When two or more plausible representations can satisfy an important requirement, briefly compare two or three internally by invariant fit, lifecycle transfers, failure surface, derived-state drift, and hot-path cost. Prefer the representation that makes the required behavior structurally easiest to keep correct.
- A fix that needs an extra observer, event interceptor, compatibility shim, or runtime synchronizer should trigger a quick check for a cleaner representation that removes that failure class. Keep the compensating layer only when the repository constraints make it the safer choice.
- Preserve existing public/observable behavior unless the task explicitly changes it. Structural rewrites should keep at least one minimal regression probe for each consequential existing operation they touch.
- For async, stateful, pointer/gesture, persistence, routing, and lifecycle changes, test the transition boundary most likely to fail, not only ordinary steady-state cases. Examples include cancellation just before invocation, exact loop/edge boundaries, stale completion after replacement state exists, reload after persistence writes, and pointer capture/cancel transitions.
- Do not turn this section into ceremony. Skip representation comparison when the repository already fixes the architecture or the choice is trivial and reversible.

## 3. Loop prevention

- Do not repeatedly fetch/update the same file without a new diagnosis.
- A failed implementation gets **one diagnosis pass** and normally **one corrective edit pass**.
- If the same failure remains after that, stop changing code and report the blocker/root cause instead of entering a retry loop.
- Do not run the same tool call again unless inputs or evidence changed.
- Prefer a small new module over replacing a large stable file when the feature can be isolated safely.

## 4. Preserve known performance invariants

Flow previously suffered from duplicate runtime layers and observer-driven rerenders. Do not reintroduce them.

Required invariants:

- No automatic page `scrollTo()` on ordinary render/view changes.
- No new `MutationObserver` unless there is no viable event-driven alternative and the PR explicitly justifies it.
- Dashboard data should not be fetched twice for the same render.
- Hidden views should not continuously rerender.
- Idle DOM mutation count should remain zero where existing audits require it.
- Mobile/tablet/desktop must not gain horizontal overflow accidentally.

## 5. Data correctness rules

- Never fabricate missing school/university/public API data.
- Keep original imported timetable data recoverable when user overrides are added.
- User overrides should survive re-import only when the matching key is trustworthy.
- If a school logo/POI image cannot be verified, use a safe fallback instead of a guessed third-party image.
- Everytime import uses only public share URLs; never request Everytime credentials.

## 6. UI/UX rules

- Preserve Flow's human-designed, restrained visual language. Avoid generic AI/SaaS styling and unnecessary emoji.
- School and University modes should increasingly share the same design tokens and interaction language.
- Controls need immediate press/drag/resize feedback. A user should know when interaction has started.
- Prefer clear information hierarchy over adding more cards/buttons.
- Mobile, tablet, desktop, and wide-touch layouts all matter.
- UI-affecting ULW work must be reviewed across the responsive visual matrix: mobile portrait `390x844`, mobile landscape `844x390`, tablet portrait `768x1024`, tablet landscape `1024x768`, desktop `1366x768`, and large desktop `1920x1080`.
- Do not accept a UI because it looks correct in only one orientation or device class. Compare portrait/landscape and mobile/desktop screenshots for density, whitespace, hierarchy, clipping, and awkward stretching.
- Automated geometry/overflow checks are **necessary but not sufficient**. The agent must visually inspect the rendered screenshots and reject obvious product-quality failures even when CI is green.
- Treat the following as visual regressions unless explicitly intended: large unexplained blank regions, cards using only a fraction of an available row, headline text wrapping because adjacent controls steal width, controls glued to one side of an oversized container, inconsistent section widths, mixed-language kicker/title residue, clipped first-fold content, and visibly unbalanced spacing.
- When the user provides a screenshot, reproduce the same or nearest viewport/data state before merge and compare the new screenshot against the complaint.
- For Liquid/Optical Glass work, inspect the rendered result rather than only CSS/state assertions. Standard Glass must visibly preserve the underlying surface/content relationship; Optical mode must have a perceptible but controlled refraction/highlight difference from Standard and must update promptly during interaction. If Standard and Optical are visually indistinguishable, the task is not complete.

## 7. Testing before merge

For a feature PR:

- Add or update a focused automated test for the new behavior when practical.
- Run relevant existing audits, not only the new test.
- For UI-affecting changes, generate the complete responsive visual matrix and inspect its screenshots before merge; key screens should include a viewport/first-fold capture and a full-page capture where practical.
- For a UI complaint, automated GREEN does not override a visibly bad screenshot. Fix the visible defect before merge.
- Confirm horizontal overflow is absent across the responsive visual matrix unless a component explicitly requires horizontal scrolling.
- Confirm console/page errors are zero in the relevant browser audit.
- Confirm important persistence behavior after reload if localStorage/PWA state is involved.
- Any material defect discovered during testing, screenshot inspection, or runtime verification must have an explicit final disposition: fixed in the exact final PR bytes with matching evidence, still open and reported as a limitation/blocker, or shown by new evidence to be non-defect/out of scope. A local-only fix that is absent from the final PR head does not count as fixed.
- Do not merge while relevant CI is red.

For deployment-sensitive changes:

- Confirm production deploy reaches `READY`.
- Confirm affected clean routes return HTTP 200.

## 8. PR discipline

Each PR description should state:

- What changed.
- Why it changed.
- What was deliberately not changed.
- Which tests/audits passed.
- Any known limitation/fallback.

Do not hide a failed experiment inside a successful PR. Revert or close failed experiments cleanly.

## 9. Current product constraints

- The previously disabled recurring Flow automation stays disabled unless the user explicitly asks to enable it.
- Do not add ads unless the user explicitly reopens that direction.
- Do not remove or weaken existing school/university functionality while polishing UI.
- Keep campus/Everytime import failure isolated so the rest of University mode still works.

## 10. ULW completion checklist

Before saying a task is finished, verify:

- [ ] Work occurred on a branch, not directly on `main`.
- [ ] The agent performed the requested implementation directly; it was not handed back as a prompt/instruction sheet unless the user explicitly requested that format.
- [ ] No secret was exposed.
- [ ] No unnecessary observer/hotfix/runtime layer was added.
- [ ] New behavior was browser-tested where applicable.
- [ ] Relevant existing CI passed.
- [ ] Responsive portrait/landscape and mobile/desktop screenshots were inspected for UI-affecting work.
- [ ] User-provided screenshot complaints were reproduced and visually checked after the fix.
- [ ] UI work has no obvious whitespace, hierarchy, wrapping, alignment, or glass-quality regression even if automated checks are green.
- [ ] Every material defect found during verification is either closed in the exact final PR head or explicitly reported.
- [ ] PR merged only after checks passed.
- [ ] Production deploy/route health was checked when relevant.
