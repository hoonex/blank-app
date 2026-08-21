import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const API = "https://apis.data.go.kr/B340014";
const YEARS = ["2025", "2024", "2023"];
const COMMON_DATA_KEY = Deno.env.get("UNIVERSITY_DATA_KEY") || "";
const SERVICE_KEYS: Record<string, string> = {
  SchoolInfoService: Deno.env.get("UNIVERSITY_SCHOOL_INFO_KEY") || COMMON_DATA_KEY,
  SchoolMajorInfoService: Deno.env.get("UNIVERSITY_MAJOR_INFO_KEY") || COMMON_DATA_KEY,
  FinancesService: Deno.env.get("UNIVERSITY_FINANCES_KEY") || COMMON_DATA_KEY,
  EducationConditionService: Deno.env.get("UNIVERSITY_EDUCATION_CONDITION_KEY") || COMMON_DATA_KEY,
};
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300"
};
const reply = (body: unknown, status = 200, cache = "public, max-age=300") =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Cache-Control": cache } });

function serviceKey(service: string) {
  const key = SERVICE_KEYS[service] || COMMON_DATA_KEY;
  if (!key) throw new Error(`missing public-data credential for ${service}`);
  return /%[0-9a-f]{2}/i.test(key) ? key : encodeURIComponent(key);
}
function decodeXml(s = "") {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}
function tag(xml: string, name: string) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? decodeXml(m[1]) : "";
}
function attr(text: string, name: string) {
  const m = text.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return m ? decodeXml(m[1]) : "";
}
function parseItems(xml: string) {
  const out: Record<string,string>[] = [];
  for (const m of xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
    const row: Record<string,string> = {};
    for (const f of m[1].matchAll(/<([A-Za-z0-9_]+)[^>]*>([\s\S]*?)<\/\1>/g)) row[f[1]] = decodeXml(f[2]);
    if (Object.keys(row).length) out.push(row);
  }
  return out;
}
async function call(service: string, operation: string, params: Record<string,string> = {}) {
  const q = new URLSearchParams({ pageNo: "1", numOfRows: "1000", ...params });
  const url = `${API}/${service}/${operation}?serviceKey=${serviceKey(service)}&${q.toString()}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { accept: "application/xml,text/xml,*/*" } });
  const xml = await r.text();
  if (!r.ok) throw new Error(`${service} ${r.status}`);
  const code = tag(xml, "resultCode"), msg = tag(xml, "resultMsg");
  if (code && code !== "00") throw new Error(msg || code);
  return { items: parseItems(xml), total: Number(tag(xml, "totalCount") || 0) };
}
async function withYear(service: string, operation: string, params: Record<string,string>) {
  for (const year of YEARS) {
    const r = await call(service, operation, { ...params, svyYr: year });
    if (r.items.length) return { year, ...r };
  }
  return { year: null as string|null, items: [] as Record<string,string>[], total: 0 };
}
function norm(s = "") { return s.replace(/\s+/g, "").toLowerCase(); }
function homepage(v = "") { return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v; }
function mapSchool(r: Record<string,string>) {
  return {
    id: r.schlId || "", name: r.schlNm || "", englishName: r.schlEngNm || "",
    kind: r.schlKndNm || "", division: r.schlDivNm || "", foundation: r.schlEstbDivNm || "",
    founded: r.schlEstbDt || "", campus: r.psbsDivNm || "", region: r.pbnfAreaNm || "",
    address: r.postNoAdrs || "", postalCode: r.postNo || "", phone: r.schlRepTpNoCtnt || "",
    fax: r.schlRepFxNoCtnt || "", homepage: homepage(r.schlUrlAdrs || ""), surveyYear: r.svyYr || ""
  };
}
function mapMajor(r: Record<string,string>) {
  return {
    id: r.kediMjrId || r.stdClftMjrId || `${r.clgNm}|${r.korMjrNm}`,
    name: r.korMjrNm || "", college: r.clgNm || "", degree: r.pbnfDgriCrseDivNm || "",
    duration: r.lsnTrmNm || "", category: r.onsfSrsClftNm || "", dayNight: r.dghtDivNm || "",
    admission: Number(r.eschlPscpNum || 0), graduates: Number(r.grdtNum || 0),
    status: r.schlMjrStatNm || "", characteristic: r.schlMjrCharNm || "",
    courses: (r.edcCrseLtrCtnt || "").split("|").map(x => x.trim()).filter(Boolean),
    careers: (r.pwayEmplLtrCtnt || "").split("|").map(x => x.trim()).filter(Boolean)
  };
}
async function metric(service: string, operation: string, id: string) {
  const r = await withYear(service, operation, { schlId: id });
  const row = r.items[0];
  return row ? { year: r.year, value: Number(row.indctVal1 || 0), indicatorId: row.indctId || "" } : null;
}
async function schoolById(id: string, name: string) {
  const r = await withYear("SchoolInfoService", "getSchoolInfo", { schlId: id, schlKrnNm: name });
  const exact = r.items.find(x => x.schlId === id) || r.items[0];
  return exact ? mapSchool(exact) : null;
}
async function optionalProfilePart<T>(label: string, task: () => Promise<T>) {
  try {
    return { label, value: await task(), unavailable: false };
  } catch (e) {
    console.warn(`profile partial: ${label}: ${e instanceof Error ? e.message : String(e)}`);
    return { label, value: null as T|null, unavailable: true };
  }
}
function minuteText(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function everytimeIdentifier(raw: string) {
  const value = raw.trim();
  const direct = value.match(/^[A-Za-z0-9_-]{8,80}$/)?.[0];
  if (direct) return direct;
  try {
    const u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!/(^|\.)everytime\.kr$/i.test(u.hostname)) return "";
    return u.pathname.match(/^\/@([A-Za-z0-9_-]{8,80})\/?$/)?.[1] || "";
  } catch { return ""; }
}
function parseEverytime(xml: string, identifier: string) {
  const tableOpen = xml.match(/<table\b([^>]*)>/i)?.[1] || "";
  const userOpen = xml.match(/<user\b([^>]*)\/?\s*>/i)?.[1] || "";
  const subjects: any[] = [];
  for (const sm of xml.matchAll(/<subject\b([^>]*)>([\s\S]*?)<\/subject>/gi)) {
    const id = attr(sm[1], "id"), body = sm[2];
    const prop = (name: string) => attr(body.match(new RegExp(`<${name}\\b([^>]*)\\/?\\s*>`, "i"))?.[1] || "", "value");
    const timeBody = body.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i)?.[1] || "";
    const times = [...timeBody.matchAll(/<data\b([^>]*)\/?\s*>/gi)].map(dm => {
      const day = Number(attr(dm[1], "day")), startUnit = Number(attr(dm[1], "starttime")), endUnit = Number(attr(dm[1], "endtime"));
      const startMinutes = startUnit * 5, endMinutes = endUnit * 5;
      return { day, startMinutes, endMinutes, start: minuteText(startMinutes), end: minuteText(endMinutes), place: attr(dm[1], "place") };
    }).filter(x => Number.isFinite(x.day) && Number.isFinite(x.startMinutes) && Number.isFinite(x.endMinutes));
    subjects.push({
      id, internal: prop("internal"), name: prop("name"), professor: prop("professor"),
      timeLabel: prop("time"), place: prop("place"), credit: Number(prop("credit") || 0),
      custom: id.startsWith("-") || !prop("internal"), times
    });
  }
  return {
    source: "everytime-public-share", identifier,
    ownerName: attr(userOpen, "name"),
    year: Number(attr(tableOpen, "year") || 0), semester: attr(tableOpen, "semester"),
    subjects, importedAt: new Date().toISOString()
  };
}
async function importEverytime(raw: string) {
  const identifier = everytimeIdentifier(raw);
  if (!identifier) throw new Error("올바른 에브리타임 공유 링크를 입력하세요.");
  const form = new URLSearchParams({ identifier, friendInfo: "true" });
  const r = await fetch("https://api.everytime.kr/find/timetable/table/friend", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "user-agent": "Mozilla/5.0 Flow University" },
    body: form.toString(), signal: AbortSignal.timeout(12000)
  });
  const xml = await r.text();
  if (!r.ok) throw new Error(`에브리타임 ${r.status}`);
  if (!/<table\b/i.test(xml)) throw new Error("공유 시간표를 불러오지 못했습니다. 링크 공개 상태를 확인하세요.");
  const parsed = parseEverytime(xml, identifier);
  if (!parsed.subjects.length) throw new Error("공유 시간표에 가져올 항목이 없습니다.");
  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const u = new URL(req.url), action = u.searchParams.get("action") || "search";
  try {
    if (action === "search") {
      const q = (u.searchParams.get("q") || "").trim();
      if (q.length < 2) return reply({ error: "대학명을 2자 이상 입력하세요." }, 400);
      const includeGraduate = u.searchParams.get("graduate") === "1";
      const r = await withYear("SchoolInfoService", "getSchoolInfo", { schlKrnNm: q });
      const seen = new Set<string>();
      const schools = r.items.map(mapSchool).filter(s => {
        if (!norm(s.name).includes(norm(q))) return false;
        if (!includeGraduate && s.division !== "대학") return false;
        const key = `${s.id}|${s.campus}|${s.address}`;
        if (seen.has(key)) return false; seen.add(key); return true;
      }).sort((a,b) => Number(norm(a.name) !== norm(q)) - Number(norm(b.name) !== norm(q)) || a.name.localeCompare(b.name, "ko"));
      return reply({ surveyYear: r.year, total: schools.length, schools });
    }
    if (action === "majors") {
      const id = (u.searchParams.get("id") || "").trim(), name = (u.searchParams.get("name") || "").trim();
      const q = norm(u.searchParams.get("q") || "");
      if (!id || !name) return reply({ error: "대학 정보가 필요합니다." }, 400);
      const r = await withYear("SchoolMajorInfoService", "getSchoolMajorInfo", { schlId: id, schlKrnNm: name });
      const seen = new Set<string>();
      const majors = r.items.filter(x => x.pbnfDgriCrseDivNm === "학사").map(mapMajor).filter(m => {
        if (q && !norm(`${m.college}${m.name}${m.category}`).includes(q)) return false;
        const key = `${m.college}|${m.name}|${m.degree}`; if (seen.has(key)) return false; seen.add(key); return true;
      }).sort((a,b) => a.college.localeCompare(b.college,"ko") || a.name.localeCompare(b.name,"ko"));
      return reply({ surveyYear: r.year, total: majors.length, majors }, 200, "public, max-age=1800");
    }
    if (action === "profile") {
      const id = (u.searchParams.get("id") || "").trim(), name = (u.searchParams.get("name") || "").trim();
      if (!id || !name) return reply({ error: "대학 정보가 필요합니다." }, 400);
      const [schoolPart, tuitionPart, scholarshipPart, dormitoryPart, libraryPart] = await Promise.all([
        optionalProfilePart("school", () => schoolById(id, name)),
        optionalProfilePart("tuition", () => metric("FinancesService", "getComparisonTuitionCrntSt", id)),
        optionalProfilePart("scholarship", () => metric("FinancesService", "getComparisonScholarshipBenefitCrntSt", id)),
        optionalProfilePart("dormitory", () => metric("EducationConditionService", "getComparisonDormitoryAcceptanceCrntSt", id)),
        optionalProfilePart("library", () => metric("EducationConditionService", "getComparisonLibraryBudgetCrntSt", id)),
      ]);
      const parts = [schoolPart, tuitionPart, scholarshipPart, dormitoryPart, libraryPart];
      const unavailable = parts.filter(x => x.unavailable).map(x => x.label);
      return reply({
        school: schoolPart.value,
        metrics: {
          tuition: tuitionPart.value,
          scholarship: scholarshipPart.value,
          dormitory: dormitoryPart.value,
          library: libraryPart.value,
        },
        partial: unavailable.length > 0,
        unavailable,
      }, 200, unavailable.length ? "public, max-age=120" : "public, max-age=1800");
    }
    if (action === "import-everytime") {
      let raw = u.searchParams.get("url") || "";
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({})); raw = String(body?.url || raw);
      }
      const timetable = await importEverytime(raw);
      return reply({ timetable }, 200, "no-store");
    }
    return reply({ error: "unknown action" }, 404);
  } catch (e) {
    console.error(e);
    return reply({ error: e instanceof Error ? e.message : "대학 데이터를 불러오지 못했습니다." }, 502, "no-store");
  }
});
