'use client';

import { scoreColor } from '@/lib/quality';

interface QualitySparklineProps {
  scores: Array<{ time: Date; score: number }>;
  width?: number;
  height?: number;
}

/**
 * Compact 16-day quality bar chart. Each segment = one forecast period,
 * colored by quality score. Shows a "now" marker and highlights the best window.
 */
export default function QualitySparkline({
  scores,
  width = 200,
  height = 16,
}: QualitySparklineProps) {
  if (scores.length < 2) return null;

  const padding = 1;
  const barWidth = (width - padding * 2) / scores.length;
  const nowMs = Date.now();
  const startMs = scores[0].time.getTime();
  const endMs = scores[scores.length - 1].time.getTime();
  const timeRange = endMs - startMs || 1;

  // Find the best contiguous window (score ≥ 5)
  let bestStart = -1;
  let bestEnd = -1;
  let bestPeak = 0;
  let curStart = -1;
  let curPeak = 0;

  for (let i = 0; i < scores.length; i++) {
    if (scores[i].score >= 5) {
      if (curStart < 0) curStart = i;
      curPeak = Math.max(curPeak, scores[i].score);
    } else {
      if (curStart >= 0 && curPeak > bestPeak) {
        bestStart = curStart;
        bestEnd = i - 1;
        bestPeak = curPeak;
      }
      curStart = -1;
      curPeak = 0;
    }
  }
  if (curStart >= 0 && curPeak > bestPeak) {
    bestStart = curStart;
    bestEnd = scores.length - 1;
  }

  // Now marker position
  const nowX = padding + ((nowMs - startMs) / timeRange) * (width - padding * 2);
  const nowInRange = nowMs >= startMs && nowMs <= endMs;

  return (
    <svg width={width} height={height} className="block">
      {/* Best window highlight */}
      {bestStart >= 0 && (
        <rect
          x={padding + bestStart * barWidth - 1}
          y={0}
          width={(bestEnd - bestStart + 1) * barWidth + 2}
          height={height}
          rx={2}
          fill="#B8704C"
          opacity={0.1}
        />
      )}

      {/* Score bars */}
      {scores.map((s, i) => (
        <rect
          key={i}
          x={padding + i * barWidth}
          y={height - (s.score / 10) * height}
          width={Math.max(barWidth - 1, 1)}
          height={(s.score / 10) * height}
          rx={0.5}
          fill={scoreColor(s.score)}
          opacity={0.8}
        />
      ))}

      {/* Now marker */}
      {nowInRange && (
        <line
          x1={nowX}
          y1={0}
          x2={nowX}
          y2={height}
          stroke="#2C2825"
          strokeWidth={1.5}
          opacity={0.5}
        />
      )}
    </svg>
  );
}
