'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { loadPreferences, savePreferences, type UserPreferences, DEFAULT_PREFS } from '@/lib/preferences';

interface PreferencesContextType {
  prefs: UserPreferences;
  updatePref: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextType>({
  prefs: DEFAULT_PREFS,
  updatePref: () => {},
});

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPreferences);

  const updatePref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
