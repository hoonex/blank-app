import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.FLOW_BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.FLOW_ORIENTATION_OUT || 'full-orientation-audit';
const CASES = [
  { name: 'mobile-portrait', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'mobile-landscape', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
  { name: 'tablet-portrait', viewport: { width: 768, height: 1024 }, isMobile: false, hasTouch: true },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 }, isMobile: false, hasTouch: true },
  { name: 'desktop-1366', viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false },
  { name: 'desktop-1920', viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false },
];

const SCHOOL = {
  officeCode: 'D10', officeName: '대구광역시교육청', schoolCode: '7240101', name: '정동고등학교',
  englishName: 'Jeongdong High School', kind: '고등학교', location: '대구광역시',
  jurisdiction: '대구광역시동부교육지원청', type: '사립', postalCode: '41063',
  address: '대구광역시 동구 반야월북로 199', addressDetail: '', phone: '053-000-0000', fax: '053-000-0001',
  homepage: 'https://jungdong.dge.hs.kr', coed: '남녀공학', highSchoolType: '일반고', highSchoolTrack: '일반계',
  dayNight: '주간', founded: '19830301', anniversary: '19830301',
};
const UNIVERSITY = {
  id: 'knu', name: '경북대학교', englishName: 'Kyungpook National University', kind: '대학교', division: '대학',
  foundation: '국립', founded: '19460528', campus: '본교', region: '대구', address: '대구광역시 북구 대학로 80',
  postalCode: '41566', phone: '053-950-5114', fax: '053-950-0000', homepage: 'https://www.knu.ac.kr',
};
const logoSvg = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="22" fill="#eee"/><path d="M20 48h56M48 20v56" stroke="#555" stroke-width="8"/></svg>'
).toString('base64');

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  generatedAt: new Date().toISOString(), base: BASE, cases: [], failures: [],
  summary: { schoolStates: 0, universityStates: 0, adminStates: 0, warnings: 0, failures: 0 },
};

function json(route, body, status = 200, headers = {}) {
  return route.fulfill({ status, contentType: 'application/json; charset=utf-8', headers, body: JSON.stringify(body) });
}
function ymd(d) { return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; }
function parseYmd(v) { return new Date(+v.slice(0, 4), +v.slice(4, 6) - 1, +v.slice(6, 8), 12); }
function plusDay(v, n) { const d = parseYmd(v); d.setDate(d.getDate() + n); return ymd(d); }
function schoolRows(date) {
  return ['문학', '미적분', '영어Ⅱ', '정보'].map((subject, i) => ({ date, period: i + 1, subject, grade: '2', className: '6' }));
}
function schoolDashboard(selected) {
  const d = parseYmd(selected), day = d.getDay(), monday = new Date(d);
  monday.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  const byKey = new Map();
  for (let i = 0; i < 5; i++) {
    const date = ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12));
    for (const row of schoolRows(date)) byKey.set(`${row.date}:${row.period}`, row);
  }
  for (const row of schoolRows(selected)) byKey.set(`${row.date}:${row.period}`, row);
  return {
    school: SCHOOL, selected, from: ymd(monday), to: ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 4, 12)),
    timetable: [...byKey.values()],
    meals: [{ date: selected, type: '중식', dishes: ['현미밥', '닭갈비(5.6.15.)', '계란찜(1.)', '배추김치(9.)'], calories: '742 Kcal', nutrition: '탄수화물 90g\n단백질 32g', origin: '쌀 국내산\n닭고기 국내산', people: '320' }],
    events: [
      { date: plusDay(selected, 2), name: '2학기 학급 행사', content: '학급별 행사', grade1: 'N', grade2: 'Y', grade3: 'N', holidayType: '' },
      { date: plusDay(selected, 7), name: '진로 체험', content: '진로 체험 활동', grade1: 'Y', grade2: 'Y', grade3: 'Y', holidayType: '' },
    ], scheduleMeta: { mode: 'fixture', count: 2 },
  };
}
function universityTimetable() {
  const today = (new Date().getDay() + 6) % 7, next = (today + 1) % 7;
  return { source: 'orientation-fixture', year: 2026, semester: '2학기', subjects: [
    { id: 'u1', name: '자료구조', professor: '김교수', credit: 3, place: 'IT대학 1호관', times: [{ day: today, start: '09:00', end: '10:15', startMinutes: 540, endMinutes: 615, place: 'IT대학 1호관' }] },
    { id: 'u2', name: '운영체제', professor: '박교수', credit: 3, place: '공대9호관', times: [{ day: today, start: '11:00', end: '12:15', startMinutes: 660, endMinutes: 735, place: '공대9호관' }] },
    { id: 'u3', name: '네트워크', professor: '이교수', credit: 3, place: '법과대학', times: [{ day: today, start: '14:00', end: '15:15', startMinutes: 840, endMinutes: 915, place: '법과대학' }] },
    { id: 'u4', name: '알고리즘', professor: '최교수', credit: 3, place: 'IT대학 2호관', times: [{ day: next, start: '09:30', end: '10:45', startMinutes: 570, endMinutes: 645, place: 'IT대학 2호관' }] },
    { id: 'u5', name: '야간 스터디', professor: '', credit: 0, place: 'IT대학 1호관', times: [{ day: today, start: '23:00', end: '23:30', startMinutes: 1380, endMinutes: 1410, place: 'IT대학 1호관' }] },
  ] };
}
function campusTimetable() {
  return { source: 'campus-audit', year: 2026, semester: '2학기', subjects: [
    { id: 'ca', name: '소프트웨어설계', professor: '테스트', credit: 3, place: 'IT대학 2호관', times: [{ day: 0, startMinutes: 540, endMinutes: 615, start: '09:00', end: '10:15', place: 'IT대학 2호관' }] },
    { id: 'cb', name: '자료구조', professor: '테스트', credit: 3, place: '공대9호관', times: [{ day: 0, startMinutes: 630, endMinutes: 705, start: '10:30', end: '11:45', place: '공대9호관' }] },
    { id: 'cc', name: '교양세미나', professor: '테스트', credit: 2, place: '법과대학', times: [{ day: 0, startMinutes: 780, endMinutes: 855, start: '13:00', end: '14:15', place: '법과대학' }] },
  ] };
}
function universityProfile() {
  return { school: UNIVERSITY, metrics: {
    tuition: { year: '2025', value: 4500000, indicatorId: 'tuition' }, scholarship: { year: '2025', value: 2900000, indicatorId: 'scholarship' },
    dormitory: { year: '2025', value: 21.5, indicatorId: 'dormitory' }, library: { year: '2025', value: 18.2, indicatorId: 'library' },
  }, partial: false, unavailable: [] };
}
function majors() {
  return Array.from({ length: 32 }, (_, i) => ({ id: `major-${i}`, name: i === 0 ? '컴퓨터학부' : `테스트학과 ${i + 1}`, college: i < 16 ? 'IT대학' : '공과대학', degree: '학사', duration: '4년', category: i === 0 ? '컴퓨터·통신' : '공학', dayNight: '주간', admission: 40 + i, graduates: 30 + i, status: '운영', characteristic: '', courses: ['전공기초', '전공심화'], careers: ['소프트웨어 개발'] }));
}
function campusPlace(name, i) {
  return { id: `p${i}`, name, place_name: name, url: `https://place.map.kakao.com/${1000 + i}`, place_url: `https://place.map.kakao.com/${1000 + i}`, address: '대구광역시 북구 대학로 80', roadAddress: '대구광역시 북구 대학로 80', x: String(128.610 + i * .001), y: String(35.888 + i * .001), distance: String(90 + i * 120), category: '교육' };
}
function campusFixture() {
  const names = ['IT대학 1호관', '공대9호관', '법과대학', 'IT대학 2호관'];
  return { center: { id: 'knu-center', name: '경북대학교', url: 'https://place.map.kakao.com/knu', x: '128.610', y: '35.888' }, places: names.map((raw, i) => ({ raw, resolved: true, confidence: 94 - i, place: campusPlace(`경북대학교 ${raw}`, i) })), nearby: {
    dining: [{ ...campusPlace('경북대학교 학생식당', 10), category: '학식' }], stores: [{ ...campusPlace('GS25 경북대점', 11), category: '편의점' }],
    cafes: [{ ...campusPlace('카페 경북대점', 12), category: '카페' }], food: [{ ...campusPlace('경북대 식당', 13), category: '식당' }],
  } };
}

async function installFixtures(page) {
  await page.route('**/functions/v1/school-data**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || 'search';
    if (action === 'search') return json(route, { schools: [SCHOOL] });
    if (action === 'classes') return json(route, { classes: ['1', '2', '3', '4', '5', '6', '7', '8'] });
    if (action === 'media') return json(route, { media: { hero: '', logo: logoSvg, logoSource: 'fixture-official' }, homepage: SCHOOL.homepage }, 200, { 'cache-control': 'public, max-age=86400' });
    if (action === 'place') return json(route, { provider: 'kakao', place: { id: 'school-place', name: SCHOOL.name, url: 'https://place.map.kakao.com/7240101', address: SCHOOL.address, roadAddress: SCHOOL.address, phone: SCHOOL.phone, x: '128.687', y: '35.875', distance: '0' } });
    if (action === 'dashboard') return json(route, schoolDashboard(u.searchParams.get('date') || ymd(new Date())));
    return json(route, { error: `unknown school fixture ${action}` }, 404);
  });
  await page.route('**/functions/v1/school-logo**', route => route.fulfill({ status: 204, body: '' }));
  await page.route('**/functions/v1/university-data**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || 'search';
    if (action === 'search') return json(route, { surveyYear: '2025', total: 1, schools: [UNIVERSITY] });
    if (action === 'profile') return json(route, universityProfile());
    if (action === 'majors') return json(route, { surveyYear: '2025', total: 32, majors: majors() });
    if (action === 'import-everytime') return json(route, { error: 'fixture import blocked' }, 502, { 'cache-control': 'no-store' });
    return json(route, { error: `unknown university fixture ${action}` }, 404);
  });
  await page.route('**/functions/v1/university-campus**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || 'campus';
    if (action === 'static-map') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#eceff3"/><circle cx="320" cy="180" r="28" fill="#999"/></svg>' });
    if (action === 'campus') return json(route, campusFixture());
    if (action === 'route') return json(route, { route: { status: 'OK', distance: 420, time: 330, landingUrl: 'https://map.kakao.com/link/to/fixture' } });
    return json(route, { error: `unknown campus fixture ${action}` }, 404);
  });
  await page.route('**/functions/v1/flow-admin**', async route => {
    const u = new URL(route.request().url());
    return u.searchParams.get('action') === 'login' ? json(route, { error: 'invalid credentials' }, 401) : json(route, { error: 'AUTH_REQUIRED' }, 401);
  });
}
function watch(page) {
  const consoleErrors = [], pageErrors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('requestfailed', r => { if (!/fonts\.gstatic|fonts\.googleapis/.test(r.url())) failed.push({ url: r.url(), error: r.failure()?.errorText || '' }); });
  return { consoleErrors, pageErrors, failed };
}
async function initBrowserStubs(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__flowShare = data; } });
    try { Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: ok => setTimeout(() => ok({ coords: { latitude: 35.8879, longitude: 128.6105, accuracy: 8 } }), 0) } }); } catch {}
  });
}
async function geom(page, label, touch = false) {
  const state = await page.evaluate(() => {
    const root = document.documentElement, body = document.body;
    const visible = e => { const s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 && r.width > 0 && r.height > 0; };
    const withinHorizontalScroller = e => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p), scrollable = ['auto', 'scroll'].includes(s.overflowX);
        if (scrollable && p.scrollWidth > p.clientWidth + 3) return true;
      }
      return false;
    };
    const openDialogs = [...document.querySelectorAll('dialog[open]')], activeDialog = openDialogs.at(-1) || null;
    const dialogs = openDialogs.map(d => { const s = d.querySelector('.sheet,.dialog-sheet') || d, r = s.getBoundingClientRect(), cs = getComputedStyle(s); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, overflowY: cs.overflowY, scrollHeight: s.scrollHeight, clientHeight: s.clientHeight }; });
    const fixed = [...document.querySelectorAll('*')]
      .filter(e => visible(e) && ['fixed', 'sticky'].includes(getComputedStyle(e).position) && !withinHorizontalScroller(e))
      .map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, id: e.id, cls: String(e.className || ''), left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; })
      .filter(x => x.bottom > 0 && x.top < innerHeight);
    const touchRoot = activeDialog || document;
    const tiny = [...touchRoot.querySelectorAll('button,a,input:not([type="hidden"]),select')]
      .filter(visible)
      .map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, id: e.id, text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 50), w: r.width, h: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; })
      .filter(x => x.bottom > 0 && x.top < innerHeight && x.right > 0 && x.left < innerWidth && (x.w < 32 || x.h < 32));
    return { clientWidth: root.clientWidth, scrollWidth: Math.max(root.scrollWidth, body?.scrollWidth || 0), clientHeight: root.clientHeight, scrollHeight: Math.max(root.scrollHeight, body?.scrollHeight || 0), dialogs, fixed, tiny };
  });
  if (state.scrollWidth > state.clientWidth + 3) throw new Error(`${label}: root horizontal overflow ${JSON.stringify(state)}`);
  for (const d of state.dialogs) if (d.left < -3 || d.right > state.clientWidth + 3 || d.width > state.clientWidth + 4) throw new Error(`${label}: dialog escapes viewport ${JSON.stringify(d)}`);
  for (const f of state.fixed) if (f.left < -4 || f.right > state.clientWidth + 4) throw new Error(`${label}: fixed/sticky control escapes viewport ${JSON.stringify(f)}`);
  const severe = state.tiny.filter(x => x.w < 20 || x.h < 20);
  if (touch && severe.length) throw new Error(`${label}: unusably small touch target ${JSON.stringify(severe.slice(0, 8))}`);
  return state;
}
async function shot(page, name, fullPage = true) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: 'disabled' }); }
async function visibleClick(page, selector) {
  const all = page.locator(selector), count = await all.count(), vp = page.viewportSize();
  for (let i = 0; i < count; i++) {
    const item = all.nth(i);
    if (!await item.isVisible()) continue;
    await item.scrollIntoViewIfNeeded().catch(() => {});
    const b = await item.boundingBox();
    if (!b || !vp || b.x + b.width <= 0 || b.y + b.height <= 0 || b.x >= vp.width || b.y >= vp.height) continue;
    await item.click();
    return item;
  }
  throw new Error(`No visible in-viewport target for ${selector}`);
}
async function returnToToday(page, fallbackSelector) {
  const jump = page.locator('#todayBtn');
  if (await jump.isVisible()) await jump.click();
  else await visibleClick(page, fallbackSelector);
}
function unexpected(errors, allowedStatusText = []) {
  return {
    consoleErrors: errors.consoleErrors.filter(x => !allowedStatusText.some(s => x.includes(s))),
    pageErrors: errors.pageErrors,
    failed: errors.failed,
  };
}
function assertNoBrowserErrors(label, errors, allowed = []) {
  const bad = unexpected(errors, allowed);
  if (bad.consoleErrors.length || bad.pageErrors.length || bad.failed.length) throw new Error(`${label} browser errors: ${JSON.stringify(bad)}`);
}

async function auditSchool(c) {
  const context = await browser.newContext({ viewport: c.viewport, isMobile: c.isMobile, hasTouch: c.hasTouch, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', acceptDownloads: true });
  await initBrowserStubs(context); const page = await context.newPage(); page.setDefaultTimeout(8000); await installFixtures(page); const errors = watch(page); const states = {};
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.locator('.school-search-panel').waitFor();
    states.landing = await geom(page, `${c.name} school landing`, c.hasTouch); await shot(page, `${c.name}-school-landing`, false);
    await page.locator('#schoolSearch').fill('정동고'); await page.locator('#schoolSearchBtn').click(); await page.locator('#schoolResults [data-result-index]').first().click();
    await page.locator('#setupDialog').waitFor({ state: 'visible' }); states.setup = await geom(page, `${c.name} school setup dialog`, c.hasTouch);
    await page.locator('#gradeRow [data-grade="2"]').click(); await page.locator('#classRow [data-class="6"]').waitFor(); await page.locator('#classRow [data-class="6"]').click(); await page.locator('#setupSave').click();
    await page.locator('#dashboard:not(.hidden)').waitFor(); await page.locator('#timetable [data-period]').first().waitFor(); await page.waitForTimeout(120);
    states.today = await geom(page, `${c.name} school today`, c.hasTouch); await shot(page, `${c.name}-school-today`);
    await page.locator('#nextDay').click(); await returnToToday(page, '#prevDay'); await page.locator('#prevDay').click(); await returnToToday(page, '#nextDay');
    await page.locator('#editSubjectsBtn').click(); const firstPeriod = page.locator('#timetable [data-period]').first(); await firstPeriod.click();
    await page.locator('#subjectDialog').waitFor({ state: 'visible' }); await page.locator('#customSubjectInput').fill('인공지능 기초'); await page.locator('#saveSubjectBtn').click();
    const savedOverride = await page.evaluate(() => localStorage.getItem('flow-school-overrides-v2') || ''); if (!savedOverride.includes('인공지능 기초')) throw new Error(`${c.name} school subject override did not persist`);
    await firstPeriod.click(); await page.locator('#resetSubjectBtn').click();
    await page.locator('#allergyBtn').click(); await page.locator('#allergyDialog').waitFor({ state: 'visible' }); const allergyChoice = page.locator('#allergyGrid input,#allergyGrid button').first(); if (await allergyChoice.count()) await allergyChoice.click(); await page.locator('#saveAllergyBtn').click();
    if (await page.locator('#mealDetailBtn').isVisible()) { await page.locator('#mealDetailBtn').click(); if (await page.locator('#mealDetails').evaluate(e => e.classList.contains('hidden'))) throw new Error(`${c.name} meal detail did not open`); }
    if (await page.locator('#shareTimetableBtn').count()) { await page.locator('#shareTimetableBtn').click(); const shared = await page.evaluate(() => window.__flowShare?.text || ''); if (!shared.includes(SCHOOL.name)) throw new Error(`${c.name} school share did not include school name`); }
    await visibleClick(page, '#settingsBtn,#mobileSettingsBtn'); await page.locator('#settingsDialog').waitFor({ state: 'visible' });
    await page.locator('#bellStart').fill('08:20'); await page.locator('#lessonMinutes').fill('50'); await page.locator('#breakMinutes').fill('10'); await page.locator('#mealStart').fill('12:10');
    states.settings = await geom(page, `${c.name} school settings`, c.hasTouch); await page.locator('#saveSettingsBtn').click();
    const bell = await page.evaluate(() => JSON.parse(localStorage.getItem('flow-school-bell-v1') || '{}')); if (bell.start !== '08:20' || bell.meal !== '12:10') throw new Error(`${c.name} school settings did not persist: ${JSON.stringify(bell)}`);
    await visibleClick(page, '[data-view="week"]'); await page.waitForFunction(() => !document.querySelector('#weekView')?.classList.contains('hidden'));
    states.week = await geom(page, `${c.name} school week`, c.hasTouch); await page.locator('#nextWeek').click(); await page.waitForTimeout(80); await page.locator('#thisWeekBtn').click(); await shot(page, `${c.name}-school-week`);
    await visibleClick(page, '[data-view="schedule"]'); await page.waitForFunction(() => !document.querySelector('#scheduleView')?.classList.contains('hidden'));
    states.schedule = await geom(page, `${c.name} school schedule`, c.hasTouch); await page.locator('#nextMonth').click(); await page.waitForTimeout(80); await page.locator('#prevMonth').click(); if (!(await page.locator('#calendarGrid .calendar-day').count())) throw new Error(`${c.name} school calendar missing`); await shot(page, `${c.name}-school-schedule`);
    await visibleClick(page, '[data-view="school"]'); await page.waitForFunction(() => !document.querySelector('#schoolView')?.classList.contains('hidden')); await page.locator('#schoolInfoGrid .info-tile').first().waitFor();
    await page.waitForFunction(() => document.querySelector('#mapLink')?.dataset.mapResolved === 'true'); states.school = await geom(page, `${c.name} school info`, c.hasTouch);
    if (!(await page.locator('#mapLink').getAttribute('href'))?.includes('place.map.kakao.com')) throw new Error(`${c.name} school map did not resolve`);
    await page.locator('#rankTotal').fill('240'); await page.locator('#rankValue').fill('23'); if ((await page.locator('#rankMain').textContent())?.includes('값을 입력')) throw new Error(`${c.name} rank calculator did not update`); await shot(page, `${c.name}-school-info`);
    await visibleClick(page, '#schoolBtn,#mobileSchoolBtn'); await page.locator('#switchDialog').waitFor({ state: 'visible' }); states.switchDialog = await geom(page, `${c.name} school switch dialog`, c.hasTouch); await page.locator('#switchDialog .dialog-close').click();
    if ((await page.locator('[data-flow-mode-switch="university"]').first().getAttribute('href')) !== '/university') throw new Error(`${c.name} school mode switch href is wrong`);
    await visibleClick(page, '#schoolBtn,#mobileSchoolBtn'); await page.locator('#changeSchoolBtn').click(); await page.locator('#landing:not(.hidden)').waitFor();
    assertNoBrowserErrors(`${c.name} school`, errors);
    return { states, errors };
  } finally { await context.close(); }
}

async function ensureMemoVisible(page) {
  const memo = page.locator('[data-widget-id="memo"]'); await memo.waitFor();
  if (await memo.evaluate(e => e.classList.contains('widget-hidden'))) {
    await page.locator('#widgetAddBtn').click(); await page.locator('#widgetPicker').waitFor({ state: 'visible' });
    await page.locator('[data-v2-picker-id="memo"],[data-picker-id="memo"]').first().click(); await page.locator('[data-widget-picker-close]').click();
  }
  return memo;
}
async function auditUniversity(c) {
  const context = await browser.newContext({ viewport: c.viewport, isMobile: c.isMobile, hasTouch: c.hasTouch, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', acceptDownloads: true });
  await initBrowserStubs(context); const page = await context.newPage(); page.setDefaultTimeout(8000); await installFixtures(page); const errors = watch(page); const states = {};
  try {
    await page.goto(new URL('university/', BASE).href, { waitUntil: 'domcontentloaded' }); await page.locator('.search-card').waitFor();
    states.landing = await geom(page, `${c.name} university landing`, c.hasTouch); await shot(page, `${c.name}-university-landing`, false);
    await page.locator('#universitySearch').fill('경북대학교'); await page.locator('#searchBtn').click(); await page.locator('#searchResults .result-button').first().click();
    await page.locator('#importDialog').waitFor({ state: 'visible' }); states.initialImportDialog = await geom(page, `${c.name} university initial import`, c.hasTouch); await page.locator('#importDialog [data-close-dialog]').click();
    await page.evaluate(tt => localStorage.setItem('flow-university-timetable-v1', JSON.stringify(tt)), universityTimetable()); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#appView:not(.hidden)').waitFor(); await page.locator('#widgetDashboard').waitFor(); await page.waitForTimeout(120);
    states.today = await geom(page, `${c.name} university today`, c.hasTouch); await shot(page, `${c.name}-university-today`);

    await page.locator('#dashboardEditBtn').click(); const memo = await ensureMemoVisible(page); await memo.scrollIntoViewIfNeeded(); await page.locator('#widgetMemoInput').fill(`${c.name} 메모 검수`);
    const before = await memo.getAttribute('data-size'), handle = memo.locator('.widget-v2-resize'); await handle.scrollIntoViewIfNeeded(); const hb = await handle.boundingBox(); if (!hb) throw new Error(`${c.name} widget resize handle missing`);
    const cx = hb.x + hb.width / 2, cy = hb.y + hb.height / 2, dx = Math.max(120, Math.min(340, c.viewport.width - cx - 8)), dy = Math.max(100, Math.min(240, c.viewport.height - cy - 8));
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + Math.min(90, dx), cy + Math.min(60, dy), { steps: 6 }); await page.mouse.move(cx + dx, cy + dy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(260);
    const after = await memo.getAttribute('data-size'); if (before === after) throw new Error(`${c.name} widget resize did not snap to a new size`);
    states.widgetEdit = await geom(page, `${c.name} university widget edit`, c.hasTouch); await shot(page, `${c.name}-university-widget-edit`); await page.locator('#widgetDoneBtn').click();
    if (c.hasTouch) {
      const campusWidget = page.locator('[data-widget-id="campus"]');
      if (await campusWidget.count() && !await campusWidget.evaluate(e => e.classList.contains('widget-hidden'))) {
        await campusWidget.scrollIntoViewIfNeeded(); const b = await campusWidget.boundingBox();
        if (b) { await page.mouse.move(b.x + b.width * .5, b.y + b.height * .5); await page.mouse.down(); await page.waitForTimeout(500); const editing = await page.locator('#todayView').evaluate(e => e.classList.contains('dashboard-editing')); await page.mouse.move(b.x + Math.min(45, b.width * .2), b.y + Math.min(35, b.height * .2), { steps: 5 }); await page.mouse.up(); if (!editing) throw new Error(`${c.name} long-press did not enter widget edit mode`); if (await page.locator('#widgetDoneBtn').isVisible()) await page.locator('#widgetDoneBtn').click(); }
      }
    }

    await visibleClick(page, '[data-view="timetable"]'); await page.locator('#timeGrid .course-block').first().waitFor(); states.timetable = await geom(page, `${c.name} university timetable`, c.hasTouch);
    const scrollState = await page.locator('#timetableScroll').evaluate(e => ({ clientWidth: e.clientWidth, scrollWidth: e.scrollWidth })); if (c.viewport.width <= 820 && scrollState.scrollWidth > scrollState.clientWidth + 3) throw new Error(`${c.name} university mobile timetable scrolls horizontally: ${JSON.stringify(scrollState)}`); await shot(page, `${c.name}-university-timetable`);

    await visibleClick(page, '#importTimetableBtn,#importTopBtn,#importSidebarBtn,#emptyImportBtn'); await page.locator('#importDialog').waitFor({ state: 'visible' });
    await page.locator('#everytimeUrl').fill('https://everytime.kr/@fixtureABCD1234'); await page.locator('#runImportBtn').click();
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('fixture import blocked'));
    if (!await page.locator('#importDialog').evaluate(d => d.open)) throw new Error(`${c.name} failed Everytime import unexpectedly closed dialog`);
    states.importFailure = await geom(page, `${c.name} university import failure`, c.hasTouch); await page.locator('#importDialog [data-close-dialog]').click();
    if (await page.locator('#appView').evaluate(e => e.classList.contains('hidden'))) throw new Error(`${c.name} Everytime failure broke app`);

    await page.locator('#addPersonalBtn').click(); await page.locator('#personalDialog').waitFor({ state: 'visible' }); await page.locator('#personalName').fill('방향 검수 일정'); await page.locator('#personalDay').selectOption('0'); await page.locator('#personalStart').fill('17:00'); await page.locator('#personalEnd').fill('18:00'); await page.locator('#personalPlace').fill('학생회관'); await page.locator('#personalForm button[type="submit"]').click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('flow-university-timetable-v1') || '{}').subjects?.some(x => x.name === '방향 검수 일정'));
    const personalId = await page.evaluate(() => JSON.parse(localStorage.getItem('flow-university-timetable-v1')).subjects.find(x => x.name === '방향 검수 일정')?.id);
    await page.locator(`[data-custom-id="${personalId}"]`).first().click(); await page.locator('#personalName').fill('방향 검수 일정 수정'); await page.locator('#personalForm button[type="submit"]').click(); await page.locator(`[data-custom-id="${personalId}"]`).first().click(); await page.locator('#deletePersonalBtn').click();

    await page.evaluate(tt => localStorage.setItem('flow-university-timetable-v1', JSON.stringify(tt)), campusTimetable());
    await visibleClick(page, '[data-view="campus"]'); await page.locator('#campusView:not(.hidden)').waitFor(); await page.locator('#campusMapWrap img').waitFor(); await page.waitForFunction(() => { const i = document.querySelector('#campusMapWrap img'); return i?.complete && i.naturalWidth > 100; });
    await page.locator('#campusPlaceList .campus-place').first().waitFor(); await page.locator('#campusRouteList .campus-route').first().waitFor(); states.campus = await geom(page, `${c.name} university campus`, c.hasTouch);
    await page.locator('#campusFilter [data-nearby="stores"]').click(); if (!(await page.locator('#campusNearbyList .campus-nearby').count())) throw new Error(`${c.name} campus store filter empty`);
    await page.locator('#currentRouteBtn').click(); await page.locator('#campusCurrentResult:not(.hidden)').waitFor(); await shot(page, `${c.name}-university-campus`);
    await visibleClick(page, '[data-view="school"]'); await page.locator('#metricGrid .metric-card').first().waitFor(); if (await page.locator('#metricGrid .metric-card').count() !== 4) throw new Error(`${c.name} university metrics incomplete`);
    await page.locator('#chooseMajorBtn').click(); await page.locator('#majorResults .major-button').first().waitFor(); states.majorDialog = await geom(page, `${c.name} university major dialog`, c.hasTouch); await page.locator('#majorSearch').fill('컴퓨터'); await page.locator('#majorResults .major-button').first().click();
    const majorSaved = await page.evaluate(() => JSON.parse(localStorage.getItem('flow-university-major-v1') || 'null')?.name || ''); if (majorSaved !== '컴퓨터학부') throw new Error(`${c.name} university major did not persist`);
    states.school = await geom(page, `${c.name} university profile`, c.hasTouch); await shot(page, `${c.name}-university-profile`);
    await visibleClick(page, '#changeUniversityBtn,#mobileSchoolBtn'); await page.locator('#changeDialog').waitFor({ state: 'visible' }); states.changeDialog = await geom(page, `${c.name} university change dialog`, c.hasTouch);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportBackupBtn').click()]); if (!download.suggestedFilename().endsWith('.json')) throw new Error(`${c.name} university backup export filename invalid`);
    const backup = await page.evaluate(() => ({ type: 'flow-university-backup', version: 1, profile: JSON.parse(localStorage.getItem('flow-university-profile-v1')), timetable: JSON.parse(localStorage.getItem('flow-university-timetable-v1')), major: JSON.parse(localStorage.getItem('flow-university-major-v1')), theme: 'light' }));
    await page.locator('#backupFileInput').setInputFiles({ name: 'flow-orientation-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) }); await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('백업'));
    if ((await page.locator('[data-flow-mode-switch="school"]').first().getAttribute('href')) !== '/') throw new Error(`${c.name} university mode switch href is wrong`);
    await page.locator('#changeDialog [data-close-dialog]').click(); await visibleClick(page, '#changeUniversityBtn,#mobileSchoolBtn'); await page.locator('#clearUniversityBtn').click(); await page.locator('#setupView:not(.hidden)').waitFor();
    assertNoBrowserErrors(`${c.name} university`, errors, ['502 (Bad Gateway)']);
    return { states, errors, widgetResize: { before, after }, scrollState };
  } finally { await context.close(); }
}

async function auditAdmin(c) {
  const context = await browser.newContext({ viewport: c.viewport, isMobile: c.isMobile, hasTouch: c.hasTouch, deviceScaleFactor: 1, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'dark' });
  const page = await context.newPage(); page.setDefaultTimeout(8000); await installFixtures(page); const errors = watch(page);
  try {
    await page.goto(new URL('admin/', BASE).href, { waitUntil: 'domcontentloaded' }); await page.locator('#loginPanel').waitFor();
    if ((await page.locator('#accessPill').textContent())?.trim() !== 'Locked') throw new Error(`${c.name} admin did not start locked`);
    const login = await geom(page, `${c.name} admin login`, c.hasTouch); await page.locator('#usernameInput').fill('flowadmin'); await page.locator('#passwordInput').fill('orientation-test-not-a-secret'); await page.locator('#passwordForm button[type="submit"]').click();
    await page.waitForFunction(() => document.querySelector('#authStatus')?.textContent?.trim().length > 0); if (!await page.locator('#dashboard').evaluate(e => e.classList.contains('hidden'))) throw new Error(`${c.name} invalid admin login exposed dashboard`);
    const after = await geom(page, `${c.name} admin rejected login`, c.hasTouch); await shot(page, `${c.name}-admin-login`, false);
    assertNoBrowserErrors(`${c.name} admin`, errors, ['401 (Unauthorized)']);
    return { login, after, status: await page.locator('#authStatus').textContent() };
  } finally { await context.close(); }
}

for (const c of CASES) {
  const caseReport = { name: c.name, viewport: c.viewport, hasTouch: c.hasTouch };
  console.log(`\n=== ${c.name} ===`);
  for (const [area, fn] of [['school', auditSchool], ['university', auditUniversity], ['admin', auditAdmin]]) {
    try {
      caseReport[area] = await fn(c);
      console.log(`${c.name} ${area}: PASS`);
      if (area === 'school') { report.summary.schoolStates += Object.keys(caseReport.school.states || {}).length; report.summary.warnings += Object.values(caseReport.school.states || {}).flatMap(x => x.tiny || []).length; }
      if (area === 'university') { report.summary.universityStates += Object.keys(caseReport.university.states || {}).length; report.summary.warnings += Object.values(caseReport.university.states || {}).flatMap(x => x.tiny || []).length; }
      if (area === 'admin') { report.summary.adminStates += 2; report.summary.warnings += (caseReport.admin.login?.tiny?.length || 0) + (caseReport.admin.after?.tiny?.length || 0); }
    } catch (error) {
      const failure = { case: c.name, area, message: error?.stack || error?.message || String(error) };
      caseReport[area] = { failure: failure.message };
      report.failures.push(failure);
      console.error(`${c.name} ${area}: FAIL\n${failure.message}`);
    }
  }
  report.cases.push(caseReport);
}
report.summary.failures = report.failures.length;
await writeFile(`${OUT}/full-orientation-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
await browser.close();
if (report.failures.length) throw new Error(`Full orientation audit found ${report.failures.length} failure(s): ${JSON.stringify(report.failures.map(x => ({ case: x.case, area: x.area, message: x.message.split('\n')[0] })))}`);
