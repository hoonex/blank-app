// Flow V2 data contract. Everything in this module is pure or explicitly IO-bound.
export const EDGE = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data";
export const PROFILE_KEY = "flow-school-profile-v3";
export const THEME_KEY = "flow-school-theme-v3";
export const OVERRIDE_KEY = "flow-school-overrides-v2";
const CACHE_PREFIX = "flow-school-cache-v4:";
const CACHE_TTL = 12 * 60 * 60 * 1000;

export const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[ch]);
const pad = (value) => String(value).padStart(2, "0");
export function dateKey(date) {
  return String(date.getFullYear()) + pad(date.getMonth() + 1) + pad(date.getDate());
}
export function isoDate(date) {
  return String(date.getFullYear()) + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
export function fromKey(value) {
  if (!/^\d{8}$/.test(String(value))) return new Date(NaN);
  const date = new Date(+value.slice(0,4), +value.slice(4,6)-1, +value.slice(6,8), 12);
  return dateKey(date) === value ? date : new Date(NaN);
}
export function monday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekday = d.getDay();
  d.setDate(d.getDate() + (weekday === 0 ? -6 : 1 - weekday));
  return d;
}
export function addDays(date, count) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() + count);
  return d;
}
export function mondayDays(date) {
  const start = monday(date);
  return Array.from({ length: 5 }, (_, index) => addDays(start, index));
}
export function cacheKey(profile, date) {
  const code = String(profile.school.schoolCode);
  const month = String(date.getFullYear()) + "-" + pad(date.getMonth() + 1);
  return CACHE_PREFIX + [code,profile.grade,profile.className,dateKey(monday(date)),month,dateKey(date)].join(":");
}
export function subjectKey(profile, row) {
  const date = fromKey(row.date);
  return [profile.school.schoolCode, profile.grade, profile.className, date.getDay(), row.period].join(":");
}
export function getJSON(key, fallback = null) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function setJSON(key, value) {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
export function readProfile() {
  const current = getJSON(PROFILE_KEY) || getJSON("flow-school-profile-v2");
  if (!current || typeof current !== "object") return null;
  if (!current.school?.schoolCode || !current.school?.officeCode ||
      !current.grade || !current.className) return null;
  return current;
}
export function saveProfile(profile) {
  return setJSON(PROFILE_KEY, profile);
}
export function readTheme() {
  try { return globalThis.localStorage?.getItem(THEME_KEY) || "system"; }
  catch { return "system"; }
}
export function saveTheme(theme) {
  try { globalThis.localStorage?.setItem(THEME_KEY, theme); return true; }
  catch { return false; }
}
export function overrides() { return getJSON(OVERRIDE_KEY, {}) || {}; }
export function displaySubject(profile, row) {
  if (!row) return "—";
  return overrides()[subjectKey(profile,row)] || row.subject || (String(profile.school.kind || "").includes("고등") ? "선택과목" : "—");
}
export function updateSubject(profile, row, subject) {
  const map = overrides(), key = subjectKey(profile,row);
  const clean = String(subject || "").trim();
  if (!clean || clean === (row.subject || "")) delete map[key];
  else map[key] = clean;
  return setJSON(OVERRIDE_KEY, map);
}
export function safeUrl(value) {
  if (!value || typeof value !== "string") return "";
  try {
    const normalized = /^https?:\/\//i.test(value.trim()) ? value.trim() : "https://" + value.trim();
    const url = new URL(normalized);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch { return ""; }
}
export function gradeEventApplies(profile,event) {
  const grade = Number(profile.grade);
  const flags = [1,2,3,4,5,6].map(n => event["grade"+n]).filter(Boolean);
  if (!flags.length) return true;
  const selected = event["grade"+grade];
  if (selected === "Y") return true;
  if (selected === "N") return false;
  return flags.every(x => x !== "Y");
}
export async function api(params, signal) {
  const url = new URL(EDGE);
  for (const [name, value] of Object.entries(params)) if (value !== "" && value != null) url.searchParams.set(name,String(value));
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "데이터를 불러오지 못했습니다.");
  return body;
}
export function searchSchools(query, signal) {
  if (query.trim().length < 2) return Promise.resolve([]);
  return api({ action: "search", q: query.trim() },signal).then(body => body.schools || []);
}
export function getClasses(school, grade, signal) {
  return api({ action: "classes", office: school.officeCode, school: school.schoolCode, grade },signal)
    .then(body => body.classes || []);
}
export async function dashboard(profile, date, { force = false, signal } = {}) {
  const key = cacheKey(profile, date);
  const entry = getJSON(key);
  const age = Date.now() - Number(entry?.at || 0);
  if (!force && entry?.payload && age >= 0 && age < CACHE_TTL) {
    return { payload: entry.payload, stale: false, source: "cache" };
  }
  try {
    const payload = await api({
      action: "dashboard", office: profile.school.officeCode, school: profile.school.schoolCode,
      grade: profile.grade, class: profile.className, kind: profile.school.kind,
      date: dateKey(date)
    },signal);
    if (!Array.isArray(payload.timetable) || !Array.isArray(payload.meals) || !Array.isArray(payload.events)) {
      throw new Error("예상하지 못한 데이터 형식입니다.");
    }
    setJSON(key,{ at: Date.now(), payload });
    return { payload, stale: false, source: "network" };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (entry?.payload) return {
      payload: entry.payload, stale: true, source: "offline",
      warning: "연결이 불안정하여 저장된 정보를 표시합니다."
    };
    throw error;
  }
}
