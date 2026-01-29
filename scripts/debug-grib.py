#!/usr/bin/env python3
"""
Debug GRIB2 values at specific Southern Ocean locations.
"""

import os
import numpy as np
import cfgrib

# Test points in Southern Ocean
TEST_POINTS = [
    (-50, 0),
    (-50, 90),
    (-50, 180),
    (-60, 0),
    (-60, -90),
]

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    os.chdir(project_dir)

    print("Loading GRIB2 file...")
    datasets = cfgrib.open_datasets("gfswave.t12z.global.0p25.f000.grib2")

    ds_swell = datasets[0]  # swdir, shts, mpts
    ds_wave = datasets[1]   # swh, ws, wdir

    # Get coordinates
    lats = ds_wave.latitude.values
    lons = ds_wave.longitude.values

    # Get data arrays
    swh = ds_wave.swh.values
    shts = ds_swell.shts.values  # [partition, lat, lon]

    print("\n" + "=" * 70)
    print("Raw GRIB values at Southern Ocean test points")
    print("=" * 70)
    print(f"{'Point':<15} | {'swh (total)':<12} | {'shts[0]':<10} | {'shts[1]':<10} | {'shts[2]':<10}")
    print("-" * 70)

    for test_lat, test_lon in TEST_POINTS:
        # Convert lon to 0-360 range for lookup
        lookup_lon = test_lon if test_lon >= 0 else test_lon + 360

        # Find nearest indices
        lat_idx = np.argmin(np.abs(lats - test_lat))
        lon_idx = np.argmin(np.abs(lons - lookup_lon))

        actual_lat = lats[lat_idx]
        actual_lon = lons[lon_idx]

        # Get values
        swh_val = swh[lat_idx, lon_idx]
        shts_vals = [shts[p, lat_idx, lon_idx] for p in range(3)]

        # Format values
        swh_str = f"{swh_val:.2f}m" if not np.isnan(swh_val) else "NaN"
        shts_strs = [f"{v:.2f}m" if not np.isnan(v) else "NaN" for v in shts_vals]

        print(f"({test_lat}, {test_lon:>4})" + " " * 4 + f"| {swh_str:<12} | {shts_strs[0]:<10} | {shts_strs[1]:<10} | {shts_strs[2]:<10}")
        print(f"  -> actual: ({actual_lat:.2f}, {actual_lon:.2f})")

    # Print forecast time info
    print("\n" + "=" * 70)
    print("Forecast timestamp info")
    print("=" * 70)
    print(f"Time (reference):  {ds_wave.time.values}")
    print(f"Step (forecast):   {ds_wave.step.values}")
    print(f"Valid time:        {ds_wave.valid_time.values}")


if __name__ == "__main__":
    main()
