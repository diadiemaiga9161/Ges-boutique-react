import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type Scheme = 'light' | 'dark';

interface ThemeCtx {
  mode: ThemeMode;
  scheme: Scheme;
  setMode: (m: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeCtx>({
  mode: 'auto',
  scheme: 'light',
  setMode: async () => {},
});

const STORAGE_KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'auto') setModeState(v);
    });
  }, []);

  const setMode = async (m: ThemeMode) => {
    setModeState(m);
    try { await AsyncStorage.setItem(STORAGE_KEY, m); } catch {}
  };

  const scheme: Scheme = mode === 'auto'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : mode;

  return (
    <ThemeContext.Provider value={{ mode, scheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeMode = () => useContext(ThemeContext);
