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
import os
import re
import shutil
from datetime import datetime

import cfgrib
import numpy as np

# Configuration
GRIB_DIR = "data/grib"
OUTPUT_DIR = "public/data"
SAMPLE_STEP = 24  # Every 6° (grid is 0.25°, so 6/0.25 = 24)
MIN_SWELL_HEIGHT = 0.1  # Minimum swell height to include


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
            "forecastHour": forecast_hour,
            "validTime": valid_time,
            "referenceTime": reference_time,
            "generatedAt": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
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

    # Process each file
    for i, grib_file in enumerate(grib_files, 1):
        forecast_hour = extract_forecast_hour(grib_file)
        output_file = os.path.join(OUTPUT_DIR, f"wave-data-f{forecast_hour:03d}.geojson")

        features_count, fhour = convert_grib_file(grib_file, output_file, i, len(grib_files))
        total_features += features_count

        # Track f000 for backward compatibility copy
        if forecast_hour == 0:
            f000_output = output_file

    # Create backward-compatible wave-data.geojson (copy of f000)
    if f000_output:
        legacy_output = os.path.join(OUTPUT_DIR, "wave-data.geojson")
        shutil.copy(f000_output, legacy_output)
        print(f"\nCreated {legacy_output} (copy of f000)")

    # Print summary
    print("\n" + "=" * 50)
    print("Conversion Complete!")
    print("=" * 50)
    print(f"Files processed:    {len(grib_files)}")
    print(f"Features per file:  ~{total_features // len(grib_files)}")
    print(f"Total features:     {total_features}")
    print(f"Output directory:   {OUTPUT_DIR}/")

    # List output files
    print("\nOutput files:")
    output_files = sorted(glob.glob(os.path.join(OUTPUT_DIR, "wave-data*.geojson")))
    for f in output_files:
        size_kb = os.path.getsize(f) / 1024
        print(f"  {os.path.basename(f):30} {size_kb:6.1f} KB")


if __name__ == "__main__":
    main()
