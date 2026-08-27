import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getClients } from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { imprimerDocumentPdfRN, DesignFacture } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { MontantInput } from '../components/MontantInput';

// ─── Types ───────────────────────────────────────────────────────────────────
// Modèle réel backend (DetteAncienneController/Dto) : une "dette ancienne" est
// une dette d'un CLIENT existant envers la boutique (pas un créancier libre —
// contrairement à une version précédente de cet écran qui inventait un modèle
// "creancier" texte libre incompatible avec l'API réelle). Voir
// dette-ancienne.service.ts (Ionic) pour la référence exacte.
interface DetteAncienne {
  id: number;
  clientId: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  montantInitial: number;
  montantRestant: number;
  montantPaye: number;
  dateCredit: string;
  description?: string;
  estReglee: boolean;
  dateCreation?: string;
  dateDernierReglement?: string;
}

interface ReglementDette {
  id: number;
  detteId: number;
  montantPaye: number;
  montantRestantApres: number;
  dateReglement: string;
  modePaiement: string;
  referencePaiement?: string;
  observations?: string;
}

interface ClientLite { id: number; nom: string; prenom?: string; telephone?: string }

// ─── Constantes ──────────────────────────────────────────────────────────────
const MODES_PAIEMENT = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'VIREMENT'] as const;
type ModePaiement = typeof MODES_PAIEMENT[number];
const MODE_LABELS: Record<ModePaiement, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange',
  MOOV_MONEY: 'Moov',
  VIREMENT: 'Virement',
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const nomClient = (d: DetteAncienne) => `${d.clientPrenom || ''} ${d.clientNom || ''}`.trim() || `Client #${d.clientId}`;

// Réponse enveloppée {success, dettes/reglements, ...} — pas {data:[...]}.
function extractList(payload: any, key: string): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function DettesAnciennesScreen() {
  const { lang } = useLang();

  const [dettes, setDettes] = useState<DetteAncienne[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState<number>(0);
  const [filtreActif, setFiltreActif] = useState<'nonReglees' | 'reglees' | 'toutes'>('nonReglees');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showFiltres, setShowFiltres] = useState(false);

  // Modals
  const [showNouvelle, setShowNouvelle] = useState(false);
  const [showReglement, setShowReglement] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedDette, setSelectedDette] = useState<DetteAncienne | null>(null);
  const [reglements, setReglements] = useState<ReglementDette[]>([]);
  const [loadingReglements, setLoadingReglements] = useState(false);

  // Formulaire nouvelle dette — sélection d'un client existant (comme
  // resources.page.ts detteForm.clientId, PAS un texte libre)
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientLite | null>(null);
  const [formDescription, setFormDescription] = useState('');
  const [formMontant, setFormMontant] = useState(0);
  const [formDateCredit, setFormDateCredit] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // Formulaire règlement
  const [reglMontant, setReglMontant] = useState(0);
  const [reglMode, setReglMode] = useState<ModePaiement>('ESPECES');
  const [reglRef, setReglRef] = useState('');
  const [savingRegl, setSavingRegl] = useState(false);

  // ─── Stats calculées ─────────────────────────────────────────────────────
  const totalDettes = useMemo(() => dettes.reduce((s, d) => s + (d.montantInitial || 0), 0), [dettes]);
  const totalRegle = useMemo(() => dettes.reduce((s, d) => s + (d.montantPaye || 0), 0), [dettes]);
  const totalRestant = useMemo(() => dettes.reduce((s, d) => s + (d.montantRestant || 0), 0), [dettes]);

  // ─── Filtre recherche + statut + période ──────────────────────────────────
  const filtered = useMemo(() => {
    let resultats = dettes;
    const t = search.trim().toLowerCase();
    if (t) {
      resultats = resultats.filter(d =>
        nomClient(d).toLowerCase().includes(t) ||
        (d.description || '').toLowerCase().includes(t)
      );
    }
    if (filtreActif === 'nonReglees') resultats = resultats.filter(d => !d.estReglee);
    else if (filtreActif === 'reglees') resultats = resultats.filter(d => d.estReglee);
    if (dateDebut) resultats = resultats.filter(d => d.dateCredit && d.dateCredit >= dateDebut);
    if (dateFin) resultats = resultats.filter(d => d.dateCredit && d.dateCredit <= dateFin);
    return resultats;
  }, [dettes, search, filtreActif, dateDebut, dateFin]);

  const clientsFiltres = useMemo(() => {
    const t = clientSearch.trim().toLowerCase();
    if (!t) return [];
    return clients.filter(c =>
      `${c.prenom || ''} ${c.nom}`.toLowerCase().includes(t) || (c.telephone || '').includes(t)
    ).slice(0, 20);
  }, [clients, clientSearch]);

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const res = await api.get('/dettes-anciennes');
      const liste = extractList(res.data, 'dettes');
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

  useEffect(() => {
    charger();
    AsyncStorage.getItem('user').then(raw => {
      if (raw) { try { setUserId(JSON.parse(raw)?.id || 0); } catch {} }
    });
    getClients().then(res => {
      const raw = res.data?.clients || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setClients(raw.map((c: any) => ({ id: c.id, nom: c.nom, prenom: c.prenom, telephone: c.numeroTelephone || c.telephone })));
    }).catch(() => {});
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const openDetails = (dette: DetteAncienne) => {
    setSelectedDette(dette);
    setReglements([]);
    setLoadingReglements(true);
    setShowDetails(true);
    api.get(`/dettes-anciennes/${dette.id}/reglements`)
      .then(r => setReglements(extractList(r.data, 'reglements')))
      .catch(() => {})
      .finally(() => setLoadingReglements(false));
  };

  const openReglement = (dette: DetteAncienne) => {
    setSelectedDette(dette);
    setReglMontant(dette.montantRestant);
    setReglMode('ESPECES');
    setReglRef('');
    setShowReglement(true);
  };

  const supprimerDette = (dette: DetteAncienne) => {
    Alert.alert('Supprimer', `Supprimer la dette de ${nomClient(dette)} ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: tr('supprimer', lang), style: 'destructive',
        onPress: async () => {
          try {
            await executerOuMettreEnFile('dette_delete', { id: dette.id }, () => api.delete(`/dettes-anciennes/${dette.id}`));
            charger();
          } catch {
            Alert.alert(tr('erreur', lang), 'Suppression impossible (réservée à l\'admin, ou des règlements existent déjà)');
          }
        },
      },
    ]);
  };

  const imprimerListe = async () => {
    if (!filtered.length) {
      Alert.alert('Aucune dette', 'Aucune dette à imprimer avec ce filtre.');
      return;
    }
    const filtreLabels: Record<typeof filtreActif, string> = {
      nonReglees: 'Non réglées', reglees: 'Réglées', toutes: 'Toutes',
    };
    const periodeLabel = (dateDebut || dateFin)
      ? `Du ${dateDebut ? dateStr(dateDebut) : '…'} au ${dateFin ? dateStr(dateFin) : '…'}`
      : 'Toute la période';
    const totalInitial = filtered.reduce((s, d) => s + (d.montantInitial || 0), 0);
    const totalRestantFiltre = filtered.reduce((s, d) => s + (d.montantRestant || 0), 0);

    try {
      const tpl = await AsyncStorage.getItem('facture_template');
      const design: DesignFacture = tpl === 'moderne' ? 2 : tpl === 'minimaliste' ? 3 : 1;
      await imprimerDocumentPdfRN({
        titre: 'Dettes anciennes',
        sousTitre: `${filtreLabels[filtreActif]} — ${periodeLabel} — ${filtered.length} dette(s)`,
        colonnes: ['Client', 'Date', 'Montant initial', 'Reste dû', 'Statut', 'Description'],
        lignes: filtered.map(d => [
          nomClient(d),
          dateStr(d.dateCredit),
          money(d.montantInitial),
          money(d.montantRestant),
          d.estReglee ? 'Réglée' : 'Non réglée',
          d.description || '—',
        ]),
        totaux: [
          `Total initial : ${money(totalInitial)}`,
          `Total restant : ${money(totalRestantFiltre)}`,
        ],
        pied: `${filtreLabels[filtreActif]} — ${periodeLabel}`,
        paysage: true,
      }, design);
    } catch {
      Alert.alert(tr('erreur', lang), 'Impression impossible');
    }
  };

  const resetForm = () => {
    setSelectedClient(null);
    setClientSearch('');
    setFormDescription('');
    setFormMontant(0);
    setFormDateCredit(new Date().toISOString().split('T')[0]);
  };

  const sauvegarderDette = async () => {
    if (!selectedClient) {
      Alert.alert(tr('erreur', lang), 'Sélectionnez un client');
      return;
    }
    const montant = formMontant;
    if (!montant || montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    setSaving(true);
    // DetteAncienneRequest : {clientId, montant, dateCredit, description}
    const payload = {
      clientId: selectedClient.id,
      montant,
      dateCredit: formDateCredit.trim(),
      description: formDescription.trim() || undefined,
    };
    try {
      await executerOuMettreEnFile('dette_create', payload, () => api.post('/dettes-anciennes', payload));
      setShowNouvelle(false);
      resetForm();
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.error || 'Enregistrement impossible');
    }
    setSaving(false);
  };

  const sauvegarderReglement = async () => {
    if (!selectedDette) return;
    const montant = reglMontant;
    if (!montant || montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    if (montant > selectedDette.montantRestant) {
      Alert.alert(tr('erreur', lang), `Montant max : ${money(selectedDette.montantRestant)}`);
      return;
    }
    setSavingRegl(true);
    // ReglementDetteRequest : {detteId, montantPaye, utilisateurId, modePaiement,
    // referencePaiement, observations} — posté sur /dettes-anciennes/reglement
    // (PAS /dettes-anciennes/{id}/reglements, cette route n'existe pas).
    const dataRegl = {
      detteId: selectedDette.id,
      montantPaye: montant,
      utilisateurId: userId || undefined,
      modePaiement: reglMode,
      referencePaiement: reglRef.trim() || undefined,
    };
    try {
      await executerOuMettreEnFile('dette_reglement', dataRegl, () => api.post('/dettes-anciennes/reglement', dataRegl));
      setShowReglement(false);
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.error || 'Règlement impossible');
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

  const renderStatutBadge = (d: DetteAncienne) => {
    const cfg = d.estReglee
      ? { color: '#16a34a', bg: '#f0fdf4', label: 'Soldée', icon: 'check-circle-outline' as const }
      : { color: '#d97706', bg: '#fffbeb', label: 'En cours', icon: 'clock-outline' as const };
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
            placeholder="Rechercher un client..."
            placeholderTextColor="#bbb"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.iconBtn, showFiltres && s.iconBtnActive]}
          onPress={() => setShowFiltres(v => !v)}
        >
          <MaterialCommunityIcons name="filter-variant" size={20} color={showFiltres ? '#fff' : '#081648'} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={imprimerListe}>
          <MaterialCommunityIcons name="printer-outline" size={20} color="#081648" />
        </TouchableOpacity>
        <TouchableOpacity style={s.addBtn} onPress={() => { resetForm(); setShowNouvelle(true); }}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Panneau filtres (statut + période) ─────────────────────────────── */}
      {showFiltres && (
        <View style={s.filtresPanel}>
          <View style={s.chips}>
            <TouchableOpacity
              style={[s.chip, filtreActif === 'nonReglees' && s.chipActive]}
              onPress={() => setFiltreActif('nonReglees')}
            >
              <Text style={[s.chipText, filtreActif === 'nonReglees' && s.chipTextActive]}>Non réglées</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.chip, filtreActif === 'reglees' && s.chipActive]}
              onPress={() => setFiltreActif('reglees')}
            >
              <Text style={[s.chipText, filtreActif === 'reglees' && s.chipTextActive]}>Réglées</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.chip, filtreActif === 'toutes' && s.chipActive]}
              onPress={() => setFiltreActif('toutes')}
            >
              <Text style={[s.chipText, filtreActif === 'toutes' && s.chipTextActive]}>Toutes</Text>
            </TouchableOpacity>
          </View>
          <View style={s.periodeRow}>
            <TextInput
              style={[s.fieldInput, s.periodeInput]}
              value={dateDebut}
              onChangeText={setDateDebut}
              placeholder="Début AAAA-MM-JJ"
              placeholderTextColor="#bbb"
            />
            <Text style={{ color: '#999' }}>→</Text>
            <TextInput
              style={[s.fieldInput, s.periodeInput]}
              value={dateFin}
              onChangeText={setDateFin}
              placeholder="Fin AAAA-MM-JJ"
              placeholderTextColor="#bbb"
            />
            {(dateDebut || dateFin) && (
              <TouchableOpacity onPress={() => { setDateDebut(''); setDateFin(''); }}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#bbb" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

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
          const cfg = d.estReglee ? '#16a34a' : '#d97706';
          const pct = d.montantInitial > 0
            ? Math.min(100, Math.round((d.montantPaye / d.montantInitial) * 100))
            : 0;
          return (
            <View style={s.card}>

              {/* En-tête carte */}
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: cfg }]}>
                  <Text style={s.avatarText}>{nomClient(d)[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.creancierText}>{nomClient(d)}</Text>
                  {!!d.description && (
                    <Text style={s.descText} numberOfLines={1}>{d.description}</Text>
                  )}
                  <Text style={s.dateText}>Crédit du : {dateStr(d.dateCredit)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.montantText, { color: cfg }]}>{money(d.montantRestant)}</Text>
                  <Text style={s.montantSub}>/ {money(d.montantInitial)}</Text>
                  {renderStatutBadge(d)}
                </View>
              </View>

              {/* Barre de progression */}
              <View style={s.progressWrap}>
                <View style={s.progressBg}>
                  <View
                    style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: cfg }]}
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
                {!d.estReglee && (
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
              <Text style={s.fieldLabel}>Client *</Text>
              {selectedClient ? (
                <View style={s.selectedClientBox}>
                  <Text style={s.selectedClientText}>
                    {`${selectedClient.prenom || ''} ${selectedClient.nom}`.trim()}
                    {selectedClient.telephone ? ` · ${selectedClient.telephone}` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => { setSelectedClient(null); setClientSearch(''); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#999" />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={s.fieldInput}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    placeholder="Rechercher un client..."
                    placeholderTextColor="#bbb"
                  />
                  {clientsFiltres.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={s.clientOption}
                      onPress={() => { setSelectedClient(c); setClientSearch(''); }}
                    >
                      <Text style={s.clientOptionText}>{`${c.prenom || ''} ${c.nom}`.trim()}</Text>
                      {!!c.telephone && <Text style={s.clientOptionSub}>{c.telephone}</Text>}
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <Text style={s.fieldLabel}>Montant *</Text>
              <MontantInput
                style={s.fieldInput}
                value={formMontant}
                onChangeValue={setFormMontant}
                placeholder="0"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Date du crédit</Text>
              <TextInput
                style={s.fieldInput}
                value={formDateCredit}
                onChangeText={setFormDateCredit}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.fieldInput, { height: 80, textAlignVertical: 'top' }]}
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
                placeholder="Description de la dette"
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
                  <Text style={s.infoCardTitle}>{nomClient(selectedDette)}</Text>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>Reste à payer</Text>
                    <Text style={[s.infoVal, { color: '#dc2626', fontWeight: '700' }]}>
                      {money(selectedDette.montantRestant)}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.fieldLabel}>Montant versé *</Text>
              <MontantInput
                style={s.fieldInput}
                value={reglMontant}
                onChangeValue={setReglMontant}
                placeholder="0"
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
                Détails — {selectedDette ? nomClient(selectedDette) : ''}
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
                      <Text style={s.infoLabel}>Client</Text>
                      <Text style={s.infoVal}>{nomClient(selectedDette)}</Text>
                    </View>
                    {!!selectedDette.clientTelephone && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Téléphone</Text>
                        <Text style={s.infoVal}>{selectedDette.clientTelephone}</Text>
                      </View>
                    )}
                    {!!selectedDette.description && (
                      <View style={s.infoRow}>
                        <Text style={s.infoLabel}>Description</Text>
                        <Text style={s.infoVal}>{selectedDette.description}</Text>
                      </View>
                    )}
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Montant total</Text>
                      <Text style={s.infoVal}>{money(selectedDette.montantInitial)}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Montant réglé</Text>
                      <Text style={[s.infoVal, { color: '#16a34a' }]}>{money(selectedDette.montantPaye)}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Reste à payer</Text>
                      <Text style={[s.infoVal, { color: '#dc2626' }]}>{money(selectedDette.montantRestant)}</Text>
                    </View>
                    <View style={s.infoRow}>
                      <Text style={s.infoLabel}>Date du crédit</Text>
                      <Text style={s.infoVal}>{dateStr(selectedDette.dateCredit)}</Text>
                    </View>
                    <View style={[s.infoRow, { alignItems: 'center' }]}>
                      <Text style={s.infoLabel}>Statut</Text>
                      {renderStatutBadge(selectedDette)}
                    </View>
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
                          <Text style={s.reglDate}>{dateStr(r.dateReglement)}</Text>
                          <Text style={s.reglMontant}>+{money(r.montantPaye)}</Text>
                          <Text style={s.reglMode}>{r.modePaiement}</Text>
                        </View>
                        {!!r.referencePaiement && (
                          <Text style={s.reglRef}>Réf : {r.referencePaiement}</Text>
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
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa',
  },
  iconBtnActive: { backgroundColor: '#081648', borderColor: '#081648' },

  // Panneau filtres
  filtresPanel: {
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', gap: 10,
  },
  periodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodeInput: { flex: 1, paddingVertical: 8 },

  // Carte dette
  card: {
    backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
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
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Info card (modal détails)
  infoCard: { backgroundColor: '#fafafa', borderRadius: 14, padding: 12, marginBottom: 14 },
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

  // Sélecteur client
  selectedClientBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#bfdbfe',
  },
  selectedClientText: { color: '#1e3a8a', fontWeight: '600', fontSize: 13, flex: 1 },
  clientOption: {
    paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  clientOptionText: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  clientOptionSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },

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
