import json
import pandas as pd
# import pandas as pd

# # Convert CSV to Parquet
# df = pd.read_csv('/Users/xhzhang1911/Downloads/36d_buildings.csv')
# df.to_parquet('36d_buildings.parquet', engine='pyarrow', compression='snappy')

# 22.49768726,103.96668906
bbox = [102.639515788, 21.959090156, 104.836238863, 25.085964203]

# Normalize bbox to [min_lon, min_lat, max_lon, max_lat]
min_lon = min(bbox[0], bbox[2])
max_lon = max(bbox[0], bbox[2])
min_lat = min(bbox[1], bbox[3])
max_lat = max(bbox[1], bbox[3])

# Keep output properties aligned with goofp-samples.csv
columns = [
    'latitude',
    'longitude',
    'area_in_meters',
    'confidence',
    'geometry',
    'full_plus_code',
]

df = pd.read_parquet('36d_buildings.parquet', columns=columns)

# Filter records where (longitude, latitude) is inside bbox
mask = (
    df['longitude'].between(min_lon, max_lon)
    & df['latitude'].between(min_lat, max_lat)
)
df_in_bbox = df.loc[mask].copy()


def to_native(value):
    if pd.isna(value):
        return None
    if hasattr(value, 'item'):
        return value.item()
    return value


# Convert to GeoJSON FeatureCollection
features = []
for _, row in df_in_bbox.iterrows():
    properties = {
        'area_in_meters': to_native(row['area_in_meters']),
        'confidence': to_native(row['confidence']),
        'geometry': to_native(row['geometry']),
        'full_plus_code': to_native(row['full_plus_code']),
        'latitude': float(row['latitude']),
        'longitude': float(row['longitude']),
    }
    features.append(
        {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [float(row['longitude']), float(row['latitude'])],
            },
            'properties': properties,
        }
    )

geojson = {
    'type': 'FeatureCollection',
    'features': features,
}

with open('36d_buildings_bbox.geojson', 'w', encoding='utf-8') as f:
    json.dump(geojson, f, ensure_ascii=False, indent=2)
