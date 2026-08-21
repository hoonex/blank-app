# Flow Edge Function secrets

Production credential values belong only in Supabase Edge Function Secrets. Never commit values to this repository or paste them into CI logs.

## Required production secrets

| Secret | Used by | Public-data service / purpose |
| --- | --- | --- |
| `NEIS_KEY` | `school-data` | NEIS school info, classes, timetable, meals, schedules |
| `KAKAO_REST_KEY` | `school-data`, `school-logo`, `university-campus` | Kakao local/search/image/routing/static-map REST APIs |
| `UNIVERSITY_SCHOOL_INFO_KEY` | `university-data` | `SchoolInfoService` university search/profile |
| `UNIVERSITY_MAJOR_INFO_KEY` | `university-data` | `SchoolMajorInfoService` major/department data |
| `UNIVERSITY_FINANCES_KEY` | `university-data` | `FinancesService` tuition/scholarship metrics |
| `UNIVERSITY_EDUCATION_CONDITION_KEY` | `university-data` | `EducationConditionService` dormitory/library metrics |

`UNIVERSITY_DATA_KEY` exists only as a temporary compatibility alias in the versioned `university-data` source. New production configuration should set all four service-specific university keys above. After production has been verified with all four keys, remove the compatibility alias.

## Deployment gate

Do not deploy the env-only versions of `school-data`, `school-logo`, `university-campus`, or `university-data` until the required production secrets are present. Once configured, deploy the versioned sources and verify:

1. School search/dashboard data from NEIS.
2. School Kakao place resolution.
3. School logo Kakao search plus favicon fallback.
4. University search and majors.
5. University finance and education-condition profile metrics.
6. University campus resolution, route, and static map.

The repository audit `scripts/edge-secret-audit.mjs` enforces the expected variable names and rejects credential-like literal assignments in versioned Edge Function TypeScript sources.
