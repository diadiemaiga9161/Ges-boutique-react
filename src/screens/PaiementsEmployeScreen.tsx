import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const MODES_PAIEMENT = ['ESPECES', 'VIREMENT', 'MOBILE MONEY'];
const AVATAR_COLORS = ['#1e88e5', '#43a047', '#e53935', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60'];

function money(v: number) { return (v || 0).toLocaleString('fr-FR') + ' FCFA'; }
function fdate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}
function avatarColor(name: string) {
  const code = (name || 'E').charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

/** Retourne les 12 derniers mois sous forme YYYY-MM, du plus récent au plus ancien. */
function getMoisOptions(): string[] {
  const mois: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return mois;
}

const MOIS_OPTIONS = getMoisOptions();
const MOIS_COURANT = MOIS_OPTIONS[0];
const ANNEE_COURANTE = new Date().getFullYear();

const FORM_INITIAL = {
  montant: '',
  moisConcerne: MOIS_COURANT,
  modePaiement: 'ESPECES',
  note: '',
  referencePaiement: '',
};

export default function PaiementsEmployeScreen({ navigation, route }: any) {
  const { lang } = useLang();
  const employe = route?.params?.employe || {};

  const nomComplet = `${employe.prenom || ''} ${employe.nom || ''}`.trim() || 'Employe';
  const initiale = (employe.prenom || employe.nom || 'E')[0].toUpperCase();

  const [paiements, setPaiements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...FORM_INITIAL });
  const [showMoisPicker, setShowMoisPicker] = useState(false);

  const cacheKey = `paiements_employe_${employe.id}`;
  const charger = async () => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await api.get(`/employes/${employe.id}/paiements`);
      const data = res.data?.paiements || res.data?.data || res.data || [];
      const liste = Array.isArray(data) ? data : [];
      setPaiements(liste);
      setFromCache(false);
      sauvegarderCache(cacheKey, liste).catch(() => {});
    } catch {
      const cached = await lireCache<any>(cacheKey);
      if (cached.length > 0) { setPaiements(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (employe.id) {
      charger();
    } else {
      setLoading(false);
    }
  }, []);

  // Total versé sur l'année en cours
  const totalAnnee = paiements
    .filter(p => {
      const ref = p.datePaiement || p.moisConcerne || '';
      return ref.startsWith(String(ANNEE_COURANTE));
    })
    .reduce((s, p) => s + (p.montant || 0), 0);

  // Le mois en cours a-t-il été versé ?
  const moisPayé = paiements.some(p => (p.moisConcerne || '') === MOIS_COURANT);

  const ouvrirModal = () => {
    setForm({ ...FORM_INITIAL });
    setShowMoisPicker(false);
    setShowModal(true);
  };

  const enregistrerPaiement = async () => {
    const montantNum = parseFloat(form.montant);
    if (!form.montant || isNaN(montantNum) || montantNum <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    const data = { montant: montantNum, moisConcerne: form.moisConcerne, modePaiement: form.modePaiement, note: form.note, referencePaiement: form.referencePaiement };
    try {
      await executerOuMettreEnFile('paiement_employe', { employeId: employe.id, data }, () => api.post(`/employes/${employe.id}/paiements`, data));
      setShowModal(false);
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Erreur serveur');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#081648" />;

  return (
    <View style={styles.container}>
      {fromCache && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={{ color: '#92400e', fontSize: 12 }}>Mode hors ligne — données locales</Text>
        </View>
      )}
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Paiements</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{nomComplet}</Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={ouvrirModal}>
          <Text style={styles.headerAddText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Fiche employé ── */}
      <View style={styles.ficheCard}>
        <View style={styles.ficheTop}>
          <View style={[styles.avatar, { backgroundColor: avatarColor(employe.nom || 'E') }]}>
            <Text style={styles.avatarText}>{initiale}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ficheNom}>{nomComplet}</Text>
            {employe.poste ? <Text style={styles.fichePoste}>{employe.poste}</Text> : null}
          </View>
        </View>

        <View style={styles.kpisRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Salaire mensuel</Text>
            <Text style={styles.kpiVal}>{money(employe.salaireMensuel || 0)}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiMid]}>
            <Text style={styles.kpiLabel}>Verse {ANNEE_COURANTE}</Text>
            <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{money(totalAnnee)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Mois en cours</Text>
            <View style={[
              styles.moisBadge,
              { backgroundColor: moisPayé ? '#dcfce7' : '#fef9c3' },
            ]}>
              <Text style={[
                styles.moisBadgeText,
                { color: moisPayé ? '#16a34a' : '#b45309' },
              ]}>
                {moisPayé ? 'Paye' : 'En attente'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Liste des paiements ── */}
      <FlatList
        data={paiements}
        keyExtractor={p => String(p.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun paiement enregistre</Text>
        }
        renderItem={({ item: p }) => (
          <View style={styles.paiCard}>
            <View style={styles.paiTop}>
              <Text style={styles.paiDate}>{fdate(p.datePaiement)}</Text>
              <Text style={styles.paiMontant}>{money(p.montant)}</Text>
            </View>

            {p.moisConcerne ? (
              <View style={styles.paiMoisRow}>
                <Text style={styles.paiMoisLabel}>Mois : </Text>
                <Text style={styles.paiMoisVal}>{p.moisConcerne}</Text>
              </View>
            ) : null}

            {p.modePaiement ? (
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{p.modePaiement}</Text>
              </View>
            ) : null}

            {p.note ? <Text style={styles.paiNote}>{p.note}</Text> : null}
            {p.referencePaiement ? (
              <Text style={styles.paiRef}>Ref : {p.referencePaiement}</Text>
            ) : null}
          </View>
        )}
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={ouvrirModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Modal nouveau paiement ── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouveau paiement</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Montant */}
              <Text style={styles.fieldLabel}>{tr('montant', lang)} *</Text>
              <TextInput
                style={styles.input}
                value={form.montant}
                onChangeText={t => setForm({ ...form, montant: t })}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              {/* Mois concerné */}
              <Text style={styles.fieldLabel}>Mois concerne</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowMoisPicker(v => !v)}
              >
                <Text style={styles.pickerVal}>{form.moisConcerne}</Text>
                <Text style={styles.pickerArrow}>{showMoisPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showMoisPicker && (
                <View style={styles.pickerList}>
                  {MOIS_OPTIONS.map(m => (
                    <TouchableOpacity
                      key={m}
                      style={styles.pickerItem}
                      onPress={() => { setForm({ ...form, moisConcerne: m }); setShowMoisPicker(false); }}
                    >
                      <Text style={[
                        styles.pickerItemText,
                        form.moisConcerne === m && { color: '#081648', fontWeight: 'bold' },
                      ]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Mode de paiement */}
              <Text style={styles.fieldLabel}>{tr('mode_paiement', lang)}</Text>
              <View style={styles.modeRow}>
                {MODES_PAIEMENT.map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeBtn, form.modePaiement === m && styles.modeBtnActive]}
                    onPress={() => setForm({ ...form, modePaiement: m })}
                  >
                    <Text style={[
                      styles.modeBtnText,
                      form.modePaiement === m && { color: '#fff' },
                    ]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Référence */}
              <Text style={styles.fieldLabel}>Reference / No. transaction</Text>
              <TextInput
                style={styles.input}
                value={form.referencePaiement}
                onChangeText={t => setForm({ ...form, referencePaiement: t })}
                placeholder="ex: TXN-001..."
                placeholderTextColor="#94a3b8"
              />

              {/* Note */}
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.note}
                onChangeText={t => setForm({ ...form, note: t })}
                placeholder="Commentaire..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={enregistrerPaiement}>
                <Text style={styles.saveBtnText}>{tr('enregistrer', lang)}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Header
  header: {
    backgroundColor: '#081648',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 20,
    paddingBottom: 14,
  },
  backBtn: { padding: 8, marginRight: 4 },
  backArrow: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },
  headerAddBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAddText: { color: '#fff', fontSize: 26, fontWeight: 'bold', lineHeight: 32 },

  // Fiche employé
  ficheCard: {
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 14,
    padding: 16,
    elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6,
  },
  ficheTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  ficheNom: { fontWeight: '700', fontSize: 16, color: '#1e293b' },
  fichePoste: { color: '#64748b', fontSize: 13, marginTop: 2 },

  // KPIs
  kpisRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
    borderLeftColor: '#f1f5f9', borderRightColor: '#f1f5f9',
  },
  kpiLabel: { color: '#94a3b8', fontSize: 10, marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' },
  kpiVal: { fontWeight: '700', fontSize: 12, color: '#1e293b', textAlign: 'center' },
  moisBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  moisBadgeText: { fontSize: 11, fontWeight: '700' },

  // Paiement card
  paiCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  paiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paiDate: { color: '#475569', fontSize: 13, fontWeight: '500' },
  paiMontant: { fontWeight: '800', fontSize: 17, color: '#16a34a' },
  paiMoisRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  paiMoisLabel: { color: '#94a3b8', fontSize: 12 },
  paiMoisVal: { color: '#475569', fontSize: 12, fontWeight: '600' },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  modeBadgeText: { color: '#1e40af', fontSize: 11 },
  paiNote: { color: '#64748b', fontSize: 12, marginTop: 4 },
  paiRef: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  // States
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },

  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#081648',
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', lineHeight: 36 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%' as any,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18, color: '#94a3b8' },

  // Form
  fieldLabel: { color: '#475569', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#fafafa',
  },
  inputMultiline: { minHeight: 70 },

  // Mois picker
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    backgroundColor: '#fafafa',
  },
  pickerVal: { color: '#1e293b', fontSize: 14, fontWeight: '500' },
  pickerArrow: { color: '#94a3b8', fontSize: 12 },
  pickerList: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: 200,
  },
  pickerItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerItemText: { color: '#334155', fontSize: 13 },

  // Mode paiement
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modeBtn: {
    flex: 1, paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: '#081648', borderColor: '#081648' },
  modeBtnText: { color: '#374151', fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Save
  saveBtn: {
    backgroundColor: '#081648',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
