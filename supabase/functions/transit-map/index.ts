import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TAGO_BASE = "https://apis.data.go.kr/1613000";
const TAGO_CITY_CODES = `${TAGO_BASE}/BusSttnInfoInqireService/getCtyCodeList`;
const TAGO_ROUTES_AT_STOP = `${TAGO_BASE}/BusSttnInfoInqireService/getSttnThrghRouteList`;
const TAGO_ROUTE_STOPS = `${TAGO_BASE}/BusRouteInfoInqireService/getRouteAcctoThrghSttnList`;
const TAGO_BUS_LOCATION = `${TAGO_BASE}/BusLcInfoInqireService/getRouteAcctoBusLcList`;
const DATA_GO_KR_SERVICE_KEY = Deno.env.get("DATA_GO_KR_SERVICE_KEY") || "";
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
function publicDataKey() {
  if (!DATA_GO_KR_SERVICE_KEY) return "";
  try { return /%[0-9a-f]{2}/i.test(DATA_GO_KR_SERVICE_KEY) ? decodeURIComponent(DATA_GO_KR_SERVICE_KEY) : DATA_GO_KR_SERVICE_KEY; }
  catch { return DATA_GO_KR_SERVICE_KEY; }
}
function safe(value: string | null, max = 120) {
  const text = String(value || "").trim();
  return text && text.length <= max ? text : "";
}
function compactRegion(value = "") {
  return value.replace(/\s+/g, "").replace(/특별자치도|특별자치시|광역시|특별시|도$/g, "");
}
function normalizeRouteNo(value: unknown) {
  return String(value || "").toLowerCase().replace(/\s+/g, "").replace(/[()]/g, "");
}
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>, shouldCache: (value: T) => boolean = () => true): Promise<T> {
  const hit = memoryCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await load();
  if (shouldCache(value)) memoryCache.set(key, { expires: Date.now() + ttlMs, value });
  if (memoryCache.size > 180) {
    const now = Date.now();
    for (const [cacheKey, entry] of memoryCache) if (entry.expires <= now) memoryCache.delete(cacheKey);
  }
  return value;
}
function tagoResult(body: any) {
  const header = body?.response?.header;
  if (header?.resultCode && String(header.resultCode) !== "00") throw new Error(header.resultMsg || "공공 교통데이터 조회에 실패했습니다.");
  const raw = body?.response?.body?.items?.item;
  return { items: Array.isArray(raw) ? raw : raw ? [raw] : [], totalCount: Number(body?.response?.body?.totalCount || 0) };
}
async function tago(endpoint: string, params: Record<string, string | number>, timeout = 12000) {
  if (!DATA_GO_KR_SERVICE_KEY) throw new Error("공공데이터포털 인증키가 아직 설정되지 않았습니다.");
  const url = new URL(endpoint);
  url.searchParams.set("serviceKey", publicDataKey());
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "500");
  url.searchParams.set("_type", "json");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch {}
  if (!response.ok) throw new Error(body?.response?.header?.resultMsg || `TAGO HTTP ${response.status}`);
  if (!body) throw new Error("공공 교통데이터가 JSON 형식으로 응답하지 않았습니다.");
  return tagoResult(body);
}
async function cityCodes() {
  return cached("map-city-codes", 24 * 60 * 60_000, async () => {
    const response = await tago(TAGO_CITY_CODES, { numOfRows: 200 });
    return response.items.map((item: any) => ({ code: String(item.citycode || item.cityCode || ""), name: String(item.cityname || item.cityName || "") })).filter((item) => item.code && item.name);
  });
}
async function cityCodeForRegion(regionHint: string) {
  const compact = compactRegion(regionHint);
  if (!compact) return "";
  const cities = await cityCodes();
  const exact = cities.find((city) => city.name === regionHint);
  if (exact) return exact.code;
  const match = cities.find((city) => {
    const name = compactRegion(city.name);
    return name === compact || name.startsWith(compact) || compact.startsWith(name);
  });
  return match?.code || "";
}
async function routeAtStop(cityCode: string, nodeId: string, lineNo: string) {
  const key = `map-route:${cityCode}:${nodeId}:${normalizeRouteNo(lineNo)}`;
  return cached(key, 30 * 60_000, async () => {
    const response = await tago(TAGO_ROUTES_AT_STOP, { cityCode, nodeId, nodeid: nodeId, numOfRows: 150 });
    const target = normalizeRouteNo(lineNo);
    const match = response.items.find((item: any) => target && normalizeRouteNo(item.routeno || item.routeNo) === target);
    if (!match) throw new Error("승차 정류장에서 해당 버스 노선을 찾지 못했습니다.");
    return {
      id: String(match.routeid || match.routeId || ""),
      no: String(match.routeno || match.routeNo || lineNo),
      type: String(match.routetp || match.routeTp || ""),
      startName: String(match.startnodenm || match.startNodeNm || ""),
      endName: String(match.endnodenm || match.endNodeNm || ""),
    };
  });
}
async function routeStops(cityCode: string, routeId: string) {
  return cached(`map-stops:${cityCode}:${routeId}`, 30 * 60_000, async () => {
    const response = await tago(TAGO_ROUTE_STOPS, { cityCode, routeId, numOfRows: 700 }, 16000);
    return response.items.map((item: any, index: number) => ({
      id: String(item.nodeid || item.nodeId || ""),
      name: String(item.nodenm || item.nodeNm || "정류장"),
      order: Number(item.nodeord ?? item.nodeOrd ?? index + 1),
      x: Number(item.gpslong ?? item.gpsLong),
      y: Number(item.gpslati ?? item.gpsLati),
    })).filter((stop: any) => stop.id && Number.isFinite(stop.x) && Number.isFinite(stop.y)).sort((a: any, b: any) => a.order - b.order);
  });
}
async function vehicleLocations(cityCode: string, routeId: string) {
  try {
    return await cached(`map-vehicles:${cityCode}:${routeId}`, 15_000, async () => {
      const response = await tago(TAGO_BUS_LOCATION, { cityCode, routeId, numOfRows: 200 }, 10000);
      return response.items.map((item: any) => ({
        vehicleNo: String(item.vehicleno || item.vehicleNo || ""),
        nodeId: String(item.nodeid || item.nodeId || ""),
        nodeName: String(item.nodenm || item.nodeNm || ""),
        nodeOrder: Number(item.nodeord ?? item.nodeOrd),
        x: Number(item.gpslong ?? item.gpsLong),
        y: Number(item.gpslati ?? item.gpsLati),
      })).filter((item: any) => Number.isFinite(item.x) && Number.isFinite(item.y));
    });
  } catch (error) {
    console.warn(`transit-map vehicle location unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
function stopIndex(stops: any[], id: string, name: string) {
  let index = stops.findIndex((stop) => stop.id === id);
  if (index >= 0) return index;
  const normalized = name.replace(/\s+/g, "");
  return stops.findIndex((stop) => normalized && stop.name.replace(/\s+/g, "") === normalized);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return reply({ error: "GET 요청만 지원합니다." }, 405);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "route-map";
  try {
    if (action === "health") return reply({
      ok: Boolean(DATA_GO_KR_SERVICE_KEY),
      provider: "TAGO-public-data",
      geometry: "route-stop-sequence",
      vehiclePositioning: "TAGO-bus-location-when-available",
    });
    if (action !== "route-map") return reply({ error: "지원하지 않는 요청입니다." }, 404);
    const region = safe(url.searchParams.get("region"), 60);
    const lineNo = safe(url.searchParams.get("line"), 50);
    const startId = safe(url.searchParams.get("startId"), 100);
    const endId = safe(url.searchParams.get("endId"), 100);
    const startName = safe(url.searchParams.get("startName"), 100);
    const endName = safe(url.searchParams.get("endName"), 100);
    if (!region || !lineNo || (!startId && !startName) || (!endId && !endName)) return reply({ error: "지역, 노선, 승차·하차 정류장 정보가 필요합니다." }, 400);

    const cityCode = await cityCodeForRegion(region);
    if (!cityCode) throw new Error("해당 지역의 버스 도시코드를 찾지 못했습니다.");
    const route = await routeAtStop(cityCode, startId, lineNo);
    if (!route.id) throw new Error("버스 노선 ID를 찾지 못했습니다.");
    const stops = await routeStops(cityCode, route.id);
    const startIndex = stopIndex(stops, startId, startName), endIndex = stopIndex(stops, endId, endName);
    if (startIndex < 0 || endIndex <= startIndex) throw new Error("승차·하차 순서에 맞는 노선 구간을 찾지 못했습니다.");
    const segmentStops = stops.slice(startIndex, endIndex + 1);
    const vehicles = await vehicleLocations(cityCode, route.id);
    const minOrder = Math.max(0, Number(segmentStops[0]?.order || 0) - 6);
    const maxOrder = Number(segmentStops.at(-1)?.order || Number.MAX_SAFE_INTEGER) + 2;
    const visibleVehicles = vehicles.filter((vehicle: any) => !Number.isFinite(vehicle.nodeOrder) || (vehicle.nodeOrder >= minOrder && vehicle.nodeOrder <= maxOrder)).slice(0, 20);

    return reply({
      generatedAt: new Date().toISOString(),
      provider: "TAGO-public-data",
      geometry: "route-stop-sequence",
      cityCode,
      route: { ...route, start: segmentStops[0], end: segmentStops.at(-1), stops: segmentStops },
      vehicles: visibleVehicles,
      vehicleStatus: visibleVehicles.length ? "live" : "unavailable",
    }, 200, "public, max-age=15");
  } catch (error) {
    const message = error instanceof Error ? error.message : "버스 지도 정보를 불러오지 못했습니다.";
    console.error(`transit-map: ${message}`);
    return reply({ error: message }, 502, "no-store");
  }
});
