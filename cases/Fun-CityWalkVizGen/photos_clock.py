"""
Generate per-photo 24-hour clock visualizations from photo EXIF data.

Rules implemented:
- Read EXIF DateTimeOriginal only.
- Ignore photos with missing or invalid DateTimeOriginal metadata.
- Use continuous placement based on hour+minute+second.
- Render with SVG and export to PNG at 600x600.
- Write one PNG per valid photo to:
	{cwd}/__tmp/{original_photo_dir_name}/{original_photo_name}_clock.png
"""

import argparse
import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

try:
	import cairosvg  # type: ignore[reportMissingImports]
except Exception:  # pragma: no cover
	cairosvg = None

try:
	from PIL import Image  # type: ignore[reportMissingImports]
except Exception:  # pragma: no cover
	Image = None


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".tif", ".tiff", ".heic", ".heif"}

EXIF_IFD_TAG = 0x8769
TAG_DATETIME_ORIGINAL = 0x9003

SVG_SIZE = 600
PNG_SIZE = 600
CENTER = SVG_SIZE / 2

FACE_RADIUS = 286
TICK_INNER_RADIUS = 252
TICK_OUTER_RADIUS = 282
LABEL_RADIUS = 222
POINT_BASE_RADIUS = 240

HOUR_LABEL_FONT_SIZE = 26
HOUR_LABEL_WEIGHT = 800
TICK_STROKE_WIDTH = 3.4
NORMAL_POINT_RADIUS = 8.8
HIGHLIGHT_HALO_RADIUS = 19
HIGHLIGHT_POINT_RADIUS = 11
HIGHLIGHT_POINT_STROKE_WIDTH = 2.8
CENTER_DOT_RADIUS = 7

TITLE_FONT_SIZE = 23
TITLE_FONT_WEIGHT = 800
DATE_FONT_SIZE = 15

HORIZON_Y = CENTER
DAY_START_HOUR = 6.0
DAY_END_HOUR = 18.0
SUN_PATH_RADIUS = 168.0
MOON_PATH_RADIUS = 168.0
SUN_RADIUS = 18
MOON_RADIUS = 15

DAY_SKY_TOP = "#eef6ff"
DAY_SKY_BOTTOM = "#fff7e8"
NIGHT_SKY_TOP = "#10192d"
NIGHT_SKY_BOTTOM = "#1b2a44"


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="Generate per-photo 24h clock PNGs from EXIF DateTimeOriginal."
	)
	parser.add_argument("photos_dir", help="Directory containing photos")
	return parser.parse_args()


def _parse_datetime_original(img: Any) -> datetime | None:
	"""Read EXIF DateTimeOriginal and convert it to datetime."""
	try:
		exif = img.getexif()
		if exif is None:
			return None

		exif_ifd = exif.get_ifd(EXIF_IFD_TAG)
		if not exif_ifd:
			return None

		raw_value = exif_ifd.get(TAG_DATETIME_ORIGINAL)
		if not raw_value or not isinstance(raw_value, str):
			return None

		return datetime.strptime(raw_value, "%Y:%m:%d %H:%M:%S")
	except Exception:
		return None


def scan_photo_timestamps(folder: Path) -> tuple[list[dict], int]:
	"""
	Scan folder images and collect records with valid DateTimeOriginal.
	Returns (valid_records, skipped_missing_or_invalid_count).
	"""
	valid_records = []
	skipped_count = 0

	if Image is None:
		print("[error] Pillow is required. Install with: pip install pillow", file=sys.stderr)
		return valid_records, skipped_count

	for path in sorted(folder.iterdir()):
		if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
			continue

		try:
			with Image.open(path) as img:
				dt = _parse_datetime_original(img)
		except Exception:
			dt = None

		if dt is None:
			skipped_count += 1
			print(f"[skip-no-datetimeoriginal] {path.name}", file=sys.stderr)
			continue

		valid_records.append(
			{
				"name": path.name,
				"path": path,
				"dt": dt,
			}
		)

	return valid_records, skipped_count


def _time_to_angle_radians(dt: datetime) -> float:
	"""Convert wall-clock time to a continuous angle on a 24-hour clock."""
	fractional_hour = dt.hour + dt.minute / 60.0 + dt.second / 3600.0
	# Place 0 at top and move clockwise.
	return 2.0 * math.pi * (fractional_hour / 24.0) - (math.pi / 2.0)


def _fractional_hour(dt: datetime) -> float:
	return dt.hour + dt.minute / 60.0 + dt.second / 3600.0


def _sun_position(dt: datetime) -> tuple[float, float] | None:
	"""Map daytime timestamps to a sun position across the upper semicircle."""
	current_hour = _fractional_hour(dt)
	if current_hour < DAY_START_HOUR or current_hour >= DAY_END_HOUR:
		return None

	progress = (current_hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)
	angle = math.pi - progress * math.pi
	x = CENTER + SUN_PATH_RADIUS * math.cos(angle)
	y = CENTER - SUN_PATH_RADIUS * math.sin(angle)
	return x, y


def _moon_position(dt: datetime) -> tuple[float, float] | None:
	"""Map nighttime timestamps to a moon position across the lower semicircle."""
	current_hour = _fractional_hour(dt)
	if DAY_START_HOUR <= current_hour < DAY_END_HOUR:
		return None

	if current_hour >= DAY_END_HOUR:
		progress = (current_hour - DAY_END_HOUR) / (24.0 - DAY_END_HOUR + DAY_START_HOUR)
	else:
		progress = (current_hour + (24.0 - DAY_END_HOUR)) / (24.0 - DAY_END_HOUR + DAY_START_HOUR)

	angle = progress * math.pi
	x = CENTER + MOON_PATH_RADIUS * math.cos(angle)
	y = CENTER + MOON_PATH_RADIUS * math.sin(angle)
	return x, y


def _format_label(dt: datetime, title: str) -> tuple[str, str]:
	return title, dt.strftime("%Y-%m-%d %H:%M")


def _cluster_points(records: list[dict]) -> list[dict]:
	"""
	Compute base clock positions and light radial staggering for overlapping points.
	Staggering is grouped by second-of-day to keep deterministic output.
	"""
	groups: dict[int, list[int]] = defaultdict(list)
	for idx, rec in enumerate(records):
		dt = rec["dt"]
		second_of_day = dt.hour * 3600 + dt.minute * 60 + dt.second
		groups[second_of_day].append(idx)

	out = []
	base_radius = POINT_BASE_RADIUS
	ring_step = 10.0
	max_rings = 5

	for second_of_day, indices in groups.items():
		dt = records[indices[0]]["dt"]
		angle = _time_to_angle_radians(dt)

		for order, rec_idx in enumerate(indices):
			ring = min(order, max_rings)
			r = base_radius + ring * ring_step
			x = CENTER + r * math.cos(angle)
			y = CENTER + r * math.sin(angle)
			out.append(
				{
					"record_index": rec_idx,
					"x": x,
					"y": y,
					"angle": angle,
				}
			)

	return out


def _build_svg(records: list[dict], highlighted_index: int) -> str:
	"""Build an SVG clock showing all points and one highlighted photo."""
	highlight_record = records[highlighted_index]
	highlight_dt = highlight_record["dt"]
	title_text, date_text = _format_label(highlight_dt, highlight_record["path"].stem)
	sun_position = _sun_position(highlight_dt)
	moon_position = _moon_position(highlight_dt)
	is_daytime = sun_position is not None
	sky_top = DAY_SKY_TOP if is_daytime else NIGHT_SKY_TOP
	sky_bottom = DAY_SKY_BOTTOM if is_daytime else NIGHT_SKY_BOTTOM
	star_opacity = "0.42" if not is_daytime else "0"

	lines = [
		f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_SIZE}" height="{SVG_SIZE}" viewBox="0 0 {SVG_SIZE} {SVG_SIZE}">',
		"<defs>",
		f'<clipPath id="clockClip">',
		f'<circle cx="{CENTER}" cy="{CENTER}" r="{FACE_RADIUS}"/>',
		"</clipPath>",
		f'<linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">',
		f'<stop offset="0%" stop-color="{sky_top}"/>',
		f'<stop offset="100%" stop-color="{sky_bottom}"/>',
		"</linearGradient>",
		f'<radialGradient id="sunGlow" cx="50%" cy="40%" r="55%">',
		f'<stop offset="0%" stop-color="#fff8c7" stop-opacity="0.95"/>',
		f'<stop offset="55%" stop-color="#ffd86a" stop-opacity="0.18"/>',
		f'<stop offset="100%" stop-color="#ffd86a" stop-opacity="0"/>',
		"</radialGradient>",
		f'<radialGradient id="moonGlow" cx="50%" cy="60%" r="55%">',
		f'<stop offset="0%" stop-color="#edf3ff" stop-opacity="0.85"/>',
		f'<stop offset="60%" stop-color="#a4b7d8" stop-opacity="0.18"/>',
		f'<stop offset="100%" stop-color="#a4b7d8" stop-opacity="0"/>',
		"</radialGradient>",
		"</defs>",
		f'<g clip-path="url(#clockClip)">',
		'<rect x="0" y="0" width="100%" height="100%" fill="url(#skyGradient)"/>',
		f'<circle cx="{CENTER}" cy="{CENTER}" r="{FACE_RADIUS}" fill="#ffffff" stroke="#c9d0db" stroke-width="5.4"/>',
		f'<line x1="{CENTER - 240}" y1="{HORIZON_Y}" x2="{CENTER + 240}" y2="{HORIZON_Y}" stroke="#d7dee8" stroke-width="3.2" stroke-linecap="round"/>',
	]

	if not is_daytime:
		for star_x, star_y, star_r, star_fill in (
			(126, 108, 2.0, "#ffffff"),
			(192, 66, 1.6, "#cfe3ff"),
			(432, 92, 2.2, "#ffffff"),
			(470, 168, 1.4, "#dbe8ff"),
			(312, 58, 1.8, "#ffffff"),
		):
			lines.append(
				f'<circle cx="{star_x}" cy="{star_y}" r="{star_r}" fill="{star_fill}" opacity="{star_opacity}"/>'
			)

	if sun_position is not None:
		lines.append(
			f'<circle cx="{sun_position[0]:.2f}" cy="{sun_position[1]:.2f}" r="58" fill="url(#sunGlow)" opacity="0.95"/>'
		)
		lines.append(
			f'<circle cx="{sun_position[0]:.2f}" cy="{sun_position[1]:.2f}" r="{SUN_RADIUS}" fill="#fbbf24" stroke="#f59e0b" stroke-width="3.2"/>'
		)
		lines.append(
			f'<circle cx="{sun_position[0] + 6:.2f}" cy="{sun_position[1] - 6:.2f}" r="4.2" fill="#fff2b2" opacity="0.88"/>'
		)

	if moon_position is not None:
		lines.append(
			f'<circle cx="{moon_position[0]:.2f}" cy="{moon_position[1]:.2f}" r="58" fill="url(#moonGlow)" opacity="0.95"/>'
		)
		lines.append(
			f'<circle cx="{moon_position[0]:.2f}" cy="{moon_position[1]:.2f}" r="{MOON_RADIUS}" fill="#dbe4f0" stroke="#94a3b8" stroke-width="3.2"/>'
		)
		lines.append(
			f'<circle cx="{moon_position[0] - 5:.2f}" cy="{moon_position[1] - 3:.2f}" r="3.3" fill="#94a3b8" opacity="0.32"/>'
		)

	lines.append(
		f'<text x="{CENTER}" y="84" font-size="{TITLE_FONT_SIZE}" font-weight="{TITLE_FONT_WEIGHT}" text-anchor="middle" dominant-baseline="middle" fill="#1f2937">{title_text}</text>'
	)
	lines.append(
		f'<text x="{CENTER}" y="110" font-size="{DATE_FONT_SIZE}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="#4b5563">{date_text}</text>'
	)

	# Hour ticks and labels 0..23, shown every 3 hours
	for hour in range(24):
		if hour % 3 != 0:
			continue
		angle = 2.0 * math.pi * (hour / 24.0) - (math.pi / 2.0)
		inner_radius = TICK_INNER_RADIUS - 8 if hour % 6 == 0 else TICK_INNER_RADIUS
		tick_width = 4.0 if hour % 6 == 0 else TICK_STROKE_WIDTH
		x1 = CENTER + inner_radius * math.cos(angle)
		y1 = CENTER + inner_radius * math.sin(angle)
		x2 = CENTER + TICK_OUTER_RADIUS * math.cos(angle)
		y2 = CENTER + TICK_OUTER_RADIUS * math.sin(angle)
		lx = CENTER + LABEL_RADIUS * math.cos(angle)
		ly = CENTER + LABEL_RADIUS * math.sin(angle)

		lines.append(
			f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="#939baa" stroke-width="{tick_width}"/>'
		)
		lines.append(
			f'<text x="{lx:.2f}" y="{ly:.2f}" font-size="{HOUR_LABEL_FONT_SIZE}" font-weight="{HOUR_LABEL_WEIGHT}" text-anchor="middle" dominant-baseline="middle" fill="#4b5563">{hour}</text>'
		)

	positioned = _cluster_points(records)

	for p in positioned:
		if p["record_index"] == highlighted_index:
			continue
		lines.append(
			f'<circle cx="{p["x"]:.2f}" cy="{p["y"]:.2f}" r="{NORMAL_POINT_RADIUS}" fill="#8e99ab" opacity="0.92"/>'
		)

	highlight = next((p for p in positioned if p["record_index"] == highlighted_index), None)
	if highlight is not None:
		lines.append(
			f'<circle cx="{highlight["x"]:.2f}" cy="{highlight["y"]:.2f}" r="{HIGHLIGHT_HALO_RADIUS}" fill="#ef4444" opacity="0.24"/>'
		)
		lines.append(
			f'<circle cx="{highlight["x"]:.2f}" cy="{highlight["y"]:.2f}" r="{HIGHLIGHT_POINT_RADIUS}" fill="#dc2626" stroke="#ffffff" stroke-width="{HIGHLIGHT_POINT_STROKE_WIDTH}"/>'
		)

	lines.append(
		f'<circle cx="{CENTER}" cy="{CENTER}" r="{CENTER_DOT_RADIUS}" fill="#6b7280"/>'
	)
	lines.append("</g>")
	lines.append("</svg>")

	return "\n".join(lines)


def render_per_photo_clocks(photos_dir: Path, records: list[dict]) -> list[Path]:
	"""Render one PNG clock per photo in the folder-level output directory."""
	out_dir = Path.cwd() / "__tmp" / photos_dir.name
	out_dir.mkdir(parents=True, exist_ok=True)

	if cairosvg is None:
		print("[error] cairosvg is required. Install with: pip install cairosvg", file=sys.stderr)
		return []

	generated = []
	for idx, rec in enumerate(records):
		svg_text = _build_svg(records, highlighted_index=idx)
		output_path = out_dir / f"{rec['path'].stem}_clock.png"

		cairosvg.svg2png(
			bytestring=svg_text.encode("utf-8"),
			write_to=str(output_path),
			output_width=PNG_SIZE,
			output_height=PNG_SIZE,
		)
		generated.append(output_path)

	return generated


def main() -> int:
	args = parse_args()
	photos_dir = Path(args.photos_dir).expanduser().resolve()

	if not photos_dir.exists() or not photos_dir.is_dir():
		print(f"[error] not a valid directory: {photos_dir}", file=sys.stderr)
		return 1

	records, skipped_missing = scan_photo_timestamps(photos_dir)
	if Image is None:
		return 1

	if not records:
		print("[info] no valid photos with EXIF DateTimeOriginal found")
		print(f"[summary] scanned=0 valid=0 skipped_missing_or_invalid={skipped_missing}")
		return 0

	generated = render_per_photo_clocks(photos_dir, records)
	if not generated:
		return 1

	print(
		"[summary] "
		f"scanned={len(records) + skipped_missing} "
		f"valid={len(records)} "
		f"skipped_missing_or_invalid={skipped_missing}"
	)
	print(f"[summary] output_dir={generated[0].parent}")
	print(f"[summary] generated_files={len(generated)}")

	return 0


if __name__ == "__main__":
	raise SystemExit(main())
