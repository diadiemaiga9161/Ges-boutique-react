import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, ActivityIndicator, Switch } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkeletonCard } from '../components/SkeletonLoader';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getProduits, getClients, getSoldeAvanceClient } from '../services/api.service';
import { getProduitsCache, getClientsCache, cacheProduits } from '../db/database';
import { enregistrerVente, getNombreVentesPending, sauvegarderCache, lireCache } from '../services/offline.service';
import { Produit, Client, LigneVenteRequest } from '../types';
import { ProduitNiveau, getNiveauxEtPrincipal, calculerFacteurTotal, disponibleNiveau } from '../services/produit-niveau.service';
import { Promotion, getPromosPourProduit, calculerPrixPromo } from '../services/promotion.service';
import { showToast } from '../services/toast.service';
import { annoncerMontantVente } from '../services/vocalConfirmation.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';
import { MontantInput } from '../components/MontantInput';

interface CartItem {
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remisePourcentage: number;
  niveauId?: number;
  niveauNom?: string;
  niveauPrixAchat?: number;
  niveauFacteurTotal?: number;
  niveauStockMax?: number;
  // BUG FIX (2026-08-16) : parité Ionic (cart.page.ts addWithPromo/choisirNiveau)
  // — la promo active était vérifiée et appliquée automatiquement à l'ajout
  // au panier côté Ionic, jamais côté React Native (toujours prix plein).
  promo?: Promotion;
  prixOriginal?: number;
  // BUG FIX (2026-08-16) : parité Ionic (ci-price-btn/toggleEditPrice) — le
  // prix était toujours un champ éditable ouvert côté React Native ; Ionic le
  // cache par défaut derrière une icône crayon.
  editingPrice?: boolean;
}

const MODES_PAIEMENT = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE_MONEY', 'CARTE_BANCAIRE', 'VIREMENT'];

const MODES_LABELS: Record<string, string> = {
  'ESPECES': 'Espèces',
  'ORANGE_MONEY': 'Orange Money',
  'MOOV_MONEY': 'Moov Money',
  'WAVE_MONEY': 'Wave',
  'CARTE_BANCAIRE': 'Carte Bancaire',
  'VIREMENT': 'Virement',
};

const PAYMENT_ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  ESPECES: 'cash', ORANGE_MONEY: 'cellphone', MOOV_MONEY: 'cellphone',
  WAVE_MONEY: 'cellphone', CARTE_BANCAIRE: 'credit-card-outline', VIREMENT: 'bank-transfer',
};

const toLocalDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
};

const calculerPrixApresRemise = (prix: number, remisePourcentage?: number | null) => {
  if (remisePourcentage && remisePourcentage > 0) return Math.max(0, prix - (prix * remisePourcentage / 100));
  return prix;
};

const dateEcheanceParDefaut = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return toLocalDateStr(d);
};

export default function VenteScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const navigation = useNavigation<any>();

  // ─── Produits ────────────────────────────────────────────────────────────
  const [produits, setProduits] = useState<Produit[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [ventesPending, setVentesPending] = useState(0);
  const [userId, setUserId] = useState<number>(0);

  // ─── Panier ──────────────────────────────────────────────────────────────
  const [panier, setPanier] = useState<CartItem[]>([]);

  // ─── Client ──────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientsFiltres, setClientsFiltres] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientNom, setClientNom] = useState('');
  const [clientPrenom, setClientPrenom] = useState('');
  const [clientTelephone, setClientTelephone] = useState('');
  const [creerClient, setCreerClient] = useState(false);

  // ─── Paiement ────────────────────────────────────────────────────────────
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [remiseGlobale, setRemiseGlobale] = useState('');
  const [typeRemiseGlobale, setTypeRemiseGlobale] = useState<'POURCENTAGE' | 'MONTANT_FIXE'>('POURCENTAGE');

  // ─── Crédit ──────────────────────────────────────────────────────────────
  const [estCredit, setEstCredit] = useState(false);
  const [dateEcheance, setDateEcheance] = useState(dateEcheanceParDefaut());
  const [montantVerse, setMontantVerse] = useState(0);
  const [soldeAvanceClient, setSoldeAvanceClient] = useState(0);
  const [utiliserAvance, setUtiliserAvance] = useState(false);
  const [montantAvanceAUtiliser, setMontantAvanceAUtiliser] = useState(0);
  const [isLoadingAvance, setIsLoadingAvance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── Conditionnement ─────────────────────────────────────────────────────
  const [showNiveauModal, setShowNiveauModal] = useState(false);
  const [produitEnAttente, setProduitEnAttente] = useState<Produit | null>(null);
  const [niveauxDisponibles, setNiveauxDisponibles] = useState<ProduitNiveau[]>([]);
  const [quantitePrincipale, setQuantitePrincipale] = useState<number>(0);
  const [loadingNiveaux, setLoadingNiveaux] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) { try { setUserId(JSON.parse(raw)?.id || 0); } catch {} }
    });
  }, []);

  // En-tête : lien rapide vers l'historique des ventes (comme receipt-outline d'Ionic).
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Ventes')} style={{ marginRight: 14 }}>
          <MaterialCommunityIcons name="receipt-text-outline" color="#fff" size={22} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const charger = useCallback(async () => {
    // On tente toujours l'appel réel en premier — NetInfo.fetch() n'est pas fiable en
    // contexte navigateur (React Native Web) et peut signaler "hors ligne" à tort,
    // ce qui ferait sauter l'appel au backend même quand celui-ci répond très bien.
    try {
      const [rP, rC] = await Promise.all([getProduits(), getClients()]);
      const p = (rP.data?.data || rP.data || []).filter((x: Produit) => x.quantite > 0);
      const c = rC.data?.data || rC.data || [];
      setProduits(p); setClients(c); setFiltered(p.slice(0, 20));
      setFromCache(false);
      setOffline(false);
      await cacheProduits(p);
      sauvegarderCache('vente_produits', p).catch(() => {});
    } catch {
      setOffline(true);
      const [p, c] = await Promise.all([getProduitsCache(), getClientsCache()]);
      const disponibles = p.filter((x: Produit) => x.quantite > 0);
      setProduits(disponibles); setClients(c); setFiltered(disponibles.slice(0, 20));
      setFromCache(disponibles.length > 0);
    }
    const n = await getNombreVentesPending();
    setVentesPending(n);
    setLoading(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    const liste = produits.filter(p => !q || p.nom.toLowerCase().includes(q) || p.codeBarre?.toLowerCase().includes(q));
    setFiltered(liste.slice(0, 20));
  }, [search, produits]);

  // ─── Client : recherche / sélection ─────────────────────────────────────
  const filterClients = (term: string) => {
    setClientSearch(term);
    const t = term.trim().toLowerCase();
    if (!t) { setClientsFiltres(clients.slice(0, 8)); setShowClientDropdown(false); return; }
    const f = clients.filter(c =>
      (c.nom || '').toLowerCase().includes(t) || (c.telephone || '').includes(t)
    ).slice(0, 10);
    setClientsFiltres(f);
    setShowClientDropdown(f.length > 0);
  };

  const pickClient = async (c: Client) => {
    setClientId(c.id);
    setClientSearch(`${c.nom || ''}${c.telephone ? ' · ' + c.telephone : ''}`);
    setShowClientDropdown(false);
    setClientNom(c.nom || '');
    setClientPrenom('');
    setClientTelephone(c.telephone || '');
    setCreerClient(false);
    setSoldeAvanceClient(0);
    setUtiliserAvance(false);
    setMontantAvanceAUtiliser(0);
    if (c.nom) {
      setIsLoadingAvance(true);
      try {
        const res = await getSoldeAvanceClient(c.nom, c.telephone);
        setSoldeAvanceClient(res.data?.soldeDisponible || 0);
      } catch {
        setSoldeAvanceClient(0);
      }
      setIsLoadingAvance(false);
    }
  };

  const clearClient = () => {
    setClientId(null);
    setClientSearch('');
    setClientNom('');
    setClientPrenom('');
    setClientTelephone('');
    setShowClientDropdown(false);
    setSoldeAvanceClient(0);
    setUtiliserAvance(false);
    setMontantAvanceAUtiliser(0);
  };

  // ─── Scanner ─────────────────────────────────────────────────────────────
  const onCodeScanne = (code: string) => {
    const found = produits.find(p =>
      p.codeBarre === code || p.nom.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      ajouterAuPanier(found);
    } else {
      setSearch(code);
      Alert.alert('Code scanné', `Code "${code}" non trouvé — affiché dans la recherche.`);
    }
  };

  // ─── Ajout au panier ─────────────────────────────────────────────────────
  const ajouterAuPanier = async (p: Produit) => {
    if (p.quantite <= 0) {
      Alert.alert(tr('rupture_stock', lang), `${p.nom} est en rupture de stock.`);
      return;
    }
    const existant = panier.find(i => i.produit.id === p.id && !i.niveauId);
    if (existant) {
      if (existant.quantite >= p.quantite) {
        Alert.alert(tr('stock_insuffisant', lang), `Stock maximum atteint : ${p.quantite} unité(s).`);
        return;
      }
      modifierQte(p.id, 1);
      return;
    }
    setLoadingNiveaux(true);
    try {
      const { niveaux, quantitePrincipale: qp } = await getNiveauxEtPrincipal(p.id);
      if (niveaux.length > 0) {
        setNiveauxDisponibles(niveaux);
        setQuantitePrincipale(qp);
        setProduitEnAttente(p);
        setShowNiveauModal(true);
        setLoadingNiveaux(false);
        return;
      }
    } catch {
      // pas de niveaux ou erreur → ajout direct
    }
    setLoadingNiveaux(false);
    ajouterSansNiveau(p);
  };

  // BUG FIX (2026-08-16) : parité Ionic (addWithPromo) — vérifie la promo
  // active du produit avant d'ajouter au panier, applique le prix réduit et
  // affiche un toast, exactement comme cart.page.ts. Auparavant, aucun appel
  // au service promotions n'existait ici : toute vente passait au prix plein
  // même avec une promo active.
  const ajouterSansNiveau = async (p: Produit) => {
    let promo: Promotion | undefined;
    const prixOriginal = p.prixVente;
    let prixUnitaire = prixOriginal;
    try {
      const promos = await getPromosPourProduit(p.id);
      if (promos.length > 0) {
        promo = promos[0];
        prixUnitaire = calculerPrixPromo(prixOriginal, promo);
      }
    } catch { /* pas de promo trouvable → prix plein */ }
    setPanier(prev => {
      const idx = prev.findIndex(i => i.produit.id === p.id && !i.niveauId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantite: updated[idx].quantite + 1 };
        return updated;
      }
      return [...prev, { produit: p, quantite: 1, prixUnitaire, remisePourcentage: 0, promo, prixOriginal }];
    });
    if (promo) {
      const label = promo.typeReduction === 'POURCENTAGE' ? `-${promo.valeurReduction}%` : `-${promo.valeurReduction} FCFA`;
      showToast(`🏷️ ${promo.titre} ${label} appliqué`, 'success');
    }
  };

  const choisirNiveau = async (niveau: ProduitNiveau) => {
    const p = produitEnAttente;
    if (!p) return;
    const facteurTotal = niveau.id !== undefined
      ? calculerFacteurTotal(niveauxDisponibles, niveau.id, true)
      : calculerFacteurTotal(niveauxDisponibles, niveau.ordre ?? 1, false);
    // Cascade récursive jusqu'à la racine (pas seulement le parent direct) —
    // sinon on bloque l'ajout au panier alors que le backend pourrait
    // décomposer plusieurs crans (ex: Carton → Paquet → Pièce d'un coup).
    const niveauStockMax = niveau.id !== undefined ? disponibleNiveau(niveauxDisponibles, niveau.id, quantitePrincipale) : (niveau.stock ?? 0);
    setShowNiveauModal(false);
    setProduitEnAttente(null);

    // BUG FIX (2026-08-16) : même parité promo qu'en ajout direct (voir
    // ajouterSansNiveau) — Ionic vérifie aussi la promo dans choisirNiveau().
    let promo: Promotion | undefined;
    const prixOriginal = niveau.prixVente;
    let prixUnitaire = prixOriginal;
    try {
      const promos = await getPromosPourProduit(p.id);
      if (promos.length > 0) {
        promo = promos[0];
        prixUnitaire = calculerPrixPromo(prixOriginal, promo);
      }
    } catch { /* pas de promo trouvable → prix plein */ }

    setPanier(prev => {
      const idx = prev.findIndex(i => i.produit.id === p.id && i.niveauId === niveau.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantite: updated[idx].quantite + 1 };
        return updated;
      }
      return [...prev, {
        produit: p,
        quantite: 1,
        prixUnitaire,
        remisePourcentage: 0,
        niveauId: niveau.id,
        niveauNom: niveau.nom,
        niveauPrixAchat: niveau.prixAchat,
        niveauFacteurTotal: facteurTotal,
        niveauStockMax,
        promo,
        prixOriginal,
      }];
    });
    if (promo) {
      const label = promo.typeReduction === 'POURCENTAGE' ? `-${promo.valeurReduction}%` : `-${promo.valeurReduction} FCFA`;
      showToast(`🏷️ ${promo.titre} ${label} appliqué`, 'success');
    }
  };

  const getStockMax = (item: CartItem) => (item.niveauId !== undefined && item.niveauStockMax !== undefined ? item.niveauStockMax : item.produit.quantite);

  const modifierQte = (id: number, delta: number, niveauId?: number) => {
    setPanier(prev => {
      const item = prev.find(i => i.produit.id === id && i.niveauId === niveauId);
      if (item && delta > 0 && item.quantite >= getStockMax(item)) {
        Alert.alert(tr('stock_insuffisant', lang), `Stock maximum : ${getStockMax(item)} unité(s).`);
        return prev;
      }
      return prev
        .map(i => (i.produit.id === id && i.niveauId === niveauId) ? { ...i, quantite: i.quantite + delta } : i)
        .filter(i => i.quantite > 0);
    });
  };

  const modifierPrixLigne = (id: number, niveauId: number | undefined, val: number) => {
    setPanier(prev => prev.map(i => (i.produit.id === id && i.niveauId === niveauId)
      ? { ...i, prixUnitaire: isNaN(val) || val < 0 ? 0 : val }
      : i));
  };

  // BUG FIX (2026-08-16) : parité Ionic (ci-qty-input) — permet de taper la
  // quantité directement, en plus des boutons −/+ (clampée entre 1 et le
  // stock max, comme clampQty() côté Ionic).
  const modifierQteDirecte = (id: number, niveauId: number | undefined, valeur: string) => {
    const val = parseInt(valeur, 10);
    setPanier(prev => prev.map(i => {
      if (i.produit.id !== id || i.niveauId !== niveauId) return i;
      const max = getStockMax(i);
      let q = isNaN(val) || val < 1 ? 1 : val;
      if (q > max) {
        q = max;
        showToast(`Stock maximum : ${max} unité(s)`, 'error');
      }
      return { ...i, quantite: q };
    }));
  };

  // BUG FIX (2026-08-16) : parité Ionic (toggleEditPrice) — le prix se
  // cache/affiche via une icône crayon ; fermer l'édition annule la saisie
  // et revient au prix de base de la ligne (celui du niveau vendu si
  // applicable, sinon celui du produit — prixOriginal, déjà suivi pour les
  // promos), comme item.product.prixVente côté Ionic.
  const toggleEditPrice = (id: number, niveauId: number | undefined) => {
    setPanier(prev => prev.map(i => {
      if (i.produit.id !== id || i.niveauId !== niveauId) return i;
      const editing = !i.editingPrice;
      return { ...i, editingPrice: editing, prixUnitaire: editing ? i.prixUnitaire : (i.prixOriginal ?? i.produit.prixVente) };
    }));
  };

  const modifierRemiseLigne = (id: number, niveauId: number | undefined, remise: string) => {
    const val = parseFloat(remise);
    setPanier(prev => prev.map(i => (i.produit.id === id && i.niveauId === niveauId)
      ? { ...i, remisePourcentage: isNaN(val) ? 0 : Math.max(0, Math.min(100, val)) }
      : i));
  };

  const retirerLigne = (id: number, niveauId?: number) => {
    setPanier(prev => prev.filter(i => !(i.produit.id === id && i.niveauId === niveauId)));
  };

  // ─── Totaux ──────────────────────────────────────────────────────────────
  const totalLigne = (item: CartItem) => calculerPrixApresRemise(item.prixUnitaire, item.remisePourcentage) * item.quantite;
  const subTotal = panier.reduce((s, i) => s + totalLigne(i), 0);
  const total = (() => {
    const rg = parseFloat(remiseGlobale) || 0;
    if (!rg) return subTotal;
    if (typeRemiseGlobale === 'POURCENTAGE') return Math.max(0, subTotal - (subTotal * rg / 100));
    return Math.max(0, subTotal - rg);
  })();
  const resteAPayerCredit = Math.max(0, total - (montantVerse || 0) - (utiliserAvance ? (montantAvanceAUtiliser || 0) : 0));

  // BUG FIX (2026-08-16) : parité Ionic (cart.page.ts getBeneficeTotal) — le
  // bénéfice/perte estimé du panier entier n'était affiché nulle part côté
  // React Native (seulement ligne par ligne), contrairement à Ionic qui
  // l'affiche juste sous le sous-total dans la carte des totaux.
  const remiseGlobaleMontant = Math.max(0, subTotal - total);
  const beneficeTotal = Math.round(panier.reduce((s, i) => {
    const prixAchatEffectif = i.niveauId ? (i.niveauPrixAchat || 0) : (i.produit.prixAchat || 0);
    return s + (calculerPrixApresRemise(i.prixUnitaire, i.remisePourcentage) - prixAchatEffectif) * i.quantite;
  }, 0) - remiseGlobaleMontant);
  const beneficeTotalLabel = beneficeTotal > 0 ? 'Bénéfice estimé' : beneficeTotal < 0 ? 'Perte estimée' : 'Équilibre';
  const beneficeTotalColor = beneficeTotal > 0 ? colors.success : beneficeTotal < 0 ? colors.danger : colors.textSecondary;

  const utiliserTouteAvance = () => setMontantAvanceAUtiliser(Math.min(soldeAvanceClient, total));

  // ─── Stock local (optimiste après vente) ────────────────────────────────
  const mettreAJourStockLocal = (panierVendu: CartItem[]) => {
    setProduits(prev => {
      const updated = prev.map(p => {
        const total = panierVendu.filter(i => i.produit.id === p.id && !i.niveauId).reduce((s, i) => s + i.quantite, 0);
        return total > 0 ? { ...p, quantite: Math.max(0, p.quantite - total) } : p;
      });
      cacheProduits(updated);
      return updated;
    });
  };

  const reset = () => {
    setPanier([]);
    setReferencePaiement('');
    setRemiseGlobale('');
    setTypeRemiseGlobale('POURCENTAGE');
    clearClient();
    setCreerClient(false);
    setMontantVerse(0);
    setEstCredit(false);
    setDateEcheance(dateEcheanceParDefaut());
  };

  // ─── Validation / envoi ──────────────────────────────────────────────────
  const valider = async () => {
    if (panier.length === 0) {
      Alert.alert(tr('erreur', lang), 'Ajoutez au moins un produit');
      return;
    }
    if (estCredit && !clientNom.trim()) {
      Alert.alert(tr('erreur', lang), 'Nom client obligatoire pour un crédit');
      return;
    }
    for (const item of panier) {
      const max = getStockMax(item);
      if (item.quantite > max) {
        Alert.alert(tr('stock_insuffisant', lang), `${item.produit.nom} : demandé ${item.quantite}, disponible ${max}`);
        return;
      }
    }
    if (modePaiement !== 'ESPECES' && !referencePaiement.trim()) {
      Alert.alert(tr('erreur', lang), `Référence obligatoire pour ${MODES_LABELS[modePaiement] || modePaiement}`);
      return;
    }

    setSubmitting(true);
    const lignes: LigneVenteRequest[] = panier.map(i => ({
      produitId: i.produit.id,
      quantite: i.quantite,
      prixUnitaire: i.prixUnitaire,
      remisePourcentage: i.remisePourcentage || undefined,
      prixAchat: i.niveauPrixAchat || undefined,
      niveauId: i.niveauId,
      niveauNom: i.niveauNom,
      niveauFacteur: i.niveauFacteurTotal || 1,
    }));
    const vente = {
      vendeurId: userId,
      lignes,
      modePaiement,
      referencePaiement: referencePaiement.trim() || undefined,
      remiseGlobale: Number(remiseGlobale || 0),
      typeRemiseGlobale,
      clientId: clientId || undefined,
      clientNom: clientNom.trim() || undefined,
      clientPrenom: clientPrenom.trim() || undefined,
      clientTelephone: clientTelephone.trim() || undefined,
      dateEcheance: estCredit ? dateEcheance : undefined,
      montantVerse: estCredit ? (montantVerse || 0) : 0,
      montantAvanceUtilise: estCredit && utiliserAvance ? Math.min(montantAvanceAUtiliser || 0, soldeAvanceClient) : 0,
      creerClient,
      clientDivers: !clientId && !clientNom.trim(),
      estCredit,
    };
    const panierSnapshot = [...panier];
    const result = await enregistrerVente(vente);
    setSubmitting(false);
    if (result.success) {
      mettreAJourStockLocal(panierSnapshot);
      const msg = result.offline ? tr('vente_hors_ligne', lang) : tr('vente_enregistree', lang);
      Alert.alert(result.offline ? tr('hors_ligne', lang) : tr('succes', lang), msg);
      // Confirmation vocale "fire and forget" — ne bloque jamais la
      // validation de vente, avale toute erreur en interne (voir
      // vocalConfirmation.service.ts). Réglable et activée par défaut
      // depuis "Mon profil".
      annoncerMontantVente(total);
      reset();
      const n = await getNombreVentesPending();
      setVentesPending(n);
    } else {
      Alert.alert(tr('erreur', lang), result.error || 'Erreur lors de l\'enregistrement de la vente');
    }
  };

  if (loading) return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 12 }}>
      <SkeletonCard count={6} />
    </ScrollView>
  );

  const SectionHead = ({ num, title, sub, badge }: { num: number; title: string; sub: string; badge?: number }) => (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionNum, { backgroundColor: colors.primary }]}>
        <Text style={styles.sectionNumText}>{num}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      {!!badge && (
        <View style={[styles.cartBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.cartBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

        {ventesPending > 0 && (
          <View style={styles.pendingBanner}>
            <MaterialCommunityIcons name="clock-outline" size={14} color="#92400e" />
            <Text style={styles.cacheTxt}>{ventesPending} vente(s) en attente de synchronisation</Text>
          </View>
        )}

        {/* ══════════ SECTION 1 — RECHERCHE PRODUIT ══════════ */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SectionHead num={1} title="Sélectionner les produits" sub="Tapez le nom ou scannez un code-barres" />

          <View style={[styles.searchWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
            <RNTextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Produit ou code-barres..."
              placeholderTextColor={colors.placeholder}
            />
            <TouchableOpacity onPress={() => setShowScanner(true)} style={styles.scanBtn}>
              <MaterialCommunityIcons name="barcode-scan" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.productsGrid}>
            {filtered.map(product => (
              <TouchableOpacity
                key={product.id}
                style={[styles.productChip, { backgroundColor: colors.background, borderColor: colors.border }, product.quantite <= 0 && { opacity: 0.4 }]}
                onPress={() => ajouterAuPanier(product)}
                disabled={product.quantite <= 0}
              >
                <View style={[styles.pcIcon, { backgroundColor: colors.primary + '18' }]}>
                  <MaterialCommunityIcons name="cube-outline" size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.pcName, { color: colors.text }]}>{product.nom}</Text>
                  <Text style={[styles.pcPrice, { color: colors.primary }]}>{product.prixVente?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
                </View>
                <Text style={[styles.pcStock, product.quantite <= 5 && { color: '#dc2626' }]}>{product.quantite}</Text>
                <MaterialCommunityIcons name="plus-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </View>

          {search && filtered.length === 0 && (
            <View style={styles.searchEmpty}>
              <MaterialCommunityIcons name="magnify-close" size={40} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 6 }}>Aucun produit trouvé</Text>
            </View>
          )}
        </View>

        {/* ══════════ SECTION 2 — PANIER ══════════ */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SectionHead num={2} title="Panier" sub={`${panier.length} article${panier.length > 1 ? 's' : ''}`} badge={panier.length} />

          {panier.length === 0 ? (
            <View style={styles.searchEmpty}>
              <MaterialCommunityIcons name="cart-outline" size={40} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 6 }}>Aucun article — sélectionnez des produits ci-dessus</Text>
            </View>
          ) : (
            panier.map(item => {
              const prixAchatEffectif = item.niveauId ? (item.niveauPrixAchat || 0) : (item.produit.prixAchat || 0);
              const beneficeLigne = (calculerPrixApresRemise(item.prixUnitaire, item.remisePourcentage) - prixAchatEffectif) * item.quantite;
              const beneficeColor = beneficeLigne > 0 ? colors.success : beneficeLigne < 0 ? colors.danger : colors.textSecondary;
              const beneficeLabel = beneficeLigne > 0 ? 'Bénéfice' : beneficeLigne < 0 ? 'Perte' : 'Équilibre';
              const stockMax = getStockMax(item);
              const key = `${item.produit.id}_${item.niveauId ?? 'base'}`;
              return (
                <View key={key} style={[styles.cartItem, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.ciName, { color: colors.text }]}>{item.produit.nom}</Text>
                    {item.niveauNom && (
                      <View style={[styles.niveauBadge, { backgroundColor: colors.primary + '18' }]}>
                        <MaterialCommunityIcons name="layers-outline" size={11} color={colors.primary} />
                        <Text style={[styles.niveauBadgeText, { color: colors.primary }]}>{item.niveauNom}</Text>
                      </View>
                    )}

                    {/* Badge promo active (parité Ionic ci-promo-badge) */}
                    {item.promo && (
                      <View style={[styles.niveauBadge, { backgroundColor: '#fef3c7' }]}>
                        <MaterialCommunityIcons name="tag" size={11} color="#b45309" />
                        <Text style={[styles.niveauBadgeText, { color: '#b45309' }]}>
                          {item.promo.titre} {item.promo.typeReduction === 'POURCENTAGE' ? `-${item.promo.valeurReduction}%` : `-${item.promo.valeurReduction} FCFA`}
                        </Text>
                        {item.prixOriginal !== undefined && (
                          <Text style={{ fontSize: 10, color: '#92400e', textDecorationLine: 'line-through', marginLeft: 4 }}>
                            {item.prixOriginal.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Prix de vente — masqué derrière une icône crayon par défaut,
                        comme Ionic (ci-price-btn / toggleEditPrice), au lieu d'un
                        champ toujours ouvert. */}
                    <View style={styles.ciPriceRow}>
                      <Text style={{ fontSize: 12, color: colors.text, flex: 1 }}>
                        {item.prixUnitaire.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA / unité
                        {item.prixUnitaire !== (item.prixOriginal ?? item.produit.prixVente) && !item.promo && (
                          <Text style={{ color: colors.primary, fontWeight: '700' }}> · modifié</Text>
                        )}
                      </Text>
                      <TouchableOpacity onPress={() => toggleEditPrice(item.produit.id, item.niveauId)} style={styles.ciPriceBtn}>
                        <MaterialCommunityIcons name={item.editingPrice ? 'close' : 'pencil-outline'} size={15} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {item.editingPrice && (
                      <View style={styles.ciPriceEditRow}>
                        <MaterialCommunityIcons name="cash" size={14} color={colors.textSecondary} />
                        <MontantInput
                          style={[styles.ciPriceInput, { borderColor: colors.border, color: colors.text }]}
                          value={item.prixUnitaire}
                          onChangeValue={v => modifierPrixLigne(item.produit.id, item.niveauId, v)}
                          autoFocus
                        />
                        <Text style={{ fontSize: 11, color: colors.textSecondary }}>FCFA</Text>
                      </View>
                    )}

                    {/* Bénéfice / prix d'achat */}
                    {prixAchatEffectif > 0 && (
                      <Text style={{ fontSize: 10, fontWeight: '600', color: beneficeColor, marginTop: 2 }} numberOfLines={1}>
                        {beneficeLabel}: {Math.abs(beneficeLigne).toFixed(0)} · Achat: {prixAchatEffectif.toFixed(0)}
                      </Text>
                    )}
                    {beneficeLigne < 0 && (
                      <Text style={{ fontSize: 10, color: colors.danger }}>Prix saisi inférieur au prix d'achat.</Text>
                    )}

                    {/* Remise ligne */}
                    <View style={styles.ciDiscountRow}>
                      <MaterialCommunityIcons name="tag-outline" size={13} color={colors.textSecondary} />
                      <RNTextInput
                        style={[styles.ciDiscountInput, { borderColor: colors.border, color: colors.text }]}
                        value={item.remisePourcentage ? String(item.remisePourcentage) : ''}
                        onChangeText={v => modifierRemiseLigne(item.produit.id, item.niveauId, v)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.placeholder}
                      />
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>% remise</Text>
                    </View>
                  </View>

                  <View style={styles.ciRight}>
                    <View style={styles.ciQty}>
                      <TouchableOpacity style={styles.ciQtyBtn} onPress={() => modifierQte(item.produit.id, -1, item.niveauId)}>
                        <Text style={styles.ciQtyBtnText}>−</Text>
                      </TouchableOpacity>
                      {/* Quantité saisissable directement (comme Ionic ci-qty-input),
                          en plus des boutons −/+ — avant, seuls les boutons existaient. */}
                      <RNTextInput
                        style={[styles.ciQtyInput, { color: colors.text, borderColor: colors.border }]}
                        value={String(item.quantite)}
                        onChangeText={v => modifierQteDirecte(item.produit.id, item.niveauId, v)}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={[styles.ciQtyBtn, item.quantite >= stockMax && { opacity: 0.3 }]}
                        onPress={() => modifierQte(item.produit.id, 1, item.niveauId)}
                        disabled={item.quantite >= stockMax}
                      >
                        <Text style={styles.ciQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.ciStockBadge, { color: item.quantite >= stockMax ? '#dc2626' : colors.textSecondary }]}>
                      {item.quantite}/{stockMax}
                    </Text>
                    <Text style={[styles.ciTotal, { color: colors.primary }]}>{totalLigne(item).toLocaleString('de-DE', { maximumFractionDigits: 0 })}</Text>
                    <TouchableOpacity onPress={() => retirerLigne(item.produit.id, item.niveauId)} style={{ marginTop: 4 }}>
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ══════════ SECTION 3 — PAIEMENT ══════════ */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <SectionHead num={3} title="Paiement" sub="Remise, client et mode de règlement" />

          {/* Sous-total + remise globale */}
          <View style={[styles.totauxCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.rowBetween}>
              <Text style={{ color: colors.textSecondary }}>Sous-total</Text>
              <Text style={{ fontWeight: 'bold', color: colors.text }}>{subTotal.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
            </View>

            {panier.length > 0 && (
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={{ color: beneficeTotalColor, fontSize: 12, fontWeight: '600' }}>{beneficeTotalLabel}</Text>
                <Text style={{ fontWeight: 'bold', color: beneficeTotalColor }}>{Math.abs(beneficeTotal).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
              </View>
            )}

            <View style={styles.remiseRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Remise globale</Text>
                <RNTextInput
                  style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]}
                  value={remiseGlobale}
                  onChangeText={setRemiseGlobale}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={{ marginLeft: 8 }}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Type</Text>
                <View style={styles.rtypeRow}>
                  {(['POURCENTAGE', 'MONTANT_FIXE'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.rtypeBtn, { borderColor: colors.border }, typeRemiseGlobale === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setTypeRemiseGlobale(t)}
                    >
                      <Text style={{ color: typeRemiseGlobale === t ? '#fff' : colors.text, fontWeight: '700' }}>{t === 'POURCENTAGE' ? '%' : 'F'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={[styles.totalLine, { borderTopColor: colors.border }]}>
              <Text style={{ fontWeight: 'bold', color: colors.text }}>TOTAL À PAYER</Text>
              <Text style={[styles.totalVal, { color: colors.primary }]}>{total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
            </View>
          </View>

          {/* Client */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              <MaterialCommunityIcons name="account-outline" size={13} /> Client
            </Text>
            <View style={[styles.clientSearchRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <MaterialCommunityIcons name="magnify" size={16} color={colors.textSecondary} />
              <RNTextInput
                style={[styles.clientSearchInput, { color: colors.text }]}
                value={clientSearch}
                onChangeText={filterClients}
                onFocus={() => filterClients(clientSearch)}
                placeholder="Rechercher par nom ou téléphone..."
                placeholderTextColor={colors.placeholder}
              />
              {(clientId || clientSearch) && (
                <TouchableOpacity onPress={clearClient}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {clientId && (
              <View style={styles.clientSelected}>
                <MaterialCommunityIcons name="check-circle-outline" size={15} color={colors.success} />
                <Text style={{ color: colors.text, fontSize: 12 }}>{clientNom} {clientTelephone ? `· ${clientTelephone}` : ''}</Text>
              </View>
            )}

            {showClientDropdown && (
              <View style={[styles.clientDropdown, { borderColor: colors.border, backgroundColor: colors.card }]}>
                {clientsFiltres.map(c => (
                  <TouchableOpacity key={c.id} style={styles.clientOption} onPress={() => pickClient(c)}>
                    <View style={[styles.coAvatar, { backgroundColor: colors.primary + '22' }]}>
                      <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{(c.nom || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{c.nom}</Text>
                      {!!c.telephone && <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{c.telephone}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Mode de paiement en chips */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              <MaterialCommunityIcons name="wallet-outline" size={13} /> Mode de paiement
            </Text>
            <View style={styles.paymentChips}>
              {MODES_PAIEMENT.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.paymentChip, { borderColor: colors.border }, modePaiement === m && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => { setModePaiement(m); setReferencePaiement(''); }}
                >
                  <MaterialCommunityIcons name={PAYMENT_ICONS[m] || 'wallet-outline'} size={14} color={modePaiement === m ? '#fff' : colors.text} />
                  <Text style={{ color: modePaiement === m ? '#fff' : colors.text, fontSize: 12, fontWeight: '600' }}>{MODES_LABELS[m] || m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Référence (si non espèces) */}
          {modePaiement !== 'ESPECES' && (
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                <MaterialCommunityIcons name="file-document-outline" size={13} /> Référence de paiement
              </Text>
              <RNTextInput
                style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]}
                value={referencePaiement}
                onChangeText={setReferencePaiement}
                placeholder="N° transaction, référence..."
                placeholderTextColor={colors.placeholder}
              />
            </View>
          )}

          {/* Toggle crédit */}
          <View style={[styles.toggleCard, { borderColor: colors.border }, estCredit && { borderColor: colors.primary, backgroundColor: colors.primary + '0c' }]}>
            <View style={styles.rowStart}>
              <View style={[styles.toggleIcon, { backgroundColor: estCredit ? colors.primary : colors.background }]}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={estCredit ? '#fff' : colors.textSecondary} />
              </View>
              <View>
                <Text style={{ fontWeight: '600', color: colors.text, fontSize: 13 }}>Vente à crédit</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Le client paiera plus tard</Text>
              </View>
            </View>
            <Switch value={estCredit} onValueChange={setEstCredit} color={colors.primary} />
          </View>

          {/* Champs crédit */}
          {estCredit && (
            <View style={{ marginTop: 10 }}>
              <View style={[styles.toggleCard, { borderColor: colors.border, paddingVertical: 8 }]}>
                <View style={styles.rowStart}>
                  <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.primary} />
                  <Text style={{ fontWeight: '600', color: colors.text, fontSize: 13, marginLeft: 6 }}>Créer ce client</Text>
                </View>
                <Switch value={creerClient} onValueChange={setCreerClient} disabled={!!clientId} color={colors.primary} />
              </View>

              <View style={styles.creditGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nom</Text>
                  <RNTextInput style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]} value={clientNom} onChangeText={setClientNom} placeholder="Nom de famille" placeholderTextColor={colors.placeholder} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Prénom</Text>
                  <RNTextInput style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]} value={clientPrenom} onChangeText={setClientPrenom} placeholder="Prénom" placeholderTextColor={colors.placeholder} />
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Téléphone</Text>
              <RNTextInput style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]} value={clientTelephone} onChangeText={setClientTelephone} placeholder="Ex: 70 00 00 00" keyboardType="phone-pad" placeholderTextColor={colors.placeholder} />

              <View style={styles.creditGrid}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date d'échéance</Text>
                  <RNTextInput style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]} value={dateEcheance} onChangeText={setDateEcheance} placeholder="AAAA-MM-JJ" placeholderTextColor={colors.placeholder} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Montant versé (acompte)</Text>
                  <MontantInput style={[styles.fieldInput, { borderColor: colors.border, color: colors.text }]} value={montantVerse} onChangeValue={setMontantVerse} placeholder="0" placeholderTextColor={colors.placeholder} />
                </View>
              </View>

              {/* Avance client */}
              {(soldeAvanceClient > 0 || isLoadingAvance) && (
                <View style={[styles.avanceCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <View style={styles.rowBetween}>
                    <View style={styles.rowStart}>
                      <MaterialCommunityIcons name="wallet-outline" size={15} color={colors.textSecondary} />
                      {isLoadingAvance ? (
                        <ActivityIndicator size="small" style={{ marginLeft: 8 }} />
                      ) : (
                        <Text style={{ marginLeft: 6, fontSize: 12, color: colors.text }}>
                          Avance disponible : <Text style={{ fontWeight: 'bold' }}>{soldeAvanceClient.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
                        </Text>
                      )}
                    </View>
                    {!isLoadingAvance && (
                      <View style={styles.rowStart}>
                        <Text style={{ fontSize: 11, color: colors.textSecondary, marginRight: 6 }}>Utiliser</Text>
                        <Switch value={utiliserAvance} onValueChange={setUtiliserAvance} color={colors.primary} />
                      </View>
                    )}
                  </View>
                  {utiliserAvance && !isLoadingAvance && (
                    <View style={{ marginTop: 8 }}>
                      <View style={styles.rowStart}>
                        <MontantInput
                          style={[styles.fieldInput, { flex: 1, borderColor: colors.border, color: colors.text }]}
                          value={montantAvanceAUtiliser}
                          onChangeValue={setMontantAvanceAUtiliser}
                          placeholder="0"
                          placeholderTextColor={colors.placeholder}
                        />
                        <TouchableOpacity style={[styles.maxBtn, { backgroundColor: colors.primary }]} onPress={utiliserTouteAvance}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Tout</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                        Max : {soldeAvanceClient.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                        {montantAvanceAUtiliser > 0 ? ` · Reste : ${resteAPayerCredit.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Bouton valider */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.primary }, (submitting || panier.length === 0) && { opacity: 0.5 }]}
            onPress={valider}
            disabled={submitting || panier.length === 0}
          >
            {submitting ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitBtnText}>Traitement en cours...</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>Valider la vente · {total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal sélection niveau conditionnement */}
      {showNiveauModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeadRow}>
              <Text variant="titleMedium" style={{ color: colors.text, flex: 1 }}>
                Choisir le niveau — {produitEnAttente?.nom}
              </Text>
              <TouchableOpacity onPress={() => { setShowNiveauModal(false); setProduitEnAttente(null); }}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {loadingNiveaux ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  {niveauxDisponibles.map((n, i) => {
                    const parentNom = i === 0 ? (produitEnAttente?.nom || 'produit') : niveauxDisponibles[i - 1].nom;
                    const stockPropre = n.stock || 0;
                    // Cascade récursive jusqu'à la racine, pas seulement le parent
                    // direct — sinon on bloque le choix alors que le backend
                    // pourrait décomposer plusieurs crans d'un coup.
                    const disponibleCascade = n.id !== undefined ? disponibleNiveau(niveauxDisponibles, n.id, quantitePrincipale) : stockPropre;
                    const enRuptureTotale = disponibleCascade === 0;
                    const stockColor = stockPropre > 0 ? colors.success : (disponibleCascade > 0 ? colors.warning : colors.danger);
                    const stockLabel = stockPropre > 0
                      ? `Stock : ${stockPropre}`
                      : (disponibleCascade > 0 ? `(cascade : ${disponibleCascade})` : '(rupture)');
                    return (
                      <TouchableOpacity
                        key={n.id}
                        onPress={() => { if (!enRuptureTotale) choisirNiveau(n); }}
                        style={[styles.niveauCard, { backgroundColor: colors.infoBg, borderColor: colors.border }, enRuptureTotale && { opacity: 0.45 }]}
                        disabled={enRuptureTotale}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.text }}>{n.nom}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: colors.primary + '22', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                              1 {parentNom} = {n.facteur} {n.nom}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>
                            Achat : {(n.prixAchat || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                          </Text>
                          <Text style={{ fontSize: 12, marginTop: 2, fontWeight: '600', color: stockColor }}>
                            {stockLabel}
                          </Text>
                        </View>
                        <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 15 }}>{(n.prixVente || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.textSecondary, marginTop: 8 }]}
                    onPress={() => { ajouterSansNiveau(produitEnAttente!); setShowNiveauModal(false); setProduitEnAttente(null); }}
                  >
                    <Text style={styles.submitBtnText}>Vendre sans niveau (produit de base)</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <BarcodeScannerModal
        visible={showScanner}
        title="Scanner un produit"
        onScan={onCodeScanne}
        onClose={() => setShowScanner(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Bandeaux
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6 },
  offlineText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cacheBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 5 },
  pendingBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 5 },
  cacheTxt: { color: '#92400e', fontSize: 11 },

  // Sections
  section: { margin: 12, marginBottom: 0, marginTop: 12, borderRadius: 14, padding: 14, elevation: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionNum: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionNumText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  sectionTitle: { fontWeight: 'bold', fontSize: 14 },
  sectionSub: { fontSize: 11, marginTop: 1 },
  cartBadge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cartBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 11 },

  // Recherche produit
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14 },
  scanBtn: { padding: 2 },
  searchEmpty: { alignItems: 'center', paddingVertical: 24 },

  // Grille produits (responsive : s'adapte à la largeur de l'écran)
  productsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  productChip: { flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, padding: 8 },
  pcIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pcName: { fontSize: 12, fontWeight: '600' },
  pcPrice: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  pcStock: { fontSize: 11, color: '#64748b', marginRight: 2 },

  // Panier
  cartItem: { flexDirection: 'row', borderBottomWidth: 1, paddingVertical: 10, gap: 10 },
  ciName: { fontSize: 13, fontWeight: '600' },
  niveauBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 3 },
  niveauBadgeText: { fontSize: 10, fontWeight: '700' },
  ciPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ciPriceInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, width: 80 },
  ciPriceBtn: { padding: 4 },
  ciPriceEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  ciDiscountRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ciDiscountInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 12, width: 50, textAlign: 'center' },
  ciRight: { alignItems: 'flex-end', justifyContent: 'flex-start', minWidth: 90 },
  ciQty: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ciQtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f0f4f8', alignItems: 'center', justifyContent: 'center' },
  ciQtyBtnText: { fontSize: 16, fontWeight: 'bold', color: '#1a56db' },
  ciQtyVal: { minWidth: 20, textAlign: 'center', fontWeight: 'bold' },
  ciQtyInput: { minWidth: 32, textAlign: 'center', fontWeight: 'bold', fontSize: 13, borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 2 },
  ciStockBadge: { fontSize: 10, marginTop: 3 },
  ciTotal: { fontSize: 13, fontWeight: '700', marginTop: 6 },

  // Section 3
  totauxCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowStart: { flexDirection: 'row', alignItems: 'center' },
  remiseRow: { flexDirection: 'row', marginTop: 10 },
  rtypeRow: { flexDirection: 'row', gap: 4 },
  rtypeBtn: { width: 34, height: 34, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  totalVal: { fontSize: 16, fontWeight: 'bold' },

  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  fieldInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 13 },

  // Client
  clientSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  clientSearchInput: { flex: 1, fontSize: 13 },
  clientSelected: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  clientDropdown: { borderWidth: 1, borderRadius: 10, marginTop: 4, maxHeight: 220, overflow: 'hidden' },
  clientOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  coAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },

  // Paiement chips
  paymentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },

  // Crédit
  toggleCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  toggleIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  creditGrid: { flexDirection: 'row', marginBottom: 4 },
  avanceCard: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  maxBtn: { borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center', marginLeft: 6 },

  // Bouton valider
  submitBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // Modal niveau
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalSheet: { borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  niveauCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginBottom: 8, borderRadius: 10, borderWidth: 1 },
});
