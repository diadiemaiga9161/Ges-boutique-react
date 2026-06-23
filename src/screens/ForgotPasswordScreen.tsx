import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import api from '../services/api.service';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const envoyer = async () => {
    if (!email) { Alert.alert('Erreur', 'Entrez votre email'); return; }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      Alert.alert('Succès', 'Un lien de réinitialisation a été envoyé à votre email', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Email introuvable');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text variant="headlineSmall" style={styles.title}>Mot de passe oublié</Text>
        <Text style={styles.sub}>Entrez votre email pour recevoir un lien de réinitialisation</Text>
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : (
          <Button mode="contained" onPress={envoyer} style={styles.btn}>Envoyer</Button>
        )}
        <Button onPress={() => navigation.goBack()} style={{ marginTop: 8 }}>Retour à la connexion</Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1976D2', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  title: { fontWeight: 'bold', color: '#1976D2', textAlign: 'center', marginBottom: 8 },
  sub: { color: '#666', textAlign: 'center', marginBottom: 20 },
  input: { marginBottom: 12 },
  btn: { borderRadius: 8 },
});
