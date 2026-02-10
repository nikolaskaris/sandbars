# deck.gl Integration Research

## Summary

Evaluated deck.gl v9.2.6 for replacing discrete wave circles with a smooth, continuous color gradient. **HeatmapLayer is the recommended approach** — it produces a smooth Gaussian-kernel-based color field from point data.

## Packages Installed

```
@deck.gl/core@9.2.6
@deck.gl/layers@9.2.6
@deck.gl/mapbox@9.2.6
@deck.gl/aggregation-layers@9.2.6
```

## Integration Approach

**MapboxOverlay** (`@deck.gl/mapbox`) is the bridge between deck.gl and MapLibre. Despite the "mapbox" name, it works with MapLibre GL JS v3+. Our MapLibre v4.7.1 is compatible.

```typescript
import { MapboxOverlay } from '@deck.gl/mapbox';
const overlay = new MapboxOverlay({ layers: [] });
map.addControl(overlay);
overlay.setProps({ layers: [heatmapLayer] });
```

### Overlay Modes

| Mode | Description | Recommendation |
|------|-------------|----------------|
| Overlaid (default) | Separate canvas on top of map | Used in POC — simpler setup |
| Interleaved (`interleaved: true`) | Renders inside MapLibre's WebGL2 context | Better for production — can render below labels with `beforeId` |

## Layer Type Comparison

### HeatmapLayer (SELECTED)

- Gaussian Kernel Density Estimation — smooth, continuous color field
- GPU-accelerated, handles 800+ points easily
- Key config: `aggregation: 'MEAN'` (not default 'SUM') so colors represent actual values, not point density
- Set `colorDomain` explicitly for consistent colors across time steps

### ContourLayer (Alternative)

- Produces isolines/isobands (weather map contour style)
- Good for "elevation band" visualization
- More informative for reading exact values
- Would need large `cellSize` (~50000m) for global ocean coverage with 800 points

### GridLayer (Not recommended)

- Produces pixelated grid of colored rectangles
- Not smooth — opposite of the goal
- Better suited for dense urban-scale data

## Key Configuration Decisions

| Setting | Value | Reason |
|---------|-------|--------|
| `aggregation` | `'MEAN'` | Colors represent actual wave height, not point density |
| `colorDomain` | Explicit per layer | Prevents color shifts when scrubbing time slider |
| `radiusPixels` | 50 | Balance between smoothness and detail at various zoom levels |
| `threshold` | 0.03 | Low value for wider color spread with soft edges |
| `debounceTimeout` | 200ms | Snappy re-aggregation on pan/zoom |
| `intensity` | 1 | Neutral — adjust if colors look washed out |

## Known Issues & Gotchas

1. **Land bleeding**: HeatmapLayer's Gaussian kernel bleeds color over land. Will need a land mask layer rendered on top to clip this. Not addressed in POC.

2. **iOS Safari**: WebGL context doesn't support float textures. Falls back to 8-bit mode where weights are clamped to integers 0-255. Wave heights (0-15m) should be fine, but watch for precision issues on mobile.

3. **radiusPixels is screen-space**: At global zoom (level 2), 50px covers a large geographic area. At local zoom (level 8+), it covers much less. May need dynamic radius based on zoom level for production.

4. **No interactive picking on HeatmapLayer**: Unlike circle layers, you can't click on a specific point in the heatmap. We keep the existing map-wide click handler that uses `findNearestWaveFeature()` from the raw data, so this isn't an issue.

5. **SSR**: deck.gl uses WebGL. Components using it must be client-only. The `'use client'` directive handles this in Next.js.

## Performance Observations

- TypeScript compilation: no errors
- Dev server: starts and compiles successfully
- 800+ GeoJSON point features per forecast hour is well within HeatmapLayer's capability (GPU-accelerated)
- Layer updates via `overlay.setProps()` are efficient — deck.gl diffs props internally

## File Changes

| File | Change |
|------|--------|
| `components/DeckGLOverlay.tsx` | New — deck.gl HeatmapLayer component |
| `components/WaveMap.tsx` | Added import, `useHeatmap` state, toggle UI, DeckGLOverlay render |

## Next Steps for Production

1. **Land masking** — Add a land polygon layer rendered above the heatmap to prevent color bleeding onto land
2. **Interleaved mode** — Switch to `interleaved: true` with `beforeId` to render below map labels
3. **Dynamic radius** — Adjust `radiusPixels` based on zoom level for better appearance at all scales
4. **Color tuning** — Fine-tune `colorRange`, `colorDomain`, `intensity`, and `threshold` based on visual testing
5. **Mobile testing** — Verify on iOS Safari (float texture fallback)
6. **ContourLayer alternative** — Consider adding as a second visualization mode in LayerToggle
