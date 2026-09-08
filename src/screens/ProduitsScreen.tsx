import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert, Modal,
  ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,
  TextInput as RNTextInput, Text, ActivityIndicator, Switch,
} from 'react-native';
import {
  TextInput, Button, IconButton, Divider,
} from 'react-native-paper';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  getProduits, deleteProduit, getCategories, createCategorie, updateCategorie, deleteCategorie,
  getStatistiquesStock, getFournisseurs,
} from '../services/api.service';
import { cacheProduits, getProduitsCache } from '../db/database';
import { creerProduitOffline, modifierProduitOffline, getNombreProduitsPending } from '../services/offline.service';
import { Produit, Categorie } from '../types';
import { getNiveaux, creerNiveau, modifierNiveau, supprimerNiveau, decomposer, ProduitNiveau } from '../services/produit-niveau.service';
import { getUnitesVente, creerUniteVente, modifierUniteVente, supprimerUniteVente, UniteVente } from '../services/unite-vente.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { SkeletonCard } from '../components/SkeletonLoader';
import { StockBadge } from '../components/StockBadge';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';
import { useMontantInput } from '../components/MontantInput';
import { GL, colorCard, mobileCard, filterZone, sectionLabel as slabel } from '../theme/styles';

type Segment = 'all' | 'low' | 'expired' | 'bio';
const TYPES_VENTE = ['UNITE', 'KG', 'LITRE', 'COMPTANT_UNIQUEMENT'] as const;
const TYPE_VENTE_LABELS: Record<string, string> = {
  UNITE: 'Unité', KG: 'Kg', LITRE: 'Litre', COMPTANT_UNIQUEMENT: 'Comptant uniquement',
};

interface FormProduit {
  nom: string;
  prixAchat: number;
  prixVente: number;
  quantite: string;
  seuilAlerte: string;
  categorieId: string;
  fournisseurId: string;
  description: string;
  codeBarre: string;
  datePeremption: string;
  bio: boolean;
  typeVente: string;
  uniteBase: string;
}

const emptyForm = (): FormProduit => ({
  nom: '', prixAchat: 0, prixVente: 0, quantite: '0',
  seuilAlerte: '5', categorieId: '', fournisseurId: '', description: '', codeBarre: '',
  datePeremption: '', bio: false, typeVente: 'UNITE', uniteBase: 'Unité',
});

export default function ProduitsScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const navigation = useNavigation<any>();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [selectedCategorieId, setSelectedCategorieId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [form, setForm] = useState<FormProduit>(emptyForm());
  const prixAchatInput = useMontantInput(form.prixAchat, v => setForm(f => ({ ...f, prixAchat: v })));
  const prixVenteInput = useMontantInput(form.prixVente, v => setForm(f => ({ ...f, prixVente: v })));
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Catégories (gestion)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Stats
  const [showStatsModal, setShowStatsModal] = useState(false);

  useEffect(() => {
    getCategories().then(res => setCategories(res.data?.data || res.data || [])).catch(() => {});
    getFournisseurs().then(res => setFournisseurs(res.data?.data || res.data || [])).catch(() => {});
    // Unités de vente (CleFonctionnalite.VENTE_GROS_DETAIL) — masquée/désactivée
    // exactement comme Dépôt garde / Comptes bancaires / Fidélité, via le même
    // cache 'fonctionnalites_avancees_desactivees' (voir LoginScreen.tsx).
    AsyncStorage.getItem('fonctionnalites_avancees_desactivees').then(raw => {
      let desactivees: string[] = [];
      if (raw) { try { desactivees = JSON.parse(raw); } catch { /* ignore */ } }
      setVenteGrosDetailActif(!desactivees.includes('VENTE_GROS_DETAIL'));
    });
    AsyncStorage.getItem('user').then(raw => {
      if (!raw) return;
      try {
        const role: string = JSON.parse(raw)?.role || '';
        const admin = role === 'ROLE_ADMIN' || role === 'ADMIN';
        setIsAdmin(admin);
        if (admin) {
          getStatistiquesStock().then(res => setStats(res.data?.data || res.data?.statistiques || res.data)).catch(() => {});
        }
      } catch {}
    });
  }, []);

  // En-tête : PDF stock, gestion catégories, statistiques (admin), nouveau produit —
  // comme la barre d'icônes d'Ionic (document-text/pricetags/bar-chart/add).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={genererPdfStock} style={{ marginRight: 12 }}>
            <MaterialCommunityIcons name="file-document-outline" color="#fff" size={22} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowCategoriesModal(true)} style={{ marginRight: 12 }}>
            <MaterialCommunityIcons name="tag-multiple-outline" color="#fff" size={22} />
          </TouchableOpacity>
          {stats && (
            <TouchableOpacity onPress={() => setShowStatsModal(true)} style={{ marginRight: 12 }}>
              <MaterialCommunityIcons name="chart-bar" color="#fff" size={22} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={ouvrirCreation} style={{ marginRight: 14 }}>
            <MaterialCommunityIcons name="plus-circle-outline" color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, stats]);

  const [showScanner, setShowScanner] = useState(false);

  // Niveaux
  const [showNiveauxModal, setShowNiveauxModal] = useState(false);
  const [produitCourant, setProduitCourant] = useState<Produit | null>(null);
  const [niveaux, setNiveaux] = useState<ProduitNiveau[]>([]);
  const [loadingNiveaux, setLoadingNiveaux] = useState(false);
  const [savingNiveau, setSavingNiveau] = useState(false);
  // Ni "parentId" (déduit automatiquement — racine si aucun niveau n'existe,
  // sinon la feuille actuelle de la chaîne) ni "stock" (toujours envoyé à 0
  // à la création, l'ajustement de stock se fait ailleurs).
  const [formNiveau, setFormNiveau] = useState({ nom: '', facteur: '', prixAchat: 0, prixVente: 0 });
  const prixAchatNiveauInput = useMontantInput(formNiveau.prixAchat, v => setFormNiveau(f => ({ ...f, prixAchat: v })));
  const prixVenteNiveauInput = useMontantInput(formNiveau.prixVente, v => setFormNiveau(f => ({ ...f, prixVente: v })));
  const [editingNiveauId, setEditingNiveauId] = useState<number | null>(null);
  const [formEditNiveau, setFormEditNiveau] = useState({ nom: '', parentId: '' as string, facteur: '1', prixAchat: 0, prixVente: 0, stock: '0' });
  const prixAchatEditNiveauInput = useMontantInput(formEditNiveau.prixAchat, v => setFormEditNiveau(f => ({ ...f, prixAchat: v })));
  const prixVenteEditNiveauInput = useMontantInput(formEditNiveau.prixVente, v => setFormEditNiveau(f => ({ ...f, prixVente: v })));
  // Flux guidé en langage courant (remplace le sélecteur technique de parent) —
  // le niveau parent est toujours déduit automatiquement (racine ou feuille
  // actuelle), jamais choisi manuellement par l'utilisateur.
  const [niveauVeutGros, setNiveauVeutGros] = useState<boolean | null>(null); // Cas A : réponse à "vend-on aussi en gros ?"
  const [afficherFormNiveau, setAfficherFormNiveau] = useState(true); // Cas B : formulaire du prochain sous-conditionnement visible ?
  const [avanceAjoutOuvert, setAvanceAjoutOuvert] = useState(false); // section "Avancé" (prix d'achat) repliée par défaut — ajout
  const [avanceEditOuvert, setAvanceEditOuvert] = useState(false); // idem en édition

  // Drapeau local "Gestion par conditionnement" (feat_conditionnement,
  // AsyncStorage — réglé dans BoutiqueSettingsScreen.toggleConditionnement) :
  // conditionne l'affichage du bouton Niveaux, exactement comme *ngIf
  // "conditionnementActif" sur products.page.html côté Ionic. Relu à chaque
  // focus de l'écran (comme ionViewWillEnter), pas seulement au montage.
  const [conditionnementActif, setConditionnementActif] = useState(false);
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('feat_conditionnement').then(v => setConditionnementActif(v === 'true'));
  }, []));

  // ==================== UNITÉS DE VENTE (CleFonctionnalite.VENTE_GROS_DETAIL) ====================
  // Système simple et indépendant de ProduitNiveau ci-dessus : un seul stock
  // produit, pas de cascade — voir unite-vente.service.ts.
  const [venteGrosDetailActif, setVenteGrosDetailActif] = useState(false);
  const [showUnitesVenteModal, setShowUnitesVenteModal] = useState(false);
  const [produitUnitesCourant, setProduitUnitesCourant] = useState<Produit | null>(null);
  const [unitesVente, setUnitesVente] = useState<UniteVente[]>([]);
  const [loadingUnitesVente, setLoadingUnitesVente] = useState(false);
  const [savingUniteVente, setSavingUniteVente] = useState(false);
  const [editingUniteVenteId, setEditingUniteVenteId] = useState<number | null>(null);
  const [formUniteVente, setFormUniteVente] = useState({ nom: '', referenceId: '' as string, facteurRelatif: '', prixAchat: 0, prixVente: 0 });
  const prixAchatUniteInput = useMontantInput(formUniteVente.prixAchat, v => setFormUniteVente(f => ({ ...f, prixAchat: v })));
  const prixVenteUniteInput = useMontantInput(formUniteVente.prixVente, v => setFormUniteVente(f => ({ ...f, prixVente: v })));

  const charger = useCallback(async () => {
    // On tente toujours l'appel réel en premier — NetInfo.fetch() peut renvoyer
    // isConnected=null au premier appel et ferait sauter l'appel réel à tort.
    try {
      const res = await getProduits();
      const data = res.data?.data || res.data || [];
      setProduits(data);
      await cacheProduits(data);
      setOffline(false);
    } catch {
      const cached = await getProduitsCache();
      setProduits(cached);
      setOffline(true);
    }
    const n = await getNombreProduitsPending();
    setPendingCount(n);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Recharge à chaque fois que l'écran redevient actif (ex: retour après une
  // vente ou un achat fournisseur ailleurs dans l'app) — même pattern que
  // SortiesScreen/CommandesScreen.
  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  // Filtre combiné : catégorie sélectionnée + segment (tous/faible/périmés/bio) + recherche
  // texte — comme applyFilter() d'Ionic.
  useEffect(() => {
    let result = [...produits];

    if (selectedCategorieId) {
      result = result.filter(p => p.categorie?.id === selectedCategorieId || p.categorieId === selectedCategorieId);
    }

    if (segment === 'low') result = result.filter(p => p.stockFaible || p.quantite <= (p.seuilAlerte || 5));
    else if (segment === 'expired') result = result.filter(p => p.perime || p.prochePeremption);
    else if (segment === 'bio') result = result.filter(p => p.bio);

    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter(p =>
        [p.nom, p.codeBarre, p.categorie?.nom, p.fournisseur?.nom]
          .filter(Boolean).some(v => `${v}`.toLowerCase().includes(term))
      );
    }

    setFiltered(result);
  }, [search, produits, segment, selectedCategorieId]);

  const countByCategorie = (categorieId: number) =>
    produits.filter(p => p.categorie?.id === categorieId || p.categorieId === categorieId).length;

  const ouvrirCreation = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const ouvrirEdition = (p: Produit) => {
    setEditing(p);
    setForm({
      nom: p.nom,
      prixAchat: p.prixAchat || 0,
      prixVente: p.prixVente || 0,
      quantite: String(p.quantite),
      seuilAlerte: String(p.seuilAlerte || 5),
      categorieId: p.categorie?.id ? String(p.categorie.id) : (p.categorieId ? String(p.categorieId) : ''),
      fournisseurId: p.fournisseur?.id ? String(p.fournisseur.id) : (p.fournisseurId ? String(p.fournisseurId) : ''),
      description: p.description || '',
      codeBarre: p.codeBarre || '',
      datePeremption: p.datePeremption || '',
      bio: !!p.bio,
      typeVente: p.typeVente || 'UNITE',
      uniteBase: p.uniteBase || 'Unité',
    });
    setShowModal(true);
  };

  const fermerModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm()); };

  const sauvegarder = async () => {
    if (!form.nom.trim()) { Alert.alert('Erreur', 'Le nom est obligatoire'); return; }
    if (!form.prixVente || form.prixVente <= 0) { Alert.alert('Erreur', 'Prix de vente obligatoire'); return; }
    if (!form.categorieId) { Alert.alert('Erreur', 'La catégorie est obligatoire'); return; }
    setSaving(true);
    // Le backend attend "categorieId" (identifiant numérique d'une catégorie
    // existante), pas un nom de catégorie en texte libre — un champ inconnu
    // dans le JSON fait rejeter toute la requête (parsing strict côté serveur).
    const data = {
      nom: form.nom.trim(),
      prixAchat: form.prixAchat || 0,
      prixVente: form.prixVente,
      quantite: Number(form.quantite) || 0,
      seuilAlerte: Number(form.seuilAlerte) || 5,
      categorieId: Number(form.categorieId),
      fournisseurId: form.fournisseurId ? Number(form.fournisseurId) : undefined,
      description: form.description.trim() || undefined,
      codeBarre: form.codeBarre.trim() || undefined,
      datePeremption: form.datePeremption.trim() || undefined,
      bio: form.bio,
      typeVente: form.typeVente,
      // Unité de base (système simple gros/détail) — envoyée via le même
      // endpoint générique PUT/POST /produits déjà utilisé pour tous les
      // autres champs produit (aucun endpoint dédié). Toujours "Unité" par
      // défaut si le champ n'a pas été affiché (fonctionnalité désactivée).
      uniteBase: form.uniteBase.trim() || 'Unité',
    };
    try {
      if (editing) {
        const res = await modifierProduitOffline(editing.id, data);
        Alert.alert('Succès', res.offline ? '✓ Modifié hors ligne — sync au retour' : '✓ Produit modifié');
        if (!res.offline) {
          setProduits(prev => prev.map(p => p.id === editing.id ? { ...p, ...data } : p));
        }
      } else {
        const res = await creerProduitOffline(data);
        Alert.alert('Succès', res.offline ? '✓ Créé hors ligne — sync au retour' : '✓ Produit créé');
        if (!res.offline) await charger();
        else {
          // Ajouter le produit localement avec un ID temporaire
          const tempProduit: Produit = { id: -Date.now(), ...data };
          setProduits(prev => [tempProduit, ...prev]);
        }
      }
      fermerModal();
      const n = await getNombreProduitsPending();
      setPendingCount(n);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const confirmerSuppression = (p: Produit) => {
    Alert.alert(
      tr('supprimer', lang), `Supprimer "${p.nom}" ?`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang), style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduit(p.id);
              setProduits(prev => prev.filter(x => x.id !== p.id));
            } catch {
              Alert.alert('Erreur', 'Suppression impossible hors ligne');
            }
          },
        },
      ]
    );
  };

  // ==================== NIVEAUX ====================

  // Construit la chaîne ordonnée depuis la racine vers les feuilles en suivant parentId
  const buildNiveauxChaine = (niveaux: ProduitNiveau[]): ProduitNiveau[] => {
    const roots = niveaux.filter(n => !n.parentId);
    const result: ProduitNiveau[] = [];
    const addWithChildren = (n: ProduitNiveau) => {
      result.push(n);
      niveaux.filter(c => c.parentId === n.id).forEach(addWithChildren);
    };
    roots.forEach(addWithChildren);
    // Si aucune racine trouvée (ancienne API sans parentId), retourner tel quel trié par ordre
    if (result.length === 0 && niveaux.length > 0) {
      return [...niveaux].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    }
    return result;
  };

  const nomParentNiveau = (niveau: ProduitNiveau, liste: ProduitNiveau[]): string => {
    if (!niveau.parentId) return '';
    return liste.find(n => n.id === niveau.parentId)?.nom || '';
  };

  const rechargerNiveaux = async (produitId: number) => {
    const data = await getNiveaux(produitId);
    setNiveaux(data);
  };

  const ouvrirNiveaux = async (p: Produit) => {
    setProduitCourant(p);
    setShowNiveauxModal(true);
    setEditingNiveauId(null);
    setNiveauVeutGros(null);
    setAfficherFormNiveau(true);
    setAvanceAjoutOuvert(false);
    setAvanceEditOuvert(false);
    setFormNiveau({ nom: '', facteur: '', prixAchat: 0, prixVente: 0 });
    setLoadingNiveaux(true);
    try {
      const data = await getNiveaux(p.id);
      setNiveaux(data);
    } catch {
      Alert.alert('Erreur', 'Chargement des niveaux impossible');
    } finally {
      setLoadingNiveaux(false);
    }
  };

  // Le parent est toujours déduit automatiquement (jamais choisi par
  // l'utilisateur) : niveau racine (undefined) s'il n'existe encore aucun
  // niveau, sinon la "feuille" actuelle de la chaîne (le dernier niveau créé).
  const ajouterNiveauFn = async () => {
    if (!produitCourant || !formNiveau.nom.trim()) { Alert.alert('Erreur', 'Le nom du conditionnement est obligatoire'); return; }
    const facteurNum = parseFloat(formNiveau.facteur);
    if (isNaN(facteurNum) || facteurNum < 1) {
      Alert.alert('Erreur', "La quantité doit être un nombre entier d'au moins 1");
      return;
    }
    const prixVenteNum = formNiveau.prixVente;
    if (isNaN(prixVenteNum) || prixVenteNum <= 0) { Alert.alert('Erreur', 'Le prix de vente est obligatoire'); return; }
    setSavingNiveau(true);
    const chaine = buildNiveauxChaine(niveaux);
    const feuilleActuelle = chaine.length > 0 ? chaine[chaine.length - 1] : null;
    const nomCree = formNiveau.nom.trim();
    try {
      const payload = {
        nom: nomCree,
        parentId: feuilleActuelle ? feuilleActuelle.id : undefined,
        facteur: Math.round(facteurNum),
        prixAchat: formNiveau.prixAchat || 0,
        prixVente: prixVenteNum,
        stock: 0,
      };
      await creerNiveau(produitCourant.id, payload);
      await rechargerNiveaux(produitCourant.id);
      setFormNiveau({ nom: '', facteur: '', prixAchat: 0, prixVente: 0 });
      setAvanceAjoutOuvert(false);
      if (feuilleActuelle) {
        // Cas B : on vient d'ajouter un sous-conditionnement — proposer d'enchaîner.
        Alert.alert(
          'Sous-conditionnement ajouté',
          `Ajouter encore un sous-conditionnement sous "${nomCree}" ?`,
          [
            { text: 'Non', style: 'cancel', onPress: () => setAfficherFormNiveau(false) },
            { text: 'Oui', onPress: () => setAfficherFormNiveau(true) },
          ]
        );
      } else {
        // Cas A : premier niveau créé — au prochain rendu, niveaux.length > 0
        // fera basculer automatiquement l'écran en Cas B.
        setNiveauVeutGros(null);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur lors de la creation du niveau';
      Alert.alert('Erreur', msg);
    } finally {
      setSavingNiveau(false);
    }
  };

  const ouvrirEditNiveau = (n: ProduitNiveau) => {
    setEditingNiveauId(n.id!);
    setAvanceEditOuvert(false);
    setFormEditNiveau({
      nom: n.nom,
      parentId: n.parentId !== undefined && n.parentId !== null ? String(n.parentId) : '',
      facteur: String(n.facteur),
      prixAchat: n.prixAchat || 0,
      prixVente: n.prixVente || 0,
      stock: String(n.stock ?? 0),
    });
  };

  const sauvegarderEditNiveauFn = async () => {
    if (!editingNiveauId || !produitCourant) return;
    if (!formEditNiveau.nom.trim()) { Alert.alert('Erreur', 'Le nom du conditionnement est obligatoire'); return; }
    const facteurNum = parseFloat(formEditNiveau.facteur);
    if (isNaN(facteurNum) || facteurNum < 1) {
      Alert.alert('Erreur', "La quantité doit être un nombre entier d'au moins 1");
      return;
    }
    const prixVenteNum = formEditNiveau.prixVente;
    if (isNaN(prixVenteNum) || prixVenteNum <= 0) { Alert.alert('Erreur', 'Le prix de vente est obligatoire'); return; }
    setSavingNiveau(true);
    try {
      // Le parent n'est pas modifiable dans ce dialogue simplifié — on garde
      // celui déjà associé à ce niveau (formEditNiveau.parentId, pré-rempli
      // par ouvrirEditNiveau et jamais changé depuis l'UI).
      const parentIdVal = formEditNiveau.parentId ? Number(formEditNiveau.parentId) : undefined;
      await modifierNiveau(editingNiveauId, {
        nom: formEditNiveau.nom.trim(),
        parentId: parentIdVal,
        facteur: Math.round(facteurNum),
        prixAchat: formEditNiveau.prixAchat || 0,
        prixVente: prixVenteNum,
        stock: parseFloat(formEditNiveau.stock) || 0,
      });
      setEditingNiveauId(null);
      setAvanceEditOuvert(false);
      await rechargerNiveaux(produitCourant.id);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Modification impossible');
    } finally {
      setSavingNiveau(false);
    }
  };

  const supprimerNiveauFn = (n: ProduitNiveau) => {
    Alert.alert(tr('supprimer', lang), `Supprimer "${n.nom}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
        try {
          await supprimerNiveau(n.id!);
          if (produitCourant) await rechargerNiveaux(produitCourant.id);
        } catch (e: any) {
          Alert.alert('Erreur', e.response?.data?.message || 'Suppression impossible');
        }
      }},
    ]);
  };

  // ==================== UNITÉS DE VENTE ====================

  const ouvrirUnitesVente = async (p: Produit) => {
    setProduitUnitesCourant(p);
    setShowUnitesVenteModal(true);
    setEditingUniteVenteId(null);
    setFormUniteVente({ nom: '', referenceId: '', facteurRelatif: '', prixAchat: 0, prixVente: 0 });
    setLoadingUnitesVente(true);
    try {
      const data = await getUnitesVente(p.id);
      setUnitesVente(data);
    } catch {
      Alert.alert('Erreur', 'Chargement des unités de vente impossible');
    } finally {
      setLoadingUnitesVente(false);
    }
  };

  const rechargerUnitesVente = async (produitId: number) => {
    const data = await getUnitesVente(produitId);
    setUnitesVente(data);
  };

  // Nom de l'unité choisie comme référence (chaîne vide = unité de base du
  // produit) — sert uniquement à afficher le libellé de la question du
  // facteur relatif, jamais envoyé tel quel au serveur.
  const nomReferenceUnite = (referenceId: string): string => {
    if (!referenceId) return produitUnitesCourant?.uniteBase || tr('unite_base_mot', lang);
    return unitesVente.find(u => String(u.id) === referenceId)?.nom || '';
  };

  const ajouterOuModifierUniteVente = async () => {
    if (!produitUnitesCourant || !formUniteVente.nom.trim()) {
      Alert.alert('Erreur', "Le nom de l'unité est obligatoire");
      return;
    }
    const facteurNum = parseFloat(formUniteVente.facteurRelatif);
    if (isNaN(facteurNum) || facteurNum <= 0) {
      Alert.alert('Erreur', 'Le facteur doit être un nombre supérieur à 0');
      return;
    }
    if (!formUniteVente.prixVente || formUniteVente.prixVente <= 0) {
      Alert.alert('Erreur', 'Le prix de vente est obligatoire');
      return;
    }
    setSavingUniteVente(true);
    try {
      // uniteReferenceId omis (undefined) quand la référence choisie est
      // l'unité de base elle-même — jamais de facteur total calculé côté
      // client (facteurBase), c'est le serveur qui le déduit de
      // uniteReferenceId + facteurRelatif.
      const payload = {
        nom: formUniteVente.nom.trim(),
        prixVente: formUniteVente.prixVente,
        prixAchat: formUniteVente.prixAchat || 0,
        uniteReferenceId: formUniteVente.referenceId ? Number(formUniteVente.referenceId) : undefined,
        facteurRelatif: facteurNum,
      };
      if (editingUniteVenteId) {
        await modifierUniteVente(editingUniteVenteId, payload);
      } else {
        await creerUniteVente(produitUnitesCourant.id, payload);
      }
      await rechargerUnitesVente(produitUnitesCourant.id);
      setEditingUniteVenteId(null);
      setFormUniteVente({ nom: '', referenceId: '', facteurRelatif: '', prixAchat: 0, prixVente: 0 });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Erreur lors de l'enregistrement de l'unité";
      Alert.alert('Erreur', msg);
    } finally {
      setSavingUniteVente(false);
    }
  };

  // Le sélecteur "par rapport à" repart sur l'unité de base par défaut (on ne
  // connaît pas la référence d'origine — l'API GET ne renvoie que le facteur
  // total déjà résolu, facteurBase) : l'admin peut re-choisir une référence
  // et un nouveau facteur relatif librement.
  const ouvrirEditUniteVente = (u: UniteVente) => {
    setEditingUniteVenteId(u.id);
    setFormUniteVente({ nom: u.nom, referenceId: '', facteurRelatif: String(u.facteurBase), prixAchat: u.prixAchat || 0, prixVente: u.prixVente || 0 });
  };

  const annulerEditUniteVente = () => {
    setEditingUniteVenteId(null);
    setFormUniteVente({ nom: '', referenceId: '', facteurRelatif: '', prixAchat: 0, prixVente: 0 });
  };

  const supprimerUniteVenteFn = (u: UniteVente) => {
    Alert.alert(tr('supprimer', lang), `Supprimer "${u.nom}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
        try {
          await supprimerUniteVente(u.id);
          if (produitUnitesCourant) await rechargerUnitesVente(produitUnitesCourant.id);
        } catch (e: any) {
          Alert.alert('Erreur', e.response?.data?.message || 'Suppression impossible');
        }
      }},
    ]);
  };

  const genererPdfStock = async () => {
    const liste = filtered.length > 0 ? filtered : produits;
    const totalArticles = liste.reduce((s, p) => s + (p.quantite || 0), 0);
    const valeurTotale = liste.reduce((s, p) => s + (p.quantite || 0) * (p.prixAchat || 0), 0);
    const date = new Date().toLocaleDateString('fr-FR');
    const lignes = liste.map((p, i) => {
      const qColor = p.quantite === 0 ? '#ef4444' : (p.quantite <= (p.seuilAlerte || 5) ? '#d97706' : '#16a34a');
      const qLabel = p.quantite === 0 ? 'Rupture' : (p.quantite <= (p.seuilAlerte || 5) ? 'Faible' : 'OK');
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">${p.nom}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">${p.categorie?.nom || '—'}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center"><span style="background:${qColor}22;color:${qColor};border-radius:4px;padding:2px 8px;font-weight:700;font-size:11px">${p.quantite || 0} · ${qLabel}</span></td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">${(p.prixAchat || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700">${(p.prixVente || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#1d4ed8">${((p.quantite || 0) * (p.prixAchat || 0)).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stock Produits</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:20px;font-size:12px;background:#f0f4f8}
.sheet{background:#fff;max-width:960px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;padding:24px;display:flex;justify-content:space-between;align-items:center}
.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:12px;opacity:.7;margin-top:4px}
.kpis{display:flex;padding:16px 24px;gap:12px;border-bottom:1px solid #e5e7eb}
.kpi{flex:1;border-radius:8px;padding:12px;text-align:center}
.kpi-val{font-size:18px;font-weight:900}.kpi-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase}
.kpi--b{background:#dbeafe;color:#1d4ed8}.kpi--s{background:#f1f5f9;color:#475569}.kpi--g{background:#dcfce7;color:#15803d}
.body{padding:20px 24px}
table{width:100%;border-collapse:collapse}
thead th{background:#1d4ed8;color:#fff;padding:9px 8px;font-size:11px;font-weight:700;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f1f5f9}
.ftr{background:#eff6ff;text-align:center;padding:14px;font-size:10px;color:#1e40af}
</style></head><body>
<div class="sheet">
<div class="hdr"><div><h1>Stock Produits</h1><p>Ges Boutique · ${date}</p></div>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('Stock ' + date + ' ' + liste.length + ' produits')}" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px"></div>
<div class="kpis">
<div class="kpi kpi--b"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Produits</div></div>
<div class="kpi kpi--s"><div class="kpi-val">${totalArticles}</div><div class="kpi-lbl">Total articles</div></div>
<div class="kpi kpi--g"><div class="kpi-val">${valeurTotale.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</div><div class="kpi-lbl">Valeur stock</div></div>
</div>
<div class="body">
<table><thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>P. Achat</th><th>P. Vente</th><th>Valeur</th></tr></thead>
<tbody>${lignes || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">Aucun produit</td></tr>'}</tbody></table>
</div>
<div class="ftr">Ges Boutique · Stock · ${date} · ${liste.length} produit(s)</div>
</div></body></html>`;
    try { await Print.printAsync({ html }); } catch { Alert.alert('Erreur', 'Impossible de générer le PDF'); }
  };

  // ==================== CATÉGORIES ====================
  const creerCategorie = async () => {
    if (!categoryName.trim()) return;
    try {
      const res = await createCategorie({ nom: categoryName.trim() });
      const cat = res.data?.data || res.data;
      setCategories(prev => [...prev, cat]);
      setForm(f => ({ ...f, categorieId: String(cat.id) }));
      setCategoryName('');
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Création catégorie impossible');
    }
  };

  const demarrerEditionCategorie = (cat: Categorie) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.nom);
  };

  const sauvegarderEditionCategorie = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    try {
      const res = await updateCategorie(editingCategoryId, { nom: editingCategoryName.trim() });
      const updated = res.data?.data || res.data;
      setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Modification impossible');
    }
  };

  const confirmerSuppressionCategorie = (cat: Categorie) => {
    const count = countByCategorie(cat.id);
    Alert.alert(
      'Supprimer la catégorie',
      count > 0 ? `Cette catégorie contient ${count} produit(s). Supprimer quand même ?` : `Supprimer "${cat.nom}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: async () => {
            try {
              await deleteCategorie(cat.id);
              setCategories(prev => prev.filter(c => c.id !== cat.id));
            } catch (e: any) {
              Alert.alert('Erreur', e.response?.data?.message || 'Suppression impossible');
            }
          },
        },
      ]
    );
  };

  const getStockClass = (p: Produit): 'ok' | 'bas' | 'rupture' => {
    if (p.quantite <= 0) return 'rupture';
    if (p.stockFaible || p.quantite <= (p.seuilAlerte || 5)) return 'bas';
    return 'ok';
  };

  const getProduitAlerteMessage = (p: Produit): string => {
    if (p.quantite <= 0) return 'Rupture de stock';
    if (p.perime) return 'Produit périmé';
    if (p.prochePeremption) return 'Péremption proche';
    if (p.stockFaible || p.quantite <= (p.seuilAlerte || 5)) return 'Stock faible';
    return '';
  };

  // Chaîne ordonnée et niveau "feuille" (le plus bas) du produit courant — sert
  // au flux guidé (Cas B) pour savoir sous quel niveau proposer le prochain
  // sous-conditionnement, sans jamais demander de choisir un parent.
  const chaineNiveauxActuelle = buildNiveauxChaine(niveaux);
  const niveauFeuilleActuel = chaineNiveauxActuelle.length > 0 ? chaineNiveauxActuelle[chaineNiveauxActuelle.length - 1] : null;

  if (loading) return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 12 }}>
      <SkeletonCard count={6} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!offline && pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncText}>🔄 {pendingCount} produit(s) en cours de synchronisation</Text>
        </View>
      )}

      {/* ── Color Cards KPI (≡ .color-cards .cc-blue/green/orange/red Ionic) ── */}
      {stats && (
        <View style={styles.colorCardsRow}>
          {/* Produits — cc-blue */}
          <View style={[colorCard.base, colorCard.blue]}>
            <Ionicons name="cube-outline" size={18} color="#fff" style={{ opacity: 0.9 }} />
            <Text style={colorCard.label}>Produits</Text>
            <Text style={colorCard.value}>{stats.totalProduits}</Text>
          </View>
          {/* Valeur stock — cc-green */}
          <View style={[colorCard.base, colorCard.green]}>
            <Ionicons name="trending-up-outline" size={18} color="#fff" style={{ opacity: 0.9 }} />
            <Text style={colorCard.label}>Valeur stock</Text>
            <Text style={colorCard.value} numberOfLines={1}>{(stats.valeurTotale || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} F</Text>
          </View>
          {/* Stock faible — cc-orange */}
          <View style={[colorCard.base, colorCard.orange]}>
            <Ionicons name="alert-circle-outline" size={18} color="#fff" style={{ opacity: 0.9 }} />
            <Text style={colorCard.label}>Faible</Text>
            <Text style={colorCard.value}>{stats.produitsStockFaible}</Text>
          </View>
          {/* Rupture — cc-red */}
          <View style={[colorCard.base, colorCard.red]}>
            <Ionicons name="close-circle-outline" size={18} color="#fff" style={{ opacity: 0.9 }} />
            <Text style={colorCard.label}>Rupture</Text>
            <Text style={colorCard.value}>{stats.produitsRupture}</Text>
          </View>
        </View>
      )}

      {/* ── Filter Zone (≡ .filter-zone Ionic) ── */}
      <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
        {/* Barre de recherche (≡ .fz-search) */}
        <View style={filterZone.searchRow}>
          <Ionicons name="search-outline" size={18} color={GL.slate400} />
          <RNTextInput
            style={filterZone.searchInput}
            placeholder={tr('recherche_produit', lang)}
            placeholderTextColor={GL.slate400}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle-outline" size={18} color={GL.slate400} />
            </TouchableOpacity>
          )}
        </View>

        {/* Chips catégories (≡ .fz-chips) */}
        {categories.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                style={[filterZone.chip, selectedCategorieId === null && filterZone.chipActive]}
                onPress={() => setSelectedCategorieId(null)}
              >
                <Text style={[filterZone.chipText, selectedCategorieId === null && filterZone.chipTextActive]}>Toutes</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[filterZone.chip, selectedCategorieId === c.id && filterZone.chipActive]}
                  onPress={() => setSelectedCategorieId(c.id)}
                >
                  <Text style={[filterZone.chipText, selectedCategorieId === c.id && filterZone.chipTextActive]}>{c.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Chips filtre segment */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {([
            ['all', 'cube-outline', 'Tous'],
            ['low', 'warning-outline', 'Stock faible'],
            ['expired', 'calendar-outline', 'Péremption'],
            ['bio', 'leaf-outline', 'Bio'],
          ] as [Segment, string, string][]).map(([seg, icon, label]) => (
            <TouchableOpacity
              key={seg}
              style={[filterZone.chip, segment === seg && filterZone.chipActive]}
              onPress={() => setSegment(seg)}
            >
              <Ionicons name={icon as any} size={13} color={segment === seg ? '#fff' : GL.blue600} />
              <Text style={[filterZone.chipText, segment === seg && filterZone.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={slabel.text}>{filtered.length} article(s)</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const alerte = getProduitAlerteMessage(item);
          return (
            <View style={[mobileCard.base, item.id < 0 && styles.cardPending]}>
              <View>
                <View style={styles.row}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: GL.slate900 }} numberOfLines={1}>{item.nom}</Text>
                    {item.bio && (
                      <View style={styles.bioBadge}><Text style={styles.bioBadgeText}>Bio</Text></View>
                    )}
                  </View>
                  <StockBadge quantite={item.quantite} seuilAlerte={item.seuilAlerte || 5} />
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {item.categorie?.nom || 'Sans catégorie'}{item.fournisseur?.nom ? ` · ${item.fournisseur.nom}` : ''}
                </Text>

                <View style={styles.row}>
                  <Text style={styles.prix}>Vente : {(item.prixVente || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
                  {isAdmin && <Text style={styles.prixAchat}>Achat : {(item.prixAchat || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>}
                  <Text style={styles.prixAchat}>Seuil : {item.seuilAlerte || 5}</Text>
                </View>

                {(item.perime || item.prochePeremption) && (
                  <View style={[styles.peremptionBadge, item.perime && { backgroundColor: '#fee2e2' }]}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color={item.perime ? '#b91c1c' : '#b45309'} />
                    <Text style={{ fontSize: 11, color: item.perime ? '#b91c1c' : '#b45309', fontWeight: '600' }}>
                      {item.perime ? 'Périmé' : 'Proche péremption'}{item.datePeremption ? ` · ${item.datePeremption}` : ''}
                    </Text>
                  </View>
                )}
                {!!item.codeBarre && <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>Code: {item.codeBarre}</Text>}
                {!!alerte && (
                  <Text style={styles.alerteMsg}>
                    <MaterialCommunityIcons name="alert-outline" size={12} color="#d97706" /> {alerte}
                  </Text>
                )}

                {item.id < 0 && <Text style={styles.pendingLabel}>⏳ En attente de sync</Text>}
              </View>
              <View style={[styles.actions]}>
                <TouchableOpacity onPress={() => ouvrirEdition(item)} style={styles.actionBtn}>
                  <Ionicons name="pencil-outline" size={20} color={GL.blue600} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmerSuppression(item)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color={GL.red500} />
                </TouchableOpacity>
                {conditionnementActif && (
                  <TouchableOpacity onPress={() => ouvrirNiveaux(item)} style={styles.actionBtn}>
                    <Ionicons name="layers-outline" size={20} color="#7c3aed" />
                  </TouchableOpacity>
                )}
                {venteGrosDetailActif && (
                  <TouchableOpacity onPress={() => ouvrirUnitesVente(item)} style={styles.actionBtn}>
                    <Ionicons name="scale-outline" size={20} color="#0d9488" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant-closed" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun produit trouvé</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              {search.trim() || selectedCategorieId || segment !== 'all'
                ? 'Aucun produit ne correspond à ces filtres'
                : 'Ajoutez votre premier produit avec le bouton +'}
            </Text>
          </View>
        }
      />

      {/* Modal créer / modifier */}
      <Modal visible={showModal} animationType="slide" onRequestClose={fermerModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.text }]}>
              {editing ? tr('modifier', lang) : tr('nouveau_produit', lang)}
            </Text>
            <IconButton icon="close" iconColor={colors.text} onPress={fermerModal} />
          </View>
          <ScrollView contentContainerStyle={[styles.modalBody, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
            <TextInput label={tr('nom_produit', lang)} value={form.nom}
              onChangeText={v => setForm(f => ({ ...f, nom: v }))}
              style={styles.input} mode="outlined" />
            <View style={styles.row2}>
              <TextInput label={`${tr('prix_achat', lang)} (FCFA)`} value={prixAchatInput.texte}
                onChangeText={prixAchatInput.onChangeText}
                keyboardType="numeric" style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" />
              <TextInput label={`${tr('prix_vente', lang)} (FCFA) *`} value={prixVenteInput.texte}
                onChangeText={prixVenteInput.onChangeText}
                keyboardType="numeric" style={[styles.input, { flex: 1 }]} mode="outlined" />
            </View>
            <View style={styles.row2}>
              <TextInput label={tr('stock', lang)} value={form.quantite}
                onChangeText={v => setForm(f => ({ ...f, quantite: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" />
              <TextInput label={tr('seuil_alerte', lang)} value={form.seuilAlerte}
                onChangeText={v => setForm(f => ({ ...f, seuilAlerte: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1 }]} mode="outlined" />
            </View>
            <Text style={{ marginTop: 8, marginBottom: 6, fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              {tr('categorie', lang)} *
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {categories.map(c => (
                  <Chip
                    key={c.id}
                    selected={form.categorieId === String(c.id)}
                    onPress={() => setForm(f => ({ ...f, categorieId: String(c.id) }))}
                    style={form.categorieId === String(c.id) ? { backgroundColor: colors.primary + '33' } : undefined}
                  >
                    {c.nom}
                  </Chip>
                ))}
              </View>
            </ScrollView>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TextInput label="Nouvelle catégorie" value={categoryName}
                onChangeText={setCategoryName}
                style={[styles.input, { flex: 1, marginBottom: 0 }]} mode="outlined" dense />
              <IconButton icon="plus-circle" size={26} iconColor="#1a56db" onPress={creerCategorie} />
            </View>

            {fournisseurs.length > 0 && (
              <>
                <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                  {tr('fournisseur', lang) || 'Fournisseur'}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Chip compact selected={!form.fournisseurId} onPress={() => setForm(f => ({ ...f, fournisseurId: '' }))}>
                      Aucun
                    </Chip>
                    {fournisseurs.map((f: any) => (
                      <Chip
                        key={f.id}
                        compact
                        selected={form.fournisseurId === String(f.id)}
                        onPress={() => setForm(prev => ({ ...prev, fournisseurId: String(f.id) }))}
                      >
                        {f.nom}
                      </Chip>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}

            <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
              Type de vente
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {TYPES_VENTE.map(t => (
                <Chip key={t} compact selected={form.typeVente === t} onPress={() => setForm(f => ({ ...f, typeVente: t }))}>
                  {TYPE_VENTE_LABELS[t]}
                </Chip>
              ))}
            </View>

            {venteGrosDetailActif && (
              <TextInput label={tr('unite_base_label', lang)} value={form.uniteBase}
                onChangeText={v => setForm(f => ({ ...f, uniteBase: v }))}
                placeholder="Unité, Pièce, Kg..."
                style={styles.input} mode="outlined" />
            )}

            <TextInput label="Date de péremption (AAAA-MM-JJ)" value={form.datePeremption}
              onChangeText={v => setForm(f => ({ ...f, datePeremption: v }))}
              style={styles.input} mode="outlined" placeholder="2026-12-31" />

            <View style={styles.bioRow}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Produit bio</Text>
              <Switch value={form.bio} onValueChange={v => setForm(f => ({ ...f, bio: v }))} color={colors.primary} />
            </View>

            <TextInput label="Description" value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              style={styles.input} mode="outlined" multiline numberOfLines={3} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput label={tr('code_barres', lang)} value={form.codeBarre}
                onChangeText={v => setForm(f => ({ ...f, codeBarre: v }))}
                style={[styles.input, { flex: 1 }]} mode="outlined"
                keyboardType="default" placeholder="Ex: 3017620422003" />
              <IconButton icon="barcode-scan" size={28} iconColor="#1a56db"
                onPress={() => setShowScanner(true)} style={{ marginTop: 4 }} />
            </View>
            <Divider style={{ marginVertical: 12 }} />
            <Button mode="contained" onPress={sauvegarder} loading={saving}
              disabled={saving} style={styles.btnSave} contentStyle={{ height: 48 }}
              buttonColor="#1a56db">
              {editing ? tr('enregistrer', lang) : tr('nouveau_produit', lang)}
            </Button>
            <Button mode="outlined" onPress={fermerModal} style={{ marginTop: 8 }}>
              {tr('annuler', lang)}
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      <BarcodeScannerModal
        visible={showScanner}
        title="Scanner le code-barres produit"
        onScan={code => setForm(f => ({ ...f, codeBarre: code }))}
        onClose={() => setShowScanner(false)}
      />

      {/* Modal gestion catégories */}
      <Modal visible={showCategoriesModal} animationType="slide" onRequestClose={() => setShowCategoriesModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.text }]}>Catégories</Text>
            <IconButton icon="close" iconColor={colors.text} onPress={() => setShowCategoriesModal(false)} />
          </View>
          <ScrollView contentContainerStyle={[styles.modalBody, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TextInput label="Nom de la catégorie" value={categoryName} onChangeText={setCategoryName}
                style={[styles.input, { flex: 1, marginBottom: 0 }]} mode="outlined" />
              <Button mode="contained" onPress={creerCategorie} buttonColor="#1a56db">Ajouter</Button>
            </View>

            <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 8 }}>
              {categories.length} catégorie(s)
            </Text>

            {categories.map(cat => (
              <View key={cat.id} style={[styles.catRow, { borderBottomColor: colors.border }]}>
                {editingCategoryId === cat.id ? (
                  <>
                    <TextInput value={editingCategoryName} onChangeText={setEditingCategoryName}
                      style={{ flex: 1, marginRight: 8 }} mode="outlined" dense
                      onSubmitEditing={sauvegarderEditionCategorie} />
                    <IconButton icon="check" size={20} iconColor="#16a34a" onPress={sauvegarderEditionCategorie} />
                    <IconButton icon="close" size={20} iconColor="#64748b" onPress={() => setEditingCategoryId(null)} />
                  </>
                ) : (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{cat.nom}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{countByCategorie(cat.id)} article(s)</Text>
                    </View>
                    <IconButton icon="pencil" size={20} iconColor="#1a56db" onPress={() => demarrerEditionCategorie(cat)} />
                    <IconButton icon="delete" size={20} iconColor="#f44336" onPress={() => confirmerSuppressionCategorie(cat)} />
                  </>
                )}
              </View>
            ))}
            {categories.length === 0 && (
              <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 20 }}>Aucune catégorie</Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal statistiques */}
      <Modal visible={showStatsModal} animationType="slide" onRequestClose={() => setShowStatsModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.text }]}>Statistiques stock</Text>
          <IconButton icon="close" iconColor={colors.text} onPress={() => setShowStatsModal(false)} />
        </View>
        {stats && (
          <ScrollView contentContainerStyle={[styles.modalBody, { backgroundColor: colors.background }]}>
            <View style={styles.colorCards}>
              <View style={[styles.colorCard, { backgroundColor: '#dbeafe' }]}>
                <MaterialCommunityIcons name="cube-outline" size={16} color="#1d4ed8" />
                <Text style={[styles.ccLabel, { color: '#1d4ed8' }]}>Produits</Text>
                <Text style={[styles.ccValue, { color: '#1d4ed8' }]}>{stats.totalProduits}</Text>
              </View>
              <View style={[styles.colorCard, { backgroundColor: '#dcfce7' }]}>
                <MaterialCommunityIcons name="trending-up" size={16} color="#15803d" />
                <Text style={[styles.ccLabel, { color: '#15803d' }]}>Valeur stock</Text>
                <Text style={[styles.ccValue, { color: '#15803d' }]} numberOfLines={1}>{(stats.valeurTotale || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} F</Text>
              </View>
              <View style={[styles.colorCard, { backgroundColor: '#fef3c7' }]}>
                <MaterialCommunityIcons name="alert-outline" size={16} color="#b45309" />
                <Text style={[styles.ccLabel, { color: '#b45309' }]}>Stock faible</Text>
                <Text style={[styles.ccValue, { color: '#b45309' }]}>{stats.produitsStockFaible}</Text>
              </View>
              <View style={[styles.colorCard, { backgroundColor: '#fee2e2' }]}>
                <MaterialCommunityIcons name="close-circle-outline" size={16} color="#b91c1c" />
                <Text style={[styles.ccLabel, { color: '#b91c1c' }]}>Rupture</Text>
                <Text style={[styles.ccValue, { color: '#b91c1c' }]}>{stats.produitsRupture}</Text>
              </View>
            </View>
            {stats.produitsPerimes !== undefined && (
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Produits périmés</Text>
                <Text style={{ color: '#dc2626', fontWeight: 'bold' }}>{stats.produitsPerimes}</Text>
              </View>
            )}
            {stats.totalFournisseurs !== undefined && (
              <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Fournisseurs</Text>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>{stats.totalFournisseurs}</Text>
              </View>
            )}
          </ScrollView>
        )}
        </View>
      </Modal>

      {/* Modal Niveaux */}
      <Modal visible={showNiveauxModal} animationType="slide" onRequestClose={() => setShowNiveauxModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={[styles.modalTitle, { color: colors.text }]}>Niveaux — {produitCourant?.nom}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>Conditionnement multi-niveaux</Text>
            </View>
            <IconButton icon="close" iconColor={colors.text} onPress={() => setShowNiveauxModal(false)} />
          </View>

          {loadingNiveaux ? (
            <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
              <SkeletonCard count={3} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">

              {/* Chaine visuelle des niveaux */}
              {niveaux.length > 0 && (
                <View style={[nStyles.chaineContainer, { backgroundColor: colors.inputBg }]}>
                  {buildNiveauxChaine(niveaux).map((n, i, arr) => (
                    <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[nStyles.chaineBadge, { backgroundColor: colors.primary }]}>
                        <Text style={nStyles.chaineNom}>{n.nom}</Text>
                      </View>
                      {i < arr.length - 1 && (
                        <Text style={[nStyles.chaineArrow, { color: colors.textSecondary }]}> → </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Liste des niveaux existants */}
              {niveaux.length === 0 && (
                <Text style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: 20, marginTop: 10 }}>
                  Aucun niveau defini pour ce produit
                </Text>
              )}

              {buildNiveauxChaine(niveaux).map(n => {
                const parentNom = nomParentNiveau(n, niveaux);
                return (
                  <View key={n.id} style={[nStyles.niveauCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                    {editingNiveauId === n.id ? (
                      /* Mode edition — dialogue convivial, sans sélecteur technique de parent
                         (le parent reste celui déjà associé à ce niveau, non modifiable ici) */
                      <View>
                        <Text style={nStyles.niveauEditTitle}>Modifier {n.nom}</Text>
                        <TextInput label="Comment s'appelle ce conditionnement ?"
                          placeholder="Ex : Carton, Sachet, Bidon"
                          value={formEditNiveau.nom}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, nom: v }))}
                          style={nStyles.inp} mode="outlined" />

                        <TextInput
                          label={
                            parentNom
                              ? `Combien de ${formEditNiveau.nom || n.nom} dans un(e) ${parentNom} ?`
                              : `Combien de ${produitCourant?.nom || 'produit'} (vendu à l'unité) contient un(e) ${formEditNiveau.nom || n.nom} ?`
                          }
                          value={formEditNiveau.facteur}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, facteur: v }))}
                          keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                        <TextInput label={`Prix de vente d'un(e) ${formEditNiveau.nom || n.nom} ?`}
                          value={prixVenteEditNiveauInput.texte}
                          onChangeText={prixVenteEditNiveauInput.onChangeText}
                          keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                        <TouchableOpacity style={nStyles.avanceToggle} onPress={() => setAvanceEditOuvert(o => !o)}>
                          <MaterialCommunityIcons name={avanceEditOuvert ? 'chevron-up' : 'chevron-down'} size={16} color="#7c3aed" />
                          <Text style={nStyles.avanceToggleText}>Avancé (prix d'achat)</Text>
                        </TouchableOpacity>
                        {avanceEditOuvert && (
                          <TextInput label={`Prix d'achat d'un(e) ${formEditNiveau.nom || n.nom} ?`}
                            value={prixAchatEditNiveauInput.texte}
                            onChangeText={prixAchatEditNiveauInput.onChangeText}
                            keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                        )}

                        <TextInput label="Stock actuel" value={formEditNiveau.stock}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, stock: v }))}
                          keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                        {/* Encart de comparaison, recalculé en direct */}
                        {(() => {
                          const facteurN = parseFloat(formEditNiveau.facteur);
                          const prixVenteN = formEditNiveau.prixVente;
                          if (isNaN(facteurN) || facteurN < 1 || isNaN(prixVenteN) || prixVenteN <= 0) return null;
                          const nomAffiche = formEditNiveau.nom || n.nom;
                          if (parentNom) {
                            const parentNiveau = niveaux.find(pn => pn.id === n.parentId);
                            const prixParent = parentNiveau?.prixVente ?? 0;
                            const valeurEquivalente = facteurN * prixVenteN;
                            const ecart = valeurEquivalente - prixParent;
                            return (
                              <View style={[nStyles.comparaisonBox, { backgroundColor: colors.infoBg, borderColor: colors.info }]}>
                                <Text style={[nStyles.comparaisonText, { color: colors.info }]}>
                                  1 {parentNom} = {facteurN} {nomAffiche} à {prixVenteN.toLocaleString('de-DE')} F l'unité = {valeurEquivalente.toLocaleString('de-DE')} F si vendus séparément.
                                </Text>
                                <Text style={[nStyles.comparaisonText, { fontWeight: '700', marginTop: 4, color: ecart >= 0 ? colors.success : colors.danger }]}>
                                  {ecart >= 0
                                    ? `Le prix actuel d'1 ${parentNom} (${prixParent.toLocaleString('de-DE')} F) fait économiser ${ecart.toLocaleString('de-DE')} F au client qui achète en ${parentNom}.`
                                    : `Le prix actuel d'1 ${parentNom} (${prixParent.toLocaleString('de-DE')} F) coûte ${Math.abs(ecart).toLocaleString('de-DE')} F de plus — vérifie le prix de ${parentNom} ou de ${nomAffiche}.`}
                                </Text>
                              </View>
                            );
                          }
                          const prixUnite = produitCourant?.prixVente || 0;
                          const valeurDetail = facteurN * prixUnite;
                          const ecart = valeurDetail - prixVenteN;
                          return (
                            <View style={[nStyles.comparaisonBox, { backgroundColor: colors.infoBg, borderColor: colors.info }]}>
                              <Text style={[nStyles.comparaisonText, { color: colors.info }]}>
                                1 {nomAffiche} = {facteurN} {produitCourant?.nom} à {prixUnite.toLocaleString('de-DE')} F l'unité = {valeurDetail.toLocaleString('de-DE')} F si vendu(s) à l'unité.
                              </Text>
                              <Text style={[nStyles.comparaisonText, { fontWeight: '700', marginTop: 4, color: ecart >= 0 ? colors.success : colors.danger }]}>
                                {ecart >= 0
                                  ? `Ton prix ${nomAffiche} (${prixVenteN.toLocaleString('de-DE')} F) fait économiser ${ecart.toLocaleString('de-DE')} F au client qui achète en gros.`
                                  : `Ton prix ${nomAffiche} (${prixVenteN.toLocaleString('de-DE')} F) coûte ${Math.abs(ecart).toLocaleString('de-DE')} F de plus que l'achat à l'unité — vérifie ce prix.`}
                              </Text>
                            </View>
                          );
                        })()}

                        <View style={nStyles.row2}>
                          <Button mode="contained" onPress={sauvegarderEditNiveauFn} loading={savingNiveau}
                            style={{ flex: 1, marginRight: 6 }} buttonColor="#7c3aed">{tr('enregistrer', lang)}</Button>
                          <Button mode="outlined" onPress={() => { setEditingNiveauId(null); setAvanceEditOuvert(false); }}
                            style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
                        </View>
                      </View>
                    ) : (
                      /* Mode affichage */
                      <View>
                        <View style={nStyles.niveauHeader}>
                          <Text style={[nStyles.niveauNom, { color: colors.text }]}>{n.nom}</Text>
                          <View style={nStyles.niveauActions}>
                            <IconButton icon="pencil" size={18} iconColor="#1a56db" onPress={() => ouvrirEditNiveau(n)} />
                            <IconButton icon="delete" size={18} iconColor="#f44336" onPress={() => supprimerNiveauFn(n)} />
                          </View>
                        </View>

                        {/* Relation parent → enfant */}
                        {parentNom ? (
                          <View style={[nStyles.contientBadge, { backgroundColor: colors.infoBg }]}>
                            <Text style={[nStyles.contientText, { color: colors.info }]}>
                              1 {parentNom} = {n.facteur} {n.nom}
                            </Text>
                          </View>
                        ) : (
                          <View style={[nStyles.contientBadge, { backgroundColor: '#fdf4ff' }]}>
                            <Text style={[nStyles.contientText, { color: '#7c3aed' }]}>
                              Plus grand emballage
                            </Text>
                          </View>
                        )}

                        {/* Prix achat et vente — exigence client */}
                        <View style={nStyles.prixRow}>
                          <View style={[nStyles.prixBox, { backgroundColor: colors.dangerBg }]}>
                            <Text style={[nStyles.prixLabel, { color: colors.danger }]}>Achat</Text>
                            <Text style={[nStyles.prixAchatVal, { color: colors.danger }]}>{n.prixAchat.toLocaleString('de-DE', { maximumFractionDigits: 0 })} F</Text>
                          </View>
                          <View style={[nStyles.prixBox, { backgroundColor: colors.successBg }]}>
                            <Text style={[nStyles.prixLabel, { color: colors.success }]}>Vente</Text>
                            <Text style={[nStyles.prixVenteVal, { color: colors.success }]}>{n.prixVente.toLocaleString('de-DE', { maximumFractionDigits: 0 })} F</Text>
                          </View>
                        </View>

                        <View style={nStyles.stockRow}>
                          <Text style={[nStyles.stockLabel, { color: colors.textSecondary }]}>Stock {n.nom} :</Text>
                          <StockBadge quantite={n.stock ?? 0} seuilAlerte={5} />
                          <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 6 }}>(modifiable via crayon)</Text>
                        </View>

                        {/* Bouton decomposer si ce niveau a un enfant */}
                        {niveaux.some(c => c.parentId === n.id) && (
                          <TouchableOpacity
                            style={[nStyles.decomposerBtn, { backgroundColor: colors.warningBg, borderColor: colors.warning }]}
                            onPress={async () => {
                              const enfants = niveaux.filter(c => c.parentId === n.id);
                              const enfant = enfants[0];
                              Alert.alert(
                                'Ouvrir 1 ' + n.nom,
                                `Decomposer 1 ${n.nom} en ${n.facteur} ${enfant?.nom || 'unites'} ?`,
                                [
                                  { text: 'Annuler', style: 'cancel' },
                                  {
                                    text: 'Ouvrir', onPress: async () => {
                                      try {
                                        const res = await decomposer(n.id!);
                                        Alert.alert('OK', res.message || 'Decompose avec succes');
                                        if (produitCourant) await rechargerNiveaux(produitCourant.id);
                                      } catch (e: any) {
                                        Alert.alert('Erreur', e.response?.data?.message || 'Impossible de decomposer');
                                      }
                                    }
                                  },
                                ]
                              );
                            }}
                          >
                            <Text style={[nStyles.decomposerText, { color: colors.warning }]}>
                              Ouvrir 1 {n.nom} → {n.facteur} {niveaux.find(c => c.parentId === n.id)?.nom || 'unites'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              <Divider style={{ marginVertical: 16 }} />

              {/* Flux guidé en langage courant — le parent (racine ou feuille
                  actuelle) est toujours déduit automatiquement, jamais choisi
                  manuellement. Cas A : aucun niveau n'existe encore.
                  Cas B : au moins un niveau existe déjà. */}
              {niveaux.length === 0 ? (
                <View style={[nStyles.addSection, { backgroundColor: colors.successBg }]}>
                  {niveauVeutGros === null ? (
                    <View>
                      <Text style={[nStyles.addTitle, { color: colors.success }]}>Vente en gros</Text>
                      <Text style={[nStyles.addHint, { color: colors.textSecondary }]}>
                        Ce produit se vend-il aussi en plus grand conditionnement (en gros) ?
                      </Text>
                      <View style={nStyles.row2}>
                        <Button mode="outlined" onPress={() => setShowNiveauxModal(false)} style={{ flex: 1, marginRight: 6 }}>
                          Non
                        </Button>
                        <Button mode="contained" onPress={() => setNiveauVeutGros(true)} style={{ flex: 1 }} buttonColor="#16a34a">
                          Oui
                        </Button>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <Text style={nStyles.addTitle}>Nouveau conditionnement</Text>
                      <Text style={nStyles.addHint}>
                        Ex : ce produit se vend aussi par Carton, Sachet, Bidon...
                      </Text>

                      <TextInput label="Comment s'appelle ce conditionnement ?"
                        placeholder="Ex : Carton, Sachet, Bidon"
                        value={formNiveau.nom}
                        onChangeText={v => setFormNiveau(f => ({ ...f, nom: v }))}
                        style={nStyles.inp} mode="outlined" />

                      <TextInput
                        label={`Combien de ${produitCourant?.nom || 'produit'} (vendu à l'unité) contient un(e) ${formNiveau.nom || '...'} ?`}
                        value={formNiveau.facteur}
                        onChangeText={v => setFormNiveau(f => ({ ...f, facteur: v }))}
                        keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                      <TextInput label={`Prix de vente d'un(e) ${formNiveau.nom || '...'} ?`}
                        value={prixVenteNiveauInput.texte}
                        onChangeText={prixVenteNiveauInput.onChangeText}
                        keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                      <TouchableOpacity style={nStyles.avanceToggle} onPress={() => setAvanceAjoutOuvert(o => !o)}>
                        <MaterialCommunityIcons name={avanceAjoutOuvert ? 'chevron-up' : 'chevron-down'} size={16} color="#15803d" />
                        <Text style={[nStyles.avanceToggleText, { color: '#15803d' }]}>Avancé (prix d'achat)</Text>
                      </TouchableOpacity>
                      {avanceAjoutOuvert && (
                        <TextInput label={`Prix d'achat d'un(e) ${formNiveau.nom || '...'} ?`}
                          value={prixAchatNiveauInput.texte}
                          onChangeText={prixAchatNiveauInput.onChangeText}
                          keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                      )}

                      {/* Encart de comparaison, recalculé en direct */}
                      {(() => {
                        const facteurN = parseFloat(formNiveau.facteur);
                        const prixVenteN = formNiveau.prixVente;
                        if (isNaN(facteurN) || facteurN < 1 || isNaN(prixVenteN) || prixVenteN <= 0) return null;
                        const nomAffiche = formNiveau.nom || '...';
                        const prixUnite = produitCourant?.prixVente || 0;
                        const valeurDetail = facteurN * prixUnite;
                        const ecart = valeurDetail - prixVenteN;
                        return (
                          <View style={nStyles.comparaisonBox}>
                            <Text style={nStyles.comparaisonText}>
                              1 {nomAffiche} = {facteurN} {produitCourant?.nom} à {prixUnite.toLocaleString('de-DE')} F l'unité = {valeurDetail.toLocaleString('de-DE')} F si vendu(s) à l'unité.
                            </Text>
                            <Text style={[nStyles.comparaisonText, { fontWeight: '700', marginTop: 4, color: ecart >= 0 ? '#15803d' : '#b91c1c' }]}>
                              {ecart >= 0
                                ? `Ton prix ${nomAffiche} (${prixVenteN.toLocaleString('de-DE')} F) fait économiser ${ecart.toLocaleString('de-DE')} F au client qui achète en gros.`
                                : `Ton prix ${nomAffiche} (${prixVenteN.toLocaleString('de-DE')} F) coûte ${Math.abs(ecart).toLocaleString('de-DE')} F de plus que l'achat à l'unité — vérifie ce prix.`}
                            </Text>
                          </View>
                        );
                      })()}

                      <Button mode="contained" onPress={ajouterNiveauFn} loading={savingNiveau}
                        style={{ marginTop: 8, borderRadius: 10 }} contentStyle={{ height: 48 }}
                        buttonColor="#16a34a" icon="check">
                        Enregistrer ce conditionnement
                      </Button>
                    </View>
                  )}
                </View>
              ) : afficherFormNiveau ? (
                <View style={nStyles.addSection}>
                  <Text style={nStyles.addTitle}>Ajouter un sous-conditionnement sous {niveauFeuilleActuel?.nom}</Text>
                  <Text style={nStyles.addHint}>
                    Ex : {niveauFeuilleActuel?.nom} contient plusieurs plus petits emballages
                  </Text>

                  <TextInput label="Comment s'appelle ce sous-conditionnement ?"
                    placeholder="Ex : Paquet, Piece"
                    value={formNiveau.nom}
                    onChangeText={v => setFormNiveau(f => ({ ...f, nom: v }))}
                    style={nStyles.inp} mode="outlined" />

                  <TextInput
                    label={`Combien de ${formNiveau.nom || '...'} dans un(e) ${niveauFeuilleActuel?.nom} ?`}
                    value={formNiveau.facteur}
                    onChangeText={v => setFormNiveau(f => ({ ...f, facteur: v }))}
                    keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                  <TextInput label={`Prix de vente d'un(e) ${formNiveau.nom || '...'} ?`}
                    value={prixVenteNiveauInput.texte}
                    onChangeText={prixVenteNiveauInput.onChangeText}
                    keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                  <TouchableOpacity style={nStyles.avanceToggle} onPress={() => setAvanceAjoutOuvert(o => !o)}>
                    <MaterialCommunityIcons name={avanceAjoutOuvert ? 'chevron-up' : 'chevron-down'} size={16} color="#15803d" />
                    <Text style={[nStyles.avanceToggleText, { color: '#15803d' }]}>Avancé (prix d'achat)</Text>
                  </TouchableOpacity>
                  {avanceAjoutOuvert && (
                    <TextInput label={`Prix d'achat d'un(e) ${formNiveau.nom || '...'} ?`}
                      value={prixAchatNiveauInput.texte}
                      onChangeText={prixAchatNiveauInput.onChangeText}
                      keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                  )}

                  {/* Encart de comparaison, recalculé en direct */}
                  {(() => {
                    const facteurN = parseFloat(formNiveau.facteur);
                    const prixVenteN = formNiveau.prixVente;
                    if (isNaN(facteurN) || facteurN < 1 || isNaN(prixVenteN) || prixVenteN <= 0 || !niveauFeuilleActuel) return null;
                    const nomAffiche = formNiveau.nom || '...';
                    const valeurEquivalente = facteurN * prixVenteN;
                    const ecart = valeurEquivalente - niveauFeuilleActuel.prixVente;
                    return (
                      <View style={nStyles.comparaisonBox}>
                        <Text style={nStyles.comparaisonText}>
                          1 {niveauFeuilleActuel.nom} = {facteurN} {nomAffiche} à {prixVenteN.toLocaleString('de-DE')} F l'unité = {valeurEquivalente.toLocaleString('de-DE')} F si vendus séparément.
                        </Text>
                        <Text style={[nStyles.comparaisonText, { fontWeight: '700', marginTop: 4, color: ecart >= 0 ? '#15803d' : '#b91c1c' }]}>
                          {ecart >= 0
                            ? `Le prix actuel d'1 ${niveauFeuilleActuel.nom} (${niveauFeuilleActuel.prixVente.toLocaleString('de-DE')} F) fait économiser ${ecart.toLocaleString('de-DE')} F au client qui achète en ${niveauFeuilleActuel.nom}.`
                            : `Le prix actuel d'1 ${niveauFeuilleActuel.nom} (${niveauFeuilleActuel.prixVente.toLocaleString('de-DE')} F) coûte ${Math.abs(ecart).toLocaleString('de-DE')} F de plus — vérifie le prix de ${niveauFeuilleActuel.nom} ou de ${nomAffiche}.`}
                        </Text>
                      </View>
                    );
                  })()}

                  <Button mode="contained" onPress={ajouterNiveauFn} loading={savingNiveau}
                    style={{ marginTop: 8, borderRadius: 10 }} contentStyle={{ height: 48 }}
                    buttonColor="#16a34a" icon="check">
                    Enregistrer ce sous-conditionnement
                  </Button>
                </View>
              ) : (
                <TouchableOpacity style={nStyles.reouvrirBtn} onPress={() => setAfficherFormNiveau(true)}>
                  <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#16a34a" />
                  <Text style={nStyles.reouvrirText}>Ajouter un sous-conditionnement</Text>
                </TouchableOpacity>
              )}

            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Unités de vente (CleFonctionnalite.VENTE_GROS_DETAIL) — système
          simple, indépendant du modal Niveaux ci-dessus */}
      <Modal visible={showUnitesVenteModal} animationType="slide" onRequestClose={() => setShowUnitesVenteModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.modalTitle}>
                {tr('unites_vente_titre', lang)} — {produitUnitesCourant?.nom}
              </Text>
              <Text style={{ fontSize: 12, color: '#64748b' }}>{tr('unites_vente_sous_titre', lang)}</Text>
            </View>
            <IconButton icon="close" onPress={() => setShowUnitesVenteModal(false)} />
          </View>

          {loadingUnitesVente ? (
            <ActivityIndicator style={{ flex: 1 }} size="large" color="#0d9488" />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

              {unitesVente.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 20, marginTop: 10 }}>
                  {tr('aucune_unite_vente', lang)}
                </Text>
              )}

              {unitesVente.map(u => (
                <View key={u.id} style={uStyles.uniteCard}>
                  {editingUniteVenteId === u.id ? (
                    <View>
                      <Text style={uStyles.uniteEditTitle}>{tr('modifier_unite_vente', lang)} — {u.nom}</Text>
                      <TextInput label={tr('nom_unite_vente', lang)} value={formUniteVente.nom}
                        onChangeText={v => setFormUniteVente(f => ({ ...f, nom: v }))}
                        style={uStyles.inp} mode="outlined" />

                      <Text style={uStyles.miniLabel}>{tr('par_rapport_a', lang)}</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Chip compact selected={!formUniteVente.referenceId}
                            onPress={() => setFormUniteVente(f => ({ ...f, referenceId: '' }))}>
                            {produitUnitesCourant?.uniteBase || tr('unite_base_mot', lang)}
                          </Chip>
                          {unitesVente.filter(x => x.id !== editingUniteVenteId).map(x => (
                            <Chip key={x.id} compact selected={formUniteVente.referenceId === String(x.id)}
                              onPress={() => setFormUniteVente(f => ({ ...f, referenceId: String(x.id) }))}>
                              {x.nom}
                            </Chip>
                          ))}
                        </View>
                      </ScrollView>

                      <TextInput
                        label={`${tr('facteur_relatif', lang)} (1 ${formUniteVente.nom || '...'} = ? ${nomReferenceUnite(formUniteVente.referenceId) || '...'})`}
                        value={formUniteVente.facteurRelatif}
                        onChangeText={v => setFormUniteVente(f => ({ ...f, facteurRelatif: v }))}
                        keyboardType="numeric" style={uStyles.inp} mode="outlined" />

                      <View style={uStyles.row2}>
                        <TextInput label={`${tr('prix_achat', lang)} (FCFA)`} value={prixAchatUniteInput.texte}
                          onChangeText={prixAchatUniteInput.onChangeText}
                          keyboardType="numeric" style={[uStyles.inp, { flex: 1, marginRight: 8 }]} mode="outlined" />
                        <TextInput label={`${tr('prix_vente', lang)} (FCFA) *`} value={prixVenteUniteInput.texte}
                          onChangeText={prixVenteUniteInput.onChangeText}
                          keyboardType="numeric" style={[uStyles.inp, { flex: 1 }]} mode="outlined" />
                      </View>

                      <View style={uStyles.row2}>
                        <Button mode="contained" onPress={ajouterOuModifierUniteVente} loading={savingUniteVente}
                          style={{ flex: 1, marginRight: 6 }} buttonColor="#0d9488">{tr('enregistrer', lang)}</Button>
                        <Button mode="outlined" onPress={annulerEditUniteVente} style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
                      </View>
                    </View>
                  ) : (
                    <View>
                      <View style={uStyles.uniteHeader}>
                        <Text style={uStyles.uniteNom}>{u.nom}</Text>
                        {isAdmin && (
                          <View style={{ flexDirection: 'row' }}>
                            <IconButton icon="pencil" size={18} iconColor="#1a56db" onPress={() => ouvrirEditUniteVente(u)} />
                            <IconButton icon="delete" size={18} iconColor="#f44336" onPress={() => supprimerUniteVenteFn(u)} />
                          </View>
                        )}
                      </View>
                      <View style={uStyles.contientBadge}>
                        <Text style={uStyles.contientText}>
                          1 {u.nom} = {u.facteurBase} {produitUnitesCourant?.uniteBase || tr('unite_base_mot', lang)}
                        </Text>
                      </View>
                      <View style={uStyles.prixRow}>
                        <View style={uStyles.prixBox}>
                          <Text style={uStyles.prixLabel}>{tr('prix_achat', lang)}</Text>
                          <Text style={uStyles.prixAchatVal}>{(u.prixAchat || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} F</Text>
                        </View>
                        <View style={[uStyles.prixBox, { backgroundColor: '#f0fdf4' }]}>
                          <Text style={[uStyles.prixLabel, { color: '#15803d' }]}>{tr('prix_vente', lang)}</Text>
                          <Text style={uStyles.prixVenteVal}>{(u.prixVente || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} F</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {isAdmin && editingUniteVenteId === null && (
                <View style={uStyles.addSection}>
                  <Text style={uStyles.addTitle}>{tr('ajouter_unite_vente', lang)}</Text>

                  <TextInput label={tr('nom_unite_vente', lang)} placeholder="Ex : Carton, Cartouche"
                    value={formUniteVente.nom}
                    onChangeText={v => setFormUniteVente(f => ({ ...f, nom: v }))}
                    style={uStyles.inp} mode="outlined" />

                  <Text style={uStyles.miniLabel}>{tr('par_rapport_a', lang)}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Chip compact selected={!formUniteVente.referenceId}
                        onPress={() => setFormUniteVente(f => ({ ...f, referenceId: '' }))}>
                        {produitUnitesCourant?.uniteBase || tr('unite_base_mot', lang)}
                      </Chip>
                      {unitesVente.map(x => (
                        <Chip key={x.id} compact selected={formUniteVente.referenceId === String(x.id)}
                          onPress={() => setFormUniteVente(f => ({ ...f, referenceId: String(x.id) }))}>
                          {x.nom}
                        </Chip>
                      ))}
                    </View>
                  </ScrollView>

                  <TextInput
                    label={`${tr('facteur_relatif', lang)} (1 ${formUniteVente.nom || '...'} = ? ${nomReferenceUnite(formUniteVente.referenceId) || '...'})`}
                    value={formUniteVente.facteurRelatif}
                    onChangeText={v => setFormUniteVente(f => ({ ...f, facteurRelatif: v }))}
                    keyboardType="numeric" style={uStyles.inp} mode="outlined" />

                  <View style={uStyles.row2}>
                    <TextInput label={`${tr('prix_achat', lang)} (FCFA)`} value={prixAchatUniteInput.texte}
                      onChangeText={prixAchatUniteInput.onChangeText}
                      keyboardType="numeric" style={[uStyles.inp, { flex: 1, marginRight: 8 }]} mode="outlined" />
                    <TextInput label={`${tr('prix_vente', lang)} (FCFA) *`} value={prixVenteUniteInput.texte}
                      onChangeText={prixVenteUniteInput.onChangeText}
                      keyboardType="numeric" style={[uStyles.inp, { flex: 1 }]} mode="outlined" />
                  </View>

                  <Button mode="contained" onPress={ajouterOuModifierUniteVente} loading={savingUniteVente}
                    style={{ marginTop: 4, borderRadius: 10 }} contentStyle={{ height: 48 }}
                    buttonColor="#0d9488" icon="check">
                    {tr('enregistrer', lang)}
                  </Button>
                </View>
              )}

            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const nStyles = StyleSheet.create({
  // Chaine visuelle
  chaineContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 14 },
  chaineBadge: { backgroundColor: '#1a56db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chaineNom: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chaineArrow: { color: '#64748b', fontSize: 18, fontWeight: '700' },
  // Cartes niveaux
  niveauCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  niveauHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  niveauNom: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  niveauActions: { flexDirection: 'row' },
  contientBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 6, marginBottom: 10 },
  contientText: { color: '#1e40af', fontSize: 13, fontWeight: '600' },
  // Prix achat + vente cote a cote
  prixRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  prixBox: { flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, alignItems: 'center' },
  prixLabel: { fontSize: 10, color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  prixAchatVal: { fontSize: 15, fontWeight: '800', color: '#b91c1c' },
  prixVenteVal: { fontSize: 15, fontWeight: '800', color: '#15803d' },
  // Stock
  stockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stockLabel: { color: '#64748b', fontSize: 13, marginRight: 8 },
  stockBadge: { backgroundColor: '#e0e7ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginRight: 6 },
  stockVal: { color: '#3730a3', fontWeight: '700', fontSize: 14 },
  // Bouton decomposer
  decomposerBtn: { backgroundColor: '#fff7ed', borderRadius: 8, borderWidth: 1, borderColor: '#fdba74', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginTop: 4 },
  decomposerText: { color: '#c2410c', fontWeight: '600', fontSize: 13 },
  // Formulaire edition
  niveauEditTitle: { fontWeight: '700', color: '#7c3aed', marginBottom: 10 },
  // Formulaire ajout
  addSection: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14 },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#15803d', marginBottom: 4 },
  addHint: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  inp: { marginBottom: 10, backgroundColor: '#fff' },
  row2: { flexDirection: 'row', marginBottom: 0 },
  // Section repliable "Avancé" (prix d'achat) — masquée par défaut pour ne
  // pas surcharger un utilisateur non technique.
  avanceToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, marginTop: -2 },
  avanceToggleText: { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  // Encart de comparaison gros/détail, recalculé en direct
  comparaisonBox: { backgroundColor: '#eff6ff', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bfdbfe' },
  comparaisonText: { fontSize: 12.5, color: '#1e3a8a', lineHeight: 18 },
  // Bouton pour rouvrir le formulaire d'ajout après avoir répondu "Non"
  reouvrirBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 10, borderWidth: 1, borderColor: '#86efac', paddingVertical: 12 },
  reouvrirText: { color: '#15803d', fontWeight: '700', fontSize: 13 },
});

const uStyles = StyleSheet.create({
  uniteCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  uniteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uniteNom: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  uniteEditTitle: { fontWeight: '700', color: '#0d9488', marginBottom: 10 },
  contientBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 6, marginBottom: 10 },
  contientText: { color: '#1e40af', fontSize: 13, fontWeight: '600' },
  prixRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  prixBox: { flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, alignItems: 'center' },
  prixLabel: { fontSize: 10, color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  prixAchatVal: { fontSize: 15, fontWeight: '800', color: '#b91c1c' },
  prixVenteVal: { fontSize: 15, fontWeight: '800', color: '#15803d' },
  addSection: { backgroundColor: '#f0fdfa', borderRadius: 12, padding: 14 },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#0f766e', marginBottom: 10 },
  miniLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  inp: { marginBottom: 10, backgroundColor: '#fff' },
  row2: { flexDirection: 'row', marginBottom: 0 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4ff' },
  search: { margin: 12, borderRadius: 12, backgroundColor: '#fff' },
  card: { marginBottom: 10, borderRadius: 14, elevation: 2, backgroundColor: '#fff' },
  cardPending: { borderWidth: 1.5, borderColor: '#ff9800', borderStyle: 'dashed' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  row2: { flexDirection: 'row', marginBottom: 0 },
  prix: { color: '#1a56db', fontWeight: '700', fontSize: 14 },
  prixAchat: { color: '#666', fontSize: 12 },
  stockBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  stockText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  chip: { marginTop: 6, alignSelf: 'flex-start' },
  pendingLabel: { color: '#ff9800', fontSize: 11, marginTop: 4 },
  actions: { justifyContent: 'flex-end', paddingTop: 0 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
  offlineBanner: { backgroundColor: '#ff9800', padding: 10, alignItems: 'center' },
  offlineText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  syncBanner: { backgroundColor: '#1a56db', padding: 8, alignItems: 'center' },
  syncText: { color: '#fff', fontSize: 12 },

  // Cartes KPI (comme .color-cards Ionic)
  colorCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: '#fff' },
  colorCard: { flexBasis: '47%', flexGrow: 1, borderRadius: 12, padding: 10, alignItems: 'flex-start' },
  ccLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  ccValue: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },

  // Chips segment (Tous/Stock faible/Péremption/Bio)
  segChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#e2e8f0' },
  segChipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  segChipText: { fontSize: 12, color: '#555', fontWeight: '600' },
  segChipTextActive: { color: '#fff' },
  sectionLabel: { fontSize: 12, color: '#64748b', marginTop: 10, marginBottom: 2 },

  // Badges carte produit
  bioBadge: { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  bioBadgeText: { color: '#15803d', fontWeight: '700', fontSize: 10 },
  peremptionBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 6 },
  alerteMsg: { color: '#d97706', fontSize: 12, marginTop: 6, fontWeight: '600' },

  // Modal catégories / stats
  catRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  bioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modalTitle: { fontWeight: '800', color: '#0f172a' },
  modalBody: { padding: 16, backgroundColor: '#f0f4ff', paddingBottom: 40 },
  input: { marginBottom: 12 },
  btnSave: { borderRadius: 10, marginTop: 4 },
});
