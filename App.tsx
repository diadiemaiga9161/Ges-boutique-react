import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { PaperProvider, MD3LightTheme, Portal } from 'react-native-paper';
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

enableScreens();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976D2',
    secondary: '#42a5f5',
    background: '#f5f5f5',
  },
};

const HEADER = {
  headerStyle: { backgroundColor: '#1976D2' },
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

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [boutiqueChoisie, setBoutiqueChoisie] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try { await initDatabase(); } catch (e) { console.warn('DB:', e); }
      const raw = await AsyncStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
      const apiUrl = await AsyncStorage.getItem('api_url');
      if (apiUrl) setBoutiqueChoisie(true);
      setLoading(false);
    };
    init();
    const stopSync = demarrerAutoSync((n) => console.log(`${n} vente(s) sync`));
    return () => stopSync();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    setUser(null);
    // boutique_port / api_url conservés → pas de re-sélection
  };

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <SplashLoadingScreen />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <Portal.Host>
            <StatusBar style="light" />
            {!boutiqueChoisie ? (
              // Étape 1 : choisir la boutique
              <BoutiqueSelectScreen onSelect={() => setBoutiqueChoisie(true)} />
            ) : user ? (
              // Étape 3 : app principale
              <AppNavigation onLogout={handleLogout} />
            ) : (
              // Étape 2 : login
              <NavigationContainer>
                <AuthNavigator onLogin={setUser} />
              </NavigationContainer>
            )}
          </Portal.Host>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

