import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Surf Forecast - Track Your Spots Worldwide</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-br from-ocean-400 via-ocean-500 to-ocean-700">
        <div className="flex flex-col items-center justify-center min-h-screen text-white px-4">
          <div className="text-center max-w-4xl">
            {/* Hero Section */}
            <div className="mb-8">
              <div className="text-6xl mb-6">🏄‍♂️</div>
              <h1 className="text-5xl md:text-6xl font-bold mb-6">Surf Forecast</h1>
              <p className="text-xl md:text-2xl mb-8 text-ocean-100">
                Find and track your perfect surf spots anywhere in the world
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                to="/register"
                className="px-8 py-4 bg-white text-ocean-600 rounded-xl font-bold text-lg hover:bg-ocean-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Get Started Free
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-ocean-600 text-white rounded-xl font-bold text-lg hover:bg-ocean-700 transition-all border-2 border-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                Sign In
              </Link>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8 hover:bg-opacity-20 transition-all">
                <div className="text-4xl mb-4">🗺️</div>
                <h3 className="text-xl font-bold mb-3">Interactive Map</h3>
                <p className="text-ocean-100">
                  Search and explore surf spots worldwide with our interactive map interface
                </p>
              </div>

              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8 hover:bg-opacity-20 transition-all">
                <div className="text-4xl mb-4">🌊</div>
                <h3 className="text-xl font-bold mb-3">Real Weather Data</h3>
                <p className="text-ocean-100">
                  Get accurate wind, temperature, and weather forecasts from OpenWeather API
                </p>
              </div>

              <div className="bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8 hover:bg-opacity-20 transition-all">
                <div className="text-4xl mb-4">⭐</div>
                <h3 className="text-xl font-bold mb-3">Save Your Spots</h3>
                <p className="text-ocean-100">
                  Build your personal collection of favorite surf locations and track conditions
                </p>
              </div>
            </div>

            {/* Additional Features */}
            <div className="mt-16 bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-8">
              <h3 className="text-2xl font-bold mb-6">Key Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="flex items-start gap-3">
                  <span className="text-ocean-200">✓</span>
                  <span className="text-ocean-100">Click anywhere on the map to check conditions</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-ocean-200">✓</span>
                  <span className="text-ocean-100">5-day weather forecast for any location</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-ocean-200">✓</span>
                  <span className="text-ocean-100">Save unlimited favorite surf spots</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-ocean-200">✓</span>
                  <span className="text-ocean-100">Real-time wind speed and direction</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-ocean-200">✓</span>
                  <span className="text-ocean-100">Location search with autocomplete</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-ocean-200">✓</span>
                  <span className="text-ocean-100">Custom spot names and notes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-16 text-ocean-200 text-sm">
            <p>© {new Date().getFullYear()} Surf Forecast. All rights reserved.</p>
            <p className="mt-2">Weather data provided by OpenWeatherMap API</p>
          </footer>
        </div>
      </div>
    </>
  );
}
