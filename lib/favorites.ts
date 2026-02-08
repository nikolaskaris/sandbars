const STORAGE_KEY = 'sandbars_favorites';

export interface Favorite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export function getFavorites(): Favorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addFavorite(favorite: Favorite): void {
  const favorites = getFavorites();
  favorites.push(favorite);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

export function removeFavorite(id: string): void {
  const favorites = getFavorites().filter(f => f.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

export function isFavorite(lat: number, lng: number): boolean {
  return getFavorites().some(
    f => Math.abs(f.lat - lat) < 0.001 && Math.abs(f.lng - lng) < 0.001
  );
}

export function findFavorite(lat: number, lng: number): Favorite | undefined {
  return getFavorites().find(
    f => Math.abs(f.lat - lat) < 0.001 && Math.abs(f.lng - lng) < 0.001
  );
}
