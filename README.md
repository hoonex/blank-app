# Flow Calendar

모바일과 PC에서 모두 사용하기 편한 반응형 일정관리 웹앱입니다.

## 공개 배포

현재 공개 production은 Supabase Edge Function을 통해 GitHub `main`의 정적 파일을 바로 제공합니다.

- 메인: `https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-site/`
- Flow Focus: `https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-site/focus.html`
- 시험 공부시간 계산기: `https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-site/study-calculator.html`

`.github/workflows/production-health.yml`이 외부 GitHub Actions runner에서 메인 페이지, Focus, 계산기, CSS, JS를 정기적으로 검증합니다.

기존 Vercel 커넥터 배포는 Vercel Authentication 보호와 커넥터의 프로젝트 조회 불일치가 있어 현재 공개 production 소스로 사용하지 않습니다.

## 기능

- 월간 / 주간 캘린더 전환
- 일정 추가, 수정, 삭제
- 날짜별 일정 확인
- 학교 / 개인 / 프로젝트 카테고리 필터
- 브라우저 `localStorage` 기반 자동 저장
- PC 사이드바 레이아웃
- 모바일 플로팅 추가 버튼과 터치 친화 UI
- Flow Focus 시험/과제 학습 세션 자동 분할
- 시험 공부시간 계산기
- 반투명 글래스 스타일의 다크 인터페이스

## 실행

별도 빌드 과정이 필요 없습니다.

```bash
python -m http.server 8000
```

그 다음 브라우저에서 `http://localhost:8000`을 열면 됩니다.

`index.html`을 직접 열어도 대부분의 기능은 작동합니다.

## 파일

- `index.html` — 앱 구조
- `styles.css` — 반응형 UI 및 디자인
- `app.js` — 캘린더, 일정 CRUD, 필터, localStorage 저장
- `focus.html` — 시험/과제 학습 세션 자동 분할
- `study-calculator.html` — 검색 유입용 시험 공부시간 계산기
- `MONETIZATION_LAB.md` — 수익화 실험 기록

## 배포 구조

Supabase Edge Function `flow-site`가 `hoonex/blank-app`의 공개 GitHub `main` 파일을 프록시합니다. 따라서 안전한 변경이 `main`에 병합되면 별도의 정적 사이트 재업로드 없이 반영됩니다.
