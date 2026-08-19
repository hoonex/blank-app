const EVENT_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-quest-event';
const SCHOOL_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const SCHOOL_LOGO_EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-logo';
const ANON_KEY = 'flow-school-anon-v1';
const SEEN_KEY = 'flow-school-seen-v1';
const KAKAO_PLACE_CACHE_PREFIX = 'flow-school-kakao-place-v1:';
const SCHOOL_PROFILE_KEY = 'flow-school-profile-v3';
const SCHOOL_LOGO_CACHE_PREFIX = 'flow-school-logo-fallback-v4:';

/* Visual layers are styles only now. Runtime behavior lives in school.js. */
for (const href of ['./school-v5.css','./school-hotfix.css','./school-polish.css']) {
  if (document.querySelector(`link[href="${href}"]`)) continue;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/* Keep the source HTML generic; no school-specific examples or marketing filler. */
const schoolSearch = document.querySelector('#schoolSearch');
const switchSearch = document.querySelector('#switchSearch');
if (schoolSearch) schoolSearch.placeholder = '학교 이름을 입력하세요';
if (switchSearch) switchSearch.placeholder = '학교 이름을 입력하세요';
const eyebrow = document.querySelector('.onboarding-copy .eyebrow');
if (eyebrow) eyebrow.textContent = 'FLOW SCHOOL';
const intro = document.querySelector('.onboarding-copy p');
if (intro) intro.textContent = '시간표, 급식, 학사일정과 학교정보를 한곳에서 확인합니다.';
const hints = document.querySelector('.search-hints');
if (hints) hints.innerHTML = '<span>시간표</span><span>급식</span><span>학사일정</span><a class="text-button" href="/university">대학교 시간표</a>';

/*
 * Some schools publish the new term timetable to NEIS later than others.
 * Keep this as an unobtrusive disclosure instead of making a missing timetable
 * look like an application error.
 */
const timetableCard = document.querySelector('.timetable-card');
if (timetableCard && !document.querySelector('#neisTimetableHelp')) {
  const help = document.createElement('details');
  help.id = 'neisTimetableHelp';
  help.className = 'neis-timetable-help';
  help.innerHTML = '<summary>시간표가 안 보이나요?</summary><p>학교에 따라 개학 직후 약 1~2주 동안 시간표 조정으로 NEIS에 정보가 아직 반영되지 않아 표시되지 않을 수 있습니다. NEIS에 등록되면 Flow에도 자동으로 표시됩니다.</p>';
  timetableCard.append(help);
}

/*
 * Resolve the school address to a real Kakao place URL without exposing the
 * Kakao REST key to the browser. The Edge Function owns authentication.
 */
function schoolMapContext() {
  const name = document.querySelector('#profileName')?.textContent?.trim() || '';
  const addressTile = [...document.querySelectorAll('#schoolInfoGrid .info-tile')]
    .find((tile) => tile.querySelector('span')?.textContent?.trim() === '주소');
  const address = addressTile?.querySelector('strong')?.textContent?.trim() || '';
  if (!name || name === '학교 이름' || !address) return null;
  return { name, address };
}

function kakaoSearchUrl(name, address) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(`${name} ${address}`.trim())}`;
}

function liveMapLink(context) {
  const link = document.querySelector('#mapLink');
  const current = schoolMapContext();
  if (!link || !current) return null;
  if (current.name !== context.name || current.address !== context.address) return null;
  return link;
}

function applyKakaoMapUrl(context, url, resolved = false) {
  const link = liveMapLink(context);
  if (!link) return false;
  link.href = url;
  link.dataset.mapProvider = 'kakao';
  if (resolved) link.dataset.mapResolved = 'true';
  else delete link.dataset.mapResolved;
  return true;
}

async function hydrateKakaoMapLink() {
  const context = schoolMapContext();
  const link = document.querySelector('#mapLink');
  if (!link || !context) return false;

  applyKakaoMapUrl(context, kakaoSearchUrl(context.name, context.address));

  const cacheKey = `${KAKAO_PLACE_CACHE_PREFIX}${context.name}|${context.address}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached?.url && Date.now() - Number(cached.savedAt || 0) < 7 * 86400000) {
      return applyKakaoMapUrl(context, String(cached.url).replace(/^http:/, 'https:'), true);
    }
  } catch {}

  try {
    const url = new URL(SCHOOL_EDGE);
    url.searchParams.set('action', 'place');
    url.searchParams.set('name', context.name);
    url.searchParams.set('address', context.address);
    const response = await fetch(url);
    if (!response.ok) return true;
    const body = await response.json().catch(() => ({}));
    const placeUrl = body?.place?.url;
    if (typeof placeUrl === 'string' && /^(?:https?:\/\/)?place\.map\.kakao\.com\//.test(placeUrl.replace(/^https?:\/\//, ''))) {
      const normalized = placeUrl.startsWith('http') ? placeUrl.replace(/^http:/, 'https:') : `https://${placeUrl}`;
      localStorage.setItem(cacheKey, JSON.stringify({ url: normalized, savedAt: Date.now() }));
      return applyKakaoMapUrl(context, normalized, true);
    }
  } catch {}
  return true;
}

function scheduleKakaoMapHydration(attempt = 0) {
  const delay = attempt === 0 ? 0 : Math.min(1500, 300 + attempt * 180);
  setTimeout(async () => {
    const ready = await hydrateKakaoMapLink();
    if (!ready && attempt < 6) scheduleKakaoMapHydration(attempt + 1);
  }, delay);
}

if (location.pathname === '/school') scheduleKakaoMapHydration();

/*
 * The primary media resolver still lives in school.js. If an education-office
 * homepage blocks the server crawler, recover a same-origin-safe school mark
 * via the Edge proxy. The proxy gets the already-known NEIS school name so it
 * can prefer a real official-site emblem over a generic site favicon.
 */
function schoolLogoProfile() {
  try { return JSON.parse(localStorage.getItem(SCHOOL_PROFILE_KEY) || 'null'); }
  catch { return null; }
}

function schoolLogoHost(homepage) {
  const raw = String(homepage || '').trim();
  if (!raw) return '';
  try { return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function schoolLogoTargets() {
  return ['#schoolLogo','#schoolLogoSmall','#profileLogo']
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
}

function schoolLogoLoaded() {
  return schoolLogoTargets().some((img) => img.classList.contains('loaded') && img.naturalWidth >= 12 && img.naturalHeight >= 12);
}

function applySchoolLogo(url, source = 'fallback', score = 0) {
  if (!url) return false;
  const targets = schoolLogoTargets();
  if (!targets.length) return false;
  for (const img of targets) {
    img.src = url;
    img.dataset.logoSource = source;
    img.dataset.logoScore = String(score || 0);
    img.onload = () => img.classList.add('loaded');
    img.onerror = () => img.classList.remove('loaded');
  }
  return true;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('logo read failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchSchoolLogoData(homepage, schoolName) {
  const host = schoolLogoHost(homepage);
  if (!host) return null;
  try {
    const url = new URL(SCHOOL_LOGO_EDGE);
    url.searchParams.set('host', host);
    if (schoolName) url.searchParams.set('name', schoolName);
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok || response.status === 204) return null;
    const type = response.headers.get('content-type') || '';
    if (!type.toLowerCase().startsWith('image/')) return null;
    const blob = await response.blob();
    if (blob.size < 32 || blob.size > 500000) return null;
    const dataUrl = await blobToDataUrl(blob);
    if (!dataUrl.startsWith('data:image/')) return null;
    return {
      dataUrl,
      source: response.headers.get('x-flow-logo-source') || 'logo-proxy',
      score: Number(response.headers.get('x-flow-logo-score') || 0),
    };
  } catch { return null; }
}

async function recoverSchoolLogo({ force = false } = {}) {
  const profile = schoolLogoProfile();
  const school = profile?.school;
  if (!school?.schoolCode || !school?.homepage) return false;
  if (!force && schoolLogoLoaded()) return true;

  const cacheKey = `${SCHOOL_LOGO_CACHE_PREFIX}${school.schoolCode}`;
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (cached?.dataUrl?.startsWith('data:image/') && Date.now() - Number(cached.savedAt || 0) < 14 * 86400000) {
      return applySchoolLogo(cached.dataUrl, cached.source || 'cached-logo-proxy', cached.score || 0);
    }
  } catch {}

  const hit = await fetchSchoolLogoData(school.homepage, school.name || '');
  if (!hit) return false;
  try { localStorage.setItem(cacheKey, JSON.stringify({ ...hit, savedAt: Date.now() })); } catch {}
  return applySchoolLogo(hit.dataUrl, hit.source, hit.score);
}

function scheduleSchoolLogoRecovery() {
  for (const delay of [900, 3600]) {
    setTimeout(() => { if (!schoolLogoLoaded()) void recoverSchoolLogo(); }, delay);
  }
}

if (schoolLogoProfile()) scheduleSchoolLogoRecovery();

const telemetryEnabled = !['localhost','127.0.0.1','::1'].includes(location.hostname);
let anonId = localStorage.getItem(ANON_KEY);
if (!anonId) {
  anonId = crypto.randomUUID();
  localStorage.setItem(ANON_KEY, anonId);
}

function track(name) {
  if (!telemetryEnabled) return;
  fetch(EVENT_EDGE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({ event_name: `school_${name}`, anon_id: anonId }),
  }).catch(() => {});
}

track('page_view');
if (localStorage.getItem(SEEN_KEY)) track('return_visit');
else localStorage.setItem(SEEN_KEY, String(Date.now()));

let searchTimer = null;
for (const input of [schoolSearch, switchSearch].filter(Boolean)) {
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (input.value.trim().length >= 2) track('school_search');
    }, 700);
  }, { passive: true });
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-result-index]')) track('school_select');
  else if (event.target.closest?.('#setupSave')) track('setup_complete');
  else if (event.target.closest?.('[data-view]')) track('tab_view');
  else if (event.target.closest?.('#saveSubjectBtn')) track('subject_override');
  else if (event.target.closest?.('.dish[data-dish]')) track('meal_photo_search');
  else if (event.target.closest?.('.calendar-day[data-calendar-date]')) track('calendar_date_select');
  else if (event.target.closest?.('.national-event')) track('national_schedule_open');
  else if (event.target.closest?.('#shareTimetableBtn')) track('timetable_share');

  if (event.target.closest?.('[data-view="school"], [data-go-view="school"]')) {
    scheduleKakaoMapHydration();
    setTimeout(() => void recoverSchoolLogo(), 450);
  }
  if (event.target.closest?.('#setupSave')) setTimeout(scheduleSchoolLogoRecovery, 250);
}, { passive: true });
