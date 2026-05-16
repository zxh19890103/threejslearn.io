## Goals

- Given a dir within there're photos taken by Pixel9
- Extract the EXIFs: Geolocation, OriginalTime
- Generate a SVG to mark the location with orange circles. Need to determine the bbox carefully to covering all the locations completely. bbox can be used as the viewBox for the svg.
- render all the locations in the svg.
- from the svg content, generate a png file with 256x256 size.
- Given a osm geojson file `./photos_viz.geojson` (will downloaded by the users manully), render all the Polygons and LineString (maybe i will provide a filter later to make the map simple.)

## Tech Stacks

- Python
- OpenCV-python
- (Others.)

## Do not need to consider init the python run environments.

## implement in the file `photos_viz.py`
