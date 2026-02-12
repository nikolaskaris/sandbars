#!/usr/bin/env python3
"""Generate a strict binary water mask from Natural Earth 10m data.

Output: scripts/water_mask_1440x1440.png
  - 0 (black) = land
  - 255 (white) = water
  - No anti-aliased gray pixels
"""

import json
import math

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import shape, Polygon, MultiPolygon

WIDTH = 1440
HEIGHT = 1440
MAX_LATITUDE = 85.051129


def lat_to_mercator_y(lat):
    lat_rad = math.radians(max(min(lat, MAX_LATITUDE), -MAX_LATITUDE))
    y_merc = math.log(math.tan(math.pi / 4 + lat_rad / 2))
    y_max = math.log(math.tan(math.pi / 4 + math.radians(MAX_LATITUDE) / 2))
    y_normalized = (y_max - y_merc) / (2 * y_max)
    return y_normalized * (HEIGHT - 1)


def lon_to_x(lon):
    return ((lon + 180) / 360) * (WIDTH - 1)


def draw_geometry(draw, geom, fill_color):
    if isinstance(geom, Polygon):
        polygons = [geom]
    elif isinstance(geom, MultiPolygon):
        polygons = list(geom.geoms)
    else:
        return
    for poly in polygons:
        coords = [(lon_to_x(x), lat_to_mercator_y(y)) for x, y in poly.exterior.coords]
        if len(coords) >= 3:
            draw.polygon(coords, fill=fill_color, outline=fill_color)


print(f"Creating {WIDTH}x{HEIGHT} strict binary water mask...")

# Use mode '1' for strict binary (no anti-aliasing)
img = Image.new('1', (WIDTH, HEIGHT), 1)  # 1 = white = water
draw = ImageDraw.Draw(img)

print("Loading and drawing land...")
with open('scripts/ne_10m_land.geojson', 'r') as f:
    land = json.load(f)
for feature in land['features']:
    draw_geometry(draw, shape(feature['geometry']), 0)  # 0 = black = land

print("Loading and drawing lakes...")
with open('scripts/ne_10m_lakes.geojson', 'r') as f:
    lakes = json.load(f)
for feature in lakes['features']:
    draw_geometry(draw, shape(feature['geometry']), 1)  # 1 = white = water

# Convert to 8-bit for compatibility (strictly 0 or 255)
img_8bit = img.convert('L')
output_path = 'scripts/water_mask_1440x1440.png'
img_8bit.save(output_path, 'PNG')

# Verify strictly binary
arr = np.array(img_8bit)
unique_vals = np.unique(arr)
print(f"Saved {output_path}")
print(f"Unique pixel values: {unique_vals} (should be [0, 255] only)")
print(f"Water pixels: {(arr == 255).sum()} ({100*(arr == 255).sum()/(WIDTH*HEIGHT):.1f}%)")
print(f"Land pixels: {(arr == 0).sum()} ({100*(arr == 0).sum()/(WIDTH*HEIGHT):.1f}%)")
