'use client';

import { useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { SwellData, WindData, WindWaveData } from '@/lib/wave-utils';

const SWELL_COLORS = ['#f59e0b', '#22c55e'];
const WIND_WAVE_COLOR = '#8b5cf6';
const WIND_COLOR = '#3b82f6';

interface VectorOverlayProps {
  map: maplibregl.Map;
  location: { lat: number; lng: number };
  swells: SwellData[] | null;
  windWaves: WindWaveData | null;
  wind: WindData | null;
}

export default function VectorOverlay({ map, location, swells, windWaves, wind }: VectorOverlayProps) {
  const [screenPos, setScreenPos] = useState<{ x: number; y: number } | null>(null);

  const updatePosition = useCallback(() => {
    const point = map.project([location.lng, location.lat]);
    setScreenPos({ x: point.x, y: point.y });
  }, [map, location.lng, location.lat]);

  useEffect(() => {
    updatePosition();
    map.on('move', updatePosition);
    return () => { map.off('move', updatePosition); };
  }, [map, updatePosition]);

  if (!screenPos) return null;

  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const arrowLen = 55;
  const labelDist = 72;

  interface Arrow {
    angle: number;
    color: string;
    label: string;
  }

  const arrows: Arrow[] = [];

  // Show up to 2 swells, or fall back to wind waves if no meaningful swells
  const validSwells = swells?.filter(s => s && s.height >= 0.1).slice(0, 2) ?? [];

  if (validSwells.length > 0) {
    for (let i = 0; i < validSwells.length; i++) {
      const s = validSwells[i];
      arrows.push({
        angle: s.direction,
        color: SWELL_COLORS[i],
        label: `Swell: ${s.height}m @ ${s.period}s`,
      });
    }
  } else if (windWaves && windWaves.height >= 0.1 && windWaves.direction != null) {
    arrows.push({
      angle: windWaves.direction,
      color: WIND_WAVE_COLOR,
      label: `Local waves: ${windWaves.height}m${windWaves.period ? ` @ ${windWaves.period}s` : ''}`,
    });
  }

  if (wind && wind.speed != null && wind.speed > 0) {
    arrows.push({
      angle: wind.direction,
      color: WIND_COLOR,
      label: `Wind: ${wind.speed} m/s`,
    });
  }

  if (arrows.length === 0) return null;

  return (
    <div
      data-testid="vector-overlay"
      style={{
        position: 'absolute',
        left: screenPos.x,
        top: screenPos.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* Dashed reference circle */}
        <circle
          cx={cx} cy={cy} r={arrowLen + 8}
          fill="none" stroke="rgba(156,163,175,0.5)"
          strokeWidth={1} strokeDasharray="4,3"
        />

        {/* Compass N */}
        <text
          x={cx} y={cy - arrowLen - 18}
          textAnchor="middle" fill="rgba(156,163,175,0.8)"
          fontSize={11} fontWeight={600} fontFamily="system-ui, sans-serif"
        >N</text>

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill="rgba(107,114,128,0.7)" />

        {arrows.map((arrow, idx) => {
          const rad = arrow.angle * Math.PI / 180;
          const sinA = Math.sin(rad);
          const cosA = Math.cos(rad);
          const sx = cx + sinA * arrowLen;
          const sy = cy - cosA * arrowLen;
          const tipGap = 8;
          const tipX = cx + sinA * tipGap;
          const tipY = cy - cosA * tipGap;

          const hl = 8;
          const hw = 4;
          const ux = -sinA;
          const uy = cosA;
          const px = -uy;
          const py = ux;

          const lx = cx + sinA * labelDist;
          const ly = cy - cosA * labelDist;
          let anchor: 'middle' | 'start' | 'end' = 'middle';
          if (arrow.angle > 30 && arrow.angle < 150) anchor = 'start';
          else if (arrow.angle > 210 && arrow.angle < 330) anchor = 'end';

          return (
            <g key={idx}>
              <line
                x1={sx} y1={sy} x2={tipX} y2={tipY}
                stroke={arrow.color} strokeWidth={3} strokeLinecap="round"
              />
              <polygon
                points={`${tipX},${tipY} ${tipX - hl * ux + hw * px},${tipY - hl * uy + hw * py} ${tipX - hl * ux - hw * px},${tipY - hl * uy - hw * py}`}
                fill={arrow.color}
              />
              <text
                x={lx} y={ly}
                textAnchor={anchor} dominantBaseline="central"
                fill={arrow.color} fontSize={11} fontWeight={600}
                fontFamily="system-ui, sans-serif"
                style={{ textShadow: '0 0 4px white, 0 0 4px white, 0 0 4px white' }}
              >
                {arrow.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
