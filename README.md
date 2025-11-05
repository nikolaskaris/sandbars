# 🏄‍♂️ Surf Forecast App

A modern, interactive surf forecasting web application that lets you discover, track, and monitor surf spots anywhere in the world. Built with React, Vite, Leaflet maps, and real-time weather data from OpenWeatherMap API.

![Surf Forecast App](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

### 🗺️ Interactive Mapping
- **Global Search**: Search for any location worldwide using OpenStreetMap's Nominatim geocoding service
- **Click-to-Select**: Click anywhere on the map to check surf conditions at that exact location
- **Real-time Markers**: View all your saved spots directly on the map
- **Custom Markers**: Beautiful surf spot markers that stand out on the map

### 🌊 Real Weather Data
- **OpenWeatherMap Integration**: Fetch real weather data including:
  - Current temperature, humidity, and pressure
  - Wind speed and direction (crucial for surfing!)
  - 5-day weather forecast
  - Hourly breakdowns for detailed planning
- **Demo Mode**: Works with realistic mock data if no API key is configured

### ⭐ Favorites Management
- **Save Unlimited Spots**: Save as many surf spots as you want
- **Custom Names & Notes**: Give your spots memorable names and add personal notes
- **Quick Access**: Switch between map view and favorites view instantly
- **Easy Organization**: View all your saved spots in a clean, organized grid

### 🔐 User Authentication
- **Secure Login/Register**: Create your personal account
- **Persistent Sessions**: Stay logged in across browser sessions
- **Personal Data**: Each user's favorites are stored independently

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ and npm installed
- (Optional) OpenWeatherMap API key for live weather data

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/nikolaskaris/sandbars.git
   cd sandbars
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Key (Optional)**

   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your OpenWeatherMap API key:
   ```env
   VITE_OPENWEATHER_API_KEY=your_api_key_here
   ```

   Get a free API key at: https://openweathermap.org/api

   **Note**: The app works without an API key using realistic mock weather data.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:5173](http://localhost:5173)

### Building for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

To preview the production build:
```bash
npm run preview
```

## 📖 How to Use

### 1. Create an Account
- Click "Get Started Free" or "Sign Up"
- Enter your name, email, and password
- You're ready to go!

### 2. Search for Surf Spots
- Use the search bar at the top of the map
- Type any location (e.g., "Malibu Beach", "Bali", "Sydney")
- Click on a search result to jump to that location

### 3. Check Conditions
- Click anywhere on the map to see current weather conditions
- View real-time wind speed, temperature, and forecasts
- Check the 5-day forecast for planning your sessions

### 4. Save Your Spots
- After selecting a location, click "Save Spot"
- Give it a custom name (e.g., "My Secret Break")
- Add notes about the spot
- Access it anytime from your Favorites

### 5. Manage Favorites
- Click "⭐ Favorites" to view all saved spots
- Click "View on Map" to see conditions
- Remove spots you no longer need

## 🏗️ Project Structure

```
surf-forecast-app/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── Map.jsx          # Leaflet map component
│   │   ├── LocationSearch.jsx   # Location search with autocomplete
│   │   └── WeatherDisplay.jsx   # Weather data visualization
│   ├── contexts/            # React contexts
│   │   └── AuthContext.jsx      # Authentication & favorites management
│   ├── pages/               # Page components
│   │   ├── Home.jsx             # Landing page
│   │   ├── Login.jsx            # Login page
│   │   ├── Register.jsx         # Registration page
│   │   └── Dashboard.jsx        # Main app (map + weather)
│   ├── services/            # API integrations
│   │   ├── weatherApi.js        # OpenWeatherMap integration
│   │   └── geocodingApi.js      # Nominatim geocoding
│   ├── App.jsx              # Root component & routing
│   ├── main.jsx             # Application entry point
│   └── index.css            # Global styles
├── public/                  # Static assets
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS config
└── package.json             # Dependencies & scripts
```

## 🛠️ Technology Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **Mapping**: Leaflet + React-Leaflet
- **Routing**: React Router 6
- **HTTP Client**: Axios
- **Weather API**: OpenWeatherMap
- **Geocoding**: Nominatim (OpenStreetMap)

## 🔑 Key Components

### Map Component (`src/components/Map.jsx`)
- Interactive Leaflet map with custom markers
- Click handlers for selecting locations
- Marker popups with spot information

### Weather API Service (`src/services/weatherApi.js`)
- Fetches current weather and 5-day forecasts
- Handles API errors gracefully
- Falls back to mock data in demo mode
- Formats data for easy consumption

### Location Search (`src/components/LocationSearch.jsx`)
- Real-time search with debouncing
- Autocomplete suggestions
- Geocoding via OpenStreetMap Nominatim

### Auth Context (`src/contexts/AuthContext.jsx`)
- User authentication state management
- Favorites storage in localStorage
- Add, remove, and update favorite spots

## 🌐 API Integration

### OpenWeatherMap API

The app integrates with OpenWeatherMap's free tier:
- **Current Weather**: `/weather` endpoint
- **5-day Forecast**: `/forecast` endpoint
- **Units**: Metric (Celsius, km/h)

**Free tier limits**: 1,000 calls/day, 60 calls/minute

### Nominatim Geocoding

Uses OpenStreetMap's free Nominatim service:
- **Search**: Forward geocoding for location search
- **Reverse Geocode**: Get location names from coordinates
- **No API key required**

**Usage Policy**: Please respect OpenStreetMap's [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)

## 🎨 Features in Detail

### Interactive Map
- Pan and zoom to explore the world
- Tile layer from OpenStreetMap
- Custom surf spot icons
- Popups with spot details
- Responsive on all devices

### Weather Forecasting
- Current conditions with temperature, humidity, pressure
- Wind data (speed, direction, gusts)
- 5-day forecast with daily highs/lows
- Hourly breakdowns
- Weather descriptions and conditions

### Favorites System
- Save unlimited spots to your account
- Custom names for easy identification
- Optional descriptions and notes
- Persistent storage across sessions
- Easy removal and management

## 🚧 Future Enhancements

Potential features for future versions:

- [ ] Tide predictions and charts
- [ ] Wave height forecasts (integrate Stormglass API)
- [ ] Swell direction and period
- [ ] Best time to surf recommendations
- [ ] Spot sharing with other users
- [ ] Photo uploads for spots
- [ ] Push notifications for ideal conditions
- [ ] Mobile app (React Native)
- [ ] Weather alerts and warnings
- [ ] Historical weather data
- [ ] Advanced filters and search
- [ ] Export favorites list

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **OpenWeatherMap** for weather data API
- **OpenStreetMap** for map tiles and geocoding
- **Leaflet** for the amazing mapping library
- **Tailwind CSS** for beautiful styling utilities
- **Vite** for blazing-fast development experience

## 📧 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: [Your contact information]

## 🏄‍♀️ Tips for Best Results

1. **API Key**: Get a free OpenWeatherMap API key for real-time data
2. **Location Search**: Be specific in your searches (e.g., "Bondi Beach, Sydney" rather than just "beach")
3. **Wind Direction**: Wind direction matters! Offshore winds create better waves
4. **Multiple Spots**: Save multiple spots in different regions to always find good conditions
5. **Check Forecasts**: Plan ahead with the 5-day forecast

---

**Happy Surfing! 🏄‍♂️🌊**

Made with ❤️ for surfers worldwide
