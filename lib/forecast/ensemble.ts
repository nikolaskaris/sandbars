/**
 * Multi-Model Ensemble Combination
 * Implements weighted averaging, outlier rejection, and confidence estimation
 */

import { QualityFlag } from '@/types';

export interface EnsembleMember {
  value: number;
  source: string;
  sourceType: 'observation' | 'model' | 'interpolated';
  weight: number;
  distance?: number; // km, for observations
  quality: QualityFlag;
}

export interface EnsembleResult {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p10: number; // 10th percentile
  p90: number; // 90th percentile
  confidence: 'high' | 'medium' | 'low';
  quality: QualityFlag;
  sources: string[];
  memberCount: number;
}

export interface EnsembleConfig {
  baseWeights: {
    observation: number;
    model: number;
    interpolated: number;
  };
  outlierThreshold: number; // Standard deviations
  minMembers: number;
  confidenceThresholds: {
    high: number; // Max std dev for high confidence
    medium: number; // Max std dev for medium confidence
  };
}

const DEFAULT_CONFIG: EnsembleConfig = {
  baseWeights: {
    observation: 0.5,
    model: 0.3,
    interpolated: 0.2,
  },
  outlierThreshold: 3.0,
  minMembers: 2,
  confidenceThresholds: {
    high: 0.3, // < 0.3m spread = high confidence
    medium: 0.6, // < 0.6m spread = medium confidence
  },
};

/**
 * Combine multiple forecast sources into ensemble statistics
 */
export function combineEnsemble(
  members: EnsembleMember[],
  config: EnsembleConfig = DEFAULT_CONFIG
): EnsembleResult | null {
  if (members.length < config.minMembers) {
    return null;
  }

  // Calculate initial weights
  const weightedMembers = members.map(m => ({
    ...m,
    effectiveWeight: calculateEffectiveWeight(m, config),
  }));

  // Reject outliers
  const filtered = rejectOutliers(weightedMembers, config.outlierThreshold);

  if (filtered.length < config.minMembers) {
    return null;
  }

  // Normalize weights
  const totalWeight = filtered.reduce((sum, m) => sum + m.effectiveWeight, 0);
  const normalized = filtered.map(m => ({
    ...m,
    normalizedWeight: m.effectiveWeight / totalWeight,
  }));

  // Calculate ensemble statistics
  const values = normalized.map(m => m.value);
  const weights = normalized.map(m => m.normalizedWeight);

  const mean = weightedAverage(values, weights);
  const variance = weightedVariance(values, weights, mean);
  const stdDev = Math.sqrt(variance);

  const sorted = [...values].sort((a, b) => a - b);

  const result: EnsembleResult = {
    mean,
    median: percentile(sorted, 50),
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    p10: percentile(sorted, 10),
    p90: percentile(sorted, 90),
    confidence: determineConfidence(stdDev, config),
    quality: determineQuality(normalized),
    sources: normalized.map(m => m.source),
    memberCount: normalized.length,
  };

  return result;
}

/**
 * Calculate effective weight for an ensemble member
 */
function calculateEffectiveWeight(
  member: EnsembleMember,
  config: EnsembleConfig
): number {
  let weight = config.baseWeights[member.sourceType];

  // Adjust for distance (observations only)
  if (member.sourceType === 'observation' && member.distance !== undefined) {
    // Inverse distance squared weighting
    // Normalize so 10km = full weight, 100km = 0.01x weight
    const distanceFactor = Math.pow(10 / Math.max(member.distance, 1), 2);
    weight *= Math.min(distanceFactor, 1);
  }

  // Adjust for quality
  const qualityMultiplier = {
    primary: 1.0,
    interpolated: 0.8,
    modeled: 0.6,
    stale: 0.4,
    historical: 0.2,
    missing: 0.0,
  };

  weight *= qualityMultiplier[member.quality] || 0.5;

  return Math.max(weight, 0);
}

/**
 * Reject statistical outliers from ensemble
 */
function rejectOutliers(
  members: Array<EnsembleMember & { effectiveWeight: number }>,
  threshold: number
): Array<EnsembleMember & { effectiveWeight: number }> {
  if (members.length < 3) {
    return members; // Can't reject outliers with < 3 members
  }

  const values = members.map(m => m.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );

  if (stdDev === 0) {
    return members; // All values identical
  }

  return members.filter(m => {
    const zScore = Math.abs(m.value - mean) / stdDev;
    return zScore <= threshold;
  });
}

/**
 * Weighted average
 */
function weightedAverage(values: number[], weights: number[]): number {
  return values.reduce((sum, val, i) => sum + val * weights[i], 0);
}

/**
 * Weighted variance
 */
function weightedVariance(
  values: number[],
  weights: number[],
  mean: number
): number {
  return values.reduce((sum, val, i) => sum + weights[i] * Math.pow(val - mean, 2), 0);
}

/**
 * Calculate percentile
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Determine confidence level from ensemble spread
 */
function determineConfidence(
  stdDev: number,
  config: EnsembleConfig
): 'high' | 'medium' | 'low' {
  if (stdDev < config.confidenceThresholds.high) return 'high';
  if (stdDev < config.confidenceThresholds.medium) return 'medium';
  return 'low';
}

/**
 * Determine overall quality flag
 */
function determineQuality(
  members: Array<{ quality: QualityFlag; normalizedWeight: number }>
): QualityFlag {
  // Weight-based quality determination
  const primaryWeight = members
    .filter(m => m.quality === 'primary')
    .reduce((sum, m) => sum + m.normalizedWeight, 0);

  const interpolatedWeight = members
    .filter(m => m.quality === 'interpolated')
    .reduce((sum, m) => sum + m.normalizedWeight, 0);

  const modeledWeight = members
    .filter(m => m.quality === 'modeled')
    .reduce((sum, m) => sum + m.normalizedWeight, 0);

  if (primaryWeight > 0.6) return 'primary';
  if (primaryWeight + interpolatedWeight > 0.6) return 'interpolated';
  if (modeledWeight > 0.5) return 'modeled';

  return 'interpolated';
}

/**
 * Combine directional data (waves/wind) using circular statistics
 */
export function combineDirections(
  members: EnsembleMember[],
  config: EnsembleConfig = DEFAULT_CONFIG
): EnsembleResult | null {
  if (members.length < config.minMembers) {
    return null;
  }

  // Calculate weights
  const weightedMembers = members.map(m => ({
    ...m,
    effectiveWeight: calculateEffectiveWeight(m, config),
  }));

  // Reject outliers in circular space (more complex)
  const filtered = rejectCircularOutliers(weightedMembers);

  if (filtered.length < config.minMembers) {
    return null;
  }

  // Normalize weights
  const totalWeight = filtered.reduce((sum, m) => sum + m.effectiveWeight, 0);
  const normalized = filtered.map(m => ({
    ...m,
    normalizedWeight: m.effectiveWeight / totalWeight,
  }));

  // Circular mean
  const radians = normalized.map(m => (m.value * Math.PI) / 180);
  const weights = normalized.map(m => m.normalizedWeight);

  const xSum = radians.reduce((sum, rad, i) => sum + weights[i] * Math.cos(rad), 0);
  const ySum = radians.reduce((sum, rad, i) => sum + weights[i] * Math.sin(rad), 0);

  const meanRad = Math.atan2(ySum, xSum);
  const meanDeg = (((meanRad * 180) / Math.PI) + 360) % 360;

  // Circular variance (R parameter)
  const R = Math.sqrt(xSum * xSum + ySum * ySum);
  const circularStdDev = Math.sqrt(-2 * Math.log(R)) * (180 / Math.PI);

  const values = normalized.map(m => m.value);

  return {
    mean: meanDeg,
    median: meanDeg, // Use mean for circular
    stdDev: circularStdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    p10: meanDeg - circularStdDev,
    p90: meanDeg + circularStdDev,
    confidence: circularStdDev < 30 ? 'high' : circularStdDev < 60 ? 'medium' : 'low',
    quality: determineQuality(normalized),
    sources: normalized.map(m => m.source),
    memberCount: normalized.length,
  };
}

/**
 * Reject outliers in circular space
 */
function rejectCircularOutliers(
  members: Array<EnsembleMember & { effectiveWeight: number }>
): Array<EnsembleMember & { effectiveWeight: number }> {
  if (members.length < 3) {
    return members;
  }

  // For circular data, reject values > 90° from circular mean
  const radians = members.map(m => (m.value * Math.PI) / 180);
  const xMean = radians.reduce((sum, rad) => sum + Math.cos(rad), 0) / radians.length;
  const yMean = radians.reduce((sum, rad) => sum + Math.sin(rad), 0) / radians.length;
  const meanRad = Math.atan2(yMean, xMean);

  return members.filter(m => {
    const rad = (m.value * Math.PI) / 180;
    const diff = Math.abs(rad - meanRad);
    const normalizedDiff = Math.min(diff, 2 * Math.PI - diff);
    return normalizedDiff < Math.PI / 2; // < 90 degrees
  });
}
