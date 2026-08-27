# Flow Edge Function secrets

Production credential values belong only in Supabase Edge Function Secrets. Never commit values to this repository or paste them into CI logs.

## Required production secrets

| Secret | Used by | Public-data service / purpose |
| --- | --- | --- |
| `NEIS_KEY` | `school-data` | NEIS school info, classes, timetable, meals, schedules |
| `KAKAO_REST_KEY` | `school-data`, `school-logo`, `university-campus`, `transit-data` | Kakao local/search/image/static-map REST APIs and transit destination geocoding |
| `DATA_GO_KR_SERVICE_KEY` | `university-data`, `transit-data` | Shared Public Data Portal account credential for approved university/TAGO APIs |

`DATA_GO_KR_SERVICE_KEY` is the canonical Public Data Portal credential. The university function still accepts the historical `UNIVERSITY_DATA_KEY`, `UNIVERSITY_SCHOOL_INFO_KEY`, `UNIVERSITY_MAJOR_INFO_KEY`, `UNIVERSITY_FINANCES_KEY`, and `UNIVERSITY_EDUCATION_CONDITION_KEY` names as optional compatibility overrides, but new production configuration does not require duplicate copies of the same account key.

Transit routing does not require ODsay, TMAP, or Kakao Mobility affiliate routing. The first public-data routing layer uses TAGO nearby-stop, stop-route, route-stop, and live-arrival operations. Kakao Local is used only to resolve a typed destination into coordinates.

For Public Data Portal credentials, store the decoded/raw key value. The Edge Functions encode query parameters when making requests, which avoids accidental double encoding.

## Deployment gate

Do not deploy env-only versions until the required production secrets are present. Once configured, deploy the versioned sources and verify:

1. School search/dashboard data from NEIS.
2. School Kakao place resolution.
3. School logo Kakao search plus favicon fallback.
4. University search and majors through the shared Public Data Portal key.
5. University finance and education-condition profile metrics.
6. University campus resolution, route, and static map.
7. Transit `health` reports Public Data Portal and Kakao integrations configured without exposing credential values.
8. Transit route search returns up to five normalized public-data bus routes and gracefully degrades when real-time arrival enrichment is unavailable.
9. The public-data router supports direct buses and one-transfer bus routes before the nationwide GTFS graph is added.

The repository audit `scripts/edge-secret-audit.mjs` enforces the expected variable names and rejects credential-like literal assignments in versioned Edge Function TypeScript sources.