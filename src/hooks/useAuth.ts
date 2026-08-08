import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { clearAuthToken, getStoredToken, setStoredToken, removeStoredToken } from '../services/api.service';

function decodeJwt(token: string): any {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  const decoded = decodeJwt(token);
  if (decoded?.exp) return decoded.exp * 1000 > Date.now();
  return true;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const rawUser = await AsyncStorage.getItem('user');
      const token = await getStoredToken();
      if (rawUser && isTokenValid(token)) {
        setUser(JSON.parse(rawUser));
      } else if (rawUser && !isTokenValid(token)) {
        // Token expiré : nettoyer
        await AsyncStorage.removeItem('user');
        await removeStoredToken();
      }
      setLoading(false);
    })();
  }, []);

  const saveUser = async (u: User) => {
    await AsyncStorage.setItem('user', JSON.stringify(u));
    await setStoredToken(u.token);
    setUser(u);
  };

  const logout = async () => {
    clearAuthToken();
    await AsyncStorage.removeItem('user');
    await removeStoredToken();
    setUser(null);
  };

  const isAdmin = () => user?.role === 'ADMIN';

  return { user, loading, saveUser, logout, isAdmin };
}
