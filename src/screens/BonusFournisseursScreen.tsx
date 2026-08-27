import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, FAB, ActivityIndicator, Modal, Portal, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api, { getFournisseurs } from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useMontantInput } from '../components/MontantInput';

type TypeBonus = 'RISTOURNE' | 'BONUS_VOLUME' | 'PRIME_OBJECTIF' | 'BONUS_ACHAT';
const TYPES: { value: TypeBonus; label: string; color: string }[] = [
  { value: 'RISTOURNE', label: 'Ristourne', color: '#16a34a' },
  { value: 'BONUS_VOLUME', label: 'Bonus Volume', color: '#1a56db' },
  { value: 'PRIME_OBJECTIF', label: 'Prime Objectif', color: '#d97706' },
  { value: 'BONUS_ACHAT', label: 'Bonus Achat', color: '#7c3aed' },
];
const typeInfo = (t: string) => TYPES.find(x => x.value === t) || TYPES[0];
const money = (v: number) => `${(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`;
const todayStr = () => new Date().toISOString().split('T')[0];

export default function BonusFournisseursScreen() {
  const { lang } = useLang();
  const [bonus, setBonus] = useState<any[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFournisseurPicker, setShowFournisseurPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const emptyForm = { fournisseurId: 0, fournisseurNom: '', type: 'RISTOURNE' as TypeBonus, montant: 0, date: todayStr(), description: '' };
  const [form, setForm] = useState(emptyForm);
  const montantInput = useMontantInput(form.montant, v => setForm(f => ({ ...f, montant: v })));

  const charger = async () => {
    try {
      const res = await api.get('/bonus-fournisseurs');
      const liste = res.data?.data || res.data || [];
      setBonus(liste);
      setFromCache(false);
      sauvegarderCache('bonus_fournisseurs', liste).catch(() => {});
    } catch {
      const cached = await lireCache<any>('bonus_fournisseurs');
      if (cached.length > 0) { setBonus(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const chargerFournisseurs = async () => {
    try {
      const res = await getFournisseurs();
      setFournisseurs(res.data?.data || res.data || []);
    } catch { }
  };

  useEffect(() => { charger(); chargerFournisseurs(); }, []);

  const total = bonus.reduce((s: number, b: any) => s + (b.montant || 0), 0);

  const ouvrirCreation = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const ouvrirModif = (b: any) => {
    setEditingId(b.id);
    setForm({
      fournisseurId: b.fournisseurId,
      fournisseurNom: b.fournisseurNom || '',
      type: b.type || 'RISTOURNE',
      montant: b.montant || 0,
      date: b.date || todayStr(),
      description: b.description || '',
    });
    setShowModal(true);
  };

  const enregistrer = async () => {
    if (!form.fournisseurId || !form.type || !form.date) {
      Alert.alert(tr('erreur', lang), 'Fournisseur, type et date sont obligatoires'); return;
    }
    if (!form.montant || form.montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide'); return;
    }
    setSaving(true);
    const payload = {
      fournisseurId: form.fournisseurId,
      type: form.type,
      montant: form.montant,
      date: form.date,
      description: form.description || undefined,
    };
    try {
      if (editingId) {
        await api.put(`/bonus-fournisseurs/${editingId}`, payload);
      } else {
        await executerOuMettreEnFile('bonus_fournisseur', payload, () => api.post('/bonus-fournisseurs', payload));
      }
      setShowModal(false);
      await charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer');
    }
    setSaving(false);
  };

  const supprimer = (b: any) => {
    Alert.alert(
      'Supprimer ce bonus ?',
      `${typeInfo(b.type).label} — ${money(b.montant)}`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang), style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/bonus-fournisseurs/${b.id}`);
              await charger();
            } catch { Alert.alert(tr('erreur', lang), 'Suppression impossible'); }
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>{tr('total', lang)} {tr('bonus_fournisseurs', lang)}</Text>
        <Text style={styles.bannerVal}>{money(total)}</Text>
      </View>
      <FlatList
        data={bonus}
        keyExtractor={b => String(b.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const t = typeInfo(item.type);
          return (
            <Card style={styles.card} onPress={() => ouvrirModif(item)}>
              <Card.Content>
                <View style={styles.row}>
                  <Text variant="titleMedium" numberOfLines={1} style={{ flex: 1 }}>{item.fournisseurNom || `${tr('fournisseur', lang)} #${item.fournisseurId}`}</Text>
                  <Text style={styles.montant}>{money(item.montant)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <View style={[styles.typeBadge, { backgroundColor: t.color + '22' }]}>
                    <Text style={[styles.typeBadgeText, { color: t.color }]}>{t.label}</Text>
                  </View>
                  <Text style={styles.date}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : ''}</Text>
                </View>
                {item.description && <Text style={styles.sub}>{item.description}</Text>}
                <TouchableOpacity style={styles.btnDelete} onPress={() => supprimer(item)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={14} color="#dc2626" />
                  <Text style={styles.btnDeleteText}>{tr('supprimer', lang)}</Text>
                </TouchableOpacity>
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun bonus enregistré</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={ouvrirCreation} />
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>{editingId ? tr('modifier', lang) : tr('nouveau_bonus', lang)}</Text>

          <Text style={styles.fieldLabel}>Fournisseur *</Text>
          <TouchableOpacity style={styles.picker} onPress={() => setShowFournisseurPicker(v => !v)}>
            <Text style={{ color: form.fournisseurNom ? '#0f172a' : '#94a3b8' }}>
              {form.fournisseurNom || 'Sélectionner un fournisseur'}
            </Text>
            <Text>{showFournisseurPicker ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showFournisseurPicker && (
            <View style={styles.pickerList}>
              {fournisseurs.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.pickerItem}
                  onPress={() => { setForm({ ...form, fournisseurId: f.id, fournisseurNom: f.nom }); setShowFournisseurPicker(false); }}
                >
                  <Text>{f.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>Type *</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {TYPES.map(t => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeChip, { borderColor: t.color }, form.type === t.value && { backgroundColor: t.color }]}
                onPress={() => setForm({ ...form, type: t.value })}
              >
                <Text style={{ color: form.type === t.value ? '#fff' : t.color, fontSize: 12, fontWeight: '600' }}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput label={tr('montant', lang) + ' *'} value={montantInput.texte} onChangeText={montantInput.onChangeText} mode="outlined" keyboardType="numeric" style={styles.input} />
          <TextInput label="Date *" value={form.date} onChangeText={t => setForm({ ...form, date: t })} mode="outlined" placeholder="AAAA-MM-JJ" style={styles.input} />
          <TextInput label={tr('description', lang)} value={form.description} onChangeText={t => setForm({ ...form, description: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={enregistrer} loading={saving} disabled={saving}>{tr('enregistrer', lang)}</Button>
        </Modal>
      </Portal>
    </View>
  );
}

// STYLE (2026-08-16) : accent violet (#7b1fa2) remplacé par le bleu app
// (#1a56db) — comme CreditsScreen, cet écran sortait seul de l'identité
// bleu/blanc du reste de Ges Boutique/Ionic.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  banner: { backgroundColor: '#1a56db', padding: 16, alignItems: 'center' },
  bannerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  bannerVal: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  card: { marginBottom: 10, borderRadius: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#1a56db', fontSize: 16 },
  sub: { color: '#666', fontSize: 12, marginTop: 4 },
  date: { color: '#aaa', fontSize: 11 },
  typeBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  btnDelete: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 8 },
  btnDeleteText: { color: '#dc2626', fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20, maxHeight: '85%' },
  input: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 6 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#94a3b8', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 12 },
  pickerList: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 160 },
  pickerItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
});
