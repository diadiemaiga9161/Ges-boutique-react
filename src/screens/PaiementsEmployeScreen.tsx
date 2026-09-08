import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

const AVATAR_COLORS = ['#1e88e5', '#43a047', '#e53935', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60'];

function money(v: number) { return (v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA'; }
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
  const colors = useColors();
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
  const [boutique, setBoutique] = useState<any>({});

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
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (raw) { try { setBoutique(JSON.parse(raw)); } catch {} }
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

  /** Envoi du reçu de paiement par WhatsApp directement au numéro enregistré sur la fiche employé. */
  const envoyerRecuWhatsApp = (p: any) => {
    const telPropre = String(employe.telephone || '').replace(/\D/g, '');
    if (!telPropre) {
      Alert.alert('Aucun numéro enregistré', `Ajoutez un numéro de téléphone à la fiche de ${nomComplet} pour activer l'envoi WhatsApp.`);
      return;
    }
    const periodeLabel = p.periodeFin && p.periodeFin !== p.periodeDebut ? `${p.periodeDebut} à ${p.periodeFin}` : p.periodeDebut;
    const lignes = [
      `*${boutique.nom || 'Ges Boutique'}*`,
      `Reçu de paiement de salaire`,
      `Employé : ${nomComplet}`,
      `Date : ${fdate(p.datePaiement)}`,
      ``,
      `Poste : ${employe.poste || '—'}`,
      `Période : ${periodeLabel || '—'}`,
      `Nombre de mois : ${p.nombreMois || 1}`,
      ``,
      `Montant payé : ${money(p.montant)}`,
      ``,
      `Merci de votre confiance.`,
    ];
    if (boutique.telephone) lignes.push(`${boutique.nom} — ${boutique.telephone}`);
    Linking.openURL(`https://wa.me/${telPropre}?text=${encodeURIComponent(lignes.join('\n'))}`);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} size="large" color={colors.primary} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.hero }]}>
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
      <View style={[styles.ficheCard, { backgroundColor: colors.card }]}>
        <View style={styles.ficheTop}>
          <View style={[styles.avatar, { backgroundColor: avatarColor(employe.nom || 'E') }]}>
            <Text style={styles.avatarText}>{initiale}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ficheNom, { color: colors.text }]}>{nomComplet}</Text>
            {employe.poste ? <Text style={[styles.fichePoste, { color: colors.textSecondary }]}>{employe.poste}</Text> : null}
          </View>
        </View>

        <View style={[styles.kpisRow, { borderTopColor: colors.border }]}>
          <View style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Salaire mensuel</Text>
            <Text style={[styles.kpiVal, { color: colors.text }]}>{money(employe.salaireMensuel || 0)}</Text>
          </View>
          <View style={[styles.kpi, styles.kpiMid, { borderLeftColor: colors.border, borderRightColor: colors.border }]}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Verse {ANNEE_COURANTE}</Text>
            <Text style={[styles.kpiVal, { color: colors.success }]}>{money(totalAnnee)}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Mois en cours</Text>
            <View style={[
              styles.moisBadge,
              { backgroundColor: moisPayé ? colors.successBg : colors.warningBg },
            ]}>
              <Text style={[
                styles.moisBadgeText,
                { color: moisPayé ? colors.success : colors.warning },
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
          <Text style={[styles.empty, { color: colors.textSecondary }]}>Aucun paiement enregistre</Text>
        }
        renderItem={({ item: p }) => (
          <View style={[styles.paiCard, { backgroundColor: colors.card }, p.statut === 'ANNULE' && { opacity: 0.55 }]}>
            <View style={styles.paiTop}>
              <Text style={[styles.paiDate, { color: colors.textSecondary }]}>{fdate(p.datePaiement)}</Text>
              <Text style={[styles.paiMontant, { color: colors.success }]}>{money(p.montant)}</Text>
            </View>

            <View style={styles.paiMoisRow}>
              <Text style={[styles.paiMoisLabel, { color: colors.textSecondary }]}>Période : </Text>
              <Text style={[styles.paiMoisVal, { color: colors.text }]}>
                {p.periodeDebut}{p.periodeFin && p.periodeFin !== p.periodeDebut ? ` → ${p.periodeFin}` : ''}
              </Text>
            </View>

            <View style={[styles.modeBadge, { backgroundColor: colors.infoBg }]}>
              <Text style={[styles.modeBadgeText, { color: colors.info }]}>{p.nombreMois} mois</Text>
            </View>

            {p.statut === 'ANNULE' && (
              <Text style={[styles.paiRef, { color: colors.danger }]}>Annulé{p.motifAnnulation ? ` : ${p.motifAnnulation}` : ''}</Text>
            )}
            {p.observation ? <Text style={[styles.paiNote, { color: colors.textSecondary }]}>{p.observation}</Text> : null}

            {p.statut !== 'ANNULE' && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6, gap: 16 }}>
                <TouchableOpacity onPress={() => envoyerRecuWhatsApp(p)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="whatsapp" size={14} color="#25D366" style={{ marginRight: 4 }} />
                  <Text style={{ color: '#25D366', fontSize: 12, fontWeight: '600' }}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => annulerPaiement(p)}>
                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{tr('annuler', lang)}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.hero }]} onPress={ouvrirModal}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Modal nouveau paiement ── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nouveau paiement</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Nombre de mois */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nombre de mois *</Text>
              <View style={styles.modeRow}>
                {[1, 2, 3].map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.modeBtn,
                      { borderColor: colors.border },
                      form.nombreMois === n && { backgroundColor: colors.hero, borderColor: colors.hero },
                    ]}
                    onPress={() => setForm({ ...form, nombreMois: n })}
                  >
                    <Text style={[styles.modeBtnText, { color: colors.textSecondary }, form.nombreMois === n && { color: '#fff' }]}>{n} mois</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Montant calculé */}
              <View style={[styles.montantPreview, { backgroundColor: colors.successBg }]}>
                <Text style={[styles.montantPreviewLabel, { color: colors.success }]}>Montant à verser</Text>
                <Text style={[styles.montantPreviewVal, { color: colors.success }]}>{money((employe.salaireMensuel || 0) * form.nombreMois)}</Text>
              </View>

              {/* Période début */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Période de début (AAAA-MM-JJ) *</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                value={form.periodeDebut}
                onChangeText={t => setForm({ ...form, periodeDebut: t })}
                placeholder="2026-08-01"
                placeholderTextColor={colors.placeholder}
              />

              {/* Période fin (si plusieurs mois) */}
              {form.nombreMois > 1 && (
                <>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Période de fin (AAAA-MM-JJ)</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                    value={form.periodeFin}
                    onChangeText={t => setForm({ ...form, periodeFin: t })}
                    placeholder={form.periodeDebut}
                    placeholderTextColor={colors.placeholder}
                  />
                </>
              )}

              {/* Observation */}
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Observation</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                value={form.observation}
                onChangeText={t => setForm({ ...form, observation: t })}
                placeholder="Commentaire..."
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.hero }]} onPress={enregistrerPaiement}>
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
  container: { flex: 1 },

  // Header
  header: {
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
    margin: 12,
    borderRadius: 18,
    padding: 16,
    elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8,
  },
  ficheTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  ficheNom: { fontWeight: '700', fontSize: 16 },
  fichePoste: { fontSize: 13, marginTop: 2 },

  // KPIs
  kpisRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiMid: {
    borderLeftWidth: 1, borderRightWidth: 1,
  },
  kpiLabel: { fontSize: 10, marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' },
  kpiVal: { fontWeight: '700', fontSize: 12, textAlign: 'center' },
  moisBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  moisBadgeText: { fontSize: 11, fontWeight: '700' },

  // Paiement card
  paiCard: {
    borderRadius: 16,
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
  paiDate: { fontSize: 13, fontWeight: '500' },
  paiMontant: { fontWeight: '800', fontSize: 17 },
  paiMoisRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  paiMoisLabel: { fontSize: 12 },
  paiMoisVal: { fontSize: 12, fontWeight: '600' },
  modeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  modeBadgeText: { fontSize: 11 },
  paiNote: { fontSize: 12, marginTop: 4 },
  paiRef: { fontSize: 11, marginTop: 2 },

  // States
  empty: { textAlign: 'center', marginTop: 40 },

  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', lineHeight: 36 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%' as any,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18 },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  inputMultiline: { minHeight: 70 },

  // Aperçu du montant calculé
  montantPreview: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  montantPreviewLabel: { fontSize: 11, textTransform: 'uppercase' },
  montantPreviewVal: { fontSize: 20, fontWeight: '800', marginTop: 2 },

  // Mode paiement
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  modeBtn: {
    flex: 1, paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeBtnText: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Save
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
