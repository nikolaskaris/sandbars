#!/usr/bin/env python3
"""
Generate SST (Sea Surface Temperature) PNG raster from NOAA OISST v2.1 daily data.

Downloads the latest daily NetCDF and produces a 1440x1440 Web Mercator PNG
matching the existing forecast raster pipeline.

Usage:
  python3 scripts/generate-sst-raster.py
  python3 scripts/generate-sst-raster.py --date 20260327
  python3 scripts/generate-sst-raster.py --output-dir public/data

Requires:
  pip3 install numpy Pillow scipy netCDF4
"""

import argparse
import math
import os
import sys
import urllib.request
from datetime import datetime, timedelta, UTC

import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates, uniform_filter

# ---------------------------------------------------------------------------
# Configuration (matches convert-grib-to-geojson.py exactly)
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
# SST Color Ramp: 0-32°C
# Warm-muted aesthetic matching existing ramps.
# cool blue-gray → blue → teal → green-yellow → warm yellow → orange → red
# ---------------------------------------------------------------------------
SST_COLORS = [
    (0.0,    140, 155, 175, 140),   # 0°C:  cool blue-gray (frigid)
    (0.10,   100, 140, 190, 170),   # 3°C:  steel blue
    (0.25,    60, 130, 180, 195),   # 8°C:  medium blue
    (0.40,    50, 155, 155, 210),   # 13°C: teal
    (0.55,    80, 175, 120, 215),   # 18°C: teal-green
    (0.70,   170, 185, 80,  225),   # 22°C: warm yellow-green
    (0.82,   210, 165, 60,  232),   # 26°C: warm orange-yellow
    (0.92,   200, 110, 55,  238),   # 29°C: orange
    (1.0,    180, 65,  50,  242),   # 32°C: warm red
]
SST_MIN = 0.0
SST_MAX = 32.0

# ---------------------------------------------------------------------------
# Reusable pipeline functions (from convert-grib-to-geojson.py)
# ---------------------------------------------------------------------------

def get_water_mask():
    global _water_mask
    if _water_mask is None:
        if os.path.exists(WATER_MASK_PATH):
            _water_mask = np.array(Image.open(WATER_MASK_PATH)).astype(np.float32) / 255.0
        else:
            print(f"Warning: Water mask not found at {WATER_MASK_PATH}, using full alpha")
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
        missing = (filled == 0) | np.isnan(filled)
        if not missing.any():
            break
        valid = ~missing
        neighbor_sum = uniform_filter(
            np.where(valid, filled, 0), size=3, mode='constant', cval=0
        )
        neighbor_count = uniform_filter(
            valid.astype(np.float64), size=3, mode='constant', cval=0
        )
        with np.errstate(divide='ignore', invalid='ignore'):
            neighbor_avg = np.where(
                neighbor_count > 0, neighbor_sum / neighbor_count, 0
            )
        fill_mask = missing & (neighbor_count > 0)
        filled[fill_mask] = neighbor_avg[fill_mask]
    remaining = (filled == 0) | np.isnan(filled)
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


# Pre-build LUT
SST_LUT = build_color_lut(SST_COLORS)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def download_sst(date_str, output_path):
    """Download OISST v2.1 daily NetCDF for a given date.
    Tries both final and preliminary naming conventions."""
    year_month = date_str[:6]
    base_url = (
        f"https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/"
        f"v2.1/access/avhrr/{year_month}/oisst-avhrr-v02r01.{date_str}"
    )
    # Try final version first, then preliminary
    for suffix in [".nc", "_preliminary.nc"]:
        url = base_url + suffix
        print(f"  Trying: {url}")
        try:
            urllib.request.urlretrieve(url, output_path)
            size_mb = os.path.getsize(output_path) / (1024 * 1024)
            print(f"  Downloaded: {size_mb:.1f} MB")
            return True
        except Exception:
            continue
    print(f"  Download failed for {date_str}")
    return False


def main():
    parser = argparse.ArgumentParser(description="Generate SST PNG raster from OISST data")
    parser.add_argument("--date", type=str, default=None,
                        help="Date in YYYYMMDD format (default: yesterday)")
    parser.add_argument("--output-dir", type=str, default="public/data",
                        help="Output directory for PNG")
    args = parser.parse_args()

    # OISST has ~1-day lag, so default to yesterday
    if args.date:
        date_str = args.date
    else:
        yesterday = datetime.now(UTC) - timedelta(days=1)
        date_str = yesterday.strftime("%Y%m%d")

    print(f"Generating SST raster for {date_str}...")

    # Download
    os.makedirs("data/sst", exist_ok=True)
    nc_path = f"data/sst/oisst-{date_str}.nc"

    if not os.path.exists(nc_path):
        if not download_sst(date_str, nc_path):
            # Try day before if yesterday isn't available yet
            prev = datetime.strptime(date_str, "%Y%m%d") - timedelta(days=1)
            date_str = prev.strftime("%Y%m%d")
            nc_path = f"data/sst/oisst-{date_str}.nc"
            print(f"  Trying previous day: {date_str}")
            if not os.path.exists(nc_path):
                if not download_sst(date_str, nc_path):
                    print("ERROR: Could not download SST data")
                    sys.exit(1)
    else:
        print(f"  Using cached: {nc_path}")

    # Read NetCDF
    print("Reading SST data...")
    import netCDF4
    ds = netCDF4.Dataset(nc_path)

    # OISST grid: sst variable has shape (1, 1, 720, 1440)
    # lat: -89.875 to 89.875 (0.25° spacing, south→north)
    # lon: 0.125 to 359.875 (0.25° spacing, 0-360)
    sst_raw = ds.variables['sst'][0, 0, :, :]  # (720, 1440)
    sst = np.array(sst_raw, dtype=np.float64)

    # Handle fill values / mask
    if hasattr(sst_raw, 'mask'):
        sst[sst_raw.mask] = np.nan
    # OISST uses -999 or similar fill values
    sst[sst < -10] = np.nan

    ds.close()

    lat = np.linspace(-89.875, 89.875, 720)
    print(f"  Grid: {sst.shape}, lat range: {lat[0]} to {lat[-1]}")
    print(f"  SST range: {np.nanmin(sst):.1f}°C to {np.nanmax(sst):.1f}°C")

    # Flip to match expected orientation (north at top, +90 → -90)
    sst_flipped = np.flipud(sst)

    # Shift longitude from 0-360 to -180-180
    sst_shifted = np.roll(sst_flipped, -sst_flipped.shape[1] // 2, axis=1)

    # Reproject to Web Mercator
    print("Reprojecting to Web Mercator...")
    mercator = reproject_to_mercator(sst_shifted)

    # Fill gaps
    print("Filling data gaps...")
    mercator = fill_all_gaps(mercator, fallback_value=15.0)

    # Apply color LUT
    print("Applying color ramp...")
    rgba = apply_color_lut(mercator, SST_LUT, SST_MIN, SST_MAX)

    # Apply water mask
    water_mask = get_water_mask()
    rgba[:, :, 3] = (water_mask * UNIFORM_ALPHA).astype(np.uint8)

    # Save PNG
    os.makedirs(args.output_dir, exist_ok=True)
    png_path = os.path.join(args.output_dir, "water-temp-daily.png")
    img = Image.fromarray(rgba, 'RGBA')
    img.save(png_path, 'PNG', optimize=True)

    size_kb = os.path.getsize(png_path) / 1024
    print(f"\n=== DONE ===")
    print(f"  Output: {png_path} ({size_kb:.0f} KB)")
    print(f"  Date: {date_str}")
    print(f"  Dimensions: {PNG_WIDTH}x{PNG_HEIGHT}")


if __name__ == "__main__":
    main()
