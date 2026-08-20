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

function bearer(req: Request) {
  const match = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
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
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function overview(hours: number) {
  const response = await adminFetch("/rest/v1/rpc/flow_admin_overview", {
    method: "POST",
    body: JSON.stringify({ p_hours: Math.max(1, Math.min(168, hours || 24)) }),
  });
  if (!response.ok) throw new Error(`overview ${response.status}`);
  return await response.json();
}

type Probe = { service: string; action: string; url: string };

async function saveProbe(result: { service: string; action: string; status: number; durationMs: number; ok: boolean }) {
  const response = await adminFetch("/rest/v1/flow_admin_probe_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      service: result.service,
      action: result.action,
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
    const response = await fetch(probe.url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    status = response.status;
  } catch {
    status = 599;
  }
  const result = {
    service: probe.service,
    action: probe.action,
    status,
    durationMs: Math.max(0, Math.round(performance.now() - started)),
    ok: status >= 200 && status < 400,
  };
  await saveProbe(result);
  return result;
}

async function probeServices() {
  const base = PROJECT_URL.replace(/\/$/, "");
  const probes: Probe[] = [
    {
      service: "school-data",
      action: "search",
      url: `${base}/functions/v1/school-data?action=search&q=${encodeURIComponent("정동고등학교")}`,
    },
    {
      service: "university-data",
      action: "search",
      url: `${base}/functions/v1/university-data?action=search&q=${encodeURIComponent("경북대학교")}`,
    },
    {
      service: "university-campus",
      action: "campus",
      url: `${base}/functions/v1/university-campus?action=campus&schoolName=${encodeURIComponent("경북대학교")}&address=${encodeURIComponent("대구광역시 북구 대학로 80")}`,
    },
  ];
  const results = [];
  for (const item of probes) results.push(await runProbe(item));
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!PROJECT_URL || !PUBLISHABLE_KEY || !SECRET_KEY) return json({ error: "admin backend unavailable" }, 503);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "overview";

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
      if (session.status < 200 || session.status >= 300 || !session.body?.access_token || session.body?.user?.id !== target.userId) {
        return json({ error: "invalid credentials" }, 401);
      }
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
