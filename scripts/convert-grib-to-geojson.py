#!/usr/bin/env python3
"""
Convert WaveWatch III GRIB2 data to GeoJSON format.

Input: gfswave.t12z.global.0p25.f000.grib2
Output: public/data/wave-data.geojson
"""

import json
import os
import numpy as np
import cfgrib

# Configuration
GRIB_FILE = "gfswave.t12z.global.0p25.f000.grib2"
OUTPUT_FILE = "public/data/wave-data.geojson"
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


def main():
    # Change to project directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    os.chdir(project_dir)

    print(f"Loading GRIB2 file: {GRIB_FILE}")

    # Load datasets
    datasets = cfgrib.open_datasets(GRIB_FILE)
    print(f"Loaded {len(datasets)} datasets")

    # Dataset 0: swell partitions (swdir, shts, mpts)
    # Dataset 1: main wave data (swh, ws, wdir)
    ds_swell = datasets[0]
    ds_wave = datasets[1]

    # Get coordinate arrays
    lats = ds_wave.latitude.values
    lons = ds_wave.longitude.values

    # Get data arrays
    swh = ds_wave.swh.values  # Significant wave height
    ws = ds_wave.ws.values  # Wind speed
    wdir = ds_wave.wdir.values  # Wind direction

    # Wind wave data
    shww = ds_wave.shww.values  # Significant height of wind waves
    mpww = ds_wave.mpww.values  # Mean period of wind waves
    wvdir = ds_wave.wvdir.values  # Direction of wind waves

    # Swell partition data (3 partitions)
    swdir = ds_swell.swdir.values  # Swell direction [partition, lat, lon]
    shts = ds_swell.shts.values  # Swell height
    mpts = ds_swell.mpts.values  # Mean wave period

    print(f"Grid size: {len(lats)} x {len(lons)}")
    print(f"Sampling every {SAMPLE_STEP} points (every {SAMPLE_STEP * 0.25}°)")

    features = []
    skipped_land = 0

    # Sample grid at 6° intervals
    for lat_idx in range(0, len(lats), SAMPLE_STEP):
        for lon_idx in range(0, len(lons), SAMPLE_STEP):
            lat = float(lats[lat_idx])
            lon = convert_longitude(float(lons[lon_idx]))

            # Get significant wave height
            wave_height = swh[lat_idx, lon_idx]

            # Skip land (NaN values)
            if np.isnan(wave_height):
                skipped_land += 1
                continue

            # Build swells array from partitions
            swells = []
            for p in range(3):  # 3 swell partitions
                height = shts[p, lat_idx, lon_idx]
                period = mpts[p, lat_idx, lon_idx]
                direction = swdir[p, lat_idx, lon_idx]

                # Skip if height is NaN or too small
                if np.isnan(height) or height < MIN_SWELL_HEIGHT:
                    continue

                swells.append({
                    "height": round1(height),
                    "period": round1(period),
                    "direction": int(direction) if not np.isnan(direction) else 0
                })

            # Get wind data
            wind_speed = ws[lat_idx, lon_idx]
            wind_dir = wdir[lat_idx, lon_idx]

            wind = {
                "speed": round1(wind_speed) if not np.isnan(wind_speed) else 0,
                "direction": int(wind_dir) if not np.isnan(wind_dir) else 0
            }

            # Get wind wave data
            ww_height = shww[lat_idx, lon_idx]
            ww_period = mpww[lat_idx, lon_idx]
            ww_dir = wvdir[lat_idx, lon_idx]

            # Build windWaves object (None if data missing)
            wind_waves = None
            if not np.isnan(ww_height) and ww_height > 0:
                wind_waves = {
                    "height": round1(ww_height),
                    "period": round1(ww_period) if not np.isnan(ww_period) else None,
                    "direction": int(ww_dir) if not np.isnan(ww_dir) else None
                }

            # Create feature
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

    # Create GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(geojson, f, indent=2)

    # Print summary
    wave_heights = [f["properties"]["waveHeight"] for f in features]
    print(f"\n{'='*40}")
    print(f"Conversion complete!")
    print(f"{'='*40}")
    print(f"Points generated: {len(features)}")
    print(f"Points skipped (land): {skipped_land}")
    print(f"Wave height range: {min(wave_heights):.1f}m - {max(wave_heights):.1f}m")
    print(f"Output: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
