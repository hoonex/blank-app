# Flow Current Status

> Updated: 2026-08-28 KST
>
> **Purpose:** compact source for the latest Flow state. `FLOW_PROJECT_HISTORY.md` remains the long-form historical record. GitHub current state overrides this file if stale.

## Repository baseline

- Repository: `hoonex/blank-app`
- Current verified main: `3d1341eed0215d61a7947d93fc32b310334497e7`
- Transit bus routing, transfer reranking, bus map, and Transit map UI stabilization are merged.
- Open PRs: none at the last verified baseline.

## Transit state

Implemented and merged:

- School `교통` destination
- current-location opt-in only after explicit action
- Kakao destination geocoding
- TAGO/Public Data Portal bus routing
- up to five route candidates
- direct + one-transfer bus routing
- walking legs
- boarding/alighting stops
- per-bus-leg realtime arrival enrichment when available
- second-leg transfer arrival reranking
- lazy bus map
- route-stop geometry
- live bus vehicle markers when available
- responsive map sheet/dialog
- mobile/tablet/desktop visual audits

Current limitation:

- subway/multimodal routing is not merged yet.
- KRIC urban-rail APIs use a separate KRIC service key; the existing `DATA_GO_KR_SERVICE_KEY` returned result code `30` (`등록되지 않은 서비스키`) in a compatibility probe.
- Do not pretend KRIC timetable/realtime data is available until a valid KRIC key/approval exists.
- Static/official rail topology can still be considered later, but it should be a separate scoped PR rather than extending ordinary Transit polish indefinitely.

## Preserved contracts

- main is never edited directly.
- relevant RED CI blocks merge.
- UI changes require six-viewport screenshot inspection.
- real Optical Glass/refraction must remain.
- secrets stay server-side.
- no automatic geolocation prompt on load.
- hidden views do not continuously rerender/poll.
- avoid duplicate API fetch/runtime/MutationObserver layers.

## Next likely work

1. Decide rail data source/key before subway implementation.
2. Active-trip guidance (`N stops remaining`, boarding/alighting progress).
3. Transit context in School Today.
4. Remaining English UI cleanup.
5. Retention measurement / mock-startup evidence updates.

## Minimal future-chat handoff

```text
Repository: https://github.com/hoonex/blank-app
ULW.
GitHub current state is source of truth.
Read AGENTS.md and FLOW_CURRENT_STATUS.md first.
Re-check main HEAD, open PRs and current CI before changes.
Continue autonomously from repository state.
```
