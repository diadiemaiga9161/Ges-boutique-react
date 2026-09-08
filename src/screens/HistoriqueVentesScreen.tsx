import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert,
  Modal, ScrollView, TouchableOpacity, TextInput as RNTextInput, Linking,
} from 'react-native';
import { Text, Card, Chip, Searchbar, ActivityIndicator, ProgressBar, FAB, RadioButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getVentes, getVentesJour, getVentesParPeriode,
  getVenteDetail, annulerVente, getVentesAnnulees,
  modifierLignesVente, effectuerRetourVente,
  getStatistiquesChiffreAffaire, getTopProduits,
  getProduits,
} from '../services/api.service';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { imprimerFactureRN } from '../services/invoice.service';
import { TicketVente } from '../services/thermalPrinter.service';
import ImprimerTicketButton from '../components/ImprimerTicketButton';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { MontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';
import { SkeletonCard } from '../components/SkeletonLoader';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const money = (v: number) => (v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Types ────────────────────────────────────────────────────────────────────
type TypeFilter = '' | 'COMPTANT' | 'CREDIT' | 'EN_RETARD';
type ActivePeriod = 'today' | 'week' | 'month' | 'all' | 'custom';
type ModePaiementFilter = '' | 'ESPECES' | 'ORANGE_MONEY' | 'MOOV_MONEY' | 'CARTE_BANCAIRE' | 'VIREMENT';
type ActiveTab = 'ventes' | 'annulees';

interface VenteAnnulee {
  id: number;
  numeroVente: string;
  dateVente: string;
  dateAnnulation: string;
  montantTotal: number;
  motifAnnulation: string;
  clientNom: string;
  vendeurNom: string;
  annuleurNom: string;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function HistoriqueVentesScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const navigation = useNavigation<any>();

  // ─── Onglets ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('ventes');

  // ─── Onglet Ventes ─────────────────────────────────────────────────────────
  const [ventes, setVentes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [modePaiementFilter, setModePaiementFilter] = useState<ModePaiementFilter>('');
  const [activePeriod, setActivePeriod] = useState<ActivePeriod>('today');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // ─── Onglet Annulées ───────────────────────────────────────────────────────
  const [ventesAnnulees, setVentesAnnulees] = useState<VenteAnnulee[]>([]);
  const [loadingAnnulees, setLoadingAnnulees] = useState(true);
  const [refreshingAnnulees, setRefreshingAnnulees] = useState(false);

  // Modal détail (onglet Ventes)
  const [showModal, setShowModal] = useState(false);
  const [selectedVente, setSelectedVente] = useState<any | null>(null);
  const [venteDetail, setVenteDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const [userId, setUserId] = useState<number>(0);
  // Impression ticket (CleFonctionnalite.IMPRESSION_TICKET) — même mécanisme
  // exact que les autres fonctionnalités avancées (cache
  // 'fonctionnalites_avancees_desactivees', voir LoginScreen.tsx).
  const [impressionTicketActif, setImpressionTicketActif] = useState(false);

  // Modale de confirmation d'annulation avec motif (Alert.alert ne permet pas
  // de champ de saisie sur Android — réplique le comportement Ionic : motif
  // optionnel + avertissement "action irréversible, stock remis à jour").
  const [showAnnulerModal, setShowAnnulerModal] = useState(false);
  const [venteAAnnuler, setVenteAAnnuler] = useState<any | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState('');

  // ─── Statistiques ──────────────────────────────────────────────────────────
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [topProduits, setTopProduits] = useState<any[]>([]);

  // ─── Modifier une vente ────────────────────────────────────────────────────
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyLines, setModifyLines] = useState<any[]>([]);
  const [modifyMotif, setModifyMotif] = useState('');
  const [savingModify, setSavingModify] = useState(false);
  const [produitsPourModif, setProduitsPourModif] = useState<any[]>([]);

  // ─── Retour d'articles ─────────────────────────────────────────────────────
  const [showRetourModal, setShowRetourModal] = useState(false);
  const [retourLignes, setRetourLignes] = useState<any[]>([]);
  const [retourMotif, setRetourMotif] = useState('');
  const [savingRetour, setSavingRetour] = useState(false);

  // ─── QR code facture ───────────────────────────────────────────────────────
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (!raw) return;
      try {
        const u = JSON.parse(raw);
        setUserId(u?.id || 0);
        const role: string = u?.role || '';
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      } catch {}
    });
    AsyncStorage.getItem('fonctionnalites_avancees_desactivees').then(raw => {
      let desactivees: string[] = [];
      if (raw) { try { desactivees = JSON.parse(raw); } catch { /* ignore */ } }
      setImpressionTicketActif(!desactivees.includes('IMPRESSION_TICKET'));
    });
  }, []);

  // En-tête : icônes statistiques + nouvelle vente, comme sur Ionic (analytics-outline, add-outline).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={openStats} style={{ marginRight: 14 }}>
            <MaterialCommunityIcons name="chart-box-outline" color="#fff" size={24} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Vente')} style={{ marginRight: 14 }}>
            <MaterialCommunityIcons name="plus" color="#fff" size={26} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  // ─── Récupération boutiqueId ───────────────────────────────────────────────
  const getBoutiqueId = async (): Promise<number | null> => {
    try {
      const raw = await AsyncStorage.getItem('boutique_info');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return Number(parsed.id);
      }
    } catch { }
    return null;
  };

  // ─── Chargement ventes ─────────────────────────────────────────────────────
  const charger = useCallback(async (period: ActivePeriod = activePeriod) => {
    try {
      let res: any;
      const now = new Date();

      if (period === 'today') {
        res = await getVentesJour();
      } else if (period === 'week') {
        const debut = new Date(now);
        debut.setDate(now.getDate() - 6);
        const dd = toLocalDate(debut);
        const df = toLocalDate(now);
        setDateDebut(dd);
        setDateFin(df);
        res = await getVentesParPeriode(dd, df);
      } else if (period === 'month') {
        const debut = new Date(now.getFullYear(), now.getMonth(), 1);
        const dd = toLocalDate(debut);
        const df = toLocalDate(now);
        setDateDebut(dd);
        setDateFin(df);
        res = await getVentesParPeriode(dd, df);
      } else if (period === 'custom') {
        // dateDebut/dateFin déjà saisis par l'utilisateur — ne pas les recalculer.
        res = await getVentesParPeriode(dateDebut, dateFin);
      } else {
        res = await getVentes();
      }

      // /ventes/aujourdhui renvoie {ventes:[...], nombreVentes, montantTotal}
      // (VenteController.java:206-217) — contrairement à /ventes, /ventes/periode
      // qui renvoient un tableau nu. Sans ce cas particulier, `ventes` recevait
      // l'objet entier au lieu du tableau et .filter()/.reduce() plantaient au
      // rendu ("undefined is not a function").
      const raw = (period === 'today' ? res.data?.ventes : null) || res.data?.data || res.data || [];
      const data: any[] = Array.isArray(raw) ? raw : [];
      setVentes(data);
      applyFilter(data, search, typeFilter);
      setFromCache(false);
      sauvegarderCache('historique_ventes', data).catch(() => {});
    } catch {
      const cached = await lireCache<any>('historique_ventes');
      if (cached.length > 0) {
        setVentes(cached);
        applyFilter(cached, search, typeFilter);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [activePeriod, search, typeFilter, dateDebut, dateFin]);

  // ─── Chargement ventes annulées ────────────────────────────────────────────
  const chargerAnnulees = useCallback(async () => {
    const boutiqueId = await getBoutiqueId();
    if (boutiqueId === null) {
      setLoadingAnnulees(false);
      setRefreshingAnnulees(false);
      return;
    }
    try {
      const res = await getVentesAnnulees(boutiqueId);
      const data: VenteAnnulee[] = res.data?.data || res.data || [];
      setVentesAnnulees(data);
    } catch { }
    setLoadingAnnulees(false);
    setRefreshingAnnulees(false);
  }, []);

  useEffect(() => {
    charger();
    chargerAnnulees();
  }, []);

  // ─── Filtre ────────────────────────────────────────────────────────────────
  const applyFilter = (data: any[], term: string, type: TypeFilter, modePaiement: ModePaiementFilter = modePaiementFilter) => {
    const now = new Date();
    let result = [...data];

    if (type === 'COMPTANT') {
      result = result.filter((v: any) => !v.estCredit);
    } else if (type === 'CREDIT') {
      result = result.filter((v: any) => v.estCredit);
    } else if (type === 'EN_RETARD') {
      result = result.filter((v: any) => {
        if (!v.estCredit) return false;
        if (v.creditRegle) return false;
        if (!v.dateEcheance) return false;
        return new Date(v.dateEcheance) < now;
      });
    }

    if (modePaiement) {
      result = result.filter((v: any) => v.modePaiement === modePaiement);
    }

    if (term.trim()) {
      const q = term.trim().toLowerCase();
      result = result.filter((v: any) =>
        (v.clientNom || '').toLowerCase().includes(q) ||
        (v.numeroVente || '').toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  };

  const onSearch = (v: string) => {
    setSearch(v);
    applyFilter(ventes, v, typeFilter);
  };

  const onTypeFilter = (t: TypeFilter) => {
    setTypeFilter(t);
    applyFilter(ventes, search, t);
  };

  const onModePaiementFilter = (m: ModePaiementFilter) => {
    setModePaiementFilter(m);
    applyFilter(ventes, search, typeFilter, m);
  };

  const onPeriod = (p: ActivePeriod) => {
    setActivePeriod(p);
    setLoading(true);
    charger(p);
  };

  // Plage de dates libre (Du/Au), comme sales.page.ts:249-253 sur Ionic —
  // indépendante des chips de période rapide, applicable à tout moment.
  const appliquerPeriodePersonnalisee = () => {
    if (!dateDebut || !dateFin) return;
    setActivePeriod('custom');
    setLoading(true);
    charger('custom');
  };

  // ─── Stats (mêmes calculs que sales.page.ts : caTotal/totalCredit sur la
  // liste filtrée, caJour indépendant du filtre période comme sur Ionic) ─────
  const caTotal = filtered.reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const nbVentes = filtered.length;
  const caJour = (() => {
    const t = new Date().toDateString();
    return ventes
      .filter((v: any) => new Date(v.dateVente).toDateString() === t)
      .reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  })();
  const totalCreditRestant = filtered
    .filter((v: any) => v.estCredit && !v.creditRegle)
    .reduce((s: number, v: any) => {
      const restant = v.montantRestant ?? Math.max(0, (v.montantTotal || 0) - (v.montantVerse || 0));
      return s + restant;
    }, 0);

  // ─── Modal détail ──────────────────────────────────────────────────────────
  const openModal = async (vente: any) => {
    setSelectedVente(vente);
    setVenteDetail(null);
    setShowModal(true);

    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : {};
      const role: string = user.role || '';
      setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
    } catch {
      setIsAdmin(false);
    }

    setLoadingDetail(true);
    try {
      const res = await getVenteDetail(vente.id);
      setVenteDetail(res.data?.data || res.data);
    } catch { }
    setLoadingDetail(false);
  };

  const handleAnnuler = (vente: any) => {
    setVenteAAnnuler(vente);
    setMotifAnnulation('');
    setShowAnnulerModal(true);
  };

  const confirmerAnnulation = async () => {
    const vente = venteAAnnuler;
    if (!vente) return;
    setShowAnnulerModal(false);
    setAnnulationEnCours(true);
    try {
      const payload = { venteId: vente.id, motif: motifAnnulation || undefined, estCredit: !!vente.estCredit, utilisateurId: userId };
      const { offline } = await executerOuMettreEnFile(
        'vente_annuler', payload,
        () => annulerVente(vente.id, motifAnnulation || undefined, vente.estCredit, userId)
      );
      setShowModal(false);
      if (offline) {
        Alert.alert(tr('hors_ligne', lang), 'Annulation enregistrée localement — sera synchronisée au retour du réseau.');
      } else {
        setLoading(true);
        charger(activePeriod);
        chargerAnnulees();
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
    setAnnulationEnCours(false);
  };

  // Construit l'InvoiceData attendue par invoice.service.ts à partir d'une vente +
  // son détail (mêmes 3 designs Classique/Moderne/Minimaliste que Ionic, au lieu
  // d'un HTML basique à design unique).
  const buildInvoiceDataVente = (vente: any, detail: any) => ({
    numero: vente.numeroVente || `#${vente.id}`,
    date: vente.dateVente,
    clientNom: vente.clientNom,
    clientPrenom: vente.clientPrenom,
    clientTelephone: vente.clientTelephone,
    vendeurNom: vente.vendeurNom,
    modePaiement: vente.modePaiement,
    referencePaiement: vente.referencePaiement,
    estCredit: vente.estCredit,
    creditRegle: vente.creditRegle,
    montantVerse: vente.montantVerse,
    montantRestant: vente.montantRestant,
    dateEcheance: vente.dateEcheance,
    lignes: detail?.lignes || detail?.produits || vente.lignes || vente.produits || [],
    montantTotal: vente.montantTotal,
    montantApresRemise: vente.montantApresRemise,
    montantRemiseTotal: vente.montantRemiseTotal,
    id: vente.id,
    type: 'VENTE' as const,
  });

  const chargerBoutiqueEtDesign = async (): Promise<{ boutique: any; design: 1 | 2 | 3 }> => {
    const raw = await AsyncStorage.getItem('boutique_info');
    const boutique = raw ? JSON.parse(raw) : {};
    const tpl = await AsyncStorage.getItem('facture_template');
    const design: 1 | 2 | 3 = tpl === 'moderne' ? 2 : tpl === 'minimaliste' ? 3 : 1;
    return { boutique, design };
  };

  // Construit le TicketVente (reçu thermique) attendu par thermalPrinter.service.ts
  // à partir d'une vente + son détail — reçu simple, indépendant du PDF facture
  // ci-dessus (voir imprimerFactureRN, format A4/A5, pas fait pour une
  // imprimante 58/80mm).
  const buildTicketVente = (vente: any, detail: any, boutique: any): TicketVente => {
    const lignes: any[] = detail?.lignes || detail?.produits || vente.lignes || vente.produits || [];
    return {
      boutiqueNom: boutique?.nom || 'Ges Boutique',
      boutiqueAdresse: boutique?.adresse,
      boutiqueTelephone: boutique?.telephone,
      numeroVente: vente.numeroVente || `#${vente.id}`,
      date: vente.dateVente ? new Date(vente.dateVente) : new Date(),
      vendeurNom: vente.vendeurNom,
      clientNom: vente.clientNom,
      lignes: lignes.map((l: any) => ({
        nom: l.produitNom || l.designation || 'Produit',
        quantite: l.quantite || 0,
        prixUnitaire: l.prixUnitaire || 0,
        sousTotal: l.sousTotal,
      })),
      montantTotal: vente.montantApresRemise ?? vente.montantTotal ?? 0,
      montantRemise: vente.montantRemiseTotal,
      modePaiement: vente.modePaiement,
    };
  };

  const getTicketPourVente = async (vente: any, detailDejaCharge?: any): Promise<TicketVente | null> => {
    try {
      const detail = detailDejaCharge ?? await chargerDetailVente(vente);
      const { boutique } = await chargerBoutiqueEtDesign();
      return buildTicketVente(vente, detail, boutique);
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
      return null;
    }
  };

  const handleImprimer = async (vente: any, detail: any) => {
    try {
      const { boutique, design } = await chargerBoutiqueEtDesign();
      await imprimerFactureRN(buildInvoiceDataVente(vente, detail), boutique, design);
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  // ─── Actions directement sur la carte (comme le bandeau .sale-actions
  // d'Ionic) : le détail (lignes produits) n'est chargé qu'au moment du clic,
  // pas au préalable pour toute la liste. ────────────────────────────────────
  const chargerDetailVente = async (vente: any) => {
    const res = await getVenteDetail(vente.id);
    return res.data?.data || res.data;
  };

  const handleImprimerDepuisCarte = async (vente: any) => {
    try {
      const detail = await chargerDetailVente(vente);
      await handleImprimer(vente, detail);
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  const openModifyDepuisCarte = async (vente: any) => {
    try {
      const detail = await chargerDetailVente(vente);
      setSelectedVente(vente);
      openModify(vente, detail);
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  const openRetourDepuisCarte = async (vente: any) => {
    try {
      const detail = await chargerDetailVente(vente);
      setSelectedVente(vente);
      openRetour(vente, detail);
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  // ─── Statistiques — /ventes/statistiques/chiffre-affaire, comme
  //     getStatistiquesChiffreAffaire() sur Ionic (PAS /rapports/jour|semaine|mois
  //     qui n'existent pas côté backend) ───────────────────────────────────────
  const openStats = async () => {
    setShowStatsModal(true);
    if (stats) return;
    setLoadingStats(true);
    try {
      const [rStats, rTop] = await Promise.all([
        getStatistiquesChiffreAffaire().catch(() => ({ data: null })),
        getTopProduits().catch(() => ({ data: [] })),
      ]);
      setStats(rStats.data?.data || rStats.data);
      setTopProduits((rTop.data?.data || rTop.data || []).slice(0, 5));
    } catch { }
    setLoadingStats(false);
  };

  // ─── Modifier une vente ────────────────────────────────────────────────────
  const openModify = async (vente: any, detail: any) => {
    setShowModal(false);
    const lignes: any[] = (detail?.lignes || detail?.produits || []).map((l: any) => ({
      produitId: l.produitId,
      produitNom: l.produitNom,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
    }));
    setModifyLines(lignes);
    setModifyMotif('');
    setShowModifyModal(true);
    try {
      const res = await getProduits();
      setProduitsPourModif(res.data?.data || res.data || []);
    } catch { }
  };

  const modifyTotal = modifyLines.reduce((s, l) => s + (l.quantite || 0) * (l.prixUnitaire || 0), 0);

  const updateModifyLine = (i: number, patch: Partial<any>) => {
    setModifyLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };

  const removeModifyLine = (i: number) => {
    setModifyLines(prev => prev.filter((_, idx) => idx !== i));
  };

  const addModifyLine = () => {
    if (produitsPourModif.length === 0) return;
    const p = produitsPourModif[0];
    setModifyLines(prev => [...prev, { produitId: p.id, produitNom: p.nom, quantite: 1, prixUnitaire: p.prixVente }]);
  };

  const saveModify = async () => {
    if (!selectedVente || modifyLines.length === 0) {
      Alert.alert(tr('erreur', lang), 'Ajoutez au moins un article');
      return;
    }
    setSavingModify(true);
    const data = {
      lignes: modifyLines.map(l => ({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
      utilisateurId: userId,
      motif: modifyMotif.trim() || undefined,
    };
    try {
      const { offline } = await executerOuMettreEnFile(
        'vente_modifier', { venteId: selectedVente.id, data }, () => modifierLignesVente(selectedVente.id, data)
      );
      setShowModifyModal(false);
      if (offline) {
        Alert.alert(tr('hors_ligne', lang), 'Modification enregistrée localement — sera synchronisée au retour du réseau.');
      } else {
        charger(activePeriod);
        Alert.alert(tr('succes', lang), 'Vente modifiée');
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || e.message || 'Modification impossible');
    }
    setSavingModify(false);
  };

  // ─── Retour d'articles ─────────────────────────────────────────────────────
  const openRetour = (vente: any, detail: any) => {
    setShowModal(false);
    const lignes: any[] = detail?.lignes || detail?.produits || [];
    setRetourLignes(lignes.map((l: any) => ({
      produitId: l.produitId,
      produitNom: l.produitNom,
      prixUnitaire: l.prixUnitaire,
      quantiteMax: l.quantite,
      quantiteRetournee: 1,
      selected: false,
    })));
    setRetourMotif('');
    setShowRetourModal(true);
  };

  const totalRetour = retourLignes
    .filter(l => l.selected)
    .reduce((s, l) => s + l.quantiteRetournee * l.prixUnitaire, 0);

  const submitRetour = async () => {
    const lignesSelectionnees = retourLignes.filter(l => l.selected);
    if (lignesSelectionnees.length === 0) {
      Alert.alert(tr('erreur', lang), 'Sélectionnez au moins un article à retourner');
      return;
    }
    setSavingRetour(true);
    const data = {
      venteId: selectedVente.id,
      motif: retourMotif.trim() || undefined,
      utilisateurId: userId,
      lignes: lignesSelectionnees.map(l => ({
        produitId: l.produitId,
        quantiteRetournee: l.quantiteRetournee,
        prixUnitaire: l.prixUnitaire,
      })),
    };
    try {
      const { offline } = await executerOuMettreEnFile('vente_retour', data, () => effectuerRetourVente(data));
      setShowRetourModal(false);
      if (offline) {
        Alert.alert(tr('hors_ligne', lang), 'Retour enregistré localement — sera synchronisé au retour du réseau.');
      } else {
        charger(activePeriod);
        Alert.alert(tr('succes', lang), 'Retour enregistré');
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || e.message || 'Retour impossible');
    }
    setSavingRetour(false);
  };

  // ─── Envoi facture par WhatsApp ─────────────────────────────────────────────
  // Parité avec sales.page.ts:envoyerFactureWhatsApp/construireMessageWhatsAppVente
  // (Ionic) — même message (lignes, remise, net à payer, versé/reste si crédit),
  // via le même pattern wa.me déjà utilisé ailleurs dans RN (RapportsScreen,
  // CommandesScreen : Linking.openURL(`https://wa.me/...`)).
  const construireMessageWhatsAppVente = (vente: any, detail: any, boutiqueNom: string) => {
    const nomClient = [vente.clientPrenom, vente.clientNom].filter(Boolean).join(' ') || vente.clientNom || tr('client_anonyme', lang);
    const lignesVente: any[] = detail?.lignes || detail?.produits || vente.lignes || vente.produits || [];
    const lignes = [
      `🧾 *Facture de vente N°${vente.numeroVente}*`,
      `🏪 ${boutiqueNom || 'Ges Boutique'}`,
      `👤 Client : ${nomClient}`,
      `📅 ${new Date(vente.dateVente).toLocaleDateString('fr-FR')}`,
      '',
      ...lignesVente.map((l: any) => `${l.produitNom || l.designation} ×${l.quantite} — ${money(l.sousTotal || l.quantite * l.prixUnitaire)}`),
      '',
      `💰 Montant total : ${money(vente.montantTotal)}`,
    ];
    if (vente.montantRemiseTotal > 0) {
      lignes.push(`🏷️ Remise : -${money(vente.montantRemiseTotal)}`);
    }
    lignes.push(`✅ Net à payer : ${money(vente.montantApresRemise ?? vente.montantTotal)}`);
    if (vente.estCredit) {
      lignes.push(`💵 Versé : ${money(vente.montantVerse || 0)}`);
      lignes.push(`⏳ Reste à payer : ${money(vente.montantRestant || 0)}`);
    }
    return lignes.join('\n');
  };

  const envoyerFactureWhatsApp = async (vente: any, detailDejaCharge?: any) => {
    if (!vente.clientTelephone) {
      Alert.alert(tr('erreur', lang), "Ajoutez un numéro de téléphone à ce client pour activer l'envoi WhatsApp");
      return;
    }
    try {
      const detail = detailDejaCharge ?? await chargerDetailVente(vente);
      const { boutique } = await chargerBoutiqueEtDesign();
      const message = construireMessageWhatsAppVente(vente, detail, boutique?.nom);
      const clean = String(vente.clientTelephone).replace(/[\s()\-+]/g, '');
      Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`);
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  // ─── QR code facture ───────────────────────────────────────────────────────
  const openQr = async (vente: any) => {
    setShowModal(false);
    try {
      const apiUrl = (await AsyncStorage.getItem('api_url')) || '';
      // apiUrl finit par "/api" — la page facture publique est hors de ce préfixe.
      const base = apiUrl.replace(/\/api\/?$/, '');
      setQrUrl(`${base}/api/public/ventes/${vente.id}/facture`);
    } catch {
      setQrUrl('');
    }
    setShowQrModal(true);
  };

  // ─── Rendu si chargement initial (onglet actif) ────────────────────────────
  if (activeTab === 'ventes' && loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 12 }]}>
        <SkeletonCard count={5} />
      </View>
    );
  }

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Barre d'onglets ── */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ventes' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('ventes')}
        >
          <Text style={[styles.tabBtnText, { color: colors.textSecondary }, activeTab === 'ventes' && { color: colors.primary }]}>
            Ventes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'annulees' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('annulees')}
        >
          <View style={styles.tabBtnInner}>
            <Text style={[styles.tabBtnText, { color: colors.textSecondary }, activeTab === 'annulees' && { color: colors.primary }]}>
              Annulées
            </Text>
            {ventesAnnulees.length > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.danger }]}>
                <Text style={styles.tabBadgeText}>{ventesAnnulees.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ══════════════ ONGLET VENTES ══════════════ */}
      {activeTab === 'ventes' && (
        <>
          {/* ── Hero banner (comme .sales-hero d'Ionic : gros total à gauche,
               2 mini-cartes Aujourd'hui / Crédits à droite) ── */}
          <View style={styles.hero}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>Chiffre d'affaires total</Text>
              <Text style={styles.heroAmount} numberOfLines={1}>{money(caTotal)}</Text>
              <View style={styles.heroSubRow}>
                <MaterialCommunityIcons name="receipt-outline" size={13} color="#93c5fd" />
                <Text style={styles.heroSub}>{nbVentes} vente{nbVentes > 1 ? 's' : ''}</Text>
              </View>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.heroMiniCard}>
                <MaterialCommunityIcons name="white-balance-sunny" size={16} color="#93c5fd" />
                <Text style={styles.hmcLabel}>Aujourd'hui</Text>
                <Text style={styles.hmcVal} numberOfLines={1}>{money(caJour)}</Text>
              </View>
              <View style={styles.heroMiniCard}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#fbbf24" />
                <Text style={styles.hmcLabel}>Crédits</Text>
                <Text style={[styles.hmcVal, styles.hmcValWarn]} numberOfLines={1}>{money(totalCreditRestant)}</Text>
              </View>
            </View>
          </View>


          {/* ── Filtres période ── */}
          <View style={styles.periodRow}>
            {([ ['today', tr('rapport_journalier', lang)], ['week', tr('rapport_semaine', lang)], ['month', tr('rapport_mois', lang)], ['all', tr('historique', lang)] ] as [ActivePeriod, string][]).map(([p, label]) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, activePeriod === p && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => onPeriod(p)}
              >
                <Text style={[styles.periodBtnText, { color: colors.textSecondary }, activePeriod === p && styles.periodBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Chips type ── */}
          <View style={styles.chipRow}>
            {([ ['', 'Tous'], ['COMPTANT', 'Comptant'], ['CREDIT', tr('credits', lang)], ['EN_RETARD', tr('non_regle', lang)] ] as [TypeFilter, string][]).map(([t, label]) => (
              <Chip
                key={t}
                compact
                onPress={() => onTypeFilter(t)}
                style={[styles.filterChip, { backgroundColor: colors.inputBg, borderColor: colors.border }, typeFilter === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                textStyle={[styles.filterChipText, { color: colors.textSecondary }, typeFilter === t && styles.filterChipTextActive]}
              >
                {label}
              </Chip>
            ))}
          </View>

          {/* ── Chips mode de paiement (comme Ionic sales.page.html:191-206) ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={styles.chipRow}>
              {([
                ['', 'Tous modes'], ['ESPECES', 'Espèces'], ['ORANGE_MONEY', 'Orange Money'],
                ['MOOV_MONEY', 'Moov Money'], ['CARTE_BANCAIRE', 'Carte bancaire'], ['VIREMENT', 'Virement'],
              ] as [ModePaiementFilter, string][]).map(([m, label]) => (
                <Chip
                  key={m}
                  compact
                  onPress={() => onModePaiementFilter(m)}
                  style={[styles.filterChip, { backgroundColor: colors.inputBg, borderColor: colors.border }, modePaiementFilter === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  textStyle={[styles.filterChipText, { color: colors.textSecondary }, modePaiementFilter === m && styles.filterChipTextActive]}
                >
                  {label}
                </Chip>
              ))}
            </View>
          </ScrollView>

          {/* ── Plage de dates libre Du/Au (comme Ionic sales.page.html:209-219) ── */}
          <View style={styles.dateRangeRow}>
            <RNTextInput
              style={[styles.dateRangeInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
              placeholder="Du (AAAA-MM-JJ)"
              placeholderTextColor={colors.placeholder}
              value={dateDebut}
              onChangeText={setDateDebut}
            />
            <RNTextInput
              style={[styles.dateRangeInput, { borderColor: colors.border, backgroundColor: colors.card, color: colors.text }]}
              placeholder="Au (AAAA-MM-JJ)"
              placeholderTextColor={colors.placeholder}
              value={dateFin}
              onChangeText={setDateFin}
            />
            <TouchableOpacity style={[styles.dateRangeBtn, { backgroundColor: colors.primary }]} onPress={appliquerPeriodePersonnalisee}>
              <MaterialCommunityIcons name="magnify" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ── Barre de recherche ── */}
          <Searchbar
            placeholder={tr('recherche_vente', lang)}
            value={search}
            onChangeText={onSearch}
            style={[styles.search, { backgroundColor: colors.card }]}
            inputStyle={{ fontSize: 14, color: colors.text }}
            placeholderTextColor={colors.placeholder}
            iconColor={colors.textSecondary}
          />

          {/* ── Liste ventes ── */}
          <FlatList
            data={filtered}
            keyExtractor={(v: any) => String(v.id)}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); charger(activePeriod); }}
              />
            }
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="cart-off" size={64} color={colors.border} />
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{tr('aucune_vente', lang)}</Text>
                <Text style={[styles.emptySub, { color: colors.placeholder }]}>Aucune vente pour cette période</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isAnnulee = item.annulee || item.statut === 'ANNULEE';
              const isCredit = item.estCredit;
              const montantVerse = item.montantVerse || 0;
              const montantTotal = item.montantTotal || 0;
              const progression = montantTotal > 0 ? montantVerse / montantTotal : 0;

              // Avatar
              const iconColor = isAnnulee ? '#dc2626' : '#16a34a';
              const avatarBg  = isAnnulee ? '#dc262222' : '#16a34a22';

              // Badge statut — BUG FIX : le backend ne renvoie jamais item.statut
              // (VenteMapper ne mappe pas ce champ), donc la branche 'COMPLETEE'
              // était du code mort. Le signal réel d'un crédit soldé est
              // item.creditRegle (comme Ionic sales.page.ts:270-284), et le
              // retard se déduit de dateEcheance dépassée.
              const isEnRetard = isCredit && !item.creditRegle && !!item.dateEcheance && new Date(item.dateEcheance) < new Date();
              let badgeBg: string, badgeColor: string, statusLabel: string;
              if (isAnnulee) {
                badgeBg = '#fee2e2'; badgeColor = '#dc2626'; statusLabel = 'ANNULEE';
              } else if (isCredit && item.creditRegle) {
                badgeBg = '#dcfce7'; badgeColor = '#16a34a'; statusLabel = 'REGLE';
              } else if (isEnRetard) {
                badgeBg = '#fee2e2'; badgeColor = '#dc2626'; statusLabel = 'EN RETARD';
              } else if (isCredit) {
                badgeBg = '#fef3c7'; badgeColor = '#d97706'; statusLabel = 'CREDIT';
              } else {
                badgeBg = '#eff6ff'; badgeColor = '#1a56db'; statusLabel = 'COMPTANT';
              }

              return (
                <Card
                  style={[styles.card, isAnnulee && styles.cardAnnulee]}
                  onPress={() => openModal(item)}
                >
                  <Card.Content style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                      <MaterialCommunityIcons
                        name={isAnnulee ? 'cart-remove' : 'cart-check'}
                        size={22}
                        color={iconColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.clientNom || tr('client_anonyme', lang)}
                      </Text>
                      <Text style={styles.cardSub}>
                        {new Date(item.dateVente).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                        {' · '}{(item.modePaiement || 'COMPTANT').replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.cardAmt}>{money(montantTotal)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.statusBadgeTxt, { color: badgeColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  </Card.Content>

                  {/* Section crédit (barre de progression) — masquée dès que le
                      crédit est réglé, comme Ionic (*ngIf="estCredit && !creditRegle"),
                      rouge en cas de retard (accent-red/progress-late côté Ionic). */}
                  {isCredit && !isAnnulee && !item.creditRegle && (
                    <Card.Content style={{ paddingTop: 0, paddingBottom: 8 }}>
                      <View style={styles.creditSection}>
                        <Text style={styles.creditInfo}>
                          {tr('verse', lang)} {money(montantVerse)} / {money(montantTotal)}
                        </Text>
                        <ProgressBar
                          progress={progression}
                          color={isEnRetard ? '#dc2626' : '#1a56db'}
                          style={styles.progressBar}
                        />
                      </View>
                    </Card.Content>
                  )}

                  {/* Actions directement sur la carte (comme .sale-actions d'Ionic) */}
                  {!isAnnulee && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => openModal(item)}>
                        <MaterialCommunityIcons name="eye-outline" size={15} color="#475569" />
                        <Text style={styles.cardActionTxt}>{tr('detail_vente', lang) || 'Détails'}</Text>
                      </TouchableOpacity>

                      {/* Modifier/Annuler ouverts à tous les rôles, comme sur Ionic
                          (sales.page.html ne restreint que sur !sale.annulee, jamais
                          sur le rôle) — pas de gate isAdmin ici. */}
                      <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionWarn]} onPress={() => openModifyDepuisCarte(item)}>
                        <MaterialCommunityIcons name="pencil-outline" size={15} color="#d97706" />
                        <Text style={[styles.cardActionTxt, styles.cardActionTxtWarn]}>{tr('modifier', lang)}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionDanger]} onPress={() => handleAnnuler(item)}>
                        <MaterialCommunityIcons name="cancel" size={15} color="#dc2626" />
                        <Text style={[styles.cardActionTxt, styles.cardActionTxtDanger]}>{tr('annuler', lang)}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionRetour]} onPress={() => openRetourDepuisCarte(item)}>
                        <MaterialCommunityIcons name="keyboard-return" size={15} color="#7c3aed" />
                        <Text style={[styles.cardActionTxt, styles.cardActionTxtRetour]}>Retour</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.cardActionBtn, styles.cardActionPrimary]} onPress={() => handleImprimerDepuisCarte(item)}>
                        <MaterialCommunityIcons name="download-outline" size={15} color="#fff" />
                        <Text style={[styles.cardActionTxt, styles.cardActionTxtPrimary]}>PDF</Text>
                      </TouchableOpacity>

                      {impressionTicketActif && (
                        <ImprimerTicketButton compact getTicket={() => getTicketPourVente(item)} />
                      )}

                      <TouchableOpacity style={styles.cardActionBtn} onPress={() => openQr(item)}>
                        <MaterialCommunityIcons name="qrcode" size={15} color="#475569" />
                        <Text style={styles.cardActionTxt}>QR</Text>
                      </TouchableOpacity>

                      {/* WhatsApp — parité avec sales.page.ts (bouton .saction--whatsapp,
                          désactivé + infobulle si le client n'a pas de téléphone). */}
                      <TouchableOpacity
                        style={[styles.cardActionBtn, styles.cardActionWhatsApp, !item.clientTelephone && styles.cardActionDisabled]}
                        onPress={() => envoyerFactureWhatsApp(item)}
                      >
                        <MaterialCommunityIcons name="whatsapp" size={15} color={item.clientTelephone ? '#16a34a' : '#94a3b8'} />
                        <Text style={[styles.cardActionTxt, item.clientTelephone && styles.cardActionTxtWhatsApp]}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            }}
          />
        </>
      )}

      {/* ══════════════ ONGLET ANNULEES ══════════════ */}
      {activeTab === 'annulees' && (
        loadingAnnulees ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color="#dc2626" />
        ) : (
          <FlatList
            data={ventesAnnulees}
            keyExtractor={(v: VenteAnnulee) => String(v.id)}
            refreshControl={
              <RefreshControl
                refreshing={refreshingAnnulees}
                onRefresh={() => {
                  setRefreshingAnnulees(true);
                  chargerAnnulees();
                }}
              />
            }
            contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="cart-off" size={64} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Aucune vente annulée</Text>
                <Text style={styles.emptySub}>Toutes les ventes sont actives</Text>
              </View>
            }
            renderItem={({ item }: { item: VenteAnnulee }) => (
              <Card style={styles.cardAnnuleeItem}>
                <Card.Content>
                  {/* Badge + numéro */}
                  <View style={styles.row}>
                    <View style={styles.badgeAnnuleeGrand}>
                      <Text style={styles.badgeAnnuleeGrandText}>ANNULEE</Text>
                    </View>
                    <Text style={styles.numeroVente} numberOfLines={1}>
                      {item.numeroVente || '#' + item.id}
                    </Text>
                  </View>

                  {/* Client + montant */}
                  <View style={[styles.row, { marginTop: 8 }]}>
                    <Text style={styles.clientNomAnn} numberOfLines={1}>
                      {item.clientNom || 'Client anonyme'}
                    </Text>
                    <Text style={styles.montantAnnulee}>{money(item.montantTotal)}</Text>
                  </View>

                  {/* Date vente */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Date vente</Text>
                    <Text style={styles.infoLineVal}>{formatDate(item.dateVente)}</Text>
                  </View>

                  {/* Vendu par */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Vendu par</Text>
                    <Text style={styles.infoLineVal}>{item.vendeurNom || '—'}</Text>
                  </View>

                  {/* Séparateur */}
                  <View style={styles.separateur} />

                  {/* Annulé par */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Annulé par</Text>
                    <Text style={styles.annuleurNom}>{item.annuleurNom || '—'}</Text>
                  </View>

                  {/* Date annulation */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Date annulation</Text>
                    <Text style={styles.infoLineVal}>{formatDate(item.dateAnnulation)}</Text>
                  </View>

                  {/* Motif (si présent) */}
                  {!!item.motifAnnulation && (
                    <View style={styles.motifBox}>
                      <Text style={styles.motifLabel}>Motif</Text>
                      <Text style={styles.motifText}>{item.motifAnnulation}</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}
          />
        )
      )}

      {/* ─── MODAL DETAIL (onglet Ventes) ─── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Header modal */}
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedVente ? (selectedVente.numeroVente || tr('detail_vente', lang)) : tr('detail_vente', lang)}
                </Text>
                {selectedVente && (
                  <Text style={styles.modalSub}>
                    {new Date(selectedVente.dateVente).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedVente && (
                <>
                  {/* Infos client */}
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>{tr('informations', lang)}</Text>
                    {[
                      [tr('clients', lang), selectedVente.clientNom || tr('client_anonyme', lang)],
                      selectedVente.clientTelephone ? [tr('telephone', lang), selectedVente.clientTelephone] : null,
                      ['N°', selectedVente.numeroVente || '—'],
                    ].filter((r): r is [string, string] => r !== null).map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoVal}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Produits */}
                  <Text style={styles.sectionTitle}>{tr('produits', lang)}</Text>
                  {loadingDetail ? (
                    <ActivityIndicator size="small" color="#1a56db" style={{ margin: 12 }} />
                  ) : venteDetail ? (
                    (() => {
                      const lignes: any[] = venteDetail.lignes || venteDetail.produits || [];
                      if (!lignes.length) return <Text style={styles.emptyText}>{tr('aucun_resultat', lang)}</Text>;
                      return lignes.map((l: any, i: number) => (
                        <View key={i} style={styles.ligneRow}>
                          <Text style={styles.ligneName} numberOfLines={2}>{l.produitNom}</Text>
                          <Text style={styles.ligneQty}>x{l.quantite}</Text>
                          <Text style={styles.lignePrice}>{money(l.sousTotal)}</Text>
                        </View>
                      ));
                    })()
                  ) : (
                    <Text style={styles.emptyText}>{tr('erreur', lang)}</Text>
                  )}

                  {/* Paiement */}
                  <View style={[styles.infoCard, { marginTop: 14 }]}>
                    <Text style={styles.sectionTitle}>{tr('paiement', lang)}</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{tr('mode', lang)}</Text>
                      <Text style={styles.infoVal}>
                        {(selectedVente.modePaiement || 'COMPTANT').replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{tr('total', lang)}</Text>
                      <Text style={[styles.infoVal, { fontWeight: 'bold', color: '#1a56db' }]}>
                        {money(selectedVente.montantTotal)}
                      </Text>
                    </View>
                    {selectedVente.estCredit && (
                      <>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>{tr('verse', lang)}</Text>
                          <Text style={[styles.infoVal, { color: '#16a34a' }]}>
                            {money(selectedVente.montantVerse || 0)}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>{tr('reste_du', lang)}</Text>
                          <Text style={[styles.infoVal, { color: '#dc2626', fontWeight: 'bold' }]}>
                            {money(selectedVente.montantRestant ?? Math.max(0, selectedVente.montantTotal - (selectedVente.montantVerse || 0)))}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Boutons footer */}
            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowModal(false)}>
                <Text style={styles.btnCloseText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity
                  style={styles.btnPrint}
                  onPress={() => handleImprimer(selectedVente, venteDetail)}
                >
                  <Text style={styles.btnPrintText}>{tr('imprimer', lang)}</Text>
                </TouchableOpacity>
              )}

              {impressionTicketActif && selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <ImprimerTicketButton compact getTicket={() => getTicketPourVente(selectedVente, venteDetail)} />
              )}

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity style={styles.btnQr} onPress={() => openQr(selectedVente)}>
                  <MaterialCommunityIcons name="qrcode" size={16} color="#fff" />
                  <Text style={styles.btnQrText}>QR</Text>
                </TouchableOpacity>
              )}

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity
                  style={styles.btnModify}
                  onPress={() => openModify(selectedVente, venteDetail)}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="#fff" />
                  <Text style={styles.btnModifyText}>{tr('modifier', lang)}</Text>
                </TouchableOpacity>
              )}

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity
                  style={styles.btnRetour}
                  onPress={() => openRetour(selectedVente, venteDetail)}
                >
                  <MaterialCommunityIcons name="keyboard-return" size={16} color="#fff" />
                  <Text style={styles.btnRetourText}>Retour</Text>
                </TouchableOpacity>
              )}

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity
                  style={[styles.btnCancel, annulationEnCours && { opacity: 0.5 }]}
                  onPress={() => handleAnnuler(selectedVente)}
                  disabled={annulationEnCours}
                >
                  {annulationEnCours
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.btnCancelText}>{tr('annuler_vente', lang)}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modale Statistiques ─────────────────────────────────────────── */}
      <Modal visible={showStatsModal} animationType="slide" transparent onRequestClose={() => setShowStatsModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Statistiques</Text>
                <Text style={styles.modalSub}>Chiffre d'affaires & top produits</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowStatsModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingStats ? (
              <ActivityIndicator style={{ padding: 30 }} size="large" color="#1a56db" />
            ) : (
              <ScrollView style={styles.modalBody}>
                <View style={styles.statCard}>
                  <Text style={styles.statCardTitle}>Aujourd'hui</Text>
                  {isAdmin && <Text style={styles.statCardVal}>{money(stats?.chiffreAffaireJournalier || 0)}</Text>}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statCardTitle}>Cette semaine</Text>
                  {isAdmin && <Text style={styles.statCardVal}>{money(stats?.chiffreAffaireHebdomadaire || 0)}</Text>}
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statCardTitle}>Ce mois</Text>
                  {isAdmin && <Text style={styles.statCardVal}>{money(stats?.chiffreAffaireMensuel || 0)}</Text>}
                </View>

                {topProduits.length > 0 && (
                  <View style={styles.statCard}>
                    <Text style={styles.statCardTitle}>Top produits</Text>
                    {topProduits.map((p, i) => (
                      <View key={i} style={styles.topProduitRow}>
                        <View style={styles.topProduitRank}>
                          <Text style={styles.topProduitRankText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.topProduitNom} numberOfLines={1}>{p.produitNom || p.nom}</Text>
                        <Text style={styles.topProduitQte}>{p.quantiteVendue || p.quantite || 0}x</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowStatsModal(false)}>
                <Text style={styles.btnCloseText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modale Modifier une vente ──────────────────────────────────── */}
      <Modal visible={showModifyModal} animationType="slide" transparent onRequestClose={() => setShowModifyModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>{tr('modifier', lang)} la vente</Text>
                {selectedVente && (
                  <Text style={styles.modalSub}>{selectedVente.numeroVente || `#${selectedVente.id}`}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModifyModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {modifyLines.map((l, i) => (
                <View key={i} style={styles.modifyLigneRow}>
                  <Text style={styles.modifyLigneNom} numberOfLines={1}>{l.produitNom}</Text>
                  <RNTextInput
                    style={styles.modifyQtyInput}
                    keyboardType="numeric"
                    value={String(l.quantite)}
                    onChangeText={(v) => updateModifyLine(i, { quantite: Number(v) || 0 })}
                  />
                  <MontantInput
                    style={styles.modifyPrixInput}
                    value={l.prixUnitaire || 0}
                    onChangeValue={(v) => updateModifyLine(i, { prixUnitaire: v })}
                  />
                  <TouchableOpacity style={styles.modifyRemoveBtn} onPress={() => removeModifyLine(i)}>
                    <MaterialCommunityIcons name="close" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.modifyAddBtn} onPress={addModifyLine} disabled={produitsPourModif.length === 0}>
                <MaterialCommunityIcons name="plus" size={16} color="#1a56db" />
                <Text style={styles.modifyAddBtnText}>Ajouter un article</Text>
              </TouchableOpacity>

              <RNTextInput
                style={styles.modifyMotifInput}
                placeholder="Motif (optionnel)"
                value={modifyMotif}
                onChangeText={setModifyMotif}
              />

              <View style={styles.modifyTotalRow}>
                <Text style={styles.modifyTotalLabel}>{tr('total', lang)}</Text>
                <Text style={styles.modifyTotalVal}>{money(modifyTotal)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowModifyModal(false)}>
                <Text style={styles.btnCloseText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSave, savingModify && { opacity: 0.5 }]}
                onPress={saveModify}
                disabled={savingModify}
              >
                {savingModify
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnSaveText}>{tr('enregistrer', lang)}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modale Retour d'articles ───────────────────────────────────── */}
      <Modal visible={showRetourModal} animationType="slide" transparent onRequestClose={() => setShowRetourModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>Retour d'articles</Text>
                {selectedVente && (
                  <Text style={styles.modalSub}>{selectedVente.numeroVente || `#${selectedVente.id}`}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowRetourModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {retourLignes.map((l, i) => (
                <View key={i} style={styles.retourLigneRow}>
                  <RadioButton
                    value={String(i)}
                    status={l.selected ? 'checked' : 'unchecked'}
                    onPress={() => setRetourLignes(prev => prev.map((x, idx) => idx === i ? { ...x, selected: !x.selected } : x))}
                  />
                  <View style={styles.retourLigneInfo}>
                    <Text style={styles.retourLigneNom} numberOfLines={1}>{l.produitNom}</Text>
                    <Text style={styles.retourLigneSub}>Vendu : {l.quantiteMax} × {money(l.prixUnitaire)}</Text>
                  </View>
                  <RNTextInput
                    style={styles.retourQtyInput}
                    keyboardType="numeric"
                    editable={l.selected}
                    value={String(l.quantiteRetournee)}
                    onChangeText={(v) => {
                      const q = Math.max(1, Math.min(l.quantiteMax, Number(v) || 1));
                      setRetourLignes(prev => prev.map((x, idx) => idx === i ? { ...x, quantiteRetournee: q } : x));
                    }}
                  />
                </View>
              ))}

              <RNTextInput
                style={styles.retourMotifInput}
                placeholder="Motif du retour (optionnel)"
                value={retourMotif}
                onChangeText={setRetourMotif}
              />

              <View style={styles.retourTotalRow}>
                <Text style={styles.retourTotalLabel}>Montant à rembourser</Text>
                <Text style={styles.retourTotalVal}>{money(totalRetour)}</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowRetourModal(false)}>
                <Text style={styles.btnCloseText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSubmitRetour, savingRetour && { opacity: 0.5 }]}
                onPress={submitRetour}
                disabled={savingRetour}
              >
                {savingRetour
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.btnSubmitRetourText}>Valider le retour</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modale QR code facture ─────────────────────────────────────── */}
      <Modal visible={showQrModal} animationType="slide" transparent onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>QR code facture</Text>
                {selectedVente && (
                  <Text style={styles.modalSub}>{selectedVente.numeroVente || `#${selectedVente.id}`}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowQrModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrContainer}>
              {qrUrl ? (
                <>
                  <QRCode value={qrUrl} size={200} />
                  <Text style={styles.qrUrlText}>{qrUrl}</Text>
                </>
              ) : (
                <Text style={styles.qrUrlText}>Lien de facture indisponible</Text>
              )}
            </View>

            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowQrModal(false)}>
                <Text style={styles.btnCloseText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modale confirmation annulation (avec motif, comme Ionic) ─────── */}
      <Modal visible={showAnnulerModal} animationType="slide" transparent onRequestClose={() => setShowAnnulerModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>{tr('annuler_vente', lang)}</Text>
                {venteAAnnuler && (
                  <Text style={styles.modalSub}>{venteAAnnuler.numeroVente || `#${venteAAnnuler.id}`}</Text>
                )}
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAnnulerModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16 }}>
              <Text style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 10 }}>
                ⚠ Action irréversible — le stock sera remis à jour.
              </Text>
              <RNTextInput
                style={styles.modifyMotifInput}
                placeholder="Motif (facultatif)"
                value={motifAnnulation}
                onChangeText={setMotifAnnulation}
                multiline
              />
            </View>

            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowAnnulerModal(false)}>
                <Text style={styles.btnCloseText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={confirmerAnnulation}>
                <Text style={styles.btnCancelText}>{tr('oui', lang) + ', ' + tr('annuler', lang).toLowerCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── FAB Nouvelle vente (comme Ionic sales page) ─── */}
      <FAB
        icon="cart-plus"
        style={styles.fab}
        onPress={() => navigation.navigate('Vente')}
        label="Nouvelle vente"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // FAB
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: '#1a56db' },

  // Onglets
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#1a56db' },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabBtnTextActive: { color: '#1a56db' },
  tabBadge: { backgroundColor: '#dc2626', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Hero (réplique de .sales-hero Ionic)
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 16, gap: 12 },
  heroLeft: { flex: 1.3, justifyContent: 'center' },
  heroEyebrow: { color: '#93c5fd', fontSize: 11, fontWeight: '600' },
  heroAmount: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  heroSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  heroSub: { color: '#93c5fd', fontSize: 12 },
  heroRight: { flex: 1, gap: 8 },
  heroMiniCard: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 8 },
  hmcLabel: { color: '#93c5fd', fontSize: 10, marginTop: 3 },
  hmcVal: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginTop: 1 },
  hmcValWarn: { color: '#fbbf24' },

  // Offline
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  // Période
  periodRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  periodBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  periodBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },

  // Chips type
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, marginBottom: 2 },
  filterChip: { backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  filterChipActive: { backgroundColor: '#1a56db' },
  filterChipText: { fontSize: 12, color: '#555' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // Searchbar
  search: { marginHorizontal: 12, marginTop: 6, marginBottom: 4, borderRadius: 12, elevation: 0, backgroundColor: '#fff' },

  // Card design system (onglet Ventes)
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 16, elevation: 1 },
  cardAnnulee: { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },

  // Badge statut
  statusBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  statusBadgeTxt: { fontSize: 10, fontWeight: 'bold' },

  // Section crédit
  creditSection: { marginTop: 4 },
  creditInfo: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: '#e5e7eb' },

  // Actions sur carte (réplique de .sale-actions Ionic)
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 9 },
  cardActionTxt: { fontSize: 11, fontWeight: '600', color: '#475569' },
  cardActionWarn: { backgroundColor: '#fef3c7' },
  cardActionTxtWarn: { color: '#d97706' },
  cardActionDanger: { backgroundColor: '#fee2e2' },
  cardActionTxtDanger: { color: '#dc2626' },
  cardActionRetour: { backgroundColor: '#ede9fe' },
  cardActionTxtRetour: { color: '#7c3aed' },
  cardActionPrimary: { backgroundColor: '#1a56db' },
  cardActionTxtPrimary: { color: '#fff' },
  cardActionWhatsApp: { backgroundColor: '#dcfce7' },
  cardActionTxtWhatsApp: { color: '#16a34a' },
  cardActionDisabled: { opacity: 0.5 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#aaa', fontSize: 13, padding: 12 },

  // Card annulée (onglet Annulées)
  cardAnnuleeItem: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  badgeAnnuleeGrand: { backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeAnnuleeGrandText: { color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  numeroVente: { flex: 1, textAlign: 'right', color: '#555', fontSize: 13, fontWeight: '600' },
  clientNomAnn: { flex: 1, fontWeight: 'bold', color: '#1a1a1a', marginRight: 8 },
  montantAnnulee: { fontWeight: 'bold', color: '#dc2626', fontSize: 16 },
  infoLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLineLabel: { color: '#888', fontSize: 12, flex: 1 },
  infoLineVal: { color: '#333', fontSize: 12, fontWeight: '500', flex: 2, textAlign: 'right' },
  separateur: { height: 1, backgroundColor: '#fee2e2', marginVertical: 8 },
  annuleurNom: { color: '#dc2626', fontSize: 12, fontWeight: 'bold', flex: 2, textAlign: 'right' },
  motifBox: { backgroundColor: '#fff7f7', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  motifLabel: { color: '#dc2626', fontSize: 11, fontWeight: 'bold', marginBottom: 3, textTransform: 'uppercase' },
  motifText: { color: '#555', fontSize: 13, fontStyle: 'italic' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 17, color: '#1a1a1a' },
  modalSub: { fontSize: 12, color: '#888', marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  modalBody: { padding: 16, maxHeight: 440 },

  // Info card (modal)
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 10 },
  sectionTitle: { fontWeight: 'bold', color: '#1a56db', fontSize: 13, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Lignes produits (modal)
  ligneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  ligneName: { flex: 1, color: '#333', fontSize: 13 },
  ligneQty: { color: '#888', fontSize: 12, marginHorizontal: 10 },
  lignePrice: { color: '#1a56db', fontWeight: '600', fontSize: 13 },

  // Footer modal
  modalFoot: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', flexWrap: 'wrap' },
  btnClose: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 80 },
  btnCloseText: { color: '#666', fontWeight: '600' },
  btnPrint: { flex: 1, backgroundColor: '#1a56db', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 80 },
  btnPrintText: { color: '#fff', fontWeight: 'bold' },
  btnCancel: { flex: 1, backgroundColor: '#dc2626', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 100 },
  btnCancelText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnQr: { flex: 1, flexDirection: 'row', gap: 5, backgroundColor: '#334155', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 70 },
  btnQrText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnModify: { flex: 1, flexDirection: 'row', gap: 5, backgroundColor: '#d97706', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 90 },
  btnModifyText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  btnRetour: { flex: 1, flexDirection: 'row', gap: 5, backgroundColor: '#7c3aed', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 90 },
  btnRetourText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Statistiques
  statCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 14, marginBottom: 10 },
  statCardTitle: { fontWeight: 'bold', color: '#1a56db', fontSize: 13, marginBottom: 8 },
  statCardVal: { fontSize: 22, fontWeight: 'bold', color: '#081648' },
  statCardSub: { fontSize: 12, color: '#888', marginTop: 2 },
  topProduitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  topProduitRank: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  topProduitRankText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  topProduitNom: { flex: 1, fontSize: 13, color: '#333' },
  topProduitQte: { fontSize: 12, color: '#888', marginRight: 8 },
  topProduitCa: { fontSize: 13, fontWeight: '600', color: '#1a56db' },

  // Modifier une vente
  modifyLigneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 8 },
  modifyLigneNom: { flex: 1, fontSize: 13, color: '#333' },
  modifyQtyInput: { width: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6, textAlign: 'center', fontSize: 13 },
  modifyPrixInput: { width: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6, textAlign: 'center', fontSize: 13 },
  modifyRemoveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' },
  modifyAddBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1a56db', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 10, marginTop: 8 },
  modifyAddBtnText: { color: '#1a56db', fontWeight: '600', fontSize: 13 },
  modifyMotifInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 10 },
  dateRangeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8, alignItems: 'center' },
  dateRangeInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12.5, backgroundColor: '#fff' },
  dateRangeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center' },
  modifyTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4 },
  modifyTotalLabel: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  modifyTotalVal: { fontWeight: 'bold', fontSize: 16, color: '#1a56db' },
  btnSave: { flex: 1, backgroundColor: '#16a34a', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 100 },
  btnSaveText: { color: '#fff', fontWeight: 'bold' },

  // Retour d'articles
  retourLigneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 8 },
  retourLigneInfo: { flex: 1 },
  retourLigneNom: { fontSize: 13, color: '#333', fontWeight: '500' },
  retourLigneSub: { fontSize: 11, color: '#888', marginTop: 2 },
  retourQtyInput: { width: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 6, textAlign: 'center', fontSize: 13 },
  retourMotifInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginTop: 10 },
  retourTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4 },
  retourTotalLabel: { fontWeight: 'bold', fontSize: 14, color: '#333' },
  retourTotalVal: { fontWeight: 'bold', fontSize: 16, color: '#dc2626' },
  btnSubmitRetour: { flex: 1, backgroundColor: '#7c3aed', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 100 },
  btnSubmitRetourText: { color: '#fff', fontWeight: 'bold' },

  // QR code
  qrContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  qrUrlText: { fontSize: 11, color: '#888', marginTop: 14, textAlign: 'center', paddingHorizontal: 16 },
});
