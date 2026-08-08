import 'react-native-gesture-handler';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { LangProvider } from './src/i18n/LangContext';
import { ThemeProvider, useThemeMode } from './src/theme/ThemeContext';
import { PaperProvider, MD3LightTheme, MD3DarkTheme, Portal, Snackbar } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enableScreens } from 'react-native-screens';
import SplashLoadingScreen from './src/screens/SplashLoadingScreen';

import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import BoutiqueSelectScreen from './src/screens/BoutiqueSelectScreen';
import AppNavigation from './src/navigation';
import { initDatabase } from './src/db/database';
import { demarrerAutoSync } from './src/services/offline.service';
import { setOnAuthError, initApiSession, removeStoredToken } from './src/services/api.service';
import { setToastListener, ToastPayload } from './src/services/toast.service';

// react-native-screens optimise le rendu natif (iOS/Android) en gérant les
// vues via l'OS ; sur web ça casse le scroll interne des ScrollView (les
// écrans deviennent des conteneurs overflow:hidden sans hauteur propagée).
// Aucun gain sur web de toute façon (pas de recyclage de vues natif) donc
// on ne l'active que sur mobile — pages entières redeviennent scrollables.
if (Platform.OS !== 'web') enableScreens();

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976D2',
    secondary: '#42a5f5',
    background: '#f5f5f5',
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#3b82f6',
    secondary: '#60a5fa',
    background: '#111827',
    surface: '#1f2937',
    surfaceVariant: '#1f2937',
  },
};

// Sélectionne automatiquement le thème react-native-paper (clair/sombre)
// en fonction de la préférence utilisateur (ThemeContext) — impacte tous
// les composants Paper (Card, TextInput, Button, Chip, Searchbar, FAB…)
function ThemedPaperProvider({ children }: { children: React.ReactNode }) {
  const { scheme } = useThemeMode();
  return (
    <PaperProvider theme={scheme === 'dark' ? darkTheme : lightTheme}>
      {children}
    </PaperProvider>
  );
}

const HEADER = {
  headerStyle: { backgroundColor: '#081648' },
  headerTintColor: '#fff' as const,
  headerTitleStyle: { fontWeight: 'bold' as const },
};

const AuthStack = createStackNavigator();

function AuthNavigator({ onLogin }: { onLogin: (user: any) => void }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {() => <LoginScreen onLogin={onLogin} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen}
        options={{ headerShown: true, ...HEADER, title: 'Mot de passe oublié' }} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen}
        options={{ headerShown: true, ...HEADER, title: 'Réinitialiser le mot de passe' }} />
    </AuthStack.Navigator>
  );
}

// Toast global (Snackbar react-native-paper), piloté par toast.service.ts —
// monté une seule fois à la racine pour rester visible même quand l'écran
// d'origine (ex: Login) est démonté juste après l'émission du toast.
function GlobalToast() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    setToastListener(setToast);
    return () => setToastListener(null);
  }, []);

  const bgByType: Record<ToastPayload['type'], string> = {
    info: '#1a56db',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
  };

  return (
    <Snackbar
      visible={!!toast}
      onDismiss={() => setToast(null)}
      duration={4500}
      style={toast ? { backgroundColor: bgByType[toast.type] } : undefined}
    >
      {toast?.message || ''}
    </Snackbar>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [boutiqueChoisie, setBoutiqueChoisie] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  const handleLogout = useCallback(async () => {
    await AsyncStorage.removeItem('user');
    await removeStoredToken();
    setUser(null);
    // boutique_port / api_url conservés → pas de re-sélection
  }, []);

  // Retour à l'écran de sélection de boutique (utile en test/dev, ou si un
  // vendeur change réellement de point de vente) — déconnecte aussi, la
  // sélection de boutique doit toujours précéder la connexion.
  const handleChangeBoutique = useCallback(async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('api_url');
    await AsyncStorage.removeItem('boutique_nom');
    await AsyncStorage.removeItem('boutique_info');
    await removeStoredToken();
    setUser(null);
    setBoutiqueChoisie(false);
  }, []);

  // Ref pour éviter les problèmes de closure avec le callback 401
  const logoutRef = useRef(handleLogout);
  useEffect(() => { logoutRef.current = handleLogout; }, [handleLogout]);

  useEffect(() => {
    // Enregistre le callback de déconnexion automatique sur 401
    setOnAuthError(() => logoutRef.current());
    return () => setOnAuthError(() => {});
  }, []);

  useEffect(() => {
    const init = async () => {
      try { await initDatabase(); } catch (e) { console.warn('DB:', e); }
      await initApiSession();
      const raw = await AsyncStorage.getItem('user');
      if (raw) {
        try { setUser(JSON.parse(raw)); } catch { await AsyncStorage.removeItem('user'); }
      }
      const apiUrl = await AsyncStorage.getItem('api_url');
      if (apiUrl) setBoutiqueChoisie(true);
      setLoading(false);
    };
    init();
    const stopSync = demarrerAutoSync((n) => console.log(`${n} vente(s) sync`));
    return () => stopSync();
  }, []);

  // Provider unique (thème + langue) englobant aussi le splash, pour que
  // useColors()/useThemeMode() soient disponibles dès le premier écran.
  return (
    <ThemeProvider>
    <LangProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemedPaperProvider>
          <Portal.Host>
            <StatusBar style="light" />
            {showSplash ? (
              <SplashLoadingScreen
                ready={!loading}
                onComplete={() => setShowSplash(false)}
              />
            ) : !boutiqueChoisie ? (
              // Étape 1 : choisir la boutique
              <BoutiqueSelectScreen onSelect={() => setBoutiqueChoisie(true)} />
            ) : user ? (
              // Étape 3 : app principale
              <AppNavigation onLogout={handleLogout} onChangeBoutique={handleChangeBoutique} user={user} />
            ) : (
              // Étape 2 : login
              <NavigationContainer>
                <AuthNavigator onLogin={setUser} />
              </NavigationContainer>
            )}
            <GlobalToast />
          </Portal.Host>
        </ThemedPaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </LangProvider>
    </ThemeProvider>
  );
}

