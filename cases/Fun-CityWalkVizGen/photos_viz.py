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
PNG_SIZE = 1024
COVER_SVG_WIDTH = int(1980 * 1.5)
COVER_SVG_HEIGHT = int(1080 * 1.5)
ACTIVE_SVG_WIDTH = SVG_WIDTH
ACTIVE_SVG_HEIGHT = SVG_HEIGHT
ACTIVE_SVG_MARGIN_RATIO = 0.0
ACTIVE_SVG_OFFSET_X = 0.0
ACTIVE_SVG_OFFSET_Y = 0.0
COVER_SAFE_MARGIN_RATIO = 0.05
cover_map_ratio = 0.62

CIRCLE_RADIUS = 32  # 4 times bigger
CIRCLE_STROKE_WIDTH = 8  # Adjust stroke width proportionally
CIRCLE_HALO_RADIUS = CIRCLE_RADIUS + 10
CIRCLE_HALO_OPACITY = 0.12
PHOTO_STAMP_OUTER_RADIUS = CIRCLE_RADIUS + 2
PHOTO_STAMP_INNER_RADIUS = CIRCLE_RADIUS - 8
PHOTO_STAMP_OUTER_WIDTH = 3
PHOTO_STAMP_INNER_OPACITY = 0.86
PHOTO_STAMP_OUTER_OPACITY = 0.8
PHOTO_STAMP_CENTER_DOT_RADIUS = 3
PHOTO_STAMP_CENTER_DOT_FILL = "#F7F1E5"
PHOTO_STAMP_CENTER_CROSS_SIZE = 5
PHOTO_STAMP_CENTER_CROSS_WIDTH = 2
PHOTO_STAMP_CENTER_CROSS_COLOR = "#F7F1E5"
PHOTO_STAMP_OUTER_RING_COLOR = "#efd6c3"
PHOTO_STAMP_OUTER_DASH = "8 6"

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
highway_labels_filter = { "motorway", "trunk", "primary", "secondary" }
use_highway_simple_filter = False  # Set to False to include all highway types, but it may cause visual clutter
use_svg_background = False  # Set to True to include a light background rectangle in the SVG for better contrast

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
GEOJSON_LABEL_FONT_SIZE = 40
LABEL_MIN_DIST = 10          # minimum pixel gap between any two labels
GEOJSON_LABEL_FONT_FAMILY = '"Hannotate SC", sans-serif'
LANDMARK_DISTANCE_M_DEFAULT = 1000.0
LANDMARK_POINT_RADIUS = 12
LANDMARK_POINT_STROKE_WIDTH = 2
LANDMARK_POINT_OUTER_RADIUS = 16
LANDMARK_POINT_CENTER_DOT_RADIUS = 3
LANDMARK_POINT_INNER_OPACITY = 0.88
LANDMARK_POINT_OUTER_OPACITY = 0.78
LANDMARK_POINT_CENTER_DOT_FILL = "#F7F1E5"
LANDMARK_POINT_COLORS = {
    "amenity": "#BFA27A",
    "tourism": "#8FA8B7",
    "historic": "#9C8FA8",
}
LANDMARK_POINT_STROKE_COLORS = {
    "amenity": "#927756",
    "tourism": "#6F8796",
    "historic": "#7C6E88",
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

# default color scheme (clean, low-saturation cinematic)

GEOJSON_POLYGON_FILL = "#C9D2CC"
GEOJSON_POLYGON_STROKE = "#8E9A93"
GEOJSON_LINE_STROKE = "#A7B2AB"
GEOJSON_LABEL_FILL = "#DCE1DE"

WATERWAY_LINE_STROKE = "#8FA7B5"
WATERWAY_POLYGON_STROKE = "#7E98A6"
WATERWAY_POLYGON_FILL = "#A9BCC7"

HIGHLIGHT_CIRCLE_FILL = "#D9B39D"
HIGHLIGHT_CIRCLE_STROKE = "#B88E78"

CIRCLE_FILL = "#CFA785"
CIRCLE_STROKE = "#A88368"

def _apply_cover_mode_colors():
    """Apply a dedicated medium-boost movie-cover palette."""
    global GEOJSON_POLYGON_FILL, GEOJSON_POLYGON_STROKE, GEOJSON_LINE_STROKE
    GEOJSON_POLYGON_FILL = "#9CB6A8"
    GEOJSON_POLYGON_STROKE = "#5F7C6E"
    GEOJSON_LINE_STROKE = "#D3A487"

    global GEOJSON_LABEL_FILL
    GEOJSON_LABEL_FILL = "#4A413A"

    global WATERWAY_LINE_STROKE, WATERWAY_POLYGON_STROKE, WATERWAY_POLYGON_FILL
    WATERWAY_LINE_STROKE = "#63A8C4"
    WATERWAY_POLYGON_STROKE = "#4F87A0"
    WATERWAY_POLYGON_FILL = "#82C1D8"

    global CIRCLE_FILL, CIRCLE_STROKE
    CIRCLE_FILL = "#FFB56B"
    CIRCLE_STROKE = "#E77D3C"

    global LANDMARK_POINT_COLORS, LANDMARK_POINT_STROKE_COLORS
    LANDMARK_POINT_COLORS = {
        "amenity": "#F2A65A",
        "tourism": "#5BAED6",
        "historic": "#B189D6",
    }
    LANDMARK_POINT_STROKE_COLORS = {
        "amenity": "#B56D2D",
        "tourism": "#3D7F9E",
        "historic": "#8768A8",
    }

def _apply_dark_mode():
    global GEOJSON_POLYGON_FILL, GEOJSON_POLYGON_STROKE, GEOJSON_LINE_STROKE
    GEOJSON_POLYGON_FILL = "#75807A"
    GEOJSON_POLYGON_STROKE = "#A8B3AD"
    GEOJSON_LINE_STROKE = "#B6C1BB"

    global GEOJSON_LABEL_FILL
    GEOJSON_LABEL_FILL = "#CDD3CF"

    global WATERWAY_LINE_STROKE, WATERWAY_POLYGON_STROKE, WATERWAY_POLYGON_FILL
    WATERWAY_LINE_STROKE = "#8EA3AF"
    WATERWAY_POLYGON_STROKE = "#748A96"
    WATERWAY_POLYGON_FILL = "#90A5B1"

    global HIGHLIGHT_CIRCLE_FILL, HIGHLIGHT_CIRCLE_STROKE
    HIGHLIGHT_CIRCLE_FILL = "#BEA08E"
    HIGHLIGHT_CIRCLE_STROKE = "#D2B8A8"

    global CIRCLE_FILL, CIRCLE_STROKE
    CIRCLE_FILL = "#D4B091"
    CIRCLE_STROKE = "#A98871"

    global LANDMARK_POINT_COLORS, LANDMARK_POINT_STROKE_COLORS
    LANDMARK_POINT_COLORS = {
        "amenity": "#B7A386",
        "tourism": "#91A9B7",
        "historic": "#A194AE",
    }
    LANDMARK_POINT_STROKE_COLORS = {
        "amenity": "#8D7A61",
        "tourism": "#6D8593",
        "historic": "#7B6F88",
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


def _set_active_svg_canvas(svg_w: int,
                           svg_h: int,
                           margin_ratio: float = 0.0,
                           offset_x: float = 0.0,
                           offset_y: float = 0.0):
    """Set active projection canvas and safe-margin ratio used by geo_to_svg defaults."""
    global ACTIVE_SVG_WIDTH, ACTIVE_SVG_HEIGHT, ACTIVE_SVG_MARGIN_RATIO
    global ACTIVE_SVG_OFFSET_X, ACTIVE_SVG_OFFSET_Y
    ACTIVE_SVG_WIDTH = svg_w
    ACTIVE_SVG_HEIGHT = svg_h
    ACTIVE_SVG_MARGIN_RATIO = max(0.0, min(0.45, margin_ratio))
    ACTIVE_SVG_OFFSET_X = offset_x
    ACTIVE_SVG_OFFSET_Y = offset_y


def _compute_time_range(records: list[dict]) -> str:
    """Return a concise date range from record datetimes."""
    date_values = []
    for rec in records:
        raw_dt = rec.get("datetime")
        if not isinstance(raw_dt, str) or len(raw_dt) < 10:
            continue
        date_part = raw_dt[:10]
        if len(date_part) == 10 and date_part[4] == "-" and date_part[7] == "-":
            date_values.append(date_part)

    if not date_values:
        return "Unknown time range"

    start_date = min(date_values)
    end_date = max(date_values)
    if start_date == end_date:
        return start_date
    return f"{start_date} - {end_date}"


def _wrap_cover_text(text_value: str, max_chars: int) -> list[str]:
    """Wrap text into lines by character count without breaking words when possible."""
    text_value = (text_value or "").strip()
    if not text_value:
        return []

    wrapped_lines = []
    for paragraph in text_value.splitlines():
        paragraph = paragraph.strip()
        if not paragraph:
            if wrapped_lines:
                wrapped_lines.append("")
            continue

        words = paragraph.split()
        if len(words) <= 1:
            raw = paragraph
            while len(raw) > max_chars:
                wrapped_lines.append(raw[:max_chars])
                raw = raw[max_chars:]
            if raw:
                wrapped_lines.append(raw)
            continue

        current = words[0]
        for word in words[1:]:
            candidate = f"{current} {word}"
            if len(candidate) <= max_chars:
                current = candidate
            else:
                wrapped_lines.append(current)
                current = word
        wrapped_lines.append(current)

    return wrapped_lines


def _append_cover_panel(svg_root: ET.Element,
                        canvas_width: int,
                        canvas_height: int,
                        panel_x: float,
                        panel_width: float,
                        title: str,
                        time_range: str,
                        description: str):
    """Render a poster-style metadata block for cover output."""
    del panel_x, panel_width

    panel = ET.SubElement(svg_root, "g", id="cover_panel")
    text_margin_x = canvas_width * 0.08
    text_right = canvas_width * 0.66
    text_max_width = max(100.0, text_right - text_margin_x)

    title_text = (title or "City Walk").strip() or "City Walk"
    desc_text = (description or "").strip()
    cover_font_family = '"Gill Sans", "Gill Sans MT", sans-serif'

    title_font = 140
    meta_font = 62
    desc_font = 50

    top_anchor = canvas_height * 0.58
    bottom_padding = canvas_height * 0.09
    available_text_height = max(1.0, canvas_height - top_anchor - bottom_padding)

    scale = 1.0
    title_lines = [title_text]
    desc_lines = []
    current_title_font = title_font
    current_meta_font = meta_font
    current_desc_font = desc_font
    while True:
        current_title_font = max(24, int(round(title_font * scale)))
        current_meta_font = max(20, int(round(meta_font * scale)))
        current_desc_font = max(16, int(round(desc_font * scale)))

        title_max_chars = max(6, int(text_max_width / (current_title_font * 0.58)))
        title_lines = _wrap_cover_text(title_text, title_max_chars)
        if not title_lines:
            title_lines = ["City Walk"]

        if desc_text:
            desc_max_chars = max(10, int(text_max_width / (current_desc_font * 0.56)))
            desc_lines = _wrap_cover_text(desc_text, desc_max_chars)
        else:
            desc_lines = []

        title_block_height = len(title_lines) * current_title_font * 1.08 + current_title_font * 0.10
        time_block_height = current_meta_font
        desc_gap_height = current_meta_font * 1.5 if desc_lines else 0.0
        desc_block_height = len(desc_lines) * current_desc_font * 1.28
        total_height = title_block_height + time_block_height + desc_gap_height + desc_block_height

        if total_height <= available_text_height or scale <= 0.35:
            break
        scale *= 0.92

    total_height = 0.0
    title_block_height = len(title_lines) * current_title_font * 1.12 + current_title_font * 0.13
    time_block_height = current_meta_font
    desc_gap_height = current_meta_font * 1.7 if desc_lines else 0.0
    desc_block_height = len(desc_lines) * current_desc_font * 1.35
    total_height = title_block_height + time_block_height + desc_gap_height + desc_block_height

    cursor_y = canvas_height - bottom_padding - total_height + current_title_font

    for line in title_lines:
        title_elem = ET.SubElement(panel, "text")
        title_elem.set("x", f"{text_margin_x:.2f}")
        title_elem.set("y", f"{cursor_y:.2f}")
        title_elem.set("fill", "#F4E9D8")
        title_elem.set("font-size", str(current_title_font))
        title_elem.set("font-weight", "700")
        title_elem.set("font-family", '"Gill Sans", "Avenir Next Condensed", "PingFang SC", "Noto Sans CJK SC", sans-serif')
        title_elem.text = line
        cursor_y += current_title_font * 1.08

    cursor_y += current_title_font * 0.10

    time_elem = ET.SubElement(panel, "text")
    time_elem.set("x", f"{text_margin_x:.2f}")
    time_elem.set("y", f"{cursor_y:.2f}")
    time_elem.set("fill", "#C9C1B3")
    time_elem.set("font-size", str(current_meta_font))
    time_elem.set("font-family", '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif')
    time_elem.set("font-weight", "600")
    time_elem.text = time_range

    if not desc_lines:
        return

    cursor_y += current_meta_font * 1.5

    for line in desc_lines:
        line_elem = ET.SubElement(panel, "text")
        line_elem.set("x", f"{text_margin_x:.2f}")
        line_elem.set("y", f"{cursor_y:.2f}")
        line_elem.set("fill", "#DED3C2")
        line_elem.set("font-size", str(current_desc_font))
        line_elem.set("font-family", '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif')
        line_elem.set("font-weight", "500")
        line_elem.text = line
        cursor_y += current_desc_font * 1.28


def geo_to_svg(lon: float, lat: float,
               min_x_merc: float, min_y_merc: float,
               max_x_merc: float, max_y_merc: float,
               svg_w: int | None = None,
               svg_h: int | None = None) -> tuple[float, float]:
    """
    Map (lon, lat) → (svg_x, svg_y) using Mercator projection.
    Uses one uniform scale for both axes to avoid stretch distortion,
    then centers the projected map in the SVG viewport.
    """
    x_merc = _lon_to_mercator(lon)
    y_merc = _lat_to_mercator(lat)

    if svg_w is None:
        svg_w = ACTIVE_SVG_WIDTH
    if svg_h is None:
        svg_h = ACTIVE_SVG_HEIGHT
    margin_ratio = ACTIVE_SVG_MARGIN_RATIO
    offset_base_x = ACTIVE_SVG_OFFSET_X
    offset_base_y = ACTIVE_SVG_OFFSET_Y

    span_x = max(max_x_merc - min_x_merc, 1e-12)
    span_y = max(max_y_merc - min_y_merc, 1e-12)

    # Keep one meter-per-pixel ratio in both directions (no anisotropic scaling).
    usable_w = max(svg_w * (1.0 - 2.0 * margin_ratio), 1.0)
    usable_h = max(svg_h * (1.0 - 2.0 * margin_ratio), 1.0)
    scale = min(usable_w / span_x, usable_h / span_y)
    draw_w = span_x * scale
    draw_h = span_y * scale
    offset_x = offset_base_x + (svg_w - draw_w) / 2.0
    offset_y = offset_base_y + (svg_h - draw_h) / 2.0

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

def _polyline_midpoint_direction(points: list[tuple[float, float]]) -> tuple[tuple[float, float] | None, float]:
    """Return midpoint anchor and local direction angle (degrees) using neighboring segment points."""
    if len(points) < 2:
        return None, 0.0

    total = _polyline_length(points)
    if total <= 0:
        return points[0], 0.0

    target = total / 2.0
    walked = 0.0
    for idx in range(1, len(points)):
        x0, y0 = points[idx - 1]
        x1, y1 = points[idx]
        seg = math.hypot(x1 - x0, y1 - y0)
        if walked + seg >= target and seg > 0:
            ratio = (target - walked) / seg
            anchor_x = x0 + (x1 - x0) * ratio
            anchor_y = y0 + (y1 - y0) * ratio

            direction_x = x1 - x0
            direction_y = y1 - y0
            angle = math.degrees(math.atan2(direction_y, direction_x))

            # Keep text orientation readable (avoid upside-down labels).
            if angle > 90.0:
                angle -= 180.0
            elif angle < -90.0:
                angle += 180.0

            return (anchor_x, anchor_y), angle
        walked += seg

    x0, y0 = points[-2]
    x1, y1 = points[-1]
    angle = math.degrees(math.atan2(y1 - y0, x1 - x0))
    if angle > 90.0:
        angle -= 180.0
    elif angle < -90.0:
        angle += 180.0
    return points[-1], angle


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

def _append_text(svg_root: ET.Element, x: float, y: float, text_value: str):
    """Append a styled SVG text label near the given anchor point, with support for multiple fonts."""
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


def _append_centered_rotated_text(svg_root: ET.Element,
                                  x: float,
                                  y: float,
                                  text_value: str,
                                  angle_deg: float):
    """Append a centered SVG label rotated around its anchor point."""
    if not text_value:
        return
    text_elem = ET.SubElement(svg_root, "text")
    text_elem.set("x", f"{x:.2f}")
    text_elem.set("y", f"{y:.2f}")
    text_elem.set("fill", GEOJSON_LABEL_FILL)
    text_elem.set("opacity", "0.55")
    text_elem.set("stroke", 'none')
    text_elem.set("stroke-width", "3")
    text_elem.set("font-size", str(GEOJSON_LABEL_FONT_SIZE))
    text_elem.set("font-family", GEOJSON_LABEL_FONT_FAMILY)
    text_elem.set("font-weight", "600")
    text_elem.set("text-anchor", "middle")
    text_elem.set("dominant-baseline", "central")
    text_elem.set("transform", f"rotate({angle_deg:.2f} {x:.2f} {y:.2f})")
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
                    # random stroke color
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
                continue

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

            outer_elem = ET.SubElement(landmarks_points_root, "circle")
            outer_elem.set("cx", f"{x:.2f}")
            outer_elem.set("cy", f"{y:.2f}")
            outer_elem.set("r", str(LANDMARK_POINT_OUTER_RADIUS))
            outer_elem.set("fill", "none")
            outer_elem.set("opacity", str(LANDMARK_POINT_OUTER_OPACITY))
            outer_elem.set("stroke", LANDMARK_POINT_STROKE_COLORS.get(category, LANDMARK_POINT_STROKE_COLORS["amenity"]))
            outer_elem.set("stroke-width", str(LANDMARK_POINT_STROKE_WIDTH))

            inner_elem = ET.SubElement(landmarks_points_root, "circle")
            inner_elem.set("cx", f"{x:.2f}")
            inner_elem.set("cy", f"{y:.2f}")
            inner_elem.set("r", str(LANDMARK_POINT_RADIUS))
            inner_elem.set("opacity", str(LANDMARK_POINT_INNER_OPACITY))
            inner_elem.set("fill", LANDMARK_POINT_COLORS.get(category, LANDMARK_POINT_COLORS["amenity"]))
            inner_elem.set("stroke", "none")

            center_dot_elem = ET.SubElement(landmarks_points_root, "circle")
            center_dot_elem.set("cx", f"{x:.2f}")
            center_dot_elem.set("cy", f"{y:.2f}")
            center_dot_elem.set("r", str(LANDMARK_POINT_CENTER_DOT_RADIUS))
            center_dot_elem.set("fill", LANDMARK_POINT_CENTER_DOT_FILL)
            center_dot_elem.set("opacity", "0.95")
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
            
            if highway in {"motorway", "trunk"} and name not in rendered_labels:
                midpoint, angle_deg = _polyline_midpoint_direction(merged)
                if midpoint is not None:
                    _append_centered_rotated_text(labels_root, midpoint[0], midpoint[1], name, angle_deg)
                    rendered_labels.add(name)

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
              landmark_distance_m: float,
              cover_mode: bool = False,
              cover_title: str = "",
              cover_desc: str = "",
              cover_time_range: str = "") -> tuple[ET.Element, ET.Element | None, ET.Element | None, ET.Element | None, ET.Element | None]:
    """
    Compose the full SVG tree once.
    Layers (bottom → top): background, GeoJSON shapes, photo circles, one movable highlight.
    Returns: (svg_root, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot)
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    canvas_width = COVER_SVG_WIDTH if cover_mode else SVG_WIDTH
    canvas_height = COVER_SVG_HEIGHT if cover_mode else SVG_HEIGHT
    canvas_margin = 0.03 if cover_mode else 0.0
    map_offset_x = 0.0
    map_offset_y = 0.0
    map_width = canvas_width
    map_height = canvas_height
    panel_x = canvas_width
    panel_width = 0.0

    if cover_mode:
        map_width = canvas_width
        panel_x = 0.0
        panel_width = canvas_width
        # Shift projected map center from 50% to ~62% of cover width.
        map_offset_x = canvas_width * 0.12

    _set_active_svg_canvas(map_width, map_height, canvas_margin, map_offset_x, map_offset_y)

    svg_ns = "http://www.w3.org/2000/svg"
    ET.register_namespace("", svg_ns)
    svg = ET.Element(f"{{{svg_ns}}}svg")
    svg.set("width", str(canvas_width))
    svg.set("height", str(canvas_height))
    svg.set("viewBox", f"0 0 {canvas_width} {canvas_height}")
    
    defs = ET.SubElement(svg, "defs")
    # # define feBlend with multiply mode for highlight ring
    filter_elem = ET.SubElement(defs, "filter", id="highlight-blend")
    ET.SubElement(filter_elem, "feBlend", mode="multiply", in2="BackgroundImage", in_="SourceGraphic")
    # # define filter of feComposite with arithmetic operator for highlight halo
    # filter_elem2 = ET.SubElement(defs, "filter", id="highlight-halo-blend")
    # ET.SubElement(filter_elem2, "feComposite", operator="arithmetic", k1="0", k2="1", k3="0", k4="0", in2="BackgroundImage", in_="SourceGraphic")
    
    # Background
    if cover_mode or use_svg_background:
        bg = ET.SubElement(svg, "rect")
        bg.set("width", str(canvas_width))
        bg.set("height", str(canvas_height))
        bg.set("fill", "#d8d1c4" if cover_mode else "#f8f8f8")

    if cover_mode:
        overlay_grad = ET.SubElement(defs, "linearGradient", id="cover-text-gradient")
        overlay_grad.set("x1", "0")
        overlay_grad.set("y1", "0")
        overlay_grad.set("x2", "0")
        overlay_grad.set("y2", "1")
        ET.SubElement(overlay_grad, "stop", offset="0%", style="stop-color:#0f0f0d;stop-opacity:0.12")
        ET.SubElement(overlay_grad, "stop", offset="52%", style="stop-color:#0f0f0d;stop-opacity:0.18")
        ET.SubElement(overlay_grad, "stop", offset="100%", style="stop-color:#0f0f0d;stop-opacity:0.80")

        vignette_grad = ET.SubElement(defs, "radialGradient", id="cover-vignette")
        vignette_grad.set("cx", "50%")
        vignette_grad.set("cy", "45%")
        vignette_grad.set("r", "72%")
        ET.SubElement(vignette_grad, "stop", offset="55%", style="stop-color:#000000;stop-opacity:0")
        ET.SubElement(vignette_grad, "stop", offset="100%", style="stop-color:#000000;stop-opacity:0.28")

    if cover_mode:
        _append_cover_panel(
            svg,
            canvas_width,
            canvas_height,
            panel_x,
            panel_width,
            cover_title,
            cover_time_range,
            cover_desc,
        )

    # GeoJSON layer
    if geojson_path and os.path.isfile(geojson_path):
        geojson_elements(geojson_path, min_lon, min_lat, max_lon, max_lat, svg, records, landmark_distance_m)

    if cover_mode:
        text_grad_overlay = ET.SubElement(svg, "rect")
        text_grad_overlay.set("x", "0")
        text_grad_overlay.set("y", "0")
        text_grad_overlay.set("width", str(canvas_width))
        text_grad_overlay.set("height", str(canvas_height))
        text_grad_overlay.set("fill", "url(#cover-text-gradient)")

        vignette_overlay = ET.SubElement(svg, "rect")
        vignette_overlay.set("x", "0")
        vignette_overlay.set("y", "0")
        vignette_overlay.set("width", str(canvas_width))
        vignette_overlay.set("height", str(canvas_height))
        vignette_overlay.set("fill", "url(#cover-vignette)")

    highlight_photo_root = ET.SubElement(svg, "g", id="highlight_photo")
    photos_root = ET.SubElement(svg, "g", id="photos")

    # Photo markers: passport-stamp style to express visited locations.
    point_halo_radius = CIRCLE_HALO_RADIUS * (1.25 if cover_mode else 1.05)
    point_halo_opacity = 0.24 if cover_mode else CIRCLE_HALO_OPACITY
    stamp_outer_radius = PHOTO_STAMP_OUTER_RADIUS * (1.16 if cover_mode else 1.0)
    stamp_inner_radius = PHOTO_STAMP_INNER_RADIUS * (1.16 if cover_mode else 1.0)
    stamp_outer_width = PHOTO_STAMP_OUTER_WIDTH if cover_mode else max(2, PHOTO_STAMP_OUTER_WIDTH - 1)
    stamp_inner_opacity = 0.9 if cover_mode else PHOTO_STAMP_INNER_OPACITY
    stamp_outer_opacity = 0.86 if cover_mode else PHOTO_STAMP_OUTER_OPACITY
    center_dot_radius = PHOTO_STAMP_CENTER_DOT_RADIUS * (1.1 if cover_mode else 1.0)
    cross_size = PHOTO_STAMP_CENTER_CROSS_SIZE * (1.1 if cover_mode else 1.0)
    cross_width = PHOTO_STAMP_CENTER_CROSS_WIDTH

    for rec in records:
        x, y = geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)

        halo = ET.SubElement(photos_root, "circle")
        halo.set("cx", f"{x:.2f}")
        halo.set("cy", f"{y:.2f}")
        halo.set("r", f"{point_halo_radius:.2f}")
        halo.set("opacity", str(point_halo_opacity))
        halo.set("fill", CIRCLE_FILL)

        outer_ring = ET.SubElement(photos_root, "circle")
        outer_ring.set("cx", f"{x:.2f}")
        outer_ring.set("cy", f"{y:.2f}")
        outer_ring.set("r", f"{stamp_outer_radius:.2f}")
        outer_ring.set("fill", "none")
        outer_ring.set("stroke", "none")
        outer_ring.set("stroke-width", str(stamp_outer_width))
        outer_ring.set("stroke-dasharray", PHOTO_STAMP_OUTER_DASH)
        outer_ring.set("opacity", str(stamp_outer_opacity))

        inner_core = ET.SubElement(photos_root, "circle")
        inner_core.set("cx", f"{x:.2f}")
        inner_core.set("cy", f"{y:.2f}")
        inner_core.set("r", f"{stamp_inner_radius:.2f}")
        inner_core.set("fill", CIRCLE_FILL)
        inner_core.set("stroke", "none")
        inner_core.set("opacity", str(stamp_inner_opacity))

        center_dot = ET.SubElement(photos_root, "circle")
        center_dot.set("cx", f"{x:.2f}")
        center_dot.set("cy", f"{y:.2f}")
        center_dot.set("r", f"{center_dot_radius:.2f}")
        center_dot.set("fill", PHOTO_STAMP_CENTER_DOT_FILL)
        center_dot.set("opacity", "0.96")

        cross_h = ET.SubElement(photos_root, "line")
        cross_h.set("x1", f"{x - cross_size:.2f}")
        cross_h.set("y1", f"{y:.2f}")
        cross_h.set("x2", f"{x + cross_size:.2f}")
        cross_h.set("y2", f"{y:.2f}")
        cross_h.set("stroke", PHOTO_STAMP_CENTER_CROSS_COLOR)
        cross_h.set("stroke-width", str(cross_width))
        cross_h.set("opacity", "0.92")

        cross_v = ET.SubElement(photos_root, "line")
        cross_v.set("x1", f"{x:.2f}")
        cross_v.set("y1", f"{y - cross_size:.2f}")
        cross_v.set("x2", f"{x:.2f}")
        cross_v.set("y2", f"{y + cross_size:.2f}")
        cross_v.set("stroke", PHOTO_STAMP_CENTER_CROSS_COLOR)
        cross_v.set("stroke-width", str(cross_width))
        cross_v.set("opacity", "0.92")

    highlight_halo = None
    highlight_circle = None
    highlight_ring = None
    highlight_center_dot = None

    if not cover_mode:
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

    if cover_mode:
        _append_cover_panel(
            svg,
            canvas_width,
            canvas_height,
            panel_x,
            panel_width,
            cover_title,
            cover_time_range,
            cover_desc,
        )

    return svg, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot


def set_highlight_position(highlight_halo: ET.Element | None,
                           highlight_circle: ET.Element | None,
                           highlight_ring: ET.Element | None,
                           highlight_center_dot: ET.Element | None,
                           rec: dict,
                           bbox: tuple[float, float, float, float]):
    """Update reusable highlight layer positions for the given photo record."""
    if (highlight_halo is None or highlight_circle is None or
            highlight_ring is None or highlight_center_dot is None):
        return

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

def export_png(svg_content: str, png_path: str, width: int = PNG_SIZE, height: int = PNG_SIZE):
    """Rasterize SVG to a width×height PNG using CairoSVG with transparency."""
    cairosvg.svg2png(
        bytestring=svg_content.encode("utf-8"),
        write_to=png_path,
        output_width=width,
        output_height=height,
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
    parser.add_argument("--cover", type=int, default=0, choices=[0, 1],
                          help="set to 1 to generate a single movie cover PNG with background and no highlight circle")
    parser.add_argument("--cover-title", default="",
                        help="cover title shown in right text panel when --cover 1")
    parser.add_argument("--cover-desc", default="",
                        help="short cover description shown in right text panel when --cover 1")
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

    cover_mode = args.cover == 1
    if cover_mode:
        _apply_cover_mode_colors()

    cover_time_range = _compute_time_range(records)

    if args.simple:
        global use_highway_simple_filter
        use_highway_simple_filter = True

    svg_root, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot = build_svg(
        records,
        bbox,
        osm_geojson_name,
        args.landmark_distance,
        cover_mode=cover_mode,
        cover_title=args.cover_title,
        cover_desc=args.cover_desc,
        cover_time_range=cover_time_range,
    )
    
    # save the svg tree to a file for debugging
    # debug_svg_path = Path.cwd() / "__tmp" / f"{Path(args.photos_dir).name}_debug.svg"
    # ET.ElementTree(svg_root).write(debug_svg_path, encoding="utf-8", xml_declaration=True)
    # print(f"Debug SVG saved to {debug_svg_path}")
    
    filtered_records = [
        rec for rec in records
        if not args.search or args.search.lower() in rec["id"].lower()
    ]

    if cover_mode:
        svg_content = ET.tostring(svg_root, encoding="unicode", xml_declaration=False)
        cover_png = output_dir / f"{Path(args.photos_dir).name}_map_cover.png"
        export_png(svg_content, str(cover_png), width=COVER_SVG_WIDTH, height=COVER_SVG_HEIGHT)
        print(f"Cover saved → {cover_png}")
        print(
            f"Generated 1 cover file in {output_dir}  ({COVER_SVG_WIDTH}×{COVER_SVG_HEIGHT}px)"
        )
        return

    generated_count = 0
    for rec in filtered_records:
        set_highlight_position(highlight_halo, highlight_circle, highlight_ring, highlight_center_dot, rec, bbox)
        svg_content = ET.tostring(svg_root, encoding="unicode", xml_declaration=False)
        output_png = output_dir / f"{Path(rec['id']).stem}_map.png"
        export_png(svg_content, str(output_png))
        generated_count += 1
        print(f"Map saved → {output_png}")

    print(f"Generated {generated_count} map file(s) in {output_dir}  ({PNG_SIZE}×{PNG_SIZE}px)")

if __name__ == "__main__":
    main()
