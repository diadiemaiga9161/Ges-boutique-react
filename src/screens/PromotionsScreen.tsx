import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { Text, FAB, ActivityIndicator, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';

interface Promotion {
  id: number;
  titre: string;
  typeReduction: 'POURCENTAGE' | 'MONTANT_FIXE';
  valeurReduction: number;
  active: boolean;
  globale?: boolean;
  dateDebut?: string;
  dateFin?: string;
  produits?: { id: number; nom: string }[];
}

const money = (v: number) => v?.toLocaleString('fr-FR') + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

export default function PromotionsScreen() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState({
    titre: '',
    typeReduction: 'POURCENTAGE' as 'POURCENTAGE' | 'MONTANT_FIXE',
    valeurReduction: '',
    active: true,
    globale: true,
  });
  const [saving, setSaving] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/promotions');
      setPromos(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ titre: '', typeReduction: 'POURCENTAGE', valeurReduction: '', active: true, globale: true });
    setShowModal(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      titre: p.titre,
      typeReduction: p.typeReduction,
      valeurReduction: String(p.valeurReduction),
      active: p.active,
      globale: p.globale ?? true,
    });
    setShowModal(true);
  };

  const sauvegarder = async () => {
    if (!form.titre.trim()) { Alert.alert('Erreur', 'Le titre est obligatoire'); return; }
    const valeur = parseFloat(form.valeurReduction);
    if (!valeur || valeur <= 0) { Alert.alert('Erreur', 'La valeur doit être supérieure à 0'); return; }
    if (form.typeReduction === 'POURCENTAGE' && valeur > 100) { Alert.alert('Erreur', 'Le pourcentage ne peut pas dépasser 100%'); return; }

    setSaving(true);
    try {
      const payload = { ...form, valeurReduction: valeur };
      if (editing) {
        await api.put(`/promotions/${editing.id}`, payload);
      } else {
        await api.post('/promotions', payload);
      }
      setShowModal(false);
      charger();
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible d\'enregistrer');
    }
    setSaving(false);
  };

  const toggleActive = async (p: Promotion) => {
    try {
      await api.put(`/promotions/${p.id}`, { ...p, active: !p.active });
      setPromos(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
    } catch { Alert.alert('Erreur', 'Impossible de modifier'); }
  };

  const supprimer = (p: Promotion) => {
    Alert.alert('Supprimer', `Supprimer "${p.titre}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try { await api.delete(`/promotions/${p.id}`); charger(); }
          catch { Alert.alert('Erreur', 'Impossible de supprimer'); }
        }
      }
    ]);
  };

  const activeCount = promos.filter(p => p.active).length;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#e91e63" />;

  return (
    <View style={s.container}>
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Total promos</Text>
          <Text style={s.heroVal}>{promos.length}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Actives</Text>
          <Text style={[s.heroVal, { color: '#a5f3a5' }]}>{activeCount}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Inactives</Text>
          <Text style={[s.heroVal, { color: '#ffb3b3' }]}>{promos.length - activeCount}</Text>
        </View>
      </View>

      <FlatList
        data={promos}
        keyExtractor={p => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="tag-off-outline" size={48} color="#ccc" />
            <Text style={s.emptyText}>Aucune promotion</Text>
          </View>
        }
        renderItem={({ item: p }) => (
          <View style={[s.card, !p.active && s.cardInactive]}>
            <View style={s.cardHeader}>
              <View style={s.tagIcon}>
                <MaterialCommunityIcons name="tag-outline" size={22} color="#e91e63" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{p.titre}</Text>
                <View style={s.cardBadges}>
                  <View style={[s.badge, p.globale ? s.badgeGlobal : s.badgeProduit]}>
                    <Text style={s.badgeText}>{p.globale ? 'Globale' : 'Par produit'}</Text>
                  </View>
                  <View style={[s.badge, p.active ? s.badgeActive : s.badgeInactive]}>
                    <Text style={s.badgeText}>{p.active ? '● Actif' : '○ Inactif'}</Text>
                  </View>
                </View>
              </View>
              <Switch
                value={p.active}
                onValueChange={() => toggleActive(p)}
                color="#e91e63"
              />
            </View>

            <View style={s.reductionRow}>
              <MaterialCommunityIcons
                name={p.typeReduction === 'POURCENTAGE' ? 'percent' : 'currency-usd-off'}
                size={16} color="#e91e63"
              />
              <Text style={s.reductionText}>
                {p.typeReduction === 'POURCENTAGE'
                  ? `${p.valeurReduction}% de réduction`
                  : `${money(p.valeurReduction)} de réduction`}
              </Text>
            </View>

            {(p.dateDebut || p.dateFin) && (
              <Text style={s.dates}>
                <MaterialCommunityIcons name="calendar-range" size={12} />
                {' '}{dateStr(p.dateDebut)} → {dateStr(p.dateFin)}
              </Text>
            )}

            {p.produits && p.produits.length > 0 && (
              <Text style={s.produitsList}>
                Produits : {p.produits.map(pr => pr.nom).join(', ')}
              </Text>
            )}

            <View style={s.cardActions}>
              <TouchableOpacity style={s.editBtn} onPress={() => openEdit(p)}>
                <MaterialCommunityIcons name="pencil-outline" size={15} color="#e91e63" />
                <Text style={s.editBtnText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteBtn} onPress={() => supprimer(p)}>
                <MaterialCommunityIcons name="trash-can-outline" size={15} color="#f44336" />
                <Text style={s.deleteBtnText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <FAB icon="plus" style={s.fab} color="#fff" onPress={openCreate} />

      {/* Modal créer/modifier */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editing ? 'Modifier la promo' : 'Nouvelle promotion'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.fieldLabel}>Titre *</Text>
              <TextInput
                style={s.input}
                value={form.titre}
                onChangeText={t => setForm({ ...form, titre: t })}
                placeholder="Ex: Promo Ramadan, -20% sur tout..."
              />

              <Text style={s.fieldLabel}>Type de réduction</Text>
              <View style={s.typeRow}>
                {(['POURCENTAGE', 'MONTANT_FIXE'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, form.typeReduction === t && s.typeBtnActive]}
                    onPress={() => setForm({ ...form, typeReduction: t })}
                  >
                    <MaterialCommunityIcons
                      name={t === 'POURCENTAGE' ? 'percent' : 'cash-minus'}
                      size={16} color={form.typeReduction === t ? '#fff' : '#e91e63'}
                    />
                    <Text style={[s.typeBtnText, form.typeReduction === t && { color: '#fff' }]}>
                      {t === 'POURCENTAGE' ? 'Pourcentage' : 'Montant fixe'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>
                Valeur {form.typeReduction === 'POURCENTAGE' ? '(%)' : '(FCFA)'} *
              </Text>
              <TextInput
                style={s.input}
                value={form.valeurReduction}
                onChangeText={t => setForm({ ...form, valeurReduction: t })}
                keyboardType="numeric"
                placeholder={form.typeReduction === 'POURCENTAGE' ? 'Ex: 20' : 'Ex: 5000'}
              />

              <View style={s.switchRow}>
                <View>
                  <Text style={s.fieldLabel}>Promotion globale</Text>
                  <Text style={{ color: '#999', fontSize: 12 }}>S'applique à tous les produits</Text>
                </View>
                <Switch
                  value={form.globale}
                  onValueChange={v => setForm({ ...form, globale: v })}
                  color="#e91e63"
                />
              </View>

              <View style={s.switchRow}>
                <Text style={s.fieldLabel}>Active</Text>
                <Switch
                  value={form.active}
                  onValueChange={v => setForm({ ...form, active: v })}
                  color="#e91e63"
                />
              </View>
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowModal(false)}>
                <Text style={s.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, saving && { opacity: 0.6 }]} onPress={sauvegarder} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnConfirmText}>{editing ? 'Enregistrer' : 'Créer'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  hero: { backgroundColor: '#e91e63', flexDirection: 'row', padding: 16 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginBottom: 2 },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  heroDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },

  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, padding: 14, elevation: 2 },
  cardInactive: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  tagIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fce4ec', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: 'bold', fontSize: 15, color: '#1a1a1a', marginBottom: 4 },
  cardBadges: { flexDirection: 'row', gap: 6 },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeGlobal: { backgroundColor: '#e3f2fd' },
  badgeProduit: { backgroundColor: '#f3e5f5' },
  badgeActive: { backgroundColor: '#e8f5e9' },
  badgeInactive: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#eee' },
  badgeText: { fontSize: 10, color: '#555', fontWeight: '600' },
  reductionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reductionText: { color: '#e91e63', fontWeight: 'bold', fontSize: 14 },
  dates: { color: '#999', fontSize: 12, marginBottom: 4 },
  produitsList: { color: '#666', fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 10 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#e91e63', borderRadius: 8, paddingVertical: 7 },
  editBtnText: { color: '#e91e63', fontSize: 13, fontWeight: '600' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#f44336', borderRadius: 8, paddingVertical: 7 },
  deleteBtnText: { color: '#f44336', fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#aaa', fontSize: 15 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#e91e63' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a' },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  fieldLabel: { color: '#555', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#e91e63', borderRadius: 10, paddingVertical: 10 },
  typeBtnActive: { backgroundColor: '#e91e63' },
  typeBtnText: { color: '#e91e63', fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },

  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: { flex: 2, backgroundColor: '#e91e63', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
