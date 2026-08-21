# Flow Edge Function secret contract

Production credentials belong in Supabase Edge Function Secrets and must never be committed to this repository.

Required custom secrets:

- `KAKAO_REST_KEY` — Kakao Developers REST API key used by `school-data`, `university-campus`, and `school-logo`.
- `NEIS_KEY` — NEIS Open API key used by `school-data`.
- `UNIVERSITY_SCHOOL_INFO_KEY` — data.go.kr service key for `SchoolInfoService` (university basic information).
- `UNIVERSITY_MAJOR_INFO_KEY` — data.go.kr service key for `SchoolMajorInfoService` (university/major information).
- `UNIVERSITY_FINANCES_KEY` — data.go.kr service key for `FinancesService` (tuition and scholarship metrics).
- `UNIVERSITY_EDUCATION_CONDITION_KEY` — data.go.kr service key for `EducationConditionService` (dormitory/library and education-condition metrics).

`university-data` intentionally uses four independent public-data keys instead of a shared `UNIVERSITY_DATA_KEY`. If two upstream services happen to use the same issued credential, store the same value under both required secret names; the code still keeps the service boundaries explicit so each key can be rotated independently later.

For data.go.kr credentials, the function accepts either an already percent-encoded service key or a decoded key. It preserves an encoded value and URL-encodes a decoded value before sending `serviceKey=`.

Deployment rule: do not deploy an env-only function version until all secrets required by that function are present in the production project. After setting secrets, verify the affected real API routes before removing any legacy deployed fallback.
