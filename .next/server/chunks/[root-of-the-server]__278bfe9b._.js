module.exports = [
"[project]/.next-internal/server/app/api/forecast/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/supabase/server.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
;
;
async function createClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://azxmuhckfajyqmwadote.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6eG11aGNrZmFqeXFtd2Fkb3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzMzM0NTcsImV4cCI6MjA3NzkwOTQ1N30.5Erqlu2joCv7HOuC70ljoRf1bk-Zer0egMLDi2zAmNA"), {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
                }
            }
        }
    });
}
}),
"[project]/lib/forecast/sources/ndbc.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * NDBC (National Data Buoy Center) Data Source
 * Fetches real-time buoy observations
 */ __turbopack_context__.s([
    "NDBC_BUOYS",
    ()=>NDBC_BUOYS,
    "calculateDistance",
    ()=>calculateDistance,
    "fetchNDBCBuoyData",
    ()=>fetchNDBCBuoyData,
    "findNearestBuoys",
    ()=>findNearestBuoys
]);
const NDBC_API_URL = 'https://www.ndbc.noaa.gov';
const NDBC_BUOYS = [
    // California Coast
    {
        id: '46221',
        lat: 33.8,
        lon: -118.3,
        name: 'Santa Monica Basin'
    },
    {
        id: '46222',
        lat: 33.6,
        lon: -117.9,
        name: 'San Pedro'
    },
    {
        id: '46232',
        lat: 37.5,
        lon: -122.5,
        name: 'Point Reyes'
    },
    {
        id: '46237',
        lat: 37.8,
        lon: -122.4,
        name: 'San Francisco'
    },
    {
        id: '46254',
        lat: 33.2,
        lon: -119.9,
        name: 'Ventura'
    },
    {
        id: '46025',
        lat: 33.7,
        lon: -119.1,
        name: 'Santa Monica'
    },
    {
        id: '46215',
        lat: 40.8,
        lon: -124.5,
        name: 'Cape Mendocino'
    },
    {
        id: '46014',
        lat: 39.2,
        lon: -123.3,
        name: 'Point Arena'
    },
    {
        id: '46026',
        lat: 37.8,
        lon: -122.8,
        name: 'San Francisco Bar'
    },
    {
        id: '46012',
        lat: 37.4,
        lon: -122.9,
        name: 'Half Moon Bay'
    },
    {
        id: '46042',
        lat: 36.8,
        lon: -122.4,
        name: 'Monterey Bay'
    },
    {
        id: '46011',
        lat: 34.9,
        lon: -121.0,
        name: 'Santa Maria'
    },
    // Hawaii
    {
        id: '51201',
        lat: 24.4,
        lon: -162.1,
        name: 'Hanalei'
    },
    {
        id: '51202',
        lat: 21.5,
        lon: -157.8,
        name: 'Waimea Bay'
    },
    // East Coast
    {
        id: '44025',
        lat: 40.3,
        lon: -73.2,
        name: 'Long Island'
    },
    {
        id: '44065',
        lat: 40.4,
        lon: -73.7,
        name: 'New York Harbor'
    },
    {
        id: '41010',
        lat: 28.9,
        lon: -78.5,
        name: 'Canaveral East'
    },
    {
        id: '42040',
        lat: 29.2,
        lon: -88.2,
        name: 'Luke Offshore'
    }
];
/**
 * Check if a value is missing (NDBC missing data markers)
 */ function isMissing(val) {
    if (val === undefined || val === null) return true;
    const strVal = String(val);
    return strVal === 'MM' || strVal === '999' || strVal === '999.0' || strVal === '99.0';
}
/**
 * Determine quality flag based on data freshness
 */ function determineQuality(timestamp) {
    const age = Date.now() - timestamp.getTime();
    const hoursOld = age / (1000 * 60 * 60);
    if (hoursOld < 1) return 'primary';
    if (hoursOld < 3) return 'primary';
    return 'stale';
}
async function fetchNDBCBuoyData(buoyId) {
    try {
        const response = await fetch(`${NDBC_API_URL}/data/realtime2/${buoyId}.txt`, {
            next: {
                revalidate: 1800
            },
            headers: {
                'User-Agent': '(Sandbars Surf App, contact@sandbars.app)'
            }
        });
        if (!response.ok) {
            console.error(`NDBC API error for buoy ${buoyId}: ${response.statusText}`);
            return null;
        }
        const text = await response.text();
        const lines = text.split('\n');
        // Parse the latest data (line 2, after header lines)
        if (lines.length < 3) {
            return null;
        }
        // NDBC format: YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS TIDE
        const data = lines[2].trim().split(/\s+/);
        if (data.length < 15) {
            console.error(`NDBC buoy ${buoyId}: Insufficient data fields`);
            return null;
        }
        // Parse timestamp
        const year = parseInt(data[0]) + 2000; // YY format
        const month = data[1];
        const day = data[2];
        const hour = data[3];
        const minute = data[4];
        const timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
        // Parse values
        const waveHeight = parseFloat(data[8]); // WVHT - significant wave height (meters)
        const dominantPeriod = parseFloat(data[9]); // DPD - dominant wave period (seconds)
        const avgPeriod = parseFloat(data[10]); // APD - average wave period (seconds)
        const waveDir = parseFloat(data[11]); // MWD - wave direction (degrees)
        const windSpeed = parseFloat(data[6]); // WSPD - wind speed (m/s)
        const windDir = parseFloat(data[5]); // WDIR - wind direction (degrees)
        const airTemp = parseFloat(data[13]); // ATMP - air temperature (°C)
        const waterTemp = parseFloat(data[14]); // WTMP - water temperature (°C)
        const quality = determineQuality(timestamp);
        return {
            timestamp: timestamp.toISOString(),
            waveHeight: !isNaN(waveHeight) && !isMissing(waveHeight) && waveHeight < 99 ? waveHeight : undefined,
            dominantWavePeriod: !isNaN(dominantPeriod) && !isMissing(dominantPeriod) && dominantPeriod < 99 ? dominantPeriod : undefined,
            averageWavePeriod: !isNaN(avgPeriod) && !isMissing(avgPeriod) && avgPeriod < 99 ? avgPeriod : undefined,
            waveDirection: !isNaN(waveDir) && !isMissing(waveDir) && waveDir <= 360 ? waveDir : undefined,
            windSpeed: !isNaN(windSpeed) && !isMissing(windSpeed) && windSpeed < 99 ? windSpeed : undefined,
            windDirection: !isNaN(windDir) && !isMissing(windDir) && windDir <= 360 ? windDir : undefined,
            airTemperature: !isNaN(airTemp) && !isMissing(airTemp) && airTemp < 99 ? airTemp : undefined,
            waterTemperature: !isNaN(waterTemp) && !isMissing(waterTemp) && waterTemp < 99 ? waterTemp : undefined,
            quality
        };
    } catch (error) {
        console.error(`Error fetching NDBC buoy ${buoyId}:`, error);
        return null;
    }
}
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(degrees) {
    return degrees * (Math.PI / 180);
}
function findNearestBuoys(lat, lon, maxDistance = 200, count = 5) {
    const buoysWithDistance = NDBC_BUOYS.map((buoy)=>({
            ...buoy,
            distance: calculateDistance(lat, lon, buoy.lat, buoy.lon)
        }));
    return buoysWithDistance.filter((b)=>b.distance < maxDistance).sort((a, b)=>a.distance - b.distance).slice(0, count);
}
}),
"[project]/lib/forecast/sources/nws.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * NOAA NWS (National Weather Service) Data Source
 * Fetches weather forecasts and air temperature
 */ __turbopack_context__.s([
    "convertNWSToWeatherData",
    ()=>convertNWSToWeatherData,
    "fetchNWSForecast",
    ()=>fetchNWSForecast,
    "getWeatherAtTime",
    ()=>getWeatherAtTime,
    "parseWindDirection",
    ()=>parseWindDirection,
    "parseWindSpeed",
    ()=>parseWindSpeed
]);
const NWS_API_URL = 'https://api.weather.gov';
function parseWindSpeed(windSpeedStr) {
    const match = windSpeedStr.match(/(\d+)/);
    if (!match) return 0;
    const mph = parseInt(match[1]);
    return mph * 0.44704; // Convert mph to m/s
}
function parseWindDirection(dir) {
    const directions = {
        N: 0,
        NNE: 22.5,
        NE: 45,
        ENE: 67.5,
        E: 90,
        ESE: 112.5,
        SE: 135,
        SSE: 157.5,
        S: 180,
        SSW: 202.5,
        SW: 225,
        WSW: 247.5,
        W: 270,
        WNW: 292.5,
        NW: 315,
        NNW: 337.5
    };
    return directions[dir.toUpperCase()] || 0;
}
async function fetchNWSForecast(lat, lng) {
    try {
        // Step 1: Get the grid point for the coordinates
        const pointResponse = await fetch(`${NWS_API_URL}/points/${lat.toFixed(4)},${lng.toFixed(4)}`, {
            headers: {
                'User-Agent': '(Sandbars Surf App, contact@sandbars.app)'
            },
            next: {
                revalidate: 3600
            }
        });
        if (!pointResponse.ok) {
            console.error(`NWS points API error: ${pointResponse.statusText}`);
            return [];
        }
        const pointData = await pointResponse.json();
        // Step 2: Get the hourly forecast
        const forecastResponse = await fetch(pointData.properties.forecastHourly, {
            headers: {
                'User-Agent': '(Sandbars Surf App, contact@sandbars.app)'
            },
            next: {
                revalidate: 1800
            }
        });
        if (!forecastResponse.ok) {
            console.error(`NWS forecast API error: ${forecastResponse.statusText}`);
            return [];
        }
        const forecastData = await forecastResponse.json();
        return forecastData.properties.periods || [];
    } catch (error) {
        console.error('Error fetching NWS forecast:', error);
        return [];
    }
}
function convertNWSToWeatherData(periods) {
    return periods.map((period)=>({
            timestamp: period.startTime,
            airTemperature: period.temperatureUnit === 'F' ? (period.temperature - 32) * 5 / 9 // Convert to Celsius
             : period.temperature,
            windSpeed: parseWindSpeed(period.windSpeed),
            windDirection: parseWindDirection(period.windDirection),
            quality: 'primary'
        }));
}
function getWeatherAtTime(weatherData, targetTime) {
    const targetTimestamp = targetTime.getTime();
    // Find the closest forecast period
    let closest = null;
    let minDiff = Infinity;
    for (const data of weatherData){
        const dataTimestamp = new Date(data.timestamp).getTime();
        const diff = Math.abs(dataTimestamp - targetTimestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closest = data;
        }
    }
    // Only return if within 3 hours
    if (minDiff < 3 * 60 * 60 * 1000) {
        return closest;
    }
    return null;
}
}),
"[project]/lib/forecast/sources/tides.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * NOAA Tides & Currents Data Source
 * Fetches tide predictions
 */ __turbopack_context__.s([
    "TIDE_STATIONS",
    ()=>TIDE_STATIONS,
    "fetchTidePredictions",
    ()=>fetchTidePredictions,
    "findNearestTideStation",
    ()=>findNearestTideStation,
    "getTideAtTime",
    ()=>getTideAtTime
]);
const TIDES_API_URL = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const TIDE_STATIONS = [
    // California
    {
        id: '9410170',
        name: 'San Diego Bay',
        lat: 32.7,
        lon: -117.2
    },
    {
        id: '9410840',
        name: 'La Jolla',
        lat: 32.9,
        lon: -117.3
    },
    {
        id: '9411340',
        name: 'Santa Monica',
        lat: 34.0,
        lon: -118.5
    },
    {
        id: '9414290',
        name: 'San Francisco',
        lat: 37.8,
        lon: -122.5
    },
    {
        id: '9413450',
        name: 'Monterey',
        lat: 36.6,
        lon: -121.9
    },
    // Hawaii
    {
        id: '1612340',
        name: 'Honolulu',
        lat: 21.3,
        lon: -157.9
    },
    {
        id: '1615680',
        name: 'Hilo',
        lat: 19.7,
        lon: -155.1
    },
    // East Coast
    {
        id: '8518750',
        name: 'The Battery, NY',
        lat: 40.7,
        lon: -74.0
    },
    {
        id: '8534720',
        name: 'Atlantic City',
        lat: 39.4,
        lon: -74.4
    },
    {
        id: '8721164',
        name: 'Miami Beach',
        lat: 25.8,
        lon: -80.1
    }
];
/**
 * Calculate distance between two coordinates
 */ function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(degrees) {
    return degrees * (Math.PI / 180);
}
function findNearestTideStation(lat, lon) {
    let nearest = null;
    let minDistance = Infinity;
    for (const station of TIDE_STATIONS){
        const distance = calculateDistance(lat, lon, station.lat, station.lon);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = station;
        }
    }
    // Only return if within reasonable distance (< 100km)
    return minDistance < 100 ? nearest : null;
}
async function fetchTidePredictions(stationId, startDate, endDate) {
    try {
        const beginDate = formatDate(startDate);
        const endDateStr = formatDate(endDate);
        const params = new URLSearchParams({
            product: 'predictions',
            application: 'Sandbars',
            begin_date: beginDate,
            end_date: endDateStr,
            datum: 'MLLW',
            station: stationId,
            time_zone: 'gmt',
            units: 'metric',
            interval: 'h',
            format: 'json'
        });
        const response = await fetch(`${TIDES_API_URL}?${params.toString()}`, {
            next: {
                revalidate: 86400
            }
        });
        if (!response.ok) {
            console.error(`Tides API error for station ${stationId}: ${response.statusText}`);
            return [];
        }
        const data = await response.json();
        if (!data.predictions || !Array.isArray(data.predictions)) {
            return [];
        }
        return data.predictions.map((pred)=>({
                timestamp: pred.t,
                tideLevel: parseFloat(pred.v),
                quality: 'primary'
            }));
    } catch (error) {
        console.error(`Error fetching tide predictions for station ${stationId}:`, error);
        return [];
    }
}
/**
 * Format date for API (yyyyMMdd HH:mm)
 */ function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${year}${month}${day} ${hours}:${minutes}`;
}
function getTideAtTime(predictions, targetTime) {
    const targetTimestamp = targetTime.getTime();
    // Find closest prediction
    let closest = null;
    let minDiff = Infinity;
    for (const pred of predictions){
        const predTimestamp = new Date(pred.timestamp).getTime();
        const diff = Math.abs(predTimestamp - targetTimestamp);
        if (diff < minDiff) {
            minDiff = diff;
            closest = pred;
        }
    }
    // Only return if within 1 hour
    if (minDiff < 60 * 60 * 1000) {
        return closest;
    }
    return null;
}
}),
"[project]/lib/forecast/interpolation.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Spatial Interpolation Module
 * Implements Inverse Distance Weighting (IDW) for multi-source data
 */ __turbopack_context__.s([
    "interpolateSlowVariable",
    ()=>interpolateSlowVariable,
    "interpolateWaveData",
    ()=>interpolateWaveData,
    "interpolateWindData",
    ()=>interpolateWindData,
    "inverseDistanceWeighting",
    ()=>inverseDistanceWeighting,
    "temporalInterpolation",
    ()=>temporalInterpolation
]);
function inverseDistanceWeighting(dataPoints, power = 2, maxDistance = 100) {
    // Filter out invalid data points
    const validPoints = dataPoints.filter((p)=>p.distance <= maxDistance && !isNaN(p.value) && p.value !== null);
    if (validPoints.length === 0) {
        return null;
    }
    // If we have a very close point (< 1km), just use it
    const veryClose = validPoints.find((p)=>p.distance < 1);
    if (veryClose) {
        return {
            value: veryClose.value,
            quality: veryClose.quality
        };
    }
    // If only one point, return it
    if (validPoints.length === 1) {
        return {
            value: validPoints[0].value,
            quality: validPoints[0].quality
        };
    }
    // Calculate weights
    let weightedSum = 0;
    let weightSum = 0;
    for (const point of validPoints){
        const weight = 1 / Math.pow(point.distance, power);
        weightedSum += point.value * weight;
        weightSum += weight;
    }
    const interpolatedValue = weightedSum / weightSum;
    // Determine quality based on sources
    const hasPrimary = validPoints.some((p)=>p.quality === 'primary');
    const quality = hasPrimary ? 'interpolated' : 'modeled';
    return {
        value: interpolatedValue,
        quality
    };
}
function temporalInterpolation(value1, time1, value2, time2, targetTime) {
    const t1 = time1.getTime();
    const t2 = time2.getTime();
    const target = targetTime.getTime();
    // Linear interpolation
    const ratio = (target - t1) / (t2 - t1);
    return value1 + (value2 - value1) * ratio;
}
function interpolateWaveData(dataPoints, distanceToShore// km
) {
    // For wave data, use higher power near shore (more local variation)
    const power = distanceToShore < 10 ? 3 : 2;
    const maxDistance = distanceToShore < 10 ? 50 : 100;
    return inverseDistanceWeighting(dataPoints, power, maxDistance);
}
function interpolateWindData(dataPoints, distanceToShore// km
) {
    // Wind is less reliable near coastline due to land/sea effects
    if (distanceToShore < 5) {
        // Only use very close stations near shore
        const closePoints = dataPoints.filter((p)=>p.distance < 20);
        if (closePoints.length === 0) {
            return null;
        }
        return inverseDistanceWeighting(closePoints, 2, 20);
    }
    return inverseDistanceWeighting(dataPoints, 2, 50);
}
function interpolateSlowVariable(dataPoints, maxAge = 24 * 60 * 60 * 1000 // 24 hours in ms
) {
    const validPoints = dataPoints.filter((p)=>!isNaN(p.value) && p.value !== null && p.distance < 200);
    if (validPoints.length === 0) {
        return null;
    }
    // Simple average for slow variables
    const sum = validPoints.reduce((acc, p)=>acc + p.value, 0);
    const avg = sum / validPoints.length;
    return {
        value: avg,
        quality: 'interpolated'
    };
}
}),
"[project]/lib/forecast/hierarchy.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Multi-Source Data Hierarchy Module
 * Implements priority cascade: Primary → Secondary → Tertiary → Model Fallback
 */ __turbopack_context__.s([
    "getAirTemperature",
    ()=>getAirTemperature,
    "getTideLevel",
    ()=>getTideLevel,
    "getWaterTemperature",
    ()=>getWaterTemperature,
    "getWaveDirection",
    ()=>getWaveDirection,
    "getWaveHeight",
    ()=>getWaveHeight,
    "getWavePeriod",
    ()=>getWavePeriod,
    "getWindData",
    ()=>getWindData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/sources/ndbc.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/sources/nws.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$tides$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/sources/tides.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/interpolation.ts [app-route] (ecmascript)");
;
;
;
;
async function getWaveHeight(lat, lon, targetTime) {
    const sourceHierarchy = [];
    // Primary: Try nearest buoy
    const nearestBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 50, 1);
    if (nearestBuoys.length > 0) {
        const buoy = nearestBuoys[0];
        sourceHierarchy.push(`buoy_${buoy.id}_primary`);
        const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
        if (buoyData && buoyData.waveHeight !== undefined) {
            return {
                value: buoyData.waveHeight,
                quality: buoyData.quality,
                source: `NDBC Buoy ${buoy.id} (${buoy.name})`,
                sourceHierarchy
            };
        }
    }
    // Secondary: Try interpolation from multiple buoys
    const nearbyBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 100, 5);
    if (nearbyBuoys.length >= 2) {
        sourceHierarchy.push('buoy_interpolation');
        const dataPoints = [];
        for (const buoy of nearbyBuoys){
            const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
            if (buoyData && buoyData.waveHeight !== undefined) {
                dataPoints.push({
                    value: buoyData.waveHeight,
                    distance: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateDistance"])(lat, lon, buoy.lat, buoy.lon),
                    quality: buoyData.quality
                });
            }
        }
        if (dataPoints.length >= 2) {
            const distanceToShore = 10; // TODO: Calculate actual distance to shore
            const interpolated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["interpolateWaveData"])(dataPoints, distanceToShore);
            if (interpolated) {
                return {
                    value: interpolated.value,
                    quality: interpolated.quality,
                    source: `Interpolated from ${dataPoints.length} buoys`,
                    sourceHierarchy
                };
            }
        }
    }
    // Tertiary: WaveWatch III model (not implemented yet)
    sourceHierarchy.push('wavewatch_model');
    // Fallback: Use a reasonable default
    sourceHierarchy.push('fallback');
    return {
        value: 1.0,
        quality: 'historical',
        source: 'Historical average',
        sourceHierarchy
    };
}
async function getWavePeriod(lat, lon, targetTime) {
    const sourceHierarchy = [];
    // Primary: Try nearest buoy
    const nearestBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 50, 1);
    if (nearestBuoys.length > 0) {
        const buoy = nearestBuoys[0];
        sourceHierarchy.push(`buoy_${buoy.id}_primary`);
        const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
        if (buoyData && buoyData.dominantWavePeriod !== undefined) {
            return {
                value: buoyData.dominantWavePeriod,
                quality: buoyData.quality,
                source: `NDBC Buoy ${buoy.id} (${buoy.name})`,
                sourceHierarchy
            };
        }
    }
    // Secondary: Interpolation
    const nearbyBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 100, 5);
    if (nearbyBuoys.length >= 2) {
        sourceHierarchy.push('buoy_interpolation');
        const dataPoints = [];
        for (const buoy of nearbyBuoys){
            const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
            const period = buoyData?.dominantWavePeriod || buoyData?.averageWavePeriod;
            if (period !== undefined) {
                dataPoints.push({
                    value: period,
                    distance: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateDistance"])(lat, lon, buoy.lat, buoy.lon),
                    quality: buoyData?.quality || 'missing'
                });
            }
        }
        if (dataPoints.length >= 2) {
            const interpolated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["inverseDistanceWeighting"])(dataPoints);
            if (interpolated) {
                return {
                    value: interpolated.value,
                    quality: interpolated.quality,
                    source: `Interpolated from ${dataPoints.length} buoys`,
                    sourceHierarchy
                };
            }
        }
    }
    // Fallback
    sourceHierarchy.push('fallback');
    return {
        value: 10,
        quality: 'historical',
        source: 'Historical average',
        sourceHierarchy
    };
}
async function getWaveDirection(lat, lon, windDirection) {
    const sourceHierarchy = [];
    // Primary: Try nearest buoy
    const nearestBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 50, 1);
    if (nearestBuoys.length > 0) {
        const buoy = nearestBuoys[0];
        sourceHierarchy.push(`buoy_${buoy.id}_primary`);
        const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
        if (buoyData && buoyData.waveDirection !== undefined) {
            return {
                value: buoyData.waveDirection,
                quality: buoyData.quality,
                source: `NDBC Buoy ${buoy.id} (${buoy.name})`,
                sourceHierarchy
            };
        }
    }
    // Fallback to wind direction if available
    if (windDirection !== undefined) {
        sourceHierarchy.push('wind_direction_fallback');
        return {
            value: windDirection,
            quality: 'interpolated',
            source: 'Wind direction',
            sourceHierarchy
        };
    }
    sourceHierarchy.push('no_data');
    return {
        value: null,
        quality: 'missing',
        source: 'No data available',
        sourceHierarchy
    };
}
async function getAirTemperature(lat, lon, targetTime) {
    const sourceHierarchy = [];
    // Primary: NWS forecast
    sourceHierarchy.push('nws_forecast');
    const nwsForecast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNWSForecast"])(lat, lon);
    if (nwsForecast.length > 0) {
        const weatherData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["convertNWSToWeatherData"])(nwsForecast);
        const weather = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWeatherAtTime"])(weatherData, targetTime);
        if (weather && weather.airTemperature !== undefined) {
            return {
                value: weather.airTemperature,
                quality: weather.quality,
                source: 'NOAA NWS Forecast',
                sourceHierarchy
            };
        }
    }
    // Tertiary: Try nearby buoys
    const nearbyBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 100, 3);
    if (nearbyBuoys.length > 0) {
        sourceHierarchy.push('buoy_air_temp');
        const dataPoints = [];
        for (const buoy of nearbyBuoys){
            const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
            if (buoyData && buoyData.airTemperature !== undefined) {
                dataPoints.push({
                    value: buoyData.airTemperature,
                    distance: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateDistance"])(lat, lon, buoy.lat, buoy.lon),
                    quality: buoyData.quality
                });
            }
        }
        if (dataPoints.length > 0) {
            const interpolated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["interpolateSlowVariable"])(dataPoints);
            if (interpolated) {
                return {
                    value: interpolated.value,
                    quality: interpolated.quality,
                    source: `Interpolated from ${dataPoints.length} buoys`,
                    sourceHierarchy
                };
            }
        }
    }
    sourceHierarchy.push('no_data');
    return {
        value: null,
        quality: 'missing',
        source: 'No data available',
        sourceHierarchy
    };
}
async function getWindData(lat, lon, targetTime) {
    const sourceHierarchy = [];
    // Primary: NWS forecast
    sourceHierarchy.push('nws_forecast');
    const nwsForecast = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNWSForecast"])(lat, lon);
    if (nwsForecast.length > 0) {
        const weatherData = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["convertNWSToWeatherData"])(nwsForecast);
        const weather = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$nws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWeatherAtTime"])(weatherData, targetTime);
        if (weather && weather.windSpeed !== undefined && weather.windDirection !== undefined) {
            return {
                speed: {
                    value: weather.windSpeed,
                    quality: weather.quality,
                    source: 'NOAA NWS Forecast',
                    sourceHierarchy: [
                        ...sourceHierarchy
                    ]
                },
                direction: {
                    value: weather.windDirection,
                    quality: weather.quality,
                    source: 'NOAA NWS Forecast',
                    sourceHierarchy: [
                        ...sourceHierarchy
                    ]
                }
            };
        }
    }
    // Secondary: Buoy interpolation
    const nearbyBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 100, 5);
    const speedDataPoints = [];
    const dirDataPoints = [];
    for (const buoy of nearbyBuoys){
        const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
        const distance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateDistance"])(lat, lon, buoy.lat, buoy.lon);
        if (buoyData && buoyData.windSpeed !== undefined) {
            speedDataPoints.push({
                value: buoyData.windSpeed,
                distance,
                quality: buoyData.quality
            });
        }
        if (buoyData && buoyData.windDirection !== undefined) {
            dirDataPoints.push({
                value: buoyData.windDirection,
                distance,
                quality: buoyData.quality
            });
        }
    }
    const distanceToShore = 10; // TODO: Calculate actual
    const speedInterp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["interpolateWindData"])(speedDataPoints, distanceToShore);
    const dirInterp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["interpolateWindData"])(dirDataPoints, distanceToShore);
    return {
        speed: speedInterp ? {
            value: speedInterp.value,
            quality: speedInterp.quality,
            source: `Interpolated from ${speedDataPoints.length} buoys`,
            sourceHierarchy: [
                ...sourceHierarchy,
                'buoy_interpolation'
            ]
        } : {
            value: 5,
            quality: 'historical',
            source: 'Default',
            sourceHierarchy: [
                ...sourceHierarchy,
                'fallback'
            ]
        },
        direction: dirInterp ? {
            value: dirInterp.value,
            quality: dirInterp.quality,
            source: `Interpolated from ${dirDataPoints.length} buoys`,
            sourceHierarchy: [
                ...sourceHierarchy,
                'buoy_interpolation'
            ]
        } : {
            value: null,
            quality: 'missing',
            source: 'No data',
            sourceHierarchy: [
                ...sourceHierarchy,
                'no_data'
            ]
        }
    };
}
async function getWaterTemperature(lat, lon) {
    const sourceHierarchy = [];
    // Try nearby buoys
    const nearbyBuoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lon, 100, 5);
    const dataPoints = [];
    for (const buoy of nearbyBuoys){
        sourceHierarchy.push(`buoy_${buoy.id}`);
        const buoyData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchNDBCBuoyData"])(buoy.id);
        if (buoyData && buoyData.waterTemperature !== undefined) {
            dataPoints.push({
                value: buoyData.waterTemperature,
                distance: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateDistance"])(lat, lon, buoy.lat, buoy.lon),
                quality: buoyData.quality
            });
        }
    }
    if (dataPoints.length > 0) {
        const interpolated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$interpolation$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["interpolateSlowVariable"])(dataPoints);
        if (interpolated) {
            return {
                value: interpolated.value,
                quality: interpolated.quality,
                source: `Interpolated from ${dataPoints.length} buoys`,
                sourceHierarchy
            };
        }
    }
    sourceHierarchy.push('no_data');
    return {
        value: null,
        quality: 'missing',
        source: 'No data available',
        sourceHierarchy
    };
}
async function getTideLevel(lat, lon, targetTime) {
    const sourceHierarchy = [];
    const tideStation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$tides$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestTideStation"])(lat, lon);
    if (!tideStation) {
        return {
            value: null,
            quality: 'missing',
            source: 'No tide station nearby',
            sourceHierarchy: [
                'no_station'
            ]
        };
    }
    sourceHierarchy.push(`tide_station_${tideStation.id}`);
    // Fetch 24 hours of predictions
    const startTime = new Date(targetTime);
    startTime.setHours(startTime.getHours() - 12);
    const endTime = new Date(targetTime);
    endTime.setHours(endTime.getHours() + 12);
    const predictions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$tides$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchTidePredictions"])(tideStation.id, startTime, endTime);
    const tidePrediction = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$tides$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTideAtTime"])(predictions, targetTime);
    if (tidePrediction) {
        return {
            value: tidePrediction.tideLevel,
            quality: tidePrediction.quality,
            source: `NOAA Tide Station ${tideStation.name}`,
            sourceHierarchy
        };
    }
    sourceHierarchy.push('no_data');
    return {
        value: null,
        quality: 'missing',
        source: 'No tide data available',
        sourceHierarchy
    };
}
}),
"[project]/lib/forecast/calculations.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Calculations Module
 * Derived metrics like wave power
 */ /**
 * Calculate wave power
 * Formula: P = 0.5 * ρ * g * H² * T
 * Where:
 *   ρ (rho) = water density = 1025 kg/m³ (seawater)
 *   g = gravitational acceleration = 9.81 m/s²
 *   H = significant wave height (meters)
 *   T = wave period (seconds)
 *
 * @param waveHeight - Significant wave height in meters
 * @param wavePeriod - Wave period in seconds
 * @returns Wave power in kW/m
 */ __turbopack_context__.s([
    "calculateSurfQualityScore",
    ()=>calculateSurfQualityScore,
    "calculateWaveCelerity",
    ()=>calculateWaveCelerity,
    "calculateWaveEnergyFlux",
    ()=>calculateWaveEnergyFlux,
    "calculateWavePower",
    ()=>calculateWavePower,
    "convertTemperature",
    ()=>convertTemperature,
    "convertWindSpeed",
    ()=>convertWindSpeed,
    "estimateBreakingWaveHeight",
    ()=>estimateBreakingWaveHeight
]);
function calculateWavePower(waveHeight, wavePeriod) {
    const RHO = 1025; // kg/m³ - seawater density
    const G = 9.81; // m/s² - gravitational acceleration
    // P = 0.5 * ρ * g * H² * T
    const power = 0.5 * RHO * G * Math.pow(waveHeight, 2) * wavePeriod;
    // Convert to kW/m
    return power / 1000;
}
function calculateWaveEnergyFlux(waveHeight, wavePeriod) {
    const RHO = 1025; // kg/m³
    const G = 9.81; // m/s²
    // E = (ρ * g² / 64π) * H² * T
    const energy = RHO * Math.pow(G, 2) / (64 * Math.PI) * Math.pow(waveHeight, 2) * wavePeriod;
    // Convert to kW/m
    return energy / 1000;
}
function calculateSurfQualityScore(waveHeight, wavePeriod, windSpeed, windDirection, waveDirection) {
    let score = 0;
    // Wave height score (0-3 points)
    // Optimal: 1-2.5m
    if (waveHeight >= 1 && waveHeight <= 2.5) {
        score += 3;
    } else if (waveHeight >= 0.6 && waveHeight < 1) {
        score += 2;
    } else if (waveHeight > 2.5 && waveHeight <= 3.5) {
        score += 2;
    } else if (waveHeight > 0.3 && waveHeight < 0.6) {
        score += 1;
    }
    // Wave period score (0-3 points)
    // Optimal: 10-16 seconds (long period swells)
    if (wavePeriod >= 10 && wavePeriod <= 16) {
        score += 3;
    } else if (wavePeriod >= 8 && wavePeriod < 10) {
        score += 2;
    } else if (wavePeriod > 16 && wavePeriod <= 20) {
        score += 2;
    } else if (wavePeriod >= 6 && wavePeriod < 8) {
        score += 1;
    }
    // Wind score (0-2 points)
    // Optimal: light offshore wind (< 5 m/s)
    if (windSpeed < 3) {
        score += 2;
    } else if (windSpeed < 5) {
        score += 1.5;
    } else if (windSpeed < 8) {
        score += 1;
    } else if (windSpeed < 12) {
        score += 0.5;
    }
    // Wind/wave direction score (0-2 points)
    if (windDirection !== undefined && waveDirection !== undefined) {
        const directionDiff = Math.abs(windDirection - waveDirection);
        const normalizedDiff = Math.min(directionDiff, 360 - directionDiff);
        // Offshore wind (wind opposite to waves) is best
        if (normalizedDiff > 150 && normalizedDiff < 210) {
            score += 2;
        } else if (normalizedDiff > 120 && normalizedDiff < 240) {
            score += 1.5;
        } else if (normalizedDiff < 30) {
            // Onshore wind (same direction as waves) is bad
            score += 0;
        } else {
            score += 1;
        }
    }
    return Math.min(score, 10);
}
function convertWindSpeed(value, from, to = 'ms') {
    // Convert to m/s first
    let ms;
    switch(from){
        case 'mph':
            ms = value * 0.44704;
            break;
        case 'knots':
            ms = value * 0.514444;
            break;
        case 'kmh':
            ms = value / 3.6;
            break;
        case 'ms':
        default:
            ms = value;
    }
    return ms;
}
function convertTemperature(value, from, to = 'C') {
    if (from === to) return value;
    if (from === 'F' && to === 'C') {
        return (value - 32) * 5 / 9;
    } else {
        return value * 9 / 5 + 32;
    }
}
function estimateBreakingWaveHeight(depth) {
    return depth * 0.78;
}
function calculateWaveCelerity(wavePeriod) {
    const G = 9.81; // m/s²
    return G * wavePeriod / (2 * Math.PI);
}
}),
"[project]/lib/forecast/index.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Main Forecast API
 * Provides unified interface with three-tier caching
 */ __turbopack_context__.s([
    "getSurfForecast",
    ()=>getSurfForecast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/hierarchy.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$calculations$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/calculations.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/sources/ndbc.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$tides$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/sources/tides.ts [app-route] (ecmascript)");
;
;
;
;
async function getSurfForecast(lat, lng, hours = 168 // 7 days default
) {
    console.log(`Fetching surf forecast for ${lat}, ${lng} - ${hours} hours`);
    const forecasts = [];
    const now = new Date();
    // Track which stations we used
    const stationsUsed = [];
    const buoys = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$ndbc$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestBuoys"])(lat, lng, 200, 5);
    const tideStation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$sources$2f$tides$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["findNearestTideStation"])(lat, lng);
    for (const buoy of buoys){
        if (!stationsUsed.find((s)=>s.station_id === buoy.id)) {
            stationsUsed.push({
                station_id: buoy.id,
                type: 'buoy',
                name: buoy.name,
                distance_km: Math.round(calculateDistance(lat, lng, buoy.lat, buoy.lon)),
                metrics: [
                    'wave_height',
                    'wave_period',
                    'wave_direction',
                    'wind_speed',
                    'wind_direction',
                    'water_temperature'
                ]
            });
        }
    }
    if (tideStation) {
        stationsUsed.push({
            station_id: tideStation.id,
            type: 'tide',
            name: tideStation.name,
            distance_km: Math.round(calculateDistance(lat, lng, tideStation.lat, tideStation.lon)),
            metrics: [
                'tide_level'
            ]
        });
    }
    // Generate hourly forecasts
    for(let i = 0; i < hours; i++){
        const forecastTime = new Date(now.getTime() + i * 3600000);
        try {
            // Fetch all metrics in parallel
            const [waveHeight, wavePeriod, windData, waveDirection, waterTemp, airTemp, tideLevel] = await Promise.all([
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWaveHeight"])(lat, lng, forecastTime),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWavePeriod"])(lat, lng, forecastTime),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWindData"])(lat, lng, forecastTime),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWaveDirection"])(lat, lng),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getWaterTemperature"])(lat, lng),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAirTemperature"])(lat, lng, forecastTime),
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$hierarchy$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTideLevel"])(lat, lng, forecastTime)
            ]);
            // Use wind direction if wave direction not available
            const finalWaveDirection = waveDirection.value !== null ? waveDirection : windData.direction.value !== null ? windData.direction : null;
            // Calculate wave power if we have the required data
            let wavePowerMetric;
            if (waveHeight.value !== null && wavePeriod.value !== null) {
                const power = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$calculations$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateWavePower"])(waveHeight.value, wavePeriod.value);
                wavePowerMetric = {
                    value: power,
                    quality: combineQuality(waveHeight.quality, wavePeriod.quality)
                };
            }
            const forecast = {
                time: forecastTime.toISOString(),
                waveHeight: {
                    min: waveHeight.value !== null ? waveHeight.value * 0.8 : 0.5,
                    max: waveHeight.value !== null ? waveHeight.value * 1.2 : 1.5,
                    quality: waveHeight.quality
                },
                wavePeriod: {
                    value: wavePeriod.value || 10,
                    quality: wavePeriod.quality
                },
                waveDirection: finalWaveDirection ? {
                    value: finalWaveDirection.value,
                    quality: finalWaveDirection.quality
                } : undefined,
                wavePower: wavePowerMetric,
                windSpeed: {
                    value: windData.speed.value || 5,
                    quality: windData.speed.quality
                },
                windDirection: windData.direction.value !== null ? {
                    value: windData.direction.value,
                    quality: windData.direction.quality
                } : undefined,
                waterTemperature: waterTemp.value !== null ? {
                    value: waterTemp.value,
                    quality: waterTemp.quality
                } : undefined,
                airTemperature: airTemp.value !== null ? {
                    value: airTemp.value,
                    quality: airTemp.quality
                } : undefined,
                tideLevel: tideLevel.value !== null ? {
                    value: tideLevel.value,
                    quality: tideLevel.quality
                } : undefined
            };
            forecasts.push(forecast);
        } catch (error) {
            console.error(`Error generating forecast for hour ${i}:`, error);
        }
    }
    // Calculate metadata
    const qualityCounts = forecasts.reduce((acc, f)=>{
        if (f.waveHeight.quality === 'primary') acc.primary++;
        if (f.waveHeight.quality === 'interpolated') acc.interpolated++;
        if (f.waveHeight.quality === 'modeled') acc.modeled++;
        return acc;
    }, {
        primary: 0,
        interpolated: 0,
        modeled: 0
    });
    return {
        forecasts,
        metadata: {
            generated_at: new Date().toISOString(),
            primary_sources: qualityCounts.primary,
            interpolated_sources: qualityCounts.interpolated,
            modeled_sources: qualityCounts.modeled
        }
    };
}
/**
 * Combine quality flags (take the worse of two)
 */ function combineQuality(q1, q2) {
    const hierarchy = [
        'primary',
        'interpolated',
        'modeled',
        'stale',
        'historical',
        'missing'
    ];
    const idx1 = hierarchy.indexOf(q1);
    const idx2 = hierarchy.indexOf(q2);
    return hierarchy[Math.max(idx1, idx2)];
}
/**
 * Calculate distance between coordinates (Haversine)
 */ function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function toRad(degrees) {
    return degrees * (Math.PI / 180);
}
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/api/forecast/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase/server.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/forecast/index.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
;
;
;
/**
 * Convert enhanced forecast to legacy format for backwards compatibility
 */ function toLegacyFormat(enhanced) {
    return {
        time: enhanced.time,
        waveHeight: {
            min: enhanced.waveHeight.min,
            max: enhanced.waveHeight.max
        },
        wavePeriod: enhanced.wavePeriod.value,
        waveDirection: enhanced.waveDirection?.value,
        windSpeed: enhanced.windSpeed.value,
        windDirection: enhanced.windDirection?.value,
        waterTemperature: enhanced.waterTemperature?.value,
        airTemperature: enhanced.airTemperature?.value,
        wavePower: enhanced.wavePower?.value
    };
}
async function GET(request) {
    try {
        const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Unauthorized'
            }, {
                status: 401
            });
        }
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '');
        const lng = parseFloat(searchParams.get('lng') || '');
        const enhanced = searchParams.get('enhanced') === 'true'; // Optional: return enhanced format
        const hours = parseInt(searchParams.get('hours') || '168'); // Default 7 days
        if (isNaN(lat) || isNaN(lng)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid coordinates'
            }, {
                status: 400
            });
        }
        const forecastData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$forecast$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSurfForecast"])(lat, lng, hours);
        // Return enhanced format with metadata, or legacy format
        if (enhanced) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(forecastData);
        } else {
            // Convert to legacy format for backwards compatibility
            const legacyForecasts = forecastData.forecasts.map(toLegacyFormat);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(legacyForecasts);
        }
    } catch (error) {
        console.error('Forecast API error:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: error instanceof Error ? error.message : 'Failed to fetch forecast'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__278bfe9b._.js.map