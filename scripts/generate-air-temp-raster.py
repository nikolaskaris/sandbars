#!/usr/bin/env python3
"""
Generate air temperature PNG raster and grid JSON from GFS 0.25° analysis data.

Downloads the latest GFS 2m temperature field and produces:
  - air-temp-daily.png: 1440x1440 Web Mercator raster
  - air-temp-grid.json: 2° downsampled grid for client-side value lookup

Usage:
  python3 scripts/generate-air-temp-raster.py
  python3 scripts/generate-air-temp-raster.py --output-dir public/data

Requires:
  pip3 install numpy Pillow scipy cfgrib eccodes
"""

import argparse
import json
import math
import os
import sys
import urllib.request
from datetime import datetime, timedelta, UTC

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, uniform_filter

# ---------------------------------------------------------------------------
# Configuration (matches convert-grib-to-geojson.py)
# ---------------------------------------------------------------------------
PNG_WIDTH = 1440
PNG_HEIGHT = 1440
LUT_SIZE = 1024
MAX_LATITUDE = 85.051129
UNIFORM_ALPHA = 210

WATER_MASK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               'water_mask_1440x1440.png')
_water_mask = None

# ---------------------------------------------------------------------------
# Air Temperature Color Ramp: -10°C to 45°C
# Cool blue → teal → green → yellow → orange → red
# ---------------------------------------------------------------------------
AIR_TEMP_COLORS = [
    (0.0,    120, 140, 180, 140),   # -10°C: cool blue-gray
    (0.10,    80, 130, 190, 170),   #  -4°C: steel blue
    (0.25,    50, 150, 165, 195),   #   4°C: teal
    (0.40,    70, 170, 120, 210),   #  12°C: teal-green
    (0.55,   130, 185,  80, 220),   #  20°C: yellow-green
    (0.70,   190, 175,  55, 230),   #  28°C: warm yellow
    (0.85,   210, 130,  50, 236),   #  37°C: orange
    (1.0,    190,  60,  45, 242),   #  45°C: warm red
]
AIR_TEMP_MIN = -10.0
AIR_TEMP_MAX = 45.0

# ---------------------------------------------------------------------------
# Reusable pipeline functions
# ---------------------------------------------------------------------------

def get_water_mask():
    global _water_mask
    if _water_mask is None:
        if os.path.exists(WATER_MASK_PATH):
            _water_mask = np.array(Image.open(WATER_MASK_PATH)).astype(np.float32) / 255.0
        else:
            _water_mask = np.ones((PNG_HEIGHT, PNG_WIDTH), dtype=np.float32)
    return _water_mask

def build_color_lut(color_ramp, lut_size=LUT_SIZE):
    lut = np.zeros((lut_size, 4), dtype=np.uint8)
    for i in range(len(color_ramp) - 1):
        pos0, r0, g0, b0, a0 = color_ramp[i]
        pos1, r1, g1, b1, a1 = color_ramp[i + 1]
        idx0 = int(pos0 * (lut_size - 1))
        idx1 = int(pos1 * (lut_size - 1))
        n = idx1 - idx0
        if n <= 0:
            continue
        t = np.linspace(0, 1, n, endpoint=False).reshape(-1, 1)
        seg = (1 - t) * np.array([r0, g0, b0, a0]) + t * np.array([r1, g1, b1, a1])
        lut[idx0:idx1] = seg.astype(np.uint8)
    lut[-1] = np.array(color_ramp[-1][1:], dtype=np.uint8)
    return lut

def apply_color_lut(grid, lut, min_val, max_val):
    nan_mask = np.isnan(grid)
    normalized = np.clip((grid - min_val) / (max_val - min_val), 0, 1)
    normalized[nan_mask] = 0
    indices = (normalized * (len(lut) - 1)).astype(np.int32)
    rgba = lut[indices]
    rgba[nan_mask] = [0, 0, 0, 0]
    return rgba

def fill_all_gaps(data_grid, iterations=50, fallback_value=15.0):
    filled = data_grid.copy()
    for _ in range(iterations):
        missing = np.isnan(filled)
        if not missing.any():
            break
        valid = ~missing
        neighbor_sum = uniform_filter(np.where(valid, filled, 0), size=3, mode='constant', cval=0)
        neighbor_count = uniform_filter(valid.astype(np.float64), size=3, mode='constant', cval=0)
        with np.errstate(divide='ignore', invalid='ignore'):
            neighbor_avg = np.where(neighbor_count > 0, neighbor_sum / neighbor_count, 0)
        fill_mask = missing & (neighbor_count > 0)
        filled[fill_mask] = neighbor_avg[fill_mask]
    remaining = np.isnan(filled)
    if remaining.any():
        filled[remaining] = fallback_value
    return filled

def reproject_to_mercator(equirect_array, output_height=PNG_HEIGHT, output_width=PNG_WIDTH):
    in_height, in_width = equirect_array.shape
    out_y = np.arange(output_height)
    out_x = np.arange(output_width)
    out_xx, out_yy = np.meshgrid(out_x, out_y)
    y_norm = out_yy / (output_height - 1)
    y_max = math.log(math.tan(math.pi / 4 + math.radians(MAX_LATITUDE) / 2))
    y_merc = y_max - y_norm * (2 * y_max)
    lat = np.degrees(2 * np.arctan(np.exp(y_merc)) - np.pi / 2)
    in_yy = (90 - lat) / 180 * (in_height - 1)
    in_xx = out_xx / (output_width - 1) * (in_width - 1)
    nan_mask = np.isnan(equirect_array)
    safe_array = equirect_array.copy()
    safe_array[nan_mask] = 0
    coords = np.array([in_yy, in_xx])
    output = map_coordinates(safe_array, coords, order=1, mode='constant', cval=0)
    nan_float = nan_mask.astype(np.float32)
    nan_interp = map_coordinates(nan_float, coords, order=1, mode='constant', cval=1)
    output[nan_interp > 0.5] = np.nan
    return output

AIR_TEMP_LUT = build_color_lut(AIR_TEMP_COLORS)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def download_gfs_temp(date_str, cycle, output_path):
    """Download GFS 2m temperature analysis (f000) from NOMADS."""
    url = (
        f"https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?"
        f"dir=%2Fgfs.{date_str}%2F{cycle:02d}%2Fatmos"
        f"&file=gfs.t{cycle:02d}z.pgrb2.0p25.f000"
        f"&var_TMP=on&lev_2_m_above_ground=on"
    )
    print(f"  Downloading: GFS {date_str}/{cycle:02d}z TMP 2m")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as response:
            with open(output_path, 'wb') as f:
                f.write(response.read())
        size_kb = os.path.getsize(output_path) / 1024
        print(f"  Downloaded: {size_kb:.0f} KB")
        return True
    except Exception as e:
        print(f"  Failed: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate air temperature PNG + grid JSON")
    parser.add_argument("--output-dir", type=str, default="public/data")
    args = parser.parse_args()

    print("Generating air temperature raster...")

    # Try recent GFS cycles (latest first)
    os.makedirs("data/gfs-temp", exist_ok=True)
    grib_path = None

    now = datetime.now(UTC)
    for hours_back in range(0, 24, 6):
        dt = now - timedelta(hours=hours_back)
        date_str = dt.strftime("%Y%m%d")
        cycle = (dt.hour // 6) * 6
        path = f"data/gfs-temp/gfs-tmp2m-{date_str}-{cycle:02d}z.grib2"

        if os.path.exists(path) and os.path.getsize(path) > 1000:
            print(f"  Using cached: {path}")
            grib_path = path
            break

        if download_gfs_temp(date_str, cycle, path):
            grib_path = path
            break

    if not grib_path:
        print("ERROR: Could not download GFS temperature data")
        sys.exit(1)

    # Read GRIB
    print("Reading air temperature data...")
    import cfgrib
    ds = cfgrib.open_datasets(grib_path)

    # Find the dataset with 2m temperature
    t2m = None
    for d in ds:
        if 't2m' in d.data_vars:
            t2m = d.t2m.values  # Kelvin
            lats = d.latitude.values
            lons = d.longitude.values
            break
        elif 't' in d.data_vars:
            t2m = d.t.values
            lats = d.latitude.values
            lons = d.longitude.values
            break

    if t2m is None:
        print("ERROR: No temperature variable found in GRIB")
        print("  Available datasets:", [list(d.data_vars) for d in ds])
        sys.exit(1)

    # Convert Kelvin to Celsius
    t2m_c = t2m - 273.15

    print(f"  Grid: {t2m_c.shape}, lat: {lats[0]} to {lats[-1]}")
    print(f"  Air temp range: {np.nanmin(t2m_c):.1f}°C to {np.nanmax(t2m_c):.1f}°C")

    # GFS grid: lat 90→-90, lon 0→360 (0.25°, 721×1440)
    # Shift longitude from 0-360 to -180-180
    shifted = np.roll(t2m_c, -t2m_c.shape[1] // 2, axis=1)

    # Reproject
    print("Reprojecting to Web Mercator...")
    mercator = reproject_to_mercator(shifted)

    # Fill gaps
    print("Filling data gaps...")
    mercator = fill_all_gaps(mercator, fallback_value=15.0)

    # Apply color LUT
    rgba = apply_color_lut(mercator, AIR_TEMP_LUT, AIR_TEMP_MIN, AIR_TEMP_MAX)

    # Apply water mask (air temp shows everywhere, but keep consistent with other layers)
    water_mask = get_water_mask()
    rgba[:, :, 3] = (water_mask * UNIFORM_ALPHA).astype(np.uint8)

    # Save PNG
    os.makedirs(args.output_dir, exist_ok=True)
    png_path = os.path.join(args.output_dir, "air-temp-daily.png")
    img = Image.fromarray(rgba, 'RGBA')
    img.save(png_path, 'PNG', optimize=True)
    size_kb = os.path.getsize(png_path) / 1024

    # Save grid JSON (2° downsampled for client-side lookup)
    step = 8
    grid_data = shifted[::step, ::step]
    grid_lats = lats[::step]
    grid_lons = np.linspace(-179.875, 179.875, 1440)[::step]

    grid_clean = np.where(np.isnan(grid_data), -999, np.round(grid_data, 1))

    air_grid = {
        "lat_start": float(grid_lats[0]),
        "lat_step": float(grid_lats[1] - grid_lats[0]) if len(grid_lats) > 1 else -2.0,
        "lng_start": float(grid_lons[0]),
        "lng_step": float(grid_lons[1] - grid_lons[0]) if len(grid_lons) > 1 else 2.0,
        "rows": len(grid_lats),
        "cols": len(grid_lons),
        "data": grid_clean.tolist(),
    }

    grid_path = os.path.join(args.output_dir, "air-temp-grid.json")
    with open(grid_path, "w") as f:
        json.dump(air_grid, f, separators=(",", ":"))
    grid_kb = os.path.getsize(grid_path) / 1024

    print(f"\n=== DONE ===")
    print(f"  Raster: {png_path} ({size_kb:.0f} KB)")
    print(f"  Grid:   {grid_path} ({grid_kb:.0f} KB)")


if __name__ == "__main__":
    main()
