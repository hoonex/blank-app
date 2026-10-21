// School's network datasets have different change rates and cache scopes.
// This module deliberately does not read DOM state, render views, or make requests.
export const SCHOOL_RESOURCE_KINDS = Object.freeze(['school', 'timetable', 'meals', 'events']);
export const SCHOOL_RESOURCE_TTL_MS = Object.freeze({
  school: 7 * 24 * 60 * 60 * 1000,
  timetable: 4 * 60 * 60 * 1000,
  meals: 24 * 60 * 60 * 1000,
  events: 24 * 60 * 60 * 1000,
});
const PREFIX = 'flow-school-resource-v1:';

function ymd(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
}
function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()));
  return d;
}
export function schoolResourceKey(profile, kind, date) {
  if (!SCHOOL_RESOURCE_KINDS.includes(kind)) throw new Error('Unknown school resource');
  const school = profile?.school;
  if (!school?.schoolCode || !school?.officeCode) return '';
  const base = `${school.officeCode}:${school.schoolCode}`;
  if (kind === 'school') return `${kind}:${base}`;
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) throw new Error('Invalid school resource date');
  if (kind === 'events') return `${kind}:${base}:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  if (kind === 'meals') return `${kind}:${base}:${ymd(weekStart(date))}`;
  return `${kind}:${base}:${profile.grade}:${profile.className}:${school.kind || ''}:${ymd(weekStart(date))}`;
}
export function validSchoolResource(kind, value) {
  if (!value || typeof value !== 'object') return false;
  switch (kind) {
    case 'school': return Object.prototype.hasOwnProperty.call(value, 'school');
    case 'timetable': return Array.isArray(value.timetable);
    case 'meals': return Array.isArray(value.meals);
    case 'events': return Array.isArray(value.events);
    default: return false;
  }
}
export function createSchoolResourceCache(storage, clock = () => Date.now()) {
  const memory = new Map();
  const keyFor = (profile, kind, date) => {
    const key = schoolResourceKey(profile, kind, date);
    return key ? PREFIX + key : '';
  };
  function record(profile, kind, date) {
    const key = keyFor(profile, kind, date);
    if (!key) return null;
    if (memory.has(key)) return memory.get(key);
    let entry = null;
    try { entry = JSON.parse(storage.getItem(key) || 'null'); } catch { /* no cache */ }
    if (!validSchoolResource(kind, entry?.payload) || !Number.isFinite(entry?.at)) return null;
    memory.set(key, entry);
    return entry;
  }
  function isFresh(profile, kind, date) {
    const entry = record(profile, kind, date);
    const age = clock() - (entry?.at || 0);
    return !!entry && age >= 0 && age < SCHOOL_RESOURCE_TTL_MS[kind];
  }
  function get(profile, kind, date, { allowStale = false } = {}) {
    const entry = record(profile, kind, date);
    return entry && (allowStale || isFresh(profile, kind, date)) ? entry.payload : null;
  }
  function put(profile, kind, date, payload, at = clock()) {
    if (!validSchoolResource(kind, payload)) throw new Error('Invalid ' + kind + ' payload');
    const key = keyFor(profile, kind, date);
    if (!key) return;
    const entry = { at, payload };
    memory.set(key, entry);
    try { storage.setItem(key, JSON.stringify(entry)); } catch { /* memory remains valid */ }
  }
  return { get, put, record, isFresh, clearMemory: () => memory.clear() };
}
