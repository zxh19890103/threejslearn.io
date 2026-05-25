import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import cairosvg
import osm2geojson

from photos_viz_config import PNG_SIZE


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
	E.g., /path/to/photos -> __tmp/photos_photos.geojson
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


def export_png(svg_content: str, png_path: str, width: int = PNG_SIZE, height: int = PNG_SIZE):
	"""Rasterize SVG to a widthxheight PNG using CairoSVG with transparency."""
	cairosvg.svg2png(
		bytestring=svg_content.encode("utf-8"),
		write_to=png_path,
		output_width=width,
		output_height=height,
		background_color="rgba(0,0,0,0)",
	)
