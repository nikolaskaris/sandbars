#!/usr/bin/env python3
"""
Fetch real-time buoy observations from NDBC and output as GeoJSON.

Fetches active station list and latest observations, then combines
them into a GeoJSON file for map visualization.

Input:  NDBC active stations XML + latest observations TXT
Output: public/data/buoy-observations.geojson
"""

import json
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Configuration
STATIONS_URL = "https://www.ndbc.noaa.gov/activestations.xml"
OBSERVATIONS_URL = "https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt"
OUTPUT_DIR = "public/data"
OUTPUT_FILE = "buoy-observations.geojson"

# Retry configuration
MAX_RETRIES = 3
BACKOFF_FACTOR = 1.0  # 1s, 2s, 4s between retries
RETRY_STATUS_CODES = [500, 502, 503, 504]

# Valid ranges for marine weather observations
# Values outside these ranges are likely erroneous
VALID_RANGES = {
    'wave_height': (0, 30),       # meters (max recorded ~30m)
    'dominant_period': (1, 30),   # seconds
    'average_period': (1, 30),    # seconds
    'wave_direction': (0, 360),   # degrees
    'wind_speed': (0, 100),       # m/s (hurricane ~70 m/s)
    'wind_direction': (0, 360),   # degrees
    'wind_gust': (0, 150),        # m/s
    'water_temp': (-5, 40),       # Celsius
    'air_temp': (-60, 60),        # Celsius
    'pressure': (850, 1100),      # hPa
}


def create_session_with_retry():
    """Create a requests session with exponential backoff retry logic."""
    session = requests.Session()

    retry_strategy = Retry(
        total=MAX_RETRIES,
        backoff_factor=BACKOFF_FACTOR,
        status_forcelist=RETRY_STATUS_CODES,
        allowed_methods=["GET"],
    )

    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)

    return session


def fetch_active_stations(session):
    """Fetch and parse active stations from NDBC XML."""
    print("Fetching active stations...")
    response = session.get(STATIONS_URL, timeout=30)
    response.raise_for_status()

    root = ET.fromstring(response.content)
    stations = {}

    for station in root.findall('.//station'):
        station_id = station.get('id')
        if not station_id:
            continue

        lat = station.get('lat')
        lon = station.get('lon')
        name = station.get('name', '')
        owner = station.get('owner', '')
        station_type = station.get('type', '')

        # Skip stations without coordinates
        if not lat or not lon:
            continue

        try:
            stations[station_id] = {
                'id': station_id,
                'lat': float(lat),
                'lon': float(lon),
                'name': name,
                'owner': owner,
                'type': station_type,
            }
        except ValueError:
            continue

    print(f"  Found {len(stations)} active stations with coordinates")
    return stations


def parse_float(value):
    """Parse a float value, returning None for missing data (MM)."""
    if value is None or value == 'MM' or value == '':
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_int(value):
    """Parse an int value, returning None for missing data (MM)."""
    if value is None or value == 'MM' or value == '':
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def validate_value(value, field_name):
    """Validate a value is within expected range for the field. Returns None if invalid."""
    if value is None:
        return None

    valid_range = VALID_RANGES.get(field_name)
    if valid_range is None:
        return value  # No validation defined for this field

    min_val, max_val = valid_range
    if min_val <= value <= max_val:
        return value

    # Value out of range - likely erroneous data
    return None


def fetch_latest_observations(session):
    """Fetch and parse latest observations from NDBC."""
    print("Fetching latest observations...")
    response = session.get(OBSERVATIONS_URL, timeout=30)
    response.raise_for_status()

    lines = response.text.strip().split('\n')

    # Parse header to get column indices
    # Format: #STN     LAT      LON  YYYY MM DD hh mm  WDIR WSPD  GST  WVHT   DPD   APD  MWD  PRES  ATMP  WTMP  DEWP  VIS  TIDE
    header_line = None
    data_start = 0

    for i, line in enumerate(lines):
        if line.startswith('#STN'):
            header_line = line
            data_start = i + 1
            break

    if not header_line:
        print("  WARNING: Could not find header line")
        return {}

    # Parse header - handle variable whitespace
    headers = header_line.replace('#', '').split()

    observations = {}

    for line in lines[data_start:]:
        if not line.strip() or line.startswith('#'):
            continue

        parts = line.split()
        if len(parts) < len(headers):
            continue

        # Create dict from header/value pairs
        row = dict(zip(headers, parts))

        station_id = row.get('STN')
        if not station_id:
            continue

        # Extract and validate observation data
        obs = {
            'wave_height': validate_value(parse_float(row.get('WVHT')), 'wave_height'),
            'dominant_period': validate_value(parse_float(row.get('DPD')), 'dominant_period'),
            'average_period': validate_value(parse_float(row.get('APD')), 'average_period'),
            'wave_direction': validate_value(parse_int(row.get('MWD')), 'wave_direction'),
            'wind_speed': validate_value(parse_float(row.get('WSPD')), 'wind_speed'),
            'wind_direction': validate_value(parse_int(row.get('WDIR')), 'wind_direction'),
            'wind_gust': validate_value(parse_float(row.get('GST')), 'wind_gust'),
            'water_temp': validate_value(parse_float(row.get('WTMP')), 'water_temp'),
            'air_temp': validate_value(parse_float(row.get('ATMP')), 'air_temp'),
            'pressure': validate_value(parse_float(row.get('PRES')), 'pressure'),
        }

        # Build timestamp from date/time fields
        try:
            year = row.get('YYYY')
            month = row.get('MM')
            day = row.get('DD')
            hour = row.get('hh')
            minute = row.get('mm')

            if year and month and day and hour and minute:
                obs['observation_time'] = f"{year}-{month}-{day}T{hour}:{minute}:00Z"
        except (ValueError, KeyError):
            pass

        observations[station_id] = obs

    print(f"  Found {len(observations)} stations with observations")
    return observations


def build_geojson(stations, observations):
    """Build GeoJSON from stations and observations.

    Only includes stations that have at least one observation field with data.
    This reduces file size by ~75% and improves map performance.
    """
    features = []
    skipped_empty = 0

    for station_id, station in stations.items():
        obs = observations.get(station_id, {})

        # Only include stations with at least one observation value
        has_data = any(v is not None for k, v in obs.items() if k != 'observation_time')
        if not has_data:
            skipped_empty += 1
            continue

        properties = {
            'station_id': station_id,
            'name': station['name'],
            'owner': station['owner'],
            'type': station['type'],
            'wave_height': obs.get('wave_height'),
            'dominant_period': obs.get('dominant_period'),
            'average_period': obs.get('average_period'),
            'wave_direction': obs.get('wave_direction'),
            'wind_speed': obs.get('wind_speed'),
            'wind_direction': obs.get('wind_direction'),
            'wind_gust': obs.get('wind_gust'),
            'water_temp': obs.get('water_temp'),
            'air_temp': obs.get('air_temp'),
            'pressure': obs.get('pressure'),
            'observation_time': obs.get('observation_time'),
        }

        feature = {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [station['lon'], station['lat']]
            },
            'properties': properties
        }

        features.append(feature)

    print(f"  Included {len(features)} stations with data, skipped {skipped_empty} empty stations")

    geojson = {
        'type': 'FeatureCollection',
        'metadata': {
            'source': 'NDBC',
            'fetched_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'station_count': len(features),
            'total_stations': len(stations),
        },
        'features': features
    }

    return geojson


def main():
    # Change to project directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    os.chdir(project_dir)

    print("=" * 50)
    print("NDBC Buoy Data Fetcher")
    print("=" * 50)

    # Create session with retry logic
    session = create_session_with_retry()

    # Fetch data (with automatic retries on transient failures)
    stations = fetch_active_stations(session)
    observations = fetch_latest_observations(session)

    # Build GeoJSON
    print("Building GeoJSON...")
    geojson = build_geojson(stations, observations)

    # Write output
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    output_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)

    with open(output_path, 'w') as f:
        json.dump(geojson, f)

    # Get file size
    size_kb = os.path.getsize(output_path) / 1024

    print("")
    print("=" * 50)
    print("Complete!")
    print("=" * 50)
    print(f"Output:       {output_path}")
    print(f"File size:    {size_kb:.1f} KB")
    print(f"With data:    {geojson['metadata']['station_count']} stations")
    print(f"Total known:  {geojson['metadata']['total_stations']} stations")
    print("=" * 50)


if __name__ == "__main__":
    main()
