# Sandbars Global Marine Forecast System
## Complete Architecture & Implementation Strategy

---

## Executive Summary

Sandbars implements a **multi-tier marine forecasting system** that combines real-time observations, numerical weather models, and machine learning to deliver accurate surf forecasts globally. The architecture evolves through progressive enhancement:

**Current State (Phase 1)**: Multi-source hierarchy with NDBC buoys, NOAA NWS weather, and tides
**Next Phase (Phase 2)**: Add WAVEWATCH III model data and ensemble combination
**Future Vision (Phase 3)**: Full ML bias correction and global coverage

This document describes the complete architecture from current implementation to production-scale vision.

---

## Table of Contents

1. [Philosophy & Core Principles](#philosophy)
2. [Current Architecture (Implemented)](#current-architecture)
3. [Enhanced Architecture (Phase 2)](#enhanced-architecture)
4. [Global Architecture (Phase 3 Vision)](#global-architecture)
5. [Data Sources Comprehensive Guide](#data-sources)
6. [Multi-Model Ensemble Strategy](#ensemble-strategy)
7. [Machine Learning Enhancement](#ml-enhancement)
8. [Implementation Roadmap](#roadmap)
9. [Technical Stack & Infrastructure](#technical-stack)

---

## <a name="philosophy"></a>1. Philosophy & Core Principles

### Truth Over Convenience

We prioritize **accuracy and transparency** over simplicity:
- Multiple sources of truth with quality indicators
- Ensemble methods proven to outperform single models
- Machine learning to correct systematic model biases
- Full transparency about data provenance and quality

### Hierarchy of Trust

```
PRIMARY (Best)
  ↓ Direct observation from nearby station (NDBC buoy < 50km)
  ↓
SECONDARY
  ↓ Interpolated from multiple nearby stations (2-5 buoys)
  ↓ Model ensemble (WAVEWATCH III + ECMWF + GFS)
  ↓
TERTIARY
  ↓ Single numerical model (if ensemble unavailable)
  ↓ ML-corrected historical forecast
  ↓
FALLBACK
  ↓ Historical climatology for location/season
```

### Ensemble Philosophy

**Why combine models?** Research from ECMWF, WMO, and Met Office shows:
1. **Error compensation**: Different models have different biases
2. **Uncertainty quantification**: Ensemble spread = confidence
3. **Robustness**: Backup when one model fails
4. **Skill optimization**: Weight models by historical performance

---

## <a name="current-architecture"></a>2. Current Architecture (Phase 1 - Implemented)

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 USER REQUEST (lat, lon)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              NEXT.JS API ROUTE (Caching)                     │
│              /api/forecast?lat=X&lon=Y                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│           MULTI-SOURCE DATA HIERARCHY                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    NDBC     │  │  NOAA NWS   │  │    NOAA     │        │
│  │    Buoys    │  │   Weather   │  │  Tides &    │        │
│  │ (18 buoys)  │  │  Forecasts  │  │  Currents   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┴────────────────┘                │
│                          │                                  │
│                 ┌────────▼─────────┐                       │
│                 │   HIERARCHY      │                       │
│                 │     ENGINE       │                       │
│                 │  (lib/forecast/  │                       │
│                 │   hierarchy.ts)  │                       │
│                 └────────┬─────────┘                       │
│                          │                                  │
│         ┌────────────────┴────────────────┐               │
│         │                                  │               │
│  ┌──────▼───────┐                ┌────────▼──────┐       │
│  │   SPATIAL    │                │  WAVE POWER   │       │
│  │INTERPOLATION │                │  CALCULATION  │       │
│  │     (IDW)    │                │   (Physics)   │       │
│  └──────────────┘                └───────────────┘       │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│            ENHANCED SURF FORECAST                            │
│   • Wave height/period/direction with quality flags         │
│   • Wind speed/direction                                     │
│   • Water & air temperature                                  │
│   • Tide levels                                              │
│   • Wave power (derived)                                     │
│   • Metadata (sources used, distances, confidence)          │
└──────────────────────────────────────────────────────────────┘
```

### Current Data Sources

#### 1. NDBC Buoys (Primary)
- **Count**: 18 major buoys (CA, HI, East Coast)
- **Metrics**: Wave H/T/Dir, Wind, Water/Air temp
- **Quality**: PRIMARY (direct observations)
- **Update**: Hourly
- **Range**: Up to 200km

#### 2. NOAA NWS (Weather)
- **Coverage**: All US locations
- **Metrics**: Air temp, wind forecasts
- **Quality**: PRIMARY (government forecast)
- **Update**: 4x daily
- **Horizon**: 7 days

#### 3. NOAA Tides & Currents
- **Stations**: 10 major coastal locations
- **Metrics**: Tide predictions
- **Quality**: PRIMARY (deterministic)
- **Update**: Static predictions
- **Horizon**: Months ahead

### Current Capabilities

✅ **Real-time buoy observations**
✅ **Spatial interpolation (IDW)** from multiple buoys
✅ **Quality flags** on every metric
✅ **Wave power calculation** (P = 0.5 × ρ × g × H² × T)
✅ **Intelligent fallbacks** when data missing
✅ **Source transparency** (which buoy, distance, quality)
✅ **Aggressive caching** (30min-24hr TTLs)

### Limitations

❌ No coverage beyond 200km from buoys
❌ Only one wave model source (missing global coverage)
❌ No ensemble uncertainty quantification
❌ No ML bias correction
❌ No offshore wave forecasts

---

## <a name="enhanced-architecture"></a>3. Enhanced Architecture (Phase 2 - Next Implementation)

### Add WAVEWATCH III Model Data

**WAVEWATCH III** is NOAA's global wave model:
- **Resolution**: 0.25° globally (~25km)
- **Update**: 4x daily (00Z, 06Z, 12Z, 18Z)
- **Horizon**: 16 days
- **Metrics**: Significant wave height, peak period, mean direction, wind-wave components
- **Access**: NOMADS HTTPS in GRIB2 format

### Enhanced Data Flow

```
User Request → Check Cache → Query Multi-Source Hierarchy
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
         ┌────▼────┐            ┌─────▼─────┐          ┌─────▼─────┐
         │  NDBC   │            │    NWS    │          │ WAVEWATCH │
         │  Buoys  │            │  Weather  │          │    III    │
         │(Primary)│            │ (Primary) │          │ (Model)   │
         └────┬────┘            └─────┬─────┘          └─────┬─────┘
              │                       │                       │
              └───────────────────────┴───────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │    ENSEMBLE    │
                              │  COMBINATION   │
                              │  (Weighted     │
                              │   Averaging)   │
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │   CONFIDENCE   │
                              │   ESTIMATION   │
                              │ (Ensemble      │
                              │   Spread)      │
                              └────────────────┘
```

### Ensemble Combination Logic

When multiple sources available:

```typescript
// Example: Wave height at a location
Sources:
  - NDBC Buoy 46026 (12km away): 2.1m [weight: 0.5]
  - NDBC Buoy 46012 (45km away): 1.9m [weight: 0.2]
  - WAVEWATCH III: 2.3m [weight: 0.3]

Ensemble Mean = (2.1×0.5 + 1.9×0.2 + 2.3×0.3) = 2.12m
Ensemble Spread = std([2.1, 1.9, 2.3]) = 0.17m

Confidence: HIGH (multiple sources, low spread)
Quality: INTERPOLATED (uses model + obs)
```

### Weighted Averaging Strategy

**Distance-based weights for observations:**
```
w_obs = 1 / distance²
```

**Model weights** (configurable):
```
w_NDBC = 0.4 (when available)
w_WAVEWATCH = 0.3
w_NWS = 0.3
```

**Outlier rejection**: Remove values > 3σ from ensemble mean

---

## <a name="global-architecture"></a>4. Global Architecture (Phase 3 Vision)

### Full Production System

This is the ultimate vision - a separate Python backend service:

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS FRONTEND (Sandbars)                   │
│                   (Map UI, User Management)                      │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST/GraphQL API
┌────────────────────────▼────────────────────────────────────────┐
│                  FASTAPI FORECAST SERVICE                        │
│                     (Python Backend)                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                    TIMESCALEDB + POSTGIS                         │
│  • forecast_grid (hypertable)                                    │
│  • buoy_observation (hypertable)                                 │
│  • ensemble_forecast (pre-computed)                              │
│  • ml_corrections (bias-corrected forecasts)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│                 DATA INGESTION WORKERS                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │ WAVEWATCH  │  │   ECMWF    │  │    GFS     │               │
│  │    III     │  │  Open Data │  │   Wave     │               │
│  └────────────┘  └────────────┘  └────────────┘               │
│                                                                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │   NDBC     │  │   Tides    │  │ Copernicus │               │
│  │   Buoys    │  │  CO-OPS    │  │   Marine   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└──────────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────────┐
│              ML BIAS CORRECTION ENGINE                           │
│  • Train on historical forecast-observation pairs               │
│  • XGBoost models per region                                    │
│  • Continuous retraining with new data                          │
└──────────────────────────────────────────────────────────────────┘
```

### Global Data Sources (Phase 3)

| Source | Type | Resolution | Update | Horizon | Access |
|--------|------|------------|--------|---------|--------|
| WAVEWATCH III | Wave Model | 0.25° | 4x/day | 16 days | NOMADS |
| ECMWF WAM | Wave Model | 0.25° | 4x/day | 15 days | AWS Open Data |
| GFS Wave | Wave Model | 0.25° | 4x/day | 16 days | NOMADS |
| NDBC | Observations | Point | Hourly | Real-time | HTTPS |
| ECMWF IFS | Atmospheric | 0.25° | 4x/day | 15 days | AWS Open Data |
| Copernicus | Wave Model | 1/12° | Daily | 10 days | API |
| NOAA CO-OPS | Tides | Point | - | Months | API |
| GEBCO 2025 | Bathymetry | 15" | Annual | Static | Download |

---

## <a name="data-sources"></a>5. Data Sources Comprehensive Guide

### WAVEWATCH III (NOAA)

**What**: Physics-based spectral wave model
**Coverage**: Global oceans
**Resolution**: Multiple grids (0.25° standard)
**Physics**: Solves wave action density equation with source terms
**Strengths**: Well-validated, long history, free
**Weaknesses**: Lower resolution near coast, systematic biases

**Data Access**:
```
URL: https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod
Format: GRIB2
Cycle: gfs.20240121/00/wave/gridded/
File: gfswave.t00z.global.0p25.f003.grib2

Parameters:
  - HTSGW: Significant height of combined wind waves and swell
  - PERPW: Primary wave mean period
  - DIRPW: Primary wave direction
  - SWELL: Swell wave height/period/direction (multiple components)
```

### ECMWF Open Data

**What**: European Centre's ensemble wave forecasts
**Coverage**: Global
**Resolution**: 0.25° (9km)
**Ensemble**: 51 members (uncertainty quantification)
**License**: CC-BY-4.0 (fully open since 2024)

**Why ECMWF**: Industry gold standard, consistently best global model

**Data Access**:
```
Cloud: AWS S3, Azure, Google Cloud (free egress)
Format: GRIB2
Real-time: Last 7 days
Archive: Last 6 months

Parameters: Same as WAVEWATCH III plus ensemble members
```

### NDBC Buoys

**What**: Real-time observations from 900+ buoys
**Coverage**: US coasts, Great Lakes, Pacific, Atlantic
**Quality**: Ground truth for validation

**Buoy Types**:
- 3-meter discus buoys: Full spectral data
- CDIP buoys: High-resolution directional spectra
- C-MAN stations: Coastal/island fixed stations

**Critical Buoys for Sandbars**:
```
California:
  46221 Santa Monica Basin
  46222 San Pedro
  46232 Point Reyes
  46026 San Francisco Bar
  46012 Half Moon Bay
  46042 Monterey Bay

Hawaii:
  51201 Hanalei
  51202 Waimea Bay

East Coast:
  44025 Long Island
  41010 Canaveral East
```

---

## <a name="ensemble-strategy"></a>6. Multi-Model Ensemble Strategy

### Why Ensemble Forecasts?

Single models make systematic errors. Ensembles:
1. **Average out random errors**
2. **Indicate forecast uncertainty** (spread = confidence)
3. **Provide backup** when one model fails
4. **Outperform** any single model (proven in WMO studies)

### Ensemble Combination Methods

#### 1. Simple Pooling (Current Phase 2 Plan)

Treat all available forecasts as one ensemble:

```typescript
function combineForecasts(sources: ForecastSource[]): EnsembleResult {
  const values = sources.map(s => s.waveHeight * s.weight);
  const weights = sources.map(s => s.weight);

  const mean = weightedAverage(values, weights);
  const spread = weightedStdDev(values, weights);

  return {
    mean,
    uncertainty: spread,
    confidence: spread < 0.3 ? 'high' : spread < 0.6 ? 'medium' : 'low',
    sources: sources.map(s => s.name)
  };
}
```

#### 2. Weighted Averaging (Phase 2)

Assign weights based on:
- **Source type**: Observations > Models
- **Distance**: Closer = higher weight
- **Historical skill**: Track model performance by region
- **Data freshness**: Penalize stale data

```typescript
function calculateWeight(source: Source, location: LatLon): number {
  let weight = BASE_WEIGHTS[source.type]; // obs: 0.5, model: 0.3

  if (source.type === 'observation') {
    const distance = haversine(location, source.location);
    weight *= 1 / Math.pow(distance, 2); // Inverse distance squared
  }

  const ageHours = (now() - source.timestamp) / 3600000;
  if (ageHours > 3) weight *= 0.5; // Penalize stale data

  return weight;
}
```

#### 3. Probabilistic Ensemble (Phase 3)

Compute probability distributions:

```typescript
function computeProbabilities(ensemble: number[]): Probabilities {
  const sorted = ensemble.sort();
  return {
    p10: percentile(sorted, 10),  // 10% chance of being this low
    p50: percentile(sorted, 50),  // Median (most likely)
    p90: percentile(sorted, 90),  // 10% chance of exceeding

    // Tercile probabilities
    below_normal: ensemble.filter(v => v < climatology.p33).length / ensemble.length,
    normal: ensemble.filter(v => v >= climatology.p33 && v <= climatology.p67).length / ensemble.length,
    above_normal: ensemble.filter(v => v > climatology.p67).length / ensemble.length,
  };
}
```

### Circular Statistics for Directions

Wave/wind direction requires special handling:

```typescript
function circularMean(directions: number[], weights: number[]): number {
  const rads = directions.map(d => d * Math.PI / 180);
  const x = sum(weights.map((w, i) => w * Math.cos(rads[i])));
  const y = sum(weights.map((w, i) => w * Math.sin(rads[i])));

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
```

**Why**: Can't average 350° and 10° normally (would get 180°, wrong!)

---

## <a name="ml-enhancement"></a>7. Machine Learning Enhancement

### The Bias Correction Problem

Numerical weather models have **systematic biases**:
- Overestimate wave height in certain conditions
- Underestimate short-period waves
- Directional errors near complex bathymetry
- Location-specific biases

### ML Solution

Train models on **historical forecast-observation pairs**:

```
Input Features:
  - Ensemble mean/spread
  - Model disagreement
  - Lead time (0-168 hours)
  - Season (month)
  - Location (lat/lon)
  - Bathymetry depth
  - Recent observation trends

Output:
  - Corrected wave height
  - Uncertainty estimate
```

### Implementation (Phase 3)

```python
from xgboost import XGBRegressor
from sklearn.model_selection import TimeSeriesSplit

# Training data: 5 years of hindcasts matched to buoy observations
X = pd.DataFrame({
    'hs_ensemble_mean': ensemble_forecasts['wave_height'],
    'hs_ensemble_std': ensemble_forecasts['wave_height_spread'],
    'lead_time_hours': lead_times,
    'month': timestamps.dt.month,
    'latitude': lats,
    'longitude': lons,
})

y = buoy_observations['wave_height']

# Time-series cross-validation (no data leakage)
tscv = TimeSeriesSplit(n_splits=5)
model = XGBRegressor(n_estimators=200, max_depth=6)

for train_idx, val_idx in tscv.split(X):
    model.fit(X.iloc[train_idx], y.iloc[train_idx])
    predictions = model.predict(X.iloc[val_idx])
    # Track RMSE, bias, skill scores

# Deploy model for real-time correction
```

### Expected Improvements

Research shows ML post-processing can:
- Reduce RMSE by 15-30%
- Improve skill scores by 0.1-0.2
- Better calibrate uncertainty estimates
- Learn local effects models miss

---

## <a name="roadmap"></a>8. Implementation Roadmap

### Phase 1: Foundation (✅ COMPLETE)

**Status**: Implemented on `claude/multi-source-forecast-system-01CUhpy7RUdukXBZGmpu65wo`

- [x] Multi-source hierarchy (NDBC, NWS, Tides)
- [x] Spatial interpolation (IDW)
- [x] Quality flags and transparency
- [x] Wave power calculation
- [x] Next.JS API integration
- [x] TypeScript types
- [x] Documentation

### Phase 2: Global Model Data (NEXT - 2-3 weeks)

**Goal**: Add WAVEWATCH III for global coverage

- [ ] WAVEWATCH III data source
  - [ ] GRIB2 file downloader (or API wrapper)
  - [ ] Parser for wave parameters
  - [ ] Spatial grid to point interpolation
- [ ] Enhanced ensemble logic
  - [ ] Weighted averaging implementation
  - [ ] Confidence scoring from spread
  - [ ] Outlier rejection
- [ ] Database enhancements
  - [ ] Store ensemble statistics
  - [ ] Track source usage
  - [ ] Pre-compute popular locations
- [ ] API updates
  - [ ] Return ensemble mean + uncertainty
  - [ ] Expose confidence metrics
  - [ ] Forecast verification endpoints
- [ ] UI enhancements
  - [ ] Show confidence indicators
  - [ ] Display ensemble spread
  - [ ] Model attribution

**Deliverables**:
- Global coverage (anywhere on Earth)
- Ensemble uncertainty quantification
- Multiple model verification

### Phase 3: ML Enhancement (3-6 months)

**Goal**: Add bias correction and advanced analytics

- [ ] Data pipeline
  - [ ] Historical hindcast archive
  - [ ] Forecast-observation matching
  - [ ] Feature engineering
- [ ] ML models
  - [ ] Train XGBoost per region
  - [ ] Validate on holdout data
  - [ ] Deploy for real-time correction
- [ ] Separate Python backend
  - [ ] FastAPI service
  - [ ] TimescaleDB storage
  - [ ] Airflow scheduling
- [ ] Advanced features
  - [ ] Nearshore wave transformation
  - [ ] Surf quality scoring
  - [ ] Spot-specific tuning

**Deliverables**:
- 15-30% accuracy improvement
- Calibrated uncertainty estimates
- Production-scale architecture

### Phase 4: Production Optimization (Ongoing)

- [ ] Caching strategy optimization
- [ ] Geographic sharding
- [ ] Pre-computation for popular spots
- [ ] Monitoring and alerting
- [ ] A/B testing framework
- [ ] User feedback integration

---

## <a name="technical-stack"></a>9. Technical Stack & Infrastructure

### Current (Phase 1 & 2)

**Frontend/API**:
- Next.js 15 with App Router
- TypeScript with strict types
- Vercel deployment
- Next.js API Routes with caching

**Data Processing**:
- Native JavaScript/TypeScript
- Haversine distance calculations
- Inverse Distance Weighting interpolation
- Statistical aggregation

**Storage**:
- Supabase PostgreSQL + PostGIS
- Stations table
- Observations table (future)
- Location cache (future)

**External APIs**:
- NDBC: Real-time buoy data (HTTP/text)
- NOAA NWS: Weather forecasts (JSON API)
- NOAA Tides: Tide predictions (JSON API)
- WAVEWATCH III: Model data (GRIB2 via NOMADS or wrapper API)

### Future (Phase 3)

**Separate Python Backend**:
```
FastAPI + Uvicorn
  ↓
TimescaleDB (hypertables for time-series)
  ↓
PostGIS (spatial queries)
  ↓
Redis (caching layer)
  ↓
Docker + Kubernetes
```

**Data Processing**:
- Python: xarray, pandas, numpy
- GRIB handling: cfgrib, eccodes
- ML: XGBoost, scikit-learn
- Distributed: Dask

**Scheduling**:
- Apache Airflow for workflows
- Celery for background tasks
- Cron for data ingestion

**Infrastructure**:
- AWS/GCP for compute
- S3-compatible storage for GRIB archive
- Grafana for monitoring
- Sentry for error tracking

---

## Key Success Metrics

**Phase 1** (Current):
- ✅ <100ms API response (cached)
- ✅ 7-day forecast horizon
- ✅ Coverage within 200km of buoys
- ✅ Quality flags on all metrics

**Phase 2** (Next):
- 🎯 Global coverage (any coordinate)
- 🎯 Ensemble uncertainty < 20% for wave height
- 🎯 16-day forecast horizon
- 🎯 <500ms API response (uncached)

**Phase 3** (Future):
- 🎯 RMSE < 0.3m for wave height
- 🎯 Skill score > 0.7 vs persistence
- 🎯 99.9% API uptime
- 🎯 <100ms p95 latency

---

## Conclusion

Sandbars' marine forecast system represents a **progressive enhancement strategy**:

1. **Start simple**: Real observations + interpolation (Phase 1 ✅)
2. **Add intelligence**: Global models + ensembles (Phase 2 🔄)
3. **Machine learning**: Bias correction + optimization (Phase 3 📅)

Each phase delivers value independently while building toward a world-class forecasting system that rivals commercial products—**using only free, public data sources**.

The key innovation is combining **proven meteorological techniques** (multi-model ensembles, statistical post-processing) with **modern engineering** (TypeScript, Next.js, edge caching) and **machine learning** (XGBoost bias correction) into an integrated system that's both accurate and transparent.

---

**Document Version**: 2.0
**Last Updated**: January 2025
**Status**: Phase 1 Complete, Phase 2 In Progress
**Next Review**: After Phase 2 completion
