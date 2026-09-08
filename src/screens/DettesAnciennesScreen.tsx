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
import { useColors } from '../theme/colors';

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
  const colors = useColors();

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
  // Modification d'une dette existante — même formulaire que la création (comme
  // resources.page.ts edit(item) + saveDette() côté Ionic, qui réutilisent
  // detteForm avec un id). null = mode création.
  const [editingDette, setEditingDette] = useState<DetteAncienne | null>(null);

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
    setEditingDette(null);
    setSelectedClient(null);
    setClientSearch('');
    setFormDescription('');
    setFormMontant(0);
    setFormDateCredit(new Date().toISOString().split('T')[0]);
  };

  // Ouvre le formulaire pré-rempli pour modifier une dette existante — parité
  // avec le bouton générique "Modifier" (edit(item) + saveDette() en mode
  // édition) toujours affiché côté Ionic pour chaque dette de la liste.
  const ouvrirEditerDette = (dette: DetteAncienne) => {
    setEditingDette(dette);
    const clientExistant = clients.find(c => c.id === dette.clientId);
    setSelectedClient(clientExistant || {
      id: dette.clientId,
      nom: dette.clientNom || '',
      prenom: dette.clientPrenom,
      telephone: dette.clientTelephone,
    });
    setClientSearch('');
    setFormMontant(dette.montantInitial || 0);
    setFormDateCredit(dette.dateCredit ? new Date(dette.dateCredit).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setFormDescription(dette.description || '');
    setShowNouvelle(true);
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
      if (editingDette) {
        await executerOuMettreEnFile(
          'dette_update',
          { id: editingDette.id, ...payload },
          () => api.put(`/dettes-anciennes/${editingDette.id}`, payload)
        );
      } else {
        await executerOuMettreEnFile('dette_create', payload, () => api.post('/dettes-anciennes', payload));
      }
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
          style={[s.chip, { backgroundColor: current === m ? colors.hero : colors.inputBg, borderColor: current === m ? colors.hero : colors.border }]}
          onPress={() => onSelect(m)}
        >
          <Text style={[s.chipText, { color: current === m ? '#fff' : colors.textSecondary }, current === m && { fontWeight: '600' }]}>{MODE_LABELS[m]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatutBadge = (d: DetteAncienne) => {
    const cfg = d.estReglee
      ? { color: colors.success, bg: colors.successBg, label: 'Soldée', icon: 'check-circle-outline' as const }
      : { color: colors.warning, bg: colors.warningBg, label: 'En cours', icon: 'clock-outline' as const };
    return (
      <View style={[s.statutBadge, { backgroundColor: cfg.bg }]}>
        <MaterialCommunityIcons name={cfg.icon} size={11} color={cfg.color} />
        <Text style={[s.statutBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    );
  };

  // ─── Rendu principal ──────────────────────────────────────────────────────
  if (loading) return <View style={[s.container, { backgroundColor: colors.background }]}><ActivityIndicator style={{ flex: 1 }} size="large" color={colors.hero} /></View>;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* ── Hero stats ─────────────────────────────────────────────────────── */}
      <View style={[s.hero, { backgroundColor: colors.hero }]}>
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
      <View style={[s.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[s.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un client..."
            placeholderTextColor={colors.placeholder}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.iconBtn, { backgroundColor: showFiltres ? colors.hero : colors.inputBg, borderColor: showFiltres ? colors.hero : colors.border }]}
          onPress={() => setShowFiltres(v => !v)}
        >
          <MaterialCommunityIcons name="filter-variant" size={20} color={showFiltres ? '#fff' : colors.hero} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.iconBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={imprimerListe}>
          <MaterialCommunityIcons name="printer-outline" size={20} color={colors.hero} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.hero }]} onPress={() => { resetForm(); setShowNouvelle(true); }}>
          <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Panneau filtres (statut + période) ─────────────────────────────── */}
      {showFiltres && (
        <View style={[s.filtresPanel, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={s.chips}>
            <TouchableOpacity
              style={[s.chip, { backgroundColor: filtreActif === 'nonReglees' ? colors.hero : colors.inputBg, borderColor: filtreActif === 'nonReglees' ? colors.hero : colors.border }]}
              onPress={() => setFiltreActif('nonReglees')}
            >
              <Text style={[s.chipText, { color: filtreActif === 'nonReglees' ? '#fff' : colors.textSecondary }, filtreActif === 'nonReglees' && { fontWeight: '600' }]}>Non réglées</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.chip, { backgroundColor: filtreActif === 'reglees' ? colors.hero : colors.inputBg, borderColor: filtreActif === 'reglees' ? colors.hero : colors.border }]}
              onPress={() => setFiltreActif('reglees')}
            >
              <Text style={[s.chipText, { color: filtreActif === 'reglees' ? '#fff' : colors.textSecondary }, filtreActif === 'reglees' && { fontWeight: '600' }]}>Réglées</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.chip, { backgroundColor: filtreActif === 'toutes' ? colors.hero : colors.inputBg, borderColor: filtreActif === 'toutes' ? colors.hero : colors.border }]}
              onPress={() => setFiltreActif('toutes')}
            >
              <Text style={[s.chipText, { color: filtreActif === 'toutes' ? '#fff' : colors.textSecondary }, filtreActif === 'toutes' && { fontWeight: '600' }]}>Toutes</Text>
            </TouchableOpacity>
          </View>
          <View style={s.periodeRow}>
            <TextInput
              style={[s.fieldInput, s.periodeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={dateDebut}
              onChangeText={setDateDebut}
              placeholder="Début AAAA-MM-JJ"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={{ color: colors.textSecondary }}>→</Text>
            <TextInput
              style={[s.fieldInput, s.periodeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={dateFin}
              onChangeText={setDateFin}
              placeholder="Fin AAAA-MM-JJ"
              placeholderTextColor={colors.placeholder}
            />
            {(dateDebut || dateFin) && (
              <TouchableOpacity onPress={() => { setDateDebut(''); setDateFin(''); }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.placeholder} />
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
            colors={[colors.hero]}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="bank-off-outline" size={48} color={colors.textSecondary} />
            <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>Aucune dette enregistrée</Text>
          </View>
        }
        renderItem={({ item: d }) => {
          const cfg = d.estReglee ? colors.success : colors.warning;
          const pct = d.montantInitial > 0
            ? Math.min(100, Math.round((d.montantPaye / d.montantInitial) * 100))
            : 0;
          return (
            <View style={[s.card, { backgroundColor: colors.card }]}>

              {/* En-tête carte */}
              <View style={s.cardTop}>
                <View style={[s.avatar, { backgroundColor: cfg }]}>
                  <Text style={s.avatarText}>{nomClient(d)[0]?.toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.creancierText, { color: colors.text }]}>{nomClient(d)}</Text>
                  {!!d.description && (
                    <Text style={[s.descText, { color: colors.textSecondary }]} numberOfLines={1}>{d.description}</Text>
                  )}
                  <Text style={[s.dateText, { color: colors.textSecondary }]}>Crédit du : {dateStr(d.dateCredit)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.montantText, { color: cfg }]}>{money(d.montantRestant)}</Text>
                  <Text style={[s.montantSub, { color: colors.textSecondary }]}>/ {money(d.montantInitial)}</Text>
                  {renderStatutBadge(d)}
                </View>
              </View>

              {/* Barre de progression */}
              <View style={s.progressWrap}>
                <View style={[s.progressBg, { backgroundColor: colors.border }]}>
                  <View
                    style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: cfg }]}
                  />
                </View>
                <Text style={[s.progressLabel, { color: colors.textSecondary }]}>{pct}% réglé</Text>
              </View>

              {/* Actions */}
              <View style={s.cardActions}>
                <TouchableOpacity style={[s.actionBtn, { borderColor: colors.border }]} onPress={() => openDetails(d)}>
                  <MaterialCommunityIcons name="eye-outline" size={14} color={colors.hero} />
                  <Text style={[s.actionBtnText, { color: colors.hero }]}>Détails</Text>
                </TouchableOpacity>
                {!d.estReglee && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnPrimary, { backgroundColor: colors.hero, borderColor: colors.hero }]}
                    onPress={() => openReglement(d)}
                  >
                    <MaterialCommunityIcons name="cash-plus" size={14} color="#fff" />
                    <Text style={s.actionBtnTextPrimary}>Règlement</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnDanger, { borderColor: colors.hero }]}
                  onPress={() => ouvrirEditerDette(d)}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.hero} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.actionBtn, s.actionBtnDanger, { borderColor: colors.danger }]}
                  onPress={() => supprimerDette(d)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={14} color={colors.danger} />
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
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]}>{editingDette ? 'Modifier la dette' : 'Nouvelle dette'}</Text>
              <TouchableOpacity onPress={() => { setShowNouvelle(false); resetForm(); }}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Client *</Text>
              {selectedClient ? (
                <View style={[s.selectedClientBox, { backgroundColor: colors.infoBg }]}>
                  <Text style={[s.selectedClientText, { color: colors.info }]}>
                    {`${selectedClient.prenom || ''} ${selectedClient.nom}`.trim()}
                    {selectedClient.telephone ? ` · ${selectedClient.telephone}` : ''}
                  </Text>
                  <TouchableOpacity onPress={() => { setSelectedClient(null); setClientSearch(''); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={clientSearch}
                    onChangeText={setClientSearch}
                    placeholder="Rechercher un client..."
                    placeholderTextColor={colors.placeholder}
                  />
                  {clientsFiltres.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.clientOption, { borderBottomColor: colors.border }]}
                      onPress={() => { setSelectedClient(c); setClientSearch(''); }}
                    >
                      <Text style={[s.clientOptionText, { color: colors.text }]}>{`${c.prenom || ''} ${c.nom}`.trim()}</Text>
                      {!!c.telephone && <Text style={[s.clientOptionSub, { color: colors.textSecondary }]}>{c.telephone}</Text>}
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Montant *</Text>
              <MontantInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formMontant}
                onChangeValue={setFormMontant}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Date du crédit</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formDateCredit}
                onChangeText={setFormDateCredit}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[s.fieldInput, { height: 80, textAlignVertical: 'top', backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formDescription}
                onChangeText={setFormDescription}
                multiline
                placeholder="Description de la dette"
                placeholderTextColor={colors.placeholder}
              />
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: colors.border }]} onPress={() => setShowNouvelle(false)}>
                <Text style={[s.btnCancelText, { color: colors.textSecondary }]}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, { backgroundColor: colors.hero }, saving && { opacity: 0.5 }]}
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
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Ajouter un règlement</Text>
              <TouchableOpacity onPress={() => setShowReglement(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {selectedDette && (
                <View style={[s.infoCard, { backgroundColor: colors.inputBg }]}>
                  <Text style={[s.infoCardTitle, { color: colors.hero }]}>{nomClient(selectedDette)}</Text>
                  <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Reste à payer</Text>
                    <Text style={[s.infoVal, { color: colors.danger, fontWeight: '700' }]}>
                      {money(selectedDette.montantRestant)}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Montant versé *</Text>
              <MontantInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={reglMontant}
                onChangeValue={setReglMontant}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Mode de paiement</Text>
              {renderModeChips(reglMode, setReglMode)}
              {reglMode !== 'ESPECES' && (
                <>
                  <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Référence</Text>
                  <TextInput
                    style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={reglRef}
                    onChangeText={setReglRef}
                    placeholder="N° transaction..."
                    placeholderTextColor={colors.placeholder}
                  />
                </>
              )}
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: colors.border }]} onPress={() => setShowReglement(false)}>
                <Text style={[s.btnCancelText, { color: colors.textSecondary }]}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, { backgroundColor: colors.hero }, savingRegl && { opacity: 0.5 }]}
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
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]} numberOfLines={1}>
                Détails — {selectedDette ? nomClient(selectedDette) : ''}
              </Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {selectedDette && (
                <>
                  <View style={[s.infoCard, { backgroundColor: colors.inputBg }]}>
                    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Client</Text>
                      <Text style={[s.infoVal, { color: colors.text }]}>{nomClient(selectedDette)}</Text>
                    </View>
                    {!!selectedDette.clientTelephone && (
                      <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                        <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Téléphone</Text>
                        <Text style={[s.infoVal, { color: colors.text }]}>{selectedDette.clientTelephone}</Text>
                      </View>
                    )}
                    {!!selectedDette.description && (
                      <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                        <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Description</Text>
                        <Text style={[s.infoVal, { color: colors.text }]}>{selectedDette.description}</Text>
                      </View>
                    )}
                    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Montant total</Text>
                      <Text style={[s.infoVal, { color: colors.text }]}>{money(selectedDette.montantInitial)}</Text>
                    </View>
                    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Montant réglé</Text>
                      <Text style={[s.infoVal, { color: colors.success }]}>{money(selectedDette.montantPaye)}</Text>
                    </View>
                    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Reste à payer</Text>
                      <Text style={[s.infoVal, { color: colors.danger }]}>{money(selectedDette.montantRestant)}</Text>
                    </View>
                    <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Date du crédit</Text>
                      <Text style={[s.infoVal, { color: colors.text }]}>{dateStr(selectedDette.dateCredit)}</Text>
                    </View>
                    <View style={[s.infoRow, { alignItems: 'center', borderBottomColor: colors.border }]}>
                      <Text style={[s.infoLabel, { color: colors.textSecondary }]}>Statut</Text>
                      {renderStatutBadge(selectedDette)}
                    </View>
                  </View>

                  <Text style={[s.sectionTitle, { color: colors.hero }]}>Historique des règlements</Text>

                  {loadingReglements ? (
                    <ActivityIndicator size="small" style={{ margin: 12 }} color={colors.hero} />
                  ) : reglements.length === 0 ? (
                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>Aucun règlement enregistré</Text>
                  ) : (
                    reglements.map((r, i) => (
                      <View key={r.id ?? i} style={[s.reglRow, { borderBottomColor: colors.border }]}>
                        <View style={s.reglTop}>
                          <Text style={[s.reglDate, { color: colors.textSecondary }]}>{dateStr(r.dateReglement)}</Text>
                          <Text style={[s.reglMontant, { color: colors.success }]}>+{money(r.montantPaye)}</Text>
                          <Text style={[s.reglMode, { backgroundColor: colors.inputBg, color: colors.textSecondary }]}>{r.modePaiement}</Text>
                        </View>
                        {!!r.referencePaiement && (
                          <Text style={[s.reglRef, { color: colors.textSecondary }]}>Réf : {r.referencePaiement}</Text>
                        )}
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnConfirm, { flex: 1, backgroundColor: colors.hero }]} onPress={() => setShowDetails(false)}>
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
  container: { flex: 1 },

  // Hero
  hero: { flexDirection: 'row', padding: 14, alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginBottom: 2, textAlign: 'center' },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Toolbar
  toolbar: {
    flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center',
    borderBottomWidth: 1,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14 },
  addBtn: {
    borderRadius: 12, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Panneau filtres
  filtresPanel: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, gap: 10,
  },
  periodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodeInput: { flex: 1, paddingVertical: 8 },

  // Carte dette
  card: {
    borderRadius: 18, marginBottom: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  creancierText: { fontWeight: 'bold', fontSize: 15, marginBottom: 2 },
  descText: { fontSize: 12, marginBottom: 3 },
  dateText: { fontSize: 11 },
  montantText: { fontWeight: 'bold', fontSize: 16 },
  montantSub: { fontSize: 11, marginTop: 1 },

  // Badge statut
  statutBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, marginTop: 5,
  },
  statutBadgeText: { fontSize: 11, fontWeight: '600' },

  // Barre progression
  progressWrap: { marginBottom: 10 },
  progressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressLabel: { fontSize: 10, marginTop: 3, textAlign: 'right' },

  // Actions carte
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 7,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  actionBtnPrimary: { flex: 2 },
  actionBtnTextPrimary: { color: '#fff', fontSize: 12, fontWeight: '600' },
  actionBtnDanger: { flex: 0, paddingHorizontal: 12 },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { fontSize: 15 },
  emptyText: { textAlign: 'center', padding: 12, fontSize: 13 },

  // Modal commun
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1 },

  // Info card (modal détails)
  infoCard: { borderRadius: 14, padding: 12, marginBottom: 14 },
  infoCardTitle: { fontWeight: 'bold', fontSize: 15, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 5, borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13 },
  infoVal: { fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 8 },

  // Titre de section
  sectionTitle: { fontWeight: 'bold', marginBottom: 8, marginTop: 4, fontSize: 13 },

  // Ligne règlement
  reglRow: { paddingVertical: 8, borderBottomWidth: 1 },
  reglTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reglDate: { flex: 1, fontSize: 12 },
  reglMontant: { fontWeight: '700', fontSize: 13 },
  reglMode: {
    fontSize: 11, paddingHorizontal: 6,
    paddingVertical: 2, borderRadius: 4,
  },
  reglRef: { fontSize: 11, marginTop: 2 },

  // Formulaire
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },

  // Sélecteur client
  selectedClientBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 10, padding: 12,
  },
  selectedClientText: { fontWeight: '600', fontSize: 13, flex: 1 },
  clientOption: {
    paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1,
  },
  clientOptionText: { fontSize: 13, fontWeight: '500' },
  clientOptionSub: { fontSize: 11, marginTop: 1 },

  // Boutons footer
  btnCancel: {
    flex: 1, borderWidth: 1, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  btnCancelText: { fontWeight: '600' },
  btnConfirm: {
    flex: 2, borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
  },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
