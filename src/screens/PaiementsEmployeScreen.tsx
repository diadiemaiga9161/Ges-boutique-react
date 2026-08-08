import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

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

const ANNEE_COURANTE = new Date().getFullYear();
const MOIS_COURANT_ISO = new Date().toISOString().split('T')[0];

const FORM_INITIAL = {
  nombreMois: 1,
  periodeDebut: MOIS_COURANT_ISO,
  periodeFin: '',
  observation: '',
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
  const [userId, setUserId] = useState<number>(0);

  const cacheKey = `paiements_employe_${employe.id}`;
  const charger = async () => {
    try {
      const res = await api.get(`/paiements-employe/employe/${employe.id}`);
      const data = res.data?.data || res.data || [];
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
    AsyncStorage.getItem('user').then(raw => {
      if (raw) { try { setUserId(JSON.parse(raw)?.id || 0); } catch {} }
    });
    if (employe.id) {
      charger();
    } else {
      setLoading(false);
    }
  }, []);

  const paiementsActifs = paiements.filter(p => p.statut !== 'ANNULE');

  // Total versé sur l'année en cours (paiements actifs uniquement)
  const totalAnnee = paiementsActifs
    .filter(p => String(p.datePaiement || '').startsWith(String(ANNEE_COURANTE)))
    .reduce((s, p) => s + (p.montant || 0), 0);

  // Le mois en cours a-t-il été versé ?
  const moisPayé = paiementsActifs.some(p => String(p.periodeDebut || '').startsWith(MOIS_COURANT_ISO.slice(0, 7)));

  const ouvrirModal = () => {
    setForm({ ...FORM_INITIAL });
    setShowModal(true);
  };

  const enregistrerPaiement = async () => {
    if (!form.periodeDebut) {
      Alert.alert(tr('erreur', lang), 'La période de début est obligatoire');
      return;
    }
    if (!form.nombreMois || form.nombreMois < 1 || form.nombreMois > 3) {
      Alert.alert(tr('erreur', lang), 'Le nombre de mois doit être entre 1 et 3');
      return;
    }
    const data = {
      employeId: employe.id,
      nombreMois: form.nombreMois,
      periodeDebut: form.periodeDebut,
      periodeFin: form.nombreMois > 1 ? (form.periodeFin || form.periodeDebut) : undefined,
      observation: form.observation || undefined,
      utilisateurId: userId || undefined,
    };
    try {
      await executerOuMettreEnFile('paiement_employe', data, () => api.post('/paiements-employe', data));
      setShowModal(false);
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Erreur serveur');
    }
  };

  const annulerPaiement = (p: any) => {
    Alert.alert('Annuler ce paiement ?', `${money(p.montant)} — ${p.periodeDebut}`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: 'Oui, annuler', style: 'destructive', onPress: async () => {
        try {
          await api.patch(`/paiements-employe/${p.id}/annuler`, null, { params: { motif: 'Annulation mobile', utilisateurId: userId || undefined } });
          charger();
        } catch (err: any) {
          Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Erreur serveur');
        }
      } },
    ]);
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
          <View style={[styles.paiCard, p.statut === 'ANNULE' && { opacity: 0.55 }]}>
            <View style={styles.paiTop}>
              <Text style={styles.paiDate}>{fdate(p.datePaiement)}</Text>
              <Text style={styles.paiMontant}>{money(p.montant)}</Text>
            </View>

            <View style={styles.paiMoisRow}>
              <Text style={styles.paiMoisLabel}>Période : </Text>
              <Text style={styles.paiMoisVal}>
                {p.periodeDebut}{p.periodeFin && p.periodeFin !== p.periodeDebut ? ` → ${p.periodeFin}` : ''}
              </Text>
            </View>

            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{p.nombreMois} mois</Text>
            </View>

            {p.statut === 'ANNULE' && (
              <Text style={[styles.paiRef, { color: '#dc2626' }]}>Annulé{p.motifAnnulation ? ` : ${p.motifAnnulation}` : ''}</Text>
            )}
            {p.observation ? <Text style={styles.paiNote}>{p.observation}</Text> : null}

            {p.statut !== 'ANNULE' && (
              <TouchableOpacity onPress={() => annulerPaiement(p)} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
                <Text style={{ color: '#dc2626', fontSize: 12, fontWeight: '600' }}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
            )}
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
              {/* Nombre de mois */}
              <Text style={styles.fieldLabel}>Nombre de mois *</Text>
              <View style={styles.modeRow}>
                {[1, 2, 3].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.modeBtn, form.nombreMois === n && styles.modeBtnActive]}
                    onPress={() => setForm({ ...form, nombreMois: n })}
                  >
                    <Text style={[styles.modeBtnText, form.nombreMois === n && { color: '#fff' }]}>{n} mois</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Montant calculé */}
              <View style={styles.montantPreview}>
                <Text style={styles.montantPreviewLabel}>Montant à verser</Text>
                <Text style={styles.montantPreviewVal}>{money((employe.salaireMensuel || 0) * form.nombreMois)}</Text>
              </View>

              {/* Période début */}
              <Text style={styles.fieldLabel}>Période de début (AAAA-MM-JJ) *</Text>
              <TextInput
                style={styles.input}
                value={form.periodeDebut}
                onChangeText={t => setForm({ ...form, periodeDebut: t })}
                placeholder="2026-08-01"
                placeholderTextColor="#94a3b8"
              />

              {/* Période fin (si plusieurs mois) */}
              {form.nombreMois > 1 && (
                <>
                  <Text style={styles.fieldLabel}>Période de fin (AAAA-MM-JJ)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.periodeFin}
                    onChangeText={t => setForm({ ...form, periodeFin: t })}
                    placeholder={form.periodeDebut}
                    placeholderTextColor="#94a3b8"
                  />
                </>
              )}

              {/* Observation */}
              <Text style={styles.fieldLabel}>Observation</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={form.observation}
                onChangeText={t => setForm({ ...form, observation: t })}
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

  // Aperçu du montant calculé
  montantPreview: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  montantPreviewLabel: { color: '#166534', fontSize: 11, textTransform: 'uppercase' },
  montantPreviewVal: { color: '#16a34a', fontSize: 20, fontWeight: '800', marginTop: 2 },

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
