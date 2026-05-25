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
import datetime as dt
import json
import math
import os
import sys
import urllib.error
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path

from PIL import Image

import photos_viz_config as viz_cfg
from photos_viz_config import *
from photos_viz_sharing import (
    _parse_osm_ref_from_properties,
    convert_overpass_to_geojson,
    export_photos_geojson,
    export_png,
    fetch_overpass_json,
    get_osm_geojson_path,
    get_overpass_query_output_path,
    get_photos_geojson_path,
    render_overpass_query,
)


# Title nearest-place lookup radius in meters.
max_circle_distance_to_find_the_near_place = 450.0
TITLE_CORNER_CHOICES = ("top-left", "top-right", "bottom-left", "bottom-right")
TITLE_FONT_SIZE = 90
TITLE_MARGIN = 42
TITLE_LINE_HEIGHT = 1.12
TITLE_BG_ENABLE = True
TITLE_BG_FILL = "#000000"
TITLE_BG_GRADIENT_ID = "title-panel-gradient"
TITLE_BG_GRADIENT_START_OPACITY = 0.65
TITLE_BG_GRADIENT_END_OPACITY = 0.2
TITLE_BG_STROKE = "none"
TITLE_BG_STROKE_OPACITY = 0.0
TITLE_BG_STROKE_WIDTH = 0.0
TITLE_BG_PADDING_X = 26.0
TITLE_BG_PADDING_TOP = 18.0
TITLE_BG_PADDING_BOTTOM = 14.0
TITLE_BG_RADIUS = 0.0
TITLE_BG_BOTTOM_GAP = 90.0
TITLE_TEXT_FILL = "#FFFFFF"
TITLE_TIME_FILL = "#FFFFFF"
TITLE_STROKE_COLOR = "#0A0A0A"
TITLE_STROKE_WIDTH = 0.0
TITLE_STROKE_OPACITY = 0.0
TITLE_TIMELINE_ENABLE = True
TITLE_TIMELINE_GAP = 6.0
TITLE_TIMELINE_HEIGHT = 8.0
TITLE_TIMELINE_PADDING_X = 20.0
TITLE_TIMELINE_TRACK_FILL = "#6E6054"
TITLE_TIMELINE_TRACK_OPACITY = 0.55
TITLE_TIMELINE_PROGRESS_FILL = "#FA8E41"
TITLE_TIMELINE_PROGRESS_OPACITY = 0.95
SPINE_STROKE = "#FA8E41"
SPINE_STROKE_WIDTH = 12
SPINE_OPACITY = 0.82
SPINE_GAP_DASH_THRESHOLD_PX = 140.0
SPINE_GAP_DASHARRAY = "20 14"


def _sync_palette_from_config():
    global GEOJSON_POLYGON_FILL, GEOJSON_POLYGON_STROKE, GEOJSON_LINE_STROKE
    global ROAD_STROKE_COLORS
    global GEOJSON_LABEL_FILL
    global WATERWAY_LINE_STROKE, WATERWAY_POLYGON_STROKE, WATERWAY_POLYGON_FILL
    global HIGHLIGHT_CIRCLE_FILL, HIGHLIGHT_CIRCLE_STROKE
    global CIRCLE_FILL, CIRCLE_STROKE
    global LANDMARK_POINT_COLORS, LANDMARK_POINT_STROKE_COLORS

    GEOJSON_POLYGON_FILL = viz_cfg.GEOJSON_POLYGON_FILL
    GEOJSON_POLYGON_STROKE = viz_cfg.GEOJSON_POLYGON_STROKE
    GEOJSON_LINE_STROKE = viz_cfg.GEOJSON_LINE_STROKE
    ROAD_STROKE_COLORS = dict(viz_cfg.ROAD_STROKE_COLORS)
    GEOJSON_LABEL_FILL = viz_cfg.GEOJSON_LABEL_FILL

    WATERWAY_LINE_STROKE = viz_cfg.WATERWAY_LINE_STROKE
    WATERWAY_POLYGON_STROKE = viz_cfg.WATERWAY_POLYGON_STROKE
    WATERWAY_POLYGON_FILL = viz_cfg.WATERWAY_POLYGON_FILL

    HIGHLIGHT_CIRCLE_FILL = viz_cfg.HIGHLIGHT_CIRCLE_FILL
    HIGHLIGHT_CIRCLE_STROKE = viz_cfg.HIGHLIGHT_CIRCLE_STROKE
    CIRCLE_FILL = viz_cfg.CIRCLE_FILL
    CIRCLE_STROKE = viz_cfg.CIRCLE_STROKE

    LANDMARK_POINT_COLORS = viz_cfg.LANDMARK_POINT_COLORS
    LANDMARK_POINT_STROKE_COLORS = viz_cfg.LANDMARK_POINT_STROKE_COLORS


def _apply_dark_mode():
    viz_cfg._apply_dark_mode()
    _sync_palette_from_config()


def _road_stroke_color(highway: str | None) -> str:
    """Resolve road stroke by highway category, with fallback color."""
    if isinstance(ROAD_STROKE_COLORS, dict):
        return ROAD_STROKE_COLORS.get(highway, GEOJSON_LINE_STROKE)
    return GEOJSON_LINE_STROKE

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
        svg_w = viz_cfg.ACTIVE_SVG_WIDTH
    if svg_h is None:
        svg_h = viz_cfg.ACTIVE_SVG_HEIGHT
    margin_ratio = viz_cfg.ACTIVE_SVG_MARGIN_RATIO
    offset_base_x = viz_cfg.ACTIVE_SVG_OFFSET_X
    offset_base_y = viz_cfg.ACTIVE_SVG_OFFSET_Y

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


def _place_category(properties: dict) -> str | None:
    """Classify feature into one of landmark/road/water for title lookup."""
    if not isinstance(properties, dict):
        return None
    if properties.get("tourism") or properties.get("historic") or properties.get("amenity"):
        return "landmark"
    if properties.get("highway"):
        return "road"
    if properties.get("waterway") or properties.get("natural") == "water":
        return "water"
    return None


def _iter_lonlat_points(coords):
    """Yield all [lon, lat] points from nested GeoJSON coordinate arrays."""
    if not isinstance(coords, list):
        return
    if len(coords) >= 2 and isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float)):
        yield float(coords[0]), float(coords[1])
        return
    for child in coords:
        if isinstance(child, list):
            yield from _iter_lonlat_points(child)


def _build_place_candidates(geojson_data: dict) -> dict[str, list[tuple[str, float, float]]]:
    """Build searchable named place points grouped by preferred place categories."""
    grouped: dict[str, list[tuple[str, float, float]]] = {
        "landmark": [],
        "road": [],
        "water": [],
    }
    features = geojson_data.get("features") if isinstance(geojson_data, dict) else None
    if not isinstance(features, list):
        return grouped

    for feature in features:
        if not isinstance(feature, dict):
            continue
        properties = feature.get("properties")
        if not isinstance(properties, dict):
            continue
        category = _place_category(properties)
        if category is None:
            continue
        name = _feature_name(properties)
        if not isinstance(name, str) or not name.strip():
            continue
        geom = feature.get("geometry")
        if not isinstance(geom, dict):
            continue
        coords = geom.get("coordinates")
        for lon, lat in _iter_lonlat_points(coords):
            grouped[category].append((name.strip(), lon, lat))
    return grouped


def _find_nearest_place_name(candidates: dict[str, list[tuple[str, float, float]]], lon: float, lat: float) -> str | None:
    """Find a single preferred nearby place name around the current photo location."""
    for category in ("landmark", "road", "water"):
        nearest: tuple[float, str] | None = None
        for name, p_lon, p_lat in candidates.get(category, []):
            dist = _haversine_distance_meters(lon, lat, p_lon, p_lat)
            if dist > max_circle_distance_to_find_the_near_place:
                continue
            if nearest is None or dist < nearest[0] or (math.isclose(dist, nearest[0], rel_tol=0.0, abs_tol=1e-6) and name < nearest[1]):
                nearest = (dist, name)
        if nearest is not None:
            return nearest[1]
    return None


def _format_title_time(datetime_str: str | None) -> str:
    """Format EXIF datetime into `May 24 14:34`."""
    if not isinstance(datetime_str, str) or not datetime_str.strip():
        return ""
    raw = datetime_str.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            parsed = dt.datetime.strptime(raw, fmt)
            return parsed.strftime("%b %d %H:%M")
        except ValueError:
            continue
    try:
        parsed = dt.datetime.fromisoformat(raw)
        return parsed.strftime("%b %d %H:%M")
    except ValueError:
        return ""


def _parse_photo_datetime(datetime_str: str | None) -> dt.datetime | None:
    """Parse EXIF datetime text into datetime object; return None on failure."""
    if not isinstance(datetime_str, str) or not datetime_str.strip():
        return None
    raw = datetime_str.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(raw, fmt)
        except ValueError:
            continue
    try:
        return dt.datetime.fromisoformat(raw)
    except ValueError:
        return None


def _build_time_progress_map(records: list[dict]) -> dict[str, float]:
    """Build per-photo progress (0..1) within the overall capture timespan."""
    progress: dict[str, float] = {}
    if not records:
        return progress

    dated_items: list[tuple[str, dt.datetime]] = []
    for rec in records:
        rec_id = rec.get("id")
        parsed_dt = _parse_photo_datetime(rec.get("datetime"))
        if isinstance(rec_id, str) and parsed_dt is not None:
            dated_items.append((rec_id, parsed_dt))

    if len(dated_items) >= 2:
        min_dt = min(item[1] for item in dated_items)
        max_dt = max(item[1] for item in dated_items)
        span_seconds = (max_dt - min_dt).total_seconds()
        if span_seconds > 0:
            for rec_id, parsed_dt in dated_items:
                elapsed = (parsed_dt - min_dt).total_seconds()
                progress[rec_id] = max(0.0, min(1.0, elapsed / span_seconds))
        else:
            for rec_id, _ in dated_items:
                progress[rec_id] = 1.0

    # Fallback for photos without parseable datetime: use record order progression.
    missing_ids = [rec.get("id") for rec in records if isinstance(rec.get("id"), str) and rec.get("id") not in progress]
    if missing_ids:
        if len(missing_ids) == 1:
            progress[missing_ids[0]] = 1.0
        else:
            denom = max(1, len(missing_ids) - 1)
            for idx, rec_id in enumerate(missing_ids):
                progress[rec_id] = idx / denom

    return progress


def _build_title_parts(rec: dict, place_candidates: dict[str, list[tuple[str, float, float]]]) -> tuple[str, str]:
    """Return (place, time), where place may be empty if nothing nearby is found."""
    time_part = _format_title_time(rec.get("datetime"))
    try:
        lon = float(rec["lon"])
        lat = float(rec["lat"])
    except (KeyError, TypeError, ValueError):
        return "", time_part

    place_name = _find_nearest_place_name(place_candidates, lon, lat)
    return place_name or "", time_part


def _wrap_title_text(text_value: str, max_chars: int) -> list[str]:
    """Wrap text into multiple lines with word-aware fallback splitting."""
    text_value = (text_value or "").strip()
    if not text_value:
        return []

    if max_chars <= 1:
        return [text_value]

    words = text_value.split()
    if not words:
        return []

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        lines.append(current)
        current = word
    lines.append(current)

    folded: list[str] = []
    for line in lines:
        if len(line) <= max_chars:
            folded.append(line)
            continue
        start = 0
        while start < len(line):
            folded.append(line[start:start + max_chars])
            start += max_chars
    return folded


def _set_title_position_and_text(title_elem: ET.Element | None,
                                title_bg_elem: ET.Element | None,
                                timeline_track_elem: ET.Element | None,
                                timeline_progress_elem: ET.Element | None,
                                place_text: str,
                                time_text: str,
                                timeline_progress: float,
                                title_corner: str,
                                canvas_width: int,
                                canvas_height: int):
    """Render title as multiline place (wrapped) plus time line in selected corner."""
    if title_elem is None:
        return

    # Clear previous tspans because this element is reused for each output frame.
    for child in list(title_elem):
        title_elem.remove(child)
    title_elem.text = ""

    place_text = (place_text or "").strip()
    time_text = (time_text or "").strip()

    max_width = max(120.0, canvas_width * 0.9)
    place_font_size = TITLE_FONT_SIZE
    min_place_font_size = 26
    place_lines: list[str] = []

    while place_font_size >= min_place_font_size:
        max_chars = max(7, int(max_width / (place_font_size * 0.58)))
        place_lines = _wrap_title_text(place_text, max_chars)
        if not place_lines:
            break

        longest_line = max(len(line) for line in place_lines)
        estimated_width = longest_line * place_font_size * 0.58
        if len(place_lines) <= 4 and estimated_width <= max_width:
            break
        place_font_size -= 3

    time_font_size = max(20, int(place_font_size * 0.62))
    all_line_count = len(place_lines) + (1 if time_text else 0)
    
    # if text is Chinese (SC), use "Yuanti SC", otherwise use "Gill Sans".
    if any('\u4e00' <= ch <= '\u9fff' for ch in place_text):
        title_elem.set("font-family", '"Yuanti SC", "Helvetica Neue", Helvetica, Arial, sans-serif')    
    else:
        title_elem.set("font-family", '"Gill Sans", "Helvetica Neue", Helvetica, Arial, sans-serif')
    
    title_elem.set("font-weight", "700")
    title_elem.set("fill", TITLE_TEXT_FILL)
    title_elem.set("stroke", "none")
    # Title strip is always bottom-anchored and left aligned for iMovie overlay readability.
    title_elem.set("text-anchor", "start")

    x_pos = TITLE_BG_PADDING_X
    line_step = place_font_size * TITLE_LINE_HEIGHT
    first_line_size = place_font_size
    last_line_size = time_font_size if time_text else place_font_size
    text_block_height = (
        first_line_size * 0.82
        + max(0, all_line_count - 1) * line_step
        + last_line_size * 0.22
    )
    panel_h = text_block_height + TITLE_BG_PADDING_TOP + TITLE_BG_PADDING_BOTTOM
    panel_y = max(0.0, canvas_height - TITLE_BG_BOTTOM_GAP - panel_h)
    start_y = panel_y + TITLE_BG_PADDING_TOP + first_line_size * 0.82

    title_elem.set("x", f"{x_pos:.2f}")
    title_elem.set("y", f"{start_y:.2f}")
    title_elem.set("dominant-baseline", "alphabetic")

    line_index = 0
    line_sizes: list[int] = []
    line_texts: list[str] = []
    for idx, line in enumerate(place_lines):
        tspan = ET.SubElement(title_elem, "tspan")
        tspan.set("x", f"{x_pos:.2f}")
        tspan.set("dy", "0" if idx == 0 else f"{line_step:.2f}")
        tspan.set("font-size", str(place_font_size))
        tspan.text = line
        line_index += 1
        line_sizes.append(place_font_size)
        line_texts.append(line)

    if time_text:
        time_tspan = ET.SubElement(title_elem, "tspan")
        time_tspan.set("x", f"{x_pos:.2f}")
        time_tspan.set("dy", f"{line_step:.2f}" if line_index > 0 else "0")
        time_tspan.set("font-size", str(time_font_size))
        time_tspan.set("fill", TITLE_TIME_FILL)
        time_tspan.set("opacity", "0.92")
        time_tspan.text = time_text
        line_sizes.append(time_font_size)
        line_texts.append(time_text)

    if title_bg_elem is None:
        return

    if not TITLE_BG_ENABLE or not line_texts:
        title_bg_elem.set("visibility", "hidden")
        return

    title_bg_elem.set("x", "0.00")
    title_bg_elem.set("y", f"{panel_y:.2f}")
    title_bg_elem.set("width", f"{canvas_width:.2f}")
    title_bg_elem.set("height", f"{panel_h:.2f}")
    title_bg_elem.set("rx", f"{TITLE_BG_RADIUS:.2f}")
    title_bg_elem.set("ry", f"{TITLE_BG_RADIUS:.2f}")
    title_bg_elem.set("fill", f"url(#{TITLE_BG_GRADIENT_ID})")
    title_bg_elem.set("opacity", "1.00")
    title_bg_elem.set("stroke", TITLE_BG_STROKE)
    title_bg_elem.set("stroke-opacity", f"{TITLE_BG_STROKE_OPACITY:.2f}")
    title_bg_elem.set("stroke-width", f"{TITLE_BG_STROKE_WIDTH:.2f}")
    title_bg_elem.set("visibility", "visible")

    if timeline_track_elem is None or timeline_progress_elem is None:
        return

    if not TITLE_TIMELINE_ENABLE:
        timeline_track_elem.set("visibility", "hidden")
        timeline_progress_elem.set("visibility", "hidden")
        return

    bar_x = max(0.0, TITLE_TIMELINE_PADDING_X)
    bar_w = max(1.0, float(canvas_width) - 2.0 * bar_x)
    bar_h = TITLE_TIMELINE_HEIGHT
    bar_y = min(max(0.0, panel_y + panel_h + TITLE_TIMELINE_GAP), max(0.0, canvas_height - bar_h))
    normalized_progress = max(0.0, min(1.0, timeline_progress))

    timeline_track_elem.set("x", f"{bar_x:.2f}")
    timeline_track_elem.set("y", f"{bar_y:.2f}")
    timeline_track_elem.set("width", f"{bar_w:.2f}")
    timeline_track_elem.set("height", f"{bar_h:.2f}")
    timeline_track_elem.set("fill", TITLE_TIMELINE_TRACK_FILL)
    timeline_track_elem.set("opacity", f"{TITLE_TIMELINE_TRACK_OPACITY:.2f}")
    timeline_track_elem.set("visibility", "visible")

    timeline_progress_elem.set("x", f"{bar_x:.2f}")
    timeline_progress_elem.set("y", f"{bar_y:.2f}")
    timeline_progress_elem.set("width", f"{max(0.0, bar_w * normalized_progress):.2f}")
    timeline_progress_elem.set("height", f"{bar_h:.2f}")
    timeline_progress_elem.set("fill", TITLE_TIMELINE_PROGRESS_FILL)
    timeline_progress_elem.set("opacity", f"{TITLE_TIMELINE_PROGRESS_OPACITY:.2f}")
    timeline_progress_elem.set("visibility", "visible")


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


def _svg_points_to_polyline(points: list[tuple[float, float]]) -> str:
    """Convert SVG point tuples to a polyline points string."""
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in points)


def _extend_polyline_endpoints(points: list[tuple[float, float]], extend_px: float) -> list[tuple[float, float]]:
    """Extend the first and last points slightly along their local directions."""
    if len(points) < 2 or extend_px <= 0:
        return points

    extended = points[:]

    start_dir = None
    for idx in range(1, len(points)):
        dx = points[idx][0] - points[0][0]
        dy = points[idx][1] - points[0][1]
        seg_len = math.hypot(dx, dy)
        if seg_len > 1e-6:
            start_dir = (dx / seg_len, dy / seg_len)
            break

    end_dir = None
    for idx in range(len(points) - 2, -1, -1):
        dx = points[-1][0] - points[idx][0]
        dy = points[-1][1] - points[idx][1]
        seg_len = math.hypot(dx, dy)
        if seg_len > 1e-6:
            end_dir = (dx / seg_len, dy / seg_len)
            break

    if start_dir is not None:
        extended[0] = (
            extended[0][0] - start_dir[0] * extend_px,
            extended[0][1] - start_dir[1] * extend_px,
        )

    if end_dir is not None:
        extended[-1] = (
            extended[-1][0] + end_dir[0] * extend_px,
            extended[-1][1] + end_dir[1] * extend_px,
        )

    return extended


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
    """Return midpoint anchor and local direction angle (degrees) for a line."""
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
    """Estimate label width in pixels for placement checks."""
    return max(1, len(text_value)) * GEOJSON_LABEL_FONT_SIZE * 0.55


def _append_text(svg_root: ET.Element, x: float, y: float, text_value: str):
    """Append a styled SVG text label near the given anchor point."""
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
    text_elem.set("stroke", "none")
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
                     landmark_distance_m: float,
                     show_labels: bool = False):
    """Parse a GeoJSON FeatureCollection and append SVG geometry and optional labels."""
    try:
        with open(geojson_path, encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as err:
        print(f"[warn] GeoJSON skipped: {err}", file=sys.stderr)
        return

    features = data.get("features", [])
    rendered_labels = set()
    rendered_label_boxes = []
    named_line_batches = {}
    allowed_landmarks = _collect_nearby_landmarks(features, records, landmark_distance_m)
    photo_points = [
        geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)
        for rec in records
    ] if show_labels else []
    landmark_candidates = []
    seen_landmark_keys = set()

    roads_root = ET.SubElement(svg_root, "g", id="roads")
    rivers_root = ET.SubElement(svg_root, "g", id="rivers")
    landmarks_root = ET.SubElement(svg_root, "g", id="landmarks")
    landmarks_points_root = ET.SubElement(svg_root, "g", id="landmarks_points")
    labels_root = ET.SubElement(svg_root, "g", id="labels")
    
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
                        
        elif gtype == "LineString":
            coords = geom.get("coordinates", [])
            if not isinstance(coords, list) or not coords:
                continue
            svg_points = _coords_to_svg_points(coords, min_lon, min_lat, max_lon, max_lat)
            if len(svg_points) < 2:
                continue
            
            if waterway:
                stroke_color = WATERWAY_LINE_STROKE
                width = WATERWAY_WIDTHS.get(waterway, GEOJSON_LINE_STROKE_WIDTH)
            else:
                if use_highway_simple_filter and highway not in highway_simple_filter:
                    continue  # skip minor roads for visual clarity
                
                stroke_color = _road_stroke_color(highway)
                width = HIGHWAY_WIDTHS.get(highway, GEOJSON_LINE_STROKE_WIDTH)
                svg_points = _extend_polyline_endpoints(svg_points, viz_cfg.ROAD_ENDPOINT_EXTEND_PX)

            pts = _svg_points_to_polyline(svg_points)

            if show_labels and name:
                kind = "river" if waterway else "road"
                batch_key = (kind, name)
                batch = named_line_batches.get(batch_key)
                if batch is None:
                    named_line_batches[batch_key] = {
                        "highway": highway,
                        "segments": [svg_points],
                    }
                else:
                    batch["segments"].append(svg_points)

            target_group = rivers_root if waterway else roads_root
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
            for line in lines:
                if not isinstance(line, list) or not line:
                    continue
                svg_points = _coords_to_svg_points(line, min_lon, min_lat, max_lon, max_lat)
                if len(svg_points) >= 2:
                    candidate_lines.append(svg_points)

            if waterway:
                stroke_color = WATERWAY_LINE_STROKE
                width = WATERWAY_WIDTHS.get(waterway, GEOJSON_LINE_STROKE_WIDTH)
                target_group = rivers_root
            else:
                if use_highway_simple_filter and highway not in highway_simple_filter:
                    continue  # skip minor roads for visual clarity
                
                stroke_color = _road_stroke_color(highway)
                width = HIGHWAY_WIDTHS.get(highway, GEOJSON_LINE_STROKE_WIDTH)
                target_group = roads_root

            if show_labels and name and candidate_lines:
                kind = "river" if waterway else "road"
                batch_key = (kind, name)
                batch = named_line_batches.get(batch_key)
                if batch is None:
                    named_line_batches[batch_key] = {
                        "highway": highway,
                        "segments": candidate_lines,
                    }
                else:
                    batch["segments"].extend(candidate_lines)

            for line in lines:
                if not isinstance(line, list) or not line:
                    continue
                line_points = _coords_to_svg_points(line, min_lon, min_lat, max_lon, max_lat)
                if len(line_points) < 2:
                    continue
                if not waterway:
                    line_points = _extend_polyline_endpoints(line_points, viz_cfg.ROAD_ENDPOINT_EXTEND_PX)
                pts = _svg_points_to_polyline(line_points)
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

            if show_labels and name:
                landmark_candidates.append({
                    "name": name,
                    "x": x,
                    "y": y,
                    "score": landmark_meta["score"],
                })

    if not show_labels:
        return

    for (kind, name), batch in named_line_batches.items():
        if kind != "road":
            continue
        highway = batch.get("highway")
        if highway not in highway_labels_filter or name in rendered_labels:
            continue

        merged_lines = _stitch_polylines(batch["segments"])
        for merged in merged_lines:
            midpoint, angle_deg = _polyline_midpoint_direction(merged)
            if midpoint is None:
                continue
            _append_centered_rotated_text(labels_root, midpoint[0], midpoint[1], name, angle_deg)
            rendered_labels.add(name)
            break

    # Place landmark labels by importance with greedy overlap rejection.
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
        rendered_label_boxes.append(label_box)
        grid_counts[cell_key] = grid_counts.get(cell_key, 0) + 1
        labels_used += 1
                
# ── SVG composition ──────────────────────────────────────────────────────────

def build_svg_minimap(records: list[dict],
                      bbox: tuple[float, float, float, float],
                      geojson_path: str | None,
                      landmark_distance_m: float) -> tuple[ET.Element, ET.Element | None, ET.Element | None, ET.Element | None, ET.Element | None, ET.Element | None, ET.Element | None, ET.Element | None, ET.Element | None]:
    """
    Compose the full SVG tree once.
    Layers (bottom → top): background, GeoJSON shapes, route spine, one movable highlight, title.
    Returns: (svg_root, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot, title_bg_elem, timeline_track_elem, timeline_progress_elem, title_elem)
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    canvas_width = SVG_WIDTH
    canvas_height = SVG_HEIGHT
    viz_cfg._set_active_svg_canvas(canvas_width, canvas_height, 0.0, 0.0, 0.0)

    svg_ns = "http://www.w3.org/2000/svg"
    ET.register_namespace("", svg_ns)
    svg = ET.Element(f"{{{svg_ns}}}svg")
    svg.set("width", str(canvas_width))
    svg.set("height", str(canvas_height))
    svg.set("viewBox", f"0 0 {canvas_width} {canvas_height}")
    
    defs = ET.SubElement(svg, "defs")
    title_panel_gradient = ET.SubElement(defs, "linearGradient", id=TITLE_BG_GRADIENT_ID)
    title_panel_gradient.set("x1", "0%")
    title_panel_gradient.set("y1", "0%")
    title_panel_gradient.set("x2", "100%")
    title_panel_gradient.set("y2", "0%")
    gradient_start = ET.SubElement(title_panel_gradient, "stop")
    gradient_start.set("offset", "0%")
    gradient_start.set("stop-color", TITLE_BG_FILL)
    gradient_start.set("stop-opacity", f"{TITLE_BG_GRADIENT_START_OPACITY:.2f}")
    gradient_end = ET.SubElement(title_panel_gradient, "stop")
    gradient_end.set("offset", "100%")
    gradient_end.set("stop-color", TITLE_BG_FILL)
    gradient_end.set("stop-opacity", f"{TITLE_BG_GRADIENT_END_OPACITY:.2f}")

    # # define feBlend with multiply mode for highlight ring
    filter_elem = ET.SubElement(defs, "filter", id="highlight-blend")
    ET.SubElement(filter_elem, "feBlend", mode="multiply", in2="BackgroundImage", in_="SourceGraphic")
    # # define filter of feComposite with arithmetic operator for highlight halo
    # filter_elem2 = ET.SubElement(defs, "filter", id="highlight-halo-blend")
    # ET.SubElement(filter_elem2, "feComposite", operator="arithmetic", k1="0", k2="1", k3="0", k4="0", in2="BackgroundImage", in_="SourceGraphic")

    # GeoJSON layer
    if geojson_path and os.path.isfile(geojson_path):
        geojson_elements(
            geojson_path,
            min_lon,
            min_lat,
            max_lon,
            max_lat,
            svg,
            records,
            landmark_distance_m,
            show_labels=False,
        )

    spine_root = ET.SubElement(svg, "g", id="spine")
    highlight_photo_root = ET.SubElement(svg, "g", id="highlight_photo")
    title_root = ET.SubElement(svg, "g", id="title")

    if len(records) >= 2:
        spine_points: list[tuple[float, float]] = []
        for rec in records:
            x, y = geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)
            spine_points.append((x, y))

        for idx in range(1, len(spine_points)):
            x1, y1 = spine_points[idx - 1]
            x2, y2 = spine_points[idx]
            seg_len = math.hypot(x2 - x1, y2 - y1)

            seg = ET.SubElement(spine_root, "line")
            seg.set("x1", f"{x1:.2f}")
            seg.set("y1", f"{y1:.2f}")
            seg.set("x2", f"{x2:.2f}")
            seg.set("y2", f"{y2:.2f}")
            seg.set("stroke", SPINE_STROKE)
            seg.set("stroke-width", str(SPINE_STROKE_WIDTH))
            seg.set("stroke-linecap", "round")
            seg.set("opacity", f"{SPINE_OPACITY:.2f}")
            if seg_len >= SPINE_GAP_DASH_THRESHOLD_PX:
                seg.set("stroke-dasharray", SPINE_GAP_DASHARRAY)

    title_bg_elem = ET.SubElement(title_root, "rect")
    title_bg_elem.set("visibility", "hidden")
    timeline_track_elem = ET.SubElement(title_root, "rect")
    timeline_track_elem.set("visibility", "hidden")
    timeline_progress_elem = ET.SubElement(title_root, "rect")
    timeline_progress_elem.set("visibility", "hidden")
    title_elem = ET.SubElement(title_root, "text")

    # Reusable highlight layers. Positions are updated per photo before export.
    highlight_scale = 0.58
    highlight_fill = "#FF7A1A"
    highlight_stroke = "#FF3D00"

    highlight_halo = ET.SubElement(highlight_photo_root, "circle")
    highlight_halo.set("opacity", "0.44")
    highlight_halo.set("r", f"{HIGHLIGHT_HALO_RADIUS * highlight_scale:.2f}")
    highlight_halo.set("fill", highlight_fill)

    highlight_circle = ET.SubElement(highlight_photo_root, "circle")
    highlight_circle.set("opacity", "0.82")
    highlight_circle.set("r", f"{HIGHLIGHT_CIRCLE_RADIUS * highlight_scale:.2f}")
    highlight_circle.set("fill", highlight_fill)
    highlight_circle.set("stroke", highlight_stroke)
    highlight_circle.set("stroke-width", f"{HIGHLIGHT_CIRCLE_STROKE_WIDTH * 0.68:.2f}")

    highlight_ring = ET.SubElement(highlight_photo_root, "circle")
    highlight_ring.set("fill", "none")
    highlight_ring.set("r", f"{HIGHLIGHT_RING_RADIUS * highlight_scale:.2f}")
    highlight_ring.set("stroke", highlight_stroke)
    highlight_ring.set("stroke-width", f"{HIGHLIGHT_RING_STROKE_WIDTH * 0.66:.2f}")
    highlight_ring.set("opacity", "0.95")

    highlight_center_dot = ET.SubElement(highlight_photo_root, "circle")
    highlight_center_dot.set("r", f"{max(2.0, HIGHLIGHT_CENTER_DOT_RADIUS * 0.72):.2f}")
    highlight_center_dot.set("fill", "#FFF1E6")

    return svg, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot, title_bg_elem, timeline_track_elem, timeline_progress_elem, title_elem


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
    parser.add_argument("--simple", type=bool, default=True,
                        help="only render major highways (motorway, trunk, primary) for visual clarity")
    parser.add_argument("--landmark-distance", type=float, default=LANDMARK_DISTANCE_M_DEFAULT,
                        help=f"render landmarks within this distance (meters, default: {LANDMARK_DISTANCE_M_DEFAULT})")
    parser.add_argument("--title-corner", choices=TITLE_CORNER_CHOICES, default="top-left",
                        help="corner placement for title text (top-left, top-right, bottom-left, bottom-right)")
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

    place_candidates = _build_place_candidates(geojson_data)

    svg_root, highlight_halo, highlight_circle, highlight_ring, highlight_center_dot, title_bg_elem, timeline_track_elem, timeline_progress_elem, title_elem = build_svg_minimap(
        records,
        bbox,
        osm_geojson_name,
        args.landmark_distance,
    )
    time_progress_map = _build_time_progress_map(records)
    
    filtered_records = [
        rec for rec in records
        if not args.search or args.search.lower() in rec["id"].lower()
    ]

    generated_count = 0
    for rec in filtered_records:
        set_highlight_position(highlight_halo, highlight_circle, highlight_ring, highlight_center_dot, rec, bbox)
        place_text, time_text = _build_title_parts(rec, place_candidates)
        rec_progress = time_progress_map.get(rec.get("id"), 0.0)
        _set_title_position_and_text(
            title_elem,
            title_bg_elem,
            timeline_track_elem,
            timeline_progress_elem,
            place_text,
            time_text,
            rec_progress,
            args.title_corner,
            SVG_WIDTH,
            SVG_HEIGHT,
        )
        svg_content = ET.tostring(svg_root, encoding="unicode", xml_declaration=False)
        output_png = output_dir / f"{Path(rec['id']).stem}_map.png"
        export_png(svg_content, str(output_png))
        generated_count += 1
        print(f"Map saved → {output_png}")

    print(f"Generated {generated_count} map file(s) in {output_dir}  ({PNG_SIZE}×{PNG_SIZE}px)")

if __name__ == "__main__":
    main()
