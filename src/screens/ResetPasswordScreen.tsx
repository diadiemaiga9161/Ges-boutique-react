import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import api from '../services/api.service';

export default function ResetPasswordScreen({ navigation, route }: any) {
  const [token] = useState(route?.params?.token || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const reinitialiser = async () => {
    if (!password || password !== confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      Alert.alert('Succès', 'Mot de passe modifié avec succès', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Lien invalide ou expiré');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text variant="headlineSmall" style={styles.title}>Nouveau mot de passe</Text>
        <TextInput label="Nouveau mot de passe" value={password} onChangeText={setPassword} mode="outlined" secureTextEntry style={styles.input} />
        <TextInput label="Confirmer" value={confirm} onChangeText={setConfirm} mode="outlined" secureTextEntry style={styles.input} />
        {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : (
          <Button mode="contained" onPress={reinitialiser} style={styles.btn}>Réinitialiser</Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a56db', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontWeight: 'bold', color: '#1a56db', textAlign: 'center', marginBottom: 20 },
  input: { marginBottom: 12 },
  btn: { borderRadius: 8 },
});
