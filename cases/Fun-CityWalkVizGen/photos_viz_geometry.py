"""Geometry distance helpers for nearest-place lookup.

All distances are returned in meters.
"""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6371000.0


def haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Return great-circle distance in meters between two lon/lat points."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return EARTH_RADIUS_M * c


def _safe_lonlat(coord) -> tuple[float, float] | None:
    """Convert a coordinate-like value into (lon, lat), or None if invalid."""
    if not isinstance(coord, (list, tuple)) or len(coord) < 2:
        return None
    try:
        lon = float(coord[0])
        lat = float(coord[1])
    except (TypeError, ValueError):
        return None
    return lon, lat


def lonlat_to_local_xy_m(
    lon: float,
    lat: float,
    origin_lon: float,
    origin_lat: float,
) -> tuple[float, float]:
    """Project lon/lat to local tangent-plane meters around origin."""
    x = math.radians(lon - origin_lon) * EARTH_RADIUS_M * math.cos(math.radians(origin_lat))
    y = math.radians(lat - origin_lat) * EARTH_RADIUS_M
    return x, y


def point_to_segment_distance_m(
    point_lon: float,
    point_lat: float,
    seg_start_lon: float,
    seg_start_lat: float,
    seg_end_lon: float,
    seg_end_lat: float,
) -> float:
    """Return shortest local-planar distance from point to a segment, in meters."""
    px, py = 0.0, 0.0
    ax, ay = lonlat_to_local_xy_m(seg_start_lon, seg_start_lat, point_lon, point_lat)
    bx, by = lonlat_to_local_xy_m(seg_end_lon, seg_end_lat, point_lon, point_lat)

    dx = bx - ax
    dy = by - ay
    denom = dx * dx + dy * dy
    if denom <= 1e-12:
        return math.hypot(px - ax, py - ay)

    t = ((px - ax) * dx + (py - ay) * dy) / denom
    t = max(0.0, min(1.0, t))
    qx = ax + t * dx
    qy = ay + t * dy
    return math.hypot(px - qx, py - qy)


def _iter_line_segments(coords, closed: bool = False):
    """Yield adjacent segments from a coordinate list.

    If closed=True, also emit a segment from last point to first point when needed.
    """
    if not isinstance(coords, list):
        return

    points: list[tuple[float, float]] = []
    for coord in coords:
        pair = _safe_lonlat(coord)
        if pair is not None:
            points.append(pair)

    if len(points) < 2:
        return

    for idx in range(1, len(points)):
        yield points[idx - 1], points[idx]

    if closed and points[0] != points[-1]:
        yield points[-1], points[0]


def linestring_distance_m(point_lon: float, point_lat: float, coords) -> float | None:
    """Return shortest distance from point to LineString coordinates."""
    best: float | None = None
    for (lon_a, lat_a), (lon_b, lat_b) in _iter_line_segments(coords):
        dist = point_to_segment_distance_m(point_lon, point_lat, lon_a, lat_a, lon_b, lat_b)
        if best is None or dist < best:
            best = dist
    return best


def multilinestring_distance_m(point_lon: float, point_lat: float, coords) -> float | None:
    """Return shortest distance from point to MultiLineString coordinates."""
    if not isinstance(coords, list):
        return None

    best: float | None = None
    for line in coords:
        dist = linestring_distance_m(point_lon, point_lat, line)
        if dist is None:
            continue
        if best is None or dist < best:
            best = dist
    return best


def _point_in_ring(point_lon: float, point_lat: float, ring) -> bool:
    """Return True if point is inside ring using ray casting on lon/lat."""
    if not isinstance(ring, list):
        return False

    points: list[tuple[float, float]] = []
    for coord in ring:
        pair = _safe_lonlat(coord)
        if pair is not None:
            points.append(pair)

    if len(points) < 3:
        return False

    inside = False
    j = len(points) - 1
    for i in range(len(points)):
        xi, yi = points[i]
        xj, yj = points[j]
        intersects = ((yi > point_lat) != (yj > point_lat)) and (
            point_lon < (xj - xi) * (point_lat - yi) / ((yj - yi) if abs(yj - yi) > 1e-12 else 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _polygon_boundary_distance_m(point_lon: float, point_lat: float, rings) -> float | None:
    """Return shortest distance from point to any polygon ring boundary."""
    if not isinstance(rings, list):
        return None

    best: float | None = None
    for ring in rings:
        for (lon_a, lat_a), (lon_b, lat_b) in _iter_line_segments(ring, closed=True):
            dist = point_to_segment_distance_m(point_lon, point_lat, lon_a, lat_a, lon_b, lat_b)
            if best is None or dist < best:
                best = dist
    return best


def polygon_distance_m(point_lon: float, point_lat: float, rings) -> float | None:
    """Return distance from point to polygon with hole handling.

    Distance is zero when the point is inside outer ring and outside holes.
    """
    if not isinstance(rings, list) or not rings:
        return None

    outer = rings[0]
    if _point_in_ring(point_lon, point_lat, outer):
        in_hole = False
        for hole in rings[1:]:
            if _point_in_ring(point_lon, point_lat, hole):
                in_hole = True
                break
        if not in_hole:
            return 0.0

    return _polygon_boundary_distance_m(point_lon, point_lat, rings)


def multipolygon_distance_m(point_lon: float, point_lat: float, polygons) -> float | None:
    """Return shortest distance from point to MultiPolygon coordinates."""
    if not isinstance(polygons, list):
        return None

    best: float | None = None
    for polygon in polygons:
        dist = polygon_distance_m(point_lon, point_lat, polygon)
        if dist is None:
            continue
        if best is None or dist < best:
            best = dist
    return best


def distance_to_geometry_m(
    point_lon: float,
    point_lat: float,
    geometry_type: str,
    coordinates,
) -> float | None:
    """Return shortest distance from point to the given GeoJSON geometry."""
    if geometry_type == "Point":
        pair = _safe_lonlat(coordinates)
        if pair is None:
            return None
        return haversine_distance_meters(point_lon, point_lat, pair[0], pair[1])

    if geometry_type == "MultiPoint":
        if not isinstance(coordinates, list):
            return None
        best: float | None = None
        for coord in coordinates:
            pair = _safe_lonlat(coord)
            if pair is None:
                continue
            dist = haversine_distance_meters(point_lon, point_lat, pair[0], pair[1])
            if best is None or dist < best:
                best = dist
        return best

    if geometry_type == "LineString":
        return linestring_distance_m(point_lon, point_lat, coordinates)

    if geometry_type == "MultiLineString":
        return multilinestring_distance_m(point_lon, point_lat, coordinates)

    if geometry_type == "Polygon":
        return polygon_distance_m(point_lon, point_lat, coordinates)

    if geometry_type == "MultiPolygon":
        return multipolygon_distance_m(point_lon, point_lat, coordinates)

    return None
