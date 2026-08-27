import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button, Avatar, Card, Switch } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { updateProfil, changerMotDePasse } from '../services/api.service';
import { useColors } from '../theme/colors';
import { useThemeMode, ThemeMode } from '../theme/ThemeContext';
import { isConfirmationVocaleActivee, setConfirmationVocaleActivee } from '../services/vocalConfirmation.service';
import TutorielVendeurModal from '../components/TutorielVendeurModal';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'auto', label: 'Auto', icon: '🌗' },
  { value: 'light', label: 'Clair', icon: '☀️' },
  { value: 'dark', label: 'Sombre', icon: '🌙' },
];

export default function ProfilScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const { mode, setMode } = useThemeMode();
  const [user, setUser] = useState<any>({});
  const [form, setForm] = useState({ nomComplet: '', email: '', telephone: '', ancienMotDePasse: '', nouveauMotDePasse: '' });
  const [confirmationVocale, setConfirmationVocale] = useState(true);
  const [showTutorielVendeur, setShowTutorielVendeur] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        setForm(f => ({ ...f, nomComplet: u.nomComplet || '', email: u.email || '', telephone: u.telephone || '' }));
      }
    });
    isConfirmationVocaleActivee().then(setConfirmationVocale);
  }, []);

  const toggleConfirmationVocale = async (v: boolean) => {
    setConfirmationVocale(v);
    await setConfirmationVocaleActivee(v);
  };

  const initiales = (user.nomComplet || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const sauvegarder = async () => {
    try {
      const res = await updateProfil({ nomComplet: form.nomComplet, email: form.email, telephone: form.telephone });
      const updated = res.data?.data || res.data;
      const newUser = { ...user, nomComplet: updated.nomComplet || form.nomComplet, email: form.email, telephone: form.telephone };
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      setUser(newUser);
      Alert.alert('Succès', 'Profil mis à jour');
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de mettre à jour le profil');
    }
  };

  const changerMdp = async () => {
    if (!form.ancienMotDePasse || !form.nouveauMotDePasse) {
      Alert.alert('Erreur', 'Remplissez les deux champs');
      return;
    }
    try {
      await changerMotDePasse({ ancienMotDePasse: form.ancienMotDePasse, nouveauMotDePasse: form.nouveauMotDePasse });
      setForm(f => ({ ...f, ancienMotDePasse: '', nouveauMotDePasse: '' }));
      Alert.alert('Succès', 'Mot de passe changé');
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de changer le mot de passe');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.header, { backgroundColor: colors.hero }]}>
        <Avatar.Text size={72} label={initiales} style={{ backgroundColor: '#fff' }} color="#1a56db" />
        <Text variant="headlineSmall" style={styles.name}>{user.nomComplet}</Text>
        <Text style={styles.role}>{user.role === 'ADMIN' ? 'Administrateur' : 'Vendeur'}</Text>
      </View>

      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.primary }]}>Apparence</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 10 }}>
            Choisissez l'affichage clair, sombre, ou suivez automatiquement les réglages du téléphone.
          </Text>
          <View style={styles.themeRow}>
            {THEME_OPTIONS.map(opt => {
              const active = mode === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setMode(opt.value)}
                  style={[
                    styles.themeOption,
                    { borderColor: colors.border, backgroundColor: colors.inputBg },
                    active && { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
                  ]}
                >
                  <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                  <Text style={[
                    styles.themeOptionText,
                    { color: active ? colors.primary : colors.textSecondary },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.primary }]}>Ventes</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Confirmation vocale du montant</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                Le téléphone annonce à voix haute le total dès qu'une vente est validée.
              </Text>
            </View>
            <Switch value={confirmationVocale} onValueChange={toggleConfirmationVocale} color={colors.primary} />
          </View>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.primary }]}>Informations personnelles</Text>
          <TextInput label={tr('nom_complet', lang)} value={form.nomComplet} onChangeText={t => setForm({ ...form, nomComplet: t })} mode="outlined" style={styles.input} />
          <TextInput label={tr('email', lang)} value={form.email} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" />
          <TextInput label={tr('telephone', lang)} value={form.telephone} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />
          <Button mode="contained" style={styles.btn} onPress={sauvegarder}>
            {tr('enregistrer', lang)}
          </Button>
        </Card.Content>
      </Card>

      <Card style={[styles.card, { backgroundColor: colors.card }]}>
        <Card.Content>
          <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.primary }]}>Changer le mot de passe</Text>
          <TextInput label="Ancien mot de passe" value={form.ancienMotDePasse} onChangeText={t => setForm({ ...form, ancienMotDePasse: t })} mode="outlined" secureTextEntry style={styles.input} />
          <TextInput label="Nouveau mot de passe" value={form.nouveauMotDePasse} onChangeText={t => setForm({ ...form, nouveauMotDePasse: t })} mode="outlined" secureTextEntry style={styles.input} />
          <Button mode="outlined" style={styles.btn} onPress={changerMdp}>
            Changer le mot de passe
          </Button>
        </Card.Content>
      </Card>

      {/* Revoir le tutoriel — uniquement pour les VENDEUR (le tutoriel d'accueil
          ne concerne jamais les ADMIN) : réaffiche le même overlay que celui vu
          au premier login, sans jamais réinitialiser d'autres réglages. */}
      {user.role === 'VENDEUR' && (
        <Card style={[styles.card, { backgroundColor: colors.card }]}>
          <Card.Content>
            <Button
              mode="outlined"
              icon="school-outline"
              style={styles.btn}
              onPress={() => setShowTutorielVendeur(true)}
            >
              {tr('tuto_vendeur_revoir', lang)}
            </Button>
          </Card.Content>
        </Card>
      )}

      <TutorielVendeurModal
        visible={showTutorielVendeur}
        onClose={() => setShowTutorielVendeur(false)}
        userId={user.id}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#081648', padding: 32, alignItems: 'center', borderRadius: 16, marginBottom: 16 },
  name: { color: '#fff', fontWeight: 'bold', marginTop: 12 },
  role: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  card: { borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontWeight: 'bold', color: '#1a56db', marginBottom: 12 },
  input: { marginBottom: 12 },
  btn: { borderRadius: 8 },
  themeRow: { flexDirection: 'row', gap: 10 },
  themeOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, gap: 4 },
  themeOptionText: { fontSize: 12, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
