import React, { useEffect, useState, useCallback, useLayoutEffect, useRef } from 'react';
import {
  View, ScrollView, FlatList, StyleSheet, Alert, Modal,
  TouchableOpacity, KeyboardAvoidingView, Platform, RefreshControl, TextInput as RNTextInput,
} from 'react-native';
import { Text, ActivityIndicator, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Print from 'expo-print';
import {
  getCreditsNonRegles, getCreditsRegles, getCreditsEnRetard,
  getCaisseEtat, ouvrirCaisse, fermerCaisse,
  getOperationsJour, getOperationsParPeriode, ajouterEntreeCaisse, ajouterSortieCaisse,
  getStatsCaisseJour, getStatsCaisseParPeriode, getHistoriqueReglementsCredit,
  getComptes, transfererVersBanque, getReconciliationVendeurs,
} from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { MontantInput } from '../components/MontantInput';

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';

const toLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
};

const dateStr = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');
const dateHeure = (d?: string) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const estAujourdhui = (d: Date) => toLocalDate(d) === toLocalDate(new Date());
const dateLongue = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// ─── Types ────────────────────────────────────────────────────────────────────
type Onglet = 'etat' | 'credits' | 'operations' | 'stats' | 'reconciliation';
type FiltreCredit = 'EN_COURS' | 'REGLES' | 'EN_RETARD';
type FiltrePeriode = 'AUJOURD_HUI' | 'SEMAINE' | 'MOIS' | 'ANNEE';
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

const TYPES_OPERATION: { value: string; label: string }[] = [
  { value: '', label: 'Tous les types' },
  { value: 'OUVERTURE', label: 'Ouverture' },
  { value: 'FERMETURE', label: 'Fermeture' },
  { value: 'VENTE_COMPTANT', label: 'Vente comptant' },
  { value: 'VENTE_CREDIT', label: 'Vente crédit' },
  { value: 'REGLEMENT_CREDIT', label: 'Règlement crédit' },
  { value: 'ENTREE', label: 'Entrée' },
  { value: 'SORTIE', label: 'Sortie' },
  { value: 'PAIEMENT_FOURNISSEUR', label: 'Paiement fournisseur' },
  { value: 'PAIEMENT_EMPLOYE', label: 'Paiement employé' },
];

const TYPE_LABELS: Record<string, string> = {
  OUVERTURE: 'Ouverture', FERMETURE: 'Fermeture', VENTE_COMPTANT: 'Vente comptant',
  VENTE_CREDIT: 'Vente crédit', REGLEMENT_CREDIT: 'Règlement crédit', SORTIE: 'Sortie',
  ENTREE: 'Entrée', AJUSTEMENT: 'Ajustement', PAIEMENT_FOURNISSEUR: 'Paiement fournisseur',
  PAIEMENT_EMPLOYE: 'Paiement employé',
};

const isOpEntree = (type: string) => ['ENTREE', 'VENTE_COMPTANT', 'REGLEMENT_CREDIT', 'OUVERTURE'].includes(type);
const isOpSortie = (type: string) => ['SORTIE', 'PAIEMENT_FOURNISSEUR', 'PAIEMENT_EMPLOYE', 'FERMETURE'].includes(type);
const isOpCredit = (type: string) => type === 'VENTE_CREDIT';
const getOpColor = (type: string) => (isOpEntree(type) ? '#16a34a' : isOpSortie(type) ? '#dc2626' : isOpCredit(type) ? '#d97706' : '#64748b');
const getOpSign = (type: string) => (isOpSortie(type) ? '−' : '+');

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
  soldeAvant?: number;
  soldeApres?: number;
  clientNom?: string;
  numeroVente?: string;
  venteAnnulee?: boolean;
}

// ─── Picker générique (remplace les <select> Ionic) ────────────────────────────
interface PickerOption { label: string; value: any; sub?: string }
interface PickerConfig { visible: boolean; title: string; options: PickerOption[]; onSelect: (v: any) => void }
const EMPTY_PICKER: PickerConfig = { visible: false, title: '', options: [], onSelect: () => {} };

// ─── Composant ────────────────────────────────────────────────────────────────
export default function CaisseScreen() {
  const { lang } = useLang();
  const navigation = useNavigation<any>();
  const [onglet, setOnglet] = useState<Onglet>('etat');
  const [fromCache, setFromCache] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [etatCaisse, setEtatCaisse] = useState<any>(null);
  const [statsJour, setStatsJour] = useState<any>(null);
  // Bénéfice/perte du dernier mois clôturé — même endpoint et même calcul que
  // la page Caisse Ionic (getStatistiquesParPeriode sur le mois précédent
  // complet), pour afficher la même carte "Bénéfice net du mois" sur les 2
  // plateformes plutôt qu'un simple Entrées/Sorties du jour redondant avec
  // la carte "Caisse du jour" juste à côté.
  const [statsMois, setStatsMois] = useState<any>(null);
  const [moisAffiche, setMoisAffiche] = useState<Date>(new Date());

  // --- Nouvelle opération (inline, onglet État) ---
  const [opType, setOpType] = useState<TypeOp>('ENTREE');
  const [opMontant, setOpMontant] = useState(0);
  const [opMotif, setOpMotif] = useState('');
  const [opMode, setOpMode] = useState<ModeOperation>('ESPECES');
  const [opRef, setOpRef] = useState('');
  const [savingOp, setSavingOp] = useState(false);

  // --- Crédits ---
  const [credits, setCredits] = useState<CreditInfo[]>([]);
  const [creditsEnRetard, setCreditsEnRetard] = useState<CreditInfo[]>([]);
  const [filtreCredit, setFiltreCredit] = useState<FiltreCredit>('EN_COURS');
  const [loadingCredits, setLoadingCredits] = useState(false);
  const [refreshingCredits, setRefreshingCredits] = useState(false);

  // Le règlement de crédit ne se fait plus depuis la Caisse (uniquement depuis la page
  // dédiée "Crédits") : la Caisse affiche seulement la liste en lecture seule — groupée
  // par client pour les crédits en cours — pour ne pas avoir deux endroits différents
  // où encaisser un même crédit.
  const [selectedClientNom, setSelectedClientNom] = useState<string | null>(null);

  // Modal détail crédit (historique versements)
  const [showDetailCredit, setShowDetailCredit] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditInfo | null>(null);
  const [versements, setVersements] = useState<Operation[]>([]);
  const [loadingVersements, setLoadingVersements] = useState(false);

  // --- Opérations ---
  const [operations, setOperations] = useState<Operation[]>([]);
  const [operationsFiltrees, setOperationsFiltrees] = useState<Operation[]>([]);
  const [filtrePeriode, setFiltrePeriode] = useState<FiltrePeriode>('AUJOURD_HUI');
  const [opSearch, setOpSearch] = useState('');
  const [opTypeFilter, setOpTypeFilter] = useState('');
  const [loadingOps, setLoadingOps] = useState(false);
  const [refreshingOps, setRefreshingOps] = useState(false);
  const [showOpDetail, setShowOpDetail] = useState(false);
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);

  // --- Transfert vers banque ---
  const [showTransfert, setShowTransfert] = useState(false);
  const [comptes, setComptes] = useState<any[]>([]);
  const [transfertCompteId, setTransfertCompteId] = useState<number | null>(null);
  const [transfertMontant, setTransfertMontant] = useState(0);
  const [transfertMotif, setTransfertMotif] = useState('');
  const [transfertRef, setTransfertRef] = useState('');
  const [savingTransfert, setSavingTransfert] = useState(false);

  // --- Réconciliation caisse par vendeur (onglet dédié, lecture seule) ---
  const [dateReconciliation, setDateReconciliation] = useState<Date>(new Date());
  const [reconciliationVendeurs, setReconciliationVendeurs] = useState<any[]>([]);
  const [loadingReconciliation, setLoadingReconciliation] = useState(false);

  // --- Picker générique ---
  const [picker, setPicker] = useState<PickerConfig>(EMPTY_PICKER);
  const openPicker = (title: string, options: PickerOption[], onSelect: (v: any) => void) =>
    setPicker({ visible: true, title, options, onSelect });
  const closePicker = () => setPicker(EMPTY_PICKER);

  // ─── En-tête : bouton transfert vers banque (comme swap-horizontal-outline
  // d'Ionic), visible uniquement caisse ouverte ──────────────────────────────
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        (etatCaisse?.estOuverte || etatCaisse?.ouverte) ? (
          <TouchableOpacity onPress={openTransfertModal} style={{ marginRight: 14 }}>
            <MaterialCommunityIcons name="swap-horizontal" color="#fff" size={24} />
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, etatCaisse]);

  // ─── Refs toujours à jour ───────────────────────────────────────────────
  // chargerTout/chargerOperations sont appelées depuis useFocusEffect (voir plus
  // bas), qui — pour ne pas se redéclencher à chaque frappe dans un champ de
  // recherche ou à chaque changement de filtre — garde un callback figé au
  // montage. On lit donc l'état courant via ces refs plutôt que par fermeture
  // directe sur filtreCredit/opSearch/opTypeFilter/filtrePeriode, pour éviter
  // qu'un retour sur l'écran n'écrase la vue actuelle avec des données d'un
  // autre filtre (ex: écraser "Réglés" avec les crédits "En cours").
  const filtreCreditRef = useRef(filtreCredit);
  useEffect(() => { filtreCreditRef.current = filtreCredit; }, [filtreCredit]);
  const opSearchRef = useRef(opSearch);
  useEffect(() => { opSearchRef.current = opSearch; }, [opSearch]);
  const opTypeFilterRef = useRef(opTypeFilter);
  useEffect(() => { opTypeFilterRef.current = opTypeFilter; }, [opTypeFilter]);
  const filtrePeriodeRef = useRef(filtrePeriode);
  useEffect(() => { filtrePeriodeRef.current = filtrePeriode; }, [filtrePeriode]);

  // ─── Chargement initial (comme load() d'Ionic : tout en une fois) ─────────
  const chargerTout = useCallback(async () => {
    // Mois précédent COMPLET (mois clôturé), même calcul que loadStatsMois()
    // d'Ionic — pas le mois en cours (encore partiel, non comparable).
    const aujourdhui = new Date();
    const finMoisPrecedent = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0);
    const debutMoisPrecedent = new Date(finMoisPrecedent.getFullYear(), finMoisPrecedent.getMonth(), 1);
    const fmt = (d: Date) => d.toISOString().split('T')[0];

    try {
      const [resEtat, resStats, resCredits, resRetard, resStatsMois] = await Promise.all([
        getCaisseEtat().catch(() => ({ data: null })),
        getStatsCaisseJour().catch(() => ({ data: null })),
        getCreditsNonRegles().catch(() => ({ data: [] })),
        getCreditsEnRetard().catch(() => ({ data: [] })),
        getStatsCaisseParPeriode(fmt(debutMoisPrecedent), fmt(finMoisPrecedent)).catch(() => ({ data: null })),
      ]);
      const etat = resEtat.data?.caisse || resEtat.data?.data || resEtat.data;
      const stats = resStats.data?.statistiques || resStats.data?.data || resStats.data;
      const rawCredits = resCredits.data?.data || resCredits.data?.credits || resCredits.data || [];
      const rawRetard = resRetard.data?.data || resRetard.data?.creditsEnRetard || resRetard.data || [];
      const statsMoisData = resStatsMois.data?.statistiques || resStatsMois.data?.data || resStatsMois.data;
      setEtatCaisse(etat);
      setStatsJour(stats);
      setStatsMois(statsMoisData || null);
      setMoisAffiche(finMoisPrecedent);
      if (filtreCreditRef.current === 'EN_COURS') {
        setCredits(Array.isArray(rawCredits) ? rawCredits.filter((c: any) => !c.venteAnnulee) : []);
      }
      setCreditsEnRetard(Array.isArray(rawRetard) ? rawRetard.filter((c: any) => !c.venteAnnulee) : []);
      setFromCache(false);
      sauvegarderCache('caisse_tout', { etat, stats, credits: rawCredits, retard: rawRetard, statsMois: statsMoisData }).catch(() => {});
    } catch {
      const cached = await lireCache<any>('caisse_tout');
      if (cached.length > 0) {
        const c = cached[0] as any;
        setEtatCaisse(c.etat || null);
        setStatsJour(c.stats || null);
        setStatsMois(c.statsMois || null);
        setMoisAffiche(finMoisPrecedent);
        if (filtreCreditRef.current === 'EN_COURS') setCredits(c.credits || []);
        setCreditsEnRetard(c.retard || []);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
    setLoadingInitial(false);
    setRefreshing(false);
  }, []);

  // ─── Chargement crédits (changement de filtre) ────────────────────────────
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
      } else if (filtre === 'MOIS') {
        const debutMois = toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
        res = await getOperationsParPeriode(debutMois, toLocalDate(now)).catch(() => ({ data: [] }));
      } else {
        const debutAnnee = toLocalDate(new Date(now.getFullYear(), 0, 1));
        const finAnnee = toLocalDate(new Date(now.getFullYear(), 11, 31));
        res = await getOperationsParPeriode(debutAnnee, finAnnee).catch(() => ({ data: [] }));
      }
      const raw = res.data?.data || res.data?.operations || res.data || [];
      const liste = Array.isArray(raw) ? raw : [];
      setOperations(liste);
      appliquerFiltresOp(liste, opSearchRef.current, opTypeFilterRef.current);
    } catch { }
    setLoadingOps(false);
    setRefreshingOps(false);
  }, []);

  // ─── Chargement réconciliation caisse par vendeur (onglet dédié, lecture
  // seule) — un vendeur par carte : ventes espèces/crédit du jour + règlements
  // crédit encaissés en espèces + total à remettre en caisse. ────────────────
  const chargerReconciliation = useCallback(async (date: Date) => {
    setLoadingReconciliation(true);
    try {
      const res = await getReconciliationVendeurs(toLocalDate(date));
      const raw = res.data?.reconciliation || [];
      setReconciliationVendeurs(Array.isArray(raw) ? raw : []);
    } catch {
      setReconciliationVendeurs([]);
    }
    setLoadingReconciliation(false);
  }, []);

  // BUG FIX (audit fournisseur/caisse/stock) : la Caisse est un écran d'onglet (Tab.Navigator),
  // jamais démonté quand on navigue ailleurs (ex: annuler un achat/paiement fournisseur depuis
  // Fournisseurs) — sans useFocusEffect, elle ne se rechargeait qu'au montage initial et
  // affichait donc un solde/des crédits périmés jusqu'à un pull-to-refresh manuel. chargerTout/
  // chargerOperations sont désormais des callbacks stables (lisent l'état courant via des refs,
  // voir plus haut) : on peut les rappeler à chaque focus sans provoquer de rechargement
  // parasite à chaque frappe dans un champ de recherche ou changement de filtre.
  useFocusEffect(
    useCallback(() => {
      chargerTout();
      chargerOperations(filtrePeriodeRef.current);
    }, [chargerTout, chargerOperations])
  );

  // Onglet Réconciliation : chargement au montage de l'onglet et à chaque
  // changement de date (pas besoin de refocus, l'utilisateur reste sur l'écran).
  useEffect(() => {
    if (onglet === 'reconciliation') {
      chargerReconciliation(dateReconciliation);
    }
  }, [onglet, dateReconciliation, chargerReconciliation]);

  const appliquerFiltresOp = (liste: Operation[], search: string, typeFilter: string) => {
    const term = search.trim().toLowerCase();
    const filtered = liste.filter((op) => {
      if (typeFilter && op.type !== typeFilter) return false;
      if (term && ![op.motif, op.clientNom, op.utilisateurNom, op.numeroVente]
        .filter(Boolean).some((v) => `${v}`.toLowerCase().includes(term))) return false;
      return true;
    });
    setOperationsFiltrees(filtered);
  };

  useEffect(() => { appliquerFiltresOp(operations, opSearch, opTypeFilter); }, [opSearch, opTypeFilter]);

  const totalOps = operationsFiltrees.reduce(
    (s, op) => (isOpSortie(op.type || '') ? s - (op.montant || 0) : s + (op.montant || 0)),
    0
  );

  // ─── Changement d'onglet / filtres ────────────────────────────────────────
  const switchOnglet = (o: Onglet) => setOnglet(o);
  const changeFiltreCredit = (f: FiltreCredit) => { setFiltreCredit(f); chargerCredits(f); };
  const changeFiltrePeriode = (f: FiltrePeriode) => { setFiltrePeriode(f); chargerOperations(f); };
  const changerJourReconciliation = (delta: number) => {
    setDateReconciliation((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  };

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

  // ─── Détail crédit (historique versements) ────────────────────────────────
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

  // ─── Crédits en cours regroupés par client, lecture seule (même principe qu'Angular/Ionic) ──
  const creditsGroupesParClient = credits.length
    ? Array.from(
        credits.reduce((map, c) => {
          const nom = `${c.clientNom || 'Client'}${c.clientPrenom ? ' ' + c.clientPrenom : ''}`;
          if (!map.has(nom)) map.set(nom, [] as CreditInfo[]);
          map.get(nom)!.push(c);
          return map;
        }, new Map<string, CreditInfo[]>())
      )
        .map(([nom, liste]) => ({
          nom,
          count: liste.length,
          totalTotal: liste.reduce((s, c) => s + (c.montantTotal || 0), 0),
          totalVerse: liste.reduce((s, c) => s + (c.montantVerse || 0), 0),
          totalRestant: liste.reduce((s, c) => s + (c.montantRestant || 0), 0),
          enRetard: liste.some((c) => c.enRetard),
          credits: liste,
        }))
        .sort((a, b) => b.totalRestant - a.totalRestant)
    : [];

  const selectedClientCredits = selectedClientNom
    ? credits.filter((c) => `${c.clientNom || 'Client'}${c.clientPrenom ? ' ' + c.clientPrenom : ''}` === selectedClientNom)
    : [];

  // ─── Nouvelle opération (inline, onglet État) ─────────────────────────────
  const saveOperation = async () => {
    const montant = opMontant;
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
      setOpMontant(0);
      setOpMotif('');
      setOpRef('');
      if (!res.offline) {
        chargerOperations(filtrePeriode);
        chargerTout();
      }
      Alert.alert('OK', res.offline
        ? 'Sauvegardé hors ligne — synchronisation au retour connexion'
        : `${opType === 'ENTREE' ? tr('entree', lang) : tr('sortie', lang)} enregistrée`
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
        chargerTout();
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
        chargerTout();
      }
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de fermer la caisse');
    }
  };

  // ─── Transfert vers banque ─────────────────────────────────────────────────
  const openTransfertModal = async () => {
    if (!(etatCaisse?.estOuverte || etatCaisse?.ouverte)) {
      Alert.alert(tr('erreur', lang), 'La caisse doit être ouverte pour transférer');
      return;
    }
    try {
      const res = await getComptes();
      const liste = res.data?.data || res.data || [];
      setComptes(Array.isArray(liste) ? liste.filter((c: any) => c.actif !== false) : []);
    } catch {
      setComptes([]);
    }
    setTransfertCompteId(null);
    setTransfertMontant(0);
    setTransfertMotif('');
    setTransfertRef('');
    setShowTransfert(true);
  };

  const validerTransfert = async () => {
    const montant = transfertMontant;
    if (!transfertCompteId || !montant || !transfertMotif.trim()) {
      Alert.alert(tr('erreur', lang), 'Compte, montant et motif obligatoires');
      return;
    }
    setSavingTransfert(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const userId = raw ? JSON.parse(raw)?.id : undefined;
      await transfererVersBanque({
        compteId: transfertCompteId,
        montant,
        motif: transfertMotif.trim(),
        utilisateurId: userId,
        reference: transfertRef.trim() || undefined,
      });
      setShowTransfert(false);
      chargerTout();
      Alert.alert('OK', 'Transfert effectué');
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Transfert impossible');
    }
    setSavingTransfert(false);
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

  const caisseOuverte = !!(etatCaisse?.estOuverte || etatCaisse?.ouverte);
  const soldeActuel = etatCaisse?.soldeActuel ?? etatCaisse?.solde ?? etatCaisse?.soldeCaisse ?? 0;

  // ─── Cartes KPI (mêmes calculs que la page Caisse Ionic/Angular) ─────────
  const profitNetMois = statsMois?.soldeNetPeriode ?? 0;
  const isPerteMois = profitNetMois < 0;
  const labelBilanceMois = isPerteMois ? 'Perte nette' : 'Bénéfice net';
  const nomMoisCourant = moisAffiche.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const montantTotalCredits = credits.reduce((sum, c) => sum + (c.montantRestant || 0), 0);

  // ─── Barre d'onglets ─────────────────────────────────────────────────────
  const ONGLETS: { key: Onglet; label: string }[] = [
    { key: 'etat', label: tr('solde_actuel', lang) },
    { key: 'credits', label: tr('credits', lang) },
    { key: 'operations', label: 'Opérations' },
    { key: 'stats', label: 'Stats' },
    { key: 'reconciliation', label: 'Réconciliation' },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={st.root}>
      {loadingInitial ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color="#1a56db" />
      ) : (
        <>
          {/* Cartes couleur — mêmes 4 chiffres et mêmes endpoints que la page
              Caisse Ionic (Solde actuel / Caisse du jour / Bénéfice net du
              mois clôturé / Crédits clients), au lieu d'Entrées/Sorties du
              jour qui redoublonnaient avec "Caisse du jour". */}
          <View style={st.colorCards}>
            <View style={[st.colorCard, { backgroundColor: '#dbeafe' }]}>
              <MaterialCommunityIcons name="wallet-outline" size={18} color="#1d4ed8" />
              <Text style={[st.ccLabel, { color: '#1d4ed8' }]}>Solde actuel</Text>
              <Text style={[st.ccValue, { color: '#1d4ed8' }]} numberOfLines={1}>{money(soldeActuel)}</Text>
              <Text style={[st.ccSub, { color: '#1d4ed8' }]}>{caisseOuverte ? 'Ouverte' : 'Fermée'}</Text>
            </View>
            <View style={[st.colorCard, { backgroundColor: '#dcfce7' }]}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color="#15803d" />
              <Text style={[st.ccLabel, { color: '#15803d' }]}>Caisse du jour</Text>
              <Text style={[st.ccValue, { color: '#15803d' }]} numberOfLines={1}>{money(statsJour?.soldeNetPeriode || 0)}</Text>
              <Text style={[st.ccSub, { color: '#15803d' }]}>↑ {money(statsJour?.totalEntrees || 0)} · ↓ {money(statsJour?.totalSorties || 0)}</Text>
            </View>
            <View style={[st.colorCard, { backgroundColor: isPerteMois ? '#fee2e2' : '#ede9fe' }]}>
              <MaterialCommunityIcons name={isPerteMois ? 'trending-down' : 'trending-up'} size={18} color={isPerteMois ? '#b91c1c' : '#6d28d9'} />
              <Text style={[st.ccLabel, { color: isPerteMois ? '#b91c1c' : '#6d28d9' }]} numberOfLines={1}>{labelBilanceMois} · {nomMoisCourant}</Text>
              <Text style={[st.ccValue, { color: isPerteMois ? '#b91c1c' : '#6d28d9' }]} numberOfLines={1}>{isPerteMois ? '-' : '+'}{money(Math.abs(profitNetMois))}</Text>
              <Text style={[st.ccSub, { color: isPerteMois ? '#b91c1c' : '#6d28d9' }]}>Mois clôturé</Text>
            </View>
            <View style={[st.colorCard, { backgroundColor: '#ffedd5' }]}>
              <MaterialCommunityIcons name="credit-card-outline" size={18} color="#c2410c" />
              <Text style={[st.ccLabel, { color: '#c2410c' }]}>Crédits clients</Text>
              <Text style={[st.ccValue, { color: '#c2410c' }]} numberOfLines={1}>{credits.length}</Text>
              <Text style={[st.ccSub, { color: '#c2410c' }]} numberOfLines={1}>Reste à payer : {money(montantTotalCredits)}</Text>
            </View>
          </View>

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


          {/* ════════════ ONGLET ÉTAT ════════════ */}
          {onglet === 'etat' && (
            <ScrollView
              style={st.container}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); chargerTout(); }} colors={['#1a56db']} />}
            >
              {/* Carte caisse */}
              <View style={st.mobileCard}>
                <View style={st.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.cardTitleLg}>{etatCaisse?.numeroCaisse || 'Caisse principale'}</Text>
                    <Text style={st.cardSubtitle}>Ouverte : {etatCaisse?.dateOuverture ? dateStr(etatCaisse.dateOuverture) : '-'}</Text>
                  </View>
                  <View style={[st.badgeEtat, { backgroundColor: caisseOuverte ? '#dcfce7' : '#f1f5f9' }]}>
                    <Text style={[st.badgeEtatText, { color: caisseOuverte ? '#16a34a' : '#64748b' }]}>
                      {caisseOuverte ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>

                {etatCaisse && (
                  <View style={st.twoCols}>
                    <View style={st.statCard}>
                      <Text style={st.statLabel}>Entrées totales</Text>
                      <Text style={[st.statValue, { color: '#16a34a' }]}>{money(etatCaisse.totalEntrees || 0)}</Text>
                    </View>
                    <View style={st.statCard}>
                      <Text style={st.statLabel}>Sorties totales</Text>
                      <Text style={[st.statValue, { color: '#dc2626' }]}>{money(etatCaisse.totalSorties || 0)}</Text>
                    </View>
                  </View>
                )}

                {!caisseOuverte ? (
                  <TouchableOpacity
                    style={[st.bigBtn, { backgroundColor: '#16a34a' }]}
                    onPress={() =>
                      Alert.alert(tr('ouvrir_caisse', lang), "Confirmer l'ouverture de la caisse pour aujourd'hui ?", [
                        { text: tr('annuler', lang), style: 'cancel' },
                        { text: 'Ouvrir', onPress: handleOuvrirCaisse },
                      ])
                    }
                  >
                    <MaterialCommunityIcons name="lock-open-outline" size={18} color="#fff" />
                    <Text style={st.bigBtnText}>{tr('ouvrir_caisse', lang)}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[st.bigBtn, { backgroundColor: '#dc2626' }]}
                    onPress={() =>
                      Alert.alert('⚠️ Fermer la caisse', `Solde actuel : ${money(soldeActuel)}\n\nLa caisse sera fermée et les opérations ne seront plus possibles jusqu'à la réouverture.`, [
                        { text: tr('annuler', lang), style: 'cancel' },
                        { text: 'Confirmer la fermeture', style: 'destructive', onPress: handleFermerCaisse },
                      ])
                    }
                  >
                    <MaterialCommunityIcons name="lock-outline" size={18} color="#fff" />
                    <Text style={st.bigBtnText}>{tr('fermer_caisse', lang)}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Nouvelle opération (intégré, comme .form-panel Ionic) */}
              <View style={st.formPanel}>
                <Text style={st.cardTitleLg}>Nouvelle opération</Text>

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
                <MontantInput
                  style={st.fieldInput}
                  value={opMontant}
                  onChangeValue={setOpMontant}
                  placeholder="0"
                  placeholderTextColor="#bbb"
                />

                <Text style={st.fieldLabel}>Motif</Text>
                <RNTextInput
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
                    <RNTextInput
                      style={st.fieldInput}
                      value={opRef}
                      onChangeText={setOpRef}
                      placeholder="N° transaction..."
                      placeholderTextColor="#bbb"
                    />
                  </>
                )}

                <TouchableOpacity
                  style={[st.bigBtn, { backgroundColor: '#1a56db', marginTop: 16 }, (!caisseOuverte || savingOp) && { opacity: 0.5 }]}
                  onPress={saveOperation}
                  disabled={!caisseOuverte || savingOp}
                >
                  {savingOp
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <><MaterialCommunityIcons name="check" size={18} color="#fff" /><Text style={st.bigBtnText}>{tr('enregistrer', lang)}</Text></>
                  }
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* ════════════ ONGLET CRÉDITS ════════════ */}
          {onglet === 'credits' && (
            <ScrollView
              style={st.container}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={refreshingCredits} onRefresh={() => { setRefreshingCredits(true); chargerCredits(filtreCredit); }} colors={['#1a56db']} />}
            >
              {/* Chips filtre + Imprimer */}
              <View style={st.chipBarInline}>
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
                {credits.length > 0 && (
                  <TouchableOpacity style={st.pdfBtnOutline} onPress={genererPdfCredits}>
                    <MaterialCommunityIcons name="printer-outline" size={14} color="#d97706" />
                    <Text style={st.pdfBtnOutlineText}>Imprimer</Text>
                  </TouchableOpacity>
                )}
              </View>

              {creditsEnRetard.length > 0 && (
                <View style={st.retardBanner}>
                  <Text style={st.retardBannerText}>Crédits en retard</Text>
                  <View style={st.retardBannerBadge}><Text style={st.retardBannerBadgeText}>{creditsEnRetard.length}</Text></View>
                </View>
              )}

              {/* Lecture seule : le règlement se fait uniquement depuis la page "Crédits" dédiée. */}
              {loadingCredits ? (
                <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#1a56db" />
              ) : credits.length === 0 ? (
                <View style={st.emptyState}>
                  <MaterialCommunityIcons name="credit-card-check-outline" size={64} color="#cbd5e1" />
                  <Text style={st.emptyText}>Aucun crédit dans cette catégorie</Text>
                </View>
              ) : filtreCredit === 'EN_COURS' ? (
                creditsGroupesParClient.map((groupe) => (
                  <Card key={groupe.nom} style={[st.creditCardPaper, groupe.enRetard && { borderLeftWidth: 3, borderLeftColor: '#dc2626' }]}>
                    <TouchableOpacity onPress={() => setSelectedClientNom(groupe.nom)}>
                      <Card.Content>
                        <View style={st.cardRow}>
                          <View style={[st.avatar, { backgroundColor: groupe.enRetard ? '#fee2e2' : '#dbeafe' }]}>
                            <MaterialCommunityIcons name="account-clock" size={20} color={groupe.enRetard ? '#dc2626' : '#1a56db'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.cardName}>{groupe.nom}</Text>
                            <Text style={st.cardSub}>{groupe.count} crédit{groupe.count > 1 ? 's' : ''}</Text>
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
                        </View>
                        <View style={st.rowBetween}>
                          <Text style={st.muted}>Total: {money(groupe.totalTotal)}</Text>
                          <Text style={[st.creditRestant, groupe.enRetard && { color: '#dc2626' }]}>Reste: {money(groupe.totalRestant)}</Text>
                        </View>
                        {groupe.enRetard && (
                          <View style={[st.badge, { backgroundColor: '#fee2e2', alignSelf: 'flex-start', marginTop: 6 }]}>
                            <Text style={[st.badgeText, { color: '#dc2626' }]}>En retard</Text>
                          </View>
                        )}
                      </Card.Content>
                    </TouchableOpacity>
                  </Card>
                ))
              ) : (
                credits.map((c) => {
                  const pct = c.montantTotal > 0 ? Math.min(100, Math.round((c.montantVerse / c.montantTotal) * 100)) : 0;
                  return (
                    <Card key={c.venteId} style={[st.creditCardPaper, c.enRetard && { borderLeftWidth: 3, borderLeftColor: '#dc2626' }]}>
                      <Card.Content>
                        <View style={st.cardRow}>
                          <View style={[st.avatar, { backgroundColor: c.enRetard ? '#fee2e2' : '#dbeafe' }]}>
                            <MaterialCommunityIcons name="account-clock" size={20} color={c.enRetard ? '#dc2626' : '#1a56db'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={st.cardName}>
                              {c.clientNom}{c.clientPrenom ? ' ' + c.clientPrenom : ''}
                            </Text>
                            {c.clientTelephone ? <Text style={st.cardSub}>{c.clientTelephone}</Text> : null}
                            <Text style={st.cardSub}>{c.numeroVente}</Text>
                          </View>
                          <TouchableOpacity onPress={() => openDetailCredit(c)} style={{ padding: 4 }}>
                            <MaterialCommunityIcons name="eye-outline" size={18} color="#64748b" />
                          </TouchableOpacity>
                        </View>

                        <View style={st.rowBetween}>
                          <Text style={st.muted}>Total: {money(c.montantTotal)}</Text>
                          <Text style={[st.creditRestant, c.enRetard && { color: '#dc2626' }, c.estReglee && { color: '#16a34a' }]}>
                            {c.estReglee ? 'Réglé' : `Reste: ${money(c.montantRestant)}`}
                          </Text>
                        </View>

                        {!c.estReglee && (
                          <View style={st.progressWrap}>
                            <View style={st.progressBg}>
                              <View style={[st.progressFill, c.enRetard && { backgroundColor: '#dc2626' }, { width: `${pct}%` as any }]} />
                            </View>
                          </View>
                        )}

                        <View style={[st.badge, { backgroundColor: c.estReglee ? '#dcfce7' : c.enRetard ? '#fee2e2' : '#fef3c7', alignSelf: 'flex-start', marginTop: 6 }]}>
                          <Text style={[st.badgeText, { color: c.estReglee ? '#16a34a' : c.enRetard ? '#dc2626' : '#d97706' }]}>
                            {c.estReglee ? 'Réglé' : c.enRetard ? 'En retard' : 'En cours'}
                          </Text>
                        </View>
                      </Card.Content>
                    </Card>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* ════════════ ONGLET OPÉRATIONS ════════════ */}
          {onglet === 'operations' && (
            <View style={st.container}>
              {/* Période rapide */}
              <View style={st.periodBar}>
                {(['AUJOURD_HUI', 'SEMAINE', 'MOIS', 'ANNEE'] as FiltrePeriode[]).map((f) => {
                  const labels: Record<FiltrePeriode, string> = {
                    AUJOURD_HUI: "Aujourd'hui", SEMAINE: 'Semaine', MOIS: 'Mois', ANNEE: 'Année',
                  };
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[st.periodBtn, filtrePeriode === f && st.periodBtnActive]}
                      onPress={() => changeFiltrePeriode(f)}
                    >
                      <Text style={[st.periodBtnText, filtrePeriode === f && st.periodBtnTextActive]}>{labels[f]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Recherche + filtre type */}
              <View style={st.opFilters}>
                <RNTextInput
                  style={st.opSearchInput}
                  placeholder="Motif, client..."
                  value={opSearch}
                  onChangeText={setOpSearch}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={st.opTypeSelect}
                  onPress={() => openPicker(
                    'Type d\'opération',
                    TYPES_OPERATION.map((t) => ({ label: t.label, value: t.value })),
                    setOpTypeFilter
                  )}
                >
                  <Text style={st.opTypeSelectText} numberOfLines={1}>
                    {TYPES_OPERATION.find((t) => t.value === opTypeFilter)?.label || 'Tous les types'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color="#888" />
                </TouchableOpacity>
              </View>

              {operationsFiltrees.length > 0 && (
                <View style={st.opSummary}>
                  <Text style={st.muted}>{operationsFiltrees.length} opération(s)</Text>
                  <Text style={[st.opSummaryVal, { color: totalOps >= 0 ? '#16a34a' : '#dc2626' }]}>
                    {totalOps >= 0 ? '+' : ''}{money(totalOps)}
                  </Text>
                </View>
              )}

              {loadingOps ? (
                <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
              ) : (
                <FlatList
                  data={operationsFiltrees}
                  keyExtractor={(op, i) => String(op.id ?? i)}
                  contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                  refreshControl={<RefreshControl refreshing={refreshingOps} onRefresh={() => { setRefreshingOps(true); chargerOperations(filtrePeriode); }} colors={['#1a56db']} />}
                  ListEmptyComponent={
                    <View style={st.emptyState}>
                      <MaterialCommunityIcons name="swap-horizontal" size={64} color="#cbd5e1" />
                      <Text style={st.emptyText}>Aucune opération trouvée</Text>
                    </View>
                  }
                  renderItem={({ item: op }) => {
                    const color = getOpColor(op.type || '');
                    return (
                      <TouchableOpacity onPress={() => { setSelectedOp(op); setShowOpDetail(true); }}>
                        <Card style={[st.opCardPaper, op.venteAnnulee && { opacity: 0.55 }]}>
                          <Card.Content style={st.cardRow}>
                            <View style={[st.opIndicator, { backgroundColor: color }]} />
                            <View style={{ flex: 1 }}>
                              <View style={st.rowBetween}>
                                <View style={[st.badge, { backgroundColor: color + '22' }]}>
                                  <Text style={[st.badgeText, { color }]}>{TYPE_LABELS[op.type || ''] || op.type}</Text>
                                </View>
                                <Text style={[st.opMontant, { color }]}>{getOpSign(op.type || '')} {money(Math.abs(op.montant))}</Text>
                              </View>
                              {(op.clientNom || op.motif) ? (
                                <Text style={st.cardSub} numberOfLines={1}>
                                  {op.clientNom ? `${op.clientNom}${op.motif ? ' · ' + op.motif : ''}` : op.motif}
                                </Text>
                              ) : null}
                              {op.soldeAvant !== undefined && (
                                <Text style={st.opSoldes}>Avant: {money(op.soldeAvant)} → Après: {money(op.soldeApres || 0)}</Text>
                              )}
                              <Text style={st.cardSub}>
                                {dateStr(op.dateOperation)}{op.modePaiement ? ` · ${op.modePaiement.replace('_', ' ')}` : ''} · {op.utilisateurNom || 'Système'}
                              </Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={18} color="#cbd5e1" />
                          </Card.Content>
                        </Card>
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </View>
          )}

          {/* ════════════ ONGLET STATS ════════════ */}
          {onglet === 'stats' && (
            <ScrollView
              style={st.container}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); chargerTout(); }} colors={['#1a56db']} />}
            >
              {statsJour ? (
                <>
                  <View style={st.statsGrid}>
                    <View style={[st.statsCard, { backgroundColor: '#dbeafe' }]}>
                      <MaterialCommunityIcons name="cash" size={20} color="#1d4ed8" />
                      <Text style={[st.statsVal, { color: '#1d4ed8' }]}>{money(statsJour.totalVentesComptant || 0)}</Text>
                      <Text style={st.statsLabel}>Ventes comptant</Text>
                    </View>
                    <View style={[st.statsCard, { backgroundColor: '#fef3c7' }]}>
                      <MaterialCommunityIcons name="card-outline" size={20} color="#b45309" />
                      <Text style={[st.statsVal, { color: '#b45309' }]}>{money(statsJour.totalNouveauxCredits || 0)}</Text>
                      <Text style={st.statsLabel}>Nouveaux crédits</Text>
                    </View>
                    <View style={[st.statsCard, { backgroundColor: '#dcfce7' }]}>
                      <MaterialCommunityIcons name="check-circle-outline" size={20} color="#15803d" />
                      <Text style={[st.statsVal, { color: '#15803d' }]}>{money(statsJour.totalReglementsCredit || 0)}</Text>
                      <Text style={st.statsLabel}>Règlements</Text>
                    </View>
                    <View style={[st.statsCard, { backgroundColor: '#fee2e2' }]}>
                      <MaterialCommunityIcons name="arrow-down-circle-outline" size={20} color="#b91c1c" />
                      <Text style={[st.statsVal, { color: '#b91c1c' }]}>{money(statsJour.totalSorties || 0)}</Text>
                      <Text style={st.statsLabel}>Sorties</Text>
                    </View>
                  </View>

                  <View style={[st.formPanel, { marginTop: 12 }]}>
                    <Text style={st.cardTitleLg}>Situation crédits</Text>
                    <View style={st.infoRow}><Text style={st.infoLabel}>Crédits en cours</Text><Text style={st.infoVal}>{credits.length}</Text></View>
                    <View style={st.infoRow}><Text style={st.infoLabel}>En retard</Text><Text style={[st.infoVal, { color: '#dc2626' }]}>{creditsEnRetard.length}</Text></View>
                    <View style={st.infoRow}><Text style={st.infoLabel}>Montant restant</Text><Text style={[st.infoVal, { color: '#d97706', fontWeight: 'bold' }]}>{money(credits.reduce((s, c) => s + (c.montantRestant || 0), 0))}</Text></View>
                  </View>

                  <View style={[st.colorCardFull, { backgroundColor: (statsJour.soldeNetPeriode || 0) >= 0 ? '#dcfce7' : '#fee2e2', marginTop: 12 }]}>
                    <MaterialCommunityIcons name="trending-up" size={20} color={(statsJour.soldeNetPeriode || 0) >= 0 ? '#15803d' : '#b91c1c'} />
                    <Text style={[st.ccLabel, { color: (statsJour.soldeNetPeriode || 0) >= 0 ? '#15803d' : '#b91c1c' }]}>Bilan net du jour</Text>
                    <Text style={[st.ccValue, { color: (statsJour.soldeNetPeriode || 0) >= 0 ? '#15803d' : '#b91c1c' }]}>{money(statsJour.soldeNetPeriode || 0)}</Text>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', marginTop: 60 }}>
                  <MaterialCommunityIcons name="chart-bar" size={64} color="#cbd5e1" />
                  <Text style={st.emptyText}>Aucune statistique disponible</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* ════════════ ONGLET RÉCONCILIATION (par vendeur, lecture seule) ════════════ */}
          {onglet === 'reconciliation' && (
            <ScrollView
              style={st.container}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={loadingReconciliation} onRefresh={() => chargerReconciliation(dateReconciliation)} colors={['#1a56db']} />}
            >
              {/* Sélecteur de date */}
              <View style={st.dateNavBar}>
                <TouchableOpacity style={st.dateNavBtn} onPress={() => changerJourReconciliation(-1)}>
                  <MaterialCommunityIcons name="chevron-left" size={22} color="#1a56db" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={st.dateNavLabel} numberOfLines={1}>{dateLongue(dateReconciliation)}</Text>
                  {!estAujourdhui(dateReconciliation) && (
                    <TouchableOpacity onPress={() => setDateReconciliation(new Date())}>
                      <Text style={st.dateNavToday}>Revenir à aujourd'hui</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[st.dateNavBtn, estAujourdhui(dateReconciliation) && { opacity: 0.3 }]}
                  onPress={() => !estAujourdhui(dateReconciliation) && changerJourReconciliation(1)}
                  disabled={estAujourdhui(dateReconciliation)}
                >
                  <MaterialCommunityIcons name="chevron-right" size={22} color="#1a56db" />
                </TouchableOpacity>
              </View>

              {/* Liste réconciliation par vendeur — lecture seule, aucune action */}
              {loadingReconciliation ? (
                <ActivityIndicator style={{ marginTop: 24 }} size="large" color="#1a56db" />
              ) : reconciliationVendeurs.length === 0 ? (
                <View style={st.emptyState}>
                  <MaterialCommunityIcons name="account-cash-outline" size={64} color="#cbd5e1" />
                  <Text style={st.emptyText}>Aucune activité vendeur ce jour</Text>
                </View>
              ) : (
                reconciliationVendeurs.map((v) => (
                  <Card key={v.vendeurId} style={st.creditCardPaper}>
                    <Card.Content>
                      <View style={st.cardRow}>
                        <View style={[st.avatar, { backgroundColor: '#dbeafe' }]}>
                          <MaterialCommunityIcons name="account-cash-outline" size={20} color="#1a56db" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={st.cardName}>{v.vendeurNom}</Text>
                          <Text style={st.cardSub}>{v.nombreVentes} vente{v.nombreVentes > 1 ? 's' : ''}</Text>
                        </View>
                      </View>

                      <View style={st.infoRow}>
                        <Text style={st.infoLabel}>Ventes espèces</Text>
                        <Text style={st.infoVal}>{money(v.totalVentesEspeces)}</Text>
                      </View>
                      <View style={st.infoRow}>
                        <Text style={st.infoLabel}>Ventes crédit</Text>
                        <Text style={st.infoVal}>{money(v.totalVentesCredit)}</Text>
                      </View>
                      <View style={[st.infoRow, { borderBottomWidth: 0 }]}>
                        <Text style={st.infoLabel}>Règlements crédit encaissés</Text>
                        <Text style={[st.infoVal, { color: '#16a34a' }]}>{money(v.totalReglementsCreditEspeces)}</Text>
                      </View>

                      <View style={st.reconciliationTotalBox}>
                        <Text style={st.reconciliationTotalLabel}>Total à remettre</Text>
                        <Text style={st.reconciliationTotalValue}>{money(v.totalAiRemettre)}</Text>
                      </View>
                    </Card.Content>
                  </Card>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* ══════ MODAL DÉTAIL CRÉDIT (historique versements) ══════ */}
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
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════ MODAL : CRÉDITS D'UN CLIENT (lecture seule, onglet Crédits en cours) ══════ */}
      <Modal visible={!!selectedClientNom} animationType="slide" transparent onRequestClose={() => setSelectedClientNom(null)}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.handle} />
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>{selectedClientNom}</Text>
              <TouchableOpacity onPress={() => setSelectedClientNom(null)}>
                <Text style={{ fontSize: 22, color: '#666' }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={st.modalBody}>
              {selectedClientCredits.map((c) => (
                <Card key={c.venteId} style={[st.creditCardPaper, c.enRetard && { borderLeftWidth: 3, borderLeftColor: '#dc2626' }]}>
                  <Card.Content>
                    <View style={st.rowBetween}>
                      <Text style={st.cardName}>{c.numeroVente}</Text>
                      <View style={[st.badge, { backgroundColor: c.enRetard ? '#fee2e2' : '#fef3c7' }]}>
                        <Text style={[st.badgeText, { color: c.enRetard ? '#dc2626' : '#d97706' }]}>{c.enRetard ? 'En retard' : 'En cours'}</Text>
                      </View>
                    </View>
                    <View style={st.rowBetween}>
                      <Text style={st.muted}>Versé: {money(c.montantVerse)}</Text>
                      <Text style={[st.creditRestant, c.enRetard && { color: '#dc2626' }]}>Reste: {money(c.montantRestant)}</Text>
                    </View>
                  </Card.Content>
                </Card>
              ))}
            </ScrollView>
            <View style={st.modalFoot}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setSelectedClientNom(null)}>
                <Text style={st.btnCancelText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════ MODAL DÉTAIL OPÉRATION ══════ */}
      <Modal visible={showOpDetail} animationType="slide" transparent onRequestClose={() => setShowOpDetail(false)}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.handle} />
            <View style={[st.modalHead, { backgroundColor: getOpColor(selectedOp?.type || '') }]}>
              <Text style={[st.modalTitle, { color: '#fff' }]}>{TYPE_LABELS[selectedOp?.type || ''] || selectedOp?.type}</Text>
              <TouchableOpacity onPress={() => setShowOpDetail(false)}>
                <Text style={{ fontSize: 22, color: '#fff' }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={st.modalBody}>
              {selectedOp && (
                <View style={st.infoCard}>
                  <View style={st.infoRow}>
                    <Text style={st.infoLabel}>Montant</Text>
                    <Text style={[st.infoVal, { fontWeight: 'bold', color: getOpColor(selectedOp.type || '') }]}>
                      {getOpSign(selectedOp.type || '')} {money(selectedOp.montant)}
                    </Text>
                  </View>
                  <View style={st.infoRow}><Text style={st.infoLabel}>Date / Heure</Text><Text style={st.infoVal}>{dateHeure(selectedOp.dateOperation)}</Text></View>
                  {selectedOp.soldeAvant !== undefined && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>Solde avant</Text><Text style={st.infoVal}>{money(selectedOp.soldeAvant)}</Text></View>
                  )}
                  {selectedOp.soldeApres !== undefined && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>Solde après</Text><Text style={st.infoVal}>{money(selectedOp.soldeApres)}</Text></View>
                  )}
                  {selectedOp.clientNom && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>Client</Text><Text style={st.infoVal}>{selectedOp.clientNom}</Text></View>
                  )}
                  {selectedOp.motif && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>Motif</Text><Text style={st.infoVal}>{selectedOp.motif}</Text></View>
                  )}
                  {selectedOp.modePaiement && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>Mode paiement</Text><Text style={st.infoVal}>{selectedOp.modePaiement.replace('_', ' ')}</Text></View>
                  )}
                  {selectedOp.referencePaiement && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>Référence</Text><Text style={st.infoVal}>{selectedOp.referencePaiement}</Text></View>
                  )}
                  {selectedOp.numeroVente && (
                    <View style={st.infoRow}><Text style={st.infoLabel}>N° Vente</Text><Text style={st.infoVal}>{selectedOp.numeroVente}</Text></View>
                  )}
                  <View style={st.infoRow}><Text style={st.infoLabel}>Utilisateur</Text><Text style={st.infoVal}>{selectedOp.utilisateurNom || 'Système'}</Text></View>
                  {selectedOp.venteAnnulee && (
                    <View style={st.infoRow}>
                      <Text style={st.infoLabel}>Statut</Text>
                      <View style={[st.badge, { backgroundColor: '#fee2e2' }]}><Text style={[st.badgeText, { color: '#dc2626' }]}>VENTE ANNULÉE</Text></View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={st.modalFoot}>
              <TouchableOpacity style={st.btnCancel} onPress={() => setShowOpDetail(false)}>
                <Text style={st.btnCancelText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════ MODAL TRANSFERT → BANQUE ══════ */}
      <Modal visible={showTransfert} animationType="slide" transparent onRequestClose={() => setShowTransfert(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={st.overlay}>
            <View style={st.sheet}>
              <View style={st.handle} />
              <View style={st.modalHead}>
                <Text style={st.modalTitle}>Transfert → Banque</Text>
                <TouchableOpacity onPress={() => setShowTransfert(false)}>
                  <Text style={{ fontSize: 22, color: '#666' }}>×</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={st.modalBody}>
                <Text style={st.muted}>Solde caisse : <Text style={{ fontWeight: 'bold' }}>{money(soldeActuel)}</Text></Text>

                <Text style={st.fieldLabel}>Compte bancaire</Text>
                <TouchableOpacity
                  style={st.selectBox}
                  onPress={() => openPicker(
                    'Compte bancaire',
                    comptes.map((c) => ({ label: c.nomBanque, sub: money(c.soldeActuel || 0), value: c.id })),
                    setTransfertCompteId
                  )}
                >
                  <Text style={transfertCompteId ? st.selectBoxText : st.selectBoxPlaceholder} numberOfLines={1}>
                    {comptes.find((c) => c.id === transfertCompteId)?.nomBanque || 'Choisir un compte...'}
                  </Text>
                  <MaterialCommunityIcons name="chevron-down" size={18} color="#888" />
                </TouchableOpacity>

                <Text style={st.fieldLabel}>Montant</Text>
                <MontantInput style={st.fieldInput} value={transfertMontant} onChangeValue={setTransfertMontant} placeholder="0" placeholderTextColor="#bbb" />

                <Text style={st.fieldLabel}>Motif</Text>
                <RNTextInput style={st.fieldInput} value={transfertMotif} onChangeText={setTransfertMotif} placeholder="Motif du transfert..." placeholderTextColor="#bbb" />

                <Text style={st.fieldLabel}>Référence</Text>
                <RNTextInput style={st.fieldInput} value={transfertRef} onChangeText={setTransfertRef} placeholder="Référence (optionnel)" placeholderTextColor="#bbb" />
              </ScrollView>
              <View style={st.modalFoot}>
                <TouchableOpacity style={st.btnCancel} onPress={() => setShowTransfert(false)}>
                  <Text style={st.btnCancelText}>{tr('annuler', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btnConfirm, { backgroundColor: '#d97706' }, savingTransfert && { opacity: 0.6 }]} onPress={validerTransfert} disabled={savingTransfert}>
                  {savingTransfert ? <ActivityIndicator size="small" color="#fff" /> : <Text style={st.btnConfirmText}>Confirmer le transfert</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════ PICKER GÉNÉRIQUE (remplace les <select> Ionic) ══════ */}
      <Modal visible={picker.visible} animationType="slide" transparent onRequestClose={closePicker}>
        <View style={st.overlay}>
          <View style={st.sheet}>
            <View style={st.handle} />
            <View style={st.modalHead}>
              <Text style={st.modalTitle}>{picker.title}</Text>
              <TouchableOpacity onPress={closePicker}>
                <Text style={{ fontSize: 22, color: '#666' }}>×</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={[st.modalBody, { maxHeight: 380 }]}>
              {picker.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={st.pickerOption}
                  onPress={() => { picker.onSelect(opt.value); closePicker(); }}
                >
                  <Text style={st.pickerOptionLabel}>{opt.label}</Text>
                  {opt.sub ? <Text style={st.pickerOptionSub}>{opt.sub}</Text> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f0f4f8' },

  // Cartes couleur (haut de page, toujours visibles)
  // STYLE (2026-08-16) : coins plus arrondis + ombre douce (au lieu de la
  // simple élévation Android, invisible sur iOS) pour un rendu plus premium.
  colorCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 12, backgroundColor: '#fff' },
  colorCard: {
    flexBasis: '47%', flexGrow: 1, borderRadius: 16, padding: 14, alignItems: 'flex-start',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  colorCardFull: {
    borderRadius: 16, padding: 16, alignItems: 'flex-start',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  ccLabel: { fontSize: 11, fontWeight: '600', marginTop: 6 },
  ccValue: { fontSize: 15, fontWeight: 'bold', marginTop: 2 },
  ccSub: { fontSize: 10, marginTop: 2, opacity: 0.8 },

  // Onglets
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#1a56db' },
  tabText: { fontSize: 13, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#1a56db' },

  // Offline banner
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12, flex: 1 },

  container: { flex: 1 },

  // Carte mobile / form-panel (État)
  mobileCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  formPanel: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 },
  },
  cardTitleLg: { fontWeight: 'bold', fontSize: 15, color: '#1e293b' },
  cardSubtitle: { color: '#64748b', fontSize: 12, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  badgeEtat: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  badgeEtatText: { fontSize: 11, fontWeight: 'bold' },

  twoCols: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#64748b' },
  statValue: { fontSize: 14, fontWeight: 'bold', marginTop: 3 },

  bigBtn: {
    flexDirection: 'row', gap: 8, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  bigBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  sectionTitle: { fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 8, marginTop: 8 },

  // Toggle entrée/sortie
  toggleRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f9f9f9' },
  toggleBtnText: { fontWeight: '700', fontSize: 14, color: '#555' },

  // Formulaire
  fieldLabel: { color: '#666', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Select box (remplace ion-select)
  selectBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fafafa' },
  selectBoxText: { fontSize: 14, color: '#333', flex: 1 },
  selectBoxPlaceholder: { fontSize: 14, color: '#999', flex: 1 },
  pickerOption: { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerOptionLabel: { fontSize: 14, color: '#333', flex: 1 },
  pickerOptionSub: { fontSize: 13, color: '#1a56db', fontWeight: '600' },

  // Chip bar credits (inline avec bouton imprimer)
  chipBarInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  filterChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  pdfBtnOutline: { flexDirection: 'row', gap: 4, alignItems: 'center', borderWidth: 1, borderColor: '#d97706', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 'auto' },
  pdfBtnOutlineText: { color: '#d97706', fontWeight: '700', fontSize: 12 },

  retardBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
  retardBannerText: { color: '#64748b', fontSize: 13 },
  retardBannerBadge: { backgroundColor: '#dc2626', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  retardBannerBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },

  // Groupe règlement
  groupBar: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 },
  groupBtnOutline: { borderWidth: 1, borderColor: '#1a56db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  groupBtnOutlineText: { color: '#1a56db', fontSize: 12, fontWeight: '600' },
  groupBtnClear: { paddingHorizontal: 10, paddingVertical: 6 },
  groupBtnClearText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  groupBtnConfirm: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 9 },
  groupBtnConfirmText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Paper card rows
  opCardPaper: { marginBottom: 8, borderRadius: 14, elevation: 1 },
  creditCardPaper: { marginBottom: 10, borderRadius: 16, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  muted: { color: '#64748b', fontSize: 12 },

  // Crédit
  creditRestant: { fontWeight: 'bold', fontSize: 14, color: '#1a56db' },
  progressWrap: { marginTop: 8 },
  progressBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#1a56db', borderRadius: 3 },

  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  // Opérations
  periodBar: { flexDirection: 'row', gap: 6, padding: 12, backgroundColor: '#fff' },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  periodBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },

  opFilters: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#fff' },
  opSearchInput: { flex: 1.3, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, backgroundColor: '#fafafa' },
  opTypeSelect: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#fafafa' },
  opTypeSelectText: { fontSize: 12, color: '#555', flex: 1 },

  opSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  opSummaryVal: { fontWeight: 'bold', fontSize: 13 },

  opIndicator: { width: 4, height: 40, borderRadius: 2 },
  opMontant: { fontWeight: 'bold', fontSize: 14 },
  opSoldes: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statsCard: {
    width: '47%', borderRadius: 18, padding: 16, alignItems: 'flex-start',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  statsVal: { fontSize: 16, fontWeight: 'bold', marginTop: 6 },
  statsLabel: { fontSize: 11, color: '#666', marginTop: 2 },

  // Réconciliation par vendeur (sélecteur de date + mise en avant du total à remettre)
  dateNavBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 4, marginBottom: 14,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  dateNavBtn: { padding: 8 },
  dateNavLabel: { fontSize: 13, fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' },
  dateNavToday: { fontSize: 11, color: '#1a56db', fontWeight: '600', marginTop: 2 },
  reconciliationTotalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  reconciliationTotalLabel: { fontSize: 13, fontWeight: '700', color: '#1d4ed8' },
  reconciliationTotalValue: { fontSize: 18, fontWeight: '900', color: '#1d4ed8' },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 12, fontSize: 14 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 440 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: { flex: 2, backgroundColor: '#1a56db', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Info card modal
  infoCard: { backgroundColor: '#fafafa', borderRadius: 14, padding: 12, marginTop: 10, marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Versements
  versRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  versDate: { flex: 1, fontSize: 12, color: '#64748b' },
  versMontant: { fontWeight: '700', color: '#16a34a', fontSize: 13 },
  versMode: { fontSize: 11, color: '#888', marginTop: 2 },
  versSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
});
