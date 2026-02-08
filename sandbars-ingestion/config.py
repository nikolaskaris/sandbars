"""
Sandbars Ingestion Pipeline Configuration
"""
import os
from datetime import timedelta

# Supabase
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')  # Service role key for writes

# GFS Configuration
GFS_BASE_URL = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
GFS_FORECAST_HOURS = list(range(0, 120, 3)) + list(range(120, 241, 6))  # 0-120 by 3h, 120-240 by 6h
GFS_DELAY = timedelta(hours=4)  # GFS available ~3.5h after run time

# WaveWatch III Configuration
WW3_ERDDAP_URL = "https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global"
WW3_FORECAST_HOURS = list(range(0, 180, 3))

# NDBC Configuration
NDBC_REALTIME_URL = "https://www.ndbc.noaa.gov/data/realtime2"
NDBC_STATIONS_URL = "https://www.ndbc.noaa.gov/activestations.xml"

# Storage paths
WIND_PATH_TEMPLATE = "wind/gfs_{run}_f{fh:03d}_{component}.json"
WAVE_PATH_TEMPLATE = "waves/ww3_{run}_f{fh:03d}.json"
META_PATH = "meta/latest.json"

# Global bounds for wave data
GLOBAL_BOUNDS = {
    'minLat': -77.5,
    'maxLat': 77.5,
    'minLon': -180,
    'maxLon': 180
}
