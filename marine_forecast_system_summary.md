# Global Marine Forecast System Architecture
## Plain Language Summary

### Executive Overview

This document describes a system architecture for building a global marine forecasting platform that can predict swell direction, wave height, wind conditions, tides, and sea temperatures for any coordinate on Earth. The system synthesizes publicly available weather data from multiple international sources into a unified, intelligent forecast model.

The core innovation is a **multi-model ensemble approach** combined with **machine learning post-processing** that can take raw data from physics-based numerical weather prediction models and improve their accuracy for local marine conditions—without paying for expensive commercial forecast services.

---

## Part 1: Understanding the Data Landscape

### Primary Data Sources (All Publicly Available)

**Wave Models:**
- **WAVEWATCH III (NOAA)**: The workhorse global wave model. Provides significant wave height, peak period, swell direction, and wind-wave components at 0.5° resolution globally. Updated 4x daily with 16-day forecasts. Data available via NCEP NOMADS in GRIB2 format.
- **ECMWF WAM (Open Data)**: European Centre's wave model, now freely available at 0.25° resolution under CC-BY-4.0 license. Provides 10-15 day forecasts with ensemble products for uncertainty quantification.
- **Copernicus Marine Service**: Offers 1/12° resolution global wave analysis and 10-day forecasts. Free registration required. Includes Mediterranean, Baltic, and Black Sea regional models at even higher resolution.

**Atmospheric Models (for wind forcing):**
- **GFS (NOAA Global Forecast System)**: 0.25° global atmospheric model, 16-day forecasts, 4x daily updates. Includes integrated wave data since v16.
- **ECMWF IFS**: Now open data at 0.25° resolution. Industry gold standard for medium-range weather.
- **AIFS (ECMWF AI Model)**: New AI-based forecasting system providing 15-day forecasts with competitive skill.

**Observational Data (Ground Truth):**
- **NDBC (National Data Buoy Center)**: 900+ buoys globally providing real-time wave height, period, direction, wind, temperature. Data available via HTTP/FTP with 45-day rolling archive.
- **CDIP (Coastal Data Information Program)**: High-quality spectral wave buoys along US coasts, feeding into NDBC.

**Tides and Currents:**
- **NOAA CO-OPS API**: Tide predictions and water levels for all US stations. Supports harmonics-based predictions decades into the future.
- **Global tide models**: FES2014, TPXO9 for global tidal constituents.

**Bathymetry:**
- **GEBCO 2025**: Global ocean depth at 15 arc-second resolution (~450m). Critical for wave transformation calculations near shore.

---

## Part 2: The Multi-Model Ensemble Philosophy

### Why Combine Models?

No single weather model is best everywhere or for all conditions. Research from ECMWF, WMO, and Met Office demonstrates that **multi-model ensembles consistently outperform any individual model**. The reasons include:

1. **Error compensation**: Different models have different biases; averaging reduces systematic errors
2. **Uncertainty quantification**: Ensemble spread indicates forecast confidence
3. **Robustness**: If one model fails or produces anomalous output, others provide backup
4. **Skill optimization**: Models can be weighted by historical performance for specific regions/seasons

### Ensemble Combination Methods

**Simple Pooling**: Treat all model ensemble members as one large ensemble. Simple but effective baseline.

**Weighted Averaging**: Assign weights based on historical skill. Typical approach:
- Weight proportional to √(ensemble size) as baseline
- Adjust based on Brier Skill Score from hindcast verification
- Region-specific and season-specific weights

**Probabilistic Combination**: Compute tercile probabilities from each model independently, then combine using total probability formula:
```
P(event) = Σ P(event|model_i) × weight_i
```

**Machine Learning Post-Processing**: Train neural networks on historical forecast-observation pairs to learn systematic corrections. This is where we can add significant value.

---

## Part 3: System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │
│  │ WAVEWATCH │  │   ECMWF   │  │    GFS    │  │   NDBC    │  │ Copernicus│ │
│  │    III    │  │  WAM/IFS  │  │   Wave    │  │   Buoys   │  │  Marine   │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘ │
│        │              │              │              │              │        │
│        └──────────────┴──────────────┴──────────────┴──────────────┘        │
│                                      │                                       │
│                            ┌─────────▼─────────┐                            │
│                            │   GRIB/NetCDF     │                            │
│                            │    Processor      │                            │
│                            └─────────┬─────────┘                            │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                        DATA STORAGE LAYER                                    │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                            ┌─────────▼─────────┐                            │
│  ┌─────────────┐          │   Time-Series     │          ┌─────────────┐   │
│  │   Object    │◄─────────┤   Database        ├─────────►│   Spatial   │   │
│  │   Storage   │          │  (TimescaleDB)    │          │    Index    │   │
│  │  (Raw GRIB) │          └─────────┬─────────┘          │  (PostGIS)  │   │
│  └─────────────┘                    │                    └─────────────┘   │
│                            ┌─────────▼─────────┐                            │
│                            │     Zarr/Parquet  │                            │
│                            │   Analysis Store  │                            │
│                            └─────────┬─────────┘                            │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                     PROCESSING & MODEL LAYER                                 │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                            ┌─────────▼─────────┐                            │
│                            │  Multi-Model      │                            │
│                            │  Ensemble Engine  │                            │
│                            └─────────┬─────────┘                            │
│                                      │                                       │
│        ┌─────────────────────────────┼─────────────────────────────┐        │
│        │                             │                             │        │
│  ┌─────▼─────┐               ┌───────▼───────┐             ┌───────▼─────┐ │
│  │  Spatial  │               │     ML        │             │   Tide &    │ │
│  │Interpolator│              │ Post-Process  │             │  Bathymetry │ │
│  │ (Kriging) │               │    Model      │             │   Engine    │ │
│  └─────┬─────┘               └───────┬───────┘             └───────┬─────┘ │
│        │                             │                             │        │
│        └─────────────────────────────┴─────────────────────────────┘        │
│                                      │                                       │
│                            ┌─────────▼─────────┐                            │
│                            │   Nearshore       │                            │
│                            │   Transformation  │                            │
│                            │      Model        │                            │
│                            └─────────┬─────────┘                            │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼──────────────────────────────────────┐
│                           API LAYER                                          │
├──────────────────────────────────────┼──────────────────────────────────────┤
│                            ┌─────────▼─────────┐                            │
│                            │    REST/GraphQL   │                            │
│                            │       API         │                            │
│                            └─────────┬─────────┘                            │
│                                      │                                       │
│                            ┌─────────▼─────────┐                            │
│                            │    Cache Layer    │                            │
│                            │     (Redis)       │                            │
│                            └─────────┬─────────┘                            │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       │
                                       ▼
                            ┌───────────────────┐
                            │   User Interface  │
                            │  (Map + Location) │
                            └───────────────────┘
```

---

## Part 4: Core Processing Pipeline

### Stage 1: Data Ingestion (Every 6 hours)

The system runs automated jobs synchronized with model update cycles:
- **00Z, 06Z, 12Z, 18Z**: GFS and ECMWF atmospheric/wave updates
- **Continuous**: NDBC buoy observations (updated hourly)
- **Daily**: Copernicus marine products

Each data source has a dedicated collector that:
1. Checks for new data availability
2. Downloads only changed/new files
3. Validates checksums and completeness
4. Converts to internal format
5. Registers in metadata catalog

### Stage 2: Spatial Harmonization

Different models use different grids:
- ECMWF: Reduced Gaussian grid
- GFS: Regular lat/lon
- WAVEWATCH III: Multiple resolution grids

The harmonization layer:
1. Reprojects all data to a common reference grid (0.1° for most uses)
2. Handles land masking consistently
3. Interpolates in time to common validity times
4. Preserves original data for point-specific queries

### Stage 3: Ensemble Assembly

For each forecast validity time:
1. Collect all available model forecasts
2. Apply quality control (reject outliers, check physics constraints)
3. Compute weighted ensemble mean and spread
4. Generate probabilistic products (percentiles, exceedance probabilities)

### Stage 4: Machine Learning Enhancement

The ML layer learns to correct systematic biases:

**Training Data**:
- 5+ years of hindcast-observation pairs
- Buoy observations as ground truth
- Model forecasts aligned to observation times/locations

**Model Architecture**:
- Location-specific: Train separate models per buoy/region
- Features: Raw ensemble forecast, spread, model disagreement, bathymetry, season, etc.
- Output: Corrected forecast + calibrated uncertainty

**Implementation Approaches**:
1. **Gradient Boosted Trees (XGBoost)**: Fast, interpretable, works well with tabular features
2. **LSTM Networks**: For capturing temporal dependencies in forecast errors
3. **Convolutional Networks**: For spatial patterns in gridded data

### Stage 5: Nearshore Transformation

Deep-water wave forecasts need adjustment for coastal conditions:

1. **Wave Refraction**: Waves bend as depth decreases
2. **Shoaling**: Wave height increases in shallow water
3. **Breaking**: Depth-limited breaking calculations
4. **Local Effects**: Headlands, islands, submarine canyons

Simplified linear spectral refraction model:
- Use GEBCO bathymetry
- Apply Snell's law for each spectral component
- Compute local wave height transformation coefficient

---

## Part 5: The Forecast Output

For any user-selected coordinate, the system returns:

**Wave Conditions:**
- Significant wave height (Hs) with confidence interval
- Peak wave period (Tp)
- Primary and secondary swell: height, period, direction
- Wind-wave component
- Wave energy spectrum (if available)

**Wind:**
- Speed and direction at 10m
- Gusts
- Trend indicators

**Tides:**
- High/low times and heights
- Current water level (near tide stations)
- Tidal current direction and speed (where available)

**Temperature:**
- Sea surface temperature
- Air temperature

**Metadata:**
- Forecast confidence (based on ensemble spread)
- Data source attribution
- Model update time
- Nearest observation station

---

## Part 6: Technology Choices

### Data Storage
- **TimescaleDB**: PostgreSQL extension optimized for time-series. Handles billions of observations efficiently.
- **PostGIS**: Spatial indexing for location queries
- **Object Storage (S3-compatible)**: Raw GRIB/NetCDF archive
- **Zarr**: Cloud-optimized format for large gridded datasets

### Processing
- **Python**: Data processing (xarray, pandas, numpy)
- **Dask**: Parallel/distributed computation
- **cfgrib/eccodes**: GRIB file handling
- **PyTorch/TensorFlow**: ML model training

### Infrastructure
- **Kubernetes**: Container orchestration
- **Apache Airflow**: Workflow scheduling
- **Redis**: Caching layer
- **Grafana**: Monitoring

### API
- **FastAPI**: High-performance Python web framework
- **GraphQL**: Flexible queries for frontend
- **MapLibre/Leaflet**: Map visualization

---

## Part 7: Scaling Considerations

### Compute Requirements

**Data Ingestion**: ~50GB/day of raw forecast data
- WAVEWATCH III global: ~2GB per cycle
- ECMWF open data: ~5GB per cycle
- GFS: ~10GB per cycle (subset)

**Storage**: ~20TB first year
- 6 months rolling operational data: ~5TB
- Training dataset archive: ~15TB

**Processing**: 
- Ensemble computation: Minutes per cycle on modern hardware
- ML inference: <100ms per location
- Can run on single high-memory server initially

### Optimization Strategies

1. **Pre-compute popular regions**: Cache forecasts for known surf spots
2. **Lazy loading**: Only process detailed nearshore model on demand
3. **Progressive detail**: Return coarse forecast immediately, refine async
4. **Geographic sharding**: Partition by ocean basin for parallel processing

---

## Part 8: Implementation Roadmap

### Phase 1: Foundation (Months 1-2)
- Set up data ingestion for WAVEWATCH III and NDBC buoys
- Implement basic storage schema
- Build simple point query API
- Validate against buoy observations

### Phase 2: Multi-Model (Months 3-4)
- Add ECMWF open data integration
- Implement ensemble combination
- Add GFS atmospheric data
- Build confidence metrics

### Phase 3: Intelligence (Months 5-6)
- Train ML bias correction models
- Implement nearshore transformation
- Add tide integration
- Develop calibration framework

### Phase 4: Production (Months 7-8)
- Build user-facing API
- Implement caching and optimization
- Deploy monitoring and alerting
- Launch beta with select users

---

## Part 9: Key Success Factors

1. **Data Quality**: Rigorous QC on inputs; bad data in = bad forecasts out
2. **Verification**: Continuous comparison against observations; track skill metrics
3. **Iteration**: Start simple, add complexity only where it improves skill
4. **User Feedback**: Local surfers know their breaks; incorporate local knowledge
5. **Transparency**: Show confidence, explain when forecasts are uncertain

---

## Conclusion

Building a global marine forecast system from public data is ambitious but achievable. The key insight is that **combining multiple imperfect models with intelligent post-processing can rival or exceed commercial products**—without the licensing costs.

The system described here leverages decades of publicly-funded meteorological research and increasingly available open data from organizations like ECMWF, NOAA, and Copernicus. With careful engineering and continuous validation against observations, this architecture can deliver accurate, location-specific marine forecasts anywhere in the world.

The machine learning layer is where real competitive advantage lies: by training on historical forecast-observation pairs, the system can learn the systematic biases of physics-based models and correct them—something traditional NWP cannot do. This is exactly the approach taken by commercial leaders like Surfline, and it's now accessible to anyone willing to invest the engineering effort.
