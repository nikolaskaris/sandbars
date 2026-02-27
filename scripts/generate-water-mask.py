#!/usr/bin/env python3
"""
Generate high-resolution water masks from Natural Earth 10m coastline data.

Downloads NE 10m land + minor islands shapefiles, rasterizes at 6x the target
resolution using GDAL, then downsamples with average resampling. This captures
coastal features like barrier islands that would be lost at the output resolution.

Output: Grayscale PNG where water=255 (white), land=0 (black).

Dependencies:
  GDAL (gdal_rasterize, ogr2ogr, gdalwarp, gdal_translate)
  Python: Pillow, numpy, scipy

Usage:
  python3 scripts/generate-water-mask.py --all          # Both 1440x1440 + 720x720
  python3 scripts/generate-water-mask.py                # Just 1440x1440
  python3 scripts/generate-water-mask.py --resolution 2880x2880
"""

import argparse
import os
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion

# Natural Earth 10m data URLs (naciscdn is the official CDN)
NE_LAND_URL = (
    "https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip"
)
NE_MINOR_ISLANDS_URL = (
    "https://naciscdn.org/naturalearth/10m/physical/ne_10m_minor_islands.zip"
)

# Web Mercator full extent (±85.051129° latitude)
MERCATOR_EXTENT = "-20037508.34 -20037508.34 20037508.34 20037508.34"

# Supersample factor: rasterize at Nx resolution then downsample
SUPERSAMPLE = 6


def check_gdal():
    """Verify GDAL command-line tools are installed."""
    for tool in ["gdal_rasterize", "ogr2ogr", "gdalwarp", "gdal_translate"]:
        try:
            subprocess.run(
                [tool, "--version"], capture_output=True, check=True
            )
        except (FileNotFoundError, subprocess.CalledProcessError):
            print(f"Error: {tool} not found. Install with: brew install gdal")
            sys.exit(1)


def download_shapefile(url, cache_dir):
    """Download a zip archive and return the path to the .shp file inside."""
    os.makedirs(cache_dir, exist_ok=True)
    basename = os.path.basename(url)
    zip_path = os.path.join(cache_dir, basename)

    if not os.path.exists(zip_path):
        print(f"  Downloading {basename}...")
        urllib.request.urlretrieve(url, zip_path)
    else:
        print(f"  Using cached {basename}")

    extract_dir = os.path.join(cache_dir, basename.replace(".zip", ""))
    if not os.path.isdir(extract_dir):
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(extract_dir)

    for root, _dirs, files in os.walk(extract_dir):
        for f in files:
            if f.endswith(".shp"):
                return os.path.join(root, f)

    raise FileNotFoundError(f"No .shp found in {extract_dir}")


def run(cmd, desc=None):
    """Run a shell command, exit on failure."""
    if desc:
        print(f"  {desc}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  FAILED: {' '.join(cmd)}")
        if result.stderr:
            print(f"  {result.stderr[:500]}")
        sys.exit(1)


def generate_mask(width, height, cache_dir, erode_pixels=1):
    """Generate a water mask at the given Web Mercator resolution.

    Pipeline:
      1. Download NE 10m land + minor islands shapefiles
      2. Merge shapefiles with ogr2ogr
      3. Reproject merged shapefile to EPSG:3857
      4. Rasterize at SUPERSAMPLEx resolution (land=255, water=0)
      5. Downsample to target resolution with average resampling
      6. Threshold + erode → binary mask
      7. Invert: water=255, land=0

    Returns: numpy uint8 array (H, W)
    """
    print("Step 1/6: Downloading Natural Earth 10m data...")
    land_shp = download_shapefile(NE_LAND_URL, cache_dir)
    islands_shp = download_shapefile(NE_MINOR_ISLANDS_URL, cache_dir)

    ss_w = width * SUPERSAMPLE
    ss_h = height * SUPERSAMPLE
    extent_args = MERCATOR_EXTENT.split()

    with tempfile.TemporaryDirectory() as tmp:
        merged = os.path.join(tmp, "merged.shp")
        mercator = os.path.join(tmp, "merged_3857.shp")
        hires_tif = os.path.join(tmp, "land_hires.tif")
        target_tif = os.path.join(tmp, "land_target.tif")

        # Merge
        print("Step 2/6: Merging land + minor islands...")
        run(["ogr2ogr", merged, land_shp])
        run(["ogr2ogr", "-append", "-nln", "merged", merged, islands_shp])

        # Reproject to Web Mercator
        print("Step 3/6: Reprojecting to EPSG:3857...")
        run(["ogr2ogr", "-t_srs", "EPSG:3857", mercator, merged])

        # Rasterize at high resolution (land=255 so average downsampling works)
        print(f"Step 4/6: Rasterizing at {ss_w}x{ss_h}...")
        run([
            "gdal_rasterize",
            "-burn", "255",
            "-init", "0",
            "-ot", "Byte",
            "-ts", str(ss_w), str(ss_h),
            "-te", *extent_args,
            "-a_srs", "EPSG:3857",
            mercator,
            hires_tif,
        ])

        # Downsample with average resampling (produces graduated values 0-255)
        print(f"Step 5/6: Downsampling to {width}x{height} (average)...")
        run([
            "gdalwarp",
            "-ts", str(width), str(height),
            "-r", "average",
            "-overwrite",
            hires_tif,
            target_tif,
        ])

        # Load the downsampled raster
        land_arr = np.array(Image.open(target_tif))

        # Threshold: pixels with >50% land coverage → land
        print("Step 6/6: Thresholding + erosion...")
        land_binary = land_arr > 128

        # Erode land slightly so forecast data extends under the vector coastline
        if erode_pixels > 0:
            land_binary = binary_erosion(land_binary, iterations=erode_pixels)
            print(f"  Eroded land by {erode_pixels}px")

        # Invert: water=255, land=0
        mask = np.where(land_binary, 0, 255).astype(np.uint8)

        water_pct = (mask == 255).sum() / mask.size * 100
        land_pct = (mask == 0).sum() / mask.size * 100
        print(f"  Water: {water_pct:.1f}%  Land: {land_pct:.1f}%")

        return mask


def compare_masks(old_path, new_mask):
    """Print a comparison between old and new masks."""
    if not os.path.exists(old_path):
        return

    old = np.array(Image.open(old_path))

    # Resize if dimensions differ
    if old.shape != new_mask.shape:
        old = np.array(
            Image.open(old_path).resize(
                (new_mask.shape[1], new_mask.shape[0]), Image.LANCZOS
            )
        )

    old_water = old > 128
    new_water = new_mask > 128

    newly_land = np.sum(old_water & ~new_water)
    newly_water = np.sum(~old_water & new_water)

    print(f"\n  Comparison with {os.path.basename(old_path)}:")
    print(f"    Reclassified water → land: {newly_land:,} pixels")
    print(f"    Reclassified land → water: {newly_water:,} pixels")
    print(f"    Total changed: {newly_land + newly_water:,} pixels")


def main():
    parser = argparse.ArgumentParser(
        description="Generate water masks from Natural Earth 10m data"
    )
    parser.add_argument(
        "--resolution", default="1440x1440",
        help="Output WIDTHxHEIGHT (default: 1440x1440)",
    )
    parser.add_argument("--output", help="Output path")
    parser.add_argument(
        "--erode", type=int, default=1,
        help="Erode land by N pixels (default: 1)",
    )
    parser.add_argument(
        "--cache-dir", help="Cache dir for downloaded shapefiles",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Generate both 1440x1440 and 720x720 masks",
    )
    args = parser.parse_args()

    check_gdal()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = args.cache_dir or os.path.join(
        script_dir, "data", "natural-earth"
    )

    resolutions = (
        [(1440, 1440), (720, 720)] if args.all
        else [tuple(map(int, args.resolution.split("x")))]
    )

    for w, h in resolutions:
        out = (
            args.output if not args.all
            else None
        ) or os.path.join(script_dir, f"water_mask_{w}x{h}.png")

        print(f"\n{'=' * 50}")
        print(f"Generating {w}x{h} water mask")
        print(f"  Supersample: {SUPERSAMPLE}x → {w * SUPERSAMPLE}x{h * SUPERSAMPLE}")
        print(f"  Erosion: {args.erode}px")
        print(f"{'=' * 50}")

        mask = generate_mask(w, h, cache_dir, args.erode)

        # Compare with existing mask before overwriting
        compare_masks(out, mask)

        Image.fromarray(mask, "L").save(out, "PNG", optimize=True)
        size_kb = os.path.getsize(out) / 1024
        print(f"\n  Saved: {out} ({size_kb:.0f} KB)")

    print("\nDone!")


if __name__ == "__main__":
    main()
