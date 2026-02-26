import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - UI Elements', () => {
  test('page loads and shows UI elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that basic UI elements are rendered
    await expect(page.locator('[data-testid="legend"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-layers"]')).toBeVisible();
  });

  test('legend contains unit label', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const legend = page.locator('[data-testid="legend"]');
    await expect(legend).toContainText('m');
  });

  test('buoy toggle shows NDBC label', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    // Click Layers in the sidebar/tab bar to open the layers panel
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });

    const toggle = page.locator('[data-testid="buoy-toggle"]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toContainText('NDBC');
  });

  test('time slider has block grid', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const slider = page.locator('[data-testid="time-slider"]');
    await expect(slider).toBeVisible();
    // Hidden range input for accessibility
    const input = slider.locator('input[type="range"]');
    await expect(input).toHaveAttribute('min', '0');
    await expect(input).toHaveAttribute('max', '104');
  });

  test('forecast time label is visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const label = page.locator('[data-testid="forecast-time-label"]');
    await expect(label).toBeVisible();
  });

  test('map container exists', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const mapContainer = page.locator('[data-testid="map-container"]');
    await expect(mapContainer).toBeVisible();
  });

  test('no error banner on initial render', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Error banner should not exist on initial render
    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).not.toBeVisible();
  });

  test('legend gradient changes when layer is switched', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    const gradient = page.locator('[data-testid="legend-gradient"]');
    await expect(gradient).toBeVisible();

    // Read initial gradient (waveHeight default)
    const initialBg = await gradient.evaluate(el => el.style.background);

    // Open layers panel and switch to wavePeriod
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    await page.locator('[data-testid="layer-wavePeriod"]').click();

    const periodBg = await gradient.evaluate(el => el.style.background);
    expect(periodBg).not.toEqual(initialBg);

    // Switch to wind
    await page.locator('[data-testid="layer-wind"]').click();
    const windBg = await gradient.evaluate(el => el.style.background);
    expect(windBg).not.toEqual(initialBg);
    expect(windBg).not.toEqual(periodBg);
  });

  test('slider blocks remain full count on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const blocks = page.locator('[data-testid="slider-blocks"] > div');
    await expect(blocks).toHaveCount(105);

    const dayLabelsContainer = page.locator('[data-testid="day-labels"]');
    await expect(dayLabelsContainer).toBeVisible();
  });

  test('slider blocks adapt to narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for ResizeObserver to fire and trigger adaptive grouping
    const container = page.locator('[data-testid="slider-blocks"]');
    await expect(async () => {
      const count = await container.locator('> div').count();
      expect(count).toBeLessThan(105);
      expect(count).toBeGreaterThanOrEqual(20);
    }).toPass({ timeout: 5000 });
  });

  test('slider interaction works on narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const blocks = page.locator('[data-testid="slider-blocks"] > div');
    const pill = page.locator('[data-testid="forecast-time-label"]');
    await expect(pill).toBeVisible();

    // Click the 5th block to change time
    await blocks.nth(4).click();
    const text = await pill.textContent();
    // Pill should have some content (not empty)
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('legend labels update per layer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });

    const legend = page.locator('[data-testid="legend"]');

    // Default layer (waveHeight) shows "m"
    await expect(legend).toContainText('m');

    // Open layers panel and switch to wavePeriod
    await expect(async () => {
      await page.locator('[data-testid="nav-layers"]').click();
      await expect(page.locator('[data-testid="layers-panel"]')).toBeVisible();
    }).toPass({ timeout: 10000 });
    await page.locator('[data-testid="layer-wavePeriod"]').click();
    await expect(legend).toContainText('s');

    // Switch to wind
    await page.locator('[data-testid="layer-wind"]').click();
    await expect(legend).toContainText('m/s');
  });
});

// These tests require WebGL/GPU — skip in headless mode (no GPU available)
// Run with: HEADED=1 npx playwright test --headed --grep "WebGL"
test.describe('Smoke Tests - Map & Data (requires WebGL)', () => {
  test.skip(() => process.env.HEADED !== '1', 'WebGL tests require headed mode');

  test('map canvas appears after initialization', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for MapLibre to initialize and render the canvas
    const canvas = page.locator('.maplibregl-canvas');
    await expect(canvas).toBeVisible({ timeout: 45000 });
  });

  test('wave data request is made to Supabase', async ({ page }) => {
    // Listen for the network request before navigating
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('wave-data-f000.geojson'),
      { timeout: 45000 }
    );

    await page.goto('/', { waitUntil: 'networkidle' });
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    expect(response.url()).toContain('supabase.co');
  });

  test('day labels appear for every forecast day', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const dayLabels = page.locator('[data-testid="day-labels"] > span');
    await expect(dayLabels.first()).toBeVisible({ timeout: 45000 });
    const count = await dayLabels.count();
    // 16-day forecast should have at least 14 day labels
    expect(count).toBeGreaterThanOrEqual(14);
  });

  test('buoy data request is made to Supabase', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes('buoy-observations.geojson'),
      { timeout: 45000 }
    );

    await page.goto('/', { waitUntil: 'networkidle' });
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    expect(response.url()).toContain('supabase.co');
  });
});
