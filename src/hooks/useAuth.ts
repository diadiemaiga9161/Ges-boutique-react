import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) setUser(JSON.parse(raw));
      setLoading(false);
    });
  }, []);

  const saveUser = async (u: User) => {
    await AsyncStorage.setItem('user', JSON.stringify(u));
    await AsyncStorage.setItem('token', u.token);
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    setUser(null);
  };

  const isAdmin = () => user?.role === 'ADMIN';

  return { user, loading, saveUser, logout, isAdmin };
}
