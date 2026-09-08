import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput, FlatList, Share, RefreshControl, Linking } from 'react-native';
import { Text, Button, ActivityIndicator, Modal, Portal, Divider, Checkbox, Card, FAB, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import {
  getCommandes, createCommande, updateCommande, validerCommande, deleteCommande,
  annulerCommande, payerCreditCommande, payerCreditsGroupesCommandes,
  getProduits, getClients
} from '../services/api.service';
import { partagerFactureRN, DesignFacture } from '../services/invoice.service';
import { sauvegarderCache, lireCache, creerCommandeOffline, executerOuMettreEnFile } from '../services/offline.service';
import { MontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';

type StatutCommande = 'BROUILLON' | 'VALIDEE' | 'ANNULEE';

interface LigneCommande {
  id?: number;
  produitId?: number;
  produitNom?: string;
  produit?: { id: number; nom: string; prixVente: number };
  quantite: number;
  prixUnitaire: number;
  sousTotal?: number;
}

interface Commande {
  id: number;
  numeroCommande: string;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  client?: { id: number; nom: string; prenom: string };
  lignes: LigneCommande[];
  montantTotal: number;
  modePaiement: string;
  estCredit: boolean;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  statut: StatutCommande;
  dateCommande: string;
  dateValidation?: string;
  venteId?: number;
  notes?: string;
  origine?: 'MAGASIN' | 'VITRINE';
  adresseLivraison?: string;
  fraisLivraison?: number;
  chauffeurNom?: string;
  chauffeurTelephone?: string;
}

interface LigneForm {
  produitId: number;
  produitNom: string;
  prixOriginal: number;
  prixUnitaire: number;
  quantite: number;
  remise: string;
}

const MODES = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE_MONEY', 'CARTE_BANCAIRE', 'VIREMENT', 'CHEQUE'];
const MODES_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
  WAVE_MONEY: 'Wave', CARTE_BANCAIRE: 'Carte Bancaire', VIREMENT: 'Virement', CHEQUE: 'Chèque'
};

// Indicatifs pays pour le téléphone du chauffeur (livraison commandes vitrine).
const INDICATIFS = [
  { code: '+223', label: 'Mali' },
  { code: '+225', label: "Côte d'Ivoire" },
  { code: '+226', label: 'Burkina Faso' },
  { code: '+221', label: 'Sénégal' },
  { code: '+227', label: 'Niger' },
  { code: '+228', label: 'Togo' },
  { code: '+229', label: 'Bénin' },
  { code: '+224', label: 'Guinée' },
  { code: '+233', label: 'Ghana' },
  { code: '+234', label: 'Nigeria' },
  { code: '+33', label: 'France' },
];

function formatMontant(v: number) {
  return new Intl.NumberFormat('fr-FR').format(v || 0) + ' FCFA';
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getClientNom(c: Commande): string {
  return [c.clientNom, c.clientPrenom].filter(Boolean).join(' ') || c.client?.nom || 'N/A';
}

function ouvrirWhatsApp(numero: string, message: string) {
  const clean = numero.replace(/[\s()\-+]/g, '');
  Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(message)}`);
}

function buildMessageClientLivraison(c: Commande, fraisLivraison?: number): string {
  const total = (c.montantTotal || 0) + (fraisLivraison || 0);
  return [
    `Bonjour, votre commande ${c.numeroCommande} a été validée.`,
    `Total produits : ${formatMontant(c.montantTotal)}`,
    fraisLivraison ? `Frais de livraison : ${formatMontant(fraisLivraison)}` : null,
    `TOTAL à préparer : ${formatMontant(total)}`,
    `(payable à la livraison)`,
  ].filter(Boolean).join('\n');
}

function buildMessageChauffeurLivraison(c: Commande, fraisLivraison?: number): string {
  const total = (c.montantTotal || 0) + (fraisLivraison || 0);
  return [
    `Nouvelle livraison — commande ${c.numeroCommande}`,
    `Client : ${getClientNom(c)}`,
    c.clientTelephone ? `Téléphone client : ${c.clientTelephone}` : null,
    `Adresse : ${c.adresseLivraison || 'Non renseignée'}`,
    `Montant à collecter : ${formatMontant(total)}`,
  ].filter(Boolean).join('\n');
}

function buildBonCommande(c: Commande): string {
  const client = getClientNom(c);
  const lignes = c.lignes.map((l, i) =>
    `${i + 1}. ${l.produit?.nom || l.produitNom} × ${l.quantite} = ${formatMontant(l.sousTotal || l.prixUnitaire * l.quantite)}`
  ).join('\n');
  const credit = c.estCredit
    ? `\nVersé : ${formatMontant(c.montantVerse)}\nReste dû : ${formatMontant(c.montantRestant)}`
    : '';
  return `BON DE COMMANDE\n${c.numeroCommande}\nDate : ${formatDate(c.dateCommande)}\n\nClient : ${client}\n${c.clientTelephone ? 'Tél : ' + c.clientTelephone + '\n' : ''}\nPRODUITS :\n${lignes}\n\nTOTAL : ${formatMontant(c.montantTotal)}${credit}\n\nMode de paiement : ${c.modePaiement}${c.notes ? '\nNotes : ' + c.notes : ''}\n\n— Ges-Boutique`;
}

export default function CommandesScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const styles = createStyles(colors);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [boutique, setBoutique] = useState<any>({});
  const [design, setDesign] = useState<DesignFacture>(1);
  const [statutFilter, setStatutFilter] = useState<'' | 'BROUILLON' | 'VALIDEE' | 'CREDIT' | 'ANNULEE'>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [produits, setProduits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [lignesForm, setLignesForm] = useState<LigneForm[]>([]);

  const [searchProduit, setSearchProduit] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [showProduitDrop, setShowProduitDrop] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);

  const [userId, setUserId] = useState<number>(0);

  const [form, setForm] = useState({
    clientId: null as number | null,
    clientNom: '',
    clientPrenom: '',
    clientTelephone: '',
    modePaiement: 'ESPECES',
    referencePaiement: '',
    estCredit: false,
    montantVerse: 0,
    dateEcheance: '',
    notes: ''
  });

  // Validation livraison (commandes VITRINE)
  const [showLivraisonModal, setShowLivraisonModal] = useState(false);
  const [commandeLivraison, setCommandeLivraison] = useState<Commande | null>(null);
  const [livraisonFrais, setLivraisonFrais] = useState(0);
  const [livraisonChauffeurNom, setLivraisonChauffeurNom] = useState('');
  const [livraisonIndicatif, setLivraisonIndicatif] = useState(INDICATIFS[0].code);
  const [livraisonTelephoneLocal, setLivraisonTelephoneLocal] = useState('');

  // Règlement individuel
  const [showReglModal, setShowReglModal] = useState(false);
  const [commandeRegl, setCommandeRegl] = useState<Commande | null>(null);
  const [montantRegl, setMontantRegl] = useState(0);

  // Règlement groupé
  const [showReglGroupeModal, setShowReglGroupeModal] = useState(false);
  const [commandesCredit, setCommandesCredit] = useState<Commande[]>([]);
  const [idsSelectionnes, setIdsSelectionnes] = useState<number[]>([]);
  const [montantReglGroupe, setMontantReglGroupe] = useState(0);

  useFocusEffect(useCallback(() => {
    charger();
    AsyncStorage.getItem('boutique_info').then(raw => { if (raw) setBoutique(JSON.parse(raw)); });
    AsyncStorage.getItem('facture_template').then(t => {
      if (t === 'moderne') setDesign(2);
      else if (t === 'minimaliste') setDesign(3);
      else setDesign(1);
    });
    AsyncStorage.getItem('user').then(raw => {
      if (raw) { const u = JSON.parse(raw); setUserId(u.id || 0); }
    });
    getProduits().then((r: any) => setProduits(r.data || [])).catch(() => {});
    getClients().then((r: any) => {
      const data = r.data;
      setClients(data?.content || data || []);
    }).catch(() => {});
  }, []));

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const r: any = await getCommandes();
      const data: Commande[] = r.data || [];
      setCommandes(data);
      setFromCache(false);
      sauvegarderCache('commandes', data).catch(() => {});
    } catch {
      const cached = await lireCache<Commande>('commandes');
      if (cached.length > 0) { setCommandes(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
    if (event?.target?.complete) event.target.complete();
  };

  const onRefresh = () => { setRefreshing(true); charger(); };

  const commandesFiltrees = commandes.filter(c => {
    if (statutFilter === 'CREDIT') {
      if (!(c.estCredit && c.montantRestant > 0)) return false;
    } else if (statutFilter === 'ANNULEE') {
      if (c.statut !== 'ANNULEE') return false;
    } else if (statutFilter) {
      if (c.statut !== statutFilter) return false;
    }
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (c.numeroCommande || '').toLowerCase().includes(t) ||
             (c.clientNom || '').toLowerCase().includes(t);
    }
    return true;
  });

  const prixLigne = (l: LigneForm) => (l.prixUnitaire || 0) * l.quantite * (1 - (Number(l.remise) || 0) / 100);
  const totalCommande = lignesForm.reduce((s, l) => s + prixLigne(l), 0);
  const resteAPayer = Math.max(0, totalCommande - (form.montantVerse || 0));

  const nbEnAttente = commandes.filter(c => c.statut === 'BROUILLON').length;
  const nbValidees = commandes.filter(c => c.statut === 'VALIDEE').length;
  const totalMontant = commandes.reduce((s, c) => s + (c.montantTotal || 0), 0);
  const nbCreditsEnCours = commandes.filter(c => c.estCredit && c.montantRestant > 0).length;
  const totalCreditsRestants = commandes.filter(c => c.estCredit && c.montantRestant > 0).reduce((s, c) => s + (c.montantRestant || 0), 0);

  // ─── Produit search ─────────────────────────────────────────────────────────
  const produitsFiltres = searchProduit
    ? produits.filter((p: any) => p.nom.toLowerCase().includes(searchProduit.toLowerCase())).slice(0, 8)
    : produits.slice(0, 8);

  const selectionnerProduit = (p: any) => {
    setLignesForm(prev => {
      const ex = prev.find(l => l.produitId === p.id);
      if (ex) return prev.map(l => l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l);
      return [...prev, { produitId: p.id, produitNom: p.nom, prixOriginal: p.prixVente, prixUnitaire: p.prixVente || 0, quantite: 1, remise: '0' }];
    });
    setSearchProduit('');
    setShowProduitDrop(false);
  };

  const supprimerLigne = (i: number) => setLignesForm(prev => prev.filter((_, idx) => idx !== i));
  const changerQty = (i: number, d: number) => setLignesForm(prev =>
    prev.map((l, idx) => idx === i ? { ...l, quantite: Math.max(1, l.quantite + d) } : l)
  );

  // ─── Client search ──────────────────────────────────────────────────────────
  const clientsFiltres = searchClient
    ? clients.filter((c: any) => `${c.nom} ${c.prenom} ${c.numeroTelephone}`.toLowerCase().includes(searchClient.toLowerCase())).slice(0, 6)
    : clients.slice(0, 6);

  const selectionnerClient = (c: any) => {
    setForm(f => ({ ...f, clientId: c.id, clientNom: c.nom, clientPrenom: c.prenom || '', clientTelephone: c.numeroTelephone || '' }));
    setSearchClient(`${c.nom} ${c.prenom || ''}`.trim());
    setShowClientDrop(false);
  };

  // ─── Modal CRUD ─────────────────────────────────────────────────────────────
  const ouvrirCreer = () => {
    setEditingId(null);
    setLignesForm([]);
    setForm({ clientId: null, clientNom: '', clientPrenom: '', clientTelephone: '', modePaiement: 'ESPECES', referencePaiement: '', estCredit: false, montantVerse: 0, dateEcheance: '', notes: '' });
    setSearchClient('');
    setSearchProduit('');
    setShowModal(true);
  };

  const ouvrirModifier = (c: Commande) => {
    setEditingId(c.id);
    setForm({
      clientId: c.client?.id || null,
      clientNom: c.clientNom || '',
      clientPrenom: c.clientPrenom || '',
      clientTelephone: c.clientTelephone || '',
      modePaiement: c.modePaiement || 'ESPECES',
      referencePaiement: '',
      estCredit: c.estCredit || false,
      montantVerse: c.montantVerse || 0,
      dateEcheance: c.dateEcheance?.split('T')[0] || '',
      notes: c.notes || ''
    });
    setSearchClient(getClientNom(c));
    setLignesForm((c.lignes || []).map(l => ({
      produitId: l.produit?.id || l.produitId || 0,
      produitNom: l.produit?.nom || l.produitNom || '',
      prixOriginal: l.produit?.prixVente || l.prixUnitaire,
      prixUnitaire: l.prixUnitaire || 0,
      quantite: l.quantite,
      remise: String((l as any).remise || 0)
    })));
    setShowModal(true);
  };

  const enregistrer = async () => {
    if (lignesForm.length === 0) { Alert.alert(tr('erreur', lang), tr('ajouter_produit', lang)); return; }
    if (form.modePaiement !== 'ESPECES' && !form.referencePaiement?.trim()) {
      Alert.alert(tr('erreur', lang), `Référence obligatoire pour ${MODES_LABELS[form.modePaiement] || form.modePaiement}`);
      return;
    }
    setSubmitting(true);
    const request = {
      vendeurId: userId,
      clientId: form.clientId || undefined,
      clientNom: form.clientNom || undefined,
      clientPrenom: form.clientPrenom || undefined,
      clientTelephone: form.clientTelephone || undefined,
      lignes: lignesForm.map(l => ({
        produitId: l.produitId,
        quantite: l.quantite,
        prixUnitaire: Number(l.remise) > 0
          ? Math.round((l.prixUnitaire || 0) * (1 - Number(l.remise) / 100))
          : (l.prixUnitaire || 0),
      })),
      modePaiement: form.modePaiement,
      referencePaiement: form.referencePaiement || undefined,
      estCredit: form.estCredit,
      montantVerse: form.estCredit ? (form.montantVerse || 0) : undefined,
      dateEcheance: form.estCredit && form.dateEcheance ? form.dateEcheance : undefined,
      notes: form.notes || undefined
    };
    try {
      if (editingId) await updateCommande(editingId, request);
      else {
        const result = await creerCommandeOffline(request);
        if (result.offline) Alert.alert('Mode hors ligne', 'Commande enregistrée localement — sera synchronisée à la reconnexion.');
      }
      setShowModal(false);
      charger();
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
    setSubmitting(false);
  };

  // ─── Actions commande ───────────────────────────────────────────────────────

  const handleValider = (c: Commande) => {
    if (c.origine === 'VITRINE') {
      setCommandeLivraison(c);
      setLivraisonFrais(0);
      setLivraisonChauffeurNom('');
      setLivraisonIndicatif(INDICATIFS[0].code);
      setLivraisonTelephoneLocal('');
      setShowLivraisonModal(true);
      return;
    }
    Alert.alert(tr('valider', lang) + ' ?', `${c.numeroCommande} → vente créée, stock décrémenté.`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('valider', lang), onPress: async () => {
        try {
          const res = await executerOuMettreEnFile(
            'commande_valider',
            { id: c.id },
            () => validerCommande(c.id)
          );
          if (res.offline) {
            setCommandes(prev => prev.map(x => x.id === c.id ? { ...x, statut: 'VALIDEE' as StatutCommande } : x));
            Alert.alert('Hors ligne', `Sauvegardé hors ligne — ${c.numeroCommande} sera validée à la reconnexion.`);
          } else {
            charger();
          }
        }
        catch (e: any) { Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang)); }
      }}
    ]);
  };

  // ─── Validation livraison (commandes VITRINE) ──────────────────────────────

  const confirmerValidationLivraison = async () => {
    const c = commandeLivraison;
    if (!c) return;
    const fraisLivraison = livraisonFrais > 0 ? livraisonFrais : undefined;
    const chauffeurNom = livraisonChauffeurNom.trim() || undefined;
    const telLocal = livraisonTelephoneLocal.trim().replace(/^0+/, '');
    const chauffeurTelephone = telLocal ? `${livraisonIndicatif}${telLocal}` : undefined;
    const infosLivraison = { fraisLivraison, chauffeurNom, chauffeurTelephone };

    setShowLivraisonModal(false);
    try {
      const res = await executerOuMettreEnFile(
        'commande_valider',
        { id: c.id, body: infosLivraison },
        () => validerCommande(c.id, infosLivraison)
      );
      if (res.offline) {
        setCommandes(prev => prev.map(x => x.id === c.id ? { ...x, statut: 'VALIDEE' as StatutCommande } : x));
        Alert.alert('Hors ligne', `Sauvegardé hors ligne — ${c.numeroCommande} sera validée à la reconnexion.`);
      } else {
        charger();
        const boutons: any[] = [{ text: 'Fermer', style: 'cancel' }];
        if (c.clientTelephone) {
          boutons.push({
            text: 'WhatsApp client',
            onPress: () => ouvrirWhatsApp(c.clientTelephone as string, buildMessageClientLivraison(c, fraisLivraison))
          });
        }
        if (chauffeurTelephone) {
          boutons.push({
            text: 'WhatsApp chauffeur',
            onPress: () => ouvrirWhatsApp(chauffeurTelephone, buildMessageChauffeurLivraison(c, fraisLivraison))
          });
        }
        Alert.alert('Commande validée', `${c.numeroCommande} → vente créée, stock décrémenté.`, boutons);
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
    setCommandeLivraison(null);
  };

  const handleAnnuler = (c: Commande) => {
    const msg = c.statut === 'VALIDEE'
      ? `${c.numeroCommande} est validée — la vente sera annulée et le stock restauré.`
      : `${tr('annuler_vente', lang)} ${c.numeroCommande} ?`;
    Alert.alert(tr('annuler_vente', lang) + ' ?', msg, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('oui', lang) + ', ' + tr('annuler', lang).toLowerCase(), style: 'destructive', onPress: async () => {
        try {
          const res = await executerOuMettreEnFile(
            'commande_annuler',
            { id: c.id, utilisateurId: userId },
            () => annulerCommande(c.id, userId)
          );
          if (res.offline) {
            setCommandes(prev => prev.map(x => x.id === c.id ? { ...x, statut: 'ANNULEE' as StatutCommande } : x));
            setStatutFilter('');
            Alert.alert('Hors ligne', `Sauvegardé hors ligne — ${c.numeroCommande} sera annulée à la reconnexion.`);
          } else {
            setStatutFilter('');
            charger();
            Alert.alert(tr('succes', lang), `${c.numeroCommande} ${tr('vente_annulee', lang).toLowerCase()}`);
          }
        }
        catch (e: any) { Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang)); }
      }}
    ]);
  };

  const handleSupprimer = (c: Commande) => {
    Alert.alert(tr('supprimer', lang) + ' ?', `${tr('supprimer', lang)} ${c.numeroCommande} ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
        try { await deleteCommande(c.id); charger(); }
        catch (e: any) { Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang)); }
      }}
    ]);
  };

  const handlePartager = async (c: Commande) => {
    try {
      await partagerFactureRN({
        numero: c.numeroCommande,
        date: c.dateCommande,
        clientNom: c.clientNom || c.client?.nom,
        clientPrenom: c.clientPrenom || c.client?.prenom,
        clientTelephone: c.clientTelephone,
        modePaiement: c.modePaiement,
        estCredit: c.estCredit,
        montantVerse: c.montantVerse,
        montantRestant: c.montantRestant,
        dateEcheance: c.dateEcheance,
        notes: c.notes,
        lignes: c.lignes.map(l => ({
          designation: l.produit?.nom || l.produitNom,
          quantite: l.quantite,
          prixUnitaire: l.prixUnitaire,
          sousTotal: l.sousTotal,
        })),
        montantTotal: c.montantTotal,
        id: c.id,
        type: 'VENTE',
      }, boutique, design);
    } catch { await Share.share({ message: buildBonCommande(c), title: `Bon de commande ${c.numeroCommande}` }); }
  };

  // ─── Règlement individuel ────────────────────────────────────────────────────

  const ouvrirReglementIndividuel = (c: Commande) => {
    setCommandeRegl(c);
    setMontantRegl(c.montantRestant);
    setShowReglModal(true);
  };

  const confirmerReglementIndividuel = async () => {
    if (!commandeRegl || !montantRegl || montantRegl <= 0) return;
    try {
      const montant = montantRegl;
      const res = await executerOuMettreEnFile(
        'credit_commande_payer',
        { id: commandeRegl.id, montant },
        () => payerCreditCommande(commandeRegl.id, montant)
      );
      setShowReglModal(false);
      setCommandeRegl(null);
      if (res.offline) {
        Alert.alert('Hors ligne', 'Sauvegardé hors ligne — le règlement sera envoyé à la reconnexion.');
      } else {
        charger();
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
  };

  // ─── Règlement groupé ────────────────────────────────────────────────────────

  const ouvrirReglementGroupe = () => {
    const credits = commandes.filter(c => c.estCredit && c.montantRestant > 0);
    setCommandesCredit(credits);
    setIdsSelectionnes(credits.map(c => c.id));
    setMontantReglGroupe(totalCreditsRestants);
    setShowReglGroupeModal(true);
  };

  const toggleSelection = (id: number) => {
    setIdsSelectionnes(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const confirmerReglementGroupe = async () => {
    if (idsSelectionnes.length === 0 || !montantReglGroupe || montantReglGroupe <= 0) return;
    try {
      await payerCreditsGroupesCommandes(idsSelectionnes, montantReglGroupe);
      setShowReglGroupeModal(false);
      charger();
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
    }
  };

  // ─── Chip couleur ────────────────────────────────────────────────────────────

  const chipColor = (filter: string) => ({
    backgroundColor: statutFilter === filter ? (
      filter === 'CREDIT' ? colors.warning : filter === 'ANNULEE' ? colors.danger : colors.primary
    ) : colors.inputBg
  });

  const chipTextColor = (filter: string) => ({
    color: statutFilter === filter ? '#fff' : colors.textSecondary
  });

  const badgeBg = (statut: string) => {
    if (statut === 'VALIDEE') return colors.successBg;
    if (statut === 'ANNULEE') return colors.dangerBg;
    return colors.warningBg;
  };

  const badgeColor = (statut: string) => {
    if (statut === 'VALIDEE') return colors.success;
    if (statut === 'ANNULEE') return colors.danger;
    return colors.warning;
  };

  return (
    <View style={styles.container}>
      {/* ── Hero banner ── */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{commandes.length}</Text>
          <Text style={styles.heroLbl}>Total</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{formatMontant(totalMontant)}</Text>
          <Text style={styles.heroLbl}>Montant</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={[styles.heroVal, { color: '#fbbf24' }]}>{nbEnAttente}</Text>
          <Text style={styles.heroLbl}>En attente</Text>
        </View>
      </View>


      {/* ── Searchbar ── */}
      <Searchbar
        style={[styles.searchBar, { backgroundColor: colors.card }]}
        inputStyle={{ fontSize: 13 }}
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder={tr('recherche_commande', lang)}
      />

      {/* ── Filtres chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 12, marginBottom: 6 }}>
        <View style={styles.chipsRow}>
          {(['', 'BROUILLON', 'VALIDEE', 'CREDIT', 'ANNULEE'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, chipColor(s)]}
              onPress={() => setStatutFilter(s)}>
              <Text style={[styles.chipText, chipTextColor(s)]}>
                {s === '' ? `${tr('commandes', lang)} (${commandes.length})` : s === 'BROUILLON' ? tr('brouillon', lang) : s === 'VALIDEE' ? tr('validee', lang) : s === 'CREDIT' ? tr('credits', lang) : tr('annulee', lang)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Liste ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={commandesFiltrees}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 0, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="clipboard-list-outline" size={64} color={colors.border} />
              <Text style={styles.emptyTitle}>{tr('aucune_commande', lang)}</Text>
              <Text style={styles.emptySub}>Appuyez sur + pour créer</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <Card style={[styles.card, { backgroundColor: colors.card }]} onPress={() => {}}>
              <Card.Content style={{ paddingVertical: 4 }}>
                {/* En-tête */}
                <View style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: '#7c3aed22' }]}>
                    <MaterialCommunityIcons name="clipboard-list" size={22} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{c.numeroCommande}</Text>
                    <Text style={styles.cardSub}>
                      {getClientNom(c) !== 'N/A' ? getClientNom(c) : 'Client anonyme'}{c.clientTelephone ? ` · ${c.clientTelephone}` : ''}
                    </Text>
                    <Text style={[styles.cardSub, { marginTop: 1 }]}>{formatDate(c.dateCommande)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.cardAmt}>{formatMontant(c.montantTotal)}</Text>
                    <View style={[styles.badge, { backgroundColor: badgeBg(c.statut) }]}>
                      <Text style={[styles.badgeTxt, { color: badgeColor(c.statut) }]}>
                        {c.statut === 'VALIDEE' ? tr('validee', lang) : c.statut === 'ANNULEE' ? tr('annulee', lang) : tr('brouillon', lang)}
                      </Text>
                    </View>
                    {c.estCredit && c.montantRestant > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.warningBg, marginTop: 3 }]}>
                        <Text style={[styles.badgeTxt, { color: colors.warning }]}>{tr('credits', lang)}</Text>
                      </View>
                    )}
                    {c.origine === 'VITRINE' && (
                      <View style={[styles.badge, { backgroundColor: colors.infoBg, marginTop: 3 }]}>
                        <Text style={[styles.badgeTxt, { color: colors.info }]}>En ligne</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Crédit détail */}
                {c.estCredit && (
                  <View style={styles.creditInfo}>
                    <Text style={styles.creditText}>{tr('verse', lang)} : {formatMontant(c.montantVerse)}</Text>
                    {c.montantRestant > 0 && (
                      <Text style={[styles.creditText, { color: colors.danger, fontWeight: '600' }]}>
                        {tr('reste', lang)} : {formatMontant(c.montantRestant)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Produits */}
                <View style={styles.linesRow}>
                  {c.lignes.slice(0, 3).map((l, i) => (
                    <View key={i} style={styles.lineChip}>
                      <Text style={styles.lineChipText}>{l.produit?.nom || l.produitNom} ×{l.quantite}</Text>
                    </View>
                  ))}
                  {c.lignes.length > 3 && <Text style={{ color: colors.textSecondary, fontSize: 11 }}>+{c.lignes.length - 3}</Text>}
                </View>

                <Divider style={{ marginVertical: 8, backgroundColor: colors.border }} />

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handlePartager(c)}>
                    <Text style={styles.actionBtnText}>{tr('imprimer', lang)}</Text>
                  </TouchableOpacity>

                  {c.statut === 'BROUILLON' && (
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnBlue]} onPress={() => ouvrirModifier(c)}>
                      <Text style={[styles.actionBtnText, { color: colors.info }]}>{tr('modifier', lang)}</Text>
                    </TouchableOpacity>
                  )}

                  {c.statut === 'BROUILLON' && (
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => handleValider(c)}>
                      <Text style={[styles.actionBtnText, { color: colors.success }]}>{tr('valider', lang)}</Text>
                    </TouchableOpacity>
                  )}

                  {c.estCredit && c.montantRestant > 0 && (
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOrange]} onPress={() => ouvrirReglementIndividuel(c)}>
                      <Text style={[styles.actionBtnText, { color: colors.warning }]}>{tr('regler', lang)}</Text>
                    </TouchableOpacity>
                  )}

                  {c.statut !== 'ANNULEE' && (
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]} onPress={() => handleAnnuler(c)}>
                      <Text style={[styles.actionBtnText, { color: colors.danger }]}>{tr('annuler', lang)}</Text>
                    </TouchableOpacity>
                  )}

                  {c.statut === 'BROUILLON' && (
                    <TouchableOpacity style={[styles.actionBtn, { flex: 0, paddingHorizontal: 10 }]} onPress={() => handleSupprimer(c)}>
                      <Text style={styles.actionBtnText}>{tr('supprimer', lang)}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}
        />
      )}

      {/* ── FAB ── */}
      <FAB icon="plus" style={[styles.fab, { backgroundColor: colors.primary }]} onPress={ouvrirCreer} />

      {/* ─── MODAL CRÉER / MODIFIER ─────────────────────────────────────────── */}
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editingId ? tr('modifier', lang) + ' ' + tr('commandes', lang).toLowerCase() : tr('nouvelle_commande', lang)}</Text>

            <Text style={styles.sectionTitle}>{tr('clients', lang)}</Text>
            {form.clientId ? (
              <View style={styles.selectedClient}>
                <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>{form.clientNom} {form.clientPrenom} · {form.clientTelephone}</Text>
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, clientId: null, clientNom: '', clientPrenom: '', clientTelephone: '' }))}>
                  <Text style={{ color: colors.danger, fontSize: 18 }}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TextInput
                  style={styles.input}
                  value={searchClient}
                  onChangeText={v => { setSearchClient(v); setShowClientDrop(true); }}
                  placeholder={tr('recherche_client', lang)}
                  placeholderTextColor={colors.placeholder}
                />
                {showClientDrop && clientsFiltres.length > 0 && (
                  <View style={styles.dropdown}>
                    {clientsFiltres.map((cl: any) => (
                      <TouchableOpacity key={cl.id} style={styles.dropItem} onPress={() => selectionnerClient(cl)}>
                        <Text style={{ fontSize: 13, color: colors.text }}>{cl.nom} {cl.prenom} — {cl.numeroTelephone}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TextInput style={styles.input} value={form.clientNom} onChangeText={v => setForm(f => ({ ...f, clientNom: v }))} placeholder={tr('nom', lang)} placeholderTextColor={colors.placeholder} />
                <TextInput style={styles.input} value={form.clientPrenom} onChangeText={v => setForm(f => ({ ...f, clientPrenom: v }))} placeholder={tr('prenom', lang)} placeholderTextColor={colors.placeholder} />
                <TextInput style={styles.input} value={form.clientTelephone} onChangeText={v => setForm(f => ({ ...f, clientTelephone: v }))} placeholder={tr('telephone', lang)} placeholderTextColor={colors.placeholder} keyboardType="phone-pad" />
              </View>
            )}

            <Text style={styles.sectionTitle}>{tr('produits', lang)}</Text>
            <TextInput
              style={styles.input}
              value={searchProduit}
              onChangeText={v => { setSearchProduit(v); setShowProduitDrop(true); }}
              placeholder={tr('recherche_produit', lang)}
              placeholderTextColor={colors.placeholder}
            />
            {showProduitDrop && produitsFiltres.length > 0 && (
              <View style={styles.dropdown}>
                {produitsFiltres.map((p: any) => (
                  <TouchableOpacity key={p.id} style={styles.dropItem} onPress={() => selectionnerProduit(p)}>
                    <Text style={{ fontSize: 13, color: colors.text }}>{p.nom} — {formatMontant(p.prixVente)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {lignesForm.map((l, i) => (
              <View key={i} style={styles.ligneRow}>
                {/* Nom + supprimer */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: colors.text }}>{l.produitNom}</Text>
                  <TouchableOpacity onPress={() => supprimerLigne(i)} style={{ padding: 4 }}>
                    <Text style={{ color: colors.danger, fontSize: 16, fontWeight: '700' }}>×</Text>
                  </TouchableOpacity>
                </View>
                {/* Qté + Prix + Remise */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <View style={styles.qtyCtrl}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => changerQty(i, -1)}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity>
                    <Text style={styles.qtyVal}>{l.quantite}</Text>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => changerQty(i, 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, color: colors.textSecondary, marginBottom: 2 }}>Prix unit.</Text>
                    <MontantInput
                      style={styles.prixInput}
                      value={l.prixUnitaire}
                      onChangeValue={v => setLignesForm(prev => prev.map((x, idx) => idx === i ? { ...x, prixUnitaire: v } : x))}
                    />
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, color: colors.textSecondary, marginBottom: 2 }}>Remise %</Text>
                    <TextInput
                      style={[styles.prixInput, { width: 60 }]}
                      value={l.remise}
                      onChangeText={v => setLignesForm(prev => prev.map((x, idx) => idx === i ? { ...x, remise: v } : x))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>
                    = {formatMontant(prixLigne(l))}
                  </Text>
                </View>
              </View>
            ))}

            {lignesForm.length > 0 && (
              <View style={styles.totalBar}>
                <Text style={{ color: colors.text }}>{tr('total', lang)}</Text>
                <Text style={{ fontWeight: 'bold', color: colors.primary, fontSize: 15 }}>{formatMontant(totalCommande)}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>{tr('paiement', lang)}</Text>
            <View style={styles.modePaiRow}>
              {MODES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modePaiChip, form.modePaiement === m && styles.modePaiChipActive]}
                  onPress={() => setForm(f => ({ ...f, modePaiement: m, referencePaiement: '' }))}>
                  <Text style={[styles.modePaiText, form.modePaiement === m && { color: '#fff' }]}>{MODES_LABELS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.modePaiement !== 'ESPECES' && (
              <TextInput
                style={styles.input}
                value={form.referencePaiement}
                onChangeText={v => setForm(f => ({ ...f, referencePaiement: v }))}
                placeholder={`Référence ${MODES_LABELS[form.modePaiement] || ''} *`}
                placeholderTextColor={colors.placeholder}
              />
            )}

            <View style={styles.creditToggleRow}>
              <Text style={{ fontSize: 14, color: colors.text }}>{tr('paiement_credit', lang)}</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, form.estCredit && styles.toggleBtnActive]}
                onPress={() => setForm(f => ({ ...f, estCredit: !f.estCredit }))}>
                <View style={[styles.toggleThumb, form.estCredit && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {form.estCredit && (
              <>
                <MontantInput style={styles.input} value={form.montantVerse} onChangeValue={v => setForm(f => ({ ...f, montantVerse: v }))} placeholder={tr('montant_verse', lang)} placeholderTextColor={colors.placeholder} />
                {totalCommande > 0 && (
                  <Text style={styles.resteInfo}>{tr('reste_a_payer', lang)} : {formatMontant(resteAPayer)}</Text>
                )}
                <TextInput style={styles.input} value={form.dateEcheance} onChangeText={v => setForm(f => ({ ...f, dateEcheance: v }))} placeholder={tr('date_echeance', lang)} placeholderTextColor={colors.placeholder} />
              </>
            )}

            <TextInput style={[styles.input, { height: 60 }]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder={tr('notes', lang)} placeholderTextColor={colors.placeholder} multiline />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 }}>
              <Button mode="outlined" onPress={() => setShowModal(false)} style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
              <Button mode="contained" onPress={enregistrer} loading={submitting} style={{ flex: 1 }} buttonColor={colors.primary}>
                {editingId ? tr('modifier', lang) : tr('enregistrer', lang)}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ─── MODAL RÈGLEMENT INDIVIDUEL ─────────────────────────────────────── */}
      <Portal>
        <Modal visible={showReglModal} onDismiss={() => setShowReglModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}>
          <Text style={styles.modalTitle}>{tr('reglement_credit', lang)}</Text>
          {commandeRegl && (
            <>
              <View style={styles.reglInfoBox}>
                <Text style={{ fontSize: 13, color: colors.text }}>N° <Text style={{ fontWeight: '700' }}>{commandeRegl.numeroCommande}</Text></Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{tr('total', lang)} : {formatMontant(commandeRegl.montantTotal)}</Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{tr('verse', lang)} : {formatMontant(commandeRegl.montantVerse)}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger, marginTop: 4 }}>
                  {tr('reste_du', lang)} : {formatMontant(commandeRegl.montantRestant)}
                </Text>
              </View>
              <MontantInput
                style={styles.input}
                value={montantRegl}
                onChangeValue={setMontantRegl}
                placeholder={tr('montant_payer', lang)}
                placeholderTextColor={colors.placeholder}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => setMontantRegl(commandeRegl.montantRestant / 2)}>
                  <Text style={styles.shortcutText}>{tr('moitie', lang)}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => setMontantRegl(commandeRegl.montantRestant)}>
                  <Text style={styles.shortcutText}>{tr('tout_regler', lang)}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button mode="outlined" onPress={() => setShowReglModal(false)} style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
            <Button mode="contained" onPress={confirmerReglementIndividuel} style={{ flex: 1 }} buttonColor={colors.warning}>
              {tr('confirmer', lang)}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* ─── MODAL VALIDATION LIVRAISON (commandes VITRINE) ─────────────────── */}
      <Portal>
        <Modal visible={showLivraisonModal} onDismiss={() => setShowLivraisonModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Valider la livraison</Text>
            {commandeLivraison && (
              <View style={styles.reglInfoBox}>
                <Text style={{ fontSize: 13, color: colors.text }}>N° <Text style={{ fontWeight: '700' }}>{commandeLivraison.numeroCommande}</Text></Text>
                <Text style={{ fontSize: 13, color: colors.text }}>{tr('total', lang)} : {formatMontant(commandeLivraison.montantTotal)}</Text>
                {commandeLivraison.adresseLivraison ? (
                  <Text style={{ fontSize: 13, color: colors.text }}>Adresse : {commandeLivraison.adresseLivraison}</Text>
                ) : null}
              </View>
            )}

            <Text style={styles.sectionTitle}>Frais de livraison (optionnel)</Text>
            <MontantInput
              style={styles.input}
              value={livraisonFrais}
              onChangeValue={setLivraisonFrais}
              placeholder="Frais de livraison"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.sectionTitle}>Chauffeur (optionnel)</Text>
            <TextInput
              style={styles.input}
              value={livraisonChauffeurNom}
              onChangeText={setLivraisonChauffeurNom}
              placeholder="Nom du chauffeur"
              placeholderTextColor={colors.placeholder}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {INDICATIFS.map(ind => (
                  <TouchableOpacity
                    key={ind.code}
                    style={[styles.modePaiChip, livraisonIndicatif === ind.code && styles.modePaiChipActive]}
                    onPress={() => setLivraisonIndicatif(ind.code)}>
                    <Text style={[styles.modePaiText, livraisonIndicatif === ind.code && { color: '#fff' }]}>
                      {ind.code} {ind.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TextInput
              style={styles.input}
              value={livraisonTelephoneLocal}
              onChangeText={setLivraisonTelephoneLocal}
              placeholder="Téléphone du chauffeur"
              placeholderTextColor={colors.placeholder}
              keyboardType="phone-pad"
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8 }}>
              <Button mode="outlined" onPress={() => { setShowLivraisonModal(false); setCommandeLivraison(null); }} style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
              <Button mode="contained" onPress={confirmerValidationLivraison} style={{ flex: 1 }} buttonColor={colors.success}>
                {tr('valider', lang)}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      {/* ─── MODAL RÈGLEMENT GROUPÉ ──────────────────────────────────────────── */}
      <Portal>
        <Modal visible={showReglGroupeModal} onDismiss={() => setShowReglGroupeModal(false)} contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}>
          <Text style={styles.modalTitle}>{tr('reglement_groupe', lang)}</Text>
          <ScrollView style={{ maxHeight: 300 }}>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setIdsSelectionnes(
                idsSelectionnes.length === commandesCredit.length ? [] : commandesCredit.map(c => c.id)
              )}>
              <Checkbox status={idsSelectionnes.length === commandesCredit.length ? 'checked' : 'unchecked'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{tr('tout_selectionner', lang)} ({commandesCredit.length})</Text>
            </TouchableOpacity>
            {commandesCredit.map(c => (
              <TouchableOpacity key={c.id} style={styles.checkRow} onPress={() => toggleSelection(c.id)}>
                <Checkbox status={idsSelectionnes.includes(c.id) ? 'checked' : 'unchecked'} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: colors.text }}>{c.numeroCommande} — {getClientNom(c)}</Text>
                  <Text style={{ fontSize: 11, color: colors.danger }}>{tr('reste', lang)} : {formatMontant(c.montantRestant)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <MontantInput
            style={[styles.input, { marginTop: 12 }]}
            value={montantReglGroupe}
            onChangeValue={setMontantReglGroupe}
            placeholder={tr('montant_payer', lang)}
            placeholderTextColor={colors.placeholder}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <Button mode="outlined" onPress={() => setShowReglGroupeModal(false)} style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
            <Button
              mode="contained"
              onPress={confirmerReglementGroupe}
              style={{ flex: 1 }}
              buttonColor={colors.warning}
              disabled={idsSelectionnes.length === 0 || !montantReglGroupe || montantReglGroupe <= 0}>
              {tr('regler', lang)} {idsSelectionnes.length}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Hero banner
  hero: { backgroundColor: colors.hero, flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  // Offline banner
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.warningBg, paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: colors.warning, fontSize: 12 },

  // Searchbar
  searchBar: { marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 10, backgroundColor: colors.card, elevation: 1 },

  // Chips
  chipsRow: { flexDirection: 'row', gap: 6, paddingBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: '500' },

  // Paper Card
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 16, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: colors.text },
  cardSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: colors.text, fontSize: 13 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.placeholder, textAlign: 'center', marginTop: 4 },

  // FAB
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: colors.primary },

  creditInfo: { backgroundColor: colors.inputBg, borderRadius: 8, padding: 6, marginBottom: 6, marginTop: 6, gap: 2 },
  creditText: { fontSize: 12, color: colors.success },

  linesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4, marginTop: 4 },
  lineChip: { backgroundColor: colors.infoBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  lineChipText: { fontSize: 11, color: colors.info, fontWeight: '500' },

  cardActions: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minWidth: 60, padding: 6, borderRadius: 8, backgroundColor: colors.inputBg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  actionBtnBlue: { backgroundColor: colors.infoBg, borderColor: colors.info },
  actionBtnGreen: { backgroundColor: colors.successBg, borderColor: colors.success },
  actionBtnOrange: { backgroundColor: colors.warningBg, borderColor: colors.warning },
  actionBtnRed: { backgroundColor: colors.dangerBg, borderColor: colors.danger },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },

  // Modal
  modal: { backgroundColor: colors.card, margin: 12, borderRadius: 20, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.primary, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 13, color: colors.text, marginBottom: 8 },

  dropdown: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, elevation: 4, maxHeight: 140, overflow: 'hidden', marginBottom: 8 },
  dropItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  selectedClient: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successBg, borderRadius: 8, padding: 10, marginBottom: 8 },

  ligneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.inputBg, borderRadius: 8, padding: 8, marginBottom: 6, flexWrap: 'wrap' },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 16, lineHeight: 20 },
  qtyVal: { minWidth: 24, textAlign: 'center', fontWeight: '600', color: colors.text },
  prixInput: { width: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 6, padding: 5, fontSize: 12, textAlign: 'right', color: colors.text, backgroundColor: colors.card },

  totalBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, marginBottom: 8 },

  modePaiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  modePaiChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: colors.inputBg },
  modePaiChipActive: { backgroundColor: colors.primary },
  modePaiText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },

  creditToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  toggleBtn: { width: 46, height: 26, borderRadius: 13, backgroundColor: colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', elevation: 2 },
  toggleThumbActive: { marginLeft: 20 },

  resteInfo: { backgroundColor: colors.dangerBg, borderRadius: 8, padding: 8, fontSize: 13, color: colors.danger, marginBottom: 8 },

  reglInfoBox: { backgroundColor: colors.inputBg, borderRadius: 10, padding: 12, marginBottom: 12, gap: 4 },
  shortcutBtn: { flex: 1, padding: 8, borderRadius: 8, backgroundColor: colors.infoBg, borderWidth: 1, borderColor: colors.info, alignItems: 'center' },
  shortcutText: { fontSize: 12, color: colors.info, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
});
