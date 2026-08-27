# Flow Project History & Mock Startup Notes

> 마지막 정리: 2026-08-27
>
> 이 문서는 두 가지 용도로 쓴다.
> 1. 긴 ChatGPT 대화 컨텍스트를 매번 다시 옮기지 않기 위한 **Flow 장기 프로젝트 기록 / handoff 문서**
> 2. 2026년 10~11월 모의창업 활동에서 제품 개발 과정, 문제 정의, 기술적 검증, 사업화 가설을 정리하기 위한 **발표 재료**
>
> **기록 원칙**
> - GitHub commit/PR, 실제 코드, 실제 API/CI, 실제 측정값으로 확인되는 내용은 `확인된 기록`으로 취급한다.
> - 사용자 수, 매출, 제휴, 학교 도입 수처럼 아직 실제 증거가 없는 항목은 사실처럼 쓰지 않는다.
> - 발표에서 시뮬레이션이 필요하면 `가정`, `목표`, `파일럿 시나리오`라고 명시한다.
> - 실패한 실험과 merge되지 않은 PR도 개발 과정의 중요한 기록으로 남긴다.

---

## 1. Flow 한 줄 정의

**Flow는 학생이 학교와 대학 생활에서 매일 확인해야 하는 시간표, 급식, 일정, 캠퍼스, 이동 정보를 한 화면 흐름으로 묶는 학생 생활 운영 플랫폼을 목표로 하는 웹앱이다.**

초기에는 반응형 일정관리 웹앱으로 시작했지만, 실제 학교 데이터를 연결하면서 `Flow School`, 이후 대학 생활을 위한 `Flow University`, 운영 상태를 관리하는 `Flow Admin`으로 확장됐다.

현재 제품 방향은 단순 캘린더보다 **학생의 하루를 상황에 따라 보여주는 개인 생활 대시보드**에 가깝다.

---

## 2. 해결하려는 문제

학생이 하루를 관리할 때 필요한 정보는 여러 곳에 흩어져 있다.

- 학교 시간표
- 급식
- 학사일정
- 모의고사/영어듣기 일정
- 개인 일정과 수행평가
- 대학 시간표
- 캠퍼스 건물과 이동 경로
- 주변 시설
- 등하교/통학 대중교통

Flow의 핵심 가설은 다음과 같다.

> 학생은 기능별 앱 여러 개를 따로 여는 것보다, **지금 시간과 현재 상황에 필요한 정보를 하나의 Today 화면에서 우선순위대로 확인하는 경험**에서 더 큰 가치를 느낄 수 있다.

따라서 기능을 무작정 추가하기보다 `오늘 무엇을 먼저 보여줄 것인가`, `모바일에서 얼마나 빠르게 도달 가능한가`, `화면을 돌렸을 때도 같은 정보가 유지되는가`를 계속 검증해 왔다.

---

## 3. 제품 발전 과정

### Phase A — Flow Calendar / 초기 일정관리

초기 Flow는 다음 요소를 가진 반응형 일정관리 웹앱이었다.

- 월간/주간 캘린더
- 일정 추가/수정/삭제
- 카테고리 필터
- `localStorage` 저장
- 모바일/PC 반응형 레이아웃
- Flow Focus
- 시험 공부시간 계산기

이 단계에서 제품의 기본 디자인 언어와 모바일 우선 구조를 잡았다.

### Phase B — Flow School

이후 일반 일정 앱보다 학생에게 특화된 정보가 더 중요하다고 판단해 School 모드를 중심 제품으로 발전시켰다.

확인된 주요 구현:

- 공식 NEIS 기반 학교 검색
- 학교/학년/반 선택 및 로컬 복원
- 오늘 시간표
- 주간 시간표
- 급식: 조식/중식/석식
- 학사일정과 가까운 일정
- 전국 모의고사/영어듣기 일정
- 공개 데이터가 비어 있는 고등학교 선택과목을 사용자가 최소 수정하는 override 구조
- 선택과목이 포함된 실제 Today 수업 상태 계산
- 고등학교 석차/수강자수 기반 참고 계산기
- 급식 메뉴 이미지 탐색
- 시간표 공유/복사
- 학교 정보/지도
- 학교 로고를 공식 출처 우선으로 찾고, 확인 불가 시 안전한 fallback 사용
- 날짜 scrubber의 직접 조작 UI
- PWA 캐시

중요한 설계 원칙은 **공공데이터에 없는 정보를 알고 있는 것처럼 생성하지 않는 것**이었다. 원본 시간표는 복구 가능하게 보존하고, 사용자의 수정값은 별도 override로 다뤘다.

### Phase C — Flow University

School의 정보 구조를 대학 생활로 확장하면서 University 모드를 만들었다.

확인된 주요 구현:

- 대학 검색/프로필
- 대학 전공/재정/교육여건 등 공개 데이터 연동
- Everytime 공개 공유 URL 기반 시간표 import
- Today 수업 요약
- 대학 시간표
- 시간표 직접 편집/시간 조정
- 수업 블록의 직접 end-time resize
- 선택된 수업에 Apple-style selection chrome 적용
- 위젯형 Today 대시보드
- 위젯 크기에 따라 정보 위계가 달라지는 semantic variants
- 위젯 추가/제거/이동/크기조절
- long-press 기반 직접 조작
- 모바일 edge auto-scroll
- 위젯 gallery
- 사용자 레이아웃 저장
- 캠퍼스 지도
- 주변 장소 quick access
- 사용자가 직접 만드는 캠퍼스 경로
- 터치 drag reorder
- 긴 경로 reorder 중 edge auto-scroll
- Kakao 기반 장소/지도 기능

School과 University는 별개의 앱처럼 보이지 않도록 진입 화면, 설정, 글래스, 인터랙션, responsive geometry를 계속 통합해 왔다.

### Phase D — Flow Admin

제품이 커지면서 단순 UI뿐 아니라 운영 상태를 직접 볼 수 있는 Admin을 추가했다.

확인된 주요 구현:

- 관리자 로그인/세션
- 활동/이벤트 현황
- API inventory
- API health probe
- School / University / Admin / Edge Function / 외부 데이터 제공자 구조도
- 운영 상태를 한 화면에서 읽는 control-console UI
- 인증/refresh-token/allowlist 흐름 유지

Admin은 실제 서비스가 복잡해질수록 `어떤 API가 살아 있는가`, `어떤 데이터 소스를 쓰는가`, `어디에서 장애가 나는가`를 개발자가 바로 확인할 수 있게 하는 운영 도구 역할을 한다.

---

## 4. 디자인 시스템과 인터랙션

Flow에서 가장 오래 반복 개선한 부분 중 하나가 `Glass`다.

### Standard Glass

- 안정적인 반투명 material
- 콘텐츠 카드 자체보다 navigation/header/dialog 같은 app chrome 중심
- underlying content와의 관계를 유지

### Optical Glass

단순 blur를 `Liquid Glass`라고 부르지 않고 실제 왜곡이 보여야 한다는 기준으로 개발했다.

확인된 구현/개선 기록:

- Apple HIG를 참고한 material hierarchy 재구성
- 하나의 moving Liquid Glass lens가 mobile tab 사이를 이동
- hold 시 확대
- horizontal drag에 따라 직접 이동
- 속도에 따라 stretch
- nearest tab으로 settle
- transient sheet 직접 drag
- velocity-aware dismissal
- animation 도중 다시 잡아도 화면에서 보이는 위치부터 이어지는 interruptible interaction
- Chromium backdrop SVG filter가 실제로 충분한 refraction을 만들지 못한다는 문제를 진단
- 이후 constrained content-copy + SVG displacement 방식으로 실제 live-content refraction 구현
- convex squircle/Snell-law profile 기반 displacement map
- scroll 중 source-copy 정렬 문제 개선
- Optical 모드에서 header/sidebar/settings/dialog 등 기존 chrome까지 material 차이를 확대
- content cards는 과도하게 glass로 만들지 않고 matte 유지

한때 tilt/pointer 반응형 jelly object도 실험했지만 최종적으로 제품 핵심과 맞지 않아 runtime을 제거했다. 실패/폐기된 기능도 PR 기록으로 남아 있다.

---

## 5. 모바일·태블릿·데스크톱 품질 기준

Flow는 한 화면 크기만 맞추는 방식으로 개발하지 않았다.

기본 검수 viewport:

- 390×844 — mobile portrait
- 844×390 — mobile landscape
- 768×1024 — tablet portrait
- 1024×768 — tablet landscape
- 1366×768 — desktop
- 1920×1080 — large desktop

실제 개발 중 발생했던 문제 예시:

- 짧은 landscape에서 bottom navigation이 본문을 가림
- University 넓은 화면에서 dashboard가 지나치게 얕아 빈 공간이 큼
- School calendar row가 landscape에서 너무 커 첫 화면 정보를 밀어냄
- settings가 desktop에서도 모바일 폭 그대로 남아 화면 절반이 비어 보임
- timetable resize affordance가 수업 제목과 겹침
- native button chrome이 특정 breakpoint에서 다시 나타남
- widget gallery preview가 한 줄 카드 안에서 잘림
- 지도 pinch/orientation 전환 후 geometry 불일치

이런 문제 때문에 자동 overflow 검사만 통과했다고 merge하지 않고 실제 screenshot matrix를 확인하는 규칙을 저장소에 추가했다.

---

## 6. 데이터/API 구조

Flow는 가능한 한 provider별 API key를 브라우저에 노출하지 않는 구조를 사용한다.

주요 데이터/서비스:

- NEIS — 학교/시간표/급식/학사일정 계열
- 대학 공개데이터 — 대학/학과/교육·재정 계열
- Kakao — 장소/지도/좌표/캠퍼스 기능
- Supabase — Edge Functions, 데이터, 인증/운영 backend
- GitHub — source of truth, PR/CI
- Cloudflare — clean-route serving/refresh verification
- Vercel — 일부 배포 경로/실험 및 clean-route 대응 경험
- Kakao AdFit — 제한적인 광고 실험
- Public Data Portal / TAGO — Transit 기능 개발 중

보안 원칙:

- key를 client code/GitHub에 직접 넣지 않음
- Supabase Edge Function secret 사용
- 공공데이터포털 공통 인증키는 `DATA_GO_KR_SERVICE_KEY`로 통합
- 외부 서비스별 별도 key만 provider 단위로 관리

---

## 7. 배포와 장애 대응에서 얻은 기록

Flow는 기능 개발뿐 아니라 실제 배포/CI 문제도 많이 겪었다.

확인된 사례:

- production-map GitHub Actions workflow가 YAML 구조 문제로 `No jobs were run` 상태가 된 문제를 복구
- Vercel native deployment에서 `/home`, `/university/campus` 같은 clean route가 404가 되는 문제 발견
- 기존 `vercel.json` rewrite를 기반으로 physical fallback을 생성하는 static build 추가
- Cloudflare Worker shell router로 clean route refresh 안전성 강화
- production route health를 commit status로 기록
- University 외부 API의 transient 5xx에 bounded retry 적용
- CI가 같은 외부 API를 중복 호출해 flaky해지는 문제를 fixture와 단일 live verification으로 분리
- 서비스워커 cache version과 critical asset 도달 여부를 CI에서 검증

이 기록은 모의창업에서 `제품을 만들었다`보다 한 단계 더 나아가 **운영 가능한 제품으로 만들기 위해 장애·배포·관측성을 다뤘다**는 사례로 사용할 수 있다.

---

## 8. 테스트 / 개발 프로세스

Flow의 현재 기본 개발 루프:

`문제 발견 → GitHub main 확인 → branch → 구현 → focused test → 기존 regression → 6-view screenshot review → PR → CI → squash merge → production/route health`

중요한 특징:

- main 직접 수정 금지
- 관련 CI가 RED이면 merge 금지
- 사용자 screenshot을 acceptance test로 사용
- 실패한 접근은 억지로 숨기지 않고 PR을 unmerged/closed 상태로 보존
- 같은 실패를 무한 수정하지 않도록 `1 diagnosis + 보통 1 corrective edit` loop-prevention 규칙 사용
- hidden view가 계속 rerender하지 않도록 함
- 불필요한 MutationObserver/duplicate API request를 피함
- idle DOM mutation 0을 요구하는 audit 존재
- touch target, horizontal overflow, console/page error 등을 자동 검사

이 방식은 AI-assisted development를 단순 코드 생성이 아니라 **검증 가능한 개발 workflow**로 사용한 기록이기도 하다.

---

## 9. 수익화 실험

실제 기록 기준으로 현재 제품 전략은 `사용자 가치 확인 → 재방문 확인 → 제한적 수익화 실험` 순서다.

### 실제 확인된 초기 측정값 — 2026-08-19 당시

- `flow_school_events`: 66행
- 익명 사용자 식별자: 2개
- `tab_view`: 49회 / 2명
- `dashboard_view`: 5회 / 2명
- `page_view`: 4회 / 1명
- `setup_complete`: 4회 / 1명
- `return_visit`: 3회 / 1명
- 당시 실제 수익: 0원

표본이 매우 작기 때문에 이 숫자로 시장성을 단정하지 않는다.

### Kakao AdFit

이후 사용자의 명시적 승인으로 School Today에 320×100 Kakao AdFit 단위 시험을 추가했다.

현재 원칙:

- 핵심 조작을 방해하지 않음
- 광고가 실제 송출되지 않으면 빈 100px 공간도 남기지 않음
- Optical Glass source-copy에 광고 DOM을 복제하지 않음
- 광고를 navigation/search/settings/admin 근처에 두지 않음
- 광고 수익/이탈 데이터가 생기기 전까지 밀도를 늘리지 않음

---

## 10. Transit — 현재 진행 중인 큰 확장

Transit은 단순 `버스 도착 정보`가 아니라 학생 통학 전체를 다루는 방향으로 설계 중이다.

목표 UX:

- 현재 위치 → 목적지
- 약 5개 경로 후보
- 추천 경로 표시
- bus / subway / walk 조합
- 어느 버스/노선을 타는지
- 승차/하차 정류장
- 도보 구간
- 총 예상시간 / 도착 예정시간
- 실시간 도착정보 변화에 따른 reranking
- 장기적으로 `2정거장 남음` 같은 active-trip guidance

현재 기술 방향:

- Kakao geocoding
- 공공데이터포털 인증키
- TAGO 버스 정류장/노선/도착 데이터
- 도시별 데이터가 더 정확한 경우 지역 adapter 추가
- 향후 GTFS/추가 route provider 검토

2026-08-27 현재 PR #148은 open/unmerged 상태다.

현재 blocker:

- `transit-data` Edge Function v10까지 배포/호출 확인
- 대구 → 경북대학교 live route test가 아직 HTTP 502
- 실제 TAGO probe에서는 대구 cityCode `22`, 4,261개 정류장 전체와 경북대 근처 정상 정류장을 확인
- 따라서 외부 데이터가 없는 문제가 아니라 production `nearbyStops` 실행 경로와 독립 probe 간의 동작 차이를 더 구조적으로 진단해야 함

현재 Transit RED 상태에서는 merge하지 않는 것이 프로젝트 계약이다.

---

## 11. 실패 실험도 남겨야 하는 이유

Flow 기록에는 성공 PR만 있는 것이 아니다.

예:

- dashboard settle interruption ownership을 잘못된 runtime layer에서 수정하려다 실패
- University short-landscape dock을 CSS 소유권이 아닌 layer에서 줄이려다 실제 outer chrome이 변하지 않아 폐기
- timetable start resize grip이 기능적으로는 성공했지만 제목과 시각적으로 겹쳐 release 차단
- School boot + glass preload 접근이 기존 material cascade를 깨고 Optical source-copy에서 AdFit DOM까지 복제해 폐기

이런 PR은 merge하지 않고 원인/다음 구조적 접근을 문서화했다.

모의창업에서 이 기록은 실패를 숨길 필요가 없다는 장점이 있다. 오히려 다음처럼 설명할 수 있다.

> 기능을 빨리 추가하는 것보다 실제 사용자 화면에서 문제가 생기면 release를 막고, 실패 원인을 기록한 뒤 구조를 바꾸는 방식으로 제품 완성도를 높였다.

---

## 12. 모의창업 발표에 사용할 수 있는 서사

### 문제 정의

학교/대학 생활 정보가 여러 서비스에 분산되어 학생이 매일 반복해서 검색하고 확인해야 한다.

### 해결책

Flow가 Today 화면을 중심으로 시간표·급식·일정·캠퍼스·통학 정보를 상황에 맞춰 통합한다.

### 차별점

- 단순 일정 앱이 아니라 실제 학교/대학 공공데이터 연결
- School → University로 이어지는 학생 lifecycle
- 사용자가 정보를 읽기만 하는 것이 아니라 시간표/경로/dashboard를 직접 조작
- 모바일/landscape/tablet/desktop 전체를 실제 검증
- API key를 server-side로 숨기는 구조
- CI와 production health까지 포함한 운영 경험
- 실제 optical refraction을 구현한 차별화된 interaction design

### 사업 모델 후보

현재 실제로 확정된 사업 모델은 아니다. 모의창업에서는 다음을 `가설`로 사용할 수 있다.

1. 무료 기본 기능 + 제한적 광고
2. 여러 기기 동기화 / 고급 개인화의 선택적 Plus
3. 반/동아리/학생회용 공용 일정 보드
4. 학교 단위 안내/행사/시간표 관리 B2B/B2B2C
5. 대학 캠퍼스/학생생활 제휴 정보

### 시장 확장 서사

`고등학생의 Today → 대학생의 Today → 통학/캠퍼스 → 학생 생활 전체`

이 흐름을 사용하면 School과 University가 따로 놀지 않고 하나의 장기 제품 로드맵으로 설명된다.

---

## 13. 발표용 가정은 이렇게만 사용한다

아래는 **실제 성과가 아니라 발표용 시뮬레이션 예시**다.

- `가정: 한 학교 100명 규모 베타를 진행한다.`
- `목표: 4주 내 주간 재방문율 30%를 검증한다.`
- `가정: 광고 1슬롯과 Plus 기능의 수익성을 비교한다.`
- `파일럿 시나리오: 학생회/동아리 일정 보드를 한 학교에서 시험한다.`
- `목표: 대구에서 통학 Transit을 먼저 안정화하고 전국 TAGO fallback으로 확대한다.`

발표 슬라이드에서 이 숫자를 실제 사용자/매출 성과처럼 표현하지 않는다. 실제 데이터가 생기면 가정과 교체한다.

---

## 14. 현재 기술 스택 요약

### Frontend

- HTML / CSS / JavaScript 중심
- PWA / service worker
- responsive mobile-first UI
- DOM / Pointer Events / Web Animations / SVG filter
- Playwright browser audit

### Backend / Data

- Supabase Edge Functions
- Supabase DB/Auth 일부
- NEIS 및 대학 공공데이터
- Kakao APIs
- Public Data Portal / TAGO

### Delivery / Operations

- GitHub source + PR workflow
- GitHub Actions
- Cloudflare Worker / clean-route checks
- Vercel deployment 경험 및 fallback build
- production health checks

---

## 15. 다음 제품 방향

우선순위 후보:

1. Transit blocker 구조적 해결
2. 실제 통학 route 1~5개 안정적 반환
3. 실시간 도착정보 기반 reranking
4. 지역별 교통 adapter 확대
5. Transit까지 포함한 School Today UX 통합
6. 영어 잔여 UI 문자열 정리
7. 실제 사용자 표본 확대 후 retention 측정
8. School/University 공통 디자인 token 추가 통합
9. 필요 시 Capacitor 기반 Android 앱 packaging 검토

---

## 16. 다음 ChatGPT/개발 세션을 위한 최소 handoff

앞으로 긴 과거 대화를 모두 복사하지 말고 다음만 전달해도 된다.

```text
Repository: https://github.com/hoonex/blank-app
ULW.
GitHub current state is source of truth.
Read root AGENTS.md and FLOW_PROJECT_HISTORY.md first.
Check current main HEAD, open PRs and CI before changes.
Do not edit main directly.
Preserve actual Optical Glass/refraction and existing data/security contracts.
Continue from current repository state without reconstructing stale conversation history.
```

이 문서 자체도 오래된 정보가 될 수 있으므로, 실제 작업을 시작할 때는 **항상 GitHub current state가 최종 source of truth**다.

---

## 17. 기록에서 확인되는 핵심 성과 요약

- 단순 일정관리 앱을 School/University/Admin 구조로 확장
- 실제 교육/지도/공공데이터 연결
- 사용자 설정과 원본 데이터의 충돌을 피하는 override 설계
- 직접 조작형 timetable/widget/campus interaction 구현
- 단순 blur가 아닌 Optical refraction 구현
- 모바일 portrait뿐 아니라 landscape/tablet/desktop까지 품질 gate 구축
- UI screenshot을 CI artifact로 만들어 release 판단에 사용
- secrets를 client에서 분리
- clean-route / deployment / transient API failure를 실제로 진단하고 복구
- 실패한 실험을 억지 merge하지 않고 원인과 다음 접근을 기록
- 제한적인 광고 수익화 실험 시작
- 통학 교통 기능을 전국 확장 가능한 adapter 구조로 개발 중

Flow의 가장 큰 자산은 특정 기능 하나보다 **아이디어 → 실제 데이터 → 인터랙션 → 검증 → 장애 대응 → 다시 개선하는 개발 기록이 축적되어 있다는 점**이다.
