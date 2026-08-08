import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { Text, FAB, ActivityIndicator, Switch, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api, { createPromotion, updatePromotion } from '../services/api.service';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

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
  const { lang } = useLang();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
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

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const res = await api.get('/promotions');
      const data = res.data?.data || res.data || [];
      setPromos(data);
      setFromCache(false);
      sauvegarderCache('promotions', data).catch(() => {});
    } catch {
      const cached = await lireCache<Promotion>('promotions');
      if (cached.length > 0) { setPromos(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
    if (event?.target?.complete) event.target.complete();
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
    if (!form.titre.trim()) { Alert.alert(tr('erreur', lang), tr('remplir_champs', lang)); return; }
    const valeur = parseFloat(form.valeurReduction);
    if (!valeur || valeur <= 0) { Alert.alert(tr('erreur', lang), tr('valeur', lang)); return; }
    if (form.typeReduction === 'POURCENTAGE' && valeur > 100) { Alert.alert(tr('erreur', lang), tr('remise', lang)); return; }

    setSaving(true);
    try {
      const payload = { ...form, valeurReduction: valeur };
      let offline = false;
      if (editing) {
        const editingId = editing.id;
        const res = await executerOuMettreEnFile(
          'promotion_update',
          { id: editingId, data: payload },
          () => updatePromotion(editingId, payload)
        );
        offline = res.offline;
        if (offline) {
          setPromos(prev => prev.map(x => x.id === editingId ? { ...x, ...payload } : x));
        }
      } else {
        const res = await executerOuMettreEnFile(
          'promotion_create',
          payload,
          () => createPromotion(payload)
        );
        offline = res.offline;
      }
      setShowModal(false);
      if (offline) {
        Alert.alert('Sauvegardé', editing
          ? 'Modification sauvegardée hors ligne — sync au retour connexion'
          : 'Promotion sauvegardée hors ligne — sync au retour connexion');
      } else {
        charger();
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
    setSaving(false);
  };

  const toggleActive = async (p: Promotion) => {
    try {
      const newData = { ...p, active: !p.active };
      const res = await executerOuMettreEnFile(
        'promotion_update',
        { id: p.id, data: newData },
        () => updatePromotion(p.id, newData)
      );
      setPromos(prev => prev.map(x => x.id === p.id ? { ...x, active: !x.active } : x));
      if (res.offline) {
        Alert.alert('Sauvegardé', 'Changement sauvegardé hors ligne — sync au retour connexion');
      }
    } catch { Alert.alert(tr('erreur', lang), tr('erreur', lang)); }
  };

  const supprimer = (p: Promotion) => {
    Alert.alert(tr('supprimer', lang), `${tr('supprimer', lang)} "${p.titre}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
          try { await api.delete(`/promotions/${p.id}`); charger(); }
          catch { Alert.alert(tr('erreur', lang), tr('erreur', lang)); }
        }
      }
    ]);
  };

  const activeCount = promos.filter(p => p.active).length;
  const pctPromos = promos.filter(p => p.typeReduction === 'POURCENTAGE');
  const discountMoyen = pctPromos.length > 0
    ? Math.round(pctPromos.reduce((s, p) => s + p.valeurReduction, 0) / pctPromos.length)
    : 0;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={s.container}>
      {/* Hero banner */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{promos.length}</Text>
          <Text style={s.heroLbl}>{tr('total_promos', lang)}</Text>
        </View>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{activeCount}</Text>
          <Text style={s.heroLbl}>{tr('active', lang)}</Text>
        </View>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{discountMoyen > 0 ? `${discountMoyen}%` : promos.length - activeCount}</Text>
          <Text style={s.heroLbl}>{discountMoyen > 0 ? 'Remise moy.' : tr('inactive', lang)}</Text>
        </View>
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={s.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={s.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <FlatList
        data={promos}
        keyExtractor={p => String(p.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90, paddingTop: 8 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="tag-off-outline" size={64} color="#cbd5e1" />
            <Text style={s.emptyTitle}>{tr('aucune_promo', lang)}</Text>
            <Text style={s.emptySub}>Commencez par créer une promotion</Text>
          </View>
        }
        renderItem={({ item: p }) => (
          <Card style={[s.card, !p.active && s.cardInactive]}>
            <Card.Content>
              {/* En-tête */}
              <View style={s.cardHeader}>
                <View style={[s.avatar, { backgroundColor: '#1a56db22' }]}>
                  <MaterialCommunityIcons name="tag" size={22} color="#1a56db" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={1}>{p.titre}</Text>
                  <View style={s.cardBadges}>
                    <View style={[s.badge, p.globale ? s.badgeGlobal : s.badgeProduit]}>
                      <Text style={s.badgeText}>{p.globale ? tr('globale', lang) : tr('par_produit', lang)}</Text>
                    </View>
                    <View style={[s.badge, p.active ? s.badgeActive : s.badgeInactive]}>
                      <Text style={[s.badgeText, { color: p.active ? '#16a34a' : '#94a3b8' }]}>
                        {p.active ? '● ' + tr('active', lang) : '○ ' + tr('inactive', lang)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Switch value={p.active} onValueChange={() => toggleActive(p)} color="#1a56db" />
              </View>

              {/* Réduction */}
              <View style={s.reductionRow}>
                <MaterialCommunityIcons
                  name={p.typeReduction === 'POURCENTAGE' ? 'percent' : 'currency-usd-off'}
                  size={16} color="#1a56db"
                />
                <Text style={s.reductionText}>
                  {p.typeReduction === 'POURCENTAGE'
                    ? `${p.valeurReduction}% ${tr('remise', lang).toLowerCase()}`
                    : `${money(p.valeurReduction)} ${tr('remise', lang).toLowerCase()}`}
                </Text>
              </View>

              {/* Dates */}
              {(p.dateDebut || p.dateFin) && (
                <Text style={s.dates}>
                  <MaterialCommunityIcons name="calendar-range" size={12} />
                  {' '}{dateStr(p.dateDebut)} → {dateStr(p.dateFin)}
                </Text>
              )}

              {/* Produits liés */}
              {p.produits && p.produits.length > 0 && (
                <Text style={s.produitsList}>
                  Produits : {p.produits.map(pr => pr.nom).join(', ')}
                </Text>
              )}

              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.editBtn} onPress={() => openEdit(p)}>
                  <MaterialCommunityIcons name="pencil-outline" size={15} color="#1a56db" />
                  <Text style={s.editBtnText}>{tr('modifier', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.deleteBtn} onPress={() => supprimer(p)}>
                  <MaterialCommunityIcons name="trash-can-outline" size={15} color="#ef4444" />
                  <Text style={s.deleteBtnText}>{tr('supprimer', lang)}</Text>
                </TouchableOpacity>
              </View>
            </Card.Content>
          </Card>
        )}
      />

      <FAB icon="plus" style={s.fab} color="#fff" onPress={openCreate} />

      {/* Modal créer/modifier */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>{editing ? tr('modifier_promo', lang) : tr('nouvelle_promo', lang)}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.fieldLabel}>{tr('titre_promo', lang)}</Text>
              <TextInput
                style={s.input}
                value={form.titre}
                onChangeText={t => setForm({ ...form, titre: t })}
                placeholder="Ex: Promo Ramadan, -20%..."
              />

              <Text style={s.fieldLabel}>{tr('type_reduction', lang)}</Text>
              <View style={s.typeRow}>
                {(['POURCENTAGE', 'MONTANT_FIXE'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.typeBtn, form.typeReduction === t && s.typeBtnActive]}
                    onPress={() => setForm({ ...form, typeReduction: t })}
                  >
                    <MaterialCommunityIcons
                      name={t === 'POURCENTAGE' ? 'percent' : 'cash-minus'}
                      size={16} color={form.typeReduction === t ? '#fff' : '#1a56db'}
                    />
                    <Text style={[s.typeBtnText, form.typeReduction === t && { color: '#fff' }]}>
                      {t === 'POURCENTAGE' ? tr('pourcentage', lang) : tr('montant_fixe', lang)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>
                {tr('valeur', lang)} {form.typeReduction === 'POURCENTAGE' ? '(%)' : '(FCFA)'} *
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
                  <Text style={s.fieldLabel}>{tr('promo_globale', lang)}</Text>
                  <Text style={{ color: '#999', fontSize: 12 }}>{tr('applique_tous', lang)}</Text>
                </View>
                <Switch
                  value={form.globale}
                  onValueChange={v => setForm({ ...form, globale: v })}
                  color="#1a56db"
                />
              </View>

              <View style={s.switchRow}>
                <Text style={s.fieldLabel}>{tr('active', lang)}</Text>
                <Switch
                  value={form.active}
                  onValueChange={v => setForm({ ...form, active: v })}
                  color="#1a56db"
                />
              </View>
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowModal(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, saving && { opacity: 0.6 }]} onPress={sauvegarder} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.btnConfirmText}>{editing ? tr('enregistrer', lang) : tr('creer', lang)}</Text>
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

  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardInactive: { opacity: 0.55 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b', marginBottom: 4 },
  cardBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeGlobal: { backgroundColor: '#e3f2fd' },
  badgeProduit: { backgroundColor: '#f3e5f5' },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeInactive: { backgroundColor: '#f1f5f9' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#555' },

  reductionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  reductionText: { color: '#1a56db', fontWeight: 'bold', fontSize: 14 },
  dates: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  produitsList: { color: '#64748b', fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#1a56db', borderRadius: 8, paddingVertical: 7 },
  editBtnText: { color: '#1a56db', fontSize: 13, fontWeight: '600' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, paddingVertical: 7 },
  deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  fab: { position: 'absolute', bottom: 20, right: 16, backgroundColor: '#1a56db' },

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
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#1a56db', borderRadius: 10, paddingVertical: 10 },
  typeBtnActive: { backgroundColor: '#1a56db' },
  typeBtnText: { color: '#1a56db', fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },

  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: { flex: 2, backgroundColor: '#1a56db', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
