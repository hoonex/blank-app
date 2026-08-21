import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function envJsonKey(name: string) {
  try {
    const value = JSON.parse(Deno.env.get(name) || "{}");
    return typeof value?.default === "string" ? value.default : "";
  } catch {
    return "";
  }
}

const PUBLISHABLE_KEY = envJsonKey("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const SECRET_KEY = envJsonKey("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

const API_INVENTORY = [
  { id: "neis", name: "NEIS 교육정보 API", group: "Runtime", type: "Public data API", via: "school-data", purpose: "학교정보 · 반 · 시간표 · 급식 · 학사일정", state: "configured" },
  { id: "kakao-rest", name: "Kakao REST APIs", group: "Runtime", type: "REST API", via: "school-data · university-campus · school-logo", purpose: "주소/장소 · 이미지 검색 · 보행 경로 · 정적 지도", state: "configured" },
  { id: "kakao-maps", name: "Kakao Maps JavaScript SDK", group: "Runtime", type: "Browser SDK", via: "university", purpose: "캠퍼스 지도 렌더링", state: "configured" },
  { id: "university-public", name: "대학 공시 공공데이터 API", group: "Runtime", type: "Public data API", via: "university-data", purpose: "대학 · 학과 · 등록금 · 장학금 · 기숙사 · 교육여건", state: "configured" },
  { id: "everytime", name: "Everytime 공개 시간표", group: "Runtime", type: "External API", via: "university-data", purpose: "공개 공유 시간표 import", state: "configured" },
  { id: "school-media", name: "학교 홈페이지 / Media", group: "Runtime", type: "External web", via: "school-data · school-logo", purpose: "학교 홈페이지 · 로고 · 대표 이미지 탐색", state: "configured" },
  { id: "google-favicon", name: "Google Site Favicon", group: "External", type: "Image fallback", via: "school-logo", purpose: "학교 로고 검색 실패 시 사이트 아이콘 fallback", state: "connected" },
  { id: "duckduckgo-icons", name: "DuckDuckGo Icons", group: "External", type: "Image fallback", via: "school-logo", purpose: "학교 로고 검색 실패 시 사이트 아이콘 fallback", state: "connected" },
  { id: "supabase-auth", name: "Supabase Auth", group: "Infrastructure", type: "Auth", via: "Flow accounts · Admin", purpose: "사용자/관리자 인증과 세션", state: "healthy" },
  { id: "supabase-db", name: "Supabase Postgres / PostgREST", group: "Infrastructure", type: "Database API", via: "Flow backend", purpose: "프로필 · 이벤트 · 관리자 집계 · 설정", state: "healthy" },
  { id: "supabase-edge", name: "Supabase Edge Functions", group: "Infrastructure", type: "Serverless", via: "8 active functions", purpose: "flow-site · flow-quest-event · quest-session · school-data · university-data · university-campus · school-logo · flow-admin", state: "healthy" },
  { id: "github-api", name: "GitHub API", group: "Operations", type: "Repository API", via: "hoonex/blank-app", purpose: "소스 · commit · branch · PR 관리", state: "connected" },
  { id: "github-actions", name: "GitHub Actions", group: "Operations", type: "CI/CD", via: ".github/workflows", purpose: "브라우저 회귀 테스트 · 검증 · 배포 작업", state: "connected" },
  { id: "vercel-rest", name: "Vercel REST API", group: "Operations", type: "Deployment API", via: "vercel-rest-deploy", purpose: "Flow production 배포 · route health", state: "connected" },
  { id: "google-fonts", name: "Google Fonts", group: "External", type: "CDN", via: "Flow UI", purpose: "Inter · Noto Sans KR 웹폰트", state: "connected" },
];

function bearer(req: Request) {
  return (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

async function verifyUser(req: Request) {
  const token = bearer(req);
  if (!token || !PROJECT_URL || !PUBLISHABLE_KEY) return null;
  const response = await fetch(`${PROJECT_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(7000),
  }).catch(() => null);
  if (!response?.ok) return null;
  const user = await response.json().catch(() => null);
  return user?.id ? user : null;
}

async function adminFetch(path: string, init: RequestInit = {}) {
  if (!PROJECT_URL || !SECRET_KEY) throw new Error("admin backend is not configured");
  const headers = new Headers(init.headers || {});
  headers.set("apikey", SECRET_KEY);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${PROJECT_URL}${path}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(9000) });
}

async function isAdmin(userId: string) {
  const response = await adminFetch(`/rest/v1/flow_admins?user_id=eq.${encodeURIComponent(userId)}&select=user_id&limit=1`);
  if (!response.ok) throw new Error(`admin lookup ${response.status}`);
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function adminLoginTarget(loginName: string) {
  const normalized = loginName.trim().toLowerCase();
  if (!normalized) return null;
  const response = await adminFetch(`/rest/v1/flow_admins?login_name=eq.${encodeURIComponent(normalized)}&select=user_id,login_name&limit=1`);
  if (!response.ok) throw new Error(`admin login lookup ${response.status}`);
  const rows = await response.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.user_id) return null;
  const userResponse = await fetch(`${PROJECT_URL}/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`, {
    headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}` },
    signal: AbortSignal.timeout(7000),
  }).catch(() => null);
  if (!userResponse?.ok) throw new Error(`admin user lookup ${userResponse?.status || 599}`);
  const user = await userResponse.json().catch(() => null);
  if (!user?.email) return null;
  return { userId: row.user_id as string, loginName: String(row.login_name || normalized), email: String(user.email) };
}

async function passwordSession(email: string, password: string) {
  const response = await fetch(`${PROJECT_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(9000),
  }).catch(() => null);
  if (!response) return { status: 599, body: null as any };
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function bootstrapPassword(token: string, password: string) {
  if (token.length < 32 || token.length > 256 || password.length < 10 || password.length > 128) return { status: 400, body: { error: "invalid setup request" } };
  const tokenHash = await sha256Hex(token);
  const lookup = await adminFetch(`/rest/v1/flow_admin_bootstrap_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}&select=token_hash,user_id,expires_at,used_at&limit=1`);
  if (!lookup.ok) throw new Error(`bootstrap lookup ${lookup.status}`);
  const rows = await lookup.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.user_id || row.used_at || !row.expires_at || new Date(row.expires_at).getTime() <= Date.now()) return { status: 410, body: { error: "setup link expired" } };
  const updateUser = await fetch(`${PROJECT_URL}/auth/v1/admin/users/${encodeURIComponent(row.user_id)}`, {
    method: "PUT",
    headers: { apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ password }),
    signal: AbortSignal.timeout(9000),
  }).catch(() => null);
  if (!updateUser?.ok) throw new Error(`bootstrap user update ${updateUser?.status || 599}`);
  const consume = await adminFetch(`/rest/v1/flow_admin_bootstrap_tokens?token_hash=eq.${encodeURIComponent(tokenHash)}&used_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  });
  if (!consume.ok) throw new Error(`bootstrap consume ${consume.status}`);
  return { status: 200, body: { ok: true, loginName: "flowadmin" } };
}

async function overview(hours: number) {
  const response = await adminFetch("/rest/v1/rpc/flow_admin_overview", {
    method: "POST",
    body: JSON.stringify({ p_hours: Math.max(1, Math.min(168, hours || 24)) }),
  });
  if (!response.ok) throw new Error(`overview ${response.status}`);
  const data = await response.json();
  return { ...data, inventory: API_INVENTORY };
}

type Probe = {
  service: string;
  action: string;
  kind: "deep" | "reachability";
  url: string;
  method?: "GET" | "OPTIONS";
  headers?: Record<string, string>;
};

type ProbeResult = {
  service: string;
  action: string;
  kind: "deep" | "reachability";
  status: number;
  durationMs: number;
  ok: boolean;
};

async function saveProbe(result: ProbeResult) {
  const response = await adminFetch("/rest/v1/flow_admin_probe_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      service: result.service,
      action: result.action,
      probe_kind: result.kind,
      status: result.status,
      duration_ms: result.durationMs,
      ok: result.ok,
    }),
  });
  if (!response.ok) console.warn("admin probe log failed", response.status);
}

async function runProbe(probe: Probe) {
  const started = performance.now();
  let status = 599;
  try {
    const response = await fetch(probe.url, {
      method: probe.method || "GET",
      headers: probe.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(probe.kind === "deep" ? 12000 : 6000),
    });
    status = response.status;
  } catch {
    status = 599;
  }
  const ok = probe.kind === "deep" ? status >= 200 && status < 400 : status > 0 && status < 500;
  const result: ProbeResult = {
    service: probe.service,
    action: probe.action,
    kind: probe.kind,
    status,
    durationMs: Math.max(0, Math.round(performance.now() - started)),
    ok,
  };
  await saveProbe(result);
  return result;
}

async function runProbeBatch(probes: Probe[]) {
  return await Promise.all(probes.map((probe) => runProbe(probe)));
}

async function probeServices() {
  const base = PROJECT_URL.replace(/\/$/, "");
  const edge = (name: string) => `${base}/functions/v1/${name}`;
  const probes: Probe[] = [
    { service: "school-data", action: "search", kind: "deep", url: `${edge("school-data")}?action=search&q=${encodeURIComponent("정동고등학교")}` },
    { service: "university-data", action: "search", kind: "deep", url: `${edge("university-data")}?action=search&q=${encodeURIComponent("경북대학교")}` },
    { service: "university-campus", action: "campus", kind: "deep", url: `${edge("university-campus")}?action=campus&schoolName=${encodeURIComponent("경북대학교")}&address=${encodeURIComponent("대구광역시 북구 대학로 80")}` },
    { service: "flow-site", action: "edge", kind: "reachability", url: edge("flow-site"), method: "OPTIONS" },
    { service: "flow-quest-event", action: "edge", kind: "reachability", url: edge("flow-quest-event"), method: "OPTIONS" },
    { service: "quest-session", action: "edge", kind: "reachability", url: edge("quest-session"), method: "OPTIONS" },
    { service: "school-logo", action: "edge", kind: "reachability", url: edge("school-logo"), method: "OPTIONS" },
    { service: "flow-admin", action: "edge", kind: "reachability", url: edge("flow-admin"), method: "OPTIONS" },
    { service: "supabase-auth", action: "health", kind: "reachability", url: `${base}/auth/v1/health`, headers: { apikey: PUBLISHABLE_KEY } },
    { service: "supabase-rest", action: "gateway", kind: "reachability", url: `${base}/rest/v1/`, headers: { apikey: PUBLISHABLE_KEY } },
  ];
  const deep = probes.filter((item) => item.kind === "deep");
  const reachability = probes.filter((item) => item.kind === "reachability");
  const results: ProbeResult[] = [];
  results.push(...await runProbeBatch(deep));
  results.push(...await runProbeBatch(reachability));
  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!PROJECT_URL || !PUBLISHABLE_KEY || !SECRET_KEY) return json({ error: "admin backend unavailable" }, 503);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

  if (action === "bootstrap-password") {
    if (req.method !== "POST") return json({ error: "POST required" }, 405);
    const body = await req.json().catch(() => ({}));
    try {
      const result = await bootstrapPassword(String(body?.token || ""), String(body?.password || ""));
      return json(result.body, result.status);
    } catch (error) {
      console.error("flow-admin bootstrap", error instanceof Error ? error.message : String(error));
      return json({ error: "password setup unavailable" }, 502);
    }
  }

  if (action === "login") {
    if (req.method !== "POST") return json({ error: "POST required" }, 405);
    const body = await req.json().catch(() => ({}));
    const username = String(body?.username || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!username || !password || username.length > 64 || password.length > 256) return json({ error: "invalid credentials" }, 401);
    try {
      const target = await adminLoginTarget(username);
      if (!target) return json({ error: "invalid credentials" }, 401);
      const session = await passwordSession(target.email, password);
      if (session.status === 429) return json({ error: "too many login attempts" }, 429);
      if (session.status < 200 || session.status >= 300 || !session.body?.access_token || session.body?.user?.id !== target.userId) return json({ error: "invalid credentials" }, 401);
      return json({ ...session.body, admin: { loginName: target.loginName } });
    } catch (error) {
      console.error("flow-admin login", error instanceof Error ? error.message : String(error));
      return json({ error: "admin login unavailable" }, 502);
    }
  }

  const user = await verifyUser(req);
  if (!user) return json({ error: "authentication required" }, 401);

  try {
    if (!(await isAdmin(user.id))) return json({ error: "admin access denied" }, 403);
    if (action === "overview") {
      const hours = Number(url.searchParams.get("hours") || 24);
      return json({ admin: { id: user.id, loginName: "flowadmin" }, overview: await overview(hours) });
    }
    if (action === "probe") {
      if (req.method !== "POST") return json({ error: "POST required" }, 405);
      const results = await probeServices();
      return json({ results, overview: await overview(24) });
    }
    return json({ error: "unknown action" }, 404);
  } catch (error) {
    console.error("flow-admin", error instanceof Error ? error.message : String(error));
    return json({ error: "admin request failed" }, 502);
  }
});
