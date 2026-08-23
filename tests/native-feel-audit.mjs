import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.FLOW_BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.FLOW_NATIVE_OUT || 'native-feel-audit';
const SCHOOL = {
  officeCode: 'D10', officeName: '대구광역시교육청', schoolCode: '7240101', name: '정동고등학교',
  englishName: 'Jeongdong High School', kind: '고등학교', location: '대구광역시', type: '사립',
  address: '대구광역시 동구 반야월북로 199', phone: '053-000-0000', homepage: 'https://jungdong.dge.hs.kr',
  highSchoolType: '일반고', highSchoolTrack: '일반계', coed: '남녀공학', dayNight: '주간',
};
const UNIVERSITY = {
  id: 'knu', name: '경북대학교', englishName: 'Kyungpook National University', kind: '대학교', division: '대학',
  foundation: '국립', campus: '본교', region: '대구', address: '대구광역시 북구 대학로 80',
  phone: '053-950-5114', homepage: 'https://www.knu.ac.kr',
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), base: BASE, cases: [], failures: [] };

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
}
function schoolDashboard() {
  const selected = ymd();
  return {
    school: SCHOOL, selected, from: selected, to: selected,
    timetable: [
      { date: selected, period: 1, subject: '문학', grade: '2', className: '6' },
      { date: selected, period: 2, subject: '미적분', grade: '2', className: '6' },
    ],
    meals: [{ date: selected, type: '중식', dishes: ['현미밥', '닭갈비'], calories: '720 Kcal', nutrition: '', origin: '' }],
    events: [{ date: selected, name: '모션 검수', content: 'fixture', grade1: 'N', grade2: 'Y', grade3: 'N', holidayType: '' }],
    scheduleMeta: { mode: 'fixture', count: 1 },
  };
}
function universityTimetable() {
  const today = (new Date().getDay() + 6) % 7;
  return { source: 'native-feel-fixture', year: 2026, semester: '2학기', subjects: [
    { id: 'u1', name: '자료구조', professor: '김교수', credit: 3, place: 'IT대학 1호관', times: [{ day: today, start: '09:00', end: '10:15', startMinutes: 540, endMinutes: 615, place: 'IT대학 1호관' }] },
    { id: 'u2', name: '운영체제', professor: '박교수', credit: 3, place: '공대9호관', times: [{ day: Math.min(4, today + 1), start: '11:00', end: '12:15', startMinutes: 660, endMinutes: 735, place: '공대9호관' }] },
  ] };
}
function universityProfile() {
  return { school: UNIVERSITY, metrics: {
    tuition: { year: '2025', value: 4500000, indicatorId: 'tuition' },
    scholarship: { year: '2025', value: 2900000, indicatorId: 'scholarship' },
    dormitory: { year: '2025', value: 21.5, indicatorId: 'dormitory' },
    library: { year: '2025', value: 18.2, indicatorId: 'library' },
  }, partial: false, unavailable: [] };
}

async function installSchoolFixtures(page) {
  await page.route('**/functions/v1/school-data**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || '';
    if (action === 'dashboard') return json(route, schoolDashboard());
    if (action === 'media') return json(route, { media: {}, homepage: SCHOOL.homepage });
    if (action === 'place') return json(route, { provider: 'kakao', place: { id: 'fixture', name: SCHOOL.name, url: 'https://place.map.kakao.com/fixture', address: SCHOOL.address, roadAddress: SCHOOL.address, x: '128.687', y: '35.875' } });
    if (action === 'classes') return json(route, { classes: ['1', '2', '3', '4', '5', '6'] });
    return json(route, {});
  });
  await page.route('**/functions/v1/school-logo**', route => route.fulfill({ status: 204, body: '' }));
}
async function installUniversityFixtures(page) {
  await page.route('**/functions/v1/university-data**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || '';
    if (action === 'profile') return json(route, universityProfile());
    if (action === 'majors') return json(route, { surveyYear: '2025', total: 1, majors: [{ id: 'm1', name: '컴퓨터학부', college: 'IT대학', degree: '학사' }] });
    if (action === 'search') return json(route, { surveyYear: '2025', total: 1, schools: [UNIVERSITY] });
    return json(route, {});
  });
  await page.route('**/functions/v1/university-campus**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || '';
    if (action === 'static-map') return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#eef1f5"/></svg>' });
    return json(route, { center: null, places: [], nearby: { dining: [], stores: [], cafes: [], food: [] } });
  });
}
function watch(page) {
  const consoleErrors = [], pageErrors = [], failedRequests = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('requestfailed', r => {
    if (!/fonts\.googleapis|fonts\.gstatic/.test(r.url())) failedRequests.push({ url: r.url(), error: r.failure()?.errorText || '' });
  });
  return { consoleErrors, pageErrors, failedRequests };
}
async function armAnimationLog(page) {
  await page.evaluate(() => {
    window.__flowNativeAnimations = [];
    if (!window.__flowNativeAnimationBound) {
      window.__flowNativeAnimationBound = true;
      document.addEventListener('animationstart', event => {
        window.__flowNativeAnimations.push({ name: event.animationName, target: event.target?.id || event.target?.className || event.target?.tagName || '' });
      }, true);
    }
  });
}
async function clearAnimationLog(page) {
  await page.evaluate(() => { window.__flowNativeAnimations = []; });
}
async function animationNames(page) {
  return page.evaluate(() => (window.__flowNativeAnimations || []).map(x => x.name));
}
async function materialState(page, navSelector, activeSelector) {
  return page.evaluate(({ navSelector, activeSelector }) => {
    const root = getComputedStyle(document.documentElement);
    const nav = document.querySelector(navSelector), active = document.querySelector(activeSelector);
    const ns = nav ? getComputedStyle(nav) : null, ps = active ? getComputedStyle(active, '::before') : null;
    return {
      motionMedium: root.getPropertyValue('--flow-motion-medium').trim(),
      navBackdrop: ns?.backdropFilter || ns?.webkitBackdropFilter || '',
      navBackground: ns?.backgroundColor || '',
      activeIndicatorOpacity: Number(ps?.opacity || 0),
    };
  }, { navSelector, activeSelector });
}
function assertClean(label, errors) {
  if (errors.consoleErrors.length || errors.pageErrors.length || errors.failedRequests.length) throw new Error(`${label} browser errors: ${JSON.stringify(errors)}`);
}

async function runSchool(reducedMotion) {
  const label = `school-${reducedMotion}`;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', reducedMotion });
  const page = await context.newPage(); page.setDefaultTimeout(8000); const errors = watch(page); await installSchoolFixtures(page);
  try {
    await page.addInitScript(({ school }) => {
      localStorage.clear();
      localStorage.setItem('flow-school-profile-v3', JSON.stringify({ school, grade: 2, className: '6' }));
      localStorage.setItem('flow-school-theme-v3', 'light');
    }, { school: SCHOOL });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.locator('#dashboard:not(.hidden)').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--flow-motion-medium').trim() === '240ms');
    await armAnimationLog(page); await clearAnimationLog(page);
    await page.locator('.mobile-tab[data-view="week"]:visible').dispatchEvent('click');
    await page.locator('#weekView:not(.hidden)').waitFor(); await page.waitForTimeout(40);
    const viewAnimations = await animationNames(page);

    await clearAnimationLog(page);
    await page.locator('#mobileSettingsBtn:visible').dispatchEvent('click');
    await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor(); await page.waitForTimeout(40);
    const settingsAnimations = await animationNames(page);
    const material = await materialState(page, '#bottomNav', '.mobile-tab.active');
    const settingsState = await page.evaluate(() => {
      const panel = document.querySelector('#flowSchoolSettingsView'), legacy = document.querySelector('#settingsDialog');
      const style = panel ? getComputedStyle(panel) : null;
      return {
        legacyOpen: Boolean(legacy?.open),
        visible: Boolean(panel && !panel.classList.contains('hidden')),
        position: style?.position || '',
        top: panel?.getBoundingClientRect().top ?? -1,
        scrollTop: panel?.scrollTop ?? -1,
      };
    });
    await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });

    await clearAnimationLog(page);
    await page.locator('.mobile-tab[data-view="today"]:visible').dispatchEvent('click');
    await page.locator('#todayView:not(.hidden)').waitFor();
    await page.locator('#allergyBtn').dispatchEvent('click');
    await page.locator('#allergyDialog').waitFor({ state: 'visible' }); await page.waitForTimeout(40);
    const sheetAnimations = await animationNames(page);
    const dialogOpen = await page.locator('#allergyDialog').evaluate(d => d.open);
    await page.locator('#allergyDialog .dialog-close').click();

    const flowNames = [...viewAnimations, ...settingsAnimations, ...sheetAnimations].filter(name => name.startsWith('flow-'));
    if (reducedMotion === 'reduce') {
      if (flowNames.includes('flow-view-enter') || flowNames.includes('flow-sheet-enter')) throw new Error(`${label} still emitted motion animations: ${JSON.stringify(flowNames)}`);
    } else {
      if (!viewAnimations.includes('flow-view-enter')) throw new Error(`${label} missing view-enter animation: ${JSON.stringify(viewAnimations)}`);
      if (!settingsAnimations.includes('flow-view-enter')) throw new Error(`${label} settings is not using view-enter motion: ${JSON.stringify(settingsAnimations)}`);
      if (!sheetAnimations.includes('flow-sheet-enter')) throw new Error(`${label} missing transient sheet-enter animation: ${JSON.stringify(sheetAnimations)}`);
      if (!material.navBackdrop.includes('blur')) throw new Error(`${label} bottom navigation is missing glass blur: ${JSON.stringify(material)}`);
      if (material.activeIndicatorOpacity < .9) throw new Error(`${label} active material indicator is not visible: ${JSON.stringify(material)}`);
    }
    if (settingsState.legacyOpen || !settingsState.visible || !dialogOpen || material.motionMedium !== '240ms') throw new Error(`${label} shared layer/functionality missing: ${JSON.stringify({ settingsState, dialogOpen, material })}`);
    if (settingsState.position !== 'fixed' || settingsState.top < 50 || settingsState.scrollTop !== 0) throw new Error(`${label} settings did not open as an independent first-fold page: ${JSON.stringify(settingsState)}`);
    assertClean(label, errors);
    return { label, viewAnimations, settingsAnimations, sheetAnimations, material, settingsState, dialogOpen, errors };
  } finally { await context.close(); }
}

async function runUniversity(reducedMotion) {
  const label = `university-${reducedMotion}`;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', reducedMotion });
  const page = await context.newPage(); page.setDefaultTimeout(8000); const errors = watch(page); await installUniversityFixtures(page);
  try {
    await page.addInitScript(({ university, timetable }) => {
      localStorage.clear();
      localStorage.setItem('flow-university-profile-v1', JSON.stringify(university));
      localStorage.setItem('flow-university-timetable-v1', JSON.stringify(timetable));
      localStorage.setItem('flow-university-theme-v1', JSON.stringify('light'));
    }, { university: UNIVERSITY, timetable: universityTimetable() });
    await page.goto(new URL('university/', BASE).href, { waitUntil: 'domcontentloaded' });
    await page.locator('#appView:not(.hidden)').waitFor();
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--flow-motion-medium').trim() === '240ms');
    await armAnimationLog(page); await clearAnimationLog(page);
    await page.locator('.bottom-item[data-view="timetable"]:visible').dispatchEvent('click');
    await page.locator('#timetableView:not(.hidden)').waitFor(); await page.waitForTimeout(40);
    const viewAnimations = await animationNames(page);
    await clearAnimationLog(page);
    await page.locator('#addPersonalBtn').dispatchEvent('click');
    await page.locator('#personalDialog').waitFor({ state: 'visible' }); await page.waitForTimeout(40);
    const sheetAnimations = await animationNames(page);
    const material = await materialState(page, '.bottom-nav', '.bottom-item.active');
    const dialogOpen = await page.locator('#personalDialog').evaluate(d => d.open);
    await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: false });
    await page.locator('#personalDialog [data-close-dialog]').click();
    const flowNames = [...viewAnimations, ...sheetAnimations].filter(name => name.startsWith('flow-'));
    if (reducedMotion === 'reduce') {
      if (flowNames.includes('flow-view-enter') || flowNames.includes('flow-sheet-enter')) throw new Error(`${label} still emitted motion animations: ${JSON.stringify(flowNames)}`);
    } else {
      if (!viewAnimations.includes('flow-view-enter')) throw new Error(`${label} missing view-enter animation: ${JSON.stringify(viewAnimations)}`);
      if (!sheetAnimations.includes('flow-sheet-enter')) throw new Error(`${label} missing sheet-enter animation: ${JSON.stringify(sheetAnimations)}`);
      if (!material.navBackdrop.includes('blur')) throw new Error(`${label} bottom navigation is missing glass blur: ${JSON.stringify(material)}`);
      if (material.activeIndicatorOpacity < .9) throw new Error(`${label} active material indicator is not visible: ${JSON.stringify(material)}`);
    }
    if (!dialogOpen || material.motionMedium !== '240ms') throw new Error(`${label} shared layer/functionality missing: ${JSON.stringify({ dialogOpen, material })}`);
    assertClean(label, errors);
    return { label, viewAnimations, sheetAnimations, material, dialogOpen, errors };
  } finally { await context.close(); }
}

for (const [mode, fn] of [['school', runSchool], ['university', runUniversity]]) {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    try {
      const result = await fn(reducedMotion);
      report.cases.push(result);
      console.log(`${mode} ${reducedMotion}: PASS`);
    } catch (error) {
      const failure = { mode, reducedMotion, message: error?.stack || error?.message || String(error) };
      report.failures.push(failure);
      console.error(`${mode} ${reducedMotion}: FAIL\n${failure.message}`);
    }
  }
}

await writeFile(`${OUT}/native-feel-report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify({ cases: report.cases.length, failures: report.failures.length }, null, 2));
if (report.failures.length) throw new Error(`Native-feel audit found ${report.failures.length} failure(s)`);