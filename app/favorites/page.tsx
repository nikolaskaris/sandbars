'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Header from '@/components/ui/Header';
import FavoritesTable from '@/components/favorites/FavoritesTable';
import { FavoriteLocation } from '@/types';

export default function FavoritesPage() {
  const [user, setUser] = useState<any>(null);
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkUser();
    fetchFavorites();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth');
    } else {
      setUser(user);
    }
  };

  const fetchFavorites = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/favorites');
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      const response = await fetch(`/api/favorites/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFavorites(favorites.filter((f) => f.id !== id));
      }
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Header userEmail={user?.email} />

      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Favorite Locations</h1>
            <p className="text-gray-600 mt-2">
              View surf forecasts for all your saved locations
            </p>
          </div>

          <div className="bg-white rounded-lg shadow">
            {loading ? (
              <div className="p-12 text-center">
                <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-600 mt-4">Loading favorites...</p>
              </div>
            ) : (
              <FavoritesTable favorites={favorites} onDelete={handleDeleteLocation} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
