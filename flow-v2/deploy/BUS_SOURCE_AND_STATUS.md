# Flow School — In-page Daegu Bus Information

Verified in Cloudflare's separate test Worker on 2026-11-13 KST.

## What is actually running
- UI component: `flow-v2/frontend-rust/src/bus.rs`, embedded in the `School` tab (not an external website).
- Server bridge: `flow-v2/deploy/cloudflare-bridge.mjs` handles `/api/bus/search?q=` and `/api/bus/arrivals?stopId=` with fixed upstream paths, input validation, rate-limited cache and JSON normalization.
- Read-only BIS public web endpoints: `https://businfo.daegu.go.kr:8095/dbms_web_api/bsInfo/bslistNm?bsNm=` and `https://businfo.daegu.go.kr:8095/dbms_web_api/realtime/arr/{stopId}`.
- Search result names/stop identifiers (actual test search `동대구역`) were returned successfully, including `동대구역`, `동대구역건너` and `동대구역복합환승센터앞`. Arrival test for stop `7011006800` returned actual route statuses (708, 805, 818, 402, etc.), including stop counts; **not simulated data**.
- Data is obtained from a publicly accessible BIS web API, which is different from the separate public-data portal key-based OpenAPI. No API secret currently required for this specific web endpoint. Availability/terms of the BIS web endpoint may change.
- Cache: station search 3,600s, realtime arrivals 20s; manual refresh; no background polling. Favorite stop ID/name/number stored on user's device only, not sent as user profile.
- Responses include actual fetchedAt timestamp. For API outages, explicit error appears instead of made-up bus ETAs.
- Browser CI in `scripts/smoke.mjs` stubs bus endpoints for deterministic UI test; it does **not** replace the above independent live-upstream test.

## Data quality and security
- No dynamic URL or arbitrary origin proxy. Search is 2–40 characters with Unicode letter/digit/punctuation allowlist; stop ID is exactly 10 digits.
- BIS website source is not officially versioned or documented as a third-party developer contract; monitor schema changes, HTTP errors, and upstream request policies. The documented supported/stable alternative is Daegu's authenticated OpenAPI: https://www.data.go.kr/data/15139134/openapi.do .
- A reported arrival time is *an agency prediction*, not a guarantee; do not mark it verified without an authoritative response.
- Stop name search may not be comprehensive for all routes or locations. Avoid drawing a missing arrival as an on-time zero-minute arrival.
- Route-specific full route maps and transfer itineraries are **not implemented**; don't imply they are.
- Never add an external links-only "bus feature" as a replacement; the internal component is the required interface.

## Follow-up QA
1. Verify both APIs on production domain after static release + Worker bridge deployment.
2. Test busy stops and route status distinctions (e.g. 운행종료, 출발예정, 1개 정류장 전) and display updated-at time.
3. Observe actual Samsung Chrome dynamic toolbar and bottom gesture indicator while scrolling School tab.
4. Add route path / stop-to-stop details only after confirming true provider data, not guessed bus coordinates.

## 2026-11-13 production validation and small accessibility fix

- Production `/api/bus/search?q=동대구역` returned 11 actual stop matches (including 동대구역 ID 7011006700).
- Production `/api/bus/arrivals?stopId=7011006800` returned 14 actual buses and a provider fetch timestamp. The source uses compact `arrState` values `전`, `전전`; the bridge maps only these status strings to `접근 중` and continues to display the provider `bsGap` numeric count (e.g. 1 or 2 stops), without inventing an ETA. Other states (e.g. `출발예정`, `7분`) remain unchanged.
- Worker version before this wording patch: `d63380ab-8424-4b9d-817d-1c66077ea5cd`, rollback target if needed.
