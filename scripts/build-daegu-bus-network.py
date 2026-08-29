#!/usr/bin/env python3
"""Build a compact TS road-link network from the official Daegu bus SHP snapshot.

Input directory must contain node_20250903.shp and link_20250903.shp plus sidecars.
The output is deterministic and is intended for the transit-map Supabase Edge function.
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
EXPECTED_ARCHIVE_SHA256 = "98d6a7725e3fddbcd65c58af3fadc217378ee8bfec82e29e2931341e19f86a1e"
ENDPOINT_NODE_TOLERANCE_METERS = 60.0
SIMPLIFY_METERS = 1.5
COORD_SCALE = 1_000_000


def reader(path: Path) -> shapefile.Reader:
    return shapefile.Reader(str(path), encoding="utf-8")


def records_with_shapes(path: Path):
    src = reader(path)
    fields = [field[0] for field in src.fields[1:]]
    for shape_record in src.iterShapeRecords():
        yield dict(zip(fields, shape_record.record)), shape_record.shape


def build(source: Path) -> tuple[list[str], list[list[object]]]:
    node_path = source / "node_20250903.shp"
    link_path = source / "link_20250903.shp"
    if not node_path.exists() or not link_path.exists():
        raise SystemExit("Official node/link SHP layers are missing")

    nodes: list[tuple[float, float, str]] = []
    for props, shape in records_with_shapes(node_path):
        x, y = shape.points[0]
        nodes.append((x, y, str(props.get("node_id") or "")))
    if not nodes:
        raise SystemExit("Official node layer is empty")

    node_tree = cKDTree([(x, y) for x, y, _ in nodes])
    transformer = Transformer.from_crs(5187, 4326, always_xy=True)
    synthetic: dict[tuple[float, float], int] = {}
    edges: list[list[object]] = []

    for props, shape in records_with_shapes(link_path):
        points = shape.points
        if len(points) < 2:
            continue
        endpoints: list[int] = []
        for point in (points[0], points[-1]):
            distance, node_index = node_tree.query(point)
            if float(distance) <= ENDPOINT_NODE_TOLERANCE_METERS:
                endpoint = int(node_index)
            else:
                key = (round(point[0], 1), round(point[1], 1))
                endpoint = synthetic.setdefault(key, len(nodes) + len(synthetic))
            endpoints.append(endpoint)

        simplified = list(LineString(points).simplify(SIMPLIFY_METERS, preserve_topology=False).coords)
        encoded: list[int] = []
        previous_x = previous_y = None
        for x, y in simplified:
            lon, lat = transformer.transform(x, y)
            current_x, current_y = round(lon * COORD_SCALE), round(lat * COORD_SCALE)
            if previous_x is None:
                encoded.extend((current_x, current_y))
            else:
                encoded.extend((current_x - previous_x, current_y - previous_y))
            previous_x, previous_y = current_x, current_y

        length = float(props.get("shape_len") or 0.0)
        if not math.isfinite(length) or length <= 0:
            length = LineString(points).length
        edges.append([endpoints[0], endpoints[1], round(length, 1), encoded])

    node_ids = [node_id for _, _, node_id in nodes] + [""] * len(synthetic)
    return node_ids, edges


def render(node_ids: list[str], edges: list[list[object]]) -> str:
    header = (
        "// GENERATED FILE. Source: 대구광역시_버스 노선 공간정보_20250903.\n"
        "// Regenerate with scripts/build-daegu-bus-network.py; do not hand edit.\n"
        f'export const OFFICIAL_ROUTE_SNAPSHOT="{SNAPSHOT}";\n'
        f'export const OFFICIAL_ROUTE_SHA256="{EXPECTED_ARCHIVE_SHA256}";\n'
        f"export const OFFICIAL_COORD_SCALE={COORD_SCALE};\n"
    )
    return (
        header
        + "export const OFFICIAL_NODE_IDS="
        + json.dumps(node_ids, ensure_ascii=False, separators=(",", ":"))
        + " as const;\nexport const OFFICIAL_EDGES="
        + json.dumps(edges, separators=(",", ":"))
        + " as const;\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    if args.archive:
        digest = hashlib.sha256(args.archive.read_bytes()).hexdigest()
        if digest != EXPECTED_ARCHIVE_SHA256:
            raise SystemExit(f"Unexpected official archive SHA-256: {digest}")
    node_ids, edges = build(args.source)
    text = render(node_ids, edges)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(text, "utf-8")
    print(json.dumps({"snapshot": SNAPSHOT, "nodeCount": len(node_ids), "edgeCount": len(edges), "bytes": len(text.encode("utf-8"))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
