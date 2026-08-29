import {
  OFFICIAL_COORD_SCALE,
  OFFICIAL_EDGES,
  OFFICIAL_NODE_IDS,
  OFFICIAL_ROUTE_SHA256,
  OFFICIAL_ROUTE_SNAPSHOT,
} from "./daegu-official-network.ts";

type Coord = { x: number; y: number };
type StopLike = { id?: string; x?: number; y?: number };
type Edge = { a: number; b: number; length: number; points: Coord[] };
type Hop = { to: number; edge: number; length: number };
type Graph = {
  nodeIds: readonly string[];
  nodeById: Map<string, number>;
  coords: Array<Coord | null>;
  edges: Edge[];
  adjacency: Hop[][];
};

export type OfficialRouteGeometry = {
  ok: boolean;
  source: "daegu-official-bus-link-snapshot";
  snapshot: string;
  sourceSha256: string;
  path: Coord[];
  routedPairs: number;
  matchedStops: number;
  maxSnapMeters: number;
  reason?: string;
};

const STOP_SNAP_MAX_METERS = 220;
const EXACT_ID_MAX_METERS = 360;
const EPSILON_METERS = 0.35;
let cachedGraph: Graph | null = null;

function meters(a: Coord, b: Coord) {
  const lat = ((a.y + b.y) / 2) * Math.PI / 180;
  const dx = (a.x - b.x) * 111_320 * Math.cos(lat);
  const dy = (a.y - b.y) * 110_540;
  return Math.hypot(dx, dy);
}

function decode(encoded: readonly number[]) {
  const points: Coord[] = [];
  if (encoded.length < 4) return points;
  let x = Number(encoded[0]);
  let y = Number(encoded[1]);
  points.push({ x: x / OFFICIAL_COORD_SCALE, y: y / OFFICIAL_COORD_SCALE });
  for (let index = 2; index + 1 < encoded.length; index += 2) {
    x += Number(encoded[index]);
    y += Number(encoded[index + 1]);
    points.push({ x: x / OFFICIAL_COORD_SCALE, y: y / OFFICIAL_COORD_SCALE });
  }
  return points;
}

function idCandidates(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const strippedPrefix = raw.replace(/^[A-Za-z_-]+/, "");
  const digits = raw.replace(/\D+/g, "");
  const values = [raw, strippedPrefix, digits];
  if (digits.length > 10) values.push(digits.slice(-10));
  return [...new Set(values.filter(Boolean))];
}

function graph() {
  if (cachedGraph) return cachedGraph;
  const nodeIds = OFFICIAL_NODE_IDS as unknown as readonly string[];
  const rawEdges = OFFICIAL_EDGES as unknown as readonly [number, number, number, readonly number[]][];
  const coords: Array<Coord | null> = Array.from({ length: nodeIds.length }, () => null);
  const adjacency: Hop[][] = Array.from({ length: nodeIds.length }, () => []);
  const edges: Edge[] = [];
  const nodeById = new Map<string, number>();
  nodeIds.forEach((id, index) => {
    if (!id) return;
    for (const candidate of idCandidates(id)) if (!nodeById.has(candidate)) nodeById.set(candidate, index);
  });

  for (const [aRaw, bRaw, lengthRaw, encoded] of rawEdges) {
    const a = Number(aRaw), b = Number(bRaw), length = Number(lengthRaw);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= coords.length || b >= coords.length) continue;
    const points = decode(encoded);
    if (points.length < 2 || !Number.isFinite(length) || length <= 0) continue;
    const edgeIndex = edges.length;
    edges.push({ a, b, length, points });
    coords[a] ||= points[0];
    coords[b] ||= points.at(-1) || null;
    adjacency[a].push({ to: b, edge: edgeIndex, length });
    adjacency[b].push({ to: a, edge: edgeIndex, length });
  }

  cachedGraph = { nodeIds, nodeById, coords, edges, adjacency };
  return cachedGraph;
}

function matchNode(stop: StopLike, state: Graph) {
  const coordinate = { x: Number(stop?.x), y: Number(stop?.y) };
  if (!Number.isFinite(coordinate.x) || !Number.isFinite(coordinate.y)) return null;

  for (const candidate of idCandidates(stop?.id)) {
    const index = state.nodeById.get(candidate);
    const node = index === undefined ? null : state.coords[index];
    if (!node) continue;
    const distance = meters(coordinate, node);
    if (distance <= EXACT_ID_MAX_METERS) return { index, distance, mode: "id" as const };
  }

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < state.coords.length; index += 1) {
    const node = state.coords[index];
    if (!node) continue;
    const distance = meters(coordinate, node);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  if (bestIndex < 0 || bestDistance > STOP_SNAP_MAX_METERS) return null;
  return { index: bestIndex, distance: bestDistance, mode: "coordinate" as const };
}

class MinHeap {
  private values: Array<[number, number]> = [];
  push(priority: number, node: number) {
    const values = this.values;
    values.push([priority, node]);
    let index = values.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (values[parent][0] <= priority) break;
      values[index] = values[parent];
      index = parent;
    }
    values[index] = [priority, node];
  }
  pop() {
    const values = this.values;
    if (!values.length) return null;
    const root = values[0];
    const last = values.pop()!;
    if (values.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1, right = left + 1;
        if (left >= values.length) break;
        const child = right < values.length && values[right][0] < values[left][0] ? right : left;
        if (values[child][0] >= last[0]) break;
        values[index] = values[child];
        index = child;
      }
      values[index] = last;
    }
    return root;
  }
  get size() { return this.values.length; }
}

function routePair(start: number, goal: number, state: Graph) {
  if (start === goal) return { points: [] as Coord[], distance: 0 };
  const goalCoord = state.coords[goal];
  if (!goalCoord) return null;
  const count = state.coords.length;
  const distance = new Float64Array(count);
  distance.fill(Number.POSITIVE_INFINITY);
  const previousNode = new Int32Array(count); previousNode.fill(-1);
  const previousEdge = new Int32Array(count); previousEdge.fill(-1);
  const closed = new Uint8Array(count);
  const heap = new MinHeap();
  distance[start] = 0;
  const startCoord = state.coords[start];
  heap.push(startCoord ? meters(startCoord, goalCoord) : 0, start);

  while (heap.size) {
    const entry = heap.pop();
    if (!entry) break;
    const [, node] = entry;
    if (closed[node]) continue;
    closed[node] = 1;
    if (node === goal) break;
    for (const hop of state.adjacency[node]) {
      if (closed[hop.to]) continue;
      const nextDistance = distance[node] + hop.length;
      if (nextDistance + EPSILON_METERS >= distance[hop.to]) continue;
      distance[hop.to] = nextDistance;
      previousNode[hop.to] = node;
      previousEdge[hop.to] = hop.edge;
      const coordinate = state.coords[hop.to];
      const heuristic = coordinate ? meters(coordinate, goalCoord) : 0;
      heap.push(nextDistance + heuristic, hop.to);
    }
  }

  if (!Number.isFinite(distance[goal])) return null;
  const steps: Array<{ from: number; to: number; edge: number }> = [];
  let node = goal;
  while (node !== start) {
    const from = previousNode[node], edge = previousEdge[node];
    if (from < 0 || edge < 0) return null;
    steps.push({ from, to: node, edge });
    node = from;
  }
  steps.reverse();

  const points: Coord[] = [];
  for (const step of steps) {
    const edge = state.edges[step.edge];
    const oriented = edge.a === step.from && edge.b === step.to ? edge.points : [...edge.points].reverse();
    for (const point of oriented) {
      const previous = points.at(-1);
      if (!previous || meters(previous, point) > EPSILON_METERS) points.push(point);
    }
  }
  return { points, distance: distance[goal] };
}

function mergePath(target: Coord[], source: Coord[]) {
  for (const point of source) {
    const previous = target.at(-1);
    if (!previous || meters(previous, point) > EPSILON_METERS) target.push(point);
  }
}

export function buildOfficialRouteGeometry(stops: StopLike[]): OfficialRouteGeometry {
  const state = graph();
  const base = {
    source: "daegu-official-bus-link-snapshot" as const,
    snapshot: OFFICIAL_ROUTE_SNAPSHOT,
    sourceSha256: OFFICIAL_ROUTE_SHA256,
  };
  if (!Array.isArray(stops) || stops.length < 2) return { ...base, ok: false, path: [], routedPairs: 0, matchedStops: 0, maxSnapMeters: 0, reason: "insufficient-stops" };

  const matches = stops.map((stop) => matchNode(stop, state));
  const matchedStops = matches.filter(Boolean).length;
  const maxSnapMeters = Math.max(0, ...matches.map((match) => match?.distance || 0));
  if (matchedStops !== stops.length) return { ...base, ok: false, path: [], routedPairs: 0, matchedStops, maxSnapMeters, reason: "stop-outside-official-network" };

  const path: Coord[] = [];
  let routedPairs = 0;
  for (let index = 0; index < matches.length - 1; index += 1) {
    const from = matches[index]!, to = matches[index + 1]!;
    if (from.index === to.index) continue;
    const routed = routePair(from.index, to.index, state);
    if (!routed || routed.points.length < 2) return { ...base, ok: false, path: [], routedPairs, matchedStops, maxSnapMeters, reason: `disconnected-stop-pair-${index}` };
    mergePath(path, routed.points);
    routedPairs += 1;
  }
  if (path.length < 2) return { ...base, ok: false, path: [], routedPairs, matchedStops, maxSnapMeters, reason: "empty-official-path" };
  return { ...base, ok: true, path, routedPairs, matchedStops, maxSnapMeters };
}
