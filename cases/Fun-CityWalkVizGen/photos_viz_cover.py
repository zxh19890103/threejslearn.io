import argparse
from datetime import datetime
import json
from math import asin, cos, radians, sin, sqrt
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import photos_viz as mini
import photos_viz_config as viz_cfg


PRIMARY_COVER_IMAGE_NAME = "Gemini_Generated_Image_i3xq43i3xq43i3xq.png"
PRIMARY_COVER_IMAGE_DIAMETER_PX = 288
PRIMARY_COVER_IMAGE_MARGIN_PX = 48


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


def _sorted_route_records(records: list[dict]) -> list[dict]:
	"""Return records sorted by datetime, falling back to original input order."""
	ordered: list[tuple[datetime | None, int, dict]] = []
	for idx, rec in enumerate(records):
		lat_raw = rec.get("lat")
		lon_raw = rec.get("lon")
		if not isinstance(lat_raw, (int, float)) or not isinstance(lon_raw, (int, float)):
			continue

		dt_value = None
		raw_dt = rec.get("datetime")
		if isinstance(raw_dt, str):
			dt_value = _parse_record_datetime(raw_dt)

		ordered.append((dt_value, idx, rec))

	ordered.sort(key=lambda item: (item[0] is None, item[0] or datetime.max, item[1]))
	return [item[2] for item in ordered]


def _append_start_end_badges(
	svg_root: ET.Element,
	start_rec: dict,
	end_rec: dict,
	min_lon: float,
	min_lat: float,
	max_lon: float,
	max_lat: float,
):
	"""Draw start/end badges replacing the first and last route markers."""
	badges_root = ET.SubElement(svg_root, "g", id="start_end_badges")

	def _draw_badge(rec: dict, label: str, fill_color: str, stroke_color: str, halo_color: str):
		x, y = mini.geo_to_svg(rec["lon"], rec["lat"], min_lon, min_lat, max_lon, max_lat)
		badge_halo_radius = 44
		badge_core_radius = 26
		badge_font_size = 30

		halo = ET.SubElement(badges_root, "circle")
		halo.set("cx", f"{x:.2f}")
		halo.set("cy", f"{y:.2f}")
		halo.set("r", str(badge_halo_radius))
		halo.set("fill", halo_color)
		halo.set("opacity", "0.34")

		core = ET.SubElement(badges_root, "circle")
		core.set("cx", f"{x:.2f}")
		core.set("cy", f"{y:.2f}")
		core.set("r", str(badge_core_radius))
		core.set("fill", fill_color)
		core.set("stroke", stroke_color)
		core.set("stroke-width", "4")
		core.set("opacity", "0.96")

		label_elem = ET.SubElement(badges_root, "text")
		label_elem.set("x", f"{x:.2f}")
		label_elem.set("y", f"{y + 0.8:.2f}")
		label_elem.set("fill", "#FFFFFF")
		label_elem.set("font-size", str(badge_font_size))
		label_elem.set("font-family", '"Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		label_elem.set("font-weight", "700")
		label_elem.set("text-anchor", "middle")
		label_elem.set("dominant-baseline", "central")
		label_elem.text = label

	_draw_badge(start_rec, "S", "#23B26D", "#0E8248", "#4BE59A")
	_draw_badge(end_rec, "E", "#FF7A3D", "#D84D12", "#FFB089")

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


def _load_cover_meta(meta_path: Path) -> dict[str, str]:
	"""Load key/value metadata from _meta.md."""
	try:
		raw_text = meta_path.read_text(encoding="utf-8")
	except OSError:
		return {}

	meta: dict[str, str] = {}
	for raw_line in raw_text.splitlines():
		line = raw_line.strip()
		if not line or line.startswith("#") or ":" not in line:
			continue
		key, value = line.split(":", 1)
		meta[key.strip().lower()] = value.strip()

	return meta


def _save_cover_meta(meta_path: Path, meta: dict[str, str]):
	"""Persist cover metadata for future CLI runs."""
	ordered_keys = [
		"title",
		"desc",
		"subtitle",
		"location_source",
		"location_confidence",
		"location_center_lat",
		"location_center_lon",
		"location_updated_at",
	]

	lines = ["# Cover Meta"]
	for key in ordered_keys:
		value = (meta.get(key) or "").strip()
		lines.append(f"{key}: {value}")
	lines.append("")

	content = "\n".join([
		*lines,
	])
	meta_path.write_text(content, encoding="utf-8")


def _compute_center_latlon(records: list[dict]) -> tuple[float, float] | None:
	"""Return simple centroid (lat, lon) across valid photo records."""
	lat_values: list[float] = []
	lon_values: list[float] = []
	for rec in records:
		lat_raw = rec.get("lat")
		lon_raw = rec.get("lon")
		if isinstance(lat_raw, (int, float)) and isinstance(lon_raw, (int, float)):
			lat_values.append(float(lat_raw))
			lon_values.append(float(lon_raw))

	if not lat_values:
		return None

	return sum(lat_values) / len(lat_values), sum(lon_values) / len(lon_values)


def _build_subtitle_from_address(address: dict) -> tuple[str, str]:
	"""Build subtitle and confidence from reverse-geocoded address fields."""
	city_candidates = [
		"city",
		"state",
		"town",
		"municipality",
		"village",
		"county",
	]
 
	neighborhood_candidates = [
		"neighbourhood",
		"suburb",
		"city_district",
		"borough",
		"district",
	]

	city = ""
	neighborhood = ""

	for key in city_candidates:
		value = address.get(key)
		if isinstance(value, str) and value.strip():
			city = value.strip()
			break

	for key in neighborhood_candidates:
		value = address.get(key)
		if isinstance(value, str) and value.strip():
			neighborhood = value.strip()
			break

	if city and neighborhood and city.lower() != neighborhood.lower():
		return f"{city} · {neighborhood}", "high"
	if city:
		return city, "medium"
	if neighborhood:
		return neighborhood, "medium"
	return "", "low"


def _is_english_text(value: str) -> bool:
	"""Return True when text is ASCII-only (English-safe fallback)."""
	if not value:
		return False
	return value.isascii()


def _reverse_geocode_subtitle(lat: float, lon: float) -> tuple[str, str, str]:
	"""Reverse geocode (lat, lon) to subtitle, source and confidence."""
	query = urllib.parse.urlencode(
		{
			"format": "jsonv2",
			"lat": f"{lat:.6f}",
			"lon": f"{lon:.6f}",
			"zoom": "14",
			"addressdetails": "1",
			"accept-language": "en",
		}
	)

	url = f"https://nominatim.openstreetmap.org/reverse?{query}"
 
	print(f"Reverse geocoding for cover subtitle: {url}")
 
	request = urllib.request.Request(
		url,
		headers={
			"User-Agent": "threejslearn-citywalk-cover/1.0",
			"Accept-Language": "en",
		},
	)

	with urllib.request.urlopen(request, timeout=8) as resp:
		payload = json.load(resp)

	address = payload.get("address")
	if not isinstance(address, dict):
		return "", "reverse_geocoding_api", "low"

	subtitle, confidence = _build_subtitle_from_address(address)
	# if not _is_english_text(subtitle):
	# 	subtitle = ""
	# 	confidence = "low"
	return subtitle, "reverse_geocoding_api", confidence


def _resolve_cover_subtitle(records: list[dict], meta: dict[str, str]) -> tuple[str, dict[str, str]]:
	"""Resolve subtitle with cache-first strategy and reverse-geocode fallback."""
	center = _compute_center_latlon(records)
	if center is None:
		return "", meta

	center_lat, center_lon = center
	cached_subtitle = (meta.get("subtitle") or "").strip()
	cached_lat_raw = (meta.get("location_center_lat") or "").strip()
	cached_lon_raw = (meta.get("location_center_lon") or "").strip()

	try:
		cached_lat = float(cached_lat_raw)
		cached_lon = float(cached_lon_raw)
	except ValueError:
		cached_lat = None
		cached_lon = None

	if (
		cached_subtitle
		and _is_english_text(cached_subtitle)
		and cached_lat is not None
		and cached_lon is not None
		and abs(cached_lat - center_lat) <= 0.0005
		and abs(cached_lon - center_lon) <= 0.0005
	):
		return cached_subtitle, meta

	try:
		subtitle, source, confidence = _reverse_geocode_subtitle(center_lat, center_lon)
		meta["subtitle"] = subtitle
		meta["location_source"] = source
		meta["location_confidence"] = confidence
		meta["location_center_lat"] = f"{center_lat:.6f}"
		meta["location_center_lon"] = f"{center_lon:.6f}"
		meta["location_updated_at"] = datetime.now().isoformat(timespec="seconds")
		return subtitle, meta
	except (urllib.error.URLError, OSError, ValueError, TimeoutError, json.JSONDecodeError):
		return (cached_subtitle if _is_english_text(cached_subtitle) else ""), meta


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


def _stable_noise(seed: float) -> float:
	"""Return a deterministic pseudo-random value in [0, 1)."""
	value = sin(seed * 12.9898 + 78.233) * 43758.5453
	return value - int(value)


def _convex_hull(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
	"""Compute a convex hull using the monotonic chain algorithm."""
	unique_points = sorted(set(points))
	if len(unique_points) <= 1:
		return unique_points

	def _cross(o: tuple[float, float], a: tuple[float, float], b: tuple[float, float]) -> float:
		return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

	lower: list[tuple[float, float]] = []
	for point in unique_points:
		while len(lower) >= 2 and _cross(lower[-2], lower[-1], point) <= 0:
			lower.pop()
		lower.append(point)

	upper: list[tuple[float, float]] = []
	for point in reversed(unique_points):
		while len(upper) >= 2 and _cross(upper[-2], upper[-1], point) <= 0:
			upper.pop()
		upper.append(point)

	return lower[:-1] + upper[:-1]


def _build_text_mask_hulls(
	poly_left: float,
	poly_top: float,
	poly_right: float,
	poly_bottom: float,
	canvas_width: int,
	canvas_height: int,
	variant_seed: float,
) -> list[list[tuple[float, float]]]:
	"""Build multiple oversized convex hulls around the text block."""
	mask_w = max(1.0, poly_right - poly_left)
	mask_h = max(1.0, poly_bottom - poly_top)
	center_x = poly_left + mask_w * 0.5
	center_y = poly_top + mask_h * 0.5

	hulls: list[list[tuple[float, float]]] = []
	for hull_idx in range(6):
		points: list[tuple[float, float]] = []
		point_count = 12 + hull_idx * 2
		base_rx = mask_w * (0.58 + hull_idx * 0.12)
		base_ry = mask_h * (0.55 + hull_idx * 0.11)
		jitter_x = mask_w * (0.18 + hull_idx * 0.02)
		jitter_y = mask_h * (0.22 + hull_idx * 0.03)

		for point_idx in range(point_count):
			angle_ratio = point_idx / point_count
			angle = 6.283185307179586 * angle_ratio
			seed = variant_seed + hull_idx * 19.17 + point_idx * 7.13
			radial_scale = 0.72 + _stable_noise(seed) * 0.72
			x_bias = (_stable_noise(seed + 0.9) - 0.5) * jitter_x
			y_bias = (_stable_noise(seed + 1.7) - 0.5) * jitter_y
			x = center_x + cos(angle) * base_rx * radial_scale + x_bias
			y = center_y + sin(angle) * base_ry * radial_scale + y_bias
			points.append((max(0.0, min(float(canvas_width), x)), max(0.0, min(float(canvas_height), y))))

		anchor_points = [
			(poly_left - mask_w * (0.08 + hull_idx * 0.02), poly_top + mask_h * 0.08),
			(poly_left + mask_w * 0.16, poly_top - mask_h * (0.12 + hull_idx * 0.03)),
			(poly_right - mask_w * 0.12, poly_top - mask_h * (0.10 + hull_idx * 0.02)),
			(poly_right + mask_w * (0.06 + hull_idx * 0.03), center_y - mask_h * 0.18),
			(poly_right + mask_w * (0.10 + hull_idx * 0.03), poly_bottom - mask_h * 0.08),
			(poly_left + mask_w * 0.62, poly_bottom + mask_h * (0.12 + hull_idx * 0.03)),
			(poly_left + mask_w * 0.10, poly_bottom + mask_h * (0.09 + hull_idx * 0.03)),
			(poly_left - mask_w * (0.12 + hull_idx * 0.03), center_y + mask_h * 0.16),
		]
		for point in anchor_points:
			points.append(
				(
					max(0.0, min(float(canvas_width), point[0])),
					max(0.0, min(float(canvas_height), point[1])),
				)
			)

		hull = _convex_hull(points)
		if len(hull) >= 3:
			hulls.append(hull)

	return hulls


def _composite_primary_cover_image(png_path: Path):
	"""Overlay a circular top-left image onto the rendered primary cover PNG."""
	image_path = Path(__file__).with_name(PRIMARY_COVER_IMAGE_NAME)
	if not image_path.is_file() or not png_path.is_file():
		return

	try:
		from PIL import Image, ImageDraw, ImageOps  # type: ignore[import-not-found]
	except ImportError:
		print("[warn] Pillow is unavailable; skipping primary cover image overlay.")
		return

	with Image.open(png_path).convert("RGBA") as cover_image:
		with Image.open(image_path).convert("RGBA") as overlay_image:
			cover_size = cover_image.size
			diameter = min(PRIMARY_COVER_IMAGE_DIAMETER_PX, cover_size[0] // 4, cover_size[1] // 4)
			diameter = max(128, diameter)
			overlay_square = ImageOps.fit(
				overlay_image,
				(diameter, diameter),
				method=getattr(Image, "Resampling", Image).LANCZOS,
				centering=(0.5, 0.5),
			)

			mask = Image.new("L", (diameter, diameter), 0)
			ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)

			paste_position = (PRIMARY_COVER_IMAGE_MARGIN_PX, PRIMARY_COVER_IMAGE_MARGIN_PX)
			cover_image.paste(overlay_square, paste_position, mask)
			cover_image.save(png_path)


def _append_cover_panel(
	svg_root: ET.Element,
	canvas_width: int,
	canvas_height: int,
	panel_x: float,
	panel_width: float,
	title: str,
	subtitle: str,
	time_range: str,
	description: str,
	cover_variant: str = "primary",
):
	"""Render a poster-style metadata block for cover output."""
	del panel_x, panel_width

	if cover_variant == "map_only":
		return

	show_primary = cover_variant == "primary"
	show_desc = cover_variant == "secondary"
	center_overlay = show_primary or show_desc
	center_desc = show_desc and not show_primary

	panel = ET.SubElement(svg_root, "g", id="cover_panel")
	if center_overlay:
		text_margin_x = canvas_width * 0.22
		text_right = canvas_width * 0.78
		text_anchor = "middle"
		text_x = canvas_width * 0.5
	else:
		text_margin_x = canvas_width * 0.08
		text_right = canvas_width * 0.92
		text_anchor = "start"
		text_x = text_margin_x
	text_max_width = max(100.0, text_right - text_margin_x)

	title_text = ((title or "City Walk").strip() or "City Walk") if show_primary else ""
	subtitle_text = (subtitle or "").strip() if show_primary else ""
	time_text = (time_range or "").strip() if show_primary else ""
	desc_text = (description or "").strip() if show_desc else ""
	time_label_text = time_text
	distance_label_text = ""
	if show_primary and "·" in time_text:
		time_label_text, distance_label_text = [part.strip() for part in time_text.split("·", 1)]

	title_font = 400
	subtitle_font = 240
	meta_font = 190
	desc_font = 216

	top_anchor = canvas_height * 0.52 if not center_overlay else canvas_height * 0.18
	bottom_padding = canvas_height * 0.07 if not center_overlay else canvas_height * 0.18
	available_text_height = max(1.0, canvas_height - top_anchor - bottom_padding)

	scale = 1.0
	title_lines = [title_text]
	subtitle_lines = []
	desc_lines = []
	current_title_font = title_font
	current_subtitle_font = subtitle_font
	current_meta_font = meta_font
	current_desc_font = desc_font
	while True:
		current_title_font = max(24, int(round(title_font * scale)))
		current_subtitle_font = max(20, int(round(subtitle_font * scale)))
		current_meta_font = max(20, int(round(meta_font * scale)))
		current_desc_font = max(16, int(round(desc_font * scale)))

		if show_primary:
			title_max_chars = max(6, int(text_max_width / (current_title_font * 0.58)))
			title_lines = _wrap_cover_text(title_text, title_max_chars)
			if not title_lines:
				title_lines = ["City Walk"]
		else:
			title_lines = []

		if show_primary and subtitle_text:
			subtitle_max_chars = max(8, int(text_max_width / (current_subtitle_font * 0.56)))
			subtitle_lines = _wrap_cover_text(subtitle_text, subtitle_max_chars)
		else:
			subtitle_lines = []

		if show_desc and desc_text:
			desc_max_chars = max(10, int(text_max_width / (current_desc_font * 0.56)))
			desc_lines = _wrap_cover_text(desc_text, desc_max_chars)
		else:
			desc_lines = []

		title_block_height = len(title_lines) * current_title_font * 1.08 + current_title_font * 0.10 if title_lines else 0.0
		subtitle_gap_height = current_meta_font * 0.62 if subtitle_lines else 0.0
		subtitle_block_height = len(subtitle_lines) * current_subtitle_font * 1.18
		time_block_height = (current_meta_font * 1.08 if time_label_text else 0.0) + (current_meta_font * 0.82 if distance_label_text else 0.0)
		desc_gap_height = current_meta_font * 1.5 if desc_lines and show_primary else 0.0
		desc_block_height = len(desc_lines) * current_desc_font * 1.28
		total_height = (
			title_block_height
			+ subtitle_gap_height
			+ subtitle_block_height
			+ time_block_height
			+ desc_gap_height
			+ desc_block_height
		)

		if total_height <= available_text_height or scale <= 0.35:
			break
		scale *= 0.92

	title_block_height = len(title_lines) * current_title_font * 1.12 + current_title_font * 0.13 if title_lines else 0.0
	subtitle_gap_height = current_meta_font * 0.70 if subtitle_lines else 0.0
	subtitle_block_height = len(subtitle_lines) * current_subtitle_font * 1.24
	time_block_height = (current_meta_font * 1.12 if time_label_text else 0.0) + (current_meta_font * 0.84 if distance_label_text else 0.0)
	desc_gap_height = current_meta_font * 1.7 if desc_lines and show_primary else 0.0
	desc_block_height = len(desc_lines) * current_desc_font * 1.35
	total_height = (
		title_block_height
		+ subtitle_gap_height
		+ subtitle_block_height
		+ time_block_height
		+ desc_gap_height
		+ desc_block_height
	)

	panel_pad_x = canvas_width * 0.045
	panel_pad_top = current_title_font * 0.40
	panel_pad_bottom = current_desc_font * 0.75
	if center_overlay:
		panel_width_px = min(canvas_width * 0.68, text_max_width + panel_pad_x * 2.4)
		panel_height_px = min(canvas_height * 0.58, total_height + panel_pad_top + panel_pad_bottom)
		panel_left = max(0.0, (canvas_width - panel_width_px) * 0.5)
		panel_top = max(0.0, (canvas_height - panel_height_px) * 0.5)
	else:
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
	mask_cx = panel_left + panel_width_px * (0.50 if center_overlay else 0.30)
	mask_cy = panel_top + panel_height_px * 0.52
	mask_rx = max(panel_width_px * (0.94 if center_overlay else 0.86), 1.0)
	mask_ry = max(panel_height_px * 0.92, 1.0)
	text_mask_grad.set("cx", "0")
	text_mask_grad.set("cy", "0")
	text_mask_grad.set("r", "1")
	text_mask_grad.set(
		"gradientTransform",
		f"translate({mask_cx:.2f} {mask_cy:.2f}) scale({mask_rx:.2f} {mask_ry:.2f})",
	)
	ET.SubElement(text_mask_grad, "stop", offset="0%", style="stop-color:#000000;stop-opacity:0.58")
	ET.SubElement(text_mask_grad, "stop", offset="46%", style="stop-color:#000000;stop-opacity:0.32")
	ET.SubElement(text_mask_grad, "stop", offset="76%", style="stop-color:#000000;stop-opacity:0.12")
	ET.SubElement(text_mask_grad, "stop", offset="100%", style="stop-color:#000000;stop-opacity:0")

	# Build a rounded, deterministic mask around the full text block with modest padding.
	if center_overlay:
		text_block_top = (canvas_height - total_height) * 0.5
		text_block_bottom = text_block_top + total_height
	else:
		text_block_top = canvas_height - bottom_padding - total_height
		text_block_bottom = canvas_height - bottom_padding
	pad_x = max(20.0, current_title_font * 0.15)
	pad_top = max(18.0, current_title_font * 0.20)
	pad_bottom = max(18.0, current_desc_font * 0.22)

	poly_left = max(0.0, text_margin_x - pad_x)
	poly_right = min(float(canvas_width), text_right + pad_x * 0.55)
	poly_top = max(0.0, text_block_top - pad_top)
	poly_bottom = min(float(canvas_height), text_block_bottom + pad_bottom)
	variant_seed = float(len(title_lines) * 11 + len(subtitle_lines) * 17 + len(desc_lines) * 23 + len(time_text) * 5 + current_title_font)
	mask_hulls = _build_text_mask_hulls(
		poly_left,
		poly_top,
		poly_right,
		poly_bottom,
		canvas_width,
		canvas_height,
		variant_seed,
	)
	for hull_idx, hull_points in enumerate(mask_hulls):
		points_str = " ".join(f"{px:.2f},{py:.2f}" for px, py in hull_points)
		text_safe_mask = ET.SubElement(panel, "polygon")
		text_safe_mask.set("points", points_str)
		text_safe_mask.set("fill", f"url(#{text_mask_grad_id})")
		text_safe_mask.set("opacity", f"{max(0.18, 0.54 - hull_idx * 0.06):.2f}")

	if center_desc:
		cursor_y = panel_top + (panel_height_px - desc_block_height) * 0.5 + current_desc_font * 0.92
	else:
		cursor_y = text_block_top
	if title_lines:
		cursor_y += current_title_font

	for line in title_lines:
		title_elem = ET.SubElement(panel, "text")
		title_elem.set("x", f"{text_x:.2f}")
		title_elem.set("y", f"{cursor_y:.2f}")
		title_elem.set("fill", "#FFFDF8")
		title_elem.set("font-size", str(current_title_font))
		title_elem.set("font-weight", "700")
		title_elem.set("font-family", '"Gill Sans", "Avenir Next Condensed", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		title_elem.set("text-anchor", text_anchor)
		title_elem.set("stroke", "none")
		title_elem.set("stroke-opacity", "0.42")
		title_elem.set("stroke-width", "2.6")
		title_elem.set("paint-order", "stroke fill")
		title_elem.text = line
		cursor_y += current_title_font * 1.08

	if title_lines:
		cursor_y += current_title_font * 0.10

	if subtitle_lines:
		cursor_y += current_meta_font * 0.62
		for line in subtitle_lines:
			subtitle_elem = ET.SubElement(panel, "text")
			subtitle_elem.set("x", f"{text_x:.2f}")
			subtitle_elem.set("y", f"{cursor_y:.2f}")
			subtitle_elem.set("fill", "#FFF9EF")
			subtitle_elem.set("font-size", str(current_subtitle_font))
			subtitle_elem.set("font-family", '"Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif')
			subtitle_elem.set("font-weight", "600")
			subtitle_elem.set("text-anchor", text_anchor)
			subtitle_elem.set("stroke", "none")
			subtitle_elem.set("stroke-opacity", "0.36")
			subtitle_elem.set("stroke-width", "2.0")
			subtitle_elem.set("paint-order", "stroke fill")
			subtitle_elem.text = line
			cursor_y += current_subtitle_font * 1.18

	if time_label_text:
		time_elem = ET.SubElement(panel, "text")
		time_elem.set("x", f"{text_x:.2f}")
		time_elem.set("y", f"{cursor_y:.2f}")
		time_elem.set("fill", "#FFF9F2")
		time_elem.set("font-size", str(current_meta_font))
		time_elem.set("font-family", '"SF Pro Text", "Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		time_elem.set("font-weight", "600")
		time_elem.set("text-anchor", text_anchor)
		time_elem.set("stroke", "none")
		time_elem.set("stroke-opacity", "0.38")
		time_elem.set("stroke-width", "2.1")
		time_elem.set("paint-order", "stroke fill")
		time_elem.text = time_label_text
		cursor_y += current_meta_font * 1.08

	if distance_label_text:
		distance_elem = ET.SubElement(panel, "text")
		distance_elem.set("x", f"{text_x:.2f}")
		distance_elem.set("y", f"{cursor_y:.2f}")
		distance_elem.set("fill", "#FFF3DB")
		distance_elem.set("font-size", str(max(16, int(current_meta_font * 0.82))))
		distance_elem.set("font-family", '"SF Pro Text", "Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		distance_elem.set("font-weight", "500")
		distance_elem.set("text-anchor", text_anchor)
		distance_elem.set("stroke", "none")
		distance_elem.set("stroke-opacity", "0.32")
		distance_elem.set("stroke-width", "1.8")
		distance_elem.set("paint-order", "stroke fill")
		distance_elem.text = distance_label_text

	if not desc_lines:
		return

		if show_primary:
			cursor_y += current_meta_font * 1.5

	for line in desc_lines:
		line_elem = ET.SubElement(panel, "text")
		line_elem.set("x", f"{text_x:.2f}")
		line_elem.set("y", f"{cursor_y:.2f}")
		line_elem.set("fill", "#FFF2E1")
		line_elem.set("font-size", str(current_desc_font))
		line_elem.set("font-family", '"Gill Sans", "Avenir Next", "PingFang SC", "Noto Sans CJK SC", sans-serif')
		line_elem.set("font-weight", "500")
		line_elem.set("text-anchor", text_anchor)
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
	cover_subtitle: str,
	cover_desc: str,
	cover_time_range: str,
	cover_variant: str = "primary",
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

	# _append_cover_panel(
	# 	svg,
	# 	canvas_width,
	# 	canvas_height,
	# 	0.0,
	# 	canvas_width,
	# 	cover_title,
	# 	cover_subtitle,
	# 	cover_time_range,
	# 	cover_desc,
	# )

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

	ordered_records = _sorted_route_records(records)
	start_rec = ordered_records[0]
	end_rec = ordered_records[-1]

	for rec in records:
		if rec is start_rec or rec is end_rec:
			continue

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

	_append_start_end_badges(
		svg,
		start_rec,
		end_rec,
		min_lon,
		min_lat,
		max_lon,
		max_lat,
	)

	_append_cover_panel(
		svg,
		canvas_width,
		canvas_height,
		0.0,
		canvas_width,
		cover_title,
		cover_subtitle,
		cover_time_range,
		cover_desc,
		cover_variant=cover_variant,
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

	output_dir = Path.cwd() / "__tmp" / Path(args.photos_dir).name
	meta_path = output_dir / "_meta.md"
	meta = _load_cover_meta(meta_path)
	saved_title = (meta.get("title") or "").strip()
	saved_desc = (meta.get("desc") or "").strip()

	print()
	print(f"Last title: {saved_title or '(none)'}")
	print(f"Last desc : {saved_desc or '(none)'}")
	print()

	cover_title = input("Cover title (leave blank to keep last): ").strip()
	cover_desc = input("Cover description (leave blank to keep last): ").strip()

	if not cover_title:
		cover_title = saved_title
	if not cover_desc:
		cover_desc = saved_desc
	print()

	print(f"Scanning photos in: {args.photos_dir}")
	records = mini.scan_photos(args.photos_dir)
	if not records:
		print("ERROR: No geotagged photos found.", file=sys.stderr)
		sys.exit(1)
	print(f"Found {len(records)} geotagged photo(s).")

	cover_subtitle, meta = _resolve_cover_subtitle(records, meta)
	if cover_subtitle:
		print(f"Auto subtitle: {cover_subtitle}")

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

	cover_outputs = [
		("primary", f"{Path(args.photos_dir).name}_map_cover.png"),
		("secondary", f"{Path(args.photos_dir).name}_map_cover_secondary.png"),
		("map_only", f"{Path(args.photos_dir).name}_map_cover_maponly.png"),
	]

	for cover_variant, output_name in cover_outputs:
		svg_root = build_svg_cover(
			records,
			bbox,
			osm_geojson_name,
			args.landmark_distance,
			cover_title,
			cover_subtitle,
			cover_desc,
			cover_time_range,
			cover_variant=cover_variant,
		)

		svg_content = ET.tostring(svg_root, encoding="unicode", xml_declaration=False)
		cover_png = output_dir / output_name
		mini.export_png(svg_content, str(cover_png), width=mini.COVER_SVG_WIDTH, height=mini.COVER_SVG_HEIGHT)
		print(f"Cover saved -> {cover_png}")

	meta["title"] = cover_title
	meta["desc"] = cover_desc
	_save_cover_meta(meta_path, meta)
	print(f"Meta saved -> {meta_path}")

	print(
		f"Generated 3 cover files in {output_dir}  ({mini.COVER_SVG_WIDTH}x{mini.COVER_SVG_HEIGHT}px)"
	)


if __name__ == "__main__":
    main()
