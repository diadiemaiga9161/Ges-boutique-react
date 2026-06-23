import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../services/api.service';

export default function LoginScreen({ onLogin, navigation }: { onLogin: (user: any) => void; navigation?: any }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Erreur', 'Remplis tous les champs');
      return;
    }
    setLoading(true);
    try {
      const res = await login(identifier, password);
      const data = res.data?.data || res.data;
      const user = { ...data.utilisateur, token: data.token };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('token', data.token);
      onLogin(user);
    } catch (e: any) {
      Alert.alert('Connexion échouée', e.response?.data?.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text variant="headlineMedium" style={styles.title}>Ges Boutique</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>Connexion à votre boutique</Text>

        <TextInput
          label="Email / Téléphone / Nom d'utilisateur"
          value={identifier}
          onChangeText={setIdentifier}
          style={styles.input}
          mode="outlined"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          mode="outlined"
          secureTextEntry={!showPassword}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
        />

        {loading ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          <Button mode="contained" onPress={handleLogin} style={styles.btn}>
            Se connecter
          </Button>
        )}
        <Button onPress={() => navigation?.navigate('ForgotPassword')} style={{ marginTop: 4 }}>
          Mot de passe oublié ?
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1976D2', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, elevation: 4 },
  title: { textAlign: 'center', fontWeight: 'bold', color: '#1976D2', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 24 },
  input: { marginBottom: 12 },
  btn: { marginTop: 8, borderRadius: 8 },
});
