# Flow Ultraworker Rules

This file is the operating contract for AI/code-agent work in this repository. Read it before changing code.

## 1. Never edit `main` directly

- Create a feature/fix branch **before the first write**.
- All code, test, workflow, and documentation changes happen on that branch.
- Open a PR, run CI, then merge only after required checks pass.
- If a write accidentally lands on `main`, stop immediately, revert that write, explain what happened, and restart from a fresh branch based on the repaired `main`.

## 2. Preflight before touching code

Before each ULW task:

1. Confirm the current `main`/production state.
2. Identify the smallest files that actually need changes.
3. Reuse existing data flows/components before adding new runtime layers.
4. Do not introduce duplicate API requests, duplicate renderers, extra MutationObservers, automatic scroll resets, or hotfix stacks.
5. Do not expose Vercel, NEIS, Kakao, Supabase, Public Data Portal, or other secret keys in client code or logs.

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

## 7. Testing before merge

For a feature PR:

- Add or update a focused automated test for the new behavior when practical.
- Run relevant existing audits, not only the new test.
- Inspect at least one browser screenshot for visual changes.
- Confirm console/page errors are zero in the relevant browser audit.
- Confirm important persistence behavior after reload if localStorage/PWA state is involved.
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
- [ ] No secret was exposed.
- [ ] No unnecessary observer/hotfix/runtime layer was added.
- [ ] New behavior was browser-tested where applicable.
- [ ] Relevant existing CI passed.
- [ ] Visual change was inspected.
- [ ] PR merged only after checks passed.
- [ ] Production deploy/route health was checked when relevant.
