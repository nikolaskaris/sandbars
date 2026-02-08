/**
 * Wave Particle Engine - Nullschool-style Wave Visualization
 *
 * Key difference from wind visualization:
 * - Wind: particles flow continuously IN the direction of motion
 * - Waves: bars oscillate PERPENDICULAR to direction of energy propagation
 *
 * Visual behavior:
 * - Short bars (10-15px) oriented perpendicular to wave direction
 * - Bars translate laterally (perpendicular to wave propagation)
 * - Movement is oscillatory: drift one direction, slow, reverse, drift back
 * - Bars have limited lifespan: fade in, oscillate 1-2 cycles, fade out
 * - When a bar dies, spawn a new one nearby (not across the map)
 */

export interface WaveDataPoint {
  lat: number;
  lon: number;
  waveHeight: number;
  waveDirection: number; // degrees, direction waves are traveling TO
  wavePeriod?: number;
}

export interface WaveVisualizationConfig {
  barCount: number;           // Number of bars to display
  barLength: number;          // Length of each bar in pixels (10-15)
  barWidth: number;           // Width of each bar stroke
  oscillationAmplitude: number; // Max lateral displacement in pixels
  oscillationSpeed: number;   // Speed of oscillation (affects sin wave frequency)
  barLifespan: number;        // Frames before bar respawns (40-80)
  fadeInFrames: number;       // Frames to fade in
  fadeOutFrames: number;      // Frames to fade out
  respawnRadius: number;      // Degrees - spawn new bars nearby, not across map
  color: [number, number, number]; // RGB color
  opacity: number;            // Base opacity
}

interface WaveBar {
  lon: number;          // Base geographic longitude
  lat: number;          // Base geographic latitude
  direction: number;    // Wave direction at this point
  height: number;       // Wave height (affects amplitude)
  period: number;       // Wave period (affects oscillation speed)
  age: number;          // Current age in frames
  maxAge: number;       // Max age before respawn
  phase: number;        // Oscillation phase offset (0 to 2π)
}

// Default configuration - tuned for nullschool-like wave appearance
const DEFAULT_CONFIG: WaveVisualizationConfig = {
  barCount: 6000,
  barLength: 12,
  barWidth: 1.5,
  oscillationAmplitude: 8,
  oscillationSpeed: 0.08,
  barLifespan: 60,
  fadeInFrames: 8,
  fadeOutFrames: 15,
  respawnRadius: 5,          // Spawn within 5 degrees of current position
  color: [255, 255, 255],    // White
  opacity: 0.7,
};

/**
 * Grid-based spatial index for fast wave data lookup
 */
class WaveDataGrid {
  private grid: Map<string, WaveDataPoint[]> = new Map();
  private cellSize: number;
  private minLon: number = Infinity;
  private maxLon: number = -Infinity;
  private minLat: number = Infinity;
  private maxLat: number = -Infinity;

  constructor(data: WaveDataPoint[], cellSize: number = 2) {
    this.cellSize = cellSize;
    this.buildGrid(data);
  }

  private buildGrid(data: WaveDataPoint[]) {
    this.grid.clear();

    for (const point of data) {
      this.minLon = Math.min(this.minLon, point.lon);
      this.maxLon = Math.max(this.maxLon, point.lon);
      this.minLat = Math.min(this.minLat, point.lat);
      this.maxLat = Math.max(this.maxLat, point.lat);

      const cellX = Math.floor(point.lon / this.cellSize);
      const cellY = Math.floor(point.lat / this.cellSize);
      const key = `${cellX},${cellY}`;

      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push(point);
    }
  }

  getBounds() {
    return { minLon: this.minLon, maxLon: this.maxLon, minLat: this.minLat, maxLat: this.maxLat };
  }

  /**
   * Interpolate wave data at any point
   * Returns null if on land (no nearby data)
   */
  interpolate(lon: number, lat: number): WaveDataPoint | null {
    const cellX = Math.floor(lon / this.cellSize);
    const cellY = Math.floor(lat / this.cellSize);

    const nearby: WaveDataPoint[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const cellPoints = this.grid.get(key);
        if (cellPoints) nearby.push(...cellPoints);
      }
    }

    if (nearby.length === 0) return null;

    // Find nearest points
    nearby.sort((a, b) => {
      const distA = (a.lon - lon) ** 2 + (a.lat - lat) ** 2;
      const distB = (b.lon - lon) ** 2 + (b.lat - lat) ** 2;
      return distA - distB;
    });

    const nearest = nearby.slice(0, 4);
    const closestDist = Math.sqrt((nearest[0].lon - lon) ** 2 + (nearest[0].lat - lat) ** 2);
    if (closestDist > this.cellSize * 2) return null;

    // Inverse distance weighted interpolation
    let totalWeight = 0;
    let height = 0;
    let dirX = 0;
    let dirY = 0;
    let period = 0;

    for (const p of nearest) {
      const dist = Math.sqrt((p.lon - lon) ** 2 + (p.lat - lat) ** 2);
      const weight = dist < 0.001 ? 1000 : 1 / (dist * dist);
      totalWeight += weight;

      height += p.waveHeight * weight;
      const dirRad = (p.waveDirection * Math.PI) / 180;
      dirX += Math.sin(dirRad) * weight;
      dirY += -Math.cos(dirRad) * weight;
      period += (p.wavePeriod || 10) * weight;
    }

    if (totalWeight === 0) return nearest[0];

    const avgDir = (Math.atan2(dirX, -dirY) * 180) / Math.PI;

    return {
      lat,
      lon,
      waveHeight: height / totalWeight,
      waveDirection: (avgDir + 360) % 360,
      wavePeriod: period / totalWeight,
    };
  }

  getRandomPoint(): { lon: number; lat: number } {
    return {
      lon: this.minLon + Math.random() * (this.maxLon - this.minLon),
      lat: this.minLat + Math.random() * (this.maxLat - this.minLat),
    };
  }

  getRandomPointNear(lon: number, lat: number, radius: number): { lon: number; lat: number } {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius;
    let newLon = lon + Math.cos(angle) * dist;
    let newLat = lat + Math.sin(angle) * dist;

    // Clamp to bounds
    newLon = Math.max(this.minLon, Math.min(this.maxLon, newLon));
    newLat = Math.max(this.minLat, Math.min(this.maxLat, newLat));

    return { lon: newLon, lat: newLat };
  }
}

/**
 * Wave Particle Engine
 * Renders oscillating perpendicular bars showing wave direction
 */
export class WaveParticleEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bars: WaveBar[] = [];
  private dataGrid: WaveDataGrid | null = null;
  private config: WaveVisualizationConfig;
  private animationId: number | null = null;
  private isRunning = false;
  private time = 0;

  private projectFn: ((lng: number, lat: number) => [number, number] | null) | null = null;
  private unprojectFn: ((x: number, y: number) => [number, number] | null) | null = null;

  constructor(canvas: HTMLCanvasElement, config: Partial<WaveVisualizationConfig> = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setProjection(
    project: (lng: number, lat: number) => [number, number] | null,
    unproject: (x: number, y: number) => [number, number] | null
  ) {
    this.projectFn = project;
    this.unprojectFn = unproject;
  }

  setData(data: WaveDataPoint[]) {
    if (data.length === 0) {
      this.dataGrid = null;
      this.bars = [];
      return;
    }

    this.dataGrid = new WaveDataGrid(data, 2);

    if (this.bars.length === 0) {
      this.initBars();
    } else {
      this.updateBarData();
    }

    console.log(`Wave visualization: ${this.bars.length} bars from ${data.length} data points`);
  }

  setConfig(config: Partial<WaveVisualizationConfig>) {
    const oldCount = this.config.barCount;
    this.config = { ...this.config, ...config };
    if (config.barCount && config.barCount !== oldCount) {
      this.initBars();
    }
  }

  private initBars() {
    if (!this.dataGrid) return;

    this.bars = [];
    const { barCount, barLifespan } = this.config;

    let attempts = 0;
    const maxAttempts = barCount * 5;

    while (this.bars.length < barCount && attempts < maxAttempts) {
      attempts++;

      const { lon, lat } = this.dataGrid.getRandomPoint();
      const waveData = this.dataGrid.interpolate(lon, lat);
      if (!waveData || waveData.waveHeight < 0.2) continue;

      this.bars.push({
        lon,
        lat,
        direction: waveData.waveDirection,
        height: waveData.waveHeight,
        period: waveData.wavePeriod || 10,
        age: Math.floor(Math.random() * barLifespan), // Stagger ages
        maxAge: barLifespan + Math.floor(Math.random() * 20) - 10,
        phase: Math.random() * Math.PI * 2,
      });
    }

    console.log(`Initialized ${this.bars.length} wave bars`);
  }

  private updateBarData() {
    if (!this.dataGrid) return;

    for (const bar of this.bars) {
      const waveData = this.dataGrid.interpolate(bar.lon, bar.lat);
      if (waveData) {
        bar.direction = waveData.waveDirection;
        bar.height = waveData.waveHeight;
        bar.period = waveData.wavePeriod || 10;
      }
    }
  }

  private respawnBar(bar: WaveBar) {
    if (!this.dataGrid) return;

    const { respawnRadius, barLifespan } = this.config;

    // Try to spawn nearby first
    for (let attempt = 0; attempt < 10; attempt++) {
      const { lon, lat } = this.dataGrid.getRandomPointNear(bar.lon, bar.lat, respawnRadius);
      const waveData = this.dataGrid.interpolate(lon, lat);

      if (waveData && waveData.waveHeight >= 0.2) {
        bar.lon = lon;
        bar.lat = lat;
        bar.direction = waveData.waveDirection;
        bar.height = waveData.waveHeight;
        bar.period = waveData.wavePeriod || 10;
        bar.age = 0;
        bar.maxAge = barLifespan + Math.floor(Math.random() * 20) - 10;
        bar.phase = Math.random() * Math.PI * 2;
        return;
      }
    }

    // Fallback: spawn anywhere
    for (let attempt = 0; attempt < 10; attempt++) {
      const { lon, lat } = this.dataGrid.getRandomPoint();
      const waveData = this.dataGrid.interpolate(lon, lat);

      if (waveData && waveData.waveHeight >= 0.2) {
        bar.lon = lon;
        bar.lat = lat;
        bar.direction = waveData.waveDirection;
        bar.height = waveData.waveHeight;
        bar.period = waveData.wavePeriod || 10;
        bar.age = 0;
        bar.maxAge = barLifespan + Math.floor(Math.random() * 20) - 10;
        bar.phase = Math.random() * Math.PI * 2;
        return;
      }
    }

    // Last resort: just reset age
    bar.age = 0;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Wave animation started');
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private animate = () => {
    if (!this.isRunning) return;

    this.time += this.config.oscillationSpeed;
    this.update();
    this.draw();

    this.animationId = requestAnimationFrame(this.animate);
  };

  private update() {
    for (const bar of this.bars) {
      bar.age++;
      if (bar.age > bar.maxAge) {
        this.respawnBar(bar);
      }
    }
  }

  private draw() {
    if (!this.projectFn || this.bars.length === 0) return;

    const { width, height } = this.canvas;
    const ctx = this.ctx;
    const {
      barLength,
      barWidth,
      oscillationAmplitude,
      fadeInFrames,
      fadeOutFrames,
      color,
      opacity,
    } = this.config;

    // Clear canvas completely (no trail effect for wave bars)
    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = barWidth;
    ctx.lineCap = 'round';

    for (const bar of this.bars) {
      // Project base position to screen
      const screenPos = this.projectFn(bar.lon, bar.lat);
      if (!screenPos) continue;

      const [baseX, baseY] = screenPos;

      // Skip if off screen
      if (baseX < -50 || baseX > width + 50 || baseY < -50 || baseY > height + 50) {
        continue;
      }

      // Calculate fade alpha based on age
      let alpha: number;
      if (bar.age < fadeInFrames) {
        alpha = bar.age / fadeInFrames;
      } else if (bar.age > bar.maxAge - fadeOutFrames) {
        alpha = (bar.maxAge - bar.age) / fadeOutFrames;
      } else {
        alpha = 1;
      }
      alpha = Math.max(0, Math.min(1, alpha));

      // Scale amplitude by wave height (bigger waves = more movement)
      const heightScale = Math.min(2, 0.5 + bar.height / 3);
      const amplitude = oscillationAmplitude * heightScale;

      // Oscillation speed inversely proportional to period (longer period = slower)
      const periodScale = 10 / Math.max(bar.period, 5);

      // Calculate lateral offset - oscillates perpendicular to wave direction
      // sin creates smooth back-and-forth motion
      const lateralOffset = Math.sin(this.time * periodScale + bar.phase) * amplitude;

      // Wave direction in radians
      const waveDirRad = (bar.direction * Math.PI) / 180;

      // Perpendicular direction (90 degrees offset)
      const perpDirRad = waveDirRad + Math.PI / 2;

      // Calculate draw position (base + lateral offset in perpendicular direction)
      const drawX = baseX + Math.cos(perpDirRad) * lateralOffset;
      const drawY = baseY + Math.sin(perpDirRad) * lateralOffset;

      // Bar is oriented perpendicular to wave direction
      const barAngle = perpDirRad;
      const halfLength = barLength / 2;

      const x1 = drawX - Math.cos(barAngle) * halfLength;
      const y1 = drawY - Math.sin(barAngle) * halfLength;
      const x2 = drawX + Math.cos(barAngle) * halfLength;
      const y2 = drawY + Math.sin(barAngle) * halfLength;

      // Draw the bar
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * opacity})`;
      ctx.stroke();
    }
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
  }

  destroy() {
    this.stop();
    this.bars = [];
    this.dataGrid = null;
  }
}

export type { WaveVisualizationConfig as ParticleConfig };
