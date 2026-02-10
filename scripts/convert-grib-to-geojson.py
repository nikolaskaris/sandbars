#!/usr/bin/env python3
"""
Convert WaveWatch III GRIB2 data to GeoJSON format.

Processes all forecast hours in data/grib/ directory.

Input:  data/grib/gfswave.*.global.0p25.f*.grib2
Output: public/data/wave-data-f000.geojson
        public/data/wave-data-f024.geojson
        ... etc
        public/data/wave-data.geojson (copy of f000 for backward compatibility)
"""

import glob
import json
import math
import os
import re
import shutil
import sys
from datetime import datetime

import cfgrib
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

# Configuration
GRIB_DIR = "data/grib"
OUTPUT_DIR = "public/data"
SAMPLE_STEP = 24  # Every 6° (grid is 0.25°, so 6/0.25 = 24)
MIN_SWELL_HEIGHT = 0.1  # Minimum swell height to include

# PNG raster configuration
PNG_WIDTH = 720
PNG_HEIGHT = 720  # Square for Web Mercator projection
LUT_SIZE = 1024

# Web Mercator limits (standard for web maps)
MAX_LATITUDE = 85.051129  # degrees — Mercator undefined at poles

# Color ramps: list of (normalized_position, R, G, B, A)
# Wave height: 0-15m, blue → cyan → green → yellow → red
WAVE_HEIGHT_COLORS = [
    (0.0,   30,  60, 180, 160),   # deep blue
    (0.07,  0,  120, 200, 180),   # blue
    (0.13,  0,  180, 220, 190),   # cyan
    (0.27,  0,  200, 100, 200),   # green
    (0.47, 200, 220,  50, 210),   # yellow
    (0.67, 240, 140,  30, 220),   # orange
    (1.0,  220,  30,  30, 230),   # red
]
WAVE_HEIGHT_MIN = 0.0
WAVE_HEIGHT_MAX = 15.0

# Wave period: 0-25s, blue → teal → green → purple
WAVE_PERIOD_COLORS = [
    (0.0,   40,  60, 180, 160),   # blue
    (0.2,   0,  140, 200, 180),   # teal
    (0.4,   0,  180, 120, 200),   # green-teal
    (0.6,  80,  200,  80, 210),   # green
    (0.8,  180, 100, 200, 220),   # purple
    (1.0,  140,  40, 180, 230),   # deep purple
]
WAVE_PERIOD_MIN = 0.0
WAVE_PERIOD_MAX = 25.0

# Wind speed: 0-30 m/s, gray → green → yellow → red
WIND_SPEED_COLORS = [
    (0.0,  100, 120, 140, 140),   # gray
    (0.17,  60, 160, 120, 170),   # teal
    (0.33,  40, 190,  80, 190),   # green
    (0.5,  160, 210,  50, 200),   # yellow-green
    (0.67, 220, 180,  30, 210),   # yellow-orange
    (0.83, 240, 100,  30, 220),   # orange
    (1.0,  200,  30,  30, 230),   # red
]
WIND_SPEED_MIN = 0.0
WIND_SPEED_MAX = 30.0


def round1(val):
    """Round to 1 decimal place, handling NaN."""
    if np.isnan(val):
        return None
    return round(float(val), 1)


def convert_longitude(lon):
    """Convert longitude from 0-360 to -180 to 180."""
    if lon > 180:
        return lon - 360
    return lon


def extract_forecast_hour(filename):
    """Extract forecast hour from filename like gfswave.t18z.global.0p25.f024.grib2"""
    match = re.search(r'\.f(\d{3})\.grib2$', filename)
    if match:
        return int(match.group(1))
    return None


def build_color_lut(color_ramp, lut_size=LUT_SIZE):
    """Pre-build a (lut_size, 4) uint8 lookup table from color stops."""
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
    # Fill last entry
    lut[-1] = np.array(color_ramp[-1][1:], dtype=np.uint8)
    return lut


# Pre-build LUTs at module load
WAVE_HEIGHT_LUT = build_color_lut(WAVE_HEIGHT_COLORS)
WAVE_PERIOD_LUT = build_color_lut(WAVE_PERIOD_COLORS)
WIND_SPEED_LUT = build_color_lut(WIND_SPEED_COLORS)


def apply_color_lut(grid, lut, min_val, max_val):
    """Map a 2D float grid to an RGBA image using a prebuilt LUT.

    NaN pixels become fully transparent.
    """
    nan_mask = np.isnan(grid)
    # Normalize to [0, 1]
    normalized = np.clip((grid - min_val) / (max_val - min_val), 0, 1)
    normalized[nan_mask] = 0
    # Map to LUT indices
    indices = (normalized * (len(lut) - 1)).astype(np.int32)
    # Look up colors
    rgba = lut[indices]
    # Set NaN pixels to transparent
    rgba[nan_mask] = [0, 0, 0, 0]
    return rgba


def reproject_to_mercator(equirect_array, output_height=PNG_HEIGHT, output_width=PNG_WIDTH):
    """Vectorized reprojection from equirectangular to Web Mercator.

    Input: equirect_array with shape (lat, lon) where lat goes from +90 (top)
           to -90 (bottom) and lon goes from -180 (left) to +180 (right).
    Output: Mercator array with shape (output_height, output_width), clipped
            to ±MAX_LATITUDE.
    """
    in_height, in_width = equirect_array.shape

    # Create output coordinate grids
    out_y = np.arange(output_height)
    out_x = np.arange(output_width)
    out_xx, out_yy = np.meshgrid(out_x, out_y)

    # Convert output y to latitude via inverse Mercator
    y_norm = out_yy / (output_height - 1)  # 0 (top/north) to 1 (bottom/south)
    y_max = math.log(math.tan(math.pi / 4 + math.radians(MAX_LATITUDE) / 2))
    y_merc = y_max - y_norm * (2 * y_max)
    lat = np.degrees(2 * np.arctan(np.exp(y_merc)) - np.pi / 2)

    # Convert latitude to input row indices (input: +90 at row 0, -90 at last row)
    in_yy = (90 - lat) / 180 * (in_height - 1)

    # Longitude is linear in both projections
    in_xx = out_xx / (output_width - 1) * (in_width - 1)

    # Use scipy map_coordinates for bilinear interpolation
    # NaN handling: replace NaN with 0 for interpolation, then restore
    nan_mask = np.isnan(equirect_array)
    safe_array = equirect_array.copy()
    safe_array[nan_mask] = 0

    coords = np.array([in_yy, in_xx])
    output = map_coordinates(safe_array, coords, order=1, mode='constant', cval=0)

    # Build a NaN mask in the output: interpolate the mask to detect NaN regions
    nan_float = nan_mask.astype(np.float32)
    nan_interp = map_coordinates(nan_float, coords, order=1, mode='constant', cval=1)
    output[nan_interp > 0.5] = np.nan

    return output


def generate_raster_pngs(swh, primary_period, ws, forecast_hour, output_dir):
    """Generate 3 PNG rasters (wave height, period, wind) from full-res GRIB grids.

    Input grids are 721x1440 (0.25° global, 0-360 lon).
    Output PNGs are 720x720 Web Mercator (±85.05° lat, -180 to 180 lon).
    """
    layers = [
        ("wave-height", swh, WAVE_HEIGHT_LUT, WAVE_HEIGHT_MIN, WAVE_HEIGHT_MAX),
        ("wave-period", primary_period, WAVE_PERIOD_LUT, WAVE_PERIOD_MIN, WAVE_PERIOD_MAX),
        ("wind-speed", ws, WIND_SPEED_LUT, WIND_SPEED_MIN, WIND_SPEED_MAX),
    ]

    for name, data, lut, vmin, vmax in layers:
        # Shift longitude from 0-360 to -180-180
        shifted = np.roll(data, data.shape[1] // 2, axis=1)
        # Reproject from equirectangular to Web Mercator
        mercator = reproject_to_mercator(shifted)
        # Apply color mapping
        rgba = apply_color_lut(mercator, lut, vmin, vmax)
        # Save PNG
        img = Image.fromarray(rgba, 'RGBA')
        png_path = os.path.join(output_dir, f"{name}-f{forecast_hour:03d}.png")
        img.save(png_path, 'PNG', optimize=True)


def convert_grib_file(grib_path, output_path, file_num, total_files):
    """Convert a single GRIB file to GeoJSON."""
    filename = os.path.basename(grib_path)
    forecast_hour = extract_forecast_hour(filename)

    print(f"Processing f{forecast_hour:03d} ({file_num}/{total_files})...")

    # Load datasets
    datasets = cfgrib.open_datasets(grib_path)

    # Dataset 0: swell partitions (swdir, shts, mpts)
    # Dataset 1: main wave data (swh, ws, wdir)
    ds_swell = datasets[0]
    ds_wave = datasets[1]

    # Extract timestamps
    reference_time = str(ds_wave.time.values)[:19] + "Z"
    valid_time = str(ds_wave.valid_time.values)[:19] + "Z"

    # Get coordinate arrays
    lats = ds_wave.latitude.values
    lons = ds_wave.longitude.values

    # Get data arrays
    swh = ds_wave.swh.values
    ws = ds_wave.ws.values
    wdir = ds_wave.wdir.values
    shww = ds_wave.shww.values
    mpww = ds_wave.mpww.values
    wvdir = ds_wave.wvdir.values

    # Swell partition data
    swdir = ds_swell.swdir.values
    shts = ds_swell.shts.values
    mpts = ds_swell.mpts.values

    # Generate PNG rasters from full-resolution grids
    generate_raster_pngs(swh, mpts[0], ws, forecast_hour, OUTPUT_DIR)

    features = []
    skipped_land = 0

    # Sample grid at 6° intervals
    for lat_idx in range(0, len(lats), SAMPLE_STEP):
        for lon_idx in range(0, len(lons), SAMPLE_STEP):
            lat = float(lats[lat_idx])
            lon = convert_longitude(float(lons[lon_idx]))

            wave_height = swh[lat_idx, lon_idx]

            # Skip land (NaN values)
            if np.isnan(wave_height):
                skipped_land += 1
                continue

            # Build swells array from partitions
            swells = []
            for p in range(3):
                height = shts[p, lat_idx, lon_idx]
                period = mpts[p, lat_idx, lon_idx]
                direction = swdir[p, lat_idx, lon_idx]

                if np.isnan(height) or height < MIN_SWELL_HEIGHT:
                    continue

                swells.append({
                    "height": round1(height),
                    "period": round1(period),
                    "direction": int(direction) if not np.isnan(direction) else 0
                })

            # Wind data
            wind = {
                "speed": round1(ws[lat_idx, lon_idx]) if not np.isnan(ws[lat_idx, lon_idx]) else 0,
                "direction": int(wdir[lat_idx, lon_idx]) if not np.isnan(wdir[lat_idx, lon_idx]) else 0
            }

            # Wind wave data
            ww_height = shww[lat_idx, lon_idx]
            wind_waves = None
            if not np.isnan(ww_height) and ww_height > 0:
                wind_waves = {
                    "height": round1(ww_height),
                    "period": round1(mpww[lat_idx, lon_idx]) if not np.isnan(mpww[lat_idx, lon_idx]) else None,
                    "direction": int(wvdir[lat_idx, lon_idx]) if not np.isnan(wvdir[lat_idx, lon_idx]) else None
                }

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon, 2), round(lat, 2)]
                },
                "properties": {
                    "waveHeight": round1(wave_height),
                    "swells": swells,
                    "windWaves": wind_waves,
                    "wind": wind
                }
            }

            features.append(feature)

    # Create GeoJSON with metadata
    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "WaveWatch III",
            "model_run": reference_time,
            "forecast_hour": forecast_hour,
            "valid_time": valid_time,
            "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "grid_resolution": "6deg",
            "point_count": len(features)
        },
        "features": features
    }

    # Write output
    with open(output_path, 'w') as f:
        json.dump(geojson, f)

    return len(features), forecast_hour


def main():
    # Change to project directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    os.chdir(project_dir)

    # Find all GRIB files
    grib_pattern = os.path.join(GRIB_DIR, "gfswave.*.global.0p25.f*.grib2")
    grib_files = sorted(glob.glob(grib_pattern))

    if not grib_files:
        print(f"No GRIB files found matching: {grib_pattern}")
        return

    print(f"Found {len(grib_files)} GRIB files in {GRIB_DIR}/")
    print(f"Output directory: {OUTPUT_DIR}/")
    print("=" * 50)

    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    total_features = 0
    f000_output = None
    failed_files = []

    # Process each file
    for i, grib_file in enumerate(grib_files, 1):
        forecast_hour = extract_forecast_hour(grib_file)
        output_file = os.path.join(OUTPUT_DIR, f"wave-data-f{forecast_hour:03d}.geojson")

        try:
            features_count, fhour = convert_grib_file(grib_file, output_file, i, len(grib_files))
            total_features += features_count

            # Track f000 for backward compatibility copy
            if forecast_hour == 0:
                f000_output = output_file
        except Exception as e:
            print(f"  WARNING: Failed to process {os.path.basename(grib_file)}: {e}")
            failed_files.append(os.path.basename(grib_file))
            continue

    # Create backward-compatible wave-data.geojson (copy of f000)
    if f000_output:
        legacy_output = os.path.join(OUTPUT_DIR, "wave-data.geojson")
        shutil.copy(f000_output, legacy_output)
        print(f"\nCreated {legacy_output} (copy of f000)")

    # Print summary
    succeeded = len(grib_files) - len(failed_files)
    print("\n" + "=" * 50)
    print("Conversion Complete!")
    print("=" * 50)
    print(f"Files processed:    {succeeded}/{len(grib_files)}")
    if succeeded > 0:
        print(f"Features per file:  ~{total_features // succeeded}")
    print(f"Total features:     {total_features}")
    print(f"Output directory:   {OUTPUT_DIR}/")

    # List output files
    print("\nGeoJSON files:")
    output_files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "wave-data*.geojson")))
    for f in output_files:
        size_kb = os.path.getsize(f) / 1024
        print(f"  {os.path.basename(f):30} {size_kb:6.1f} KB")

    # List PNG raster files
    png_files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "*.png")))
    if png_files:
        print(f"\nPNG raster files: {len(png_files)}")
        total_png_kb = sum(os.path.getsize(f) for f in png_files) / 1024
        print(f"  Total size: {total_png_kb:.0f} KB ({total_png_kb/1024:.1f} MB)")

    # Report failures
    if failed_files:
        print(f"\nWARNING: {len(failed_files)} file(s) failed to process:")
        for f in failed_files:
            print(f"    - {f}")

        success_rate = succeeded / len(grib_files)
        if success_rate < 0.9:
            print(f"\nError: Too many failures ({len(failed_files)}/{len(grib_files)})")
            sys.exit(1)
        else:
            print(f"\n{succeeded}/{len(grib_files)} files processed successfully")


if __name__ == "__main__":
    main()
