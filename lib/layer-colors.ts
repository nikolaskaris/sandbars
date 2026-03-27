// =============================================================================
// Centralized Layer Color Configuration
// =============================================================================
// Single source of truth for all layer display properties (colors, units, labels).
// Gradient values are sampled directly from the Python pipeline color ramps
// in scripts/convert-grib-to-geojson.py (WAVE_HEIGHT_COLORS, WAVE_PERIOD_COLORS,
// WIND_SPEED_COLORS). Do NOT change these without also updating the Python LUTs.

import type { MapLayer } from '@/components/LayerToggle';

export interface LayerColorConfig {
  /** Layer display name */
  label: string;
  /** Unit string shown in legend and tooltips */
  unit: string;
  /** Min value for the color scale */
  min: number;
  /** Max value for the color scale */
  max: number;
  /** Tick values shown on the legend (high to low, top to bottom) */
  ticks: string[];
  /** CSS gradient for the legend (top = max, bottom = min) */
  legendGradient: string;
  /** Primary saturated color at the max end */
  primaryColor: string;
  /** Desaturated base color at the min end */
  baseColor: string;
}

export const LAYER_COLORS: Record<MapLayer, LayerColorConfig> = {
  waveHeight: {
    label: 'Wave Height',
    unit: 'm',
    min: 0,
    max: 15,
    ticks: ['15', '12', '9', '6', '3', '0'],
    // Python: (180,175,168) → (150,170,200) → (110,155,210) → (70,130,200) → (50,100,180) → (35,75,160) → (25,55,130) → (15,35,100)
    legendGradient: 'linear-gradient(to bottom, rgb(15,35,100), rgb(25,55,130), rgb(35,75,160), rgb(50,100,180), rgb(70,130,200), rgb(110,155,210), rgb(150,170,200), rgb(180,175,168))',
    primaryColor: 'rgb(15,35,100)',
    baseColor: 'rgb(180,175,168)',
  },
  wavePeriod: {
    label: 'Wave Period',
    unit: 's',
    min: 0,
    max: 25,
    ticks: ['25', '20', '15', '10', '5', '0'],
    // Python: (180,175,168) → (165,160,180) → (150,140,195) → (120,100,180) → (95,65,165) → (65,40,140)
    legendGradient: 'linear-gradient(to bottom, rgb(65,40,140), rgb(95,65,165), rgb(120,100,180), rgb(150,140,195), rgb(165,160,180), rgb(180,175,168))',
    primaryColor: 'rgb(65,40,140)',
    baseColor: 'rgb(180,175,168)',
  },
  wind: {
    label: 'Wind Speed',
    unit: 'm/s',
    min: 0,
    max: 30,
    ticks: ['30', '25', '20', '15', '10', '5', '0'],
    // Python: (180,175,168) → (160,175,172) → (120,175,170) → (60,155,150) → (30,130,125) → (15,100,100)
    legendGradient: 'linear-gradient(to bottom, rgb(15,100,100), rgb(30,130,125), rgb(60,155,150), rgb(120,175,170), rgb(160,175,172), rgb(180,175,168))',
    primaryColor: 'rgb(15,100,100)',
    baseColor: 'rgb(180,175,168)',
  },
  sst: {
    label: 'Water Temp',
    unit: '°C',
    min: 0,
    max: 32,
    ticks: ['32', '26', '22', '18', '13', '8', '0'],
    // Python: (140,155,175) → (100,140,190) → (60,130,180) → (50,155,155) → (80,175,120) → (170,185,80) → (210,165,60) → (200,110,55) → (180,65,50)
    legendGradient: 'linear-gradient(to bottom, rgb(180,65,50), rgb(200,110,55), rgb(210,165,60), rgb(170,185,80), rgb(80,175,120), rgb(50,155,155), rgb(60,130,180), rgb(100,140,190), rgb(140,155,175))',
    primaryColor: 'rgb(180,65,50)',
    baseColor: 'rgb(140,155,175)',
  },
};
