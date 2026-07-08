import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LangCtx {
  lang: string;
  setLang: (lang: string) => Promise<void>;
}

const LangContext = createContext<LangCtx>({ lang: 'fr', setLang: async () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState('fr');

  useEffect(() => {
    AsyncStorage.getItem('lang').then(l => { if (l) setLangState(l); });
  }, []);

  const setLang = async (l: string) => {
    setLangState(l);
    await AsyncStorage.setItem('lang', l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
