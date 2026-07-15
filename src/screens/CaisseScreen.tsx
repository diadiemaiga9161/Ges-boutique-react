import React, { useEffect, useState, useCallback } from 'react';
import {
  View, ScrollView, FlatList, StyleSheet, Alert, Modal,
  TouchableOpacity, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { Text, ActivityIndicator, Card, FAB } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import {
  getVentesJour, getCreditsNonRegles, getCreditsRegles, getCreditsEnRetard,
  getCaisseEtat, ouvrirCaisse, fermerCaisse,
  getOperationsJour, getOperationsParPeriode, ajouterEntreeCaisse, ajouterSortieCaisse,
  reglerCreditCaisse, getStatsCaisseJour, getHistoriqueReglementsCredit,
} from '../services/api.service';
import { TextInput } from 'react-native';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import NetInfo from '@react-native-community/netinfo';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v || 0).toLocaleString('fr-FR') + ' FCFA';

const toLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
};

const dateStr = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

// ─── Types ────────────────────────────────────────────────────────────────────
type Onglet = 'etat' | 'credits' | 'operations' | 'stats';
type FiltreCredit = 'EN_COURS' | 'REGLES' | 'EN_RETARD';
type FiltrePeriode = 'AUJOURD_HUI' | 'SEMAINE' | 'MOIS';
type TypeOp = 'ENTREE' | 'SORTIE';

const MODES_OPERATION = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'VIREMENT'] as const;
type ModeOperation = typeof MODES_OPERATION[number];

const MODES_REGLEMENT = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARTE_BANCAIRE', 'VIREMENT'] as const;
type ModeReglement = typeof MODES_REGLEMENT[number];

type Mode = ModeOperation | ModeReglement;
const MODE_LABELS: Record<Mode, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange',
  MOOV_MONEY: 'Moov',
  VIREMENT: 'Virement',
  CARTE_BANCAIRE: 'Carte',
};

interface CreditInfo {
  venteId: number;
  numeroVente: string;
  clientNom: string;
  clientPrenom?: string;
  clientTelephone?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  enRetard: boolean;
  estReglee?: boolean;
  regleParNom?: string;
  vendeurNom?: string;
  dateReglement?: string;
}

interface Operation {
  id?: number;
  montant: number;
  dateOperation?: string;
  type?: string;
  motif?: string;
  modePaiement?: string;
  referencePaiement?: string;
  utilisateurNom?: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────
export default function CaisseScreen() {
  const { lang } = useLang();
  const [onglet, setOnglet] = useState<Onglet>('etat');
  const [fromCache, setFromCache] = useState(false);

  // --- État ---
  const [ventesJour, setVentesJour] = useState<any[]>([]);
  const [etatCaisse, setEtatCaisse] = useState<any>(null);
  const [loadingEtat, setLoadingEtat] = useState(true);
  const [refreshingEtat, setRefreshingEtat] = useState(false);

  // --- Crédits ---
  const [credits, setCredits] = useState<CreditInfo[]>([]);
  const [filtreCredit, setFiltreCredit] = useState<FiltreCredit>('EN_COURS');
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [refreshingCredits, setRefreshingCredits] = useState(false);

  // Modal détail crédit
  const [showDetailCredit, setShowDetailCredit] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditInfo | null>(null);
  const [versements, setVersements] = useState<Operation[]>([]);
  const [loadingVersements, setLoadingVersements] = useState(false);

  // Modal règlement
  const [showReglement, setShowReglement] = useState(false);
  const [reglMontant, setReglMontant] = useState('');
  const [reglMode, setReglMode] = useState<ModeReglement>('ESPECES');
  const [reglRef, setReglRef] = useState('');
  const [savingRegl, setSavingRegl] = useState(false);

  // --- Opérations ---
  const [operations, setOperations] = useState<Operation[]>([]);
  const [filtrePeriode, setFiltrePeriode] = useState<FiltrePeriode>('AUJOURD_HUI');
  const [loadingOps, setLoadingOps] = useState(false);
  const [refreshingOps, setRefreshingOps] = useState(false);

  // Modal ajout opération
  const [showAjoutOp, setShowAjoutOp] = useState(false);
  const [opType, setOpType] = useState<TypeOp>('ENTREE');
  const [opMontant, setOpMontant] = useState('');
  const [opMotif, setOpMotif] = useState('');
  const [opMode, setOpMode] = useState<ModeOperation>('ESPECES');
  const [opRef, setOpRef] = useState('');
  const [savingOp, setSavingOp] = useState(false);

  // --- Stats ---
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsChargees, setStatsChargees] = useState(false);

  // ─── Chargement initial (État) ───────────────────────────────────────────
  const chargerEtat = useCallback(async () => {
    setLoadingEtat(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const [resV, resEtat] = await Promise.all([
        getVentesJour().catch(() => ({ data: [] })),
        getCaisseEtat().catch(() => ({ data: null })),
      ]);
      const ventes = resV.data?.data || resV.data || [];
      const etat = resEtat.data?.caisse || resEtat.data?.data || resEtat.data;
      setVentesJour(ventes);
      setEtatCaisse(etat);
      setFromCache(false);
      sauvegarderCache('caisse_etat', { ventes, etat }).catch(() => {});
    } catch {
      const cached = await lireCache<any>('caisse_etat');
      if (cached.length > 0) {
        const c = cached[0] as any;
        setVentesJour(c.ventes || []);
        setEtatCaisse(c.etat || null);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
    setLoadingEtat(false);
    setRefreshingEtat(false);
  }, []);

  useEffect(() => { chargerEtat(); }, []);

  // ─── Chargement crédits ──────────────────────────────────────────────────
  const chargerCredits = useCallback(async (filtre: FiltreCredit) => {
    setLoadingCredits(true);
    try {
      if (filtre === 'EN_COURS') {
        const res = await getCreditsNonRegles().catch(() => ({ data: [] }));
        const raw = res.data?.data || res.data?.credits || res.data || [];
        setCredits(Array.isArray(raw) ? raw.filter((c: any) => !c.venteAnnulee) : []);
      } else if (filtre === 'REGLES') {
        const res = await getCreditsRegles().catch(() => ({ data: [] }));
        const raw = res.data?.data || res.data?.credits || res.data || [];
        setCredits(Array.isArray(raw) ? raw : []);
      } else {
        const res = await getCreditsEnRetard().catch(() => ({ data: [] }));
        const raw = res.data?.data || res.data?.credits || res.data || [];
        setCredits(Array.isArray(raw) ? raw : []);
      }
    } catch { }
    setLoadingCredits(false);
    setRefreshingCredits(false);
  }, []);

  // ─── Chargement opérations ───────────────────────────────────────────────
  const chargerOperations = useCallback(async (filtre: FiltrePeriode) => {
    setLoadingOps(true);
    try {
      const now = new Date();
      let res;
      if (filtre === 'AUJOURD_HUI') {
        res = await getOperationsJour().catch(() => ({ data: [] }));
      } else if (filtre === 'SEMAINE') {
        const start = new Date(now);
        const day = start.getDay();
        start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
        res = await getOperationsParPeriode(toLocalDate(start), toLocalDate(now)).catch(() => ({ data: [] }));
      } else {
        const debutMois = toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
        res = await getOperationsParPeriode(debutMois, toLocalDate(now)).catch(() => ({ data: [] }));
      }
      const raw = res.data?.data || res.data?.operations || res.data || [];
      setOperations(Array.isArray(raw) ? raw : []);
    } catch { }
    setLoadingOps(false);
    setRefreshingOps(false);
  }, []);

  // ─── Chargement stats ────────────────────────────────────────────────────
  const chargerStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await getStatsCaisseJour().catch(() => ({ data: null }));
      setStats(res.data?.data || res.data);
    } catch { }
    setLoadingStats(false);
    setStatsChargees(true);
  }, []);

  // ─── Changement d'onglet ─────────────────────────────────────────────────
  const switchOnglet = (o: Onglet) => {
    setOnglet(o);
    if (o === 'credits' && credits.length === 0) chargerCredits('EN_COURS');
    if (o === 'operations' && operations.length === 0) chargerOperations('AUJOURD_HUI');
    if (o === 'stats' && !statsChargees) chargerStats();
  };

  const changeFiltreCredit = (f: FiltreCredit) => {
    setFiltreCredit(f);
    chargerCredits(f);
  };

  const changeFiltrePeriode = (f: FiltrePeriode) => {
    setFiltrePeriode(f);
    chargerOperations(f);
  };

  // ─── KPIs État ───────────────────────────────────────────────────────────
  const totalJour = ventesJour.reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const totalEspeces = ventesJour
    .filter((v: any) => v.modePaiement === 'ESPECES' && !v.estCredit)
    .reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const totalMobile = ventesJour
    .filter((v: any) => v.modePaiement !== 'ESPECES' && !v.estCredit)
    .reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const totalCreditsJour = ventesJour
    .filter((v: any) => v.estCredit)
    .reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);

  // ─── PDF crédits ─────────────────────────────────────────────────────────
  const genererPdfCredits = async () => {
    const totalAccorde = credits.reduce((s, c) => s + (c.montantTotal || 0), 0);
    const totalVerse = credits.reduce((s, c) => s + (c.montantVerse || 0), 0);
    const totalRestant = credits.reduce((s, c) => s + (c.montantRestant || 0), 0);
    const lignes = credits
      .map(
        (c, i) =>
          `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}${c.enRetard ? ';border-left:3px solid #ef4444' : ''}">
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">${c.clientNom || ''}${c.clientPrenom ? ' ' + c.clientPrenom : ''}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">${c.clientTelephone || '—'}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">${money(c.montantTotal)}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#16a34a">${money(c.montantVerse)}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700;color:#d97706">${money(c.montantRestant)}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center">${c.enRetard ? '<span style="color:#ef4444;font-weight:700">Retard</span>' : '<span style="color:#16a34a">OK</span>'}</td>
    </tr>`,
      )
      .join('');
    const date = new Date().toLocaleDateString('fr-FR');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Crédits en cours</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:20px;font-size:12px;background:#fffbeb}
.sheet{background:#fff;max-width:900px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#d97706,#f59e0b);color:#fff;padding:24px;display:flex;justify-content:space-between;align-items:center}
.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:12px;opacity:.7;margin-top:4px}
.kpis{display:flex;padding:16px 24px;gap:12px;border-bottom:1px solid #e5e7eb}
.kpi{flex:1;border-radius:8px;padding:12px;text-align:center}
.kpi-val{font-size:18px;font-weight:900}.kpi-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase}
.kpi--b{background:#dbeafe;color:#1d4ed8}.kpi--g{background:#dcfce7;color:#15803d}.kpi--a{background:#fef3c7;color:#b45309}
.body{padding:20px 24px}
table{width:100%;border-collapse:collapse}
thead th{background:#d97706;color:#fff;padding:9px 8px;font-size:11px;font-weight:700;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f1f5f9}
.ftr{background:#fef3c7;text-align:center;padding:14px;font-size:10px;color:#92400e}
</style></head><body>
<div class="sheet">
<div class="hdr"><div><h1>Crédits en cours</h1><p>Ges Boutique · ${date}</p></div></div>
<div class="kpis">
<div class="kpi kpi--b"><div class="kpi-val">${money(totalAccorde)}</div><div class="kpi-lbl">Total accordé</div></div>
<div class="kpi kpi--g"><div class="kpi-val">${money(totalVerse)}</div><div class="kpi-lbl">Total versé</div></div>
<div class="kpi kpi--a"><div class="kpi-val">${money(totalRestant)}</div><div class="kpi-lbl">Restant dû</div></div>
</div>
<div class="body">
<table><thead><tr><th>Client</th><th>Téléphone</th><th>Accordé</th><th>Versé</th><th>Restant</th><th>Statut</th></tr></thead>
<tbody>${lignes || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">Aucun crédit en cours</td></tr>'}</tbody></table>
</div>
<div class="ftr">Ges Boutique · Crédits en cours · ${date} · ${credits.length} crédit(s)</div>
</div></body></html>`;
    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de générer le PDF');
    }
  };

  // ─── Ouvrir modal détail crédit ──────────────────────────────────────────
  const openDetailCredit = (credit: CreditInfo) => {
    setSelectedCredit(credit);
    setVersements([]);
    setShowDetailCredit(true);
    setLoadingVersements(true);
    getHistoriqueReglementsCredit(credit.venteId)
      .then((r) => setVersements(r.data?.reglements || r.data?.data || r.data || []))
      .catch(() => {})
      .finally(() => setLoadingVersements(false));
  };

  const openReglement = (credit: CreditInfo) => {
    setSelectedCredit(credit);
    setReglMontant(String(credit.montantRestant));
    setReglMode('ESPECES');
    setReglRef('');
    setShowDetailCredit(false);
    setShowReglement(true);
  };

  const saveReglement = async () => {
    if (!selectedCredit) return;
    const montant = parseFloat(reglMontant);
    if (!montant || montant <= 0) { Alert.alert(tr('erreur', lang), 'Montant invalide'); return; }
    if (montant > selectedCredit.montantRestant) {
      Alert.alert(tr('erreur', lang), `Montant max : ${money(selectedCredit.montantRestant)}`);
      return;
    }
    if (reglMode !== 'ESPECES' && !reglRef.trim()) {
      Alert.alert('Erreur', 'Référence obligatoire pour ce mode de paiement');
      return;
    }
    setSavingRegl(true);
    try {
      const payload = {
        venteCreditId: selectedCredit.venteId,
        montantRegle: montant,
        modePaiement: reglMode,
        referencePaiement: reglRef.trim() || undefined,
      };
      const res = await executerOuMettreEnFile(
        'credit_reglement',
        payload,
        () => reglerCreditCaisse(payload)
      );
      setShowReglement(false);
      if (!res.offline) chargerCredits(filtreCredit);
      Alert.alert('OK', res.offline
        ? 'Règlement sauvegardé — synchronisation au retour connexion'
        : tr('enregistrer', lang)
      );
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Règlement impossible');
    }
    setSavingRegl(false);
  };

  // ─── Ajouter opération ───────────────────────────────────────────────────
  const saveOperation = async () => {
    const montant = parseFloat(opMontant);
    if (!montant || montant <= 0) { Alert.alert(tr('erreur', lang), 'Montant invalide'); return; }
    if (!opMotif.trim()) { Alert.alert(tr('erreur', lang), 'Motif requis'); return; }
    setSavingOp(true);
    const data = {
      montant,
      motif: opMotif.trim(),
      modePaiement: opMode,
      referencePaiement: opRef.trim() || '',
    };
    try {
      const res = opType === 'ENTREE'
        ? await executerOuMettreEnFile('caisse_entree', data, () => ajouterEntreeCaisse(data))
        : await executerOuMettreEnFile('caisse_sortie', data, () => ajouterSortieCaisse(data));
      setShowAjoutOp(false);
      setOpMontant('');
      setOpMotif('');
      setOpRef('');
      if (!res.offline) {
        chargerOperations(filtrePeriode);
        chargerEtat();
      }
      Alert.alert('OK', res.offline
        ? 'Sauvegardé hors ligne — synchronisation au retour connexion'
        : `${opType === 'ENTREE' ? tr('entree', lang) : tr('sortie', lang)}`
      );
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Opération impossible');
    }
    setSavingOp(false);
  };

  // ─── Ouvrir / Fermer caisse (offline-first) ──────────────────────────────
  const handleOuvrirCaisse = async () => {
    try {
      const res = await executerOuMettreEnFile('caisse_ouvrir', {}, () => ouvrirCaisse({}));
      if (res.offline) {
        setEtatCaisse((prev: any) => ({ ...(prev || {}), ouverte: true, estOuverte: true }));
        Alert.alert('OK', "Caisse ouverte — synchronisation au retour connexion");
      } else {
        chargerEtat();
      }
    } catch {
      Alert.alert(tr('erreur', lang), "Impossible d'ouvrir la caisse");
    }
  };

  const handleFermerCaisse = async () => {
    try {
      const res = await executerOuMettreEnFile('caisse_fermer', {}, () => fermerCaisse({}));
      if (res.offline) {
        setEtatCaisse((prev: any) => ({ ...(prev || {}), ouverte: false, estOuverte: false }));
        Alert.alert('OK', 'Caisse fermée — synchronisation au retour connexion');
      } else {
        chargerEtat();
      }
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de fermer la caisse');
    }
  };

  // ─── Composants helpers ──────────────────────────────────────────────────
  const ModeChips = ({ modes, current, onSelect }: { modes: readonly string[]; current: string; onSelect: (m: any) => void }) => (
    <View style={st.chips}>
      {modes.map((m) => (
        <TouchableOpacity
          key={m}
          style={[st.chip, current === m && st.chipActive]}
          onPress={() => onSelect(m)}
        >
          <Text style={[st.chipText, current === m && st.chipTextActive]}>{MODE_LABELS[m as Mode] || m}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Barre d'onglets ─────────────────────────────────────────────────────
  const ONGLETS: { key: Onglet; label: string }[] = [
    { key: 'etat', label: tr('solde_actuel', lang) },
    { key: 'credits', label: tr('credits', lang) },
    { key: 'operations', label: 'Opérations' },
    { key: 'stats', label: 'Stats' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={st.root}>
      {/* Onglets */}
      <View style={st.tabs}>
        {ONGLETS.map((o) => (
          <TouchableOpacity
            key={o.key}
            style={[st.tab, onglet === o.key && st.tabActive]}
            onPress={() => switchOnglet(o.key)}
          >
            <Text style={[st.tabText, onglet === o.key && st.tabTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={st.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={st.offlineTxt}>Mode hors ligne — caisse mise en cache — données non temps réel</Text>
        </View>
      )}

      {/* ════════════ ONGLET ÉTAT ════════════ */}
      {onglet === 'etat' && (
        <ScrollView
          style={st.container}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshingEtat} onRefresh={() => { setRefreshingEtat(true); chargerEtat(); }} colors={['#1a56db']} />}
        >
          {loadingEtat ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
          ) : (
            <>
              {/* Hero solde */}
              <View style={st.hero}>
                <Text style={st.heroLabel}>{tr('solde_actuel', lang)}</Text>
                <Text style={st.heroVal}>
                  {money(etatCaisse?.solde ?? etatCaisse?.soldeCaisse ?? 0)}
                </Text>
                {etatCaisse && !etatCaisse.ouverte && !etatCaisse.estOuverte && (
                  <View style={st.badgeFermee}>
                    <Text style={st.badgeFermeeText}>Fermée</Text>
                  </View>
                )}
                <Text style={st.heroSub}>{ventesJour.length} vente(s) aujourd'hui</Text>
              </View>

              {/* KPIs */}
              <View style={st.kpiRow}>
                <View style={st.kpiCard}>
                  <Text style={st.kpiVal}>{money(totalEspeces)}</Text>
                  <Text style={st.kpiLabel}>Espèces</Text>
                </View>
                <View style={[st.kpiCard, { backgroundColor: '#e8f5e9' }]}>
                  <Text style={[st.kpiVal, { color: '#16a34a' }]}>{money(totalMobile)}</Text>
                  <Text style={st.kpiLabel}>Mobile Money</Text>
                </View>
                <View style={[st.kpiCard, { backgroundColor: '#fce4ec' }]}>
                  <Text style={[st.kpiVal, { color: '#dc2626' }]}>{money(totalCreditsJour)}</Text>
                  <Text style={st.kpiLabel}>Crédits accordés</Text>
                </View>
              </View>

              {/* Boutons caisse */}
              <View style={st.caisseRow}>
                <TouchableOpacity
                  style={[st.caisseBtn, { backgroundColor: '#16a34a' }]}
                  onPress={() =>
                    Alert.alert(tr('ouvrir_caisse', lang), tr('confirmer', lang) + ' ?', [
                      { text: tr('annuler', lang), style: 'cancel' },
                      { text: tr('confirmer', lang), onPress: () => handleOuvrirCaisse() },
                    ])
                  }
                >
                  <Text style={st.caisseBtnText}>{tr('ouvrir_caisse', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.caisseBtn, { backgroundColor: '#dc2626' }]}
                  onPress={() =>
                    Alert.alert(tr('fermer_caisse', lang), tr('confirmer', lang) + ' ?', [
                      { text: tr('annuler', lang), style: 'cancel' },
                      { text: tr('confirmer', lang), onPress: () => handleFermerCaisse() },
                    ])
                  }
                >
                  <Text style={st.caisseBtnText}>{tr('fermer_caisse', lang)}</Text>
                </TouchableOpacity>
              </View>

              {/* CA du jour total */}
              <View style={st.totalJourCard}>
                <Text style={st.totalJourLabel}>{tr('chiffre_affaires', lang)}</Text>
                <Text style={st.totalJourVal}>{money(totalJour)}</Text>
              </View>

              {/* Ventes du jour */}
              <Text style={st.sectionTitle}>{tr('vente', lang)} ({ventesJour.length})</Text>
              {ventesJour.length === 0 ? (
                <View style={st.emptyState}>
                  <MaterialCommunityIcons name="cash-register" size={48} color="#cbd5e1" />
                  <Text style={st.emptyText}>{tr('aucun_resultat', lang)}</Text>
                </View>
              ) : (
                ventesJour.map((v: any) => (
                  <Card key={v.id} style={st.venteCard}>
                    <Card.Content style={st.cardRow}>
                      <View style={[st.avatar, { backgroundColor: '#1a56db22' }]}>
                        <MaterialCommunityIcons name="receipt" size={20} color="#1a56db" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.cardName}>{v.clientNom || 'Client anonyme'}</Text>
                        <View style={[st.badgeMode, v.estCredit && { backgroundColor: '#fce4ec' }]}>
                          <Text style={[st.badgeModeText, v.estCredit && { color: '#dc2626' }]}>
                            {v.estCredit ? 'Crédit' : (v.modePaiement || '').replace('_', ' ')}
                          </Text>
                        </View>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={st.cardAmt}>{money(v.montantTotal)}</Text>
                        <Text style={st.venteHeure}>
                          {v.dateVente
                            ? new Date(v.dateVente).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                            : ''}
                        </Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ════════════ ONGLET CRÉDITS ════════════ */}
      {onglet === 'credits' && (
        <View style={st.container}>
          {/* Chips filtre */}
          <View style={st.chipBar}>
            {(['EN_COURS', 'REGLES', 'EN_RETARD'] as FiltreCredit[]).map((f) => {
              const labels: Record<FiltreCredit, string> = {
                EN_COURS: tr('non_regle', lang),
                REGLES: tr('regle', lang),
                EN_RETARD: 'En retard',
              };
              return (
                <TouchableOpacity
                  key={f}
                  style={[st.filterChip, filtreCredit === f && st.filterChipActive]}
                  onPress={() => changeFiltreCredit(f)}
                >
                  <Text style={[st.filterChipText, filtreCredit === f && st.filterChipTextActive]}>
                    {labels[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={st.pdfBtn} onPress={genererPdfCredits}>
              <Text style={st.pdfBtnText}>PDF</Text>
            </TouchableOpacity>
          </View>

          {loadingCredits ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
          ) : (
            <FlatList
              data={credits}
              keyExtractor={(c) => String(c.venteId)}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={refreshingCredits} onRefresh={() => { setRefreshingCredits(true); chargerCredits(filtreCredit); }} colors={['#1a56db']} />}
              ListEmptyComponent={
                <View style={st.emptyState}>
                  <MaterialCommunityIcons name="credit-card-check-outline" size={64} color="#cbd5e1" />
                  <Text style={st.emptyText}>Aucun crédit dans cette catégorie</Text>
                </View>
              }
              renderItem={({ item: c }) => {
                const pct =
                  c.montantTotal > 0
                    ? Math.min(100, Math.round((c.montantVerse / c.montantTotal) * 100))
                    : 0;
                return (
                  <Card style={[st.creditCardPaper, c.enRetard && { borderLeftWidth: 3, borderLeftColor: '#dc2626' }]}>
                    <Card.Content>
                      <View style={st.cardRow}>
                        <View style={[st.avatar, { backgroundColor: c.enRetard ? '#fee2e2' : '#dbeafe' }]}>
                          <MaterialCommunityIcons name="account-clock" size={20} color={c.enRetard ? '#dc2626' : '#1a56db'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.cardName}>
                            {c.clientNom}{c.clientPrenom ? ' ' + c.clientPrenom : ''}
                          </Text>
                          {c.clientTelephone ? (
                            <Text style={st.cardSub}>{c.clientTelephone}</Text>
                          ) : null}
                          <Text style={st.cardSub}>{c.numeroVente}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[st.creditRestant, c.enRetard && { color: '#dc2626' }, c.estReglee && { color: '#16a34a' }]}>
                            {c.estReglee ? 'Réglé' : money(c.montantRestant)}
                          </Text>
                          {c.enRetard && (
                            <View style={st.retardBadge}>
                              <Text style={st.retardBadgeText}>Retard</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Barre progression */}
                      {!c.estReglee && (
                        <View style={st.progressWrap}>
                          <View style={st.progressBg}>
                            <View
                              style={[
                                st.progressFill,
                                c.enRetard && { backgroundColor: '#dc2626' },
                                { width: `${pct}%` as any },
                              ]}
                            />
                          </View>
                          <View style={st.rowBetween}>
                            <Text style={st.progressText}>Versé {money(c.montantVerse)}</Text>
                            <Text style={st.progressText}>/ {money(c.montantTotal)}</Text>
                          </View>
                        </View>
                      )}

                      {/* Boutons */}
                      <View style={st.creditActions}>
                        <TouchableOpacity style={st.btnVoir} onPress={() => openDetailCredit(c)}>
                          <Text style={st.btnVoirText}>Voir</Text>
                        </TouchableOpacity>
                        {!c.estReglee && (
                          <TouchableOpacity style={st.btnRegler} onPress={() => openReglement(c)}>
                            <Text style={st.btnReglerText}>Régler</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ════════════ ONGLET OPÉRATIONS ════════════ */}
      {onglet === 'operations' && (
        <View style={st.container}>
          {/* Filtres période */}
          <View style={st.chipBar}>
            {(['AUJOURD_HUI', 'SEMAINE', 'MOIS'] as FiltrePeriode[]).map((f) => {
              const labels: Record<FiltrePeriode, string> = {
                AUJOURD_HUI: tr('rapport_journalier', lang),
                SEMAINE: tr('rapport_semaine', lang),
                MOIS: tr('rapport_mois', lang),
              };
              return (
                <TouchableOpacity
                  key={f}
                  style={[st.filterChip, filtrePeriode === f && st.filterChipActive]}
                  onPress={() => changeFiltrePeriode(f)}
                >
                  <Text style={[st.filterChipText, filtrePeriode === f && st.filterChipTextActive]}>
                    {labels[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loadingOps ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
          ) : (
            <FlatList
              data={operations}
              keyExtractor={(op, i) => String(op.id ?? i)}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              refreshControl={<RefreshControl refreshing={refreshingOps} onRefresh={() => { setRefreshingOps(true); chargerOperations(filtrePeriode); }} colors={['#1a56db']} />}
              ListEmptyComponent={
                <View style={st.emptyState}>
                  <MaterialCommunityIcons name="swap-horizontal" size={64} color="#cbd5e1" />
                  <Text style={st.emptyText}>Aucune opération sur cette période</Text>
                </View>
              }
              renderItem={({ item: op }) => {
                const isEntree = (op.type || '').toUpperCase() === 'ENTREE' || (op.montant || 0) > 0;
                return (
                  <Card style={st.opCardPaper}>
                    <Card.Content style={st.cardRow}>
                      <View style={[st.avatar, { backgroundColor: isEntree ? '#dcfce7' : '#fee2e2' }]}>
                        <MaterialCommunityIcons
                          name={isEntree ? 'arrow-down-circle' : 'arrow-up-circle'}
                          size={22}
                          color={isEntree ? '#16a34a' : '#dc2626'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.cardName}>{op.motif || '—'}</Text>
                        <Text style={st.cardSub}>{dateStr(op.dateOperation)}</Text>
                        {op.modePaiement ? (
                          <Text style={st.cardSub}>{op.modePaiement.replace('_', ' ')}</Text>
                        ) : null}
                      </View>
                      <Text style={[st.opMontant, isEntree ? st.opEntree : st.opSortie]}>
                        {isEntree ? '+' : '-'}{money(Math.abs(op.montant))}
                      </Text>
                    </Card.Content>
                  </Card>
                );
              }}
            />
          )}

          {/* FAB ajout */}
          <FAB
            icon="plus"
            style={st.fab}
            onPress={() => {
              setOpType('ENTREE');
              setOpMontant('');
              setOpMotif('');
              setOpMode('ESPECES');
              setOpRef('');
              setShowAjoutOp(true);
            }}
          />
        </View>
      )}

      {/* ════════════ ONGLET STATS ════════════ */}
      {onglet === 'stats' && (
        <ScrollView style={st.container} contentContainerStyle={{ padding: 16 }}>
          {loadingStats ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
          ) : stats ? (
            <>
              <View style={st.statsGrid}>
                <View style={[st.statsCard, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[st.statsVal, { color: '#1d4ed8' }]}>{money(stats.caJour ?? stats.totalVentes ?? 0)}</Text>
                  <Text style={st.statsLabel}>CA du jour</Text>
                </View>
                <View style={[st.statsCard, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[st.statsVal, { color: '#15803d' }]}>{stats.nbVentes ?? 0}</Text>
                  <Text style={st.statsLabel}>Nb ventes</Text>
                </View>
                <View style={[st.statsCard, { backgroundColor: '#e0f2fe' }]}>
                  <Text style={[st.statsVal, { color: '#0369a1' }]}>{money(stats.totalEspeces ?? 0)}</Text>
                  <Text style={st.statsLabel}>Espèces</Text>
                </View>
                <View style={[st.statsCard, { backgroundColor: '#f0fdf4' }]}>
                  <Text style={[st.statsVal, { color: '#16a34a' }]}>{money(stats.totalMobileMoney ?? stats.totalMobile ?? 0)}</Text>
                  <Text style={st.statsLabel}>Mobile Money</Text>
                </View>
                <View style={[st.statsCard, { backgroundColor: '#fef3c7' }]}>
                  <Text style={[st.statsVal, { color: '#b45309' }]}>{money(stats.totalCreditsAccordes ?? stats.totalCredits ?? 0)}</Text>
                  <Text style={st.statsLabel}>Crédits accordés</Text>
                </View>
                <View style={[st.statsCard, { backgroundColor: '#fce7f3' }]}>
                  <Text style={[st.statsVal, { color: '#be185d' }]}>{stats.creditsEnRetard ?? 0}</Text>
                  <Text style={st.statsLabel}>Crédits en retard</Text>
                </View>
              </View>
              <TouchableOpacity style={st.refreshBtn} onPress={chargerStats}>
                <Text style={st.refreshBtnText}>Actualiser les stats</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <MaterialCommunityIcons name="chart-bar" size={64} color="#cbd5e1" />
              <Text style={st.emptyText}>Aucune statistique disponible</Text>
              <TouchableOpacity style={[st.refreshBtn, { marginTop: 16 }]} onPress={chargerStats}>
                <Text style={st.refreshBtnText}>Charger les stats</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* ══════ MODAL DÉTAIL CRÉDIT ══════ */}
      <Modal visible={showDetailCredit} animationType="slide" transparent onRequestClose={() => setShowDetailCredit(false)}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.handle} />
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>{tr('details', lang)} {tr('credits', lang).toLowerCase()}</Text>
              <TouchableOpacity onPress={() => setShowDetailCredit(false)}>
                <Text style={{ fontSize: 22, color: '#666' }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={st.modalBody}>
              {selectedCredit && (
                <>
                  <View style={st.infoCard}>
                    {[
                      ['Client', `${selectedCredit.clientNom}${selectedCredit.clientPrenom ? ' ' + selectedCredit.clientPrenom : ''}`],
                      ['Téléphone', selectedCredit.clientTelephone || '—'],
                      ['N° vente', selectedCredit.numeroVente],
                      ['Total', money(selectedCredit.montantTotal)],
                      ['Versé', money(selectedCredit.montantVerse)],
                      ['Reste dû', money(selectedCredit.montantRestant)],
                    ].map(([label, val]) => (
                      <View key={label} style={st.infoRow}>
                        <Text style={st.infoLabel}>{label}</Text>
                        <Text style={[st.infoVal, label === 'Reste dû' && { color: '#dc2626', fontWeight: 'bold' }]}>
                          {val}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text style={st.sectionTitle}>Historique {tr('montant_payer', lang).toLowerCase()}</Text>
                  {loadingVersements ? (
                    <ActivityIndicator size="small" style={{ margin: 12 }} />
                  ) : versements.length === 0 ? (
                    <Text style={st.emptyText}>Aucun versement enregistré</Text>
                  ) : (
                    versements.map((v, i) => (
                      <View key={i} style={st.versRow}>
                        <View style={st.rowBetween}>
                          <Text style={st.versDate}>{dateStr(v.dateOperation)}</Text>
                          <Text style={st.versMontant}>+{money(v.montant)}</Text>
                        </View>
                        <Text style={st.versMode}>{v.modePaiement || 'ESPECES'}</Text>
                        {v.utilisateurNom ? <Text style={st.versSub}>Par {v.utilisateurNom}</Text> : null}
                      </View>
                    ))
                  )}
                </>
              )}
            </ScrollView>
            <View style={st.modalFoot}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowDetailCredit(false)}>
                <Text style={st.btnCancelText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
              {selectedCredit && !selectedCredit.estReglee && (
                <TouchableOpacity
                  style={st.btnConfirm}
                  onPress={() => {
                    setShowDetailCredit(false);
                    if (selectedCredit) openReglement(selectedCredit);
                  }}
                >
                  <Text style={st.btnConfirmText}>{tr('payer_credit', lang)}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════ MODAL RÈGLEMENT ══════ */}
      <Modal visible={showReglement} animationType="slide" transparent onRequestClose={() => setShowReglement(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={st.sheet}>
              <View style={st.handle} />
              <View style={st.modalHead}>
                <Text style={st.modalTitle}>{tr('credits', lang)} — {tr('payer_credit', lang)}</Text>
                <TouchableOpacity onPress={() => setShowReglement(false)}>
                  <Text style={{ fontSize: 22, color: '#666' }}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={st.modalBody}>
                {selectedCredit && (
                  <View style={st.infoCard}>
                    <View style={st.infoRow}>
                      <Text style={st.infoLabel}>Client</Text>
                      <Text style={st.infoVal}>{selectedCredit.clientNom}</Text>
                    </View>
                    <View style={st.infoRow}>
                      <Text style={st.infoLabel}>Reste dû</Text>
                      <Text style={[st.infoVal, { color: '#dc2626', fontWeight: 'bold' }]}>
                        {money(selectedCredit.montantRestant)}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={st.fieldLabel}>{tr('montant_payer', lang)}</Text>
                <TextInput
                  style={st.fieldInput}
                  value={reglMontant}
                  onChangeText={setReglMontant}
                  keyboardType="numeric"
                  placeholder="Montant..."
                  placeholderTextColor="#bbb"
                />
                <Text style={st.fieldLabel}>Mode de paiement</Text>
                <ModeChips modes={MODES_REGLEMENT} current={reglMode} onSelect={setReglMode} />
                {reglMode !== 'ESPECES' && (
                  <>
                    <Text style={st.fieldLabel}>Référence paiement (obligatoire)</Text>
                    <TextInput
                      style={st.fieldInput}
                      placeholder="Référence paiement (obligatoire)"
                      value={reglRef}
                      onChangeText={setReglRef}
                      placeholderTextColor="#bbb"
                    />
                  </>
                )}
              </ScrollView>
              <View style={st.modalFoot}>
                <TouchableOpacity style={st.btnCancel} onPress={() => setShowReglement(false)}>
                  <Text style={st.btnCancelText}>{tr('annuler', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[st.btnConfirm, savingRegl && { opacity: 0.6 }]}
                  onPress={saveReglement}
                  disabled={savingRegl}
                >
                  {savingRegl ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={st.btnConfirmText}>{tr('enregistrer', lang)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════ MODAL AJOUT OPÉRATION ══════ */}
      <Modal visible={showAjoutOp} animationType="slide" transparent onRequestClose={() => setShowAjoutOp(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={st.sheet}>
              <View style={st.handle} />
              <View style={st.modalHead}>
                <Text style={st.modalTitle}>{tr('ajouter', lang)} opération</Text>
                <TouchableOpacity onPress={() => setShowAjoutOp(false)}>
                  <Text style={{ fontSize: 22, color: '#666' }}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={st.modalBody}>
                {/* Type toggle */}
                <Text style={st.fieldLabel}>Type</Text>
                <View style={st.toggleRow}>
                  <TouchableOpacity
                    style={[st.toggleBtn, opType === 'ENTREE' && { backgroundColor: '#16a34a' }]}
                    onPress={() => setOpType('ENTREE')}
                  >
                    <Text style={[st.toggleBtnText, opType === 'ENTREE' && { color: '#fff' }]}>{tr('entree', lang)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.toggleBtn, opType === 'SORTIE' && { backgroundColor: '#dc2626' }]}
                    onPress={() => setOpType('SORTIE')}
                  >
                    <Text style={[st.toggleBtnText, opType === 'SORTIE' && { color: '#fff' }]}>{tr('sortie', lang)}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={st.fieldLabel}>Montant</Text>
                <TextInput
                  style={st.fieldInput}
                  value={opMontant}
                  onChangeText={setOpMontant}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#bbb"
                />

                <Text style={st.fieldLabel}>Motif</Text>
                <TextInput
                  style={st.fieldInput}
                  value={opMotif}
                  onChangeText={setOpMotif}
                  placeholder="Ex : Avance fournisseur..."
                  placeholderTextColor="#bbb"
                />

                <Text style={st.fieldLabel}>Mode de paiement</Text>
                <ModeChips modes={MODES_OPERATION} current={opMode} onSelect={setOpMode} />

                {opMode !== 'ESPECES' && (
                  <>
                    <Text style={st.fieldLabel}>Référence</Text>
                    <TextInput
                      style={st.fieldInput}
                      value={opRef}
                      onChangeText={setOpRef}
                      placeholder="N° transaction..."
                      placeholderTextColor="#bbb"
                    />
                  </>
                )}
              </ScrollView>
              <View style={st.modalFoot}>
                <TouchableOpacity style={st.btnCancel} onPress={() => setShowAjoutOp(false)}>
                  <Text style={st.btnCancelText}>{tr('annuler', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    st.btnConfirm,
                    { backgroundColor: opType === 'ENTREE' ? '#16a34a' : '#dc2626' },
                    savingOp && { opacity: 0.6 },
                  ]}
                  onPress={saveOperation}
                  disabled={savingOp}
                >
                  {savingOp ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={st.btnConfirmText}>{tr('enregistrer', lang)}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4f8' },

  // Onglets
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1a56db' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a56db' },

  // Offline banner
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12, flex: 1 },

  container: { flex: 1 },

  // Hero état (fond sombre obligatoire)
  hero: {
    backgroundColor: '#081648',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 6 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  badgeFermee: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginVertical: 4,
  },
  badgeFermeeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // KPI état
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: '#dbeafe', borderRadius: 12, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 14, fontWeight: 'bold', color: '#1a56db' },
  kpiLabel: { fontSize: 10, color: '#666', marginTop: 2, textAlign: 'center' },

  // Boutons caisse
  caisseRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  caisseBtn: { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center' },
  caisseBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Total jour
  totalJourCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalJourLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  totalJourVal: { color: '#4ade80', fontSize: 20, fontWeight: 'bold' },

  sectionTitle: { fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 8 },

  // Paper card rows (ventes, ops)
  venteCard: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  opCardPaper: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  creditCardPaper: { marginBottom: 10, borderRadius: 14, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },

  venteHeure: { color: '#aaa', fontSize: 12 },
  badgeMode: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  badgeModeText: { fontSize: 12, color: '#1a56db', fontWeight: '600' },

  // Chip bar
  chipBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f0f4f8',
  },
  filterChipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  filterChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  pdfBtn: {
    backgroundColor: '#d97706',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 'auto',
  },
  pdfBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Crédit
  creditRestant: { fontWeight: 'bold', fontSize: 15, color: '#1a56db' },
  retardBadge: {
    backgroundColor: '#fce4ec',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  retardBadgeText: { color: '#dc2626', fontWeight: '700', fontSize: 11 },
  progressWrap: { marginTop: 10, marginBottom: 4 },
  progressBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#1a56db', borderRadius: 3 },
  progressText: { fontSize: 10, color: '#aaa', marginTop: 3 },
  creditActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btnVoir: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnVoirText: { color: '#1a56db', fontWeight: '600', fontSize: 13 },
  btnRegler: {
    flex: 2,
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  btnReglerText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Op montant
  opMontant: { fontWeight: 'bold', fontSize: 16 },
  opEntree: { color: '#16a34a' },
  opSortie: { color: '#dc2626' },

  // FAB
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1a56db' },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statsCard: {
    width: '47%',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
  },
  statsVal: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  statsLabel: { fontSize: 11, color: '#666', textAlign: 'center' },
  refreshBtn: {
    marginTop: 20,
    backgroundColor: '#1a56db',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  refreshBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 12, fontSize: 14 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 440 },
  modalFoot: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: {
    flex: 2,
    backgroundColor: '#1a56db',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Info card modal
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Versements
  versRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  versDate: { flex: 1, fontSize: 12, color: '#64748b' },
  versMontant: { fontWeight: '700', color: '#16a34a', fontSize: 13 },
  versMode: { fontSize: 11, color: '#888', marginTop: 2 },
  versSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Formulaire
  fieldLabel: { color: '#666', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fafafa',
  },
  chipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Toggle entrée/sortie
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  toggleBtnText: { fontWeight: '700', fontSize: 14, color: '#555' },

  // Utilitaires
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
