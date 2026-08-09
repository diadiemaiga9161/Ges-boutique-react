import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBoutique, updateBoutique } from '../services/api.service';
import { executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function BoutiqueSettingsScreen() {
  const { lang } = useLang();
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conditionnement, setConditionnement] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('boutique_info');
      if (stored) { setForm(JSON.parse(stored)); setFromCache(true); }
      const cond = await AsyncStorage.getItem('feat_conditionnement');
      setConditionnement(cond === 'true');
      try {
        const res = await getBoutique();
        const data = res.data?.boutique || res.data?.data || res.data;
        if (data) { setForm(data); setFromCache(false); await AsyncStorage.setItem('boutique_info', JSON.stringify(data)); }
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const sauvegarder = async () => {
    setSaving(true);
    // Ecrit toujours localement d'abord, puis empile pour synchro si hors ligne
    // (skill offline-first) — sinon un admin qui modifie les infos boutique
    // sans réseau perdait purement et simplement sa saisie.
    await AsyncStorage.setItem('boutique_info', JSON.stringify(form));
    const { offline } = await executerOuMettreEnFile('boutique_update', form, () => updateBoutique(form));
    setFromCache(offline);
    Alert.alert(
      offline ? tr('hors_ligne', lang) : tr('succes', lang),
      offline ? 'Enregistré localement — sera synchronisé au retour du réseau.' : 'Paramètres enregistrés'
    );
    setSaving(false);
  };

  const toggleConditionnement = async (v: boolean) => {
    setConditionnement(v);
    await AsyncStorage.setItem('feat_conditionnement', String(v));
  };

  // Comme reset() sur Ionic : purement local, aucun appel réseau — remet le
  // formulaire aux valeurs par défaut de l'app (pas un reset serveur).
  const DEFAULT_BOUTIQUE = { nom: 'Ma Boutique', devise: 'FCFA' };
  const reinitialiser = () => {
    Alert.alert('Réinitialiser les paramètres ?', 'Le formulaire reviendra aux valeurs par défaut (non enregistré tant que vous n\'appuyez pas sur Enregistrer).', [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: () => setForm(DEFAULT_BOUTIQUE) },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#fff" />
          <Text style={styles.offlineBannerText}>Hors ligne — dernières informations connues</Text>
        </View>
      )}
      <Text variant="titleMedium" style={styles.section}>{tr('infos_boutique', lang)}</Text>
      <TextInput label={tr('nom_boutique', lang) + ' *'} value={form.nom || ''} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('telephone', lang)} value={form.telephone || ''} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label={tr('telephone', lang) + ' 2 (rapport)'} value={form.telephone2 || ''} onChangeText={t => setForm({ ...form, telephone2: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label={tr('telephone', lang) + ' 3 (rapport)'} value={form.telephone3 || ''} onChangeText={t => setForm({ ...form, telephone3: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label={tr('email', lang)} value={form.email || ''} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('adresse', lang)} value={form.adresse || ''} onChangeText={t => setForm({ ...form, adresse: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('ville', lang)} value={form.ville || ''} onChangeText={t => setForm({ ...form, ville: t })} mode="outlined" style={styles.input} />
      <TextInput label="Pays" value={form.pays || ''} onChangeText={t => setForm({ ...form, pays: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('devise', lang)} value={form.devise || 'FCFA'} onChangeText={t => setForm({ ...form, devise: t })} mode="outlined" style={styles.input} />

      <Text variant="titleMedium" style={styles.section}>Informations légales</Text>
      <TextInput label="Numéro RC (Registre du commerce)" value={form.numeroRc || ''} onChangeText={t => setForm({ ...form, numeroRc: t })} mode="outlined" style={styles.input} />
      <TextInput label="Numéro IFU (Identifiant fiscal)" value={form.numeroIfu || ''} onChangeText={t => setForm({ ...form, numeroIfu: t })} mode="outlined" style={styles.input} />
      <TextInput label="Description" value={form.description || ''} onChangeText={t => setForm({ ...form, description: t })} mode="outlined" multiline numberOfLines={3} style={styles.input} />

      <Text variant="titleMedium" style={styles.section}>Fonctionnalités</Text>
      <View style={styles.switchRow}>
        <Text>Gestion par conditionnement</Text>
        <Switch value={conditionnement} onValueChange={toggleConditionnement} />
      </View>

      <Button mode="contained" onPress={sauvegarder} loading={saving} style={styles.btn}>
        {tr('enregistrer', lang)}
      </Button>
      <Button mode="outlined" onPress={reinitialiser} style={[styles.btn, { borderColor: '#94a3b8' }]} textColor="#64748b">
        Réinitialiser
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  offlineBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  section: { fontWeight: 'bold', color: '#1a56db', marginTop: 16, marginBottom: 8 },
  input: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  btn: { marginTop: 8, borderRadius: 8 },
});
