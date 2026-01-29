'use client';

import { useCallback, useState } from 'react';
import { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { NDBCStation } from '@/lib/forecast/sources/ndbc-stations';

interface BuoyLayerProps {
  visible: boolean;
  stations: NDBCStation[];
  onBuoyClick?: (station: NDBCStation) => void;
}

interface PopupInfo {
  station: NDBCStation;
  longitude: number;
  latitude: number;
}

/**
 * Convert stations to GeoJSON format
 */
function stationsToGeoJSON(stations: NDBCStation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map(station => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [station.lon, station.lat],
      },
      properties: {
        id: station.id,
        name: station.name,
        owner: station.owner,
        type: station.type,
        hasMet: station.hasMet,
        hasCurrents: station.hasCurrents,
        hasWaterQuality: station.hasWaterQuality,
      },
    })),
  };
}

/**
 * Get display name for station type
 */
function getStationTypeLabel(type: NDBCStation['type']): string {
  switch (type) {
    case 'buoy': return 'Weather Buoy';
    case 'fixed': return 'C-MAN Station';
    case 'dart': return 'Tsunami Buoy';
    case 'tao': return 'TAO/PIRATA Buoy';
    case 'usv': return 'Unmanned Surface Vehicle';
    default: return 'Station';
  }
}

export default function BuoyLayer({ visible, stations, onBuoyClick }: BuoyLayerProps) {
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);

  const handleClick = useCallback((event: any) => {
    const feature = event.features?.[0];
    if (feature && feature.properties) {
      const station: NDBCStation = {
        id: feature.properties.id,
        name: feature.properties.name,
        owner: feature.properties.owner,
        type: feature.properties.type,
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        hasMet: feature.properties.hasMet,
        hasCurrents: feature.properties.hasCurrents,
        hasWaterQuality: feature.properties.hasWaterQuality,
      };

      setPopupInfo({
        station,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
      });

      if (onBuoyClick) {
        onBuoyClick(station);
      }
    }
  }, [onBuoyClick]);

  if (!visible || stations.length === 0) {
    return null;
  }

  const geojsonData = stationsToGeoJSON(stations);

  return (
    <>
      <Source
        id="buoys"
        type="geojson"
        data={geojsonData}
      >
        <Layer
          id="buoy-circles"
          type="circle"
          paint={{
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              4, 3,   // At zoom 4, radius 3
              8, 5,   // At zoom 8, radius 5
              12, 8,  // At zoom 12, radius 8
            ],
            'circle-color': [
              'match',
              ['get', 'type'],
              'buoy', '#3b82f6',    // blue
              'fixed', '#22c55e',   // green (C-MAN)
              'dart', '#ef4444',    // red (tsunami)
              'tao', '#f59e0b',     // amber (TAO/PIRATA)
              'usv', '#8b5cf6',     // purple (USV)
              '#9ca3af'             // gray default
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          }}
        />
        <Layer
          id="buoy-labels"
          type="symbol"
          minzoom={10}
          layout={{
            'text-field': ['get', 'id'],
            'text-size': 10,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
          }}
          paint={{
            'text-color': '#374151',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          }}
        />
      </Source>

      {popupInfo && (
        <Popup
          longitude={popupInfo.longitude}
          latitude={popupInfo.latitude}
          anchor="bottom"
          onClose={() => setPopupInfo(null)}
          closeOnClick={false}
          offset={15}
        >
          <div className="p-2 min-w-[180px]">
            <h3 className="font-semibold text-gray-900 text-sm">
              {popupInfo.station.name}
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              ID: {popupInfo.station.id}
            </p>
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  popupInfo.station.type === 'buoy' ? 'bg-blue-500' :
                  popupInfo.station.type === 'fixed' ? 'bg-green-500' :
                  popupInfo.station.type === 'dart' ? 'bg-red-500' :
                  popupInfo.station.type === 'tao' ? 'bg-amber-500' :
                  popupInfo.station.type === 'usv' ? 'bg-purple-500' :
                  'bg-gray-400'
                }`} />
                <span className="text-gray-600">
                  {getStationTypeLabel(popupInfo.station.type)}
                </span>
              </div>
              <p className="text-gray-500">
                Owner: {popupInfo.station.owner}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {popupInfo.station.hasMet && (
                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                    Met
                  </span>
                )}
                {popupInfo.station.hasCurrents && (
                  <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">
                    Currents
                  </span>
                )}
                {popupInfo.station.hasWaterQuality && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                    Water Quality
                  </span>
                )}
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}

// Export the layer ID for interactivity configuration
export const BUOY_LAYER_ID = 'buoy-circles';
