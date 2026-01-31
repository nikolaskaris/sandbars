#!/bin/bash
#
# Download WaveWatch III GRIB2 files for 16-day forecast window.
#
# Usage:
#   ./scripts/download-grib-files.sh              # Auto-detect latest run
#   ./scripts/download-grib-files.sh 20260130 12  # Specific date and cycle
#   ./scripts/download-grib-files.sh --force      # Re-download existing files
#

set -e

# Configuration
FORECAST_HOURS="000 024 048 072 096 120 144 168 192 216 240 264 288 312 336 360 384"
BASE_URL="https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
OUTPUT_DIR="data/grib"
CYCLES="00 06 12 18"

# Parse arguments
FORCE=false
MANUAL_DATE=""
MANUAL_CYCLE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE=true
            shift
            ;;
        *)
            if [[ -z "$MANUAL_DATE" ]]; then
                MANUAL_DATE="$1"
            elif [[ -z "$MANUAL_CYCLE" ]]; then
                MANUAL_CYCLE="$1"
            fi
            shift
            ;;
    esac
done

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to check if a URL exists
url_exists() {
    local url="$1"
    local status=$(curl -s -o /dev/null -w "%{http_code}" --head "$url" 2>/dev/null)
    [[ "$status" == "200" ]]
}

# Function to find the latest available model run
find_latest_run() {
    echo "Searching for latest available model run..." >&2

    # Get current UTC time
    local now_utc=$(date -u +%s)

    # Check runs from most recent going back 48 hours
    for hours_ago in 0 6 12 18 24 30 36 42 48; do
        local check_time=$((now_utc - hours_ago * 3600))
        local check_date=$(date -u -r $check_time +%Y%m%d 2>/dev/null || date -u -d "@$check_time" +%Y%m%d)
        local check_hour=$(date -u -r $check_time +%H 2>/dev/null || date -u -d "@$check_time" +%H)

        # Round down to nearest cycle (00, 06, 12, 18)
        local cycle=$(printf "%02d" $((check_hour / 6 * 6)))

        # Data is available ~4 hours after run time, so check if we're past that
        local run_time_utc=$(date -u -r $check_time +%Y%m%d 2>/dev/null || date -u -d "@$check_time" +%Y%m%d)

        # Build test URL for f000 file
        local test_url="${BASE_URL}/gfs.${check_date}/${cycle}/wave/gridded/gfswave.t${cycle}z.global.0p25.f000.grib2"

        if url_exists "$test_url"; then
            echo "$check_date $cycle"
            return 0
        fi
    done

    echo "ERROR: Could not find any available model run in the last 48 hours" >&2
    return 1
}

# Determine which run to download
if [[ -n "$MANUAL_DATE" && -n "$MANUAL_CYCLE" ]]; then
    RUN_DATE="$MANUAL_DATE"
    RUN_CYCLE="$MANUAL_CYCLE"
    echo "Using manual run: ${RUN_DATE} ${RUN_CYCLE}z"
else
    read RUN_DATE RUN_CYCLE < <(find_latest_run)
    if [[ -z "$RUN_DATE" ]]; then
        exit 1
    fi
    echo "Found latest run: ${RUN_DATE} ${RUN_CYCLE}z"
fi

# Verify the run exists
TEST_URL="${BASE_URL}/gfs.${RUN_DATE}/${RUN_CYCLE}/wave/gridded/gfswave.t${RUN_CYCLE}z.global.0p25.f000.grib2"
if ! url_exists "$TEST_URL"; then
    echo "ERROR: Run ${RUN_DATE} ${RUN_CYCLE}z not available at NOMADS"
    echo "URL checked: $TEST_URL"
    exit 1
fi

echo ""
echo "========================================"
echo "Downloading WaveWatch III Forecast"
echo "========================================"
echo "Run:    ${RUN_DATE} ${RUN_CYCLE}z"
echo "Output: ${OUTPUT_DIR}/"
echo "Files:  17 forecast hours (f000-f384)"
echo "========================================"
echo ""

# Count files to download
TOTAL_FILES=17
CURRENT=0
DOWNLOADED=0
SKIPPED=0
FAILED=0
TOTAL_SIZE=0

# Download each forecast hour
for HOUR in $FORECAST_HOURS; do
    CURRENT=$((CURRENT + 1))
    FILENAME="gfswave.t${RUN_CYCLE}z.global.0p25.f${HOUR}.grib2"
    FILEPATH="${OUTPUT_DIR}/${FILENAME}"
    URL="${BASE_URL}/gfs.${RUN_DATE}/${RUN_CYCLE}/wave/gridded/${FILENAME}"

    printf "[%2d/%d] %s ... " "$CURRENT" "$TOTAL_FILES" "$FILENAME"

    # Check if file exists
    if [[ -f "$FILEPATH" && "$FORCE" != "true" ]]; then
        SIZE=$(ls -lh "$FILEPATH" | awk '{print $5}')
        echo "exists (${SIZE}), skipping"
        SKIPPED=$((SKIPPED + 1))
        TOTAL_SIZE=$((TOTAL_SIZE + $(stat -f%z "$FILEPATH" 2>/dev/null || stat -c%s "$FILEPATH")))
        continue
    fi

    # Download with retry
    SUCCESS=false
    for ATTEMPT in 1 2; do
        if curl -s -f -o "$FILEPATH" "$URL"; then
            SUCCESS=true
            break
        else
            if [[ $ATTEMPT -eq 1 ]]; then
                echo -n "retry... "
                sleep 2
            fi
        fi
    done

    if $SUCCESS; then
        SIZE=$(ls -lh "$FILEPATH" | awk '{print $5}')
        BYTES=$(stat -f%z "$FILEPATH" 2>/dev/null || stat -c%s "$FILEPATH")
        TOTAL_SIZE=$((TOTAL_SIZE + BYTES))
        echo "done (${SIZE})"
        DOWNLOADED=$((DOWNLOADED + 1))
    else
        echo "FAILED"
        FAILED=$((FAILED + 1))
        rm -f "$FILEPATH"  # Remove partial file
    fi
done

# Calculate total size in MB
TOTAL_MB=$((TOTAL_SIZE / 1024 / 1024))

echo ""
echo "========================================"
echo "Download Summary"
echo "========================================"
echo "Downloaded: $DOWNLOADED files"
echo "Skipped:    $SKIPPED files (already existed)"
echo "Failed:     $FAILED files"
echo "Total size: ${TOTAL_MB} MB"
echo "========================================"

# List all files
echo ""
echo "Files in ${OUTPUT_DIR}/:"
ls -lh "$OUTPUT_DIR"/*.grib2 2>/dev/null || echo "(no files)"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi
