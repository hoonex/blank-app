import {
  OFFICIAL_COORD_SCALE,
  OFFICIAL_EDGES,
  OFFICIAL_NODE_IDS,
  OFFICIAL_ROUTE_SHA256,
  OFFICIAL_ROUTE_SNAPSHOT,
} from "https://raw.githubusercontent.com/hoonex/blank-app/ae08a29d5b1a17c7172572465e75739769945610/supabase/functions/transit-map/daegu-official-network.ts";

export const DAEGU_OFFICIAL_STOP_SNAPSHOT = OFFICIAL_ROUTE_SNAPSHOT;
export const DAEGU_OFFICIAL_STOP_SOURCE_SHA256 = OFFICIAL_ROUTE_SHA256;

type Coord = { x: number; y: number };
export type OfficialStopCandidate = Coord & {
  id: string;
  name: string;
  distance: number;
};

let cachedNodes: Array<{ id: string; x: number; y: number }> | null = null;

function meters(ax: number, ay: number, bx: number, by: number) {
  const lat = ((ay + by) / 2) * Math.PI / 180;
  const dx = (ax - bx) * 111_320 * Math.cos(lat);
  const dy = (ay - by) * 110_540;
  return Math.hypot(dx, dy);
}

function tagoDaeguNodeId(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^DGB[0-9]+$/i.test(raw)) return raw.toUpperCase();
  const digits = raw.replace(/\D+/g, "");
  return digits ? `DGB${digits}` : "";
}

function nodes() {
  if (cachedNodes) return cachedNodes;
  const ids = OFFICIAL_NODE_IDS as unknown as readonly string[];
  const edges = OFFICIAL_EDGES as unknown as readonly [number, number, number, readonly number[]][];
  const coords: Array<Coord | null> = Array.from({ length: ids.length }, () => null);

  for (const [aRaw, bRaw, _length, encoded] of edges) {
    const a = Number(aRaw), b = Number(bRaw);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= coords.length || b >= coords.length || encoded.length < 4) continue;
    let x = Number(encoded[0]), y = Number(encoded[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const first = { x: x / OFFICIAL_COORD_SCALE, y: y / OFFICIAL_COORD_SCALE };
    for (let index = 2; index + 1 < encoded.length; index += 2) {
      x += Number(encoded[index]);
      y += Number(encoded[index + 1]);
    }
    const last = { x: x / OFFICIAL_COORD_SCALE, y: y / OFFICIAL_COORD_SCALE };
    coords[a] ||= first;
    coords[b] ||= last;
  }

  const unique = new Map<string, { id: string; x: number; y: number }>();
  ids.forEach((value, index) => {
    const coordinate = coords[index];
    const id = tagoDaeguNodeId(value);
    if (!id || !coordinate || !Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)) return;
    if (!unique.has(id)) unique.set(id, { id, ...coordinate });
  });
  cachedNodes = [...unique.values()];
  return cachedNodes;
}

export function nearbyOfficialDaeguStops(x: number, y: number, limit = 8, maxMeters = 1800): OfficialStopCandidate[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  return nodes()
    .map((node) => ({ ...node, name: "정류장", distance: meters(x, y, node.x, node.y) }))
    .filter((node) => node.distance <= maxMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(1, Math.min(12, Math.floor(limit) || 8)));
}
