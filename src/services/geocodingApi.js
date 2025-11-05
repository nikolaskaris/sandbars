import axios from 'axios';

// Nominatim (OpenStreetMap) for geocoding - free and no API key required
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

/**
 * Search for locations by name
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of location results
 */
export const searchLocations = async (query) => {
  try {
    const response = await axios.get(`${NOMINATIM_URL}/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 10,
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'SurfForecastApp/1.0',
      },
    });

    return response.data.map((item) => ({
      id: item.place_id,
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      address: {
        city: item.address?.city || item.address?.town || item.address?.village,
        state: item.address?.state,
        country: item.address?.country,
      },
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Failed to search locations');
  }
};

/**
 * Reverse geocode coordinates to get location name
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Location information
 */
export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await axios.get(`${NOMINATIM_URL}/reverse`, {
      params: {
        lat,
        lon: lng,
        format: 'json',
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'SurfForecastApp/1.0',
      },
    });

    return {
      name: response.data.display_name,
      address: {
        city: response.data.address?.city || response.data.address?.town,
        state: response.data.address?.state,
        country: response.data.address?.country,
      },
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      address: {},
    };
  }
};
