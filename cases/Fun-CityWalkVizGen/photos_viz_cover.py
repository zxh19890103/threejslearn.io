import argparse
from datetime import datetime
import json
from math import asin, cos, radians, sin, sqrt
import random
import sys
import urllib.error
import xml.etree.ElementTree as ET
from pathlib import Path

import photos_viz as mini
import photos_viz_config as viz_cfg


def _parse_record_datetime(raw_dt: str) -> datetime | None:
	raw = (raw_dt or "").strip().replace("T", " ")

	if len(raw) >= 16:
		candidate = raw[:16]
		try:
			return datetime.strptime(candidate, "%Y-%m-%d %H:%M")
		except ValueError:
			pass

	if len(raw) >= 10:
		candidate = raw[:10]
		try:
			return datetime.strptime(candidate, "%Y-%m-%d")
		except ValueError:
			pass

	return None


def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
	"""Return great-circle distance between two WGS84 points in meters."""
	earth_radius_m = 6371000.0
	lat1_rad = radians(lat1)
	lat2_rad = radians(lat2)
	delta_lat = radians(lat2 - lat1)
	delta_lon = radians(lon2 - lon1)
	a = sin(delta_lat / 2.0) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2.0) ** 2
	c = 2.0 * asin(min(1.0, sqrt(a)))
	return earth_radius_m * c


def _compute_total_distance_km(records: list[dict]) -> float:
	"""Sum track distance in kilometers using sorted footprint/photo records."""
	ordered_points: list[tuple[datetime | None, int, float, float]] = []
	for idx, rec in enumerate(records):
		lat_raw = rec.get("lat")
		lon_raw = rec.get("lon")
		if not isinstance(lat_raw, (int, float)) or not isinstance(lon_raw, (int, float)):
			continue

		dt_value = None
		raw_dt = rec.get("datetime")
		if isinstance(raw_dt, str):
			dt_value = _parse_record_datetime(raw_dt)

		ordered_points.append((dt_value, idx, float(lat_raw), float(lon_raw)))

	if len(ordered_points) < 2:
		return 0.0

	ordered_points.sort(key=lambda item: (item[0] is None, item[0] or datetime.max, item[1]))

	total_m = 0.0
	for i in range(1, len(ordered_points)):
		_, _, prev_lat, prev_lon = ordered_points[i - 1]
		_, _, curr_lat, curr_lon = ordered_points[i]
		total_m += _haversine_distance_m(prev_lat, prev_lon, curr_lat, curr_lon)

	return total_m / 1000.0

def _compute_time_range(records: list[dict]) -> str:
	"""Return formatted time range: same-day shows times, multi-day shows date span."""
	def _fmt_date(dt_value: datetime) -> str:
		month = dt_value.strftime("%b")
		return f"{month} {dt_value.day}, {dt_value.year}"

	datetime_values: list[datetime] = []
	for rec in records:
		raw_dt = rec.get("datetime")
		if not isinstance(raw_dt, str):
			continue
		parsed = _parse_record_datetime(raw_dt)
		if parsed:
			datetime_values.append(parsed)

	if not datetime_values:
		return "Unknown time range"

	start_dt = min(datetime_values)
	end_dt = max(datetime_values)
	if start_dt.date() == end_dt.date():
		date_label = _fmt_date(start_dt)
		return f"{date_label}  {start_dt.strftime('%H:%M')} ~ {end_dt.strftime('%H:%M')}"

	return f"{_fmt_date(start_dt)} ~ {_fmt_date(end_dt)}"


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


def _append_cover_panel(
	svg_root: ET.Element,
	canvas_width: int,
	canvas_height: int,
	panel_x: float,
	panel_width: float,
	title: str,
	time_range: str,
	description: str,
):
	"""Render a poster-style metadata block for cover output."""
	del panel_x, panel_width

	panel = ET.SubElement(svg_root, "g", id="cover_panel")
	text_margin_x = canvas_width * 0.08
	text_right = canvas_width * 0.92
	text_max_width = max(100.0, text_right - text_margin_x)

	title_text = (title or "City Walk").strip() or "City Walk"
	desc_text = (description or "").strip()

	title_font = 200
	meta_font = 124
	desc_font = 108

	top_anchor = canvas_height * 0.52
	bottom_padding = canvas_height * 0.07
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

	title_block_height = len(title_lines) * current_title_font * 1.12 + current_title_font * 0.13
	time_block_height = current_meta_font
	desc_gap_height = current_meta_font * 1.7 if desc_lines else 0.0
	desc_block_height = len(desc_lines) * current_desc_font * 1.35
	total_height = title_block_height + time_block_height + desc_gap_height + desc_block_height

	panel_pad_x = canvas_width * 0.045
	panel_pad_top = current_title_font * 0.40
	panel_pad_bottom = current_desc_font * 0.75
	panel_left = max(0.0, text_margin_x - panel_pad_x)
	panel_top = max(0.0, canvas_height - bottom_padding - total_height - panel_pad_top)
	panel_width_px = min(canvas_width - panel_left, canvas_width * 0.90)
	panel_height_px = min(canvas_height - panel_top, total_height + panel_pad_top + panel_pad_bottom)

	defs_node = svg_root.find("defs")
	if defs_node is None:
		defs_node = ET.SubElement(svg_root, "defs")

	grad_idx = len(list(defs_node.findall("linearGradient"))) + len(list(defs_node.findall("radialGradient")))
	text_mask_grad_id = f"cover-text-safe-poly-{grad_idx}"
	text_mask_grad = ET.SubElement(defs_node, "radialGradient", id=text_mask_grad_id)
	text_mask_grad.set("gradientUnits", "userSpaceOnUse")
	mask_cx = panel_left + panel_width_px * 0.30
	mask_cy = panel_top + panel_height_px * 0.52
	mask_rx = max(panel_width_px * 0.86, 1.0)
	mask_ry = max(panel_height_px * 0.92, 1.0)
	text_mask_grad.set("cx", "0")
	text_mask_grad.set("cy", "0")
	text_mask_grad.set("r", "1")
	text_mask_grad.set(
		"gradientTransform",
		f"translate({mask_cx:.2f} {mask_cy:.2f}) scale({mask_rx:.2f} {mask_ry:.2f})",
	)
	ET.SubElement(text_mask_grad, "stop", offset="0%", style="stop-color:#000000;stop-opacity:0.38")
	ET.SubElement(text_mask_grad, "stop", offset="46%", style="stop-color:#000000;stop-opacity:0.32")
	ET.SubElement(text_mask_grad, "stop", offset="76%", style="stop-color:#000000;stop-opacity:0.10")
	ET.SubElement(text_mask_grad, "stop", offset="100%", style="stop-color:#000000;stop-opacity:0")

	poly_left = panel_left - panel_width_px * 0.24
	poly_right = panel_left + panel_width_px * 1.02
	poly_top = panel_top - panel_height_px * 0.14
	poly_bottom = panel_top + panel_height_px * 1.12
	rng = random.Random()

	def _clamp(v: float, lo: float, hi: float) -> float:
		return max(lo, min(hi, v))

	poly_points = []
	poly_points.append((poly_left, panel_top + panel_height_px * (0.24 + rng.uniform(-0.03, 0.04))))

	top_count = 16
	for i in range(top_count):
		t = i / (top_count - 1)
		x = panel_left + panel_width_px * (0.02 + 0.94 * t) + panel_width_px * rng.uniform(-0.015, 0.015)
		# Keep top bumps soft; avoid sharp spikes.
		y = panel_top - panel_height_px * (0.025 + rng.uniform(0.01, 0.06))
		poly_points.append((_clamp(x, poly_left, poly_right), _clamp(y, poly_top, poly_bottom)))

	right_count = 5
	for i in range(right_count):
		t = i / (right_count - 1)
		x = panel_left + panel_width_px * (0.98 + rng.uniform(-0.025, 0.01))
		y = panel_top + panel_height_px * (0.24 + 0.66 * t + rng.uniform(-0.02, 0.02))
		poly_points.append((_clamp(x, poly_left, poly_right), _clamp(y, poly_top, poly_bottom)))

	bottom_count = 9
	for i in range(bottom_count):
		t = i / (bottom_count - 1)
		x = panel_left + panel_width_px * (0.92 - 0.78 * t + rng.uniform(-0.02, 0.02))
		y = panel_top + panel_height_px * (1.04 + rng.uniform(0.0, 0.08))
		poly_points.append((_clamp(x, poly_left, poly_right), _clamp(y, poly_top, poly_bottom)))

	left_count = 5
	for i in range(left_count):
		t = i / (left_count - 1)
		x = panel_left + panel_width_px * (0.10 + rng.uniform(-0.04, 0.02))
		y = panel_top + panel_height_px * (0.90 - 0.54 * t + rng.uniform(-0.02, 0.02))
		poly_points.append((_clamp(x, poly_left, poly_right), _clamp(y, poly_top, poly_bottom)))
	points_str = " ".join(f"{px:.2f},{py:.2f}" for px, py in poly_points)

	text_safe_mask = ET.SubElement(panel, "polygon")
	text_safe_mask.set("points", points_str)
	text_safe_mask.set("fill", f"url(#{text_mask_grad_id})")

	cursor_y = canvas_height - bottom_padding - total_height + current_title_font

	for line in title_lines:
		title_elem = ET.SubElement(panel, "text")
		title_elem.set("x", f"{text_margin_x:.2f}")
		title_elem.set("y", f"{cursor_y:.2f}")
		title_elem.set("fill", "#FFFDF8")
		title_elem.set("font-size", str(current_title_font))
		title_elem.set("font-weight", "700")
		title_elem.set("font-family", '"Gill Sans", "Avenir Next Condensed", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		title_elem.set("stroke", "none")
		title_elem.set("stroke-opacity", "0.42")
		title_elem.set("stroke-width", "2.6")
		title_elem.set("paint-order", "stroke fill")
		title_elem.text = line
		cursor_y += current_title_font * 1.08

	cursor_y += current_title_font * 0.10

	time_elem = ET.SubElement(panel, "text")
	time_elem.set("x", f"{text_margin_x:.2f}")
	time_elem.set("y", f"{cursor_y:.2f}")
	time_elem.set("fill", "#FFF7E8")
	time_elem.set("font-size", str(current_meta_font))
	time_elem.set("font-family", '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif')
	time_elem.set("font-weight", "600")
	time_elem.set("stroke", "none")
	time_elem.set("stroke-opacity", "0.38")
	time_elem.set("stroke-width", "2.1")
	time_elem.set("paint-order", "stroke fill")
	time_elem.text = time_range

	if not desc_lines:
		return

	cursor_y += current_meta_font * 1.5

	for line in desc_lines:
		line_elem = ET.SubElement(panel, "text")
		line_elem.set("x", f"{text_margin_x:.2f}")
		line_elem.set("y", f"{cursor_y:.2f}")
		line_elem.set("fill", "#FFF2E1")
		line_elem.set("font-size", str(current_desc_font))
		line_elem.set("font-family", '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		line_elem.set("font-weight", "500")
		line_elem.set("stroke", "none")
		line_elem.set("stroke-opacity", "0.36")
		line_elem.set("stroke-width", "1.9")
		line_elem.set("paint-order", "stroke fill")
		line_elem.text = line
		cursor_y += current_desc_font * 1.28


def build_svg_cover(
	records: list[dict],
	bbox: tuple[float, float, float, float],
	geojson_path: str | None,
	landmark_distance_m: float,
	cover_title: str,
	cover_desc: str,
	cover_time_range: str,
) -> ET.Element:
	min_lon, min_lat, max_lon, max_lat = bbox
	canvas_width = mini.COVER_SVG_WIDTH
	canvas_height = mini.COVER_SVG_HEIGHT
	canvas_margin = 0.03
	map_offset_x = canvas_width * 0.12
	map_offset_y = 0.0

	viz_cfg._set_active_svg_canvas(canvas_width, canvas_height, canvas_margin, map_offset_x, map_offset_y)

	svg_ns = "http://www.w3.org/2000/svg"
	ET.register_namespace("", svg_ns)
	svg = ET.Element(f"{{{svg_ns}}}svg")
	svg.set("width", str(canvas_width))
	svg.set("height", str(canvas_height))
	svg.set("viewBox", f"0 0 {canvas_width} {canvas_height}")

	defs = ET.SubElement(svg, "defs")
	filter_elem = ET.SubElement(defs, "filter", id="highlight-blend")
	ET.SubElement(filter_elem, "feBlend", mode="multiply", in2="BackgroundImage", in_="SourceGraphic")

	bg = ET.SubElement(svg, "rect")
	bg.set("width", str(canvas_width))
	bg.set("height", str(canvas_height))
	bg.set("fill", "#eaf6ff")

	overlay_grad = ET.SubElement(defs, "linearGradient", id="cover-text-gradient")
	overlay_grad.set("x1", "0")
	overlay_grad.set("y1", "0")
	overlay_grad.set("x2", "0")
	overlay_grad.set("y2", "1")
	ET.SubElement(overlay_grad, "stop", offset="0%", style="stop-color:#0f0f0d;stop-opacity:0.01")
	ET.SubElement(overlay_grad, "stop", offset="56%", style="stop-color:#0f0f0d;stop-opacity:0.06")
	ET.SubElement(overlay_grad, "stop", offset="100%", style="stop-color:#0f0f0d;stop-opacity:0.34")

	vignette_grad = ET.SubElement(defs, "radialGradient", id="cover-vignette")
	vignette_grad.set("cx", "50%")
	vignette_grad.set("cy", "45%")
	vignette_grad.set("r", "72%")
	ET.SubElement(vignette_grad, "stop", offset="55%", style="stop-color:#000000;stop-opacity:0")
	ET.SubElement(vignette_grad, "stop", offset="100%", style="stop-color:#000000;stop-opacity:0.10")

	_append_cover_panel(
		svg,
		canvas_width,
		canvas_height,
		0.0,
		canvas_width,
		cover_title,
		cover_time_range,
		cover_desc,
	)

	if geojson_path and Path(geojson_path).is_file():
		mini.geojson_elements(
			geojson_path,
			min_lon,
			min_lat,
			max_lon,
			max_lat,
			svg,
			records,
			landmark_distance_m,
			show_labels=True,
		)

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

	ET.SubElement(svg, "g", id="highlight_photo")
	photos_root = ET.SubElement(svg, "g", id="photos")

	point_halo_radius = mini.CIRCLE_HALO_RADIUS * 1.25
	point_halo_opacity = 0.30
	stamp_outer_radius = mini.PHOTO_STAMP_OUTER_RADIUS * 1.16
	stamp_inner_radius = mini.PHOTO_STAMP_INNER_RADIUS * 1.16
	stamp_outer_width = mini.PHOTO_STAMP_OUTER_WIDTH
	stamp_inner_opacity = 0.9
	stamp_outer_opacity = 0.86
	center_dot_radius = mini.PHOTO_STAMP_CENTER_DOT_RADIUS * 1.1
	cross_size = mini.PHOTO_STAMP_CENTER_CROSS_SIZE * 1.1
	cross_width = mini.PHOTO_STAMP_CENTER_CROSS_WIDTH
	point_halo_fill = "#63cfff"
	stamp_outer_stroke = "#7cc7ff"
	stamp_inner_fill = "#b1f192"
	center_dot_fill = "#2fbe72"
	cross_color = "#1370e3"

	for rec in records:
		x, y = mini.geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)

		halo = ET.SubElement(photos_root, "circle")
		halo.set("cx", f"{x:.2f}")
		halo.set("cy", f"{y:.2f}")
		halo.set("r", f"{point_halo_radius:.2f}")
		halo.set("opacity", str(point_halo_opacity))
		halo.set("fill", point_halo_fill)

		outer_ring = ET.SubElement(photos_root, "circle")
		outer_ring.set("cx", f"{x:.2f}")
		outer_ring.set("cy", f"{y:.2f}")
		outer_ring.set("r", f"{stamp_outer_radius:.2f}")
		outer_ring.set("fill", "none")
		outer_ring.set("stroke", stamp_outer_stroke)
		outer_ring.set("stroke-width", str(stamp_outer_width))
		outer_ring.set("opacity", str(stamp_outer_opacity))

		inner_core = ET.SubElement(photos_root, "circle")
		inner_core.set("cx", f"{x:.2f}")
		inner_core.set("cy", f"{y:.2f}")
		inner_core.set("r", f"{stamp_inner_radius:.2f}")
		inner_core.set("fill", stamp_inner_fill)
		inner_core.set("stroke", "none")
		inner_core.set("opacity", str(stamp_inner_opacity))

		center_dot = ET.SubElement(photos_root, "circle")
		center_dot.set("cx", f"{x:.2f}")
		center_dot.set("cy", f"{y:.2f}")
		center_dot.set("r", f"{center_dot_radius:.2f}")
		center_dot.set("fill", center_dot_fill)
		center_dot.set("opacity", "0.96")

		cross_h = ET.SubElement(photos_root, "line")
		cross_h.set("x1", f"{x - cross_size:.2f}")
		cross_h.set("y1", f"{y:.2f}")
		cross_h.set("x2", f"{x + cross_size:.2f}")
		cross_h.set("y2", f"{y:.2f}")
		cross_h.set("stroke", cross_color)
		cross_h.set("stroke-width", str(cross_width))
		cross_h.set("opacity", "0.92")

		cross_v = ET.SubElement(photos_root, "line")
		cross_v.set("x1", f"{x:.2f}")
		cross_v.set("y1", f"{y - cross_size:.2f}")
		cross_v.set("x2", f"{x:.2f}")
		cross_v.set("y2", f"{y + cross_size:.2f}")
		cross_v.set("stroke", cross_color)
		cross_v.set("stroke-width", str(cross_width))
		cross_v.set("opacity", "0.92")

	_append_cover_panel(
		svg,
		canvas_width,
		canvas_height,
		0.0,
		canvas_width,
		cover_title,
		cover_time_range,
		cover_desc,
	)

	return svg


def main():
    parser = argparse.ArgumentParser(description="Generate a movie-cover PNG from EXIF photo locations.")
    parser.add_argument("photos_dir", help="Directory containing Pixel 9 photos.")

    parser.add_argument("--padding", type=float, default=mini.PADDING_RATIO,
                        help=f"Bbox padding fraction (default: {mini.PADDING_RATIO}).")
    parser.add_argument("--dark", type=bool, default=False,
                        help="use a dark background and color scheme for better visibility in low-light conditions")
    parser.add_argument("--simple", type=bool, default=False,
                        help="only render major highways (motorway, trunk, primary) for visual clarity")
    parser.add_argument("--landmark-distance", type=float, default=mini.LANDMARK_DISTANCE_M_DEFAULT,
                        help=f"render landmarks within this distance (meters, default: {mini.LANDMARK_DISTANCE_M_DEFAULT})")
    args = parser.parse_args()

    print()
    cover_title = input("Cover title (leave blank to use default): ").strip()
    cover_desc = input("Cover description (optional): ").strip()
    print()

    print(f"Scanning photos in: {args.photos_dir}")
    records = mini.scan_photos(args.photos_dir)
    if not records:
        print("ERROR: No geotagged photos found.", file=sys.stderr)
        sys.exit(1)
    print(f"Found {len(records)} geotagged photo(s).")

    photos_geojson_path = mini.get_photos_geojson_path(args.photos_dir)
    mini.export_photos_geojson(records, photos_geojson_path)
    print(f"Photos exported -> {photos_geojson_path}")

    bbox = mini.compute_bbox(records, args.padding)
    min_x_merc, min_y_merc, max_x_merc, max_y_merc = bbox
    min_lon = mini._mercator_to_lon(min_x_merc)
    max_lon = mini._mercator_to_lon(max_x_merc)
    min_lat_deg = mini._mercator_to_lat(min_y_merc)
    max_lat_deg = mini._mercator_to_lat(max_y_merc)

    osm_geojson_name = mini.get_osm_geojson_path(args.photos_dir)

    try:
        with open(osm_geojson_name, "r", encoding="utf-8") as f:
            geojson_data = json.load(f)
    except FileNotFoundError:
        query_output_path = mini.get_overpass_query_output_path(args.photos_dir)
        query_output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            query_text = mini.render_overpass_query(min_lat_deg, min_lon, max_lat_deg, max_lon)
            query_output_path.write_text(query_text, encoding="utf-8")

            overpass_data = mini.fetch_overpass_json(query_text)
            geojson_data = mini.convert_overpass_to_geojson(overpass_data)

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
        pass

    print(f"Loading GeoJSON: {osm_geojson_name}")
    output_dir = Path.cwd() / "__tmp" / Path(args.photos_dir).name
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.dark:
        mini._apply_dark_mode()

    viz_cfg._apply_cover_mode_colors()
    mini._sync_palette_from_config()

    if args.simple:
        mini.use_highway_simple_filter = True

    cover_time_range = _compute_time_range(records)
    total_km = _compute_total_distance_km(records)
    cover_time_range = f"{cover_time_range}  ·  {total_km:.1f} km"

    svg_root = build_svg_cover(
        records,
        bbox,
        osm_geojson_name,
        args.landmark_distance,
		cover_title,
		cover_desc,
        cover_time_range,
    )

    svg_content = ET.tostring(svg_root, encoding="unicode", xml_declaration=False)
    cover_png = output_dir / f"{Path(args.photos_dir).name}_map_cover.png"
    mini.export_png(svg_content, str(cover_png), width=mini.COVER_SVG_WIDTH, height=mini.COVER_SVG_HEIGHT)
    print(f"Cover saved -> {cover_png}")
    print(
        f"Generated 1 cover file in {output_dir}  ({mini.COVER_SVG_WIDTH}x{mini.COVER_SVG_HEIGHT}px)"
    )


if __name__ == "__main__":
    main()
