/**
 * Quality Indicator Component
 * Shows data quality badges for forecast metrics
 */

import { QualityFlag } from '@/types';

interface QualityIndicatorProps {
  quality: QualityFlag;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const QUALITY_COLORS: Record<QualityFlag, string> = {
  primary: 'bg-green-100 text-green-800 border-green-300',
  interpolated: 'bg-blue-100 text-blue-800 border-blue-300',
  modeled: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  stale: 'bg-orange-100 text-orange-800 border-orange-300',
  historical: 'bg-gray-100 text-gray-800 border-gray-300',
  missing: 'bg-red-100 text-red-800 border-red-300',
};

const QUALITY_LABELS: Record<QualityFlag, string> = {
  primary: 'Direct',
  interpolated: 'Interpolated',
  modeled: 'Model',
  stale: 'Stale',
  historical: 'Historical',
  missing: 'Missing',
};

const QUALITY_DESCRIPTIONS: Record<QualityFlag, string> = {
  primary: 'Direct observation from nearby station',
  interpolated: 'Interpolated from multiple nearby stations',
  modeled: 'From numerical weather model',
  stale: 'Data more than 3 hours old',
  historical: 'Historical average for this location',
  missing: 'No data available',
};

export default function QualityIndicator({
  quality,
  showLabel = true,
  size = 'sm'
}: QualityIndicatorProps) {
  const colorClass = QUALITY_COLORS[quality];
  const label = QUALITY_LABELS[quality];
  const description = QUALITY_DESCRIPTIONS[quality];

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  if (!showLabel) {
    // Just show a colored dot
    const dotSizes = {
      sm: 'w-2 h-2',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
    };

    return (
      <span
        className={`inline-block rounded-full ${dotSizes[size]} ${colorClass.split(' ')[0]}`}
        title={description}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${colorClass} ${sizeClasses[size]}`}
      title={description}
    >
      {label}
    </span>
  );
}

/**
 * Data Source Badge
 * Shows which station/source the data came from
 */
interface DataSourceBadgeProps {
  source: string;
  distance?: number; // km
}

export function DataSourceBadge({ source, distance }: DataSourceBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
      title={`Data source: ${source}`}
    >
      <svg
        className="w-3 h-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {distance !== undefined ? `${distance}km away` : source}
    </span>
  );
}
