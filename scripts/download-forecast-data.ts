/**
 * Download Forecast Test Data
 *
 * Downloads wave and wind forecast data for a 7-day window (168 hours)
 * at 3-hour intervals for local testing of the forecast slider.
 *
 * Usage: npx tsx scripts/download-forecast-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'forecasts');

// Forecast hours to download (0 to 168 hours in 3-hour steps)
const FORECAST_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 30, 36, 42, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168];

// ERDDAP endpoints
const WW3_BASE = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ww3_global';
const GFS_BASE = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/NCEP_Global_Best';

interface WaveDataPoint {
  lat: number;
  lon: number;
  waveHeight: number;
  waveDirection: number;
  wavePeriod: number;
}

interface WindDataPoint {
  lat: number;
  lon: number;
  u: number;
  v: number;
  speed: number;
  direction: number;
}

/**
 * Fetch wave data from WAVEWATCH III (latest available)
 */
async function fetchWaveData(): Promise<WaveDataPoint[]> {
  const stride = 4; // 2° resolution
  const minLat = -74;
  const maxLat = 80;

  // Fetch eastern hemisphere (0-180) - using (last) for most recent
  const eastUrl = `${WW3_BASE}.json?` +
    `Thgt[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(0):${stride}:(180)],` +
    `Tdir[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(0):${stride}:(180)],` +
    `Tper[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(0):${stride}:(180)]`;

  // Fetch western hemisphere (180-360 = -180 to 0)
  const westUrl = `${WW3_BASE}.json?` +
    `Thgt[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(180):${stride}:(359.5)],` +
    `Tdir[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(180):${stride}:(359.5)],` +
    `Tper[(last)][(0.0)][(${minLat}):${stride}:(${maxLat})][(180):${stride}:(359.5)]`;

  const points: WaveDataPoint[] = [];

  for (const url of [eastUrl, westUrl]) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        console.error(`Wave fetch failed: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (!data.table?.rows) continue;

      const { columnNames, rows } = data.table;
      const latIdx = columnNames.indexOf('latitude');
      const lonIdx = columnNames.indexOf('longitude');
      const hgtIdx = columnNames.indexOf('Thgt');
      const dirIdx = columnNames.indexOf('Tdir');
      const perIdx = columnNames.indexOf('Tper');

      for (const row of rows) {
        const waveHeight = row[hgtIdx];
        if (waveHeight === null || isNaN(waveHeight)) continue;

        let lon = row[lonIdx];
        if (lon > 180) lon = lon - 360;

        points.push({
          lat: row[latIdx],
          lon,
          waveHeight: Math.round(waveHeight * 100) / 100,
          waveDirection: row[dirIdx] ?? 0,
          wavePeriod: row[perIdx] ?? 0,
        });
      }
    } catch (err) {
      console.error(`Error fetching wave data:`, err);
    }
  }

  return points;
}

/**
 * Fetch wind data from GFS (latest available)
 */
async function fetchWindData(): Promise<WindDataPoint[]> {
  const stride = 8; // 4° resolution
  const minLat = -77.5;
  const maxLat = 77.5;

  const points: WindDataPoint[] = [];

  // Fetch eastern hemisphere (0-180)
  const eastUrl = `${GFS_BASE}.json?` +
    `ugrd10m[(last)][(${minLat}):${stride}:(${maxLat})][(0):${stride}:(180)],` +
    `vgrd10m[(last)][(${minLat}):${stride}:(${maxLat})][(0):${stride}:(180)]`;

  // Fetch western hemisphere
  const westUrl = `${GFS_BASE}.json?` +
    `ugrd10m[(last)][(${minLat}):${stride}:(${maxLat})][(180):${stride}:(359.5)],` +
    `vgrd10m[(last)][(${minLat}):${stride}:(${maxLat})][(180):${stride}:(359.5)]`;

  for (const url of [eastUrl, westUrl]) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        console.error(`Wind fetch failed: ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (!data.table?.rows) continue;

      const { columnNames, rows } = data.table;
      const latIdx = columnNames.indexOf('latitude');
      const lonIdx = columnNames.indexOf('longitude');
      const uIdx = columnNames.indexOf('ugrd10m');
      const vIdx = columnNames.indexOf('vgrd10m');

      for (const row of rows) {
        const u = row[uIdx];
        const v = row[vIdx];
        if (u === null || v === null || isNaN(u) || isNaN(v)) continue;

        let lon = row[lonIdx];
        if (lon > 180) lon = lon - 360;

        const speed = Math.sqrt(u * u + v * v);
        const direction = (Math.atan2(-u, -v) * 180) / Math.PI;

        points.push({
          lat: row[latIdx],
          lon,
          u: Math.round(u * 100) / 100,
          v: Math.round(v * 100) / 100,
          speed: Math.round(speed * 100) / 100,
          direction: Math.round(direction < 0 ? direction + 360 : direction),
        });
      }
    } catch (err) {
      console.error(`Error fetching wind data:`, err);
    }
  }

  return points;
}

/**
 * Generate synthetic time-varying data based on base data
 * Adds realistic temporal variation to simulate forecast changes
 */
function generateTimeVariation(
  baseData: WaveDataPoint[],
  forecastHour: number
): WaveDataPoint[] {
  // Add time-based variation to simulate weather system movement
  const timeOffset = forecastHour / 24; // Days from now
  const phaseShift = timeOffset * 0.5; // Gradual shift in patterns

  return baseData.map(point => {
    // Create subtle variations that increase with forecast time
    const latFactor = Math.sin((point.lat + phaseShift * 10) * 0.1);
    const lonFactor = Math.cos((point.lon + phaseShift * 15) * 0.08);
    const timeFactor = 1 + (Math.sin(forecastHour * 0.1) * 0.2);

    // Wave height varies more at high latitudes (storm tracks)
    const latIntensity = Math.abs(point.lat) > 40 ? 1.5 : 1.0;
    const heightVariation = latFactor * lonFactor * 0.5 * latIntensity * timeFactor;

    // Direction shifts slightly over time
    const directionShift = Math.sin(forecastHour * 0.05) * 15;

    return {
      lat: point.lat,
      lon: point.lon,
      waveHeight: Math.max(0.3, point.waveHeight + heightVariation),
      waveDirection: (point.waveDirection + directionShift + 360) % 360,
      wavePeriod: point.wavePeriod + Math.sin(forecastHour * 0.1) * 1.5,
    };
  });
}

function generateWindVariation(
  baseData: WindDataPoint[],
  forecastHour: number
): WindDataPoint[] {
  const timeOffset = forecastHour / 24;
  const phaseShift = timeOffset * 0.3;

  return baseData.map(point => {
    const latFactor = Math.sin((point.lat + phaseShift * 8) * 0.12);
    const lonFactor = Math.cos((point.lon + phaseShift * 12) * 0.1);
    const variation = latFactor * lonFactor * 2;

    const newU = point.u + variation * Math.cos(forecastHour * 0.1);
    const newV = point.v + variation * Math.sin(forecastHour * 0.1);
    const speed = Math.sqrt(newU * newU + newV * newV);
    const direction = (Math.atan2(-newU, -newV) * 180) / Math.PI;

    return {
      lat: point.lat,
      lon: point.lon,
      u: Math.round(newU * 100) / 100,
      v: Math.round(newV * 100) / 100,
      speed: Math.round(speed * 100) / 100,
      direction: Math.round(direction < 0 ? direction + 360 : direction),
    };
  });
}

async function main() {
  console.log('=== Downloading Forecast Test Data ===\n');

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Fetch base data from local API (which handles ERDDAP quirks)
  console.log('Fetching base wave data from local API...');
  let baseWaveData: WaveDataPoint[] = [];
  try {
    const waveRes = await fetch('http://localhost:3000/api/waves/grid?direct=true');
    if (waveRes.ok) {
      const waveJson = await waveRes.json();
      baseWaveData = waveJson.grid || [];
    }
  } catch (err) {
    console.log('  Local API not available, trying ERDDAP directly...');
    baseWaveData = await fetchWaveData();
  }
  console.log(`  Retrieved ${baseWaveData.length} wave points`);

  console.log('Fetching base wind data from local API...');
  let baseWindData: WindDataPoint[] = [];
  try {
    const windRes = await fetch('http://localhost:3000/api/wind/grid');
    if (windRes.ok) {
      const windJson = await windRes.json();
      baseWindData = windJson.grid || [];
    }
  } catch (err) {
    console.log('  Local API not available, trying ERDDAP directly...');
    baseWindData = await fetchWindData();
  }
  console.log(`  Retrieved ${baseWindData.length} wind points`);

  if (baseWaveData.length === 0) {
    console.error('Failed to fetch wave data. Please ensure the dev server is running.');
    process.exit(1);
  }

  // Generate data for each forecast hour
  console.log(`\nGenerating forecast data for ${FORECAST_HOURS.length} time steps...`);

  const modelRun = new Date().toISOString();
  const forecastData: Record<number, { waves: WaveDataPoint[]; wind: WindDataPoint[] }> = {};

  for (const hour of FORECAST_HOURS) {
    process.stdout.write(`  Hour ${hour}...`);

    // Generate time-varying data based on base data
    const waveData = hour === 0 ? baseWaveData : generateTimeVariation(baseWaveData, hour);
    const windData = hour === 0 ? baseWindData : generateWindVariation(baseWindData, hour);

    forecastData[hour] = { waves: waveData, wind: windData };
    console.log(` ${waveData.length} wave, ${windData.length} wind points`);
  }

  // Save to files
  const outputFile = path.join(DATA_DIR, 'forecast-data.json');
  const output = {
    modelRun,
    generatedAt: new Date().toISOString(),
    forecastHours: FORECAST_HOURS,
    data: forecastData,
  };

  fs.writeFileSync(outputFile, JSON.stringify(output));

  const fileSizeMB = (fs.statSync(outputFile).size / (1024 * 1024)).toFixed(2);
  console.log(`\n✓ Saved forecast data to ${outputFile} (${fileSizeMB} MB)`);

  // Also save a summary
  const summaryFile = path.join(DATA_DIR, 'forecast-summary.json');
  const summary = {
    modelRun,
    generatedAt: new Date().toISOString(),
    forecastHours: FORECAST_HOURS,
    wavePointCount: baseWaveData.length,
    windPointCount: baseWindData.length,
    totalTimeSteps: FORECAST_HOURS.length,
    waveBounds: {
      minLat: Math.min(...baseWaveData.map(p => p.lat)),
      maxLat: Math.max(...baseWaveData.map(p => p.lat)),
      minLon: Math.min(...baseWaveData.map(p => p.lon)),
      maxLon: Math.max(...baseWaveData.map(p => p.lon)),
    },
    windBounds: {
      minLat: Math.min(...baseWindData.map(p => p.lat)),
      maxLat: Math.max(...baseWindData.map(p => p.lat)),
      minLon: Math.min(...baseWindData.map(p => p.lon)),
      maxLon: Math.max(...baseWindData.map(p => p.lon)),
    },
  };

  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`✓ Saved summary to ${summaryFile}`);

  console.log('\n=== Done! ===');
  console.log(`You can now test the forecast slider with ${FORECAST_HOURS.length} time steps.`);
}

main().catch(console.error);
