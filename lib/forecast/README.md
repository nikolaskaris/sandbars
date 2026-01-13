# Sandbars Multi-Source Forecast System

## Overview

This forecast system implements a comprehensive, multi-source data architecture that provides accurate surf forecasts with transparency about data quality and sources.

## Architecture

### Three-Tier Caching System

```
┌─────────────────────────────────────────────┐
│  Tier 1: Location Query API                 │
│  (User requests lat/lon)                    │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Tier 2: API Route Caching                  │
│  - Individual source caching                │
│  - 30 min for NWS, 1 hour for NDBC          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  Tier 3: Source Data Fetchers               │
│  - NDBC buoy observations                   │
│  - NWS weather forecasts                    │
│  - Tides & Currents predictions             │
└─────────────────────────────────────────────┘
```

### Data Sources

#### 1. NDBC (National Data Buoy Center)
- **Metrics**: Wave height, period, direction, wind speed/direction, water temp
- **Quality**: Primary (direct observations)
- **Cache**: 30 minutes
- **Range**: Up to 200km from buoy

#### 2. NOAA NWS (National Weather Service)
- **Metrics**: Air temperature, wind speed/direction
- **Quality**: Primary (forecast data)
- **Cache**: 30 minutes (forecast), 1 hour (grid points)
- **Coverage**: All US coastal areas

#### 3. NOAA Tides & Currents
- **Metrics**: Tide levels
- **Quality**: Primary (predictions)
- **Cache**: 24 hours (static predictions)
- **Range**: Up to 100km from station

### Multi-Source Hierarchy

For each metric, the system implements a priority cascade:

#### Wave Height
1. **Primary**: Nearest NDBC buoy (< 50km)
2. **Secondary**: Interpolate from 2-5 nearby buoys (< 100km)
3. **Tertiary**: WaveWatch III model data (not yet implemented)
4. **Fallback**: Historical average (1.0m default)

#### Air Temperature
1. **Primary**: NWS API point forecast
2. **Secondary**: Nearest NWS observation station (not yet implemented)
3. **Tertiary**: NDBC buoy air temp (if available)
4. **Fallback**: Missing data indicator

#### Wind Data
1. **Primary**: NWS forecast
2. **Secondary**: Interpolate from nearby buoys
3. **Fallback**: 5 m/s default for speed, missing for direction

### Spatial Interpolation

**Inverse Distance Weighting (IDW)** is used when primary sources are unavailable:

```
Weight = 1 / distance²
Interpolated Value = Σ(value_i × weight_i) / Σ(weight_i)
```

Special considerations:
- **Wave data**: Higher power (³) near shore (< 10km) due to local variation
- **Wind data**: Cautious near coastline (< 5km) due to land/sea effects
- **Water temp**: Simple averaging (changes slowly over 24h)

### Data Quality Flags

Every metric includes a quality flag:

- **`primary`**: Direct observation from a station
- **`interpolated`**: Derived from multiple nearby stations
- **`modeled`**: From numerical weather model
- **`stale`**: Data more than 3 hours old
- **`historical`**: Fallback to climatology
- **`missing`**: No data available

## API Usage

### Get Forecast (Legacy Format)

```typescript
GET /api/forecast?lat=37.8&lng=-122.5

Response: SurfForecast[]
```

### Get Enhanced Forecast

```typescript
GET /api/forecast?lat=37.8&lng=-122.5&enhanced=true

Response: {
  forecasts: EnhancedSurfForecast[],
  metadata: {
    generated_at: string,
    primary_sources: number,
    interpolated_sources: number,
    modeled_sources: number
  }
}
```

### Custom Time Range

```typescript
GET /api/forecast?lat=37.8&lng=-122.5&hours=48

// Returns 48 hours instead of default 168 (7 days)
```

## Derived Metrics

### Wave Power

Calculated using the formula:

```
P = 0.5 × ρ × g × H² × T
```

Where:
- ρ = 1025 kg/m³ (seawater density)
- g = 9.81 m/s²
- H = significant wave height (meters)
- T = wave period (seconds)

Result in kW/m

### Surf Quality Score (Future)

Based on:
- Wave height (optimal: 1-2.5m)
- Wave period (optimal: 10-16s)
- Wind speed (optimal: < 5 m/s)
- Wind/wave direction relationship (offshore wind is best)

Score: 0-10

## Database Schema

### Stations Table
Stores information about all data sources (buoys, weather stations, tide stations).

### Observations Table
Historical observations with quality flags and source hierarchy tracking.

### Location Cache Table
Compiled forecast data for locations with 30-minute expiry.

## Rate Limits

All NOAA APIs have informal, generous limits:

- **NDBC**: No published limits, hourly scraping is fine
- **NWS API**: ~5 req/sec per IP, no auth required
- **Tides & Currents**: No published limits
- **Best Practice**: Aggressive caching, hourly updates

## Future Enhancements

1. **WaveWatch III Integration**: Add gridded wave model forecasts
2. **Database Caching**: Implement Tier 2 cache in Supabase
3. **Background Jobs**: Scheduled updates for popular locations
4. **Distance to Shore**: Calculate actual coastline distance for better interpolation
5. **Historical Data**: Build climatology database for better fallbacks
6. **Surf Quality Scoring**: Implement algorithmic surf quality ratings

## Usage Example

```typescript
import { getSurfForecast } from '@/lib/forecast';

const forecast = await getSurfForecast(37.8, -122.5, 168);

// Access enhanced data with quality indicators
forecast.forecasts[0].waveHeight.quality; // 'primary'
forecast.forecasts[0].waveHeight.min; // 1.2
forecast.forecasts[0].wavePower?.value; // 8.5 kW/m

// Metadata about data sources
forecast.metadata.primary_sources; // 120 (out of 168 hours)
```

## Quality Transparency

The UI can display:
- Quality badges for each metric
- Data source information ("NDBC Buoy 46026 - 12km away")
- Freshness indicators
- Fallback notifications

Use the `QualityIndicator` component:

```tsx
import QualityIndicator from '@/components/forecast/QualityIndicator';

<QualityIndicator quality={forecast.waveHeight.quality} />
```
