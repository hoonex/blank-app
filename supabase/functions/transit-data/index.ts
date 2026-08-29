import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json; charset=utf-8" };
const SERVICE_AREA = Object.freeze({ id: "daegu", name: "대구광역시", policy: "source+destination-inside" });
const CORE_URL = "https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-data-core";
const KAKAO_LOCAL = "https://dapi.kakao.com/v2/local";
const KAKAO_REST_KEY = Deno.env.get("KAKAO_REST_KEY") || "";
const DATA_GO_KR_SERVICE_KEY = Deno.env.get("DATA_GO_KR_SERVICE_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

type KakaoDocument = {
  x?: string;
  y?: string;
  place_name?: string;
  address_name?: string;
  region_1depth_name?: string;
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

function reply(body: unknown, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, "Cache-Control": cache } });
}

function finite(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function isDaegu(region: unknown) {
  const value=String(region || "").trim();
  return value === SERVICE_AREA.name || value === "대구";
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
  const address = String(doc?.road_address?.address_name || doc?.address?.address_name || doc?.address_name || fallbackName || "").trim();
  const region = String(doc?.road_address?.region_1depth_name || doc?.address?.region_1depth_name || doc?.region_1depth_name || "").trim();
  return {
    x,
    y,
    name: String(doc?.place_name || fallbackName || address || "목적지").trim(),
    address,
    region,
  };
}

async function withCoordinateRegion(destination: ResolvedDestination) {
  return { ...destination, region: await coordinateRegion(destination.x, destination.y) };
}

async function resolveDestination(query: string, ex: number | null, ey: number | null) {
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

  if (ex === null || ey === null) throw new Error("목적지 이름이나 좌표가 필요합니다.");
  const region = await coordinateRegion(ex, ey);
  return { x: ex, y: ey, name: "목적지", address: "", region } satisfies ResolvedDestination;
}

async function proxyCore(url: URL, destination: ResolvedDestination) {
  if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Transit 내부 라우터 인증 설정이 준비되지 않았습니다.");
  const core = new URL(CORE_URL);
  core.searchParams.set("action", "route");
  core.searchParams.set("sx", String(url.searchParams.get("sx") || ""));
  core.searchParams.set("sy", String(url.searchParams.get("sy") || ""));
  core.searchParams.set("ex", String(destination.x));
  core.searchParams.set("ey", String(destination.y));
  const query = String(url.searchParams.get("destination") || "").trim();
  if (query) core.searchParams.set("destination", query);

  const response = await fetch(core, {
    headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    signal: AbortSignal.timeout(125_000),
  });
  const body = await response.json().catch(() => ({}));
  const normalized = {
    ...body,
    destination,
    serviceArea: SERVICE_AREA,
  };
  return reply(normalized, response.status, response.ok ? "public, max-age=15" : "no-store");
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
        },
        routingProvider: "TAGO-public-data",
        stopDiscovery: ["coordinate-500m", "city-stop-master"],
        routeModes: ["bus-direct", "bus-one-transfer"],
        realtimeRouting: "per-bus-leg-when-available",
        regionalRouting: "daegu-only-source+destination",
        transferMatching: "node-id+walkable-stop-proximity",
        serviceArea: SERVICE_AREA,
        coreAccess: "service-role-jwt-only",
        plannedGtfsUpgrade: "2026-09-07",
      });
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
    const destination = await resolveDestination(query, ex, ey);
    if (!isDaegu(destination.region)) return outOfArea("destination", destination.region);

    return await proxyCore(url, destination);
  } catch (error) {
    const message = error instanceof Error ? error.message : "교통 정보를 불러오지 못했습니다.";
    console.error(`transit-data gate: ${message}`);
    return reply({ error: message, serviceArea: SERVICE_AREA, routes: [] }, 502);
  }
});
