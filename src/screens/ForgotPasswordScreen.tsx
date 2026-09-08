import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { forgotPassword } from '../services/api.service';
import { useColors } from '../theme/colors';

export default function ForgotPasswordScreen({ navigation }: any) {
  const colors = useColors();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const envoyer = async () => {
    if (!email) { Alert.alert('Erreur', 'Entrez votre email'); return; }
    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      Alert.alert('Succès', res.data?.message || 'Un lien de réinitialisation a été envoyé à votre email', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Une erreur est survenue');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.hero }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
            <MaterialCommunityIcons name="lock-question" size={30} color={colors.primary} />
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>Mot de passe oublié</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Entrez votre email pour recevoir un lien de réinitialisation</Text>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          {loading ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> : (
            <Button mode="contained" onPress={envoyer} style={styles.btn}>Envoyer</Button>
          )}
          <Button onPress={() => navigation.goBack()} style={{ marginTop: 8 }}>Retour à la connexion</Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    borderRadius: 22, padding: 24,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 14,
  },
  title: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  sub: { textAlign: 'center', marginBottom: 20 },
  input: { marginBottom: 12 },
  btn: { borderRadius: 12 },
});
