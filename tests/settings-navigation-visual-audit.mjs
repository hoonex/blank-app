import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE = process.env.FLOW_BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.FLOW_SETTINGS_NAV_OUT || 'settings-navigation-visual-audit';
const CASES = [
  { name: 'mobile-portrait', viewport: { width: 390, height: 844 } },
  { name: 'mobile-landscape', viewport: { width: 844, height: 390 } },
];
const SCHOOL = {
  officeCode: 'D10', officeName: '대구광역시교육청', schoolCode: '7240101', name: '정동고등학교',
  englishName: 'Jeongdong High School', kind: '고등학교', location: '대구광역시', type: '사립',
  address: '대구광역시 동구 반야월북로 199', phone: '053-000-0000', homepage: 'https://jungdong.dge.hs.kr',
  highSchoolType: '일반고', highSchoolTrack: '일반계', coed: '남녀공학', dayNight: '주간',
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), cases: [], failures: [] };

function ymd(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json; charset=utf-8', body: JSON.stringify(body) });
}
function dashboard() {
  const selected = ymd();
  return {
    school: SCHOOL, selected, from: selected, to: selected,
    timetable: [
      { date: selected, period: 1, subject: '문학', grade: '2', className: '6' },
      { date: selected, period: 2, subject: '미적분', grade: '2', className: '6' },
      { date: selected, period: 3, subject: '영어Ⅱ', grade: '2', className: '6' },
      { date: selected, period: 4, subject: '정보', grade: '2', className: '6' },
    ],
    meals: [{ date: selected, type: '중식', dishes: ['현미밥', '닭갈비'], calories: '720 Kcal', nutrition: '', origin: '' }],
    events: [{ date: selected, name: 'UI 검수', content: 'fixture', grade1: 'N', grade2: 'Y', grade3: 'N', holidayType: '' }],
    scheduleMeta: { mode: 'fixture', count: 1 },
  };
}
async function installFixtures(page) {
  await page.route('**/functions/v1/school-data**', async route => {
    const u = new URL(route.request().url()), action = u.searchParams.get('action') || '';
    if (action === 'dashboard') return json(route, dashboard());
    if (action === 'media') return json(route, { media: {}, homepage: SCHOOL.homepage });
    if (action === 'place') return json(route, { provider: 'kakao', place: { id: 'fixture', name: SCHOOL.name, url: 'https://place.map.kakao.com/fixture', address: SCHOOL.address, roadAddress: SCHOOL.address, x: '128.687', y: '35.875' } });
    if (action === 'classes') return json(route, { classes: ['1', '2', '3', '4', '5', '6'] });
    return json(route, {});
  });
  await page.route('**/functions/v1/school-logo**', route => route.fulfill({ status: 204, body: '' }));
}

for (const c of CASES) {
  const context = await browser.newContext({ viewport: c.viewport, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const consoleErrors = [], pageErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e)));
  await installFixtures(page);
  try {
    await page.addInitScript(({ school }) => {
      localStorage.clear();
      localStorage.setItem('flow-school-profile-v3', JSON.stringify({ school, grade: 2, className: '6' }));
      localStorage.setItem('flow-school-theme-v3', 'light');
    }, { school: SCHOOL });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.locator('#dashboard:not(.hidden)').waitFor();

    await page.locator('#mobileSettingsBtn:visible').click();
    const settings = page.locator('#flowSchoolSettingsView:not(.hidden)');
    await settings.waitFor();
    const firstFold = await page.evaluate(() => {
      const panel = document.querySelector('#flowSchoolSettingsView');
      return {
        scrollTop: panel?.scrollTop ?? -1,
        headingTop: panel?.querySelector('.flow-settings-header')?.getBoundingClientRect().top ?? -1,
        legacyOpen: Boolean(document.querySelector('#settingsDialog')?.open),
      };
    });
    if (firstFold.scrollTop !== 0 || firstFold.headingTop < 45 || firstFold.legacyOpen) throw new Error(`${c.name} settings first fold is wrong: ${JSON.stringify(firstFold)}`);
    await page.screenshot({ path: `${OUT}/${c.name}-settings-first-fold.png`, fullPage: false, animations: 'disabled' });

    await settings.locator('[data-flow-bell="start"]').fill('08:20');
    await settings.locator('[data-flow-bell="lesson"]').fill('50');
    await settings.locator('[data-flow-bell="break"]').fill('10');
    await settings.locator('[data-flow-bell="meal"]').fill('12:10');
    await settings.locator('[data-flow-save-school]').click();
    await page.locator('#toast.show').waitFor();
    const focusedAfterSave = await page.evaluate(() => document.activeElement?.matches?.('#flowSchoolSettingsView input') || false);
    if (focusedAfterSave) throw new Error(`${c.name} kept a settings input focused after save`);

    await page.locator('.mobile-tab[data-view="week"]:visible').click();
    await page.locator('#weekView:not(.hidden)').waitFor();
    await page.waitForTimeout(40);
    const navState = await page.evaluate(() => ({
      toastVisible: document.querySelector('#toast')?.classList.contains('show') || false,
      settingsVisible: !document.querySelector('#flowSchoolSettingsView')?.classList.contains('hidden'),
      weekActive: document.querySelector('.mobile-tab[data-view="week"]')?.classList.contains('active') || false,
    }));
    if (navState.toastVisible || navState.settingsVisible || !navState.weekActive) throw new Error(`${c.name} destination navigation carried settings UI across: ${JSON.stringify(navState)}`);
    await page.screenshot({ path: `${OUT}/${c.name}-week-after-settings.png`, fullPage: false, animations: 'disabled' });

    if (consoleErrors.length || pageErrors.length) throw new Error(`${c.name} browser errors: ${JSON.stringify({ consoleErrors, pageErrors })}`);
    report.cases.push({ name: c.name, firstFold, navState });
    console.log(`${c.name}: PASS`);
  } catch (error) {
    report.failures.push({ name: c.name, message: error?.stack || error?.message || String(error) });
    console.error(`${c.name}: FAIL\n${error?.stack || error}`);
  } finally {
    await context.close();
  }
}

await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
if (report.failures.length) throw new Error(`Settings navigation visual audit found ${report.failures.length} failure(s)`);
