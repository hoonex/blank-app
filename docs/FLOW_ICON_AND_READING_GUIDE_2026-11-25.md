# Flow School — 아이콘 및 정보 위계 디자인 가이드

작성: 2026-11-25
대상: Flow School / 모바일 하단 5탭 · 데스크톱 상단 탐색 · 오늘 탭

## 목표와 범위

- 기능 추가보다 **한눈에 읽기**를 우선한다. 날짜 → 현재 수업/수업목록 → 오늘의 급식 → 해당 정보의 조작 순으로 읽혀야 한다.
- 광고, 기존 하단 5탭, 버스 분리, 급식 조회, 시간표 수정, 날짜 제스처는 유지한다.
- 오늘/일정/학교/버스/설정은 다른 역할이므로 도형의 윤곽만으로도 어느 정도 구분되어야 한다. 텍스트 레이블은 항상 유지한다.
- 기존 Flow 특유의 차분한 크림색 + 코랄 포인트 + 검정 주요 영역을 유지하고, 색을 늘리지 않는다.

## 아이콘 설계 — 실제 적용

| 메뉴 | 의미 | 제작 방식 |
|---|---|---|
| 오늘 | 집/개인 대시보드 | 지붕·출입문·현황 표시 점 |
| 일정 | 날짜·행사 | 둥근 달력 외곽·날짜 표시 |
| 학교 | 학교 정보와 바로가기 | 지붕·창문·중앙 출입구 |
| 버스 | 도착·정류장 정보 | 전면창·차체·승하차 표시 |
| 설정 | 제어·맞춤 | 3개 슬라이더와 손잡이 |

모든 아이콘은 **외부 아이콘 폰트가 아닌 자체 제작 SVG**.
`flow-icons-handdrawn-v1.js`의 정적 path/rect/circle 정의가 원본이다.
`viewBox=0 0 24 24`, round cap/round join, 기본 선폭 1.85(활성 2.15), 색은 `currentColor`.
이미지 요청이 발생하지 않으며 DPR에 따라 선명하게 확대된다.

## 치수 및 배치 기준

- SVG 원본: 24×24 좌표계. 모바일 실제 렌더링 22×22 CSS px (320px 화면은 21×21).
- 모바일 플로팅 메뉴: 5등분 / 높이 70px (320px 66px) / 아이콘 위·레이블 아래 / 세로 간격 3px.
- 탭의 실제 조작 면적: 높이 52px 이상, 너비는 5등분에서 확보. 각 버튼의 실제 렌더링 너비와 높이를 QA로 확인한다.
- 메뉴는 화면 하단에서 안전 영역 + 24px 위에 배치한다. 콘텐츠 끝에는 메뉴에 가려지지 않게 여유를 둔다.
- 데스크톱 상단 메뉴: 18×18 아이콘 / 아이콘 왼쪽·레이블 오른쪽 / 간격 7px / 버튼 최소 높이 44px.
- 선택 상태: 하나의 코랄색 이동 인디케이터와 굵기가 약간 높은 아이콘·레이블. 비선택 상태는 보조 텍스트 색상.
- 사용자는 아이콘 의미를 추측하지 않도록 **텍스트 이름을 제거하지 않는다.**

## 정보 위계 규칙

1. **날짜:** 오늘/선택 날짜의 첫 번째 시선 위치. 데스크톱의 과도한 289px 날짜 패널을 축소해 수업 정보를 위로 끌어올린다. 모바일의 95px 날짜 영역은 유지한다.
2. **시간표:** 제목보다 각 과목이 읽히는 것이 중요하다. 모바일 과목명 약 17px, 교시 11px. 각 교시는 얇은 구분선으로 그룹화하며 활성 교시에만 코랄 표시를 사용한다.
3. **오늘 급식:** 메뉴명 전체가 본문이다. 동일한 크기의 알약 버튼 6개는 시각적 소음을 만든다. 메뉴를 2열 텍스트 목록으로 표시하고 보조 정보(칼로리/식단 날짜)는 작게 분리한다.
4. **월간 급식:** 날짜별로 메뉴 2개까지만 미리 보여주고, 선택 날짜의 전체 메뉴는 위에 한 번만 보여준다. 기존 뷰 전환과 데이터 원본은 유지한다.
5. **장식 최소화:** 중복되는 `+N` 배지, 설명 문구, 카드 안의 또 다른 카드는 추가하지 않는다. 코랄 포인트는 현재 상태와 활성 선택에 집중한다.
6. **읽기 흐름:** 섹션끼리의 간격은 유지하되 제목과 소속 본문은 가까이 묶는다. 불필요한 배경 또는 과도한 타이포 크기 차이를 지양한다.

## 접근성·모션

- SVG `aria-hidden=true`, `focusable=false`; 버튼에는 원래의 '오늘/일정/학교/버스/설정' 레이블이 있다.
- 버튼 `aria-current=page` 상태와 keyboard focus-visible 표시를 유지.
- `prefers-reduced-motion`인 경우 아이콘 트랜지션 제거.
- 제스처 입력·날짜 선택·급식 로딩·시간표 수정 로직을 교체하지 않는다.
- 모바일 표시는 CSS px 기준. 높은 DPR의 Android 화면에서 픽셀 배율을 크기 값에 직접 곱하지 않는다.
- 24 CSS px가 WCAG 2.2 SC 2.5.8 최소 터치 대상(예외 규정 있음); 프로젝트 목표는 44–52px 이상.

## QA 체크리스트

- 320 / 360 / 393 / 800px 모바일, 1024 / 1440px 데스크톱에서 5개 메뉴 레이블과 아이콘이 겹치지 않음
- 비선택·선택·드래그 중 상태에서 아이콘·레이블 위치가 흔들리지 않음
- 빠른 두 번 탭과 학교↔버스 슬라이드 후 이벤트 중복/누락 없음
- 하단 안전 영역, 키보드 내비게이션, 다크모드, reduced-motion 확인
- 날짜 스와이프, 주간/월간, 학교 검색, 과목 저장, 버스 탭은 회귀 테스트
- 모바일 스크롤 하단 콘텐츠가 플로팅바에 가려지지 않음
- 데스크톱 광고·상단 탐색·급식 영역이 밀리거나 겹치지 않음
- **시뮬레이터 테스트와 실기기 테스트를 구분하여 기록한다.** 실기기 미확인은 통과로 표기하지 않는다.

## 참고 자료

- Material Design 3 — [Designing icons](https://www.getbook.com/en/book/material-design-3/styles/icons/designing-icons)
- Material Design 3 — [Navigation bar: Guidelines](https://www.getbook.com/en/book/material-design-3/components/navigation-bar/guidelines)
- Material Design 3 — [Navigation bar: Specs](https://www.getbook.com/en/book/material-design-3/components/navigation-bar/specs)
- W3C WAI — [WCAG 2.2 Understanding SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- Nielsen Norman Group — [Visual Hierarchy in UX](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/)
- Nielsen Norman Group — [5 Principles of Visual Design](https://www.nngroup.com/articles/principles-visual-design/)

**구현 파일:** `flow-icons-handdrawn-v1.js`, `flow-reading-order-v1.css`.
