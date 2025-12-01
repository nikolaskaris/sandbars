'use client';

import { FavoriteLocation } from '@/types';

interface FavoritesListProps {
  favorites: FavoriteLocation[];
  selectedId: string | null;
  onSelect: (favorite: FavoriteLocation) => void;
  onDelete: (id: string) => Promise<void>;
}

export default function FavoritesList({
  favorites,
  selectedId,
  onSelect,
  onDelete,
}: FavoritesListProps) {
  return (
    <div className="space-y-2">
      {favorites.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No favorite locations yet</p>
          <p className="text-sm">Click on the map to add your first spot!</p>
        </div>
      ) : (
        favorites.map((favorite) => (
          <div
            key={favorite.id}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedId === favorite.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
            onClick={() => onSelect(favorite)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-medium text-lg">{favorite.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {favorite.latitude.toFixed(4)}, {favorite.longitude.toFixed(4)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(favorite.id);
                }}
                className="text-red-600 hover:text-red-800 p-1"
                title="Delete location"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
