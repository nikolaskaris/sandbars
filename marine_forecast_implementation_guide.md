# Global Marine Forecast System: Technical Implementation Guide
## For Claude Code / AI-Assisted Development

---

## Quick Reference

This guide is designed for AI coding assistants (like Claude) to implement a global marine forecasting system. Use these sections:

| Need to... | Go to Section |
|------------|---------------|
| Set up project structure | Section 1 |
| Configure dependencies | Section 2 |
| Create database schema | Section 4 |
| Build data ingestion | Section 5 |
| Implement ensemble logic | Section 6 |
| Add ML bias correction | Section 7 |
| Create REST API | Section 8 |
| Deploy with Docker | Section 9 |

---

## Section 1: Project Structure

```
marine-forecast/
├── docker-compose.yml
├── Dockerfile
├── pyproject.toml
├── README.md
├── config/
│   └── settings.py            # Pydantic settings
├── src/
│   ├── ingestion/             # Data collectors
│   │   ├── base.py            # Abstract base
│   │   ├── wavewatch.py       # NOAA WW3
│   │   ├── ecmwf.py           # ECMWF open data
│   │   ├── ndbc.py            # Buoy observations
│   │   └── tides.py           # NOAA tides
│   ├── processing/
│   │   ├── grib_processor.py
│   │   ├── ensemble.py        # Multi-model combination
│   │   └── interpolation.py
│   ├── models/
│   │   ├── bias_correction.py # ML models
│   │   └── nearshore.py       # Wave transformation
│   ├── storage/
│   │   ├── db.py
│   │   ├── models.py          # SQLAlchemy
│   │   └── repositories.py
│   ├── api/
│   │   ├── main.py            # FastAPI app
│   │   ├── routes/
│   │   └── schemas.py
│   └── workers/
│       └── scheduler.py       # Background tasks
├── scripts/
│   └── init_db.py
└── tests/
```

---

## Section 2: Dependencies (pyproject.toml)

```toml
[tool.poetry]
name = "marine-forecast"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.11"

# Data processing
numpy = "^1.26"
pandas = "^2.1"
xarray = "^2024.1"
dask = {extras = ["complete"], version = "^2024.1"}
scipy = "^1.12"

# GRIB handling
cfgrib = "^0.9.10"
eccodes = "^1.6"
netCDF4 = "^1.6"

# Geospatial
pyproj = "^3.6"
geopandas = "^0.14"

# Database
sqlalchemy = {extras = ["asyncio"], version = "^2.0"}
asyncpg = "^0.29"
geoalchemy2 = "^0.14"
alembic = "^1.13"

# API
fastapi = "^0.109"
uvicorn = {extras = ["standard"], version = "^0.27"}
pydantic = "^2.5"

# ML
scikit-learn = "^1.4"
xgboost = "^2.0"

# Networking
httpx = "^0.26"
tenacity = "^8.2"

# Caching
redis = "^5.0"

# Utils
structlog = "^24.1"
apscheduler = "^3.10"
```

---

## Section 3: Configuration (config/settings.py)

```python
from functools import lru_cache
from pydantic import Field, PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")
    
    database_url: PostgresDsn = "postgresql+asyncpg://postgres:postgres@localhost:5432/marine_forecast"
    redis_url: str = "redis://localhost:6379/0"
    data_dir: str = "/data"
    
    # Data source URLs
    wavewatch_base_url: str = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
    ndbc_base_url: str = "https://www.ndbc.noaa.gov/data/realtime2"
    tides_api_url: str = "https://api.tidesandcurrents.noaa.gov/api/prod"
    
    # Ensemble weights
    ensemble_weights: dict = {
        "wavewatch3": 0.35,
        "ecmwf_wav": 0.35,
        "gfs_wave": 0.30,
    }
    
    forecast_cache_ttl: int = 3600

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

---

## Section 4: Database Schema (src/storage/models.py)

```python
from datetime import datetime
from typing import Optional
import sqlalchemy as sa
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from geoalchemy2 import Geometry

class Base(DeclarativeBase):
    pass

class ForecastGrid(Base):
    """Gridded forecast data - use as TimescaleDB hypertable."""
    __tablename__ = "forecast_grid"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    model_run_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), index=True)
    valid_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), index=True)
    model_source: Mapped[str] = mapped_column(sa.String(50))
    
    latitude: Mapped[float] = mapped_column(sa.Float)
    longitude: Mapped[float] = mapped_column(sa.Float)
    location: Mapped[Geometry] = mapped_column(Geometry("POINT", srid=4326))
    
    # Wave parameters
    significant_wave_height: Mapped[Optional[float]] = mapped_column(sa.Float)
    peak_wave_period: Mapped[Optional[float]] = mapped_column(sa.Float)
    mean_wave_direction: Mapped[Optional[float]] = mapped_column(sa.Float)
    swell1_height: Mapped[Optional[float]] = mapped_column(sa.Float)
    swell1_period: Mapped[Optional[float]] = mapped_column(sa.Float)
    swell1_direction: Mapped[Optional[float]] = mapped_column(sa.Float)
    wind_wave_height: Mapped[Optional[float]] = mapped_column(sa.Float)
    
    # Atmospheric
    wind_speed_10m: Mapped[Optional[float]] = mapped_column(sa.Float)
    wind_direction_10m: Mapped[Optional[float]] = mapped_column(sa.Float)
    sea_surface_temp: Mapped[Optional[float]] = mapped_column(sa.Float)

class BuoyObservation(Base):
    """Ground truth observations."""
    __tablename__ = "buoy_observation"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[str] = mapped_column(sa.String(20), index=True)
    observation_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True), index=True)
    
    latitude: Mapped[float] = mapped_column(sa.Float)
    longitude: Mapped[float] = mapped_column(sa.Float)
    
    significant_wave_height: Mapped[Optional[float]] = mapped_column(sa.Float)
    dominant_wave_period: Mapped[Optional[float]] = mapped_column(sa.Float)
    mean_wave_direction: Mapped[Optional[float]] = mapped_column(sa.Float)
    wind_speed: Mapped[Optional[float]] = mapped_column(sa.Float)
    wind_direction: Mapped[Optional[float]] = mapped_column(sa.Float)
    water_temp: Mapped[Optional[float]] = mapped_column(sa.Float)

class EnsembleForecast(Base):
    """Pre-computed ensemble statistics for fast API response."""
    __tablename__ = "ensemble_forecast"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    latitude: Mapped[float] = mapped_column(sa.Float)
    longitude: Mapped[float] = mapped_column(sa.Float)
    model_run_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    valid_time: Mapped[datetime] = mapped_column(sa.DateTime(timezone=True))
    
    # Ensemble statistics
    hs_mean: Mapped[float] = mapped_column(sa.Float)
    hs_std: Mapped[float] = mapped_column(sa.Float)
    hs_p10: Mapped[float] = mapped_column(sa.Float)
    hs_p50: Mapped[float] = mapped_column(sa.Float)
    hs_p90: Mapped[float] = mapped_column(sa.Float)
    tp_mean: Mapped[float] = mapped_column(sa.Float)
    dir_mean: Mapped[float] = mapped_column(sa.Float)
    wind_speed_mean: Mapped[Optional[float]] = mapped_column(sa.Float)
    
    # ML-corrected
    hs_corrected: Mapped[Optional[float]] = mapped_column(sa.Float)
```

**TimescaleDB Setup:**
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;

SELECT create_hypertable('forecast_grid', 'valid_time', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('buoy_observation', 'observation_time');
```

---

## Section 5: Data Ingestion

### Base Collector (src/ingestion/base.py)

```python
from abc import ABC, abstractmethod
from pathlib import Path
from typing import AsyncIterator
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

logger = structlog.get_logger()

class BaseCollector(ABC):
    def __init__(self, cache_dir: Path):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._client = None
    
    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=300.0)
        return self._client
    
    @abstractmethod
    async def list_available(self, start_time, end_time) -> list[dict]:
        pass
    
    @abstractmethod
    async def download(self, file_info: dict) -> Path:
        pass
    
    @abstractmethod
    async def process(self, file_path: Path) -> AsyncIterator[dict]:
        pass
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=4, max=60))
    async def fetch_url(self, url: str, dest_path: Path) -> Path:
        logger.info("downloading", url=url)
        async with self.client.stream("GET", url) as response:
            response.raise_for_status()
            with open(dest_path, "wb") as f:
                async for chunk in response.aiter_bytes(8192):
                    f.write(chunk)
        return dest_path
```

### WAVEWATCH III Collector (src/ingestion/wavewatch.py)

```python
from datetime import datetime, timedelta
from pathlib import Path
from typing import AsyncIterator
import xarray as xr
import numpy as np
from .base import BaseCollector

class WaveWatchCollector(BaseCollector):
    BASE_URL = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
    
    async def list_available(self, start_time: datetime, end_time: datetime) -> list[dict]:
        files = []
        current = start_time
        while current <= end_time:
            for cycle_hour in [0, 6, 12, 18]:
                cycle_time = current.replace(hour=cycle_hour, minute=0, second=0)
                date_str = cycle_time.strftime("%Y%m%d")
                cycle_str = f"{cycle_hour:02d}"
                
                for fhour in range(0, 385, 3):
                    files.append({
                        "cycle_time": cycle_time,
                        "forecast_hour": fhour,
                        "url": f"{self.BASE_URL}/gfs.{date_str}/{cycle_str}/wave/gridded/"
                               f"gfswave.t{cycle_str}z.global.0p25.f{fhour:03d}.grib2",
                        "filename": f"gfswave_{date_str}_{cycle_str}_f{fhour:03d}.grib2"
                    })
            current += timedelta(days=1)
        return files
    
    async def download(self, file_info: dict) -> Path:
        dest_path = self.cache_dir / file_info["filename"]
        if dest_path.exists():
            return dest_path
        await self.fetch_url(file_info["url"], dest_path)
        return dest_path
    
    async def process(self, file_path: Path) -> AsyncIterator[dict]:
        ds = xr.open_dataset(file_path, engine="cfgrib",
                             backend_kwargs={"filter_by_keys": {"typeOfLevel": "surface"}})
        
        for i, lat in enumerate(ds.latitude.values):
            for j, lon in enumerate(ds.longitude.values):
                swh = float(ds.swh.values[i, j]) if "swh" in ds else np.nan
                if np.isnan(swh):
                    continue
                
                yield {
                    "model_source": "wavewatch3",
                    "valid_time": str(ds.valid_time.values),
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "significant_wave_height": swh,
                    "peak_wave_period": float(ds.mwp.values[i, j]) if "mwp" in ds else None,
                    "mean_wave_direction": float(ds.mwd.values[i, j]) if "mwd" in ds else None,
                }
        ds.close()
```

### NDBC Buoy Collector (src/ingestion/ndbc.py)

```python
from datetime import datetime
from pathlib import Path
from typing import AsyncIterator
import pandas as pd
from .base import BaseCollector

class NDBCCollector(BaseCollector):
    BASE_URL = "https://www.ndbc.noaa.gov/data/realtime2"
    
    async def list_available(self, start_time, end_time) -> list[dict]:
        # Pre-defined list of key buoys (or fetch from station list)
        stations = ["46042", "46211", "46253", "44025", "41049"]  # Example
        return [{"station_id": s, "url": f"{self.BASE_URL}/{s}.txt"} for s in stations]
    
    async def download(self, file_info: dict) -> Path:
        dest = self.cache_dir / f"{file_info['station_id']}_stdmet.txt"
        await self.fetch_url(file_info["url"], dest)
        return dest
    
    async def process(self, file_path: Path) -> AsyncIterator[dict]:
        station_id = file_path.stem.split("_")[0]
        df = pd.read_csv(file_path, delim_whitespace=True, skiprows=1,
                         na_values=["MM", "999", "9999.0"])
        
        for _, row in df.iterrows():
            try:
                obs_time = datetime(
                    2000 + int(row.iloc[0]) if row.iloc[0] < 100 else int(row.iloc[0]),
                    int(row.iloc[1]), int(row.iloc[2]),
                    int(row.iloc[3]), int(row.iloc[4])
                )
                yield {
                    "station_id": station_id,
                    "observation_time": obs_time.isoformat() + "Z",
                    "significant_wave_height": self._safe_float(row.iloc[8]),
                    "dominant_wave_period": self._safe_float(row.iloc[9]),
                    "wind_speed": self._safe_float(row.iloc[6]),
                    "wind_direction": self._safe_float(row.iloc[5]),
                    "water_temp": self._safe_float(row.iloc[14]),
                }
            except:
                continue
    
    def _safe_float(self, val):
        try:
            v = float(val)
            return None if v in [99, 999, 9999] else v
        except:
            return None
```

---

## Section 6: Multi-Model Ensemble (src/processing/ensemble.py)

```python
from dataclasses import dataclass
import numpy as np

@dataclass
class EnsembleConfig:
    weights: dict[str, float]
    min_models: int = 2
    outlier_threshold: float = 3.0

class EnsembleEngine:
    def __init__(self, config: EnsembleConfig):
        self.config = config
    
    def combine_forecasts(self, forecasts: list[dict], variable: str = "significant_wave_height") -> dict:
        """Combine forecasts with weighted averaging."""
        by_model = {}
        for f in forecasts:
            model = f["model_source"]
            val = f.get(variable)
            if val is not None and not np.isnan(val):
                by_model.setdefault(model, []).append(val)
        
        if len(by_model) < self.config.min_models:
            return None
        
        # Model means
        model_values = {m: np.mean(v) for m, v in by_model.items()}
        model_values = self._reject_outliers(model_values)
        
        # Weighted combination
        values = np.array(list(model_values.values()))
        weights = np.array([self.config.weights.get(m, 1.0) for m in model_values])
        weights = weights / weights.sum()
        
        mean = np.average(values, weights=weights)
        std = np.sqrt(np.average((values - mean)**2, weights=weights))
        
        return {
            "mean": float(mean),
            "std": float(std),
            "p10": float(np.percentile(values, 10)),
            "p50": float(np.percentile(values, 50)),
            "p90": float(np.percentile(values, 90)),
            "source_models": list(model_values.keys()),
        }
    
    def combine_directions(self, forecasts: list[dict], variable: str = "mean_wave_direction") -> dict:
        """Combine directional data using circular statistics."""
        directions = []
        weights = []
        for f in forecasts:
            val = f.get(variable)
            if val is not None:
                directions.append(np.radians(val))
                weights.append(self.config.weights.get(f["model_source"], 1.0))
        
        if len(directions) < self.config.min_models:
            return None
        
        weights = np.array(weights) / sum(weights)
        x = np.sum(weights * np.cos(directions))
        y = np.sum(weights * np.sin(directions))
        
        return {
            "mean": float(np.degrees(np.arctan2(y, x)) % 360),
            "spread": float(np.degrees(np.sqrt(-2 * np.log(np.sqrt(x**2 + y**2))))),
        }
    
    def _reject_outliers(self, model_values: dict) -> dict:
        if len(model_values) < 3:
            return model_values
        values = np.array(list(model_values.values()))
        mean, std = np.mean(values), np.std(values)
        if std == 0:
            return model_values
        return {m: v for m, v in model_values.items() 
                if abs(v - mean) / std <= self.config.outlier_threshold}
```

---

## Section 7: ML Bias Correction (src/models/bias_correction.py)

```python
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
import xgboost as xgb
import joblib

class BiasCorrector:
    def __init__(self, features: list[str] = None):
        self.features = features or [
            "hs_ensemble_mean", "hs_ensemble_std", "tp_ensemble_mean",
            "lead_time_hours", "month", "latitude", "longitude", "water_depth"
        ]
        self.model = None
        self.scaler = None
    
    def prepare_features(self, ensemble_df: pd.DataFrame, obs_df: pd.DataFrame):
        """Merge forecasts with observations for training."""
        df = pd.merge(ensemble_df, obs_df, on=["valid_time", "station_id"],
                      suffixes=("_fcst", "_obs"))
        
        df["lead_time_hours"] = (pd.to_datetime(df["valid_time"]) - 
                                  pd.to_datetime(df["model_run_time"])).dt.total_seconds() / 3600
        df["month"] = pd.to_datetime(df["valid_time"]).dt.month
        
        feature_cols = [c for c in self.features if c in df.columns]
        X = df[feature_cols].fillna(df[feature_cols].median())
        y = df["significant_wave_height_obs"]
        
        return X[~y.isna()], y[~y.isna()], feature_cols
    
    def train(self, X: pd.DataFrame, y: pd.Series):
        """Train XGBoost model with time-series CV."""
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Time-series cross-validation
        cv_scores = []
        for train_idx, val_idx in TimeSeriesSplit(n_splits=5).split(X_scaled):
            model = xgb.XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1)
            model.fit(X_scaled[train_idx], y.iloc[train_idx])
            pred = model.predict(X_scaled[val_idx])
            cv_scores.append(np.sqrt(np.mean((pred - y.iloc[val_idx])**2)))
        
        # Final model on all data
        self.model = xgb.XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1)
        self.model.fit(X_scaled, y)
        
        return {"cv_rmse_mean": np.mean(cv_scores), "cv_rmse_std": np.std(cv_scores)}
    
    def predict(self, X: pd.DataFrame):
        X_scaled = self.scaler.transform(X.fillna(X.median()))
        return self.model.predict(X_scaled)
    
    def save(self, path: Path):
        joblib.dump({"model": self.model, "scaler": self.scaler, "features": self.features}, path)
    
    @classmethod
    def load(cls, path: Path):
        data = joblib.load(path)
        bc = cls(features=data["features"])
        bc.model, bc.scaler = data["model"], data["scaler"]
        return bc
```

---

## Section 8: REST API (src/api/main.py)

```python
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as redis

from config.settings import get_settings

app = FastAPI(title="Marine Forecast API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"])

class ForecastPoint(BaseModel):
    valid_time: datetime
    wave_height: float
    wave_height_min: float
    wave_height_max: float
    wave_period: float
    wave_direction: float
    wind_speed: float | None
    wind_direction: float | None
    confidence: float

class ForecastResponse(BaseModel):
    latitude: float
    longitude: float
    generated_at: datetime
    forecasts: list[ForecastPoint]

@app.on_event("startup")
async def startup():
    app.state.redis = redis.from_url(get_settings().redis_url)

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

@app.get("/forecast", response_model=ForecastResponse)
async def get_forecast(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    hours: int = Query(168, ge=1, le=384)
):
    settings = get_settings()
    cache_key = f"forecast:{lat:.2f}:{lon:.2f}:{hours}"
    
    # Check cache
    cached = await app.state.redis.get(cache_key)
    if cached:
        return ForecastResponse.model_validate_json(cached)
    
    # Query database for ensemble forecasts (implementation depends on your repo layer)
    # forecasts = await repo.get_ensemble_forecast(lat, lon, hours)
    
    # For now, return placeholder
    raise HTTPException(404, "Forecast data not available")

@app.get("/observations/nearest")
async def get_observations(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(100, ge=1, le=500)
):
    # Query nearest buoy observations
    raise HTTPException(404, "No observations within range")
```

---

## Section 9: Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/marine_forecast
      - REDIS_URL=redis://redis:6379/0
    depends_on: [db, redis]
    command: uvicorn src.api.main:app --host 0.0.0.0 --port 8000

  worker:
    build: .
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/marine_forecast
      - REDIS_URL=redis://redis:6379/0
    depends_on: [db, redis]
    command: python -m src.workers.scheduler

  db:
    image: timescale/timescaledb-ha:pg15-latest
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: marine_forecast
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y libeccodes0 libeccodes-dev libgeos-dev
WORKDIR /app

RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry config virtualenvs.create false && poetry install --no-root

COPY . .
RUN poetry install

EXPOSE 8000
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Section 10: Public Data Sources Reference

| Source | Data Type | Resolution | Update Freq | Access Method |
|--------|-----------|------------|-------------|---------------|
| WAVEWATCH III | Global waves | 0.25° | 4x/day | NOMADS HTTPS/FTP |
| ECMWF Open Data | Waves + Atmo | 0.25° | 4x/day | AWS/Azure/GCloud |
| GFS | Atmospheric | 0.25° | 4x/day | AWS/NOMADS |
| NDBC | Buoy obs | Point | Hourly | HTTPS |
| NOAA CO-OPS | Tides | Point | - | REST API |
| Copernicus | Waves | 1/12° | Daily | Python API |
| GEBCO | Bathymetry | 15 arc-sec | Annual | Download |

---

## Implementation Checklist

- [ ] Set up project structure
- [ ] Configure dependencies
- [ ] Initialize database with TimescaleDB + PostGIS
- [ ] Implement WAVEWATCH III collector
- [ ] Implement ECMWF collector
- [ ] Implement NDBC buoy collector
- [ ] Build ensemble combination logic
- [ ] Create API endpoints
- [ ] Add Redis caching
- [ ] Train initial bias correction model
- [ ] Deploy with Docker
- [ ] Set up monitoring
- [ ] Validate against observations

---

## Critical Implementation Notes

1. **GRIB Processing**: Use `cfgrib` with appropriate `filter_by_keys` - GRIB files contain multiple variable types
2. **Circular Statistics**: Wave direction requires circular mean (can't average 350° and 10° normally)
3. **TimescaleDB**: Essential for time-series performance - use hypertables and compression
4. **Cache Strategy**: Forecasts change 4x/day max - cache aggressively
5. **ML Training**: Use time-series CV to prevent data leakage
6. **Error Handling**: Data sources fail often - implement robust retry logic
