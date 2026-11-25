# Flow School · 모션 및 디테일 정리 (2026-11-25)

## 목표

이미 동작하는 UI를 다시 만들지 않고 일관된 속도·가속 곡선·피드백으로 매끄럽게 보이도록 한다. 한 화면에 지나친 흔들림/클리핑을 더하지 않는다.

## 안전한 변경 범위

- 새 파일: `flow-motion-polish-v1.css` (CSS만 추가)
- 기존 `flow-five-tabs-stable-v2.js`, `flow-today-shuttle-v4.js`, `flow-meal-refined-v4.js`, `flow-ui-wheel-20261115.js` 등의 이벤트 처리와 물리 계산 **수정 없음**
- 텍스트, 데이터 요청, 저장소 키, 광고·버스·학교 바로가기, 화면 구조 변경 없음
- 기존 CSS를 덮어쓰지 않고 인덱스 마지막에 별도 스타일을 로드

## 모션 토큰

| 부위 | 값/동작 | 의도 |
|---|---|---|
| 화면 진입 | 280ms, 6px Y, opacity .89→1 | 무거운 방향성 28px + clip-path 마스크 제거 |
| 일정 캘린더 진입 | 210ms fade only | wheel 내부 좌표 측정 방해 방지 |
| 플로팅 선택 pill | 260ms transform, 220ms width | 이탈 없이 중앙에 부드럽게 정착 |
| 손가락 드래그 중 pill | transition none | 손가락 즉시 추적 |
| 모바일 메뉴 글자/아이콘 | 150ms 내외 | 눌림·선택 반응 통일 |
| 오늘 날짜 선택 | 색상 180~220ms | 날짜 줄의 기존 스크롤 물리 보존 |
| 급식 주간/월간 선택 | 240ms transform, 드래그 중 없음 | 두 속도의 균형 |
| 급식 메뉴 등장 | 195ms, 3px Y / opacity .72→1 | 데이터 변경 시 내용만 가볍게 강조 |
| 월간 선택일 | 170ms opacity | 21~23일 전체가 움직이는 효과 없음 |
| 과목 수정 패널 | 210ms, 6px Y | 패널이 자연스럽게 열리는 느낌 |
| 데스크톱 메뉴 | 180~220ms color/background | 과장 없는 피드백 |

## 테스트와 확인 범위

모의 브라우저 Chrome headless / Flow 운영 페이지 / 후보 CSS 주입으로 확인.

- 모바일 320px / 393px / 태블릿 800px / 데스크톱 1440px: 모든 탭 순회(오늘→일정→학교→버스→설정→오늘), 각 목적지와 선택 표시 확인.
- 모바일 320/393/800px: 드래그 중 '버스' 미리보기 → 놓으면 버스 선택, 추적 중 transition 0s, 놓은 뒤 260ms 정착.
- 모두 자바스크립트 실행 오류 0, 가로 넘침 없음, 아이콘 5개 유지.
- 모바일 393px: 급식 5일(주간)↔21일(월간), 개별 날짜 선택, 오늘 날짜 11.25→11.26 변경, 시간표 과목 수정창 오픈 통과.
- `prefers-reduced-motion: reduce`: 화면 진입 애니메이션 없음, 도크 전환 0s.
- 테스트 페이지의 최초 접근 시 온보딩 가이드가 탭을 가리므로 가이드의 정상적인 '닫기' 버튼으로 종료한 뒤 탭 QA 진행.
- **Samsung Android 실기기 테스트가 아니라 Chrome 자동화 검증이다.**

## 성능·접근성 가이드

가능한 한 `transform`과 `opacity`로 화면 진입·요소 이동을 제어한다. `clip-path` 전환·레이아웃 변경 애니메이션은 피한다. `will-change`를 전역에 붙이지 않는다. 포커스 윤곽선과 화면 읽기용 기존 한글 버튼 텍스트를 유지한다. 사용자가 OS에서 애니메이션을 줄이는 경우 끈다.

근거: [MDN CSS performance](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/CSS), [web.dev High-performance CSS animations](https://web.dev/articles/animations-guide), [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).
