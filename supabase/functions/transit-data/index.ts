import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json; charset=utf-8" };
const SERVICE_AREA = Object.freeze({ id: "daegu", name: "대구광역시", policy: "source+destination-inside" });
const CORE_URL = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-data-core";
const MIXED_URL = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-mixed";
const KAKAO_LOCAL = "https://dapi.kakao.com/v2/local";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";
const DATA_GO_KR_SERVICE_KEY = Deno.env.get("DATA_GO_KR_SERVICE_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const MIXED_TIMEOUT_MS = 25_000;

const ROUTE_MODES = [
  "bus-direct",
  "bus-one-transfer",
  "bus-subway-bus",
  "bus-subway-walk",
  "walk-subway-bus",
];

type KakaoDocument = {
  id?: string;
  x?: string;
  y?: string;
  place_name?: string;
  address_name?: string;
  road_address_name?: string;
  region_1depth_name?: string;
  category_group_name?: string;
  category_name?: string;
  distance?: string;
  address?: { address_name?: string; region_1depth_name?: string };
  road_address?: { address_name?: string; region_1depth_name?: string } | null;
};

type ResolvedDestination = {
  x: number;
  y: number;
  name: string;
  address: string;
  region: string;
};

type DestinationSuggestion = {
  id: string;
  name: string;
  address: string;
  category: string;
  x: number;
  y: number;
  distanceMeters: number | null;
};

type InternalResult = {
  response: Response;
  body: any;
};

function reply(body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, "Cache-Control": cache } });
}

function finite(value: string | null, min: number, max: number) {
  if (value === null || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function isDaegu(region: unknown) {
  const value = String(region || "").trim();
  return value === SERVICE_AREA.name || value === "대구";
}

function regionFromAddress(address: unknown) {
  const value = String(address || "").trim();
  if (/^대구(?:광역시)?(?:\s|$)/.test(value)) return SERVICE_AREA.name;
  return value.split(/\s+/)[0] || "";
}

function outOfArea(position: "source" | "destination", region = "") {
  const subject = position === "source" ? "출발 위치" : "목적지";
  return reply({
    code: "OUT_OF_SERVICE_AREA",
    error: `${subject}가 대구광역시 밖입니다. Flow 교통은 현재 대구광역시 안에서만 경로를 검색합니다.`,
    position,
    detectedRegion: region || null,
    serviceArea: SERVICE_AREA,
    routes: [],
  }, 422);
}

async function kakao(path: string, params: Record<string, string>) {
  if (!KAKAO_REST_KEY) throw new Error("Kakao 지역 판정 설정이 준비되지 않았습니다.");
  const url = new URL(`${KAKAO_LOCAL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body?.message || `Kakao Local HTTP ${response.status}`));
  return body;
}

async function coordinateRegion(x: number, y: number) {
  const body = await kakao("/geo/coord2regioncode.json", { x: String(x), y: String(y) });
  const documents = Array.isArray(body?.documents) ? body.documents : [];
  const doc = documents.find((item: any) => item?.region_type === "H") || documents[0];
  return String(doc?.region_1depth_name || "").trim();
}

function destinationFromDocument(doc: KakaoDocument, fallbackName: string): ResolvedDestination | null {
  const x = Number(doc?.x), y = Number(doc?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const address = String(doc?.road_address_name || doc?.road_address?.address_name || doc?.address?.address_name || doc?.address_name || fallbackName || "").trim();
  const region = String(doc?.road_address?.region_1depth_name || doc?.address?.region_1depth_name || doc?.region_1depth_name || regionFromAddress(address) || "").trim();
  return {
    x,
    y,
    name: String(doc?.place_name || fallbackName || address || "목적지").trim(),
    address,
    region,
  };
}

function suggestionFromDocument(doc: KakaoDocument, fallbackName: string, source: "keyword" | "address"): DestinationSuggestion | null {
  const resolved = destinationFromDocument(doc, fallbackName);
  if (!resolved) return null;
  const region = resolved.region || regionFromAddress(resolved.address);
  if (!isDaegu(region)) return null;
  const categoryPath = String(doc?.category_name || "").split(">").map((value) => value.trim()).filter(Boolean);
  const category = source === "address"
    ? "주소"
    : String(doc?.category_group_name || categoryPath.at(-1) || "장소").trim();
  const rawDistance = Number(doc?.distance);
  return {
    id: String(doc?.id || `${resolved.x.toFixed(6)},${resolved.y.toFixed(6)}`),
    name: resolved.name,
    address: resolved.address,
    category,
    x: resolved.x,
    y: resolved.y,
    distanceMeters: Number.isFinite(rawDistance) && rawDistance >= 0 ? Math.round(rawDistance) : null,
  };
}

async function destinationSearch(query: string, sx: number | null, sy: number | null) {
  const keywordParams: Record<string, string> = { query, size: "10" };
  if (sx !== null && sy !== null) {
    keywordParams.x = String(sx);
    keywordParams.y = String(sy);
  }
  const [keywordSettled, addressSettled] = await Promise.allSettled([
    kakao("/search/keyword.json", keywordParams),
    kakao("/search/address.json", { query, size: "5" }),
  ]);
  if (keywordSettled.status === "rejected" && addressSettled.status === "rejected") {
    throw keywordSettled.reason;
  }
  const keywordDocs = keywordSettled.status === "fulfilled" && Array.isArray(keywordSettled.value?.documents)
    ? keywordSettled.value.documents : [];
  const addressDocs = addressSettled.status === "fulfilled" && Array.isArray(addressSettled.value?.documents)
    ? addressSettled.value.documents : [];
  const deduped = new Map<string, DestinationSuggestion>();
  for (const [doc, source] of [
    ...keywordDocs.map((doc: KakaoDocument) => [doc, "keyword"] as const),
    ...addressDocs.map((doc: KakaoDocument) => [doc, "address"] as const),
  ]) {
    const suggestion = suggestionFromDocument(doc, query, source);
    if (!suggestion) continue;
    const key = `${suggestion.name}|${suggestion.address}|${suggestion.x.toFixed(5)}|${suggestion.y.toFixed(5)}`;
    if (!deduped.has(key)) deduped.set(key, suggestion);
    if (deduped.size >= 6) break;
  }
  return reply({
    query,
    provider: "Kakao-Local",
    serviceArea: SERVICE_AREA,
    suggestions: [...deduped.values()],
  }, 200, "public, max-age=20");
}

async function withCoordinateRegion(destination: ResolvedDestination) {
  return { ...destination, region: await coordinateRegion(destination.x, destination.y) };
}

async function resolveDestination(query: string, ex: number | null, ey: number | null, preferredName = "", preferredAddress = "") {
  if (ex !== null && ey !== null) {
    const region = await coordinateRegion(ex, ey);
    return {
      x: ex,
      y: ey,
      name: String(preferredName || query || "목적지").trim() || "목적지",
      address: String(preferredAddress || "").trim(),
      region,
    } satisfies ResolvedDestination;
  }

  if (query) {
    const addressBody = await kakao("/search/address.json", { query });
    const addressDoc = Array.isArray(addressBody?.documents) ? addressBody.documents[0] : null;
    const addressResolved = addressDoc ? destinationFromDocument(addressDoc, query) : null;
    if (addressResolved) return await withCoordinateRegion(addressResolved);

    const keywordBody = await kakao("/search/keyword.json", { query, size: "5" });
    const keywordDoc = Array.isArray(keywordBody?.documents) ? keywordBody.documents[0] : null;
    const keywordResolved = keywordDoc ? destinationFromDocument(keywordDoc, query) : null;
    if (keywordResolved) return await withCoordinateRegion(keywordResolved);
    throw new Error("목적지를 찾지 못했습니다. 장소명이나 도로명 주소를 확인해주세요.");
  }

  throw new Error("목적지 이름이나 좌표가 필요합니다.");
}

async function internalRoute(endpoint: string, sx: number, sy: number, destination: ResolvedDestination, query = "", timeout = 125_000): Promise<InternalResult> {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Transit 내부 라우터 인증 설정이 준비되지 않았습니다.");
  const url = new URL(endpoint);
  url.searchParams.set("action", "route");
  url.searchParams.set("sx", String(sx));
  url.searchParams.set("sy", String(sy));
  url.searchParams.set("ex", String(destination.x));
  url.searchParams.set("ey", String(destination.y));
  if (query && endpoint === CORE_URL) url.searchParams.set("destination", query);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(timeout),
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function realtimeCoverageScore(route: any) {
  const segments = Array.isArray(route?.segments) ? route.segments : [];
  const busLegs = segments.filter((segment: any) => segment?.type === "bus").length;
  const liveLegs = Array.isArray(route?.realtimeLegs) ? route.realtimeLegs.length : 0;
  return busLegs ? Math.min(1, liveLegs / busLegs) : 0;
}

function realtimeAgeSeconds(route: any) {
  const legs = Array.isArray(route?.realtimeLegs) ? route.realtimeLegs : [];
  if (!legs.length) return Number.POSITIVE_INFINITY;
  const now = Date.now();
  return Math.max(...legs.map((leg: any) => {
    const checked = Date.parse(String(leg?.checkedAt || ""));
    return Number.isFinite(checked) ? Math.max(0, Math.floor((now - checked) / 1000)) : Number.POSITIVE_INFINITY;
  }));
}

function routeSort(a: any, b: any) {
  return Number(a?.totalMinutes || 0) - Number(b?.totalMinutes || 0)
    || Number(a?.transfers || 0) - Number(b?.transfers || 0)
    || realtimeCoverageScore(b) - realtimeCoverageScore(a)
    || realtimeAgeSeconds(a) - realtimeAgeSeconds(b)
    || Number(a?.walkMeters || 0) - Number(b?.walkMeters || 0);
}

function routeSignature(route: any) {
  return (Array.isArray(route?.segments) ? route.segments : [])
    .filter((segment: any) => segment?.type === "bus" || segment?.type === "subway")
    .map((segment: any) => `${segment.type}:${(segment.lines || []).join(",")}:${segment.startId || segment.startName || ""}:${segment.endId || segment.endName || ""}`)
    .join("|");
}

function isMixedRoute(route: any) {
  const segments = Array.isArray(route?.segments) ? route.segments : [];
  return segments.some((segment: any) => segment?.type === "bus")
    && segments.some((segment: any) => segment?.type === "subway");
}

function mergedRoutes(busRoutes: any[], mixedRoutes: any[]) {
  const deduped = new Map<string, any>();
  for (const route of [...busRoutes, ...mixedRoutes]) {
    const signature = routeSignature(route) || String(route?.id || deduped.size);
    const previous = deduped.get(signature);
    if (!previous || routeSort(route, previous) < 0) deduped.set(signature, route);
  }
  const ranked = [...deduped.values()].sort(routeSort);
  const routes = ranked.slice(0, 5);
  const bestMixed = ranked.find(isMixedRoute) || null;
  if (bestMixed && !routes.some(isMixedRoute)) {
    if (routes.length >= 5) routes[routes.length - 1] = bestMixed;
    else routes.push(bestMixed);
    routes.sort(routeSort);
  }
  if (!routes.length) return routes;
  const minWalk = Math.min(...routes.map((route) => Number(route?.walkMeters || 0)));
  const minTransfers = Math.min(...routes.map((route) => Number(route?.transfers || 0)));
  routes.forEach((route, index) => {
    const badges: string[] = [];
    if (index === 0) badges.push("추천");
    if (index !== 0 && Number(route?.walkMeters || 0) === minWalk) badges.push("걷기 적음");
    if (index !== 0 && Number(route?.transfers || 0) === minTransfers && badges.length < 2) badges.push("환승 적음");
    route.id = `route-${index + 1}`;
    route.badges = badges;
    route.arrivalAt = new Date(Date.now() + Math.max(1, Number(route?.totalMinutes || 1)) * 60_000).toISOString();
  });
  return routes;
}

function realtimeCoverage(routes: any[]) {
  if (!routes.some((route) => Array.isArray(route?.realtimeLegs) && route.realtimeLegs.length)) return "none";
  return routes.some((route) => Array.isArray(route?.realtimeLegs) && route.realtimeLegs.length > 1) ? "multi-leg" : "partial";
}

function failureMessage(result: InternalResult | null, fallback: string) {
  return String(result?.body?.error || result?.body?.message || fallback);
}

function rejectedMessage(result: PromiseSettledResult<InternalResult>) {
  if (result.status !== "rejected") return null;
  return String(result.reason instanceof Error ? result.reason.message : result.reason || "");
}

function timeoutLike(message: string | null) {
  return Boolean(message && /(timeout|timed out|abort)/i.test(message));
}

async function routeData(sx: number, sy: number, query: string, destination: ResolvedDestination) {
  const [coreSettled, mixedSettled] = await Promise.allSettled([
    internalRoute(CORE_URL, sx, sy, destination, query),
    internalRoute(MIXED_URL, sx, sy, destination, "", MIXED_TIMEOUT_MS),
  ]);
  const core = coreSettled.status === "fulfilled" ? coreSettled.value : null;
  const mixed = mixedSettled.status === "fulfilled" ? mixedSettled.value : null;
  const coreFailure = rejectedMessage(coreSettled);
  const mixedFailure = rejectedMessage(mixedSettled);
  const busRoutes = core?.response.ok && Array.isArray(core.body?.routes) ? core.body.routes : [];
  const mixedRoutes = mixed?.response.ok && Array.isArray(mixed.body?.routes) ? mixed.body.routes : [];
  const routes = mergedRoutes(busRoutes, mixedRoutes);

  if (!routes.length) {
    const primary = core || mixed;
    const message = coreFailure || failureMessage(core, "공공 교통데이터에서 연결 가능한 경로를 찾지 못했습니다.");
    return reply({
      ...(primary?.body && typeof primary.body === "object" ? primary.body : {}),
      error: message || "공공 교통데이터에서 연결 가능한 경로를 찾지 못했습니다.",
      destination,
      provider: "TAGO-public-data",
      serviceArea: SERVICE_AREA,
      routeModes: ROUTE_MODES,
      mixedRouting: "protected-orchestrator",
      mixedBudgetMs: MIXED_TIMEOUT_MS,
      mixedTimedOut: timeoutLike(mixedFailure),
      mixedModeProvider: mixed?.body?.provider || null,
      routes: [],
    }, primary?.response?.status || 502, "no-store");
  }

  const coreMeta = core?.body && typeof core.body === "object" ? { ...core.body } : {};
  delete coreMeta.routes;
  delete coreMeta.error;
  return reply({
    ...coreMeta,
    generatedAt: new Date().toISOString(),
    destination,
    provider: "TAGO-public-data",
    providers: ["TAGO-public-data", ...(mixedRoutes.length ? ["KRIC-snapshot+Kakao-SW8"] : [])],
    serviceArea: SERVICE_AREA,
    realtimeCoverage: realtimeCoverage(routes),
    routeModes: ROUTE_MODES,
    mixedRouting: "protected-orchestrator",
    mixedBudgetMs: MIXED_TIMEOUT_MS,
    mixedSearchMs: Number.isFinite(Number(mixed?.body?.searchMs)) ? Number(mixed.body.searchMs) : null,
    mixedTimedOut: timeoutLike(mixedFailure),
    mixedModeProvider: mixedRoutes.length ? String(mixed?.body?.provider || "TAGO-public-data+KRIC-snapshot+Kakao-SW8") : null,
    mixedAvailable: mixedRoutes.length > 0,
    busError: core?.response.ok ? null : coreFailure || failureMessage(core, "버스 경로를 찾지 못했습니다."),
    mixedError: mixed?.response.ok ? null : mixedFailure || failureMessage(mixed, "혼합 경로를 만들지 못했습니다."),
    routes,
  }, 200, "public, max-age=15");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return reply({ error: "GET 요청만 지원합니다." }, 405);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "route";
  try {
    if (action === "health") {
      return reply({
        ok: Boolean(DATA_GO_KR_SERVICE_KEY && KAKAO_REST_KEY && SUPABASE_SERVICE_ROLE_KEY),
        integrations: {
          publicData: Boolean(DATA_GO_KR_SERVICE_KEY),
          kakao: Boolean(KAKAO_REST_KEY),
          coreAuth: Boolean(SUPABASE_SERVICE_ROLE_KEY),
          mixedAuth: Boolean(SUPABASE_SERVICE_ROLE_KEY),
        },
        routingProvider: "TAGO-public-data",
        destinationSearch: "Kakao-Local-keyword+address",
        stopDiscovery: ["coordinate-500m", "city-stop-master"],
        routeModes: ROUTE_MODES,
        mixedRouting: "protected-orchestrator",
        mixedBudgetMs: MIXED_TIMEOUT_MS,
        realtimeRouting: "cache-age-adjusted-per-bus-leg",
        realtimeFreshness: "provider-fetchedAt+cache-age-adjusted",
        railRealtime: false,
        regionalRouting: "daegu-only-source+destination",
        transferMatching: "node-id+walkable-stop-proximity",
        serviceArea: SERVICE_AREA,
        coreAccess: "service-role-jwt-only",
        mixedAccess: "service-role-jwt-only",
        plannedGtfsUpgrade: "2026-09-07",
      });
    }

    if (action === "destination-search") {
      const query = String(url.searchParams.get("query") || "").trim();
      if (query.length < 2) return reply({ query, provider: "Kakao-Local", serviceArea: SERVICE_AREA, suggestions: [] });
      const sx = finite(url.searchParams.get("sx"), -180, 180);
      const sy = finite(url.searchParams.get("sy"), -90, 90);
      return await destinationSearch(query, sx, sy);
    }

    if (action !== "route") return reply({ error: "지원하지 않는 요청입니다." }, 404);

    const sx = finite(url.searchParams.get("sx"), -180, 180);
    const sy = finite(url.searchParams.get("sy"), -90, 90);
    if (sx === null || sy === null) return reply({ error: "현재 위치 좌표가 필요합니다." }, 400);

    const sourceRegion = await coordinateRegion(sx, sy);
    if (!isDaegu(sourceRegion)) return outOfArea("source", sourceRegion);

    const ex = finite(url.searchParams.get("ex"), -180, 180);
    const ey = finite(url.searchParams.get("ey"), -90, 90);
    const query = String(url.searchParams.get("destination") || "").trim();
    const preferredName = String(url.searchParams.get("destinationName") || "").trim();
    const preferredAddress = String(url.searchParams.get("destinationAddress") || "").trim();
    const destination = await resolveDestination(query, ex, ey, preferredName, preferredAddress);
    if (!isDaegu(destination.region)) return outOfArea("destination", destination.region);

    const coreQuery = ex !== null && ey !== null ? "" : query;
    return await routeData(sx, sy, coreQuery, destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : "교통 정보를 불러오지 못했습니다.";
    console.error(`transit-data gate: ${message}`);
    return reply({ error: message, serviceArea: SERVICE_AREA, routes: [] }, 502);
  }
});
