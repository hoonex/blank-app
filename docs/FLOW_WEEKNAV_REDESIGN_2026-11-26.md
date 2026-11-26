# Flow School · 날짜 선택 UI 재설계 (2026-11-26)

## 사용자 결정

- 기존 96px 압축 카드(왼쪽 날짜+오른쪽 좁은 레일)와 속도 손잡이 드래그는 **유지할 필요 없음**.
- **날짜 선택 구조를 새로 설계**, 정보가 빨리 읽혀야 함. 320px에서 3일만 보이던 좁은 레일은 부적합.
- **공유 기능은 불필요하므로 다시 추가하지 않음**.
- 다른 프로젝트(Jungdong 3D campus map, ARCLANE, Flow University)는 수정 금지.
- 오늘 / 일정 / 학교 / 버스 / 설정 5탭, 급식·시간표, 학교 데이터 및 달력 휠은 유지.

## 적용한 새 디자인

기본 날짜 바는 별도 카드 없이 사용 가능한 7일을 주간 그리드로 항상 표시한다. 상단에는 '2026년 11월 ⌄', 이전 주 / 다음 주, '오늘' 버튼을 둔다. 선택된 날짜만 어두운 rounded rectangular chip으로 강조(다크 모드에서는 Flow 코랄색), 실제 오늘은 4px 표시. 주간 바는 직접 날짜를 누르거나 가로 스와이프로 앞/뒤 한 주 이동. 멀리 있는 날짜는 연·월 제목을 눌러 별도의 월간 다이얼로그에서 선택한다. 월간 다이얼로그는 월 전환, 날짜 선택, 오늘 복귀, 닫기/Escape를 지원하며 열려 있을 때만 DOM을 생성한다.

이런 날짜 입력의 **compact default + expanded month view** 구조는 [Apple HIG Pickers](https://developer.apple.com/design/human-interface-guidelines/pickers), [Android Jetpack Compose date picker](https://developer.android.com/develop/ui/compose/components/datepickers), [date-strip pattern](https://envydesign.jp/patterns/en/date-strip/), [expandable week/month pattern](https://envydesign.jp/patterns/en/schedule-expand-week/)와 UI 문제·제약을 비교해 선택했다. 외부 코드를 복사하거나 이미지를 재배포하지 않았고, Flow의 기존 색상·글꼴 토큰을 사용했다.

### 기술 계약

- 사용자 표시: `flow-weeknav-v1.css`, `flow-weeknav-v1.js`.
- 과거 `flow-date-rail-compact-v1.css`, `flow-today-shuttle-v4.css/js`는 **index에서 링크 제거**, 파일 자체는 보존.
- 기존 Rust/Leptos `.day-strip` 181일 범위와 날짜 상태는 **원본 데이터/이벤트 제공자**. 7개의 새 날짜 버튼만 표시하고 원본 Rust 버튼은 DOM에 남겨둔다.
- 원본 DOM은 `inert`, `aria-hidden`, `clip-path`, 불투명도 0으로 사용자에게 안 보이게 하되 **실제 폭과 스크롤 너비는 유지**한다. 완전한 `display:none`은 Rust 날짜 범위 재설정을 막아 3개월 뒤 선택이 실패하므로 금지.
- 새로운 UI에서 `button.click()`을 전달하여 실제 Rust 날짜 선택·데이터 로딩, 속성 갱신을 재사용. NEIS 요청 중복 없음.
- 달이 많이 떨어져 있는 경우 원본 Rust 181일 윈도우를 단계적으로 이동, Rust의 비동기 윈도우 재설정 후 다음 목표 날짜를 클릭한다.
- 색/크기 변경만 애니메이션 처리; OS '애니메이션 줄이기' 동작 지원. 기존 스와이프 물리 코드는 더 이상 로드하지 않는다.
- 새 공유 버튼, 외부 라이브러리, 부가 정보 요청, 광고/버스 변경 없음.

## 측정·테스트

검증은 실제 운영 페이지에 *브랜치 후보 JS/CSS/HTML만 차단·대체해서* Chrome 자동화로 실시했다. 운영 반영 전 작업이며 갤럭시 실기기를 직접 구동한 것은 아님.

- 기존 디자인: 320px 3일, 390px 5일, 데이터 카드 높이 96px, 390px 실제 날짜 레일 가용 폭 약 236px.
- 새 디자인: 320/360/390/800/1366/1920px 7일 선택 버튼, 활성 날짜 단 한 개, 오늘 표시 단 한 개. 320px 날짜 영역 너비 292px, 최소 날짜 버튼 40.84px. 390px 너비 362px, 최소 49.14px.
- 320·390·1366px에서 개별 날짜 클릭, 주 이동, 2027년 3월 17일 선택(윈도우 밖 다중 이동), 오늘 복귀, Rust 원본 상태 대조 통과.
- 320·390px에서 마우스 드래그뿐 아니라 390px **실제 Chrome touchStart/touchMove/touchEnd**로 좌우 스와이프 통과.
- 월간 다이얼로그 열기/닫기, Escape, 선택 후 자동 닫기 통과.
- 320/360/390/800/1366/1920px (390px reduced-motion 추가)에서 5탭 전환 → 오늘 복귀, 화면 가로 넘침 0, JS 예외 0.
- 실제 설정 탭에서 다크 모드 선택 후 본문/날짜 대비 확인; 다크 모드 활성 날짜는 코랄 배경. 기존 데스크톱 콘텐츠 좌우 정렬과 동일하게 1366px에서 x≈54.64px.
- 844×390 가로모드·갤럭시 실기기 touch/성능은 별도 검증이 남아 있으면 그 상태를 최종 보고에 명시.

## 남긴 한계

Rust가 소유하는 181개 숨김 날짜 버튼은 내부 호환성을 위해 유지한다. 즉 화면에는 7일만 렌더링하지만 Rust 원본 181개 DOM까지 가상화·제거하지는 않았다. 전환 효과는 기존 물리 휠과 다른 단순한 주간 이동이다. 실제 기기에서 촉감은 Chrome 터치 이벤트와 다를 수 있다.

## 롤백

운영 직전 기준 정적 릴리스 SHA: `30e9702f57ad0dfec70bde03714809c21a747c80`. 배포 후 문제 발생 시 Worker의 `V2_RELEASE` 핀을 이 SHA로 복구하면 기존 압축 날짜 선택기와 드래그로 즉시 복귀한다. Cloudflare Worker 바인딩·버스 API·캐시 키를 건드리지 않는다.
