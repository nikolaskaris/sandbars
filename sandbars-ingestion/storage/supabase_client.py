"""
Supabase storage client for weather data ingestion
"""
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY


class SupabaseStorage:
    """Client for interacting with Supabase storage and database."""

    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        self.bucket = 'weather'

    def upload_json(self, path: str, data: Dict) -> bool:
        """Upload JSON data to storage."""
        try:
            content = json.dumps(data).encode('utf-8')
            self.client.storage.from_(self.bucket).upload(
                path,
                content,
                file_options={"content-type": "application/json", "upsert": "true"}
            )
            return True
        except Exception as e:
            print(f"Upload failed for {path}: {e}")
            return False

    def download_json(self, path: str) -> Optional[Dict]:
        """Download JSON from storage."""
        try:
            response = self.client.storage.from_(self.bucket).download(path)
            return json.loads(response)
        except Exception:
            return None

    def update_latest(self, model: str, run_str: str, forecast_hours: List[int]):
        """Update latest.json with new run info."""
        latest = self.download_json('meta/latest.json') or {}
        latest[model] = {
            'run': run_str,
            'forecast_hours': forecast_hours,
            'updated_at': datetime.utcnow().isoformat()
        }
        self.upload_json('meta/latest.json', latest)

    def insert_forecast_run(
        self,
        model: str,
        run_time: datetime,
        forecast_hours: List[int],
        point_count: int = 0,
        metadata: Optional[Dict] = None
    ):
        """Record forecast run in database."""
        self.client.table('forecast_runs').upsert({
            'model': model,
            'run_time': run_time.isoformat(),
            'forecast_hours': forecast_hours,
            'point_count': point_count,
            'status': 'complete',
            'metadata': metadata or {}
        }).execute()

    def upsert_wave_grid(self, points: List[Dict[str, Any]], source: str, model_run: datetime):
        """Upsert wave grid data to database."""
        if not points:
            return

        # Prepare data for upsert
        rows = []
        for point in points:
            rows.append({
                'lat': round(point['lat'], 2),
                'lon': round(point['lon'], 2),
                'wave_height': point.get('waveHeight'),
                'wave_direction': point.get('waveDirection'),
                'wave_period': point.get('wavePeriod'),
                'source': source,
                'model_run': model_run.isoformat(),
                'computed_at': datetime.utcnow().isoformat()
            })

        # Upsert in batches
        batch_size = 1000
        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            try:
                self.client.table('wave_grid').upsert(batch).execute()
            except Exception as e:
                print(f"Failed to upsert wave grid batch {i}: {e}")

    def upsert_buoy_station(
        self,
        station_id: str,
        name: str,
        lat: float,
        lon: float,
        station_type: str = 'buoy',
        owner: str = 'ndbc',
        has_waves: bool = False,
        has_wind: bool = False,
        has_water_temp: bool = False
    ):
        """Upsert buoy station metadata."""
        self.client.table('stations').upsert({
            'station_id': station_id,
            'ndbc_id': station_id,
            'name': name,
            'latitude': lat,
            'longitude': lon,
            'type': station_type,
            'owner': owner,
            'has_waves': has_waves,
            'has_wind': has_wind,
            'has_water_temp': has_water_temp,
            'active': True
        }).execute()

    def insert_buoy_reading(self, reading: Dict[str, Any]):
        """Insert buoy observation."""
        try:
            self.client.table('buoy_readings').upsert(
                reading,
                on_conflict='ndbc_id,observed_at'
            ).execute()
        except Exception as e:
            print(f"Failed to insert buoy reading: {e}")
