"""
NDBC Buoy Data Ingestion

Fetches real-time observations from NOAA's National Data Buoy Center.
"""
import requests
from datetime import datetime, timezone
from typing import Dict, Optional, List
from storage.supabase_client import SupabaseStorage
from config import NDBC_REALTIME_URL

# Priority NDBC stations for initial ingestion
# These are major offshore buoys with good data coverage
PRIORITY_STATIONS = [
    # West Coast
    ('46026', 'San Francisco', 37.759, -122.833),
    ('46042', 'Monterey', 36.785, -122.398),
    ('46011', 'Santa Maria', 34.868, -120.857),
    ('46025', 'Santa Monica Basin', 33.749, -119.053),
    ('46086', 'San Clemente Basin', 32.491, -118.034),
    ('46047', 'Tanner Banks', 32.433, -119.533),
    ('46053', 'E. Santa Barbara', 34.252, -119.841),
    ('46054', 'W. Santa Barbara', 34.274, -120.459),
    ('46069', 'S. Santa Rosa Island', 33.674, -120.212),

    # Pacific Northwest
    ('46041', 'Cape Elizabeth', 47.353, -124.731),
    ('46029', 'Columbia River Bar', 46.144, -124.510),
    ('46050', 'Stonewall Banks', 44.641, -124.500),

    # Hawaii
    ('51000', 'Hawaii', 23.538, -153.913),
    ('51001', 'NW Hawaii', 24.321, -162.058),
    ('51002', 'SW Hawaii', 17.190, -157.808),
    ('51003', 'E Hawaii', 19.228, -160.662),
    ('51004', 'SE Hawaii', 17.445, -152.382),

    # East Coast
    ('41002', 'South Hatteras', 31.759, -74.936),
    ('41004', 'EDISTO', 32.501, -79.099),
    ('41008', 'Grays Reef', 31.402, -80.869),
    ('41013', 'Frying Pan Shoals', 33.436, -77.743),
    ('41025', 'Diamond Shoals', 35.006, -75.402),
    ('41048', 'W. Bermuda', 31.838, -69.590),
    ('44025', 'Long Island', 40.251, -73.164),
    ('44013', 'Boston', 42.346, -70.651),
    ('44027', 'Jonesport', 44.283, -67.307),

    # Gulf of Mexico
    ('42001', 'Mid Gulf', 25.888, -89.658),
    ('42002', 'W. Gulf', 25.790, -93.666),
    ('42003', 'E. Gulf', 25.925, -85.612),
    ('42019', 'Freeport', 27.913, -95.360),
    ('42020', 'Corpus Christi', 26.968, -96.694),
    ('42035', 'Galveston', 29.232, -94.413),
    ('42036', 'W. Tampa', 28.500, -84.517),
]


def parse_ndbc_realtime(station_id: str) -> Optional[Dict]:
    """Fetch and parse real-time data for a single NDBC station."""
    url = f"{NDBC_REALTIME_URL}/{station_id}.txt"

    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()

        lines = resp.text.strip().split('\n')
        if len(lines) < 3:
            return None

        # Parse header and latest observation
        # Format: #YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP  WTMP  DEWP  VIS PTDY  TIDE
        header = lines[0].replace('#', '').split()
        data = lines[2].split()

        # Create dict from header and data
        obs = dict(zip(header, data))

        # Parse timestamp
        try:
            year = int(obs.get('YY', obs.get('YYYY', 0)))
            if year < 100:
                year += 2000
            observed_at = datetime(
                year,
                int(obs['MM']),
                int(obs['DD']),
                int(obs['hh']),
                int(obs['mm']),
                tzinfo=timezone.utc
            )
        except (KeyError, ValueError):
            return None

        def safe_float(key: str) -> Optional[float]:
            val = obs.get(key)
            if val is None or val == 'MM' or val == 'N/A':
                return None
            try:
                return float(val)
            except ValueError:
                return None

        return {
            'ndbc_id': station_id,
            'observed_at': observed_at.isoformat(),
            'wind_speed': safe_float('WSPD'),
            'wind_direction': int(safe_float('WDIR') or 0) if safe_float('WDIR') else None,
            'wind_gust': safe_float('GST'),
            'wave_height': safe_float('WVHT'),
            'dominant_wave_period': safe_float('DPD'),
            'average_wave_period': safe_float('APD'),
            'wave_direction': int(safe_float('MWD') or 0) if safe_float('MWD') else None,
            'water_temp': safe_float('WTMP'),
            'air_temp': safe_float('ATMP'),
            'pressure': safe_float('PRES'),
        }

    except Exception as e:
        print(f"Failed to fetch {station_id}: {e}")
        return None


def ingest_ndbc(stations: Optional[List[tuple]] = None):
    """Ingest latest NDBC buoy observations."""
    storage = SupabaseStorage()
    stations_to_fetch = stations or PRIORITY_STATIONS

    success_count = 0
    fail_count = 0

    for station_info in stations_to_fetch:
        station_id = station_info[0]
        name = station_info[1]
        lat = station_info[2]
        lon = station_info[3]

        print(f"Fetching {station_id} ({name})...")

        # Ensure station exists in database
        try:
            storage.upsert_buoy_station(
                station_id=station_id,
                name=name,
                lat=lat,
                lon=lon,
                station_type='buoy',
                owner='ndbc',
                has_waves=True,
                has_wind=True,
                has_water_temp=True
            )
        except Exception as e:
            print(f"  Failed to upsert station: {e}")

        # Fetch and store observation
        obs = parse_ndbc_realtime(station_id)
        if obs:
            try:
                storage.insert_buoy_reading(obs)
                print(f"  Updated {station_id}")
                success_count += 1
            except Exception as e:
                print(f"  Failed to insert reading: {e}")
                fail_count += 1
        else:
            fail_count += 1

    print(f"\nNDBC ingestion complete: {success_count} success, {fail_count} failed")
    return success_count, fail_count


if __name__ == '__main__':
    ingest_ndbc()
