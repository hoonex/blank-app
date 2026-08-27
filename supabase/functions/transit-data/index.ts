import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TAGO_STOPS_NEAR = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList";
const TAGO_ROUTES_AT_STOP = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnThrghRouteList";
const TAGO_ROUTE_STOPS = "https://apis.data.go.kr/1613000/BusRouteInfoInqireService/getRouteAcctoThrghSttnList";
const TAGO_ARRIVAL = "https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList";
const KAKAO_ADDRESS = "https://dapi.kakao.com/v2/local/search/address.json";
const KAKAO_KEYWORD = "https://dapi.kakao.com/v2/local/search/keyword.json";

const DATA_GO_KR_SERVICE_KEY = Deno.env.get("DATA_GO_KR_SERVICE_KEY") || "";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";

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
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
}

function publicDataKey() {
  if (!DATA_GO_KR_SERVICE_KEY) return "";
  try {
    return /%[0-9a-f]{2}/i.test(DATA_GO_KR_SERVICE_KEY)
      ? decodeURIComponent(DATA_GO_KR_SERVICE_KEY)
      : DATA_GO_KR_SERVICE_KEY;
  } catch {
    return DATA_GO_KR_SERVICE_KEY;
  }
}

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  memoryCache.set(key, { expires: Date.now() + ttlMs, value });
  if (memoryCache.size > 220) {
    const now = Date.now();
    for (const [cacheKey, entry] of memoryCache) if (entry.expires <= now) memoryCache.delete(cacheKey);
  }
  return value;
}

async function fetchJson(url: URL | string, init: RequestInit = {}, timeout = 10000) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`외부 교통 데이터 응답 오류 (${response.status})`);
  return body;
}

function tagoItems(body: any) {
  const header = body?.response?.header;
  if (header?.resultCode && String(header.resultCode) !== "00") {
    throw new Error(header.resultMsg || "공공 교통데이터 조회에 실패했습니다.");
  }
  const item = body?.response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

async function tago(endpoint: string, params: Record<string, string | number>, timeout = 10000) {
  if (!DATA_GO_KR_SERVICE_KEY) throw new Error("공공데이터포털 인증키가 아직 설정되지 않았습니다.");
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", publicDataKey());
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("_type", "json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return tagoItems(await fetchJson(url, {}, timeout));
}

async function geocode(query: string) {
  if (!KAKAO_REST_KEY) throw new Error("목적지 좌표 검색 API가 아직 설정되지 않았습니다.");
  const normalized = query.trim();
  if (!normalized) throw new Error("목적지가 필요합니다.");
  return cached(`geo:${normalized}`, 30 * 60_000, async () => {
    for (const endpoint of [KAKAO_ADDRESS, KAKAO_KEYWORD]) {
      const url = new URL(endpoint);
      url.searchParams.set("query", normalized);
      url.searchParams.set("size", "5");
      const body = await fetchJson(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
      const document = body?.documents?.[0];
      if (document) {
        return {
          x: Number(document.x),
          y: Number(document.y),
          name: document.place_name || document.road_address?.address_name || document.address_name || normalized,
          address: document.road_address?.address_name || document.address?.address_name || document.address_name || normalized,
        };
      }
    }
    throw new Error("목적지 위치를 찾지 못했습니다.");
  });
}

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

function rideMinutes(stations: number) {
  return Math.max(3, Math.round(Math.max(1, stations) * 2.05));
}

type Stop = {
  id: string;
  name: string;
  cityCode: string;
  x: number;
  y: number;
  distance: number;
};

type Line = {
  id: string;
  no: string;
  type: string;
  cityCode: string;
  startName: string;
  endName: string;
};

type RouteStop = {
  id: string;
  name: string;
  order: number;
  x: number;
  y: number;
};

type StopLine = { stop: Stop; line: Line };

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
  vehicleType: string;
  arrivalMinutes: number;
  waitAddedMinutes: number;
  source: string;
  checkedAt: string;
};

type NormalizedRoute = {
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
  arrivalAt: string;
  badges: string[];
};

async function nearbyStops(x: number, y: number) {
  const key = `near:${x.toFixed(5)}:${y.toFixed(5)}`;
  return cached(key, 10 * 60_000, async () => {
    const items = await tago(TAGO_STOPS_NEAR, { gpsLong: x, gpsLati: y, numOfRows: 12 });
    return items.map((item: any) => {
      const sx = Number(item.gpslong), sy = Number(item.gpslati);
      return {
        id: String(item.nodeid || ""),
        name: String(item.nodenm || "정류장"),
        cityCode: String(item.citycode || ""),
        x: sx,
        y: sy,
        distance: Number.isFinite(sx) && Number.isFinite(sy) ? haversineMeters(x, y, sx, sy) : 9999,
      } satisfies Stop;
    }).filter((stop: Stop) => stop.id && stop.cityCode && Number.isFinite(stop.x) && Number.isFinite(stop.y))
      .sort((a: Stop, b: Stop) => a.distance - b.distance)
      .slice(0, 5);
  });
}

async function routesAtStop(stop: Stop) {
  return cached(`stop-routes:${stop.cityCode}:${stop.id}`, 10 * 60_000, async () => {
    const items = await tago(TAGO_ROUTES_AT_STOP, {
      cityCode: stop.cityCode,
      nodeId: stop.id,
      nodeid: stop.id,
      numOfRows: 100,
    });
    const seen = new Set<string>();
    return items.map((item: any) => ({
      id: String(item.routeid || item.routeId || ""),
      no: String(item.routeno || item.routeNo || ""),
      type: String(item.routetp || item.routeTp || ""),
      cityCode: stop.cityCode,
      startName: String(item.startnodenm || item.startNodeNm || ""),
      endName: String(item.endnodenm || item.endNodeNm || ""),
    } satisfies Line)).filter((line: Line) => {
      if (!line.id || seen.has(line.id)) return false;
      seen.add(line.id);
      return true;
    }).slice(0, 16);
  });
}

async function routeStops(line: Line) {
  return cached(`route-stops:${line.cityCode}:${line.id}`, 30 * 60_000, async () => {
    const items = await tago(TAGO_ROUTE_STOPS, { cityCode: line.cityCode, routeId: line.id, numOfRows: 300 }, 12000);
    return items.map((item: any, index: number) => ({
      id: String(item.nodeid || item.nodeId || ""),
      name: String(item.nodenm || item.nodeNm || "정류장"),
      order: Number(item.nodeord ?? item.nodeOrd ?? index + 1),
      x: Number(item.gpslong ?? item.gpsLong),
      y: Number(item.gpslati ?? item.gpsLati),
    } satisfies RouteStop)).filter((stop: RouteStop) => stop.id)
      .sort((a: RouteStop, b: RouteStop) => a.order - b.order);
  });
}

function normalizeRouteNo(value: unknown) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()]/g, "");
}

async function arrivalAtStop(stop: Stop, line: Line): Promise<LiveArrival | null> {
  try {
    const arrivals = await cached(`arrival:${stop.cityCode}:${stop.id}`, 18_000, async () =>
      tago(TAGO_ARRIVAL, { cityCode: stop.cityCode, nodeId: stop.id, numOfRows: 100 }, 9000));
    const targetNo = normalizeRouteNo(line.no);
    const candidates = arrivals.filter((item: any) =>
      String(item.routeid || "") === line.id || (targetNo && normalizeRouteNo(item.routeno) === targetNo))
      .map((item: any) => ({
        routeNo: String(item.routeno || line.no || "버스"),
        seconds: Number(item.arrtime),
        stops: Number(item.arrprevstationcnt),
        vehicleType: String(item.vehicletp || ""),
      }))
      .filter((item: any) => Number.isFinite(item.seconds) && item.seconds >= 0)
      .sort((a: any, b: any) => a.seconds - b.seconds);
    if (!candidates.length) return null;
    const best = candidates[0];
    return {
      ...best,
      arrivalMinutes: Math.max(0, Math.ceil(best.seconds / 60)),
      waitAddedMinutes: 0,
      source: "TAGO",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`arrival unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function indexOfStop(stops: RouteStop[], target: Stop) {
  let index = stops.findIndex((stop) => stop.id === target.id);
  if (index >= 0) return index;
  const normalized = target.name.replace(/\s+/g, "");
  return stops.findIndex((stop) => stop.name.replace(/\s+/g, "") === normalized);
}

function busSegment(line: Line, start: RouteStop | Stop, end: RouteStop | Stop, stations: number): Segment {
  return {
    type: "bus",
    minutes: rideMinutes(stations),
    distance: 0,
    stationCount: stations,
    startName: start.name,
    endName: end.name,
    startId: start.id,
    endId: end.id,
    lines: [line.no || "버스"],
    direction: line.endName,
  };
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

function finalizeRoute(route: Omit<NormalizedRoute, "arrivalAt" | "badges">, index: number): NormalizedRoute {
  return {
    ...route,
    id: `route-${index + 1}`,
    arrivalAt: new Date(Date.now() + route.totalMinutes * 60_000).toISOString(),
    badges: [],
  };
}

async function directCandidates(source: StopLine[], destination: StopLine[], sx: number, sy: number, ex: number, ey: number) {
  const destinationByLine = new Map<string, StopLine[]>();
  for (const item of destination) {
    const list = destinationByLine.get(item.line.id) || [];
    list.push(item);
    destinationByLine.set(item.line.id, list);
  }
  const candidates: NormalizedRoute[] = [];
  const seen = new Set<string>();
  for (const start of source) {
    const endOptions = destinationByLine.get(start.line.id) || [];
    for (const end of endOptions) {
      const signature = `${start.line.id}:${start.stop.id}:${end.stop.id}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      const stops = await routeStops(start.line);
      const a = indexOfStop(stops, start.stop), b = indexOfStop(stops, end.stop);
      if (a < 0 || b <= a) continue;
      const stations = b - a;
      const live = await arrivalAtStop(start.stop, start.line);
      const startWalk = haversineMeters(sx, sy, start.stop.x, start.stop.y);
      const endWalk = haversineMeters(end.stop.x, end.stop.y, ex, ey);
      const wait = live ? live.arrivalMinutes : 5;
      const baselineMinutes = walkingMinutes(startWalk) + 5 + rideMinutes(stations) + walkingMinutes(endWalk);
      const totalMinutes = walkingMinutes(startWalk) + wait + rideMinutes(stations) + walkingMinutes(endWalk);
      candidates.push(finalizeRoute({
        id: "",
        pathType: 2,
        baselineMinutes,
        totalMinutes,
        walkMeters: Math.round(startWalk + endWalk),
        payment: 0,
        transfers: 0,
        stationCount: stations,
        segments: [
          walkSegment("현재 위치", start.stop.name, startWalk),
          busSegment(start.line, start.stop, end.stop, stations),
          walkSegment(end.stop.name, "목적지", endWalk),
        ],
        realtime: live,
      }, candidates.length));
    }
  }
  return candidates;
}

async function transferCandidates(source: StopLine[], destination: StopLine[], sx: number, sy: number, ex: number, ey: number, limit = 8) {
  const candidates: NormalizedRoute[] = [];
  const sourceSlim = source.slice(0, limit), destinationSlim = destination.slice(0, limit);
  const stopCache = new Map<string, RouteStop[]>();
  const getStops = async (line: Line) => {
    if (!stopCache.has(line.id)) stopCache.set(line.id, await routeStops(line));
    return stopCache.get(line.id)!;
  };
  const seen = new Set<string>();

  for (const first of sourceSlim) {
    const firstStops = await getStops(first.line);
    const board = indexOfStop(firstStops, first.stop);
    if (board < 0) continue;
    const afterBoard = new Map(firstStops.slice(board + 1).map((stop, offset) => [stop.id, { stop, index: board + 1 + offset }]));

    for (const second of destinationSlim) {
      if (first.line.id === second.line.id) continue;
      const secondStops = await getStops(second.line);
      const alight = indexOfStop(secondStops, second.stop);
      if (alight <= 0) continue;
      let transfer: { stop: RouteStop; firstIndex: number; secondIndex: number } | null = null;
      for (let j = 0; j < alight; j++) {
        const hit = afterBoard.get(secondStops[j].id);
        if (!hit) continue;
        const score = (hit.index - board) + (alight - j);
        if (!transfer || score < (transfer.firstIndex - board) + (alight - transfer.secondIndex)) {
          transfer = { stop: hit.stop, firstIndex: hit.index, secondIndex: j };
        }
      }
      if (!transfer) continue;
      const signature = `${first.line.id}:${second.line.id}:${first.stop.id}:${transfer.stop.id}:${second.stop.id}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      const firstCount = transfer.firstIndex - board;
      const secondCount = alight - transfer.secondIndex;
      const startWalk = haversineMeters(sx, sy, first.stop.x, first.stop.y);
      const endWalk = haversineMeters(second.stop.x, second.stop.y, ex, ey);
      const live = await arrivalAtStop(first.stop, first.line);
      const firstWait = live ? live.arrivalMinutes : 5;
      const secondWait = 5;
      const baselineMinutes = walkingMinutes(startWalk) + 5 + rideMinutes(firstCount) + secondWait + rideMinutes(secondCount) + walkingMinutes(endWalk);
      const totalMinutes = walkingMinutes(startWalk) + firstWait + rideMinutes(firstCount) + secondWait + rideMinutes(secondCount) + walkingMinutes(endWalk);
      candidates.push(finalizeRoute({
        id: "",
        pathType: 3,
        baselineMinutes,
        totalMinutes,
        walkMeters: Math.round(startWalk + endWalk),
        payment: 0,
        transfers: 1,
        stationCount: firstCount + secondCount,
        segments: [
          walkSegment("현재 위치", first.stop.name, startWalk),
          busSegment(first.line, first.stop, transfer.stop, firstCount),
          busSegment(second.line, transfer.stop, second.stop, secondCount),
          walkSegment(second.stop.name, "목적지", endWalk),
        ],
        realtime: live,
      }, candidates.length));
      if (candidates.length >= 10) return candidates;
    }
  }
  return candidates;
}

function assignBadges(routes: NormalizedRoute[]) {
  if (!routes.length) return;
  const minWalk = Math.min(...routes.map((route) => route.walkMeters));
  const minTransfers = Math.min(...routes.map((route) => route.transfers));
  routes.forEach((route, index) => {
    const badges: string[] = [];
    if (index === 0) badges.push("추천");
    if (route.walkMeters === minWalk && index !== 0) badges.push("걷기 적음");
    if (route.transfers === minTransfers && index !== 0 && badges.length < 2) badges.push("환승 적음");
    route.badges = badges;
    route.id = `route-${index + 1}`;
    route.arrivalAt = new Date(Date.now() + route.totalMinutes * 60_000).toISOString();
  });
}

async function stopLines(stops: Stop[]) {
  const groups = await Promise.all(stops.map(async (stop) => (await routesAtStop(stop)).map((line) => ({ stop, line }))));
  const seen = new Set<string>();
  return groups.flat().filter((item) => {
    const key = `${item.stop.id}:${item.line.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchRoutes(sx: number, sy: number, ex: number, ey: number) {
  const [sourceStops, destinationStops] = await Promise.all([nearbyStops(sx, sy), nearbyStops(ex, ey)]);
  if (!sourceStops.length) throw new Error("현재 위치 500m 안에서 버스 정류장을 찾지 못했습니다.");
  if (!destinationStops.length) throw new Error("목적지 500m 안에서 버스 정류장을 찾지 못했습니다.");

  const [source, destination] = await Promise.all([stopLines(sourceStops), stopLines(destinationStops)]);
  if (!source.length || !destination.length) throw new Error("주변 정류장의 운행 노선 정보를 찾지 못했습니다.");

  const direct = await directCandidates(source, destination, sx, sy, ex, ey);
  let routes = direct;
  if (routes.length < 5) routes = [...routes, ...await transferCandidates(source, destination, sx, sy, ex, ey)];

  const deduped = new Map<string, NormalizedRoute>();
  for (const route of routes) {
    const key = route.segments.filter((segment) => segment.type === "bus").map((segment) => `${segment.lines.join(',')}:${segment.startId}:${segment.endId}`).join('|');
    const existing = deduped.get(key);
    if (!existing || route.totalMinutes < existing.totalMinutes) deduped.set(key, route);
  }
  const finalRoutes = [...deduped.values()]
    .sort((a, b) => a.totalMinutes - b.totalMinutes || a.transfers - b.transfers || a.walkMeters - b.walkMeters)
    .slice(0, 5);
  if (!finalRoutes.length) throw new Error("공공 교통데이터에서 연결 가능한 버스 경로를 찾지 못했습니다.");
  assignBadges(finalRoutes);
  return finalRoutes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return reply({ error: "GET 요청만 지원합니다." }, 405);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "route";
  try {
    if (action === "health") {
      return reply({
        ok: Boolean(DATA_GO_KR_SERVICE_KEY && KAKAO_REST_KEY),
        integrations: {
          publicData: Boolean(DATA_GO_KR_SERVICE_KEY),
          kakao: Boolean(KAKAO_REST_KEY),
        },
        routingProvider: "TAGO-public-data",
        routeModes: ["bus-direct", "bus-one-transfer"],
        plannedGtfsUpgrade: "2026-09-07",
      }, 200, "no-store");
    }

    if (action !== "route") return reply({ error: "지원하지 않는 요청입니다." }, 404);
    const sx = finite(url.searchParams.get("sx"), -180, 180);
    const sy = finite(url.searchParams.get("sy"), -90, 90);
    if (sx === null || sy === null) return reply({ error: "현재 위치 좌표가 필요합니다." }, 400);

    let ex = finite(url.searchParams.get("ex"), -180, 180);
    let ey = finite(url.searchParams.get("ey"), -90, 90);
    const destinationQuery = String(url.searchParams.get("destination") || "").trim();
    let destination = { x: ex, y: ey, name: destinationQuery || "목적지", address: destinationQuery || "" };
    if (ex === null || ey === null) {
      const resolved = await geocode(destinationQuery);
      ex = resolved.x;
      ey = resolved.y;
      destination = resolved;
    }

    const routes = await searchRoutes(sx, sy, ex, ey);
    return reply({
      generatedAt: new Date().toISOString(),
      destination,
      provider: "TAGO-public-data",
      realtimeCoverage: routes.some((route) => route.realtime) ? "partial" : "none",
      routeModes: ["bus-direct", "bus-one-transfer"],
      routes,
    }, 200, "public, max-age=15");
  } catch (error) {
    const message = error instanceof Error ? error.message : "교통 정보를 불러오지 못했습니다.";
    console.error(`transit-data: ${message}`);
    return reply({ error: message }, 502, "no-store");
  }
});