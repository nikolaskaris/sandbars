#!/usr/bin/env python3
"""
Generate bathymetric contour PMTiles from GEBCO NetCDF data.

Downloads: https://download.gebco.net/
Usage:     python scripts/generate-bathymetric-contours.py path/to/GEBCO.nc
Output:    public/data/bathymetry-contours.pmtiles

Requires: GDAL (gdalwarp, gdal_contour, ogr2ogr) and tippecanoe.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile


# Contour depth tiers: each run generates contours at the specified levels (meters).
# GEBCO uses negative for ocean, so we pass negative -fl values to gdal_contour,
# then store depth as positive in the output properties.
CONTOUR_TIERS = [
    {
        "name": "nearshore_5m",
        "levels": list(range(5, 50, 5)),       # 5, 10, 15, ..., 45
        "min_zoom": 8,
    },
    {
        "name": "shelf_50m",
        "levels": list(range(50, 200, 50)),     # 50, 100, 150
        "min_zoom": 5,
    },
    {
        "name": "slope",
        "levels": [200, 500],
        "min_zoom": 3,
    },
    {
        "name": "deep",
        "levels": [1000, 2000, 3000, 4000, 5000],
        "min_zoom": 2,
    },
]

# Per-depth minimum zoom for tippecanoe filtering
DEPTH_MIN_ZOOM = {
    5: 10, 10: 9, 15: 10, 20: 8, 25: 10, 30: 9, 35: 10, 40: 9, 45: 10,
    50: 6, 100: 5, 150: 6,
    200: 4, 500: 3,
    1000: 2, 2000: 2, 3000: 2, 4000: 2, 5000: 2,
}


def check_command(name: str) -> bool:
    """Check if a command-line tool is available."""
    return shutil.which(name) is not None


def check_dependencies():
    """Verify all required external tools are installed."""
    missing = []

    for tool in ["gdalwarp", "gdal_contour", "ogr2ogr"]:
        if not check_command(tool):
            missing.append(("GDAL", tool))

    if not check_command("tippecanoe"):
        missing.append(("tippecanoe", "tippecanoe"))

    if missing:
        print("ERROR: Missing required tools:\n")
        tools_needed = set(t[0] for t in missing)
        for tool_name, cmd in missing:
            print(f"  - {cmd} ({tool_name})")
        print()
        if "GDAL" in tools_needed:
            print("Install GDAL:")
            print("  macOS:        brew install gdal")
            print("  Ubuntu/Debian: sudo apt-get install gdal-bin")
            print("  Other:        https://gdal.org/en/stable/download.html")
            print()
        if "tippecanoe" in tools_needed:
            print("Install tippecanoe:")
            print("  macOS:        brew install tippecanoe")
            print("  Ubuntu/Debian: sudo apt-get install tippecanoe")
            print("  Other:        https://github.com/felt/tippecanoe")
            print()
        sys.exit(1)

    print("All dependencies found.")


def run(cmd: list[str], desc: str):
    """Run a subprocess command, printing progress and handling errors."""
    print(f"  {desc}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"\nERROR: {desc} failed (exit code {result.returncode})")
        if result.stderr:
            print(f"stderr:\n{result.stderr}")
        sys.exit(1)
    return result


def parse_bbox(bbox_str: str) -> tuple[float, float, float, float]:
    """Parse 'west,south,east,north' string into a tuple."""
    parts = [float(x.strip()) for x in bbox_str.split(",")]
    if len(parts) != 4:
        print(f"ERROR: --bbox must be 'west,south,east,north', got: {bbox_str}")
        sys.exit(1)
    return (parts[0], parts[1], parts[2], parts[3])


def clip_raster(input_file: str, bbox: tuple, temp_dir: str) -> str:
    """Clip input raster to bounding box and output a GeoTIFF."""
    clipped = os.path.join(temp_dir, "clipped.tif")
    west, south, east, north = bbox

    run([
        "gdalwarp",
        "-te", str(west), str(south), str(east), str(north),
        "-overwrite",
        input_file,
        clipped,
    ], f"Clipping raster to bbox [{west},{south},{east},{north}]")

    return clipped


def generate_contours(clipped_tif: str, temp_dir: str) -> list[str]:
    """Generate contour GeoJSON files for each depth tier."""
    geojson_files = []

    for tier in CONTOUR_TIERS:
        output = os.path.join(temp_dir, f"contours_{tier['name']}.geojson")

        # GEBCO elevation is negative for ocean. Pass negative levels to
        # gdal_contour so it traces lines at the correct ocean depths.
        negative_levels = [str(v) for v in sorted(-level for level in tier["levels"])]

        run([
            "gdal_contour",
            "-a", "elev",
            "-fl", *negative_levels,
            "-f", "GeoJSON",
            clipped_tif,
            output,
        ], f"Generating {tier['name']} contours ({len(tier['levels'])} levels)")

        geojson_files.append(output)

    return geojson_files


def merge_and_clean(geojson_files: list[str], temp_dir: str) -> str:
    """Merge all contour GeoJSON files, convert elev to positive depth, add minzoom."""
    merged = os.path.join(temp_dir, "merged.geojson")

    all_features = []
    depth_counts: dict[int, int] = {}

    for path in geojson_files:
        with open(path) as f:
            data = json.load(f)

        for feature in data.get("features", []):
            elev = feature.get("properties", {}).get("elev", 0)
            # Convert negative elevation to positive depth
            depth = abs(int(round(elev)))
            if depth == 0:
                continue  # Skip sea-level contour

            feature["properties"] = {
                "depth": depth,
                "minzoom": DEPTH_MIN_ZOOM.get(depth, 2),
            }
            all_features.append(feature)
            depth_counts[depth] = depth_counts.get(depth, 0) + 1

    merged_geojson = {
        "type": "FeatureCollection",
        "features": all_features,
    }

    with open(merged, "w") as f:
        json.dump(merged_geojson, f)

    print(f"\n  Contour features by depth:")
    for depth in sorted(depth_counts.keys()):
        print(f"    {depth:>5}m: {depth_counts[depth]:>6} features")
    print(f"    {'Total':>5}: {len(all_features):>6} features\n")

    return merged


def simplify_geojson(merged: str, temp_dir: str) -> str:
    """Simplify contour geometry to reduce file size."""
    simplified = os.path.join(temp_dir, "simplified.geojson")

    run([
        "ogr2ogr",
        "-f", "GeoJSON",
        "-simplify", "0.001",
        simplified,
        merged,
    ], "Simplifying contour geometry (tolerance 0.001°)")

    return simplified


def build_pmtiles(geojson: str, output: str):
    """Convert GeoJSON to PMTiles with tippecanoe."""
    # Build the tippecanoe filter: only include a feature if zoom >= its minzoom
    zoom_filter = '{ "*": [">=", "$zoom", ["get", "minzoom"]] }'

    run([
        "tippecanoe",
        "-o", output,
        "--force",
        "-l", "bathymetry",
        "-zg",
        "--minimum-zoom=2",
        "--maximum-zoom=12",
        "-pf",
        "-pk",
        "-j", zoom_filter,
        "--drop-smallest-as-needed",
        geojson,
    ], "Building PMTiles with tippecanoe")


def main():
    parser = argparse.ArgumentParser(
        description="Generate bathymetric contour PMTiles from GEBCO data.",
        epilog="Download GEBCO data from https://download.gebco.net/",
    )
    parser.add_argument(
        "input_file",
        help="Path to GEBCO NetCDF (.nc) or GeoTIFF (.tif) file",
    )
    parser.add_argument(
        "--output",
        default="public/data/bathymetry-contours.pmtiles",
        help="Output PMTiles path (default: public/data/bathymetry-contours.pmtiles)",
    )
    parser.add_argument(
        "--bbox",
        default="-77,33.5,-65,43",
        help="Bounding box as 'west,south,east,north' (default: US East Coast prototype)",
    )
    parser.add_argument(
        "--temp-dir",
        default=None,
        help="Directory for intermediate files (default: auto-cleaned temp dir)",
    )

    args = parser.parse_args()

    # Validate input
    if not os.path.exists(args.input_file):
        print(f"ERROR: Input file not found: {args.input_file}")
        sys.exit(1)

    bbox = parse_bbox(args.bbox)
    print(f"\n=== Bathymetric Contour Generator ===")
    print(f"Input:  {args.input_file}")
    print(f"Output: {args.output}")
    print(f"Bbox:   {args.bbox}\n")

    # Check dependencies
    check_dependencies()

    # Set up temp directory
    if args.temp_dir:
        os.makedirs(args.temp_dir, exist_ok=True)
        temp_dir = args.temp_dir
        cleanup_temp = False
    else:
        temp_dir = tempfile.mkdtemp(prefix="bathymetry_")
        cleanup_temp = True

    try:
        # Step 1: Clip raster
        print("\n[1/5] Clipping raster to bounding box")
        clipped = clip_raster(args.input_file, bbox, temp_dir)

        # Step 2: Generate contours
        print("\n[2/5] Generating contour lines")
        geojson_files = generate_contours(clipped, temp_dir)

        # Step 3: Merge and convert to positive depth
        print("\n[3/5] Merging and cleaning contour data")
        merged = merge_and_clean(geojson_files, temp_dir)

        # Step 4: Simplify geometry
        print("\n[4/5] Simplifying geometry")
        simplified = simplify_geojson(merged, temp_dir)

        # Step 5: Build PMTiles
        print("\n[5/5] Building PMTiles")
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        build_pmtiles(simplified, args.output)

        # Report results
        size_mb = os.path.getsize(args.output) / (1024 * 1024)
        print(f"\n=== Done ===")
        print(f"Output: {args.output} ({size_mb:.1f} MB)")
        print(f"Bbox:   {args.bbox}")
        print(f"\nNext step: Upload to Supabase Storage or serve from public/data/")

    finally:
        if cleanup_temp:
            shutil.rmtree(temp_dir, ignore_errors=True)
            print(f"Cleaned up temp files.")


if __name__ == "__main__":
    main()
