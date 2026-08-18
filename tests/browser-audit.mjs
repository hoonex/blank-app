import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.env.FLOW_TEST_URL || 'http://127.0.0.1:4173/';
const OUT = process.env.FLOW_TEST_OUT || 'browser-audit-artifacts';
await fs.mkdir(OUT, { recursive: true });

const profile = {
  school: {
    officeCode: 'D10',
    schoolCode: '7240101',
    name: '정동고등학교',
    kind: '고등학교',
    officeName: '대구광역시교육청'
  },
  grade: 2,
  className: '6'
};

const cases = [
  { name: 'mobile', viewport: { width: 412, height: 915 }, mobile: true },
  { name: 'tablet', viewport: { width: 1024, height: 768 }, mobile: false },
  { name: 'desktop', viewport: { width: 1536, height: 960 }, mobile: false },
];

const browser = await chromium.launch({ headless: true });
const report = { generatedAt: new Date().toISOString(), base: BASE, cases: [] };
let failed = false;

for (const testCase of cases) {
  const context = await browser.newContext({
    viewport: testCase.viewport,
    deviceScaleFactor: 1,
    isMobile: testCase.mobile,
    hasTouch: testCase.mobile,
    locale: 'ko-KR',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const dashboardRequests = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', req => {
    if (req.url().includes('/functions/v1/school-data') && req.url().includes('action=dashboard')) {
      dashboardRequests.push(req.url());
    }
  });
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText || '' }));

  await page.addInitScript(({ profile }) => {
    localStorage.setItem('flow-school-profile-v3', JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3', 'light');
    localStorage.removeItem('flow-school-profile-v2');
    window.__flowAudit = { longTasks: [], mutations: 0 };
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__flowAudit.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
    addEventListener('DOMContentLoaded', () => {
      const root = document.querySelector('#dashboard');
      if (root) new MutationObserver(records => { window.__flowAudit.mutations += records.length; }).observe(root, { childList: true, subtree: true, attributes: true });
    }, { once: true });
  }, { profile });

  const started = Date.now();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#dashboard:not(.hidden)', { timeout: 15000 });
  await page.waitForTimeout(3500);
  const loadMs = Date.now() - started;

  const selectTab = async (view) => {
    const selector = testCase.viewport.width <= 820
      ? `.mobile-tab[data-view="${view}"]`
      : `.nav-item[data-view="${view}"]`;
    const t0 = performance.now();
    await page.locator(selector).click();
    await page.waitForSelector(`[data-view-panel="${view}"]:not(.hidden)`, { timeout: 3000 });
    return performance.now() - t0;
  };

  const tabLatencies = [];
  for (const view of ['week', 'schedule', 'school', 'today', 'week', 'today']) {
    tabLatencies.push({ view, ms: await selectTab(view) });
  }

  await selectTab('today');
  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight - innerHeight - 10)));
  await page.waitForTimeout(150);
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1200);
  const scrollAfter = await page.evaluate(() => scrollY);

  await selectTab('week');
  const weekScroll = await page.evaluate(() => {
    const el = document.querySelector('.week-table-wrap');
    if (!el) return null;
    el.scrollLeft = Math.min(420, el.scrollWidth - el.clientWidth);
    return { left: el.scrollLeft, width: el.clientWidth, scrollWidth: el.scrollWidth };
  });
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(250);
  const weekPageScroll = await page.evaluate(() => scrollY);

  await selectTab('schedule');
  const calendarDay = page.locator('.calendar-day[data-calendar-date]').filter({ has: page.locator('.calendar-dot') }).first();
  if (await calendarDay.count()) {
    await calendarDay.click();
    await page.waitForTimeout(700);
  }
  const scheduleState = await page.evaluate(() => ({
    path: location.pathname,
    selectedDays: document.querySelectorAll('.calendar-day.selected').length,
    selectedPanel: document.querySelector('#selectedDayPanel')?.textContent?.trim() || '',
    scheduleVisible: !document.querySelector('[data-view-panel="schedule"]')?.classList.contains('hidden'),
  }));

  await selectTab('today');
  const idleMutationStart = await page.evaluate(() => window.__flowAudit?.mutations || 0);
  await page.waitForTimeout(2000);
  const idleMutationEnd = await page.evaluate(() => window.__flowAudit?.mutations || 0);

  const metrics = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    domNodes: document.getElementsByTagName('*').length,
    stylesheets: document.styleSheets.length,
    scripts: document.scripts.length,
    longTasks: window.__flowAudit?.longTasks || [],
    mutationCount: window.__flowAudit?.mutations || 0,
    navCount: document.querySelectorAll('[data-view]').length,
  }));

  await page.screenshot({ path: `${OUT}/${testCase.name}-today.png`, fullPage: true });
  await selectTab('week');
  await page.screenshot({ path: `${OUT}/${testCase.name}-week.png`, fullPage: true });
  await selectTab('schedule');
  await page.screenshot({ path: `${OUT}/${testCase.name}-schedule.png`, fullPage: true });

  const p95 = [...tabLatencies].map(x => x.ms).sort((a,b)=>a-b)[Math.max(0, Math.ceil(tabLatencies.length * .95)-1)] || 0;
  const result = {
    name: testCase.name,
    viewport: testCase.viewport,
    loadMs,
    tabLatencies,
    tabP95Ms: Math.round(p95),
    scrollBefore,
    scrollAfter,
    autoScrollDelta: Math.round(scrollAfter - scrollBefore),
    weekScroll,
    weekPageScroll,
    dashboardRequestCount: dashboardRequests.length,
    dashboardRequests,
    idleMutations2s: idleMutationEnd - idleMutationStart,
    consoleErrors,
    pageErrors,
    failedRequests: failedRequests.filter(x => !x.url.includes('fonts.googleapis.com') && !x.url.includes('fonts.gstatic.com')),
    metrics,
    scheduleState,
  };
  report.cases.push(result);

  if (pageErrors.length || consoleErrors.length) failed = true;
  if (Math.abs(result.autoScrollDelta) > 8) failed = true;
  if (result.idleMutations2s > 8) failed = true;
  if (!scheduleState.scheduleVisible) failed = true;
  if (p95 > 600) failed = true;

  await context.close();
}

await browser.close();
await fs.writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
