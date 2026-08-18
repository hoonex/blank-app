# Flow Calendar

모바일과 PC에서 모두 사용하기 편한 반응형 일정관리 웹앱입니다.

## 기능

- 월간 / 주간 캘린더 전환
- 일정 추가, 수정, 삭제
- 날짜별 일정 확인
- 학교 / 개인 / 프로젝트 카테고리 필터
- 브라우저 `localStorage` 기반 자동 저장
- PC 사이드바 레이아웃
- 모바일 플로팅 추가 버튼과 터치 친화 UI
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

## 배포

정적 웹앱이므로 GitHub Pages, Vercel, Netlify 등에 바로 배포할 수 있습니다.
