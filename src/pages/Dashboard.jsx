import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Map from '@/components/Map';
import LocationSearch from '@/components/LocationSearch';
import WeatherDisplay from '@/components/WeatherDisplay';
import { getWeatherData } from '@/services/weatherApi';
import { reverseGeocode } from '@/services/geocodingApi';

export default function Dashboard() {
  const { user, logout, addFavorite, removeFavorite } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState('map'); // 'map' or 'favorites'
  const [mapCenter, setMapCenter] = useState([20, 0]);
  const [mapZoom, setMapZoom] = useState(2);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [spotName, setSpotName] = useState('');
  const [spotDescription, setSpotDescription] = useState('');

  const handleLocationSearch = (location) => {
    setMapCenter([location.lat, location.lng]);
    setMapZoom(12);
    setSelectedLocation({
      ...location,
      name: location.name || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
    });
  };

  const handleMapClick = async (latlng) => {
    const { lat, lng } = latlng;
    const locationInfo = await reverseGeocode(lat, lng);

    setSelectedLocation({
      id: `${lat}-${lng}`,
      lat,
      lng,
      name: locationInfo.name,
    });
    setMapCenter([lat, lng]);
  };

  const handleMarkerClick = (marker) => {
    setSelectedLocation(marker);
    setMapCenter([marker.lat, marker.lng]);
  };

  useEffect(() => {
    if (!selectedLocation) {
      setWeather(null);
      return;
    }

    const fetchWeather = async () => {
      setLoadingWeather(true);
      try {
        const data = await getWeatherData(selectedLocation.lat, selectedLocation.lng);
        setWeather(data);
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [selectedLocation]);

  const handleSaveSpot = () => {
    if (!selectedLocation) return;

    const spot = {
      id: `spot-${Date.now()}`,
      name: spotName || selectedLocation.name,
      description: spotDescription,
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      savedAt: new Date().toISOString(),
    };

    addFavorite(spot);
    setShowSaveDialog(false);
    setSpotName('');
    setSpotDescription('');
    setView('favorites');
  };

  const handleRemoveSpot = (spotId) => {
    if (confirm('Are you sure you want to remove this spot?')) {
      removeFavorite(spotId);
    }
  };

  const handleViewFavoriteSpot = (spot) => {
    setView('map');
    setSelectedLocation(spot);
    setMapCenter([spot.lat, spot.lng]);
    setMapZoom(12);
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - Surf Forecast</title>
      </Helmet>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 z-10">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div>
                <h1 className="text-2xl font-bold text-ocean-600">🏄 Surf Forecast</h1>
                <p className="text-sm text-gray-600">Welcome, {user?.name || user?.email}</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setView(view === 'map' ? 'favorites' : 'map')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-ocean-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {view === 'map' ? '⭐ Favorites' : '🗺️ Map'}
                </button>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {view === 'map' ? (
            <div className="h-full flex flex-col md:flex-row">
              {/* Map Section */}
              <div className="flex-1 relative">
                <div className="absolute top-4 left-4 right-4 z-[1000]">
                  <LocationSearch onLocationSelect={handleLocationSearch} />
                </div>
                <Map
                  center={mapCenter}
                  zoom={mapZoom}
                  markers={user?.favorites || []}
                  onMapClick={handleMapClick}
                  onMarkerClick={handleMarkerClick}
                  selectedMarker={selectedLocation}
                />
              </div>

              {/* Sidebar */}
              <div className="w-full md:w-96 bg-white shadow-lg overflow-y-auto">
                <div className="p-6">
                  {selectedLocation && (
                    <div className="mb-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            {selectedLocation.name}
                          </h2>
                          <p className="text-sm text-gray-600 mt-1">
                            {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowSaveDialog(true)}
                          className="px-3 py-1 bg-ocean-500 text-white text-sm rounded-lg hover:bg-ocean-600 transition-colors"
                        >
                          Save Spot
                        </button>
                      </div>
                    </div>
                  )}

                  {loadingWeather ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-ocean-500"></div>
                      <p className="mt-4 text-gray-600">Loading weather...</p>
                    </div>
                  ) : (
                    <WeatherDisplay weather={weather} location={selectedLocation} />
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Favorites View */
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Saved Spots</h2>

                {!user?.favorites || user.favorites.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-12 text-center">
                    <svg
                      className="w-16 h-16 mx-auto text-gray-400 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No saved spots yet</h3>
                    <p className="text-gray-600 mb-4">
                      Search for a location on the map and save your favorite surf spots
                    </p>
                    <button
                      onClick={() => setView('map')}
                      className="px-6 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 transition-colors"
                    >
                      Go to Map
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.favorites.map((spot) => (
                      <div key={spot.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-lg font-bold text-gray-900">{spot.name}</h3>
                          <button
                            onClick={() => handleRemoveSpot(spot.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                        {spot.description && <p className="text-gray-600 text-sm mb-3">{spot.description}</p>}
                        <p className="text-xs text-gray-500 mb-3">
                          {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                        </p>
                        <button
                          onClick={() => handleViewFavoriteSpot(spot)}
                          className="w-full px-4 py-2 bg-ocean-50 text-ocean-600 rounded-lg hover:bg-ocean-100 transition-colors font-medium"
                        >
                          View on Map
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Save Spot Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Save Surf Spot</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Spot Name</label>
                  <input
                    type="text"
                    value={spotName}
                    onChange={(e) => setSpotName(e.target.value)}
                    placeholder={selectedLocation?.name || 'My Favorite Spot'}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={spotDescription}
                    onChange={(e) => setSpotDescription(e.target.value)}
                    placeholder="Notes about this spot..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-ocean-500"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSpot}
                    className="flex-1 px-4 py-2 bg-ocean-500 text-white rounded-lg hover:bg-ocean-600 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
