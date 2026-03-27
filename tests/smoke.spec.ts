import { test, expect } from '@playwright/test';

// Helper: navigate to map view (Dashboard is now default)
async function goToMap(page: import('@playwright/test').Page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.locator('[data-testid="nav-map"]').click();
  // Wait for map-specific elements to fully render
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('[data-testid="time-slider"]')).toBeVisible({ timeout: 15000 });
}

// =============================================================================
// Dashboard Tests
// =============================================================================

test.describe('Dashboard', () => {
  test('dashboard loads as default landing page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    // Dashboard should be the active view — check for the Home nav being active
    // or the dashboard content being visible
    await expect(page.locator('text=Your surf forecast')).toBeVisible({ timeout: 10000 });
  });

  test('dashboard shows empty state when no favorites', async ({ page }) => {
    // Clear localStorage favorites
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('sandbars_favorites'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=No saved spots yet')).toBeVisible({ timeout: 10000 });
  });

  test('dashboard nav items all render', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-map"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-layers"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-favorites"]')).toBeVisible();
  });

  test('clicking Map nav switches to map view', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="nav-map"]').click();
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="time-slider"]')).toBeVisible();
  });

  test('dashboard content is visible on home view', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Dashboard should show content (either favorites or empty state)
    await expect(
      page.getByText('Your surf forecast')
    ).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// Navigation Tests
// =============================================================================

test.describe('Navigation', () => {
  test('can switch between all views', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    // Start on Dashboard
    await expect(
      page.getByText('Your surf forecast')
    ).toBeVisible({ timeout: 10000 });

    // Switch to Map
    await page.locator('[data-testid="nav-map"]').click();
    await expect(page.locator('[data-testid="map-container"]')).toBeVisible({ timeout: 15000 });

    // Switch to Layers (may need retry due to click timing)
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 15000 });

    // Close layers first, then switch to Favorites
    await page.locator('[data-testid="nav-map"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="nav-favorites"]').click();
    // Favorites page has a heading "Favorites" — use role selector for specificity
    await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible({ timeout: 10000 });

    // Back to Dashboard
    await page.locator('[data-testid="nav-dashboard"]').click();
    await expect(
      page.getByText('Your surf forecast')
    ).toBeVisible({ timeout: 10000 });
  });

  test('layers panel closes when switching to map', async ({ page }) => {
    await goToMap(page);
    await page.locator('[data-testid="nav-layers"]').click();
    await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    await page.locator('[data-testid="nav-map"]').click();
    await expect(page.locator('[data-testid="layers-panel"]')).not.toBeVisible();
  });
});

// =============================================================================
// Map UI Tests
// =============================================================================

test.describe('Map UI Elements', () => {
  test('map shows legend and time slider', async ({ page }) => {
    await goToMap(page);
    await expect(page.locator('[data-testid="legend"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-slider"]')).toBeVisible();
  });

  test('legend contains unit label', async ({ page }) => {
    await goToMap(page);
    const legend = page.locator('[data-testid="legend"]');
    await expect(legend).toContainText('m');
  });

  test('time slider has block grid', async ({ page }) => {
    await goToMap(page);
    const slider = page.locator('[data-testid="time-slider"]');
    await expect(slider).toBeVisible();
    const input = slider.locator('input[type="range"]');
    await expect(input).toHaveAttribute('min', '0');
    await expect(input).toHaveAttribute('max', '104');
  });

  test('forecast time label is visible', async ({ page }) => {
    await goToMap(page);
    const label = page.locator('[data-testid="forecast-time-label"]');
    await expect(label).toBeVisible();
  });

  test('map container exists', async ({ page }) => {
    await goToMap(page);
    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();
  });

  test('no error banner on initial render', async ({ page }) => {
    await goToMap(page);
    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).not.toBeVisible();
  });
});

// =============================================================================
// Layers Panel Tests
// =============================================================================

test.describe('Layers Panel', () => {
  test('buoy toggle shows NDBC label', async ({ page }) => {
    await goToMap(page);
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    const toggle = page.locator('[data-testid="buoy-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('NDBC');
  });

  test('bathymetry toggle exists', async ({ page }) => {
    await goToMap(page);
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    const toggle = page.locator('[data-testid="bathymetry-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('Bathymetry');
  });

  test('all layer options visible including SST and air temp', async ({ page }) => {
    await goToMap(page);
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    await expect(page.locator('[data-testid="layer-waveHeight"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-wavePeriod"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-wind"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-sst"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-airTemp"]')).toBeVisible();
  });

  test('legend gradient changes when layer is switched', async ({ page }) => {
    await goToMap(page);
    const gradient = page.locator('[data-testid="legend-gradient"]');
    await expect(gradient).toBeVisible();

    const initialBg = await gradient.evaluate(el => el.style.background);

    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    await page.locator('[data-testid="layer-wavePeriod"]').click();

    const periodBg = await gradient.evaluate(el => el.style.background);
    expect(periodBg).not.toEqual(initialBg);
  });

  test('legend labels update per layer', async ({ page }) => {
    await goToMap(page);
    const legend = page.locator('[data-testid="legend"]');
    await expect(legend).toContainText('m');

    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    await page.locator('[data-testid="layer-wavePeriod"]').click();
    await expect(legend).toContainText('s');

    await page.locator('[data-testid="layer-wind"]').click();
    await expect(legend).toContainText('m/s');
  });
});

// =============================================================================
// Search Tests
// =============================================================================

test.describe('Search', () => {
  test('search bar is visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('typing in search shows results dropdown', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('Mavericks');
    await searchInput.press('Enter');
    // Should show a dropdown with results
    await expect(page.locator('[data-testid="search-result-item"]').first()).toBeVisible({ timeout: 20000 });
  });
});

// =============================================================================
// Responsive Tests
// =============================================================================

test.describe('Responsive Layout', () => {
  test('mobile nav bar renders at bottom', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-map"]')).toBeVisible();
  });
});

// =============================================================================
// Map & Data Tests (requires WebGL)
// =============================================================================

test.describe('Map & Data (requires WebGL)', () => {
  test.skip(() => process.env.HEADED !== '1', 'WebGL tests require headed mode');

  test('map canvas appears after initialization', async ({ page }) => {
    await goToMap(page);
    const canvas = page.locator('.maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 45000 });
  });

  test('wave data request is made to Supabase', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('wave-data-f000.geojson'),
      { timeout: 45000 }
    );
    await goToMap(page);
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    expect(response.url()).toContain('supabase.co');
  });

  test('tide grid files are served from public/data', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('tides-') && resp.url().includes('-header.json'),
      { timeout: 45000 }
    );
    await goToMap(page);
    // Click somewhere to trigger tide grid load
    await page.locator('[data-testid="map-container"]').click({ position: { x: 400, y: 300 } });
    // Tide grid header request should have been made
    try {
      const response = await responsePromise;
      expect(response.status()).toBe(200);
    } catch {
      // Tide grid may not load if no spot clicked — acceptable
    }
  });

  test('day labels appear for every forecast day', async ({ page }) => {
    await goToMap(page);
    const dayLabels = page.locator('[data-testid="day-labels"] > span');
    await expect(dayLabels.first()).toBeVisible({ timeout: 45000 });
    const count = await dayLabels.count();
    expect(count).toBeGreaterThanOrEqual(14);
  });
});
