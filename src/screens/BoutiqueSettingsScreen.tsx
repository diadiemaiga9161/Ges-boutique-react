import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Switch } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBoutique, updateBoutique } from '../services/api.service';

export default function BoutiqueSettingsScreen() {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conditionnement, setConditionnement] = useState(false);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('boutique_info');
      if (stored) setForm(JSON.parse(stored));
      const cond = await AsyncStorage.getItem('feat_conditionnement');
      setConditionnement(cond === 'true');
      try {
        const res = await getBoutique();
        const data = res.data?.boutique || res.data?.data || res.data;
        if (data) { setForm(data); await AsyncStorage.setItem('boutique_info', JSON.stringify(data)); }
      } catch { }
      setLoading(false);
    };
    load();
  }, []);

  const sauvegarder = async () => {
    setSaving(true);
    try {
      await updateBoutique(form);
      await AsyncStorage.setItem('boutique_info', JSON.stringify(form));
      Alert.alert('Succès', 'Paramètres enregistrés');
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder'); }
    setSaving(false);
  };

  const toggleConditionnement = async (v: boolean) => {
    setConditionnement(v);
    await AsyncStorage.setItem('feat_conditionnement', String(v));
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleMedium" style={styles.section}>Informations boutique</Text>
      <TextInput label="Nom de la boutique *" value={form.nom || ''} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
      <TextInput label="Téléphone" value={form.telephone || ''} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label="Téléphone 2 (rapport)" value={form.telephone2 || ''} onChangeText={t => setForm({ ...form, telephone2: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label="Téléphone 3 (rapport)" value={form.telephone3 || ''} onChangeText={t => setForm({ ...form, telephone3: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label="Email" value={form.email || ''} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} />
      <TextInput label="Adresse" value={form.adresse || ''} onChangeText={t => setForm({ ...form, adresse: t })} mode="outlined" style={styles.input} />
      <TextInput label="Ville" value={form.ville || ''} onChangeText={t => setForm({ ...form, ville: t })} mode="outlined" style={styles.input} />
      <TextInput label="Devise" value={form.devise || 'FCFA'} onChangeText={t => setForm({ ...form, devise: t })} mode="outlined" style={styles.input} />

      <Text variant="titleMedium" style={styles.section}>Fonctionnalités</Text>
      <View style={styles.switchRow}>
        <Text>Gestion par conditionnement</Text>
        <Switch value={conditionnement} onValueChange={toggleConditionnement} />
      </View>

      <Button mode="contained" onPress={sauvegarder} loading={saving} style={styles.btn}>
        Enregistrer
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  section: { fontWeight: 'bold', color: '#1976D2', marginTop: 16, marginBottom: 8 },
  input: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12 },
  btn: { marginTop: 8, borderRadius: 8 },
});
