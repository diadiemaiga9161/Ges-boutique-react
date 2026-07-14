import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// ─── Types ───────────────────────────────────────────────────────────────────
interface DetteAncienne {
  id: number;
  creancier: string;
  description: string;
  montantTotal: number;
  montantRegle: number;
  montantRestant: number;
  dateEcheance: string;
  statut: 'EN_COURS' | 'SOLDEE' | 'EN_RETARD';
  notes?: string;
}

interface ReglementDette {
  id: number;
  montant: number;
  date: string;
  modePaiement: string;
  reference?: string;
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const MODES_PAIEMENT = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'VIREMENT'] as const;
type ModePaiement = typeof MODES_PAIEMENT[number];
const MODE_LABELS: Record<ModePaiement, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange',
  MOOV_MONEY: 'Moov',
  VIREMENT: 'Virement',
};

const STATUT_CONFIG = {
  EN_COURS:  { color: '#d97706', bg: '#fffbeb', label: 'En cours',  icon: 'clock-outline' as const },
  SOLDEE:    { color: '#16a34a', bg: '#f0fdf4', label: 'Soldée',    icon: 'check-circle-outline' as const },
  EN_RETARD: { color: '#dc2626', bg: '#fef2f2', label: 'En retard', icon: 'alert-circle-outline' as const },
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('fr-FR') + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function DettesAnciennesScreen() {
  const { lang } = useLang();

  const [dettes, setDettes] = useState<DetteAncienne[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');

  // Modals
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [showReglement, setShowReglement] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDette, setSelectedDette] = useState<DetteAncienne | null>(null);
  const [reglements, setReglements] = useState<ReglementDette[]>([]);
  const [loadingReglements, setLoadingReglements] = useState(false);

  // Formulaire nouvelle dette
  const [formCreancier, setFormCreancier] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMontant, setFormMontant] = useState('');
  const [formEcheance, setFormEcheance] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Formulaire règlement
  const [reglMontant, setReglMontant] = useState('');
  const [reglDate, setReglDate] = useState('');
  const [reglMode, setReglMode] = useState<ModePaiement>('ESPECES');
  const [reglRef, setReglRef] = useState('');
  const [savingRegl, setSavingRegl] = useState(false);

  // ─── Stats calculées ─────────────────────────────────────────────────────
  const totalDettes = useMemo(() => dettes.reduce((s, d) => s + d.montantTotal, 0), [dettes]);
  const totalRegle = useMemo(() => dettes.reduce((s, d) => s + d.montantRegle, 0), [dettes]);
  const totalRestant = useMemo(() => dettes.reduce((s, d) => s + d.montantRestant, 0), [dettes]);

  // ─── Filtre recherche ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return dettes;
    return dettes.filter(d =>
      d.creancier.toLowerCase().includes(t) ||
      (d.description || '').toLowerCase().includes(t)
    );
  }, [dettes, search]);

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await api.get('/dettes-anciennes');
      const liste = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setDettes(liste);
      setFromCache(false);
      sauvegarderCache('dettes_anciennes', liste).catch(() => {});
    } catch {
      const cached = await lireCache<DetteAncienne>('dettes_anciennes');
      if (cached.length > 0) { setDettes(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [lang]);

  useEffect(() => { charger(); }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const openDetails = (dette: DetteAncienne) => {
    setSelectedDette(dette);
    setReglements([]);
    setLoadingReglements(true);
    setShowDetails(true);
    api.get(`/dettes-anciennes/${dette.id}/reglements`)
      .then(r => setReglements(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {})
      .finally(() => setLoadingReglements(false));
  };

  const openReglement = (dette: DetteAncienne) => {
    setSelectedDette(dette);
    setReglMontant(String(dette.montantRestant));
    setReglDate(new Date().toISOString().split('T')[0]);
    setReglMode('ESPECES');
    setReglRef('');
    setShowReglement(true);
  };

  const supprimerDette = (dette: DetteAncienne) => {
    Alert.alert('Supprimer', `Supprimer la dette de ${dette.creancier} ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: tr('supprimer', lang), style: 'destructive',
        onPress: async () => {
          try {
            await executerOuMettreEnFile('dette_delete', { id: dette.id }, () => api.delete(`/dettes-anciennes/${dette.id}`));
            charger();
          } catch {
            Alert.alert(tr('erreur', lang), 'Suppression impossible');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormCreancier('');
    setFormDescription('');
    setFormMontant('');
    setFormEcheance('');
    setFormNotes('');
  };

  const sauvegarderDette = async () => {
    if (!formCreancier.trim() || !formMontant.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    const montant = parseFloat(formMontant);
    if (!montant || montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    setSaving(true);
    const payload = { creancier: formCreancier.trim(), description: formDescription.trim(), montantTotal: montant, dateEcheance: formEcheance.trim() || undefined, notes: formNotes.trim() || undefined };
    try {
      await executerOuMettreEnFile('dette_create', payload, () => api.post('/dettes-anciennes', payload));
      setShowNouvelle(false);
      resetForm();
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Enregistrement impossible');
    }
    setSaving(false);
  };

  const sauvegarderReglement = async () => {
    if (!selectedDette) return;
    const montant = parseFloat(reglMontant);
    if (!montant || montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    if (montant > selectedDette.montantRestant) {
      Alert.alert(tr('erreur', lang), `Montant max : ${money(selectedDette.montantRestant)}`);
      return;
    }
    setSavingRegl(true);
    const dataRegl = { montant, date: reglDate, modePaiement: reglMode, reference: reglRef.trim() || undefined };
    try {
      await executerOuMettreEnFile('dette_reglement', { detteId: selectedDette.id, data: dataRegl }, () => api.post(`/dettes-anciennes/${selectedDette.id}/reglements`, dataRegl));
      setShowReglement(false);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Règlement impossible');
    }
    setSavingRegl(false);
  };

  // ─── Helpers render ───────────────────────────────────────────────────────
  const renderModeChips = (current: ModePaiement, onSelect: (m: ModePaiement) => void) => (
    <View style={s.chips}>
      {MODES_PAIEMENT.map(m => (
        <TouchableOpacity
          key={m}
          style={[s.chip, current === m && s.chipActive]}
          onPress={() => onSelect(m)}
        >
          <Text style={[s.chipText, current === m && s.chipTextActive]}>{MODE_LABELS[m]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatutBadge = (statut: DetteAncienne['statut']) => {
    const cfg = STATUT_CONFIG[statut];
    return (
      <View style={[s.statutBadge, { backgroundColor: cfg.bg }]}>
        <MaterialCommunityIcons name={cfg.icon} size={11} color={cfg.color} />
        <Text style={[s.statutBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    );
  };

  // ─── Rendu principal ──────────────────────────────────────────────────────
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#081648" />;

  return (
    <View style={s.container}>
      {fromCache && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={{ color: '#92400e', fontSize: 12 }}>Mode hors ligne — données locales</Text>
        </View>
      )}

      {/* ── Hero stats ─────────────────────────────────────────────────────── */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Total dettes</Text>
          <Text style={s.heroVal}>{money(totalDettes)}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Total réglé</Text>
          <Text style={[s.heroVal, { color: '#86efac' }]}>{money(totalRegle)}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Reste à payer</Text>
          <Text style={[s.heroVal, { color: '#fca5a5' }]}>{money(totalRestant)}</Text>
        </View>
      </View>

      {/* ── Barre de recherche + bouton nouveau ───────────────────────────── */}
      <View style={s.toolbar}>
        <View style={s.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un créancier..."
            placeholderTextColor="#bbb"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setShowNouvelle(true); }}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Liste des dettes ───────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={d => String(d.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="bank-off-outline" size={48} color="#ccc" />
            <Text style={s.emptyStateText}>Aucune dette enregistrée</Text>
          </View>
        }
        renderItem={({ item: d }) => {
          const cfg = STATUT_CONFIG[d.statut];
          const pct = d.montantTotal > 0
            ? Math.min(100, Math.round((d.montantRegle / d.montantTotal) * 100))
            : 0;
          return (
            <View style={[s.card, d.statut === 'EN_RETARD' && s.cardRetard]}>

              {/* En-tête carte */}
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: cfg.color }]}>
                  <Text style={s.avatarText}>{d.creancier[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.creancierText}>{d.creancier}</Text>
                  {!!d.description && (
                    <Text style={s.descText} numberOfLines={1}>{d.description}</Text>
                  )}
                  {!!d.dateEcheance && (
                    <Text style={[s.dateText, d.statut === 'EN_RETARD' && { color: '#dc2626' }]}>
                      Échéance : {dateStr(d.dateEcheance)}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.montantText, { color: cfg.color }]}>{money(d.montantRestant)}</Text>
                  <Text style={s.montantSub}>/ {money(d.montantTotal)}</Text>
                  {renderStatutBadge(d.statut)}
                </View>
              </View>

              {/* Barre de progression */}
              <View style={s.progressWrap}>
                <View style={s.progressBg}>
                  <View
                    style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: cfg.color }]}
                  />
                </View>
                <Text style={s.progressLabel}>{pct}% réglé</Text>
              </View>

              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => openDetails(d)}>
                  <MaterialCommunityIcons name="eye-outline" size={14} color="#081648" />
                  <Text style={s.actionBtnText}>Détails</Text>
                </TouchableOpacity>
                {d.statut !== 'SOLDEE' && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnPrimary]}
                    onPress={() => openReglement(d)}
                  >
                    <MaterialCommunityIcons name="cash-plus" size={14} color="#fff" />
                    <Text style={s.actionBtnTextPrimary}>Règlement</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnDanger]}
                  onPress={() => supprimerDette(d)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={14} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* ── Modal Nouvelle dette ─────────────────────────────────────────────── */}
      <Modal
        visible={showNouvelle}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNouvelle(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Nouvelle dette</Text>
              <TouchableOpacity onPress={() => setShowNouvelle(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Créancier *</Text>
              <TextInput
                style={s.fieldInput}
                value={formCreancier}
                onChangeText={setFormCreancier}
                placeholder="Nom du créancier"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={s.fieldInput}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Description de la dette"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Montant total *</Text>
              <TextInput
                style={s.fieldInput}
                value={formMontant}
                onChangeText={setFormMontant}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Date d'échéance</Text>
              <TextInput
                style={s.fieldInput}
                value={formEcheance}
                onChangeText={setFormEcheance}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Notes</Text>
              <TextInput
                style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
                value={formNotes}
                onChangeText={setFormNotes}
                multiline
                placeholder="Notes optionnelles..."
                placeholderTextColor="#bbb"
              />
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowNouvelle(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, saving && { opacity: 0.5 }]}
                onPress={sauvegarderDette}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <MaterialCommunityIcons name="content-save" size={15} color="#fff" />
                      <Text style={s.btnConfirmText}>Enregistrer</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Règlement ───────────────────────────────────────────────────── */}
      <Modal
        visible={showReglement}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReglement(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Ajouter un règlement</Text>
              <TouchableOpacity onPress={() => setShowReglement(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {selectedDette && (
                <View style={s.infoCard}>
                  <Text style={s.infoCardTitle}>{selectedDette.creancier}</Text>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Reste à payer</Text>
                    <Text style={[s.infoVal, { color: '#dc2626', fontWeight: '700' }]}>
                      {money(selectedDette.montantRestant)}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.fieldLabel}>Montant versé *</Text>
              <TextInput
                style={s.fieldInput}
                value={reglMontant}
                onChangeText={setReglMontant}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Date</Text>
              <TextInput
                style={s.fieldInput}
                value={reglDate}
                onChangeText={setReglDate}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Mode de paiement</Text>
              {renderModeChips(reglMode, setReglMode)}
              {reglMode !== 'ESPECES' && (
                <>
                  <Text style={s.fieldLabel}>Référence</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={reglRef}
                    onChangeText={setReglRef}
                    placeholder="N° transaction..."
                    placeholderTextColor="#bbb"
                  />
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowReglement(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, savingRegl && { opacity: 0.5 }]}
                onPress={sauvegarderReglement}
                disabled={savingRegl}
              >
                {savingRegl
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <MaterialCommunityIcons name="cash-check" size={15} color="#fff" />
                      <Text style={s.btnConfirmText}>Valider</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Détails ─────────────────────────────────────────────────────── */}
      <Modal
        visible={showDetails}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetails(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle} numberOfLines={1}>
                Détails — {selectedDette?.creancier}
              </Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {selectedDette && (
                <>
                  <View style={s.infoCard}>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Créancier</Text>
                      <Text style={s.infoVal}>{selectedDette.creancier}</Text>
                    </View>
                    {!!selectedDette.description && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Description</Text>
                        <Text style={s.infoVal}>{selectedDette.description}</Text>
                      </View>
                    )}
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Montant total</Text>
                      <Text style={s.infoVal}>{money(selectedDette.montantTotal)}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Montant réglé</Text>
                      <Text style={[s.infoVal, { color: '#16a34a' }]}>{money(selectedDette.montantRegle)}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Reste à payer</Text>
                      <Text style={[s.infoVal, { color: '#dc2626' }]}>{money(selectedDette.montantRestant)}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Échéance</Text>
                      <Text style={s.infoVal}>{dateStr(selectedDette.dateEcheance)}</Text>
                    </View>
                    <View style={[s.infoRow, { alignItems: 'center' }]}>
                      <Text style={s.infoLabel}>Statut</Text>
                      {renderStatutBadge(selectedDette.statut)}
                    </View>
                    {!!selectedDette.notes && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Notes</Text>
                        <Text style={s.infoVal}>{selectedDette.notes}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={s.sectionTitle}>Historique des règlements</Text>

                  {loadingReglements ? (
                    <ActivityIndicator size="small" style={{ margin: 12 }} />
                  ) : reglements.length === 0 ? (
                    <Text style={s.emptyText}>Aucun règlement enregistré</Text>
                  ) : (
                    reglements.map((r, i) => (
                      <View key={r.id ?? i} style={s.reglRow}>
                        <View style={s.reglTop}>
                          <Text style={s.reglDate}>{dateStr(r.date)}</Text>
                          <Text style={s.reglMontant}>+{money(r.montant)}</Text>
                          <Text style={s.reglMode}>{r.modePaiement}</Text>
                        </View>
                        {!!r.reference && (
                          <Text style={s.reglRef}>Réf : {r.reference}</Text>
                        )}
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={[s.btnConfirm, { flex: 1 }]} onPress={() => setShowDetails(false)}>
                <Text style={s.btnConfirmText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Hero
  hero: { backgroundColor: '#081648', flexDirection: 'row', padding: 14, alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginBottom: 2, textAlign: 'center' },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Toolbar
  toolbar: {
    flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center',
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5',
    borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#e0e0e0',
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: '#333' },
  addBtn: {
    backgroundColor: '#081648', borderRadius: 12, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },

  // Carte dette
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardRetard: { borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  creancierText: { fontWeight: 'bold', fontSize: 15, color: '#1a1a1a', marginBottom: 2 },
  descText: { color: '#666', fontSize: 12, marginBottom: 3 },
  dateText: { color: '#888', fontSize: 11 },
  montantText: { fontWeight: 'bold', fontSize: 16 },
  montantSub: { color: '#aaa', fontSize: 11, marginTop: 1 },

  // Badge statut
  statutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 5,
  },
  statutBadgeText: { fontSize: 11, fontWeight: '600' },

  // Barre progression
  progressWrap: { marginBottom: 10 },
  progressBg: { height: 5, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { fontSize: 10, color: '#aaa', marginTop: 3, textAlign: 'right' },

  // Actions carte
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingVertical: 7,
  },
  actionBtnText: { color: '#081648', fontSize: 12, fontWeight: '600' },
  actionBtnPrimary: { backgroundColor: '#081648', borderColor: '#081648', flex: 2 },
  actionBtnTextPrimary: { color: '#fff', fontSize: 12, fontWeight: '600' },
  actionBtnDanger: { flex: 0, paddingHorizontal: 12, borderColor: '#fca5a5' },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { color: '#999', fontSize: 15 },
  emptyText: { color: '#aaa', textAlign: 'center', padding: 12, fontSize: 13 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Info card (modal détails)
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoCardTitle: { fontWeight: 'bold', color: '#081648', fontSize: 15, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 8 },

  // Titre de section
  sectionTitle: { fontWeight: 'bold', color: '#081648', marginBottom: 8, marginTop: 4, fontSize: 13 },

  // Ligne règlement
  reglRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  reglTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reglDate: { flex: 1, fontSize: 12, color: '#64748b' },
  reglMontant: { fontWeight: '700', color: '#16a34a', fontSize: 13 },
  reglMode: {
    fontSize: 11, backgroundColor: '#f1f5f9', paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 4, color: '#475569',
  },
  reglRef: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Formulaire
  fieldLabel: { color: '#666', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  chipActive: { backgroundColor: '#081648', borderColor: '#081648' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Boutons footer
  btnCancel: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: {
    flex: 2, backgroundColor: '#081648', borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
  },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
