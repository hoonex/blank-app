import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORE_URL = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-data-core";
const RAIL_URL = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-rail";
const KAKAO_KEYWORD = "https://dapi.kakao.com/v2/local/search/keyword.json";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUS_ASSIST_MIN_WALK_METERS = 550;
const MAX_RAIL_CANDIDATES = 2;
const MAX_BUS_OPTIONS_PER_SIDE = 2;
const MAX_MIXED_ROUTES = 5;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

type Segment = {
  type: "walk" | "bus" | "subway";
  minutes: number;
  distance: number;
  stationCount: number;
  startName: string;
  endName: string;
  startId: string;
  endId: string;
  lines: string[];
  direction: string;
};

type LiveArrival = {
  routeNo: string;
  seconds: number;
  stops: number;
  vehicleType?: string;
  arrivalMinutes: number;
  waitAddedMinutes: number;
  source: string;
  checkedAt: string;
  stopName: string;
  legIndex: number;
};

type Route = {
  id: string;
  pathType: number;
  baselineMinutes: number;
  totalMinutes: number;
  walkMeters: number;
  payment: number;
  transfers: number;
  stationCount: number;
  segments: Segment[];
  realtime: LiveArrival | null;
  realtimeLegs: LiveArrival[];
  arrivalAt: string;
  badges: string[];
  estimateMode?: string;
  mixedMode?: string;
};

type StationPoint = { name: string; x: number; y: number };

function reply(body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Cache-Control": cache } });
}

function finite(value: string | null, min: number, max: number) {
  if (value === null || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

async function jsonFetch(url: URL, init: RequestInit = {}, timeout = 80_000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function normalizeStationName(value = "") {
  return value
    .replace(/대구(?:도시철도|지하철)?\s*[123]호선/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/역$/g, "")
    .replace(/[\s·._\-]/g, "")
    .toLowerCase();
}

async function stationPoint(name: string, nearX: number, nearY: number): Promise<StationPoint | null> {
  if (!KAKAO_REST_KEY) return null;
  const clean = String(name || "").replace(/\([^)]*\)/g, "").replace(/역$/g, "").trim();
  if (!clean) return null;
  const url = new URL(KAKAO_KEYWORD);
  url.searchParams.set("query", `대구 ${clean}역`);
  url.searchParams.set("category_group_code", "SW8");
  url.searchParams.set("x", String(nearX));
  url.searchParams.set("y", String(nearY));
  url.searchParams.set("radius", "20000");
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", "8");
  const { response, body } = await jsonFetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }, 10_000);
  if (!response.ok) return null;
  const target = normalizeStationName(clean);
  const docs = Array.isArray(body?.documents) ? body.documents : [];
  const doc = docs.find((item: any) => {
    const candidate = normalizeStationName(String(item?.place_name || ""));
    return candidate === target || candidate.startsWith(target) || target.startsWith(candidate);
  }) || docs[0];
  const x = Number(doc?.x), y = Number(doc?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { name, x, y } : null;
}

async function railRoutes(sx: number, sy: number, ex: number, ey: number): Promise<{ routes: Route[]; snapshotDate?: string } | null> {
  const url = new URL(RAIL_URL);
  url.searchParams.set("action", "route");
  url.searchParams.set("sx", String(sx));
  url.searchParams.set("sy", String(sy));
  url.searchParams.set("ex", String(ex));
  url.searchParams.set("ey", String(ey));
  const { response, body } = await jsonFetch(url, {}, 30_000);
  if (!response.ok) return null;
  return { routes: Array.isArray(body?.routes) ? body.routes : [], snapshotDate: body?.snapshotDate };
}

async function busRoutes(sx: number, sy: number, ex: number, ey: number): Promise<Route[]> {
  if (!SUPABASE_SERVICE_ROLE_KEY) return [];
  const url = new URL(CORE_URL);
  url.searchParams.set("action", "route");
  url.searchParams.set("sx", String(sx));
  url.searchParams.set("sy", String(sy));
  url.searchParams.set("ex", String(ex));
  url.searchParams.set("ey", String(ey));
  const { response, body } = await jsonFetch(url, { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }, 80_000);
  if (!response.ok) return [];
  return Array.isArray(body?.routes) ? body.routes : [];
}

function firstWalk(route: Route) {
  return route.segments.find((segment) => segment.type === "walk") || null;
}

function lastWalk(route: Route) {
  return [...route.segments].reverse().find((segment) => segment.type === "walk") || null;
}

function transitSignature(route: Route) {
  return route.segments
    .filter((segment) => segment.type === "bus" || segment.type === "subway")
    .map((segment) => `${segment.type}:${segment.lines.join(",")}:${segment.startId || segment.startName}:${segment.endId || segment.endName}`)
    .join("|");
}

function routeSort(a: Route, b: Route) {
  return a.totalMinutes - b.totalMinutes || a.transfers - b.transfers || a.walkMeters - b.walkMeters;
}

function cloneSegments(segments: Segment[]) {
  return segments.map((segment) => ({ ...segment, lines: [...(segment.lines || [])] }));
}

function accessSegments(route: Route, stationName: string) {
  const segments = cloneSegments(route.segments);
  const last = [...segments].reverse().find((segment) => segment.type === "walk");
  if (last) last.endName = stationName;
  return segments;
}

function egressSegments(route: Route, stationName: string) {
  const segments = cloneSegments(route.segments);
  const first = segments.find((segment) => segment.type === "walk");
  if (first) first.startName = stationName;
  const last = [...segments].reverse().find((segment) => segment.type === "walk");
  if (last) last.endName = "목적지";
  return segments;
}

function offsetRealtime(legs: LiveArrival[] = [], offset = 0) {
  return legs.map((live, index) => ({ ...live, legIndex: Math.max(0, offset + Number(live?.legIndex ?? index)) }));
}

function composeMixed(
  rail: Route,
  access: Route | null,
  egress: Route | null,
  accessName: string,
  egressName: string,
  railSnapshotDate = "",
): Route | null {
  if (!access && !egress) return null;
  const railFirstWalk = firstWalk(rail), railLastWalk = lastWalk(rail);
  const subwaySegments = cloneSegments(rail.segments.filter((segment) => segment.type === "subway"));
  if (!subwaySegments.length) return null;

  const accessPart = access ? accessSegments(access, accessName) : railFirstWalk ? [{ ...railFirstWalk, lines: [...(railFirstWalk.lines || [])] }] : [];
  const egressPart = egress ? egressSegments(egress, egressName) : railLastWalk ? [{ ...railLastWalk, lines: [...(railLastWalk.lines || [])] }] : [];
  const railBoundaryMinutes = Number(railFirstWalk?.minutes || 0) + Number(railLastWalk?.minutes || 0);
  const railCoreMinutes = Math.max(1, Number(rail.totalMinutes || 0) - railBoundaryMinutes);
  const railBaselineCore = Math.max(1, Number(rail.baselineMinutes || rail.totalMinutes || 0) - railBoundaryMinutes);
  const accessMinutes = access ? Number(access.totalMinutes || 0) : Number(railFirstWalk?.minutes || 0);
  const accessBaseline = access ? Number(access.baselineMinutes || access.totalMinutes || 0) : Number(railFirstWalk?.minutes || 0);
  const egressMinutes = egress ? Number(egress.totalMinutes || 0) : Number(railLastWalk?.minutes || 0);
  const egressBaseline = egress ? Number(egress.baselineMinutes || egress.totalMinutes || 0) : Number(railLastWalk?.minutes || 0);
  const accessWalk = access ? Number(access.walkMeters || 0) : Number(railFirstWalk?.distance || 0);
  const egressWalk = egress ? Number(egress.walkMeters || 0) : Number(railLastWalk?.distance || 0);
  const totalMinutes = Math.max(1, Math.round(accessMinutes + railCoreMinutes + egressMinutes));
  const baselineMinutes = Math.max(1, Math.round(accessBaseline + railBaselineCore + egressBaseline));
  const accessLive = offsetRealtime(access?.realtimeLegs || (access?.realtime ? [access.realtime] : []), 0);
  const egressOffset = Math.max(1, accessLive.length + subwaySegments.length);
  const egressLive = offsetRealtime(egress?.realtimeLegs || (egress?.realtime ? [egress.realtime] : []), egressOffset);
  const realtimeLegs = [...accessLive, ...egressLive];
  const mode = access && egress ? "bus-subway-bus" : access ? "bus-subway-walk" : "walk-subway-bus";

  return {
    id: "",
    pathType: 4,
    baselineMinutes,
    totalMinutes,
    walkMeters: Math.round(accessWalk + egressWalk),
    payment: Number(access?.payment || 0) + Number(rail.payment || 0) + Number(egress?.payment || 0),
    transfers: Number(access?.transfers || 0) + Number(rail.transfers || 0) + Number(egress?.transfers || 0) + (access ? 1 : 0) + (egress ? 1 : 0),
    stationCount: Number(access?.stationCount || 0) + Number(rail.stationCount || 0) + Number(egress?.stationCount || 0),
    segments: [...accessPart, ...subwaySegments, ...egressPart],
    realtime: realtimeLegs[0] || null,
    realtimeLegs,
    arrivalAt: new Date(Date.now() + totalMinutes * 60_000).toISOString(),
    badges: [],
    estimateMode: railSnapshotDate ? `mixed-static-rail-${railSnapshotDate}` : "mixed-static-rail",
    mixedMode: mode,
  };
}

async function buildForRail(rail: Route, sx: number, sy: number, ex: number, ey: number, snapshotDate = "") {
  const subway = rail.segments.filter((segment) => segment.type === "subway");
  if (!subway.length) return [];
  const accessName = subway[0].startName;
  const egressName = subway.at(-1)!.endName;
  const accessPoint = await stationPoint(accessName, sx, sy);
  const egressPoint = await stationPoint(egressName, ex, ey);
  if (!accessPoint || !egressPoint) return [];

  const railAccessWalk = Number(firstWalk(rail)?.distance || 0);
  const railEgressWalk = Number(lastWalk(rail)?.distance || 0);
  const needAccessBus = railAccessWalk >= BUS_ASSIST_MIN_WALK_METERS;
  const needEgressBus = railEgressWalk >= BUS_ASSIST_MIN_WALK_METERS;
  if (!needAccessBus && !needEgressBus) return [];

  const [accessRoutes, egressRoutes] = await Promise.all([
    needAccessBus ? busRoutes(sx, sy, accessPoint.x, accessPoint.y) : Promise.resolve([]),
    needEgressBus ? busRoutes(egressPoint.x, egressPoint.y, ex, ey) : Promise.resolve([]),
  ]);
  const accessOptions: Array<Route | null> = needAccessBus && accessRoutes.length ? accessRoutes.slice(0, MAX_BUS_OPTIONS_PER_SIDE) : [null];
  const egressOptions: Array<Route | null> = needEgressBus && egressRoutes.length ? egressRoutes.slice(0, MAX_BUS_OPTIONS_PER_SIDE) : [null];
  if (!accessRoutes.length) accessOptions.push(null);
  if (!egressRoutes.length) egressOptions.push(null);

  const routes: Route[] = [];
  const seen = new Set<string>();
  for (const access of accessOptions) for (const egress of egressOptions) {
    const route = composeMixed(rail, access, egress, accessName, egressName, snapshotDate);
    if (!route) continue;
    const signature = transitSignature(route);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    routes.push(route);
  }
  return routes.sort(routeSort);
}

async function searchMixed(sx: number, sy: number, ex: number, ey: number) {
  const rail = await railRoutes(sx, sy, ex, ey);
  if (!rail?.routes?.length) return { routes: [] as Route[], snapshotDate: rail?.snapshotDate || null };
  const candidates: Route[] = [];
  for (const route of rail.routes.slice(0, MAX_RAIL_CANDIDATES)) {
    candidates.push(...await buildForRail(route, sx, sy, ex, ey, rail.snapshotDate || ""));
    if (candidates.length >= MAX_MIXED_ROUTES) break;
  }
  const deduped = new Map<string, Route>();
  for (const route of candidates) {
    const key = transitSignature(route);
    const previous = deduped.get(key);
    if (!previous || routeSort(route, previous) < 0) deduped.set(key, route);
  }
  const routes = [...deduped.values()].sort(routeSort).slice(0, MAX_MIXED_ROUTES);
  routes.forEach((route, index) => { route.id = `mixed-${index + 1}`; });
  return { routes, snapshotDate: rail.snapshotDate || null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return reply({ error: "GET 요청만 지원합니다." }, 405);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "route";
  try {
    if (action === "health") return reply({
      ok: Boolean(KAKAO_REST_KEY && SUPABASE_SERVICE_ROLE_KEY),
      provider: "TAGO-public-data+KRIC-snapshot+Kakao-SW8",
      access: "service-role-jwt-only",
      routeModes: ["bus-subway-bus", "bus-subway-walk", "walk-subway-bus"],
      railRealtime: false,
      busRealtime: "per-bus-leg-when-available",
      busAssistThresholdMeters: BUS_ASSIST_MIN_WALK_METERS,
    });
    if (action !== "route") return reply({ error: "지원하지 않는 요청입니다." }, 404);

    const sx = finite(url.searchParams.get("sx"), -180, 180);
    const sy = finite(url.searchParams.get("sy"), -90, 90);
    const ex = finite(url.searchParams.get("ex"), -180, 180);
    const ey = finite(url.searchParams.get("ey"), -90, 90);
    if (sx === null || sy === null || ex === null || ey === null) return reply({ error: "출발·도착 좌표가 필요합니다." }, 400);

    const result = await searchMixed(sx, sy, ex, ey);
    return reply({
      generatedAt: new Date().toISOString(),
      provider: "TAGO-public-data+KRIC-snapshot+Kakao-SW8",
      routeModes: ["bus-subway-bus", "bus-subway-walk", "walk-subway-bus"],
      realtimeCoverage: result.routes.some((route) => route.realtimeLegs.length) ? "bus-legs-only" : "none",
      railRealtime: false,
      railSnapshotDate: result.snapshotDate,
      routes: result.routes,
    }, 200, "public, max-age=30");
  } catch (error) {
    const message = error instanceof Error ? error.message : "혼합 대중교통 경로를 만들지 못했습니다.";
    console.error(`transit-mixed: ${message}`);
    return reply({ error: message, routes: [] }, 502, "no-store");
  }
});
