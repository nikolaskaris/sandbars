#!/usr/bin/env python3
"""
Generate water mask PNGs from Natural Earth 10m land + lakes GeoJSON.

Rasterizes land polygons onto the same Web Mercator grid used by the
raster pipeline (1440x1440, ±85.051129° lat, -180 to 180 lon).

A 1-pixel erosion of the land polygon is applied so data extends slightly
under the map's vector coastline, preventing 1px water gaps at the shore.

Input:  scripts/ne_10m_land.geojson, scripts/ne_10m_lakes.geojson
Output: scripts/water_mask_1440x1440.png
        scripts/water_mask_720x720.png
"""

import json
import math
import os

import numpy as np
from pathlib import Path
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion

# Must match convert-grib-to-geojson.py exactly
PNG_WIDTH = 1440
PNG_HEIGHT = 1440
MAX_LATITUDE = 85.051129


def lat_to_mercator_y(lat_deg):
    """Convert latitude in degrees to normalised Mercator Y (0 = top/north, 1 = bottom/south)."""
    y_max = math.log(math.tan(math.pi / 4 + math.radians(MAX_LATITUDE) / 2))
    y_merc = math.log(math.tan(math.pi / 4 + math.radians(lat_deg) / 2))
    return (y_max - y_merc) / (2 * y_max)


def lon_to_pixel_x(lon_deg, width=PNG_WIDTH):
    """Convert longitude (-180 to 180) to pixel X coordinate."""
    return (lon_deg + 180) / 360 * (width - 1)


def lat_to_pixel_y(lat_deg, height=PNG_HEIGHT):
    """Convert latitude to pixel Y coordinate via Web Mercator."""
    y_norm = lat_to_mercator_y(lat_deg)
    return y_norm * (height - 1)


def polygon_to_pixels(coords, width=PNG_WIDTH, height=PNG_HEIGHT):
    """Convert a list of [lon, lat] coordinates to (x, y) pixel tuples."""
    pixels = []
    for lon, lat in coords:
        # Clamp latitude to Mercator limits
        lat = max(-MAX_LATITUDE, min(MAX_LATITUDE, lat))
        x = lon_to_pixel_x(lon, width)
        y = lat_to_pixel_y(lat, height)
        pixels.append((x, y))
    return pixels


def draw_geojson_polygons(draw, geojson_path, fill_value, width, height):
    """Draw all polygons from a GeoJSON file onto an ImageDraw canvas."""
    with open(geojson_path) as f:
        data = json.load(f)

    for feature in data["features"]:
        geom = feature["geometry"]
        geom_type = geom["type"]

        if geom_type == "Polygon":
            rings = geom["coordinates"]
            # Outer ring
            pixels = polygon_to_pixels(rings[0], width, height)
            if len(pixels) >= 3:
                draw.polygon(pixels, fill=fill_value)
            # Inner rings (holes) — draw as the opposite value
            hole_fill = 255 if fill_value == 0 else 0
            for ring in rings[1:]:
                pixels = polygon_to_pixels(ring, width, height)
                if len(pixels) >= 3:
                    draw.polygon(pixels, fill=hole_fill)

        elif geom_type == "MultiPolygon":
            for polygon in geom["coordinates"]:
                # Outer ring
                pixels = polygon_to_pixels(polygon[0], width, height)
                if len(pixels) >= 3:
                    draw.polygon(pixels, fill=fill_value)
                # Inner rings (holes)
                hole_fill = 255 if fill_value == 0 else 0
                for ring in polygon[1:]:
                    pixels = polygon_to_pixels(ring, width, height)
                    if len(pixels) >= 3:
                        draw.polygon(pixels, fill=hole_fill)


def generate_mask(width, height, erode_pixels=1):
    """Generate a water mask at the given resolution.

    Returns a grayscale PIL Image: 255 = water, 0 = land.
    """
    scripts_dir = Path(__file__).parent

    land_path = scripts_dir / "ne_10m_land.geojson"
    lakes_path = scripts_dir / "ne_10m_lakes.geojson"

    if not land_path.exists():
        # Fall back to 110m resolution
        land_path = scripts_dir / "ne_110m_land.geojson"
        lakes_path = scripts_dir / "ne_110m_lakes.geojson"
        print(f"  Using 110m resolution (10m not found)")

    # Start with all water (white = 255)
    img = Image.new('L', (width, height), 255)
    draw = ImageDraw.Draw(img)

    # Draw land polygons as black (0)
    print(f"  Drawing land polygons from {land_path.name}...")
    draw_geojson_polygons(draw, str(land_path), fill_value=0, width=width, height=height)

    # Draw lakes as water (255) — punch holes in land
    if lakes_path.exists():
        print(f"  Drawing lake polygons from {lakes_path.name}...")
        draw_geojson_polygons(draw, str(lakes_path), fill_value=255, width=width, height=height)

    # Erode the land mask by N pixels so data extends slightly under
    # the map's vector coastline (prevents 1px water gap at shore)
    if erode_pixels > 0:
        arr = np.array(img)
        land = arr < 128
        eroded_land = binary_erosion(land, iterations=erode_pixels)
        arr[land & ~eroded_land] = 255  # pixels that were land but got eroded → water
        img = Image.fromarray(arr)
        print(f"  Eroded land mask by {erode_pixels}px")

    return img


def main():
    scripts_dir = Path(__file__).parent

    # Generate 1440x1440 mask
    print("Generating water mask (1440x1440)...")
    mask_1440 = generate_mask(1440, 1440, erode_pixels=1)
    out_1440 = scripts_dir / "water_mask_1440x1440.png"
    mask_1440.save(str(out_1440), 'PNG', optimize=True)
    print(f"  Saved: {out_1440}")

    # Generate 720x720 mask
    print("Generating water mask (720x720)...")
    mask_720 = generate_mask(720, 720, erode_pixels=1)
    out_720 = scripts_dir / "water_mask_720x720.png"
    mask_720.save(str(out_720), 'PNG', optimize=True)
    print(f"  Saved: {out_720}")

    # Stats
    arr = np.array(mask_1440)
    land_px = (arr < 128).sum()
    water_px = (arr >= 128).sum()
    print(f"\n1440x1440 stats: {land_px} land, {water_px} water pixels")
    print("Done.")


if __name__ == "__main__":
    main()
