#!/usr/bin/env python3
"""
Compute a global coastal tide grid using pyTMD + GOT4.10c.

Produces a compact binary file of tide predictions for all coastal grid points,
enabling instant client-side tide lookup at any ocean coordinate.

Output:
  - tides-YYYY-MM-header.json: grid point coordinates + time metadata
  - tides-YYYY-MM.bin: Int16 array (heights in centimeters), 720 values per point

Usage:
  python3 scripts/compute-coastal-tide-grid.py [--days 30] [--interval 60]
  python3 scripts/compute-coastal-tide-grid.py --output-dir /tmp/tides
  python3 scripts/compute-coastal-tide-grid.py --upload  # Upload to Supabase Storage

Requires:
  pip3 install pyTMD h5py dask numpy
  Optional: pip3 install supabase  (for --upload)
"""

import numpy as np
import datetime
import os
import sys
import json
import struct
import argparse
import time as time_mod


def main():
    parser = argparse.ArgumentParser(description="Compute global coastal tide grid")
    parser.add_argument("--days", type=int, default=30, help="Days to predict (default 30)")
    parser.add_argument("--interval", type=int, default=60, help="Interval in minutes (default 60)")
    parser.add_argument("--output-dir", type=str, default="public/data", help="Output directory")
    parser.add_argument("--upload", action="store_true", help="Upload to Supabase Storage")
    args = parser.parse_args()

    # Import pyTMD
    import pyTMD.io
    import pyTMD.predict
    import pyTMD.datasets

    # Ensure model data is available
    print("Loading GOT4.10c model...")
    m = pyTMD.io.model().from_database("GOT4.10_nc")
    # m.verify is a bool property, not a method
    if not m.verify:
        print("  Downloading GOT4.10c (one-time, ~200MB)...")
        pyTMD.datasets.fetch_gsfc_got(model="GOT4.10")
        m = pyTMD.io.model().from_database("GOT4.10_nc")

    print(f"  Model: {m.name}, format: {m.format}")

    # Load model dataset once
    print("Reading tidal constituents...")
    ds = m.open_dataset(group="z")

    # =========================================================================
    # Step 1: Extract coastal grid points
    # =========================================================================
    print("\nExtracting coastal grid points...")

    # GOT4.10c native grid: 0.5° resolution
    # We'll use the model's own grid to find valid ocean points near coastlines
    grid_step = 0.5
    lats = np.arange(-80, 80 + grid_step, grid_step)  # Skip polar regions
    lons = np.arange(-180, 180, grid_step)

    # Create meshgrid of all candidate points
    lon_grid, lat_grid = np.meshgrid(lons, lats)
    lon_flat = lon_grid.flatten()
    lat_flat = lat_grid.flatten()

    print(f"  Total candidate points: {len(lon_flat)}")

    # Test which points have valid tidal constituents (i.e., are ocean)
    # Process in chunks to manage memory
    first_var = list(ds.data_vars)[0]
    chunk_size = 5000
    valid_mask = np.zeros(len(lon_flat), dtype=bool)

    print("  Testing grid points for valid tidal data...")
    for i in range(0, len(lon_flat), chunk_size):
        end = min(i + chunk_size, len(lon_flat))
        chunk_lons = lon_flat[i:end]
        chunk_lats = lat_flat[i:end]

        try:
            local = ds.tmd.interp(chunk_lons, chunk_lats,
                                  method="nearest", extrapolate=False)
            vals = local[first_var].values
            # Point is valid if at least one constituent is not NaN
            if vals.ndim == 1:
                valid_mask[i:end] = ~np.isnan(vals)
            else:
                valid_mask[i:end] = ~np.isnan(vals).all(axis=0)
        except Exception as e:
            print(f"    Chunk {i}-{end} error: {e}")

        if (i // chunk_size + 1) % 20 == 0:
            print(f"    Tested {end}/{len(lon_flat)} points...")

    ocean_lons = lon_flat[valid_mask]
    ocean_lats = lat_flat[valid_mask]
    print(f"  Ocean points with valid tidal data: {len(ocean_lons)}")

    # Filter to coastal points only:
    # A point is "coastal" if at least one of its 8 neighbors is land (no valid data)
    print("  Filtering to coastal points...")
    ocean_set = set()
    for lon, lat in zip(lon_flat[valid_mask], lat_flat[valid_mask]):
        ocean_set.add((round(float(lon), 2), round(float(lat), 2)))

    coastal_indices = []
    for idx in range(len(ocean_lons)):
        lon = float(ocean_lons[idx])
        lat = float(ocean_lats[idx])
        is_coastal = False
        for dx, dy in [(-grid_step, 0), (grid_step, 0), (0, -grid_step), (0, grid_step),
                       (-grid_step, -grid_step), (grid_step, -grid_step),
                       (-grid_step, grid_step), (grid_step, grid_step)]:
            neighbor = (round(lon + dx, 2), round(lat + dy, 2))
            if neighbor not in ocean_set:
                is_coastal = True
                break
        if is_coastal:
            coastal_indices.append(idx)

    coastal_lons = list(ocean_lons[coastal_indices])
    coastal_lats = list(ocean_lats[coastal_indices])
    print(f"  Coastal points (ocean with land neighbor): {len(coastal_lons)}")

    # Add supplementary points for islands and regions that the coastal filter
    # misses (small islands are entirely ocean at 0.5° resolution, so no land
    # neighbor exists). Sample ocean grid at 1° intervals within key regions.
    island_regions = [
        ("Hawaii",       18, 23, -162, -154),
        ("Tahiti",      -20, -16, -152, -148),
        ("Fiji",        -20, -16, 176, -179),  # crosses dateline
        ("Maldives",      1,  8,  72,  74),
        ("Caribbean",    10, 22, -86, -59),
        ("Canary Is.",   27, 30, -19, -13),
        ("Azores",       36, 40, -32, -24),
        ("Reunion",     -22, -20, 55, 56),
        ("Mauritius",   -21, -19, 57, 58),
        ("Sri Lanka",     5, 10, 79, 82),
        ("Madagascar",  -26, -12, 43, 51),
        ("Philippines",   5, 19, 117, 127),
        ("Japan",        24, 46, 123, 146),
        ("New Zealand", -48, -34, 166, 179),
    ]

    coastal_set = set(
        (round(float(lon), 2), round(float(lat), 2))
        for lon, lat in zip(coastal_lons, coastal_lats)
    )

    supplementary = 0
    for name, lat_min, lat_max, lon_min, lon_max in island_regions:
        for lat in np.arange(lat_min, lat_max + grid_step, grid_step):
            for lon in np.arange(lon_min, lon_max + grid_step, grid_step):
                key = (round(float(lon), 2), round(float(lat), 2))
                if key in coastal_set:
                    continue
                if key in ocean_set:
                    coastal_lons.append(float(lon))
                    coastal_lats.append(float(lat))
                    coastal_set.add(key)
                    supplementary += 1

    coastal_lons = np.array(coastal_lons)
    coastal_lats = np.array(coastal_lats)
    print(f"  Added {supplementary} supplementary island/region points")
    print(f"  Total points to process: {len(coastal_lons)}")

    # =========================================================================
    # Step 2: Compute tide predictions for all coastal points
    # =========================================================================
    print(f"\nComputing {args.days}-day tide predictions at {args.interval}min intervals...")

    now = datetime.datetime.now(datetime.UTC).replace(minute=0, second=0, microsecond=0)
    num_points = (args.days * 24 * 60) // args.interval
    times = [now + datetime.timedelta(minutes=i * args.interval) for i in range(num_points)]

    # Convert to days since J2000 epoch
    j2000 = datetime.datetime(2000, 1, 1, 12, 0, 0, tzinfo=datetime.UTC)
    t_days = np.array([(t - j2000).total_seconds() / 86400.0 for t in times])

    print(f"  Time range: {times[0].isoformat()} to {times[-1].isoformat()}")
    print(f"  Points per location: {num_points}")

    # Process one point at a time (pyTMD interp returns grid-shaped datasets
    # for multi-point calls, which breaks isel; single-point calls are safe)
    all_heights = []  # List of Int16 arrays
    valid_points = []  # (lon, lat) tuples for points that computed successfully
    computed = 0
    errors = 0
    start_time = time_mod.time()

    def interp_at(lon, lat):
        """Interpolate tidal constituents at a point with offshore nudging.
        If the exact point falls on land (NaN), try nearby offsets."""
        local = ds.tmd.interp(np.array([lon]), np.array([lat]),
                              method="nearest", extrapolate=False)
        if not np.isnan(local[first_var].values).all():
            return local
        # Nudge offshore in expanding circles (0.5° = grid resolution)
        for dist in [0.5, 1.0, 1.5]:
            for dx, dy in [(dist, 0), (-dist, 0), (0, dist), (0, -dist),
                           (dist, dist), (-dist, dist), (dist, -dist), (-dist, -dist)]:
                local = ds.tmd.interp(np.array([lon + dx]), np.array([lat + dy]),
                                      method="nearest", extrapolate=False)
                if not np.isnan(local[first_var].values).all():
                    return local
        return None

    for i in range(len(coastal_lons)):
        lon = float(coastal_lons[i])
        lat = float(coastal_lats[i])

        try:
            # Single-point interpolation with offshore nudging
            local = interp_at(lon, lat)

            if local is None:
                errors += 1
                continue

            # Predict tide heights
            tide_result = pyTMD.predict.time_series(t_days, local)
            heights_raw = np.array(tide_result.values).flatten()

            if np.isnan(heights_raw).all():
                errors += 1
                continue

            # Convert to centimeters as Int16 (range: -327.67m to +327.67m, plenty)
            heights_cm = np.round(heights_raw * 100).astype(np.int16)
            # Replace NaN with 0
            heights_cm[np.isnan(heights_raw)] = 0

            all_heights.append(heights_cm)
            valid_points.append((round(lon, 3), round(lat, 3)))
            computed += 1

        except Exception as e:
            errors += 1
            if errors <= 5:
                print(f"  Error at ({lon:.2f}, {lat:.2f}): {e}")

        if (i + 1) % 500 == 0 or i == len(coastal_lons) - 1:
            elapsed = time_mod.time() - start_time
            rate = (i + 1) / elapsed if elapsed > 0 else 0
            eta = (len(coastal_lons) - i - 1) / rate if rate > 0 else 0
            print(f"  Processed {i + 1}/{len(coastal_lons)} coastal points "
                  f"({computed} valid, {errors} errors) "
                  f"[{elapsed:.0f}s elapsed, ~{eta:.0f}s remaining]")

    print(f"\n  Final: {computed} valid coastal points, {errors} errors")

    if computed == 0:
        print("ERROR: No valid tide data computed. Exiting.")
        sys.exit(1)

    # =========================================================================
    # Step 3: Write output files
    # =========================================================================
    os.makedirs(args.output_dir, exist_ok=True)

    date_str = now.strftime("%Y-%m")

    # Header JSON
    header = {
        "version": 1,
        "model": "GOT4.10c",
        "computed_at": datetime.datetime.now(datetime.UTC).isoformat(),
        "start_time": now.isoformat(),
        "interval_minutes": args.interval,
        "num_time_points": num_points,
        "num_locations": computed,
        "points": [{"lat": p[1], "lng": p[0]} for p in valid_points],
    }

    header_path = os.path.join(args.output_dir, f"tides-{date_str}-header.json")
    with open(header_path, "w") as f:
        json.dump(header, f, separators=(",", ":"))

    header_size = os.path.getsize(header_path)
    print(f"\n  Header: {header_path} ({header_size / 1024:.0f} KB)")

    # Binary data: concatenate all Int16 arrays
    bin_path = os.path.join(args.output_dir, f"tides-{date_str}.bin")
    with open(bin_path, "wb") as f:
        for heights_cm in all_heights:
            f.write(heights_cm.tobytes())

    bin_size = os.path.getsize(bin_path)
    print(f"  Binary: {bin_path} ({bin_size / (1024 * 1024):.1f} MB)")
    print(f"  Expected: {computed} × {num_points} × 2 bytes = {computed * num_points * 2 / (1024 * 1024):.1f} MB")

    # =========================================================================
    # Step 4: Upload to Supabase Storage (optional)
    # =========================================================================
    if args.upload:
        service_key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not service_key:
            print("\nError: SUPABASE_SERVICE_KEY required for --upload")
            sys.exit(1)

        from supabase import create_client

        supabase = create_client(
            os.environ.get("SUPABASE_URL", os.environ.get(
                "NEXT_PUBLIC_SUPABASE_URL",
                "https://azxmuhckfajyqmwadote.supabase.co"
            )),
            service_key,
        )

        bucket = "forecasts"

        for local_path, remote_name in [
            (header_path, f"tides-{date_str}-header.json"),
            (bin_path, f"tides-{date_str}.bin"),
        ]:
            print(f"\n  Uploading {remote_name}...")
            with open(local_path, "rb") as f:
                content_type = "application/json" if remote_name.endswith(".json") else "application/octet-stream"
                try:
                    supabase.storage.from_(bucket).upload(
                        remote_name, f.read(),
                        file_options={"content-type": content_type, "upsert": "true"}
                    )
                    print(f"  ✓ Uploaded {remote_name}")
                except Exception as e:
                    print(f"  ✗ Upload error: {e}")

    # =========================================================================
    # Summary
    # =========================================================================
    print(f"\n=== DONE ===")
    print(f"  Coastal grid points: {computed}")
    print(f"  Time range: {times[0].isoformat()} to {times[-1].isoformat()}")
    print(f"  Points per location: {num_points}")
    print(f"  Binary size: {bin_size / (1024 * 1024):.1f} MB")
    print(f"  Files: {header_path}, {bin_path}")

    # Sample output
    if valid_points:
        p = valid_points[0]
        h = all_heights[0]
        print(f"\n  Sample point: ({p[0]}, {p[1]})")
        print(f"  First 24h (cm): {list(h[:24])}")
        print(f"  Range: {int(h.min())} to {int(h.max())} cm")


if __name__ == "__main__":
    main()
