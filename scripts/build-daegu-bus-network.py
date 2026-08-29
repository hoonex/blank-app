#!/usr/bin/env python3
"""Build a compact TS road-link network from the official Daegu bus SHP snapshot.

Official source (latest published snapshot verified 2026-08-30):
- 대구광역시_버스 노선 공간정보_20250903
- https://www.data.go.kr/data/15070487/fileData.do

Input directory must contain node_20250903.shp and link_20250903.shp plus sidecars.
The output is deterministic and is intended for the transit-map Supabase Edge function.
The official link records are a bus-road network; they are not individually asserted to
belong to a specific route. Runtime reconstruction is constrained by the current TAGO
stop sequence for the requested bus leg.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import shapefile
from pyproj import Transformer
from scipy.spatial import cKDTree
from shapely.geometry import LineString

SNAPSHOT = "2025-09-03"
SCALE = 1_000_000
ENDPOINT_SNAP_METERS = 60.0
SIMPLIFY_METERS = 1.5


def fields(reader):
    return [field[0] for field in reader.fields[1:]]


def source_crs(root: Path):
    text = (root / "node_20250903.prj").read_text("utf-8", errors="ignore")
    return text


def encode(points):
    ints = [[round(lon * SCALE), round(lat * SCALE)] for lon, lat in points]
    if not ints:
        return []
    out = [ints[0][0], ints[0][1]]
    previous = ints[0]
    for current in ints[1:]:
        out.extend([current[0] - previous[0], current[1] - previous[1]])
        previous = current
    return out


def json_compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    root = args.source
    to_wgs = Transformer.from_crs(source_crs(root), "EPSG:4326", always_xy=True)

    node_reader = shapefile.Reader(str(root / "node_20250903.shp"), encoding="utf-8")
    node_fields = fields(node_reader)
    source_nodes = []
    for sr in node_reader.iterShapeRecords():
        rec = dict(zip(node_fields, sr.record))
        if not sr.shape.points:
            continue
        x, y = sr.shape.points[0]
        source_nodes.append((x, y, str(rec.get("node_id") or "")))
    node_xy = [(x, y) for x, y, _ in source_nodes]
    tree = cKDTree(node_xy)
    node_index_by_source = {}
    node_ids = []

    def ensure_source_node(source_index):
        if source_index in node_index_by_source:
            return node_index_by_source[source_index]
        index = len(node_ids)
        node_index_by_source[source_index] = index
        node_ids.append(source_nodes[source_index][2])
        return index

    synthetic = {}

    def synthetic_node(x, y):
        key = (round(x, 2), round(y, 2))
        if key not in synthetic:
            synthetic[key] = len(node_ids)
            node_ids.append("")
        return synthetic[key]

    link_reader = shapefile.Reader(str(root / "link_20250903.shp"), encoding="utf-8")
    link_fields = fields(link_reader)
    edges = []
    for sr in link_reader.iterShapeRecords():
        rec = dict(zip(link_fields, sr.record))
        raw = sr.shape.points
        if len(raw) < 2:
            continue
        endpoints = []
        for x, y in (raw[0], raw[-1]):
            distance, source_index = tree.query((x, y))
            endpoints.append(ensure_source_node(int(source_index)) if distance <= ENDPOINT_SNAP_METERS else synthetic_node(x, y))
        wgs = [to_wgs.transform(x, y) for x, y in raw]
        source_line = LineString(raw).simplify(SIMPLIFY_METERS, preserve_topology=False)
        simplified_wgs = [to_wgs.transform(x, y) for x, y in source_line.coords]
        if len(simplified_wgs) < 2:
            simplified_wgs = [wgs[0], wgs[-1]]
        length = float(rec.get("shape_len") or 0.0)
        if not math.isfinite(length) or length <= 0:
            length = LineString(raw).length
        edges.append([endpoints[0], endpoints[1], round(length, 1), encode(simplified_wgs)])

    digest = ""
    if args.archive and args.archive.exists():
        digest = hashlib.sha256(args.archive.read_bytes()).hexdigest()

    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        "// Generated from official Daegu bus spatial data. Do not hand-edit.\n"
        f'export const OFFICIAL_ROUTE_SNAPSHOT="{SNAPSHOT}";\n'
        f'export const OFFICIAL_ROUTE_SHA256="{digest}";\n'
        f"export const OFFICIAL_COORD_SCALE={SCALE};\n"
        f"export const OFFICIAL_NODE_IDS={json_compact(node_ids)} as const;\n"
        f"export const OFFICIAL_EDGES={json_compact(edges)} as const;\n",
        "utf-8",
    )
    print(json.dumps({"snapshot": SNAPSHOT, "nodeCount": len(node_ids), "edgeCount": len(edges), "bytes": output.stat().st_size}, ensure_ascii=False))


if __name__ == "__main__":
    main()
