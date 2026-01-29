/**
 * Generate mock wave data on a uniform grid, masking out land areas.
 * Uses Natural Earth land polygons and Turf.js for point-in-polygon checks.
 *
 * Data model includes:
 * - Multiple swell partitions (primary, secondary, tertiary)
 * - Wind speed and direction
 */

const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

// Configuration
const GRID_SPACING = 6; // degrees
const LAT_MIN = -70;
const LAT_MAX = 70;
const LON_MIN = -180;
const LON_MAX = 180;

// Load Natural Earth land polygons
const landPath = path.join(__dirname, 'ne_110m_land.geojson');
const landData = JSON.parse(fs.readFileSync(landPath, 'utf8'));

console.log(`Loaded ${landData.features.length} land features`);

/**
 * Check if a point is on land (inside any land polygon)
 */
function isOnLand(lon, lat) {
  const point = turf.point([lon, lat]);

  for (const feature of landData.features) {
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      if (turf.booleanPointInPolygon(point, feature)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Round to one decimal place
 */
function round1(val) {
  return Math.round(val * 10) / 10;
}

/**
 * Generate a direction offset from a base direction
 */
function offsetDirection(baseDir, minOffset, maxOffset) {
  const offset = minOffset + Math.random() * (maxOffset - minOffset);
  const sign = Math.random() > 0.5 ? 1 : -1;
  return (baseDir + sign * offset + 360) % 360;
}

/**
 * Generate realistic wave and wind properties based on latitude
 */
function generateWaveProperties(lat) {
  const absLat = Math.abs(lat);

  // Primary swell - always present, based on latitude
  let primaryHeight, primaryPeriod;
  let windSpeedMin, windSpeedMax;

  if (absLat > 45) {
    // High latitudes - stormy
    primaryHeight = 3 + Math.random() * 5; // 3-8m
    primaryPeriod = 10 + Math.random() * 8; // 10-18s
    windSpeedMin = 10;
    windSpeedMax = 25;
  } else if (absLat > 25) {
    // Mid latitudes - moderate
    primaryHeight = 1.5 + Math.random() * 3; // 1.5-4.5m
    primaryPeriod = 8 + Math.random() * 6; // 8-14s
    windSpeedMin = 5;
    windSpeedMax = 15;
  } else {
    // Tropics - calm
    primaryHeight = 0.5 + Math.random() * 2; // 0.5-2.5m
    primaryPeriod = 5 + Math.random() * 5; // 5-10s
    windSpeedMin = 3;
    windSpeedMax = 10;
  }

  const primaryDirection = Math.floor(Math.random() * 360);

  // Build swells array
  const swells = [
    {
      height: round1(primaryHeight),
      period: round1(primaryPeriod),
      direction: primaryDirection
    }
  ];

  // Secondary swell - 50% chance, 30-70% of primary height
  if (Math.random() < 0.5) {
    const secondaryHeight = primaryHeight * (0.3 + Math.random() * 0.4);
    const secondaryPeriod = 5 + Math.random() * 10; // 5-15s
    const secondaryDirection = offsetDirection(primaryDirection, 60, 120);

    swells.push({
      height: round1(secondaryHeight),
      period: round1(secondaryPeriod),
      direction: Math.floor(secondaryDirection)
    });
  }

  // Tertiary swell - 20% chance, 20-50% of primary height
  if (Math.random() < 0.2) {
    const tertiaryHeight = primaryHeight * (0.2 + Math.random() * 0.3);
    const tertiaryPeriod = 4 + Math.random() * 8; // 4-12s
    const tertiaryDirection = offsetDirection(primaryDirection, 90, 180);

    swells.push({
      height: round1(tertiaryHeight),
      period: round1(tertiaryPeriod),
      direction: Math.floor(tertiaryDirection)
    });
  }

  // Wind - correlate loosely with latitude, bias toward swell direction
  const windSpeed = round1(windSpeedMin + Math.random() * (windSpeedMax - windSpeedMin));
  // Wind direction: bias toward primary swell direction (±45°) for realism
  const windDirection = Math.floor(offsetDirection(primaryDirection, 0, 45));

  return {
    swells,
    wind: {
      speed: windSpeed,
      direction: windDirection
    },
    // Keep top-level waveHeight for circle sizing (primary swell height)
    waveHeight: round1(primaryHeight)
  };
}

// Generate grid points
const features = [];
let landCount = 0;
let oceanCount = 0;

console.log('Generating wave grid...');

for (let lat = LAT_MIN; lat <= LAT_MAX; lat += GRID_SPACING) {
  for (let lon = LON_MIN; lon < LON_MAX; lon += GRID_SPACING) {
    if (isOnLand(lon, lat)) {
      landCount++;
      continue;
    }

    const props = generateWaveProperties(lat);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lon, lat]
      },
      properties: props
    });

    oceanCount++;
  }
}

// Create GeoJSON FeatureCollection
const geojson = {
  type: 'FeatureCollection',
  features
};

// Write output
const outputPath = path.join(__dirname, '..', 'public', 'data', 'mock-waves.geojson');
fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

console.log(`\nGeneration complete!`);
console.log(`- Land points skipped: ${landCount}`);
console.log(`- Ocean points generated: ${oceanCount}`);
console.log(`- Output written to: ${outputPath}`);
