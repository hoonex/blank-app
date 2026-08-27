import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ODSAY_BASE = "https://api.odsay.com/v1/api";
const TAGO_ARRIVAL = "https://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList";
const KAKAO_ADDRESS = "https://dapi.kakao.com/v2/local/search/address.json";
const KAKAO_KEYWORD = "https://dapi.kakao.com/v2/local/search/keyword.json";

const ODSAY_API_KEY = Deno.env.get("ODSAY_API_KEY") || "";
const DATA_GO_KR_SERVICE_KEY = Deno.env.get("DATA_GO_KR_SERVICE_KEY") || "";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const CITY_CODE_BY_REGION: Record<string, string> = {
  "서울특별시": "11",
  "부산광역시": "21",
  "대구광역시": "22",
  "인천광역시": "23",
  "광주광역시": "24",
  "대전광역시": "25",
  "울산광역시": "26",
  "세종특별자치시": "29",
  "경기도": "31",
  "강원특별자치도": "32",
  "강원도": "32",
  "충청북도": "33",
  "충청남도": "34",
  "전북특별자치도": "35",
  "전라북도": "35",
  "전라남도": "36",
  "경상북도": "37",
  "경상남도": "38",
  "제주특별자치도": "39",
  "제주도": "39",
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
  if (memoryCache.size > 160) {
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

async function odsay(operation: string, params: Record<string, string | number>) {
  if (!ODSAY_API_KEY) throw new Error("대중교통 경로 API가 아직 설정되지 않았습니다.");
  const url = new URL(`${ODSAY_BASE}/${operation}`);
  url.searchParams.set("apiKey", ODSAY_API_KEY);
  url.searchParams.set("lang", "0");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const body = await fetchJson(url);
  const error = Array.isArray(body?.error) ? body.error[0] : body?.error;
  if (error) throw new Error(error.message || "대중교통 경로를 찾지 못했습니다.");
  return body;
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

function normalizeRouteNo(value: unknown) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()]/g, "");
}

function firstBus(route: NormalizedRoute) {
  return route.segments.find((segment) => segment.type === "bus" && segment.startId);
}

function walkBeforeFirstBus(route: NormalizedRoute) {
  let minutes = 0;
  for (const segment of route.segments) {
    if (segment.type === "bus") break;
    if (segment.type === "walk") minutes += segment.minutes;
  }
  return minutes;
}

async function stationRealtime(route: NormalizedRoute) {
  if (!DATA_GO_KR_SERVICE_KEY) return null;
  const bus = firstBus(route);
  if (!bus?.startId || !bus.lines?.length) return null;

  try {
    const station = await cached(`odsay-station:${bus.startId}`, 10 * 60_000, async () => {
      const body = await odsay("busStationInfo", { stationID: bus.startId });
      return body?.result || null;
    });
    const localStationId = String((station as any)?.localStationID || "").trim();
    const region = String((station as any)?.do || "").trim();
    const cityCode = CITY_CODE_BY_REGION[region];
    if (!localStationId || !cityCode) return null;

    const arrivals = await cached(`tago-arrival:${cityCode}:${localStationId}`, 18_000, async () => {
      const url = new URL(TAGO_ARRIVAL);
      url.searchParams.set("serviceKey", publicDataKey());
      url.searchParams.set("pageNo", "1");
      url.searchParams.set("numOfRows", "100");
      url.searchParams.set("_type", "json");
      url.searchParams.set("cityCode", cityCode);
      url.searchParams.set("nodeId", localStationId);
      const body = await fetchJson(url, {}, 9000);
      const header = body?.response?.header;
      if (header?.resultCode && header.resultCode !== "00") throw new Error(header.resultMsg || "버스 도착정보 오류");
      const item = body?.response?.body?.items?.item;
      return Array.isArray(item) ? item : item ? [item] : [];
    }) as any[];

    const lineSet = new Set(bus.lines.map(normalizeRouteNo));
    const candidates = arrivals
      .filter((item) => lineSet.has(normalizeRouteNo(item?.routeno)))
      .map((item) => ({
        routeNo: String(item.routeno || ""),
        seconds: Number(item.arrtime),
        stops: Number(item.arrprevstationcnt),
        vehicleType: String(item.vehicletp || ""),
      }))
      .filter((item) => Number.isFinite(item.seconds) && item.seconds >= 0)
      .sort((a, b) => a.seconds - b.seconds);
    if (!candidates.length) return null;

    const best = candidates[0];
    const walkMinutes = walkBeforeFirstBus(route);
    const arrivalMinutes = Math.max(0, Math.ceil(best.seconds / 60));
    const waitAddedMinutes = Math.max(0, arrivalMinutes - walkMinutes);
    return {
      ...best,
      arrivalMinutes,
      waitAddedMinutes,
      source: "TAGO",
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`transit realtime unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

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
  realtime: null | Record<string, unknown>;
  arrivalAt: string;
  badges: string[];
};

function normalizeSegment(raw: any): Segment {
  const trafficType = Number(raw?.trafficType);
  const type = trafficType === 1 ? "subway" : trafficType === 2 ? "bus" : "walk";
  const lanes = Array.isArray(raw?.lane) ? raw.lane : raw?.lane ? [raw.lane] : [];
  const lines = lanes.map((lane: any) => String(type === "subway" ? lane?.name : lane?.busNo || "").trim()).filter(Boolean);
  return {
    type,
    minutes: Math.max(0, Number(raw?.sectionTime) || 0),
    distance: Math.max(0, Number(raw?.distance) || 0),
    stationCount: Math.max(0, Number(raw?.stationCount) || 0),
    startName: String(raw?.startName || ""),
    endName: String(raw?.endName || ""),
    startId: String(raw?.startID || ""),
    endId: String(raw?.endID || ""),
    lines,
    direction: String(raw?.way || ""),
  };
}

function normalizeRoutes(body: any): NormalizedRoute[] {
  const rawPaths = body?.result?.path;
  const list = Array.isArray(rawPaths) ? rawPaths : rawPaths ? [rawPaths] : [];
  return list
    .map((raw: any, index: number) => {
      const info = raw?.info || raw?.Info || {};
      const baselineMinutes = Math.max(1, Number(info?.totalTime) || 0);
      const segmentsRaw = Array.isArray(raw?.subPath) ? raw.subPath : raw?.subPath ? [raw.subPath] : [];
      const segments = segmentsRaw.map(normalizeSegment).filter((segment: Segment) => segment.minutes || segment.lines.length || segment.startName || segment.endName);
      return {
        id: `route-${index + 1}`,
        pathType: Number(raw?.pathType) || 0,
        baselineMinutes,
        totalMinutes: baselineMinutes,
        walkMeters: Math.max(0, Number(info?.totalWalk) || 0),
        payment: Math.max(0, Number(info?.payment) || 0),
        transfers: Math.max(0, (Number(info?.busTransitCount) || 0) + (Number(info?.subwayTransitCount) || 0)),
        stationCount: Math.max(0, Number(info?.totalStationCount || info?.toatlStationCount) || 0),
        segments,
        realtime: null,
        arrivalAt: "",
        badges: [],
      } satisfies NormalizedRoute;
    })
    .filter((route: NormalizedRoute) => route.segments.length)
    .sort((a: NormalizedRoute, b: NormalizedRoute) => a.baselineMinutes - b.baselineMinutes)
    .slice(0, 5);
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
  });
}

async function searchRoutes(sx: number, sy: number, ex: number, ey: number) {
  const cacheKey = `route:${sx.toFixed(5)}:${sy.toFixed(5)}:${ex.toFixed(5)}:${ey.toFixed(5)}`;
  const raw = await cached(cacheKey, 18_000, () => odsay("searchPubTransPathT", {
    SX: sx,
    SY: sy,
    EX: ex,
    EY: ey,
    OPT: 0,
    SearchType: 0,
    SearchPathType: 0,
  }));
  const routes = normalizeRoutes(raw);
  if (!routes.length) throw new Error("이 위치에서 이용 가능한 대중교통 경로를 찾지 못했습니다.");

  const realtime = await Promise.all(routes.map((route) => stationRealtime(route)));
  const baseTime = Date.now();
  routes.forEach((route, index) => {
    const live = realtime[index];
    route.realtime = live;
    route.totalMinutes = route.baselineMinutes + Number((live as any)?.waitAddedMinutes || 0);
    route.arrivalAt = new Date(baseTime + route.totalMinutes * 60_000).toISOString();
  });
  routes.sort((a, b) => a.totalMinutes - b.totalMinutes || a.walkMeters - b.walkMeters);
  assignBadges(routes);
  return routes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return reply({ error: "GET 요청만 지원합니다." }, 405);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "route";
  try {
    if (action === "health") {
      return reply({
        ok: true,
        integrations: {
          odsay: Boolean(ODSAY_API_KEY),
          publicData: Boolean(DATA_GO_KR_SERVICE_KEY),
          kakao: Boolean(KAKAO_REST_KEY),
        },
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
      realtimeCoverage: routes.some((route) => route.realtime) ? "partial" : "none",
      routes,
    }, 200, "public, max-age=15");
  } catch (error) {
    const message = error instanceof Error ? error.message : "교통 정보를 불러오지 못했습니다.";
    console.error(`transit-data: ${message}`);
    return reply({ error: message }, 502, "no-store");
  }
});
