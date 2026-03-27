// =============================================================================
// User Preferences — persisted in localStorage
// =============================================================================

export interface UserPreferences {
  waveUnit: 'ft' | 'm';
  windUnit: 'mph' | 'kts' | 'kph' | 'm/s';
  tempUnit: 'F' | 'C';
}

const PREFS_KEY = 'sandbars-preferences';

export const DEFAULT_PREFS: UserPreferences = {
  waveUnit: 'ft',
  windUnit: 'mph',
  tempUnit: 'F',
};

export function loadPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable
  }
}

// =============================================================================
// Unit Conversion (source data is always metric)
// =============================================================================

export function convertWaveHeight(meters: number, unit: 'ft' | 'm'): number {
  return unit === 'ft' ? Math.round(meters * 3.28084 * 10) / 10 : meters;
}

export function convertWindSpeed(ms: number, unit: 'mph' | 'kts' | 'kph' | 'm/s'): number {
  const val = unit === 'mph' ? ms * 2.23694
    : unit === 'kts' ? ms * 1.94384
    : unit === 'kph' ? ms * 3.6
    : ms;
  return Math.round(val * 10) / 10;
}

export function convertTemp(celsius: number, unit: 'F' | 'C'): number {
  return unit === 'F' ? Math.round(celsius * 9 / 5 + 32) : celsius;
}

export function tempUnitLabel(unit: 'F' | 'C'): string {
  return unit === 'F' ? '°F' : '°C';
}
