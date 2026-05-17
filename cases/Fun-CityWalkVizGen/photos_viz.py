"""
photos_viz.py — Pixel 9 photo EXIF extractor + SVG/PNG map generator (Mercator projection).

Usage:
    python photos_viz.py <photos_dir> [--geojson photos_viz.geojson]
                                      [--padding 0.1]

Outputs:
    <photos_dir_name>/  — output folder created in current working directory.
    <photo_stem>_map.png — one 512×512 map per geotagged photo.
"""

import argparse
import json
import math
import os
import sys
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import urllib.parse
from fractions import Fraction
from pathlib import Path

from PIL import Image, ExifTags
import cairosvg
import osm2geojson

# ── Constants ────────────────────────────────────────────────────────────────

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".tiff", ".tif", ".heif", ".heic"}

GPS_IFD_TAG = 0x8825          # pointer to GPS sub-IFD in root EXIF
EXIF_IFD_TAG = 0x8769         # pointer to Exif sub-IFD in root EXIF
TAG_DATETIME_ORIGINAL = 0x9003
TAG_DATETIME_DIGITIZED = 0x9004

GPS_TAGS = {v: k for k, v in ExifTags.GPSTAGS.items()}  # name → tag id

SVG_WIDTH = 1000
SVG_HEIGHT = 1000
PNG_SIZE = 1000


CIRCLE_RADIUS = 32  # 4 times bigger
CIRCLE_STROKE_WIDTH = 8  # Adjust stroke width proportionally
CIRCLE_HALO_RADIUS = CIRCLE_RADIUS + 10
CIRCLE_HALO_OPACITY = 0.12

HIGHLIGHT_CIRCLE_RADIUS = 50  # 4 times bigger
HIGHLIGHT_CIRCLE_STROKE_WIDTH = 12  # Adjust stroke width proportionally
HIGHLIGHT_HALO_RADIUS = HIGHLIGHT_CIRCLE_RADIUS + 16
HIGHLIGHT_HALO_OPACITY = 0.32
HIGHLIGHT_RING_RADIUS = HIGHLIGHT_CIRCLE_RADIUS + 8
HIGHLIGHT_RING_STROKE_WIDTH = 6
HIGHLIGHT_CENTER_DOT_RADIUS = 6
HIGHLIGHT_CENTER_DOT_FILL = "#FFFFFF"

width_scaled = 4;  # Scale factor for line widths to make them more visible in the SVG
highway_simple_filter = { "motorway", "trunk", "primary", "secondary" }
highway_labels_filter = { "motorway", "trunk" }
use_highway_simple_filter = False  # Set to False to include all highway types, but it may cause visual clutter
use_svg_background = True  # Set to True to include a light background rectangle in the SVG for better contrast

# tertiary|residential|unclassified
HIGHWAY_WIDTHS = {
    "motorway": 6 * width_scaled,
    "trunk": 5 * width_scaled,
    "primary": 4 * width_scaled,
    "secondary": 3 * width_scaled,
    "tertiary": 2 * width_scaled,
    "residential": 1.5 * width_scaled,
    "unclassified": 1 * width_scaled,
    "service": 1 * width_scaled,
}

WATERWAY_WIDTHS = {
    "river": 2 * width_scaled,
    "canal": 1.5 * width_scaled,
    "stream": 1 * width_scaled,
    "ditch": 0.5 * width_scaled,
}

# Define scaled versions of constants
GEOJSON_POLYGON_STROKE_WIDTH = 0.5 * width_scaled
GEOJSON_LINE_STROKE_WIDTH = 2 * width_scaled
GEOJSON_POINT_STROKE_WIDTH = 3 * width_scaled
GEOJSON_POINT_RADIUS = 3 * width_scaled
GEOJSON_LABEL_FONT_SIZE = 20
LABEL_MIN_DIST = 50          # minimum pixel gap between any two labels
GEOJSON_LABEL_FONT_FAMILY = '"Lantinghei SC", sans-serif'
LANDMARK_DISTANCE_M_DEFAULT = 500.0
LANDMARK_POINT_RADIUS = 12
LANDMARK_POINT_STROKE_WIDTH = 2
LANDMARK_POINT_COLORS = {
    "amenity": "#F59E0B",
    "tourism": "#3B82F6",
    "historic": "#A855F7",
}
LANDMARK_POINT_STROKE_COLORS = {
    "amenity": "#B45309",
    "tourism": "#3B82F6",
    "historic": "#A855F7",
}
LANDMARK_CATEGORY_WEIGHTS = {
    "historic": 3.0,
    "tourism": 2.0,
    "amenity": 1.0,
}
LANDMARK_LABEL_MAX_COUNT = 32
LANDMARK_LABEL_MAX_PER_CELL = 2
LANDMARK_LABEL_GRID_SIZE = 150
LANDMARK_LABEL_PADDING = 8
LANDMARK_LABEL_PHOTO_AVOID_RADIUS = CIRCLE_HALO_RADIUS + 8

# default color scheme (optimized for light backgrounds)

GEOJSON_POLYGON_FILL = "#B7E4C7" # pastel mint
GEOJSON_POLYGON_STROKE = "#5A8F7B" # muted mint-teal edge
GEOJSON_LINE_STROKE = "#6FBF9E" # soft green road tone
GEOJSON_LABEL_FILL = "#374151" # calm slate for readable but quieter labels

WATERWAY_LINE_STROKE = "#74aCFF" # pastel blue water
WATERWAY_POLYGON_STROKE = "#749eFF" # pastel blue water
WATERWAY_POLYGON_FILL = "#74aCFF" # pastel blue water

HIGHLIGHT_CIRCLE_FILL = "#FFB4A2" # pastel coral highlight
HIGHLIGHT_CIRCLE_STROKE = "#F28482" # stronger coral edge

# soft orange 
CIRCLE_FILL = "#FFA500" # vivid yellow photo marks for stronger map contrast
CIRCLE_STROKE = "#FF8C00" # amber-gold edge for clear separation

def _apply_dark_mode():
    global GEOJSON_POLYGON_FILL, GEOJSON_POLYGON_STROKE, GEOJSON_LINE_STROKE
    GEOJSON_POLYGON_FILL = "#31de91"    # pastel lavender
    GEOJSON_POLYGON_STROKE = "#4dd497"
    GEOJSON_LINE_STROKE = "#CFE8D6"     # light desaturated green for roads

    global GEOJSON_LABEL_FILL
    GEOJSON_LABEL_FILL = "#C7CDD8"      # soft cool gray to reduce visual pull

    global WATERWAY_LINE_STROKE, WATERWAY_POLYGON_STROKE, WATERWAY_POLYGON_FILL
    WATERWAY_LINE_STROKE = "#81D4FA"    # bright pastel cyan
    WATERWAY_POLYGON_STROKE = "#749eFF" # pastel blue water
    WATERWAY_POLYGON_FILL = "#74aCFF" # pastel blue water

    global HIGHLIGHT_CIRCLE_FILL, HIGHLIGHT_CIRCLE_STROKE
    HIGHLIGHT_CIRCLE_FILL = "#FFB7B2"
    HIGHLIGHT_CIRCLE_STROKE = "#FFF1B8"

    global CIRCLE_FILL, CIRCLE_STROKE
    CIRCLE_FILL = "#FFE45E"             # luminous yellow stays visible on dark mode
    CIRCLE_STROKE = "#FFD60A"

    global LANDMARK_POINT_COLORS, LANDMARK_POINT_STROKE_COLORS
    LANDMARK_POINT_COLORS = {
        "amenity": "#FBBF24",
        "tourism": "#60A5FA",
        "historic": "#C084FC",
    }
    LANDMARK_POINT_STROKE_COLORS = {
        "amenity": "#B45309",
        "tourism": "#1D4ED8",
        "historic": "#7E22CE",
    }

# ── EXIF helpers ─────────────────────────────────────────────────────────────

def _rational_to_float(value) -> float:
    """Convert an EXIF rational (IFDRational / Fraction / tuple) to float."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Fraction):
        return float(value)
    # IFDRational behaves like a Fraction; fallback for (num, denom) tuples
    try:
        return float(value)
    except TypeError:
        num, denom = value
        return num / denom if denom != 0 else 0.0


def _dms_to_decimal(dms, ref: str) -> float:
    """Convert DMS tuple/list of rationals + hemisphere ref to decimal degrees."""
    deg, minutes, seconds = [_rational_to_float(v) for v in dms]
    decimal = deg + minutes / 60.0 + seconds / 3600.0
    return -decimal if ref in ("S", "W") else decimal


def parse_exif(img: Image.Image):
    """
    Extract (lat, lon, datetime_str) from a Pillow image.
    Returns (None, None, None) for any missing field.
    """
    lat = lon = datetime = None

    try:
        raw_exif = img.getexif()
        if raw_exif is None:
            return lat, lon, datetime

        # ── GPS ──────────────────────────────────────────────────────────────
        gps_ifd = raw_exif.get_ifd(GPS_IFD_TAG)
        if gps_ifd:
            # GPS tag ids from ExifTags.GPSTAGS
            gps_lat     = gps_ifd.get(GPS_TAGS.get("GPSLatitude"))
            gps_lat_ref = gps_ifd.get(GPS_TAGS.get("GPSLatitudeRef"), "N")
            gps_lon     = gps_ifd.get(GPS_TAGS.get("GPSLongitude"))
            gps_lon_ref = gps_ifd.get(GPS_TAGS.get("GPSLongitudeRef"), "E")

            if gps_lat and gps_lon:
                lat = _dms_to_decimal(gps_lat, str(gps_lat_ref).strip())
                lon = _dms_to_decimal(gps_lon, str(gps_lon_ref).strip())

        # ── Datetime ─────────────────────────────────────────────────────────
        exif_ifd = raw_exif.get_ifd(EXIF_IFD_TAG)
        raw_dt = (
            exif_ifd.get(TAG_DATETIME_ORIGINAL)
            or exif_ifd.get(TAG_DATETIME_DIGITIZED)
            or raw_exif.get(0x0132)  # root DateTime tag
        )
        if raw_dt and isinstance(raw_dt, str):
            # EXIF format: "YYYY:MM:DD HH:MM:SS"
            datetime = raw_dt[:4] + "-" + raw_dt[5:7] + "-" + raw_dt[8:]

    except Exception:
        pass  # silently skip unparseable EXIF

    return lat, lon, datetime


# ── Photo scanning ───────────────────────────────────────────────────────────

def scan_photos(folder: str) -> list[dict]:
    """
    Iterate all supported image files in folder, extract EXIF metadata.
    Returns list of dicts with keys: id, lat, lon, datetime.
    Only entries with valid GPS are included.
    """
    records = []
    folder_path = Path(folder)

    for entry in sorted(folder_path.iterdir()):
        if not entry.is_file():
            continue
        if entry.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        try:
            with Image.open(entry) as img:
                lat, lon, dt = parse_exif(img)
            if lat is None or lon is None:
                print(f"[skip-no-gps] {entry.name}", file=sys.stderr)
                continue
            records.append({"id": entry.name, "lat": lat, "lon": lon, "datetime": dt})
        except Exception as err:
            print(f"[skip] {entry.name}: {err}", file=sys.stderr)

    return records


# ── Coordinate projection (Mercator) ────────────────────────────────────────

PADDING_RATIO = 0.25  # default; overridable via CLI

def _lat_to_mercator(lat: float) -> float:
    """
    Convert latitude (degrees) to Mercator Y coordinate.
    Formula: y = ln(tan(π/4 + lat_rad/2))
    """
    lat_rad = math.radians(lat)
    return math.log(math.tan(math.pi / 4.0 + lat_rad / 2.0))


def _lon_to_mercator(lon: float) -> float:
    """Convert longitude (degrees) to Mercator X coordinate (radians)."""
    return math.radians(lon)


def _mercator_to_lon(x: float) -> float:
    """Convert Mercator X coordinate (radians) back to longitude (degrees)."""
    return math.degrees(x)


def _mercator_to_lat(y: float) -> float:
    """
    Convert Mercator Y coordinate back to latitude (degrees).
    Inverse formula: lat = 2 * atan(exp(y)) - π/2
    """
    lat_rad = 2.0 * math.atan(math.exp(y)) - math.pi / 2.0
    return math.degrees(lat_rad)


def compute_bbox(records: list[dict], padding: float) -> tuple[float, float, float, float]:
    """
    Return (min_x_merc, min_y_merc, max_x_merc, max_y_merc) expanded by padding fraction.
    Both axes are in Mercator-projected coordinates.
    Raises ValueError if records is empty.
    """
    if not records:
        raise ValueError("No geotagged photos found — cannot compute bounding box.")

    xs_merc = [_lon_to_mercator(r["lon"]) for r in records]
    ys_merc = [_lat_to_mercator(r["lat"]) for r in records]
    min_x_merc, max_x_merc = min(xs_merc), max(xs_merc)
    min_y_merc, max_y_merc = min(ys_merc), max(ys_merc)

    x_span = max_x_merc - min_x_merc or 1e-12   # guard against single-point
    y_span = max_y_merc - min_y_merc or 1e-12

    min_x_merc -= x_span * padding
    max_x_merc += x_span * padding
    min_y_merc -= y_span * padding
    max_y_merc += y_span * padding

    return min_x_merc, min_y_merc, max_x_merc, max_y_merc


def geo_to_svg(lon: float, lat: float,
               min_x_merc: float, min_y_merc: float,
               max_x_merc: float, max_y_merc: float,
               svg_w: int = SVG_WIDTH,
               svg_h: int = SVG_HEIGHT) -> tuple[float, float]:
    """
    Map (lon, lat) → (svg_x, svg_y) using Mercator projection.
    Uses one uniform scale for both axes to avoid stretch distortion,
    then centers the projected map in the SVG viewport.
    """
    x_merc = _lon_to_mercator(lon)
    y_merc = _lat_to_mercator(lat)

    span_x = max(max_x_merc - min_x_merc, 1e-12)
    span_y = max(max_y_merc - min_y_merc, 1e-12)

    # Keep one meter-per-pixel ratio in both directions (no anisotropic scaling).
    scale = min(svg_w / span_x, svg_h / span_y)
    draw_w = span_x * scale
    draw_h = span_y * scale
    offset_x = (svg_w - draw_w) / 2.0
    offset_y = (svg_h - draw_h) / 2.0

    x = offset_x + (x_merc - min_x_merc) * scale
    y = offset_y + (max_y_merc - y_merc) * scale
    return x, y


# ── GeoJSON helpers ──────────────────────────────────────────────────────────

def _ring_to_points(ring, min_lon, min_lat, max_lon, max_lat) -> str:
    """Convert a GeoJSON coordinate ring [[lon,lat],...] to SVG points string."""
    pts = []
    for coord in ring:
        x, y = geo_to_svg(coord[0], coord[1], min_lon, min_lat, max_lon, max_lat)
        pts.append(f"{x:.2f},{y:.2f}")
    return " ".join(pts)


def _coords_to_polyline(coords, min_lon, min_lat, max_lon, max_lat) -> str:
    """Convert a list of [lon,lat] to an SVG polyline points string."""
    return _ring_to_points(coords, min_lon, min_lat, max_lon, max_lat)


def _feature_name(properties):
    """Return name:en first, fallback to name."""
    if not isinstance(properties, dict):
        return None
    return properties.get("name:en") or properties.get("name")


def _landmark_category(properties: dict) -> str | None:
    """Classify an OSM feature as a landmark category based on tags."""
    if not isinstance(properties, dict):
        return None
    if properties.get("tourism"):
        return "tourism"
    if properties.get("historic"):
        return "historic"
    if properties.get("amenity"):
        return "amenity"
    return None


def _haversine_distance_meters(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Return great-circle distance in meters between two lon/lat points."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return r * c


def _landmark_importance_score(properties: dict, category: str, min_distance_m: float, max_distance_m: float) -> float:
    """Compute a deterministic importance score for selecting landmark labels."""
    category_weight = LANDMARK_CATEGORY_WEIGHTS.get(category, 0.0)

    # Nearby landmarks are more relevant. Normalize into [0, 1].
    if max_distance_m > 0:
        distance_score = max(0.0, min(1.0, 1.0 - (min_distance_m / max_distance_m)))
    else:
        distance_score = 0.0

    name = _feature_name(properties)
    name_score = 0.6 if isinstance(name, str) and len(name.strip()) >= 2 else 0.0
    importance_bonus = 0.0
    if properties.get("wikidata"):
        importance_bonus += 0.6
    if properties.get("wikipedia"):
        importance_bonus += 0.5
    if properties.get("heritage"):
        importance_bonus += 0.4

    return category_weight + distance_score + name_score + importance_bonus


def _landmark_key(feature: dict) -> tuple:
    """Build a stable dedup key for landmark point features."""
    properties = feature.get("properties") if isinstance(feature, dict) else None
    osm_ref = _parse_osm_ref_from_properties(properties if isinstance(properties, dict) else {})
    if osm_ref:
        return ("osm", osm_ref[0], osm_ref[1])

    geom = feature.get("geometry") if isinstance(feature, dict) else None
    coords = geom.get("coordinates") if isinstance(geom, dict) else None
    if isinstance(coords, list) and len(coords) >= 2:
        try:
            lon = round(float(coords[0]), 7)
            lat = round(float(coords[1]), 7)
            return ("coord", lon, lat)
        except (TypeError, ValueError):
            pass
    return ("feature", id(feature))


def _collect_nearby_landmarks(features: list[dict], records: list[dict], distance_m: float) -> dict[tuple, dict]:
    """Return deduplicated nearby landmark features keyed by stable landmark key."""
    if distance_m <= 0:
        return {}

    nearby: dict[tuple, dict] = {}
    for feature in features:
        if not isinstance(feature, dict):
            continue
        geom = feature.get("geometry")
        if not isinstance(geom, dict) or geom.get("type") != "Point":
            continue

        properties = feature.get("properties") or {}
        category = _landmark_category(properties)
        if category is None:
            continue

        coords = geom.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            continue

        try:
            lon = float(coords[0])
            lat = float(coords[1])
        except (TypeError, ValueError):
            continue

        nearest_distance: float | None = None
        for rec in records:
            dist = _haversine_distance_meters(lon, lat, rec["lon"], rec["lat"])
            if nearest_distance is None or dist < nearest_distance:
                nearest_distance = dist

        if nearest_distance is None or nearest_distance > distance_m:
            continue

        key = _landmark_key(feature)
        score = _landmark_importance_score(properties, category, nearest_distance, distance_m)
        existing = nearby.get(key)
        if existing is None or score > existing["score"]:
            nearby[key] = {
                "feature": feature,
                "category": category,
                "distance_m": nearest_distance,
                "score": score,
            }

    return nearby


def _label_bbox(x: float, y: float, text_value: str) -> tuple[float, float, float, float]:
    """Approximate axis-aligned label bounding box for overlap checks."""
    width = _estimate_label_width(text_value)
    height = GEOJSON_LABEL_FONT_SIZE * 1.1
    left = x + 6
    top = y - 6 - height
    right = left + width
    bottom = top + height
    return left, top, right, bottom


def _boxes_intersect(a: tuple[float, float, float, float],
                     b: tuple[float, float, float, float],
                     padding: float = 0.0) -> bool:
    """Return True if two axis-aligned boxes intersect (with optional padding)."""
    return not (
        a[2] + padding < b[0]
        or a[0] - padding > b[2]
        or a[3] + padding < b[1]
        or a[1] - padding > b[3]
    )


def _coords_centroid(coords):
    """Return centroid (mean lon/lat) for [[lon,lat], ...]."""
    if not isinstance(coords, list) or not coords:
        return None
    valid = []
    for coord in coords:
        if isinstance(coord, (list, tuple)) and len(coord) >= 2:
            try:
                valid.append((float(coord[0]), float(coord[1])))
            except (TypeError, ValueError):
                continue
    if not valid:
        return None
    lon = sum(v[0] for v in valid) / len(valid)
    lat = sum(v[1] for v in valid) / len(valid)
    return lon, lat


def _coords_to_svg_points(coords, min_lon, min_lat, max_lon, max_lat) -> list[tuple[float, float]]:
    """Convert [[lon,lat], ...] coordinates to [(x,y), ...] in SVG space."""
    points: list[tuple[float, float]] = []
    if not isinstance(coords, list):
        return points
    for coord in coords:
        if not isinstance(coord, (list, tuple)) or len(coord) < 2:
            continue
        try:
            lon = float(coord[0])
            lat = float(coord[1])
        except (TypeError, ValueError):
            continue
        points.append(geo_to_svg(lon, lat, min_lon, min_lat, max_lon, max_lat))
    return points


def _polyline_length(points: list[tuple[float, float]]) -> float:
    """Return total Euclidean length of a polyline in SVG pixel units."""
    if len(points) < 2:
        return 0.0
    length = 0.0
    for idx in range(1, len(points)):
        x0, y0 = points[idx - 1]
        x1, y1 = points[idx]
        length += math.hypot(x1 - x0, y1 - y0)
    return length


def _polyline_straightness(points: list[tuple[float, float]]) -> float:
    """Return how straight a polyline is, as chord_length / path_length."""
    if len(points) < 2:
        return 0.0
    path_length = _polyline_length(points)
    if path_length <= 0:
        return 0.0
    start_x, start_y = points[0]
    end_x, end_y = points[-1]
    chord_length = math.hypot(end_x - start_x, end_y - start_y)
    return chord_length / path_length


def _polyline_midpoint(points: list[tuple[float, float]]) -> tuple[float, float] | None:
    """Return the point at half cumulative polyline length."""
    if len(points) < 2:
        return None
    total = _polyline_length(points)
    if total <= 0:
        return points[0]

    target = total / 2.0
    walked = 0.0
    for idx in range(1, len(points)):
        x0, y0 = points[idx - 1]
        x1, y1 = points[idx]
        seg = math.hypot(x1 - x0, y1 - y0)
        if walked + seg >= target and seg > 0:
            ratio = (target - walked) / seg
            return (x0 + (x1 - x0) * ratio, y0 + (y1 - y0) * ratio)
        walked += seg
    return points[-1]


def _points_close(a: tuple[float, float], b: tuple[float, float], tolerance: float = 3.0) -> bool:
    """Return True when two projected points are within tolerance (in SVG pixels)."""
    return math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance


def _stitch_polylines(lines: list[list[tuple[float, float]]], tolerance: float = 3.0) -> list[list[tuple[float, float]]]:
    """Greedily merge polyline segments by matching endpoints within tolerance."""
    merged = [line[:] for line in lines if len(line) >= 2]
    if not merged:
        return merged

    changed = True
    while changed:
        changed = False
        i = 0
        while i < len(merged):
            base = merged[i]
            j = i + 1
            while j < len(merged):
                candidate = merged[j]
                if _points_close(base[-1], candidate[0], tolerance):
                    base.extend(candidate[1:])
                elif _points_close(base[-1], candidate[-1], tolerance):
                    base.extend(reversed(candidate[:-1]))
                elif _points_close(base[0], candidate[-1], tolerance):
                    base = candidate[:-1] + base
                elif _points_close(base[0], candidate[0], tolerance):
                    base = list(reversed(candidate[1:])) + base
                else:
                    j += 1
                    continue

                merged[i] = base
                merged.pop(j)
                changed = True
            i += 1

    return merged


def _estimate_label_width(text_value: str) -> float:
    """Estimate label width in pixels to gate text-on-path placement."""
    return max(1, len(text_value)) * GEOJSON_LABEL_FONT_SIZE * 0.55


def _path_d_from_points(points: list[tuple[float, float]]) -> str:
    """Build an SVG path `d` command from projected points."""
    if len(points) < 2:
        return ""
    start_x, start_y = points[0]
    segments = [f"M {start_x:.2f} {start_y:.2f}"]
    for x, y in points[1:]:
        segments.append(f"L {x:.2f} {y:.2f}")
    return " ".join(segments)


def _append_text_on_path(labels_root: ET.Element,
                         points: list[tuple[float, float]],
                         text_value: str,
                         path_id: str) -> bool:
    """Render a label along a line/river path; returns False if path is too short."""
    if not text_value or len(points) < 2:
        return False

    required_length = _estimate_label_width(text_value) + GEOJSON_LABEL_FONT_SIZE * 1.0
    if _polyline_length(points) < required_length:
        return False

    if _polyline_straightness(points) < 0.88:
        return False

    oriented_points = points
    if points[-1][0] < points[0][0]:
        oriented_points = list(reversed(points))

    path_d = _path_d_from_points(oriented_points)
    if not path_d:
        return False

    path_elem = ET.SubElement(labels_root, "path")
    path_elem.set("id", path_id)
    path_elem.set("d", path_d)
    path_elem.set("fill", "none")
    path_elem.set("stroke", "none")

    text_elem = ET.SubElement(labels_root, "text")
    text_elem.set("fill", GEOJSON_LABEL_FILL)
    text_elem.set("stroke", GEOJSON_LABEL_FILL)
    text_elem.set("stroke-width", "3")
    text_elem.set("font-size", str(GEOJSON_LABEL_FONT_SIZE))
    text_elem.set("font-family", GEOJSON_LABEL_FONT_FAMILY)
    text_elem.set("text-anchor", "middle")
    text_elem.set("dominant-baseline", "central")

    text_path = ET.SubElement(text_elem, "textPath")
    text_path.set("startOffset", "50%")
    text_path.set("method", "align")
    text_path.set("spacing", "auto")
    text_path.set("href", f"#{path_id}")
    text_path.set("{http://www.w3.org/1999/xlink}href", f"#{path_id}")
    text_path.text = text_value

    return True


def _append_text(svg_root: ET.Element, x: float, y: float, text_value: str):
    """Append a styled SVG text label near the given anchor point, with Yuanti SC font for Chinese support."""
    if not text_value:
        return
    text_elem = ET.SubElement(svg_root, "text")
    text_elem.set("x", f"{x + 6:.2f}")
    text_elem.set("y", f"{y - 6:.2f}")
    text_elem.set("fill", GEOJSON_LABEL_FILL)
    text_elem.set("stroke", "none")
    text_elem.set("stroke-width", "3")
    text_elem.set("font-size", str(GEOJSON_LABEL_FONT_SIZE))
    text_elem.set("font-family", GEOJSON_LABEL_FONT_FAMILY)
    text_elem.text = text_value

def geojson_elements(geojson_path: str,
                     min_lon: float, min_lat: float,
                     max_lon: float, max_lat: float,
                     svg_root: ET.Element,
                     records: list[dict],
                     landmark_distance_m: float):
    """
    Parse a GeoJSON FeatureCollection and append SVG geometry + labels.
    """
    try:
        with open(geojson_path, encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as err:
        print(f"[warn] GeoJSON skipped: {err}", file=sys.stderr)
        return

    features = data.get("features", [])
    rendered_labels = set()       # track rendered road names to avoid duplicates
    rendered_label_positions = [] # (x, y) of placed labels
    rendered_label_boxes = []     # (left, top, right, bottom) for overlap checks
    label_path_index = 0
    named_line_batches = {}
    allowed_landmarks = _collect_nearby_landmarks(features, records, landmark_distance_m)

    photo_points = [
        geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)
        for rec in records
    ]
    landmark_candidates = []
    seen_landmark_keys = set()

    roads_root = ET.SubElement(svg_root, "g", id="roads")
    rivers_root = ET.SubElement(svg_root, "g", id="rivers")
    landmarks_root = ET.SubElement(svg_root, "g", id="landmarks")
    landmarks_points_root = ET.SubElement(svg_root, "g", id="landmarks_points")
    labels_root = ET.SubElement(svg_root, "g", id="labels")  # separate group for labels to render on top of all geometry
    
    for feature in features:
        geom = feature.get("geometry")
        if not isinstance(geom, dict):
            continue
        
        properties = feature.get("properties") or {}
        name = _feature_name(properties)
        gtype = geom.get("type")
        
        highway = properties.get("highway")
        waterway = properties.get("waterway")
        natural = properties.get("natural")

        if gtype == "Polygon":
            rings = geom.get("coordinates", [])
            
            if not isinstance(rings, list) or not rings:
                continue
            
            for i, ring in enumerate(rings):
                if not isinstance(ring, list) or not ring:
                    continue
                pts = _ring_to_points(ring, min_lon, min_lat, max_lon, max_lat)
                elem = ET.SubElement(landmarks_root, "polygon")
                elem.set("points", pts)
                
                if natural == "water":
                    elem.set("fill", WATERWAY_POLYGON_FILL)
                    elem.set("stroke", WATERWAY_POLYGON_STROKE)
                else:
                    elem.set("fill", GEOJSON_POLYGON_FILL)
                    elem.set("stroke", GEOJSON_POLYGON_STROKE)
                elem.set("stroke-width", str(GEOJSON_POLYGON_STROKE_WIDTH))
                if i > 0:
                    elem.set("fill", "white")

            if name:
                centroid = _coords_centroid(rings[0])
                if centroid:
                    x, y = geo_to_svg(centroid[0], centroid[1], min_lon, min_lat, max_lon, max_lat)
                    _append_text(svg_root, x, y, name)

        elif gtype == "MultiPolygon":
            polygons = geom.get("coordinates", [])
            
            if not isinstance(polygons, list) or not polygons:
                continue
            
            natural = properties.get("natural")
            
            for polygon in polygons:
                if not isinstance(polygon, list) or not polygon:
                    continue
                for i, ring in enumerate(polygon):
                    if not isinstance(ring, list) or not ring:
                        continue
                    pts = _ring_to_points(ring, min_lon, min_lat, max_lon, max_lat)
                    elem = ET.SubElement(landmarks_root, "polygon")
                    elem.set("points", pts)
                    
                    if natural == "water":
                        elem.set("fill", WATERWAY_POLYGON_FILL)
                        elem.set("stroke", WATERWAY_POLYGON_STROKE)
                    else:
                        elem.set("fill", GEOJSON_POLYGON_FILL)
                        elem.set("stroke", GEOJSON_POLYGON_STROKE)
                        
                    elem.set("stroke-width", str(GEOJSON_POLYGON_STROKE_WIDTH))
                    if i > 0:
                        elem.set("fill", "white")
                        
            if name and isinstance(polygons[0], list) and polygons[0]:
                centroid = _coords_centroid(polygons[0][0])
                if centroid:
                    x, y = geo_to_svg(centroid[0], centroid[1], min_lon, min_lat, max_lon, max_lat)
                    _append_text(svg_root, x, y, name)

        elif gtype == "LineString":
            coords = geom.get("coordinates", [])
            if not isinstance(coords, list) or not coords:
                continue
            pts = _coords_to_polyline(coords, min_lon, min_lat, max_lon, max_lat)
            svg_points = _coords_to_svg_points(coords, min_lon, min_lat, max_lon, max_lat)
            if len(svg_points) < 2:
                continue
            
            if waterway:
                kind = "river"
                stroke_color = WATERWAY_LINE_STROKE
                width = WATERWAY_WIDTHS.get(waterway, GEOJSON_LINE_STROKE_WIDTH)
            else:
                if use_highway_simple_filter and highway not in highway_simple_filter:
                    continue  # skip minor roads for visual clarity
                kind = "road"
                stroke_color = GEOJSON_LINE_STROKE
                width = HIGHWAY_WIDTHS.get(highway, GEOJSON_LINE_STROKE_WIDTH)

            if name:
                batch_key = (kind, name)
                batch = named_line_batches.get(batch_key)
                if batch is None:
                    named_line_batches[batch_key] = {
                        "stroke_color": stroke_color,
                        "width": width,
                        "highway": highway,
                        "waterway": waterway,
                        "segments": [svg_points],
                    }
                else:
                    batch["width"] = max(batch["width"], width)
                    batch["segments"].append(svg_points)
            else:
                target_group = rivers_root if kind == "river" else roads_root
                elem = ET.SubElement(target_group, "polyline")
                elem.set("points", pts)
                elem.set("fill", "none")
                elem.set("stroke", stroke_color)
                elem.set("stroke-width", str(width))

        elif gtype == "MultiLineString":
            lines = geom.get("coordinates", [])
            if not isinstance(lines, list) or not lines:
                continue
            candidate_lines = []
            
            if waterway:
                kind = "river"
                stroke_color = WATERWAY_LINE_STROKE
                width = WATERWAY_WIDTHS.get(waterway, GEOJSON_LINE_STROKE_WIDTH)
                target_group = rivers_root
            else:
                if use_highway_simple_filter and highway not in highway_simple_filter:
                    continue  # skip minor roads for visual clarity

                kind = "road"
                stroke_color = GEOJSON_LINE_STROKE
                width = HIGHWAY_WIDTHS.get(highway, GEOJSON_LINE_STROKE_WIDTH)
                target_group = roads_root

            for line in lines:
                if not isinstance(line, list) or not line:
                    continue
                svg_points = _coords_to_svg_points(line, min_lon, min_lat, max_lon, max_lat)
                if len(svg_points) >= 2:
                    candidate_lines.append(svg_points)

            if not candidate_lines:
                continue

            if name:
                batch_key = (kind, name)
                batch = named_line_batches.get(batch_key)
                if batch is None:
                    named_line_batches[batch_key] = {
                        "stroke_color": stroke_color,
                        "width": width,
                        "highway": highway,
                        "waterway": waterway,
                        "segments": candidate_lines,
                    }
                else:
                    batch["width"] = max(batch["width"], width)
                    batch["segments"].extend(candidate_lines)
            else:
                merged_lines = _stitch_polylines(candidate_lines)
                for merged in merged_lines:
                    pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in merged)
                    elem = ET.SubElement(target_group, "polyline")
                    elem.set("points", pts)
                    elem.set("fill", "none")
                    elem.set("stroke", stroke_color)
                    elem.set("stroke-width", str(width))

        elif gtype == "Point":
            if not allowed_landmarks:
                continue

            category = _landmark_category(properties)
            if category is None:
                continue

            landmark_key = _landmark_key(feature)
            landmark_meta = allowed_landmarks.get(landmark_key)
            if landmark_meta is None:
                continue

            if landmark_key in seen_landmark_keys:
                continue
            seen_landmark_keys.add(landmark_key)

            coords = geom.get("coordinates", [])
            if not isinstance(coords, list) or len(coords) < 2:
                continue

            try:
                lon = float(coords[0])
                lat = float(coords[1])
            except (TypeError, ValueError):
                continue

            x, y = geo_to_svg(lon, lat, min_lon, min_lat, max_lon, max_lat)

            point_elem = ET.SubElement(landmarks_points_root, "circle")
            point_elem.set("cx", f"{x:.2f}")
            point_elem.set("cy", f"{y:.2f}")
            point_elem.set("r", str(LANDMARK_POINT_RADIUS))
            point_elem.set("opacity", "0.56")
            point_elem.set("fill", LANDMARK_POINT_COLORS.get(category, LANDMARK_POINT_COLORS["amenity"]))
            point_elem.set("stroke", LANDMARK_POINT_STROKE_COLORS.get(category, LANDMARK_POINT_STROKE_COLORS["amenity"]))
            point_elem.set("stroke-width", str(LANDMARK_POINT_STROKE_WIDTH))
            landmark_candidates.append({
                "name": name,
                "x": x,
                "y": y,
                "score": landmark_meta["score"],
            })

    for (kind, name), batch in named_line_batches.items():
        merged_lines = _stitch_polylines(batch["segments"])
        target_group = rivers_root if kind == "river" else roads_root
        highway = batch["highway"]

        for merged in merged_lines:
            pts = " ".join(f"{x:.2f},{y:.2f}" for x, y in merged)
            elem = ET.SubElement(target_group, "polyline")
            elem.set("points", pts)
            elem.set("fill", "none")
            elem.set("stroke", batch["stroke_color"])
            elem.set("stroke-width", str(batch["width"]))

        if name in rendered_labels:
            continue
        
        if highway and highway not in highway_labels_filter:
            continue
        
        merged_lines.sort(key=_polyline_length, reverse=True)
        if not merged_lines:
            continue

        anchor = _polyline_midpoint(merged_lines[0])
        if anchor is None:
            continue

        x, y = anchor
        
        too_close = any(
            math.hypot(x - px, y - py) < LABEL_MIN_DIST
            for px, py in rendered_label_positions
        )
        if too_close:
            continue

        path_id = f"label-path-{label_path_index}"
        label_path_index += 1
        if not _append_text_on_path(labels_root, merged_lines[0], name, path_id):
            _append_text(labels_root, x, y, name)
        rendered_labels.add(name)
        rendered_label_positions.append((x, y))
        rendered_label_boxes.append(_label_bbox(x, y, name))

    # Place landmark labels by importance using greedy overlap rejection.
    landmark_candidates.sort(key=lambda item: item["score"], reverse=True)
    grid_counts: dict[tuple[int, int], int] = {}
    labels_used = 0

    for candidate in landmark_candidates:
        name = candidate["name"]
        if not name:
            continue
        if labels_used >= LANDMARK_LABEL_MAX_COUNT:
            break

        x = candidate["x"]
        y = candidate["y"]

        # Keep labels away from photo markers to reduce clutter near highlights.
        near_photo = any(
            math.hypot(x - px, y - py) < LANDMARK_LABEL_PHOTO_AVOID_RADIUS
            for px, py in photo_points
        )
        if near_photo:
            continue

        label_box = _label_bbox(x, y, name)
        if any(_boxes_intersect(label_box, existing_box, padding=LANDMARK_LABEL_PADDING) for existing_box in rendered_label_boxes):
            continue

        cell_x = int((label_box[0] + label_box[2]) / 2.0 // LANDMARK_LABEL_GRID_SIZE)
        cell_y = int((label_box[1] + label_box[3]) / 2.0 // LANDMARK_LABEL_GRID_SIZE)
        cell_key = (cell_x, cell_y)
        if grid_counts.get(cell_key, 0) >= LANDMARK_LABEL_MAX_PER_CELL:
            continue

        _append_text(labels_root, x, y, name)
        rendered_label_positions.append((x, y))
        rendered_label_boxes.append(label_box)
        grid_counts[cell_key] = grid_counts.get(cell_key, 0) + 1
        labels_used += 1
                
# ── SVG composition ──────────────────────────────────────────────────────────

def build_svg(records: list[dict],
              bbox: tuple[float, float, float, float],
              geojson_path: str | None,
              landmark_distance_m: float) -> tuple[ET.Element, ET.Element, ET.Element, ET.Element, ET.Element]:
    """
    Compose the full SVG tree once.
    Layers (bottom → top): background, GeoJSON shapes, photo circles, one movable highlight.
    Returns: (svg_root, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot)
    """
    min_lon, min_lat, max_lon, max_lat = bbox

    svg_ns = "http://www.w3.org/2000/svg"
    ET.register_namespace("", svg_ns)
    svg = ET.Element(f"{{{svg_ns}}}svg")
    svg.set("width", str(SVG_WIDTH))
    svg.set("height", str(SVG_HEIGHT))
    svg.set("viewBox", f"0 0 {SVG_WIDTH} {SVG_HEIGHT}")
    
    defs = ET.SubElement(svg, "defs")
    # # define feBlend with multiply mode for highlight ring
    filter_elem = ET.SubElement(defs, "filter", id="highlight-blend")
    ET.SubElement(filter_elem, "feBlend", mode="multiply", in2="BackgroundImage", in_="SourceGraphic")
    # # define filter of feComposite with arithmetic operator for highlight halo
    # filter_elem2 = ET.SubElement(defs, "filter", id="highlight-halo-blend")
    # ET.SubElement(filter_elem2, "feComposite", operator="arithmetic", k1="0", k2="1", k3="0", k4="0", in2="BackgroundImage", in_="SourceGraphic")
    
    # Background
    if (use_svg_background):
        bg = ET.SubElement(svg, "rect")
        bg.set("width", str(SVG_WIDTH))
        bg.set("height", str(SVG_HEIGHT))
        bg.set("fill", "#f8f8f8")

    # GeoJSON layer
    if geojson_path and os.path.isfile(geojson_path):
        geojson_elements(geojson_path, min_lon, min_lat, max_lon, max_lat, svg, records, landmark_distance_m)

    highlight_photo_root = ET.SubElement(svg, "g", id="highlight_photo")
    photos_root = ET.SubElement(svg, "g", id="photos")

    # Photo circles (normal)
    for rec in records:
        x, y = geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)

        halo = ET.SubElement(photos_root, "circle")
        halo.set("cx", f"{x:.2f}")
        halo.set("cy", f"{y:.2f}")
        halo.set("r", str(CIRCLE_HALO_RADIUS))
        halo.set("opacity", str(CIRCLE_HALO_OPACITY))
        halo.set("fill", CIRCLE_FILL)

        circle = ET.SubElement(photos_root, "circle")
        circle.set("cx", f"{x:.2f}")
        circle.set("cy", f"{y:.2f}")
        circle.set("r", str(CIRCLE_RADIUS))
        circle.set("fill", CIRCLE_FILL)
        circle.set("opacity", "0.32")
        circle.set("stroke", CIRCLE_STROKE)
        circle.set("stroke-width", "1")

    # Reusable highlight layers. Positions are updated per photo before export.
    highlight_halo = ET.SubElement(highlight_photo_root, "circle")
    highlight_halo.set("opacity", str(HIGHLIGHT_HALO_OPACITY))
    highlight_halo.set("r", str(HIGHLIGHT_HALO_RADIUS))
    highlight_halo.set("fill", HIGHLIGHT_CIRCLE_FILL)

    highlight_circle = ET.SubElement(highlight_photo_root, "circle")
    highlight_circle.set("opacity", "0.58")
    highlight_circle.set("r", str(HIGHLIGHT_CIRCLE_RADIUS))
    highlight_circle.set("fill", HIGHLIGHT_CIRCLE_FILL)
    highlight_circle.set("stroke", HIGHLIGHT_CIRCLE_STROKE)
    highlight_circle.set("stroke-width", str(HIGHLIGHT_CIRCLE_STROKE_WIDTH))

    highlight_ring = ET.SubElement(highlight_photo_root, "circle")
    highlight_ring.set("fill", "none")
    highlight_ring.set("r", str(HIGHLIGHT_RING_RADIUS))
    highlight_ring.set("stroke", HIGHLIGHT_CIRCLE_STROKE)
    highlight_ring.set("stroke-width", str(HIGHLIGHT_RING_STROKE_WIDTH))

    highlight_center_dot = ET.SubElement(highlight_photo_root, "circle")
    highlight_center_dot.set("r", str(HIGHLIGHT_CENTER_DOT_RADIUS))
    highlight_center_dot.set("fill", HIGHLIGHT_CENTER_DOT_FILL)

    return svg, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot


def set_highlight_position(highlight_halo: ET.Element,
                           highlight_circle: ET.Element,
                           highlight_ring: ET.Element,
                           highlight_center_dot: ET.Element,
                           rec: dict,
                           bbox: tuple[float, float, float, float]):
    """Update reusable highlight layer positions for the given photo record."""
    min_lon, min_lat, max_lon, max_lat = bbox
    x, y = geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)
    highlight_halo.set("cx", f"{x:.2f}")
    highlight_halo.set("cy", f"{y:.2f}")
    highlight_circle.set("cx", f"{x:.2f}")
    highlight_circle.set("cy", f"{y:.2f}")
    highlight_ring.set("cx", f"{x:.2f}")
    highlight_ring.set("cy", f"{y:.2f}")
    highlight_center_dot.set("cx", f"{x:.2f}")
    highlight_center_dot.set("cy", f"{y:.2f}")


# ── GeoJSON export ──────────────────────────────────────────────────────────

def records_to_geojson(records: list[dict]) -> dict:
    """
    Convert photo records to a GeoJSON FeatureCollection.
    Each record becomes a Point feature with properties.
    """
    features = []
    for rec in records:
        feature = {
            "type": "Feature",
            "properties": {
                "id": rec["id"],
                "datetime": rec["datetime"],
            },
            "geometry": {
                "type": "Point",
                "coordinates": [rec["lon"], rec["lat"]],
            },
        }
        features.append(feature)
    return {
        "type": "FeatureCollection",
        "features": features,
    }


def get_photos_geojson_path(photos_dir: str) -> str:
    """
    Extract folder name from photos_dir and return <folder_name>_photos.geojson.
    E.g., /path/to/photos → __tmp/photos_photos.geojson
    """
    folder_name = Path(photos_dir).name
    return f"__tmp/{folder_name}_photos.geojson"


def get_osm_geojson_path(photos_dir: str) -> str:
    """Return the OSM GeoJSON cache path in __tmp for a photo folder."""
    folder_name = Path(photos_dir).name
    return f"__tmp/{folder_name}_osm.geojson"


def get_overpass_query_output_path(photos_dir: str) -> Path:
    """Return rendered overpass query path in __tmp/<folder>/<folder>.overpass.query."""
    folder_name = Path(photos_dir).name
    return Path("__tmp") / folder_name / f"{folder_name}.overpass.query"


def load_overpass_query_template() -> str:
    """Load the template query file shipped with this case."""
    template_path = Path(__file__).with_name("overpass.query")
    return template_path.read_text(encoding="utf-8")


def render_overpass_query(min_lat: float, min_lon: float, max_lat: float, max_lon: float) -> str:
    """Render overpass.query template with bbox placeholder in S,W,N,E order."""
    template = load_overpass_query_template()
    bbox = f"{min_lat:.6f},{min_lon:.6f},{max_lat:.6f},{max_lon:.6f}"
    return template.replace("{{bbox}}", bbox)


def fetch_overpass_json(query_text: str) -> dict:
    """Execute an Overpass interpreter query and return parsed JSON."""
    endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://lz4.overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.openstreetmap.fr/api/interpreter",
    ]

    post_body = urllib.parse.urlencode({"data": query_text}).encode("utf-8")
    errors = []

    for endpoint in endpoints:
        request = urllib.request.Request(
            endpoint,
            data=post_body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
                "Accept": "application/json,text/plain,*/*",
                "User-Agent": "photos-viz/1.0",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = response.read().decode("utf-8")
            return json.loads(payload)
        except urllib.error.HTTPError as err:
            body = ""
            try:
                body = err.read().decode("utf-8", errors="ignore").strip().replace("\n", " ")[:200]
            except Exception:
                pass
            errors.append(f"{endpoint} -> HTTP {err.code} {body}".strip())
        except (urllib.error.URLError, json.JSONDecodeError) as err:
            errors.append(f"{endpoint} -> {err}")

    raise RuntimeError("All Overpass endpoints failed: " + " | ".join(errors))


def _parse_osm_ref_from_properties(properties: dict) -> tuple[str, int] | None:
    """Best-effort extraction of (osm_type, osm_id) from feature properties."""
    if not isinstance(properties, dict):
        return None

    osm_type = properties.get("type") or properties.get("osm_type") or properties.get("@type")
    raw_id = properties.get("id") or properties.get("osm_id") or properties.get("@id")

    if isinstance(raw_id, str) and "/" in raw_id:
        maybe_type, maybe_id = raw_id.split("/", 1)
        if maybe_type in {"node", "way", "relation"} and maybe_id.isdigit():
            return maybe_type, int(maybe_id)

    if isinstance(raw_id, str) and raw_id and raw_id[0] in {"n", "w", "r"} and raw_id[1:].isdigit():
        prefix_to_type = {"n": "node", "w": "way", "r": "relation"}
        return prefix_to_type[raw_id[0]], int(raw_id[1:])

    if isinstance(raw_id, str) and raw_id.isdigit():
        raw_id = int(raw_id)

    if isinstance(raw_id, int):
        if osm_type in {"node", "way", "relation"}:
            return osm_type, raw_id

    return None


def _enrich_geojson_properties_from_overpass(geojson: dict, overpass_data: dict):
    """Merge original OSM tags from Overpass elements into GeoJSON feature properties."""
    elements = overpass_data.get("elements", []) if isinstance(overpass_data, dict) else []
    if not isinstance(elements, list):
        return

    tags_by_ref: dict[tuple[str, int], dict] = {}
    for element in elements:
        if not isinstance(element, dict):
            continue
        etype = element.get("type")
        eid = element.get("id")
        tags = element.get("tags")
        if etype in {"node", "way", "relation"} and isinstance(eid, int) and isinstance(tags, dict):
            tags_by_ref[(etype, eid)] = tags

    features = geojson.get("features", []) if isinstance(geojson, dict) else []
    if not isinstance(features, list):
        return

    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            properties = {}
            feature["properties"] = properties

        osm_ref = _parse_osm_ref_from_properties(properties)
        if not osm_ref:
            continue

        source_tags = tags_by_ref.get(osm_ref)
        if not source_tags:
            continue

        for key, value in source_tags.items():
            properties.setdefault(key, value)


def convert_overpass_to_geojson(overpass_data: dict) -> dict:
    """Convert Overpass JSON to GeoJSON using osm2geojson."""
    if not isinstance(overpass_data, dict):
        raise ValueError("Invalid Overpass payload.")

    geojson = osm2geojson.json2geojson(overpass_data)
    if not isinstance(geojson, dict):
        raise ValueError("osm2geojson returned invalid data.")

    if geojson.get("type") != "FeatureCollection":
        geojson = {
            "type": "FeatureCollection",
            "features": geojson.get("features", []),
        }

    _enrich_geojson_properties_from_overpass(geojson, overpass_data)

    geojson["usable"] = True
    return geojson


def export_photos_geojson(records: list[dict], output_path: str):
    """
    Write photo records to a GeoJSON FeatureCollection file.
    """
    geojson_data = records_to_geojson(records)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson_data, f, indent=2, ensure_ascii=False)


# ── PNG export ───────────────────────────────────────────────────────────────

def export_png(svg_content: str, png_path: str, size: int = PNG_SIZE):
    """Rasterize SVG to a size×size PNG using CairoSVG with transparency."""
    cairosvg.svg2png(
        bytestring=svg_content.encode("utf-8"),
        write_to=png_path,
        output_width=size,
        output_height=size,
        background_color="rgba(0,0,0,0)"  # Transparent background
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate a photo-location map from EXIF data.")
    parser.add_argument("photos_dir", help="Directory containing Pixel 9 photos.")
    
    parser.add_argument("--padding", type=float, default=PADDING_RATIO,
                        help=f"Bbox padding fraction (default: {PADDING_RATIO}).")
    parser.add_argument("--search", default="",
                        help="only generate minimap for photos whose names match the search query (case-insensitive substring match)")
    parser.add_argument("--dark", type=bool, default=False,
                        help="use a dark background and color scheme for better visibility in low-light conditions")
    parser.add_argument("--simple", type=bool, default=False,
                        help="only render major highways (motorway, trunk, primary) for visual clarity")
    parser.add_argument("--landmark-distance", type=float, default=LANDMARK_DISTANCE_M_DEFAULT,
                        help=f"render landmarks within this distance (meters, default: {LANDMARK_DISTANCE_M_DEFAULT})")
    args = parser.parse_args()

    # 1. Scan photos
    print(f"Scanning photos in: {args.photos_dir}")
    records = scan_photos(args.photos_dir)
    if not records:
        print("ERROR: No geotagged photos found.", file=sys.stderr)
        sys.exit(1)
    print(f"Found {len(records)} geotagged photo(s).")

    # 2. Export photos as GeoJSON Point features
    photos_geojson_path = get_photos_geojson_path(args.photos_dir)
    export_photos_geojson(records, photos_geojson_path)
    print(f"Photos exported → {photos_geojson_path}")

    # 3. Compute bbox from EXIF points
    bbox = compute_bbox(records, args.padding)
    min_x_merc, min_y_merc, max_x_merc, max_y_merc = bbox
    # Convert Mercator bbox back to lon/lat for user-facing output.
    min_lon = _mercator_to_lon(min_x_merc)
    max_lon = _mercator_to_lon(max_x_merc)
    min_lat_deg = _mercator_to_lat(min_y_merc)
    max_lat_deg = _mercator_to_lat(max_y_merc)

    osm_geojson_name = get_osm_geojson_path(args.photos_dir)

    # 4. First-run bootstrap: try reading GeoJSON directly. If missing, fetch and save then exit.
    try:
        with open(osm_geojson_name, "r", encoding="utf-8") as f:
            geojson_data = json.load(f)
    except FileNotFoundError:
        query_output_path = get_overpass_query_output_path(args.photos_dir)
        query_output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            query_text = render_overpass_query(min_lat_deg, min_lon, max_lat_deg, max_lon)
            query_output_path.write_text(query_text, encoding="utf-8")

            overpass_data = fetch_overpass_json(query_text)
            geojson_data = convert_overpass_to_geojson(overpass_data)

            if not geojson_data.get("features"):
                raise ValueError("No map features returned by Overpass API.")

            with open(osm_geojson_name, "w", encoding="utf-8") as f:
                json.dump(geojson_data, f, indent=2, ensure_ascii=False)

            print()
            print(f"  Generated query file: {query_output_path}")
            print(f"  Downloaded OSM GeoJSON: {osm_geojson_name}")
            print("  First-run bootstrap complete. Re-run command to generate minimaps.")
            print()
            sys.exit(0)
        except (FileNotFoundError, OSError, json.JSONDecodeError, ValueError, urllib.error.URLError, RuntimeError) as err:
            print()
            print(f"  ERROR: Failed to bootstrap OSM GeoJSON: {err}", file=sys.stderr)
            print(f"  Query file: {query_output_path}", file=sys.stderr)
            print()
            print(f"  min_lon : {min_lon:.6f}", file=sys.stderr)
            print(f"  min_lat : {min_lat_deg:.6f}", file=sys.stderr)
            print(f"  max_lon : {max_lon:.6f}", file=sys.stderr)
            print(f"  max_lat : {max_lat_deg:.6f}", file=sys.stderr)
            print()
            print(
                f"  Overpass bbox (S,W,N,E) : {min_lat_deg:.6f},{min_lon:.6f},{max_lat_deg:.6f},{max_lon:.6f}",
                file=sys.stderr,
            )
            print()
            sys.exit(1)
    except json.JSONDecodeError:
        geojson_data = {}

    # Check if GeoJSON is marked as usable; if not, same behavior
    try:
        if not geojson_data.get("usable", True):
            print()
            print("  GeoJSON marked as usable=false. Use the bbox below to download OSM data,")
            print(f"  update it, and set usable=true in {osm_geojson_name}")
            print()
            print(f"  min_lon : {min_lon:.6f}")
            print(f"  min_lat : {min_lat_deg:.6f}")
            print(f"  max_lon : {max_lon:.6f}")
            print(f"  max_lat : {max_lat_deg:.6f}")
            print()
            print(f"  Overpass bbox (S,W,N,E) : {min_lat_deg:.6f},{min_lon:.6f},{max_lat_deg:.6f},{max_lon:.6f}")
            print()
            sys.exit(0)
    except (json.JSONDecodeError, IOError):
        pass  # proceed if GeoJSON is invalid

    # 5. Export one map per photo
    print(f"Loading GeoJSON: {osm_geojson_name}")
    output_dir = Path.cwd() / "__tmp" / Path(args.photos_dir).name
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.dark:
        _apply_dark_mode()

    if args.simple:
        global use_highway_simple_filter
        use_highway_simple_filter = True

    svg_root, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot = build_svg(
        records,
        bbox,
        osm_geojson_name,
        args.landmark_distance,
    )
    
    for rec in records:
        # match search query if provided
        if args.search and args.search.lower() not in rec["id"].lower():
            continue
        
        set_highlight_position(highlight_halo, highlight_circle, highlight_ring, highlight_center_dot, rec, bbox)
        svg_content = ET.tostring(svg_root, encoding="unicode", xml_declaration=False)
        output_png = output_dir / f"{Path(rec['id']).stem}_map.png"
        export_png(svg_content, str(output_png), size=PNG_SIZE)
        print(f"Map saved → {output_png}")

    print(f"Generated {len(records)} map file(s) in {output_dir}  ({PNG_SIZE}×{PNG_SIZE}px)")

if __name__ == "__main__":
    main()
