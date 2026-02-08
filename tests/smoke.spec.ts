import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - UI Elements', () => {
  test('page loads and shows UI elements', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check that basic UI elements are rendered
    await expect(page.locator('[data-testid="legend"]')).toBeVisible();
    await expect(page.locator('[data-testid="time-slider"]')).toBeVisible();
    await expect(page.locator('[data-testid="buoy-toggle"]')).toBeVisible();
  });

  test('legend contains wave forecast title', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const legend = page.locator('[data-testid="legend"]');
    await expect(legend).toContainText('Wave Forecast');
  });

  test('buoy toggle shows NDBC label', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const toggle = page.locator('[data-testid="buoy-toggle"]');
    await expect(toggle).toContainText('NDBC');
  });

  test('time slider has range input', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const slider = page.locator('[data-testid="time-slider"] input[type="range"]');
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute('min', '0');
    await expect(slider).toHaveAttribute('max', '16');
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
});

// These tests require WebGL/GPU support and don't work in headless CI
// Run locally with: npx playwright test --headed --grep "WebGL"
test.describe('Smoke Tests - Map & Data (requires WebGL)', () => {
  // Skip in CI - WebGL not available in headless mode
  test.skip(() => !!process.env.CI, 'WebGL tests skipped in CI');

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
