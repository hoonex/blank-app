import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const KAKAO_CATEGORY = "https://dapi.kakao.com/v2/local/search/category.json";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";
const SNAPSHOT_DATE = "2026-06-30";
const MAX_WALK_METERS = 1800;
const RAIL_WAIT_MINUTES = 4;
const TRANSFER_MINUTES = 5;
const RAIL_MINUTES_PER_STOP = 2.1;

const DAEGU_LINES: Record<string, string[]> = {
  "1": [
    "설화명곡","화원","대곡(정부대구청사)","진천","월배","상인","월촌","송현","서부정류장(관문시장)","대명","안지랑","현충로","영대병원","교대","명덕(2.28민주운동기념회관)","반월당","중앙로","대구역","칠성시장","신천(경북대입구)","동대구역","동구청(큰고개)","아양교","동촌","해안","방촌","용계","율하","신기","반야월","각산","안심(혁신도시.첨복단지)","대구한의대병원","부호","하양",
  ],
  "2": [
    "문양","다사","대실","강창","계명대","성서산업단지","이곡","용산(서부법원.검찰청입구)","죽전","감삼","두류","내당","반고개","청라언덕","반월당","경대병원","대구은행","범어","수성구청(KBS)","만촌","담티(산대.대륜)","연호","수성알파시티(삼성라이온즈파크)","고산","신매","사월","정평","임당","영남대",
  ],
  "3": [
    "칠곡경대병원","학정","팔거(국립농관원.통계청)","동천","칠곡운암","구암","태전","매천","매천시장","팔달","공단","만평","팔달시장","원대","북구청","달성공원","서문시장(동산병원)","청라언덕","남산","명덕(2.28민주운동기념회관)","건들바위","대봉교","수성시장","수성구민운동장","어린이세상","황금","수성못(TBC)","지산","범물","용지",
  ],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const memoryCache = new Map<string, { expires: number; value: unknown }>();

function reply(body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Cache-Control": cache } });
}

function finite(value: string | null, min: number, max: number) {
  if (value === null || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  memoryCache.set(key, { expires: Date.now() + ttlMs, value });
  if (memoryCache.size > 120) {
    const now = Date.now();
    for (const [cacheKey, entry] of memoryCache) if (entry.expires <= now) memoryCache.delete(cacheKey);
  }
  return value;
}

async function kakaoCategory(params: Record<string, string>) {
  if (!KAKAO_REST_KEY) throw new Error("카카오 위치 API가 아직 설정되지 않았습니다.");
  const url = new URL(KAKAO_CATEGORY);
  url.searchParams.set("category_group_code", "SW8");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    signal: AbortSignal.timeout(9000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `Kakao HTTP ${response.status}`);
  return Array.isArray(body?.documents) ? body.documents : [];
}

function normalizeStationName(value = "") {
  return value
    .replace(/대구(?:도시철도|지하철)?\s*[123]호선/gi, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/역$/g, "")
    .replace(/[\s·._\-]/g, "")
    .toLowerCase();
}

const GRAPH = Object.entries(DAEGU_LINES).flatMap(([line, stations]) => stations.map((name, index) => ({
  line,
  name,
  index,
  key: normalizeStationName(name),
  id: `DG-${line}-${String(index + 1).padStart(2, "0")}`,
})));

function haversineMeters(ax: number, ay: number, bx: number, by: number) {
  const rad = Math.PI / 180;
  const lat1 = ay * rad, lat2 = by * rad;
  const dLat = (by - ay) * rad, dLon = (bx - ax) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function walkingMinutes(meters: number) {
  return Math.max(1, Math.ceil(Math.max(0, meters) / 78));
}

function railMinutes(stops: number) {
  return Math.max(3, Math.round(Math.max(1, stops) * RAIL_MINUTES_PER_STOP));
}

type NearbyRail = {
  line: string;
  name: string;
  index: number;
  id: string;
  x: number;
  y: number;
  distance: number;
};

type Segment = {
  type: "walk" | "subway";
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

type RailRoute = {
  id: string;
  pathType: number;
  baselineMinutes: number;
  totalMinutes: number;
  walkMeters: number;
  payment: number;
  transfers: number;
  stationCount: number;
  segments: Segment[];
  realtime: null;
  realtimeLegs: [];
  arrivalAt: string;
  badges: string[];
  estimateMode: "static-snapshot";
};

async function nearbyRail(x: number, y: number) {
  const key = `rail-near:${x.toFixed(4)}:${y.toFixed(4)}`;
  return cached(key, 10 * 60_000, async () => {
    const documents = await kakaoCategory({
      x: String(x),
      y: String(y),
      radius: "2500",
      size: "15",
      sort: "distance",
    });
    const matches = new Map<string, NearbyRail>();
    for (const document of documents) {
      const px = Number(document.x), py = Number(document.y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      const distance = Number(document.distance) || haversineMeters(x, y, px, py);
      if (distance > MAX_WALK_METERS) continue;
      const documentKey = normalizeStationName(String(document.place_name || ""));
      if (!documentKey) continue;
      const graphMatches = GRAPH.filter((station) => station.key === documentKey || documentKey.startsWith(station.key) || station.key.startsWith(documentKey));
      for (const station of graphMatches) {
        const candidate: NearbyRail = { ...station, x: px, y: py, distance };
        const mapKey = `${station.line}:${station.index}`;
        const previous = matches.get(mapKey);
        if (!previous || candidate.distance < previous.distance) matches.set(mapKey, candidate);
      }
    }
    return [...matches.values()].sort((a, b) => a.distance - b.distance).slice(0, 10);
  });
}

function walkSegment(startName: string, endName: string, meters: number): Segment {
  return {
    type: "walk",
    minutes: walkingMinutes(meters),
    distance: Math.round(meters),
    stationCount: 0,
    startName,
    endName,
    startId: "",
    endId: "",
    lines: [],
    direction: "",
  };
}

function subwaySegment(line: string, start: NearbyRail | { name: string; index: number; id: string }, end: NearbyRail | { name: string; index: number; id: string }): Segment {
  const count = Math.abs(end.index - start.index);
  const stations = DAEGU_LINES[line];
  const direction = end.index > start.index ? stations.at(-1)! : stations[0];
  return {
    type: "subway",
    minutes: railMinutes(count),
    distance: 0,
    stationCount: count,
    startName: start.name,
    endName: end.name,
    startId: start.id,
    endId: end.id,
    lines: [`${line}호선`],
    direction,
  };
}

function finishRoute(route: Omit<RailRoute, "id" | "arrivalAt" | "badges">): RailRoute {
  return {
    ...route,
    id: "",
    arrivalAt: new Date(Date.now() + route.totalMinutes * 60_000).toISOString(),
    badges: [],
  };
}

function directRoutes(source: NearbyRail[], destination: NearbyRail[]) {
  const routes: RailRoute[] = [];
  for (const start of source) for (const end of destination) {
    if (start.line !== end.line || start.index === end.index) continue;
    const subway = subwaySegment(start.line, start, end);
    const startWalk = start.distance, endWalk = end.distance;
    const totalMinutes = walkingMinutes(startWalk) + RAIL_WAIT_MINUTES + subway.minutes + walkingMinutes(endWalk);
    routes.push(finishRoute({
      pathType: 1,
      baselineMinutes: totalMinutes,
      totalMinutes,
      walkMeters: Math.round(startWalk + endWalk),
      payment: 0,
      transfers: 0,
      stationCount: subway.stationCount,
      segments: [walkSegment("현재 위치", start.name, startWalk), subway, walkSegment(end.name, "목적지", endWalk)],
      realtime: null,
      realtimeLegs: [],
      estimateMode: "static-snapshot",
    }));
  }
  return routes;
}

function sharedTransfer(lineA: string, lineB: string) {
  const other = new Map(DAEGU_LINES[lineB].map((name, index) => [normalizeStationName(name), { name, index }]));
  return DAEGU_LINES[lineA].map((name, index) => ({ name, index, match: other.get(normalizeStationName(name)) }))
    .find((item) => item.match);
}

function transferRoutes(source: NearbyRail[], destination: NearbyRail[]) {
  const routes: RailRoute[] = [];
  for (const start of source) for (const end of destination) {
    if (start.line === end.line) continue;
    const transfer = sharedTransfer(start.line, end.line);
    if (!transfer?.match) continue;
    if (start.index === transfer.index || end.index === transfer.match.index) continue;
    const transferA = { name: transfer.name, index: transfer.index, id: `DG-${start.line}-T-${normalizeStationName(transfer.name)}` };
    const transferB = { name: transfer.match.name, index: transfer.match.index, id: `DG-${end.line}-T-${normalizeStationName(transfer.match.name)}` };
    const first = subwaySegment(start.line, start, transferA);
    const second = subwaySegment(end.line, transferB, end);
    const startWalk = start.distance, endWalk = end.distance;
    const totalMinutes = walkingMinutes(startWalk) + RAIL_WAIT_MINUTES + first.minutes + TRANSFER_MINUTES + RAIL_WAIT_MINUTES + second.minutes + walkingMinutes(endWalk);
    routes.push(finishRoute({
      pathType: 1,
      baselineMinutes: totalMinutes,
      totalMinutes,
      walkMeters: Math.round(startWalk + endWalk),
      payment: 0,
      transfers: 1,
      stationCount: first.stationCount + second.stationCount,
      segments: [walkSegment("현재 위치", start.name, startWalk), first, second, walkSegment(end.name, "목적지", endWalk)],
      realtime: null,
      realtimeLegs: [],
      estimateMode: "static-snapshot",
    }));
  }
  return routes;
}

function routeSignature(route: RailRoute) {
  return route.segments.filter((segment) => segment.type === "subway")
    .map((segment) => `${segment.lines[0]}:${segment.startName}:${segment.endName}`).join("|");
}

async function searchRail(sx: number, sy: number, ex: number, ey: number) {
  const [source, destination] = await Promise.all([nearbyRail(sx, sy), nearbyRail(ex, ey)]);
  if (!source.length || !destination.length) return [];
  const candidates = [...directRoutes(source, destination), ...transferRoutes(source, destination)];
  const deduped = new Map<string, RailRoute>();
  for (const route of candidates) {
    const key = routeSignature(route);
    const previous = deduped.get(key);
    if (!previous || route.totalMinutes < previous.totalMinutes) deduped.set(key, route);
  }
  return [...deduped.values()]
    .sort((a, b) => a.totalMinutes - b.totalMinutes || a.transfers - b.transfers || a.walkMeters - b.walkMeters)
    .slice(0, 5)
    .map((route, index) => ({ ...route, id: `rail-${index + 1}` }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return reply({ error: "GET 요청만 지원합니다." }, 405);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "route";
  try {
    if (action === "health") return reply({
      ok: Boolean(KAKAO_REST_KEY),
      provider: "KRIC-snapshot+Kakao-SW8",
      coverage: "Daegu-1-2-3",
      snapshotDate: SNAPSHOT_DATE,
      routeModes: ["subway-direct", "subway-one-transfer"],
      realtime: false,
      waitModel: "estimated",
    });
    if (action !== "route") return reply({ error: "지원하지 않는 요청입니다." }, 404);
    const sx = finite(url.searchParams.get("sx"), -180, 180);
    const sy = finite(url.searchParams.get("sy"), -90, 90);
    const ex = finite(url.searchParams.get("ex"), -180, 180);
    const ey = finite(url.searchParams.get("ey"), -90, 90);
    if (sx === null || sy === null || ex === null || ey === null) return reply({ error: "출발·도착 좌표가 필요합니다." }, 400);
    const routes = await searchRail(sx, sy, ex, ey);
    return reply({
      generatedAt: new Date().toISOString(),
      provider: "KRIC-snapshot+Kakao-SW8",
      snapshotDate: SNAPSHOT_DATE,
      realtimeCoverage: "none",
      waitModel: "estimated",
      routeModes: ["subway-direct", "subway-one-transfer"],
      routes,
    }, 200, "public, max-age=60");
  } catch (error) {
    const message = error instanceof Error ? error.message : "도시철도 경로를 불러오지 못했습니다.";
    console.error(`transit-rail: ${message}`);
    return reply({ error: message }, 502, "no-store");
  }
});