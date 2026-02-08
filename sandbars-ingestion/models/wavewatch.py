"""
WAVEWATCH III Data Ingestion via ERDDAP

Fetches global wave model data from the University of Hawaii PacIOOS ERDDAP server.
"""
import requests
from datetime import datetime, timezone
from typing import Dict, List, Optional
from storage.supabase_client import SupabaseStorage
from config import WW3_ERDDAP_URL, GLOBAL_BOUNDS


def fetch_erddap_region(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    stride: int = 4
) -> List[Dict]:
    """Fetch wave data from ERDDAP for a specific region."""
    # Build ERDDAP query URL
    # Format: variable[(time)][(depth)][(lat_start):stride:(lat_end)][(lon_start):stride:(lon_end)]
    url = (
        f"{WW3_ERDDAP_URL}.json?"
        f"Thgt[(last)][(0.0)][({min_lat}):{stride}:({max_lat})][({min_lon}):{stride}:({max_lon})],"
        f"Tdir[(last)][(0.0)][({min_lat}):{stride}:({max_lat})][({min_lon}):{stride}:({max_lon})],"
        f"Tper[(last)][(0.0)][({min_lat}):{stride}:({max_lat})][({min_lon}):{stride}:({max_lon})]"
    )

    print(f"Fetching ERDDAP data for region: lat {min_lat}-{max_lat}, lon {min_lon}-{max_lon}")

    response = requests.get(
        url,
        headers={'Accept': 'application/json'},
        timeout=120
    )

    if not response.ok:
        raise Exception(f"ERDDAP request failed: {response.status_code} {response.text}")

    data = response.json()
    points = []

    # Parse ERDDAP response
    # Format: { table: { columnNames: [...], rows: [[time, depth, lat, lon, Thgt], ...] } }
    if not data.get('table', {}).get('rows'):
        print('No data in ERDDAP response')
        return []

    column_names = data['table']['columnNames']
    rows = data['table']['rows']

    time_idx = column_names.index('time')
    lat_idx = column_names.index('latitude')
    lon_idx = column_names.index('longitude')
    hgt_idx = column_names.index('Thgt')
    dir_idx = column_names.index('Tdir')
    per_idx = column_names.index('Tper')

    for row in rows:
        wave_height = row[hgt_idx]

        # Skip NaN values (land areas)
        if wave_height is None or (isinstance(wave_height, float) and wave_height != wave_height):  # NaN check
            continue

        lon = row[lon_idx]
        # Convert ERDDAP longitude (0-360) to standard (-180 to 180)
        if lon > 180:
            lon = lon - 360

        wave_direction = row[dir_idx]
        wave_period = row[per_idx]

        points.append({
            'lat': row[lat_idx],
            'lon': lon,
            'waveHeight': round(wave_height, 2) if wave_height else None,
            'waveDirection': round(wave_direction) if wave_direction and wave_direction == wave_direction else None,
            'wavePeriod': round(wave_period, 1) if wave_period and wave_period == wave_period else None,
            'timestamp': row[time_idx],
        })

    return points


def fetch_global_wavewatch(bounds: Optional[Dict] = None) -> List[Dict]:
    """Fetch global WAVEWATCH III data from ERDDAP."""
    bounds = bounds or GLOBAL_BOUNDS
    min_lat = bounds['minLat']
    max_lat = bounds['maxLat']
    min_lon = bounds['minLon']
    max_lon = bounds['maxLon']

    # ERDDAP uses 0-360 longitude, we need to handle the date line
    # For global coverage spanning the date line, fetch in two parts
    all_points = []

    try:
        if min_lon < 0 and max_lon > 0:
            # Part 1: Western hemisphere (180-360 in ERDDAP coords)
            west_points = fetch_erddap_region(
                min_lat, max_lat,
                180 + min_lon, 359.5,  # -180 to 0 maps to 180-360
                stride=4
            )
            all_points.extend(west_points)

            # Part 2: Eastern hemisphere (0-180 in ERDDAP coords)
            east_points = fetch_erddap_region(
                min_lat, max_lat,
                0, max_lon,
                stride=4
            )
            all_points.extend(east_points)
        else:
            # Single region, convert longitude
            erddap_min_lon = min_lon if min_lon >= 0 else min_lon + 360
            erddap_max_lon = max_lon if max_lon >= 0 else max_lon + 360
            all_points = fetch_erddap_region(
                min_lat, max_lat,
                erddap_min_lon, erddap_max_lon,
                stride=4
            )

    except Exception as e:
        print(f"Error fetching from ERDDAP: {e}")
        return []

    print(f"Fetched {len(all_points)} wave grid points from ERDDAP")
    return all_points


def ingest_wavewatch():
    """Main WAVEWATCH III ingestion function."""
    storage = SupabaseStorage()
    run_time = datetime.now(timezone.utc)
    run_str = run_time.strftime("%Y%m%d%H")

    print(f"Ingesting WAVEWATCH III data: {run_str}")

    # Fetch global data
    points = fetch_global_wavewatch()

    if not points:
        print("No data fetched, aborting")
        return 0

    # Store in database
    print(f"Upserting {len(points)} points to wave_grid...")
    storage.upsert_wave_grid(points, source='wavewatch3_erddap', model_run=run_time)

    # Record forecast run
    storage.insert_forecast_run(
        model='wavewatch3_erddap',
        run_time=run_time,
        forecast_hours=[0],  # Current conditions only from ERDDAP
        point_count=len(points),
        metadata={
            'source': 'PacIOOS ERDDAP',
            'url': WW3_ERDDAP_URL,
            'bounds': GLOBAL_BOUNDS
        }
    )

    # Update latest.json
    storage.update_latest('wavewatch', run_str, [0])

    print(f"WAVEWATCH III ingestion complete: {len(points)} points")
    return len(points)


if __name__ == '__main__':
    ingest_wavewatch()
