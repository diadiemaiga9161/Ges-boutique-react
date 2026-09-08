import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { verifierTokenReset, resetPassword } from '../services/api.service';
import { useColors } from '../theme/colors';

export default function ResetPasswordScreen({ navigation, route }: any) {
  const colors = useColors();
  const [token] = useState(route?.params?.token || '');
  // null = vérification en cours, false = lien invalide/expiré, true = formulaire affiché
  // (même logique que reset-password.page.ts côté Ionic : le token est vérifié
  // AVANT de laisser l'utilisateur saisir un nouveau mot de passe)
  const [tokenValide, setTokenValide] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) { setTokenValide(false); return; }
    let annule = false;
    verifierTokenReset(token)
      .then(res => { if (!annule) setTokenValide(res.data?.valide === true); })
      .catch(() => { if (!annule) setTokenValide(false); });
    return () => { annule = true; };
  }, [token]);

  const reinitialiser = async () => {
    if (!password || password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token, password);
      Alert.alert('Succès', 'Mot de passe modifié avec succès', [
        { text: 'OK', onPress: () => navigation.navigate('Login') }
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Une erreur est survenue');
    }
    setLoading(false);
  };

  // ── Vérification du token en cours ──
  if (tokenValide === null) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.hero }]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Vérification du lien...</Text>
      </View>
    );
  }

  // ── Lien invalide ou expiré ──
  if (tokenValide === false) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.hero, padding: 20 }]}>
        <View style={[styles.card, { backgroundColor: colors.card, alignItems: 'center' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#dc262618' }]}>
            <MaterialCommunityIcons name="close-circle-outline" size={30} color="#dc2626" />
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>Lien invalide ou expiré</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Ce lien n'est plus valide. Veuillez refaire une demande.</Text>
          <Button mode="contained" onPress={() => navigation.navigate('ForgotPassword')} style={styles.btn}>
            Nouvelle demande
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.hero }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
            <MaterialCommunityIcons name="shield-key-outline" size={30} color={colors.primary} />
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text }]}>Nouveau mot de passe</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>Choisissez un nouveau mot de passe pour votre compte</Text>
          <TextInput
            label="Nouveau mot de passe"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPwd}
            right={<TextInput.Icon icon={showPwd ? 'eye-off' : 'eye'} onPress={() => setShowPwd(!showPwd)} />}
            style={styles.input}
          />
          <TextInput
            label="Confirmer"
            value={confirm}
            onChangeText={setConfirm}
            mode="outlined"
            secureTextEntry={!showConfirm}
            right={<TextInput.Icon icon={showConfirm ? 'eye-off' : 'eye'} onPress={() => setShowConfirm(!showConfirm)} />}
            style={styles.input}
          />
          {loading ? <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} /> : (
            <Button mode="contained" onPress={reinitialiser} style={styles.btn}>Réinitialiser</Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
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
  btn: { borderRadius: 12, marginTop: 4 },
});
