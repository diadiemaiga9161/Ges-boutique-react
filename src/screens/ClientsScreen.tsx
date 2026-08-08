import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Alert, RefreshControl, Image,
  TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  Text, Card, FAB, Searchbar, ActivityIndicator,
  Portal, Modal as PaperModal, TextInput, Button,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getClients, updateClient, deleteClient,
  getClientVentes, getCreditsNonRegles, getVenteDetail,
  createAvanceClient, getHistoriqueAvanceClient, getBackendRootUrl,
} from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { creerClientOffline, sauvegarderCache, lireCache } from '../services/offline.service';
import { imprimerFactureRN } from '../services/invoice.service';
import ClientReleveModal from '../components/ClientReleveModal';
import { Client } from '../types';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface VenteClient {
  id: number;
  dateVente?: string;
  montantTotal?: number;
  modePaiement?: string;
  estCredit?: boolean;
  numeroVente?: string;
}

interface CreditClient {
  venteId: number;
  numeroVente?: string;
  clientNom?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  estReglee?: boolean;
  dateEcheance?: string;
}

function estEnRetard(c: CreditClient): boolean {
  if (c.estReglee || !c.dateEcheance) return false;
  return new Date(c.dateEcheance).getTime() < Date.now();
}

type Onglet = 'infos' | 'achats' | 'credits';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function money(v: number) { return (v ?? 0).toLocaleString('fr-FR') + ' FCFA'; }
function fdate(d?: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR'); }
function initiales(nom: string) { return nom.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2); }

// ─── Couleurs avatar (déterministes selon client.id) ─────────────────────────
const AVATAR_BG   = ['#1a56db22', '#16a34a22', '#f59e0b22'];
const AVATAR_TEXT = ['#1a56db',   '#16a34a',   '#d97706'];

// ─── Composant principal ───────────────────────────────────────────────────────
export default function ClientsScreen() {
  const { lang } = useLang();

  // ── Liste ──────────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // ── Modal ajout / modification ─────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' });

  // ── Modal détail ───────────────────────────────────────────────────────────
  const [showDetail, setShowDetail] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('infos');
  const [ventes, setVentes] = useState<VenteClient[]>([]);
  const [credits, setCredits] = useState<CreditClient[]>([]);
  const [loadingVentes, setLoadingVentes] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // ── Modal relevé client (situation client) ─────────────────────────────────
  const [showReleve, setShowReleve] = useState(false);

  // ── Modal QR code client (scan → téléchargement relevé PDF, comme Ionic) ──
  const [showQrModal, setShowQrModal] = useState(false);
  const [venteEnCoursImpression, setVenteEnCoursImpression] = useState<number | null>(null);

  // ── Avance client (dépôt + historique) ──────────────────────────────────────
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [avanceForm, setAvanceForm] = useState({ montant: '', modePaiement: 'ESPECES', referencePaiement: '', motif: '' });
  const [savingAvance, setSavingAvance] = useState(false);
  const [showHistoriqueAvance, setShowHistoriqueAvance] = useState(false);
  const [loadingHistoriqueAvance, setLoadingHistoriqueAvance] = useState(false);
  const [historiqueAvance, setHistoriqueAvance] = useState<any>(null);

  // ── Chargement liste ───────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      // Toujours tenter l'appel réel en premier — NetInfo.fetch() peut renvoyer
      // isConnected=null au premier appel et ferait sauter l'appel réel à tort.
      const res = await getClients();
      const data: Client[] = res.data?.data || res.data || [];
      setClients(data);
      setFiltered(data);
      setFromCache(false);
      sauvegarderCache('clients', data).catch(() => {});
    } catch {
      const cached = await lireCache<Client>('clients');
      if (cached.length > 0) {
        setClients(cached);
        setFiltered(cached);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!search) { setFiltered(clients); return; }
    const q = search.toLowerCase();
    setFiltered(clients.filter(c =>
      c.nom.toLowerCase().includes(q) || (c.telephone ?? '').includes(q),
    ));
  }, [search, clients]);

  // ── Ajout / Modification ───────────────────────────────────────────────────
  const ouvrirFormAjout = () => {
    setEditingClient(null);
    setForm({ nom: '', telephone: '', email: '', adresse: '' });
    setShowFormModal(true);
  };

  const ouvrirFormModif = (client: Client) => {
    setEditingClient(client);
    setForm({
      nom: client.nom,
      telephone: client.telephone ?? '',
      email: client.email ?? '',
      adresse: client.adresse ?? '',
    });
    setShowDetail(false);
    setShowFormModal(true);
  };

  const enregistrer = async () => {
    if (!form.nom.trim()) return;
    try {
      if (editingClient) {
        await updateClient(editingClient.id, form);
      } else {
        await creerClientOffline(form);
      }
      setShowFormModal(false);
      setForm({ nom: '', telephone: '', email: '', adresse: '' });
      setEditingClient(null);
      await charger();
    } catch {
      Alert.alert(tr('erreur', lang), editingClient ? 'Impossible de modifier le client' : 'Impossible d\'ajouter le client');
    }
  };

  // ── Suppression ────────────────────────────────────────────────────────────
  const confirmerSuppression = (client: Client) => {
    Alert.alert(
      'Supprimer ce client ?',
      `${client.nom} sera définitivement supprimé.`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClient(client.id);
              setShowDetail(false);
              await charger();
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible de supprimer ce client');
            }
          },
        },
      ],
    );
  };

  // ── Ouverture modal détail ─────────────────────────────────────────────────
  const ouvrirDetail = (client: Client) => {
    setSelectedClient(client);
    setOnglet('infos');
    setVentes([]);
    setCredits([]);
    setShowDetail(true);
  };

  // ── Chargement onglet Achats ───────────────────────────────────────────────
  const chargerVentes = useCallback(async (client: Client) => {
    setLoadingVentes(true);
    try {
      let data: VenteClient[] = [];
      try {
        const res = await getClientVentes(client.id);
        data = res.data?.data || res.data || [];
      } catch {
        data = [];
      }
      if (!data.length) {
        try {
          const { getVentes } = await import('../services/api.service');
          const res2 = await getVentes({ clientNom: client.nom });
          data = res2.data?.data || res2.data || [];
        } catch { /* ignore */ }
      }
      setVentes(data);
    } catch { /* ignore */ }
    setLoadingVentes(false);
  }, []);

  // ── Chargement onglet Crédits ──────────────────────────────────────────────
  const chargerCredits = useCallback(async (client: Client) => {
    setLoadingCredits(true);
    try {
      const res = await getCreditsNonRegles();
      const all: CreditClient[] = res.data?.data || res.data?.credits || res.data || [];
      const nom = client.nom.toLowerCase().trim();
      const filtered2 = all.filter((c: CreditClient) =>
        (c.clientNom ?? '').toLowerCase().trim() === nom,
      );
      setCredits(filtered2);
    } catch { /* ignore */ }
    setLoadingCredits(false);
  }, []);

  // ── Avance client : dépôt et historique (fonction absente jusqu'ici — la
  // vente à crédit permettait déjà d'UTILISER une avance, mais rien ne
  // permettait d'en DÉPOSER une depuis la fiche client) ─────────────────────
  const ouvrirAvanceModal = () => {
    setAvanceForm({ montant: '', modePaiement: 'ESPECES', referencePaiement: '', motif: '' });
    setShowAvanceModal(true);
  };

  const enregistrerAvanceFn = async () => {
    if (!selectedClient) return;
    const montant = parseFloat(avanceForm.montant);
    if (!montant || montant <= 0) { Alert.alert(tr('erreur', lang), 'Montant invalide'); return; }
    if (avanceForm.modePaiement !== 'ESPECES' && !avanceForm.referencePaiement.trim()) {
      Alert.alert(tr('erreur', lang), 'Référence obligatoire pour ce mode de paiement');
      return;
    }
    setSavingAvance(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const utilisateurId = raw ? JSON.parse(raw)?.id : undefined;
      await createAvanceClient({
        clientNom: selectedClient.nom,
        clientTelephone: selectedClient.telephone,
        montant,
        motif: avanceForm.motif.trim() || undefined,
        utilisateurId,
        modePaiement: avanceForm.modePaiement,
        referencePaiement: avanceForm.referencePaiement.trim() || undefined,
      });
      setShowAvanceModal(false);
      Alert.alert(tr('succes', lang), `Avance de ${money(montant)} enregistrée pour ${selectedClient.nom}`);
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Enregistrement de l\'avance impossible');
    }
    setSavingAvance(false);
  };

  const ouvrirHistoriqueAvance = async () => {
    if (!selectedClient) return;
    setShowHistoriqueAvance(true);
    setLoadingHistoriqueAvance(true);
    try {
      const res = await getHistoriqueAvanceClient(selectedClient.nom, selectedClient.telephone);
      setHistoriqueAvance(res.data);
    } catch {
      setHistoriqueAvance(null);
    }
    setLoadingHistoriqueAvance(false);
  };

  // ── Facture PDF pour une vente du client (impression native, comme
  //     telechargerFacturePdf() sur Ionic mais via le moteur RN déjà utilisé
  //     dans HistoriqueVentesScreen plutôt que d'ouvrir une URL navigateur) ──
  const imprimerFactureVente = async (vente: VenteClient) => {
    setVenteEnCoursImpression(vente.id);
    try {
      const res = await getVenteDetail(vente.id);
      const detail = res.data?.data || res.data || {};
      const raw = await AsyncStorage.getItem('boutique_info');
      const boutique = raw ? JSON.parse(raw) : {};
      const tpl = await AsyncStorage.getItem('facture_template');
      const design: 1 | 2 | 3 = tpl === 'moderne' ? 2 : tpl === 'minimaliste' ? 3 : 1;
      await imprimerFactureRN({
        numero: vente.numeroVente || `#${vente.id}`,
        date: vente.dateVente || new Date().toISOString(),
        clientNom: selectedClient?.nom,
        clientTelephone: selectedClient?.telephone,
        modePaiement: vente.modePaiement,
        estCredit: vente.estCredit,
        lignes: detail?.lignes || detail?.produits || [],
        montantTotal: vente.montantTotal || 0,
        id: vente.id,
        type: 'VENTE',
      }, boutique, design);
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de générer la facture PDF');
    }
    setVenteEnCoursImpression(null);
  };

  // ── Changement d'onglet dans le détail ────────────────────────────────────
  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    if (!selectedClient) return;
    if (o === 'achats' && !ventes.length && !loadingVentes) chargerVentes(selectedClient);
    if (o === 'credits' && !credits.length && !loadingCredits) chargerCredits(selectedClient);
  };

  // ── KPI dérivés ────────────────────────────────────────────────────────────
  const totalCAClient = ventes.reduce((s, v) => s + (v.montantTotal ?? 0), 0);
  const totalRestantDu = credits.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0);

  // ── Stats hero ─────────────────────────────────────────────────────────────
  const avecCredit   = clients.filter(c => c.soldeCredit && c.soldeCredit > 0).length;
  const avecTelephone = clients.filter(c => !!c.telephone).length;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>

      {/* ── Hero banner ─────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{clients.length}</Text>
          <Text style={styles.heroLbl}>Total</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{avecCredit}</Text>
          <Text style={styles.heroLbl}>En crédit</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{avecTelephone}</Text>
          <Text style={styles.heroLbl}>Avec tél</Text>
        </View>
      </View>

      {/* ── Bandeau offline ─────────────────────────────────────────────────── */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      {/* ── Barre de recherche ──────────────────────────────────────────────── */}
      <Searchbar
        placeholder={tr('recherche_client', lang)}
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* ── Liste clients ────────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={c => String(c.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />
        }
        contentContainerStyle={{ paddingVertical: 8, paddingBottom: 80 }}
        renderItem={({ item }) => {
          const colorIdx = Number(item.id) % 3;
          return (
            <Card style={styles.card} onPress={() => ouvrirDetail(item)}>
              <Card.Content style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: AVATAR_BG[colorIdx] }]}>
                  <Text style={[styles.avatarTxt, { color: AVATAR_TEXT[colorIdx] }]}>
                    {initiales(item.nom)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.nom}</Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {item.telephone || item.email || item.adresse || '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.soldeCredit && item.soldeCredit > 0 ? (
                    <Text style={[styles.cardAmt, { color: '#dc2626' }]}>
                      {money(item.soldeCredit)}
                    </Text>
                  ) : null}
                  <Text style={{ color: '#94a3b8', fontSize: 18, fontWeight: 'bold' }}>›</Text>
                </View>
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name={"account-multiple-off-outline" as any} size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>{tr('aucun_client', lang)}</Text>
            <Text style={styles.emptySub}>Aucun client enregistré</Text>
          </View>
        }
      />

      {/* ── FAB ajout ────────────────────────────────────────────────────────── */}
      <FAB icon="plus" style={styles.fab} onPress={ouvrirFormAjout} />

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL AJOUT / MODIFICATION
      ════════════════════════════════════════════════════════════════════════ */}
      <Portal>
        <PaperModal
          visible={showFormModal}
          onDismiss={() => { setShowFormModal(false); setEditingClient(null); }}
          contentContainerStyle={styles.paperModal}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>
              {editingClient ? tr('modifier', lang) + ' ' + tr('clients', lang).toLowerCase() : tr('nouveau_client', lang)}
            </Text>
            <TextInput
              label={tr('nom_client', lang)}
              value={form.nom}
              onChangeText={t => setForm({ ...form, nom: t })}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label={tr('telephone', lang)}
              value={form.telephone}
              onChangeText={t => setForm({ ...form, telephone: t })}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              label={tr('email', lang)}
              value={form.email}
              onChangeText={t => setForm({ ...form, email: t })}
              mode="outlined"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              label={tr('adresse', lang)}
              value={form.adresse}
              onChangeText={t => setForm({ ...form, adresse: t })}
              mode="outlined"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={enregistrer}
              style={{ marginTop: 8, backgroundColor: '#1a56db' }}
            >
              {editingClient ? tr('enregistrer', lang) : tr('enregistrer', lang)}
            </Button>
          </KeyboardAvoidingView>
        </PaperModal>
      </Portal>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL DETAIL CLIENT
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Poignée */}
            <View style={styles.handle} />

            {/* Header modal : avatar + nom + fermer */}
            {selectedClient && (
              <View style={styles.detailHeader}>
                <View style={[styles.detailAvatar, { backgroundColor: AVATAR_BG[Number(selectedClient.id) % 3] }]}>
                  <Text style={[styles.detailAvatarText, { color: AVATAR_TEXT[Number(selectedClient.id) % 3] }]}>
                    {initiales(selectedClient.nom)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailNom}>{selectedClient.nom}</Text>
                  {selectedClient.telephone ? (
                    <Text style={styles.detailSub}>{selectedClient.telephone}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Barre onglets */}
            <View style={styles.tabBar}>
              {(['infos', 'achats', 'credits'] as Onglet[]).map(o => {
                const labels: Record<Onglet, string> = { infos: 'Infos', achats: tr('achat', lang), credits: tr('credits', lang) };
                return (
                  <TouchableOpacity
                    key={o}
                    style={[styles.tabBtn, onglet === o && styles.tabBtnActive]}
                    onPress={() => changerOnglet(o)}
                  >
                    <Text style={[styles.tabLabel, onglet === o && styles.tabLabelActive]}>
                      {labels[o]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Contenu onglets */}
            <ScrollView style={styles.detailBody} contentContainerStyle={{ paddingBottom: 20 }}>

              {/* ── ONGLET INFOS ── */}
              {onglet === 'infos' && selectedClient && (
                <View>
                  <View style={styles.infoCard}>
                    {[
                      [tr('nom_client', lang).replace(' *', ''), selectedClient.nom],
                      [tr('telephone', lang), selectedClient.telephone ?? '—'],
                      [tr('email', lang), selectedClient.email ?? '—'],
                      [tr('adresse', lang), selectedClient.adresse ?? '—'],
                    ].map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoVal}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  {selectedClient.soldeCredit && selectedClient.soldeCredit > 0 ? (
                    <View style={styles.alertCredit}>
                      <Text style={styles.alertCreditText}>
                        {money(selectedClient.soldeCredit)} a rembourser
                      </Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.btnReleve}
                    onPress={() => setShowReleve(true)}
                  >
                    <MaterialCommunityIcons name="file-document-outline" size={18} color="#1a56db" />
                    <Text style={styles.btnReleveText}>Relevé complet du client</Text>
                  </TouchableOpacity>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.btnAvance} onPress={ouvrirAvanceModal}>
                      <MaterialCommunityIcons name="wallet-outline" size={16} color="#0e9f6e" />
                      <Text style={styles.btnAvanceText}>Avance</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnHistorique} onPress={ouvrirHistoriqueAvance}>
                      <MaterialCommunityIcons name="clock-outline" size={16} color="#1a56db" />
                      <Text style={styles.btnHistoriqueText}>Historique avances</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.btnQr} onPress={() => setShowQrModal(true)}>
                    <MaterialCommunityIcons name="qrcode" size={16} color="#7c3aed" />
                    <Text style={styles.btnQrText}>QR Code — scanner pour télécharger le relevé</Text>
                  </TouchableOpacity>

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.btnModifier}
                      onPress={() => ouvrirFormModif(selectedClient)}
                    >
                      <Text style={styles.btnModifierText}>{tr('modifier', lang)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnSupprimer}
                      onPress={() => confirmerSuppression(selectedClient)}
                    >
                      <Text style={styles.btnSupprimerText}>{tr('supprimer', lang)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── ONGLET ACHATS ── */}
              {onglet === 'achats' && (
                <>
                  {loadingVentes ? (
                    <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
                  ) : (
                    <>
                      {/* KPI Total CA */}
                      <View style={styles.kpiBox}>
                        <Text style={styles.kpiLabel}>Total CA client</Text>
                        <Text style={styles.kpiVal}>{money(totalCAClient)}</Text>
                        <Text style={styles.kpiSub}>{ventes.length} vente(s)</Text>
                      </View>

                      {ventes.length === 0 ? (
                        <Text style={styles.emptyOnglet}>Aucune vente pour ce client</Text>
                      ) : (
                        ventes.map(v => (
                          <View key={v.id} style={styles.venteItem}>
                            <View style={styles.venteTop}>
                              <Text style={styles.venteDate}>{fdate(v.dateVente)}</Text>
                              {v.estCredit ? (
                                <View style={styles.badgeCredit}>
                                  <Text style={styles.badgeCreditText}>CREDIT</Text>
                                </View>
                              ) : null}
                              <Text style={styles.venteMontant}>{money(v.montantTotal ?? 0)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={styles.venteMode}>
                                {v.modePaiement ?? 'ESPECES'}
                                {v.numeroVente ? `  ·  N° ${v.numeroVente}` : ''}
                              </Text>
                              <TouchableOpacity
                                style={styles.btnPdfVente}
                                onPress={() => imprimerFactureVente(v)}
                                disabled={venteEnCoursImpression === v.id}
                              >
                                {venteEnCoursImpression === v.id ? (
                                  <ActivityIndicator size={12} color="#1a56db" />
                                ) : (
                                  <MaterialCommunityIcons name="file-pdf-box" size={14} color="#1a56db" />
                                )}
                                <Text style={styles.btnPdfVenteText}>Facture PDF</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── ONGLET CREDITS ── */}
              {onglet === 'credits' && (
                <>
                  {loadingCredits ? (
                    <ActivityIndicator size="large" color="#dc2626" style={{ marginTop: 40 }} />
                  ) : (
                    <>
                      {totalRestantDu > 0 ? (
                        <View style={[styles.kpiBox, styles.kpiBoxRed]}>
                          <Text style={[styles.kpiLabel, { color: '#dc2626' }]}>Total restant du</Text>
                          <Text style={[styles.kpiVal, { color: '#dc2626' }]}>{money(totalRestantDu)}</Text>
                        </View>
                      ) : (
                        <View style={[styles.kpiBox, { borderColor: '#16a34a' }]}>
                          <Text style={[styles.kpiLabel, { color: '#16a34a' }]}>Aucun credit en cours</Text>
                        </View>
                      )}

                      {credits.length === 0 ? (
                        <Text style={styles.emptyOnglet}>Aucun credit pour ce client</Text>
                      ) : (
                        credits.map(c => {
                          const pct = c.montantTotal > 0
                            ? Math.min(1, c.montantVerse / c.montantTotal)
                            : 0;
                          const retard = estEnRetard(c);
                          return (
                            <View key={c.venteId} style={[styles.creditItem, c.estReglee && styles.creditItemRegle, retard && styles.creditItemRetard]}>
                              <View style={styles.creditTop}>
                                <Text style={styles.creditNum}>{c.numeroVente ?? `Vente #${c.venteId}`}</Text>
                                <View style={[styles.statutBadge, c.estReglee ? styles.statutRegle : retard ? styles.statutRetard : styles.statutEnCours]}>
                                  <Text style={[styles.statutText, c.estReglee ? { color: '#16a34a' } : retard ? { color: '#dc2626' } : { color: '#d97706' }]}>
                                    {c.estReglee ? 'Solde' : retard ? 'En retard' : 'En cours'}
                                  </Text>
                                </View>
                              </View>

                              {/* Barre de progression */}
                              <View style={styles.progressWrap}>
                                <View style={styles.progressBg}>
                                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                                </View>
                                <View style={styles.progressLabels}>
                                  <Text style={styles.progressText}>Verse {money(c.montantVerse)}</Text>
                                  <Text style={styles.progressText}>/ {money(c.montantTotal)}</Text>
                                </View>
                              </View>

                              {!c.estReglee && (
                                <Text style={[styles.creditRestant, retard && { color: '#dc2626' }]}>
                                  Restant : {money(c.montantRestant)}
                                </Text>
                              )}
                              {!c.estReglee && !!c.dateEcheance && (
                                <Text style={[styles.creditEcheance, retard && { color: '#dc2626' }]}>
                                  Échéance : {fdate(c.dateEcheance)}
                                </Text>
                              )}
                            </View>
                          );
                        })
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            {/* Pied modal */}
            <View style={styles.detailFoot}>
              <TouchableOpacity style={styles.btnFermer} onPress={() => setShowDetail(false)}>
                <Text style={styles.btnFermerText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL QR CODE CLIENT — le client scanne pour télécharger son relevé
          PDF, comme showQrCode() sur Ionic (endpoint public /api/clients/{id}/qrcode
          qui encode l'URL /api/clients/{id}/releve-pdf).
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showQrModal} animationType="slide" transparent onRequestClose={() => setShowQrModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailNom}>QR Code · {selectedClient?.nom}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQrModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                Le client scanne ce QR code pour télécharger son relevé de compte PDF
              </Text>
              {selectedClient?.id ? (
                <Image
                  source={{ uri: `${getBackendRootUrl()}/api/clients/${selectedClient.id}/qrcode` }}
                  style={{ width: 200, height: 200, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0' }}
                  resizeMode="contain"
                />
              ) : null}
              <Text style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>{selectedClient?.nom}</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL RELEVÉ CLIENT (situation client)
      ════════════════════════════════════════════════════════════════════════ */}
      <ClientReleveModal
        visible={showReleve}
        client={selectedClient}
        onClose={() => setShowReleve(false)}
      />

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL DÉPÔT AVANCE
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showAvanceModal} animationType="slide" transparent onRequestClose={() => setShowAvanceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailNom}>Avance · {selectedClient?.nom}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAvanceModal(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.detailBody} contentContainerStyle={{ paddingBottom: 20 }}>
                <TextInput
                  label="Montant *"
                  value={avanceForm.montant}
                  onChangeText={v => setAvanceForm(f => ({ ...f, montant: v }))}
                  keyboardType="numeric"
                  mode="outlined"
                  style={styles.input}
                />
                <Text style={{ marginBottom: 6, fontSize: 12, fontWeight: '600', color: '#64748b' }}>Mode de paiement</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARTE_BANCAIRE', 'VIREMENT'].map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeChip, avanceForm.modePaiement === m && styles.modeChipActive]}
                      onPress={() => setAvanceForm(f => ({ ...f, modePaiement: m }))}
                    >
                      <Text style={[styles.modeChipText, avanceForm.modePaiement === m && styles.modeChipTextActive]}>
                        {m.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {avanceForm.modePaiement !== 'ESPECES' && (
                  <TextInput
                    label="Référence"
                    value={avanceForm.referencePaiement}
                    onChangeText={v => setAvanceForm(f => ({ ...f, referencePaiement: v }))}
                    mode="outlined"
                    style={styles.input}
                  />
                )}
                <TextInput
                  label="Motif (optionnel)"
                  value={avanceForm.motif}
                  onChangeText={v => setAvanceForm(f => ({ ...f, motif: v }))}
                  mode="outlined"
                  multiline
                  style={styles.input}
                />
                <Button
                  mode="contained"
                  onPress={enregistrerAvanceFn}
                  loading={savingAvance}
                  disabled={savingAvance}
                  style={{ marginTop: 8, backgroundColor: '#0e9f6e' }}
                >
                  Enregistrer l'avance
                </Button>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAL HISTORIQUE AVANCES
      ════════════════════════════════════════════════════════════════════════ */}
      <Modal visible={showHistoriqueAvance} animationType="slide" transparent onRequestClose={() => setShowHistoriqueAvance(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailNom}>Avances · {selectedClient?.nom}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowHistoriqueAvance(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingHistoriqueAvance ? (
              <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
            ) : (
              <ScrollView style={styles.detailBody} contentContainerStyle={{ paddingBottom: 20 }}>
                {historiqueAvance ? (
                  <>
                    <View style={styles.avanceKpiRow}>
                      <View style={[styles.avanceKpi, { backgroundColor: '#dcfce7' }]}>
                        <Text style={[styles.avanceKpiLabel, { color: '#15803d' }]}>Disponible</Text>
                        <Text style={[styles.avanceKpiVal, { color: '#15803d' }]}>{money(historiqueAvance.soldeDisponible || 0)}</Text>
                      </View>
                      <View style={[styles.avanceKpi, { backgroundColor: '#dbeafe' }]}>
                        <Text style={[styles.avanceKpiLabel, { color: '#1d4ed8' }]}>Déposé</Text>
                        <Text style={[styles.avanceKpiVal, { color: '#1d4ed8' }]}>{money(historiqueAvance.totalDepose || 0)}</Text>
                      </View>
                      <View style={[styles.avanceKpi, { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.avanceKpiLabel, { color: '#b45309' }]}>Utilisé</Text>
                        <Text style={[styles.avanceKpiVal, { color: '#b45309' }]}>{money(historiqueAvance.totalUtilise || 0)}</Text>
                      </View>
                    </View>

                    {(historiqueAvance.historique || []).length === 0 ? (
                      <Text style={styles.emptyOnglet}>Aucune avance enregistrée</Text>
                    ) : (
                      (historiqueAvance.historique || []).map((a: any) => (
                        <View key={a.id} style={styles.venteItem}>
                          <View style={styles.venteTop}>
                            <Text style={styles.venteMontant}>{money(a.montant)}</Text>
                            <View style={[styles.statutBadge, a.statut === 'EPUISEE' ? styles.statutRegle : styles.statutEnCours]}>
                              <Text style={[styles.statutText, { color: a.statut === 'EPUISEE' ? '#16a34a' : '#d97706' }]}>{a.statut}</Text>
                            </View>
                          </View>
                          <Text style={styles.venteMode}>{fdate(a.dateDepot)}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                            <Text style={{ fontSize: 12, color: '#16a34a' }}>Disponible : {money(a.montantDisponible)}</Text>
                            <Text style={{ fontSize: 12, color: '#d97706' }}>Utilisé : {money(a.montantUtilise)}</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyOnglet}>Aucune donnée</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Hero
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  // Offline
  offlineBanner: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6,
  },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  // Liste
  search: { margin: 12 },

  // Card design system
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: 'bold', fontSize: 15 },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  // FAB
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: '#1a56db' },

  // Modal ajout / modification (Paper)
  paperModal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },

  // Modal detail (RN)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  handle: {
    width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2,
    alignSelf: 'center', marginTop: 10,
  },

  // Header detail
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  detailAvatar: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarText: { fontWeight: 'bold', fontSize: 18 },
  detailNom: { fontWeight: 'bold', fontSize: 17, color: '#1e293b' },
  detailSub: { color: '#64748b', fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#64748b', fontSize: 18, fontWeight: '600' },

  // Onglets
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#1a56db' },
  tabLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabLabelActive: { color: '#1a56db', fontWeight: 'bold' },

  // Corps detail
  detailBody: { padding: 16, maxHeight: 440 },

  // Infos
  infoCard: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  infoLabel: { color: '#64748b', fontSize: 13 },
  infoVal: { color: '#1e293b', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Alerte credit
  alertCredit: {
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#fca5a5', alignItems: 'center',
  },
  alertCreditText: { color: '#dc2626', fontWeight: 'bold', fontSize: 15 },

  // Bouton relevé complet
  btnReleve: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#eff6ff', borderRadius: 10, paddingVertical: 12,
    borderWidth: 1, borderColor: '#bfdbfe', marginBottom: 14,
  },
  btnReleveText: { color: '#1a56db', fontWeight: 'bold', fontSize: 14 },

  // Boutons avance
  btnAvance: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#ecfdf5', borderRadius: 10, paddingVertical: 11,
    borderWidth: 1, borderColor: '#a7f3d0',
  },
  btnAvanceText: { color: '#0e9f6e', fontWeight: 'bold', fontSize: 13 },
  btnHistorique: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#eff6ff', borderRadius: 10, paddingVertical: 11,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  btnHistoriqueText: { color: '#1a56db', fontWeight: 'bold', fontSize: 13 },

  // Bouton QR code
  btnQr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#f5f3ff', borderRadius: 10, paddingVertical: 12,
    borderWidth: 1, borderColor: '#ddd6fe', marginTop: 10,
  },
  btnQrText: { color: '#7c3aed', fontWeight: 'bold', fontSize: 13 },

  // Bouton facture PDF par vente
  btnPdfVente: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  btnPdfVenteText: { color: '#1a56db', fontSize: 10, fontWeight: '700' },

  // Chips mode paiement (modal avance)
  modeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  modeChipActive: { backgroundColor: '#0e9f6e', borderColor: '#0e9f6e' },
  modeChipText: { fontSize: 12, color: '#555' },
  modeChipTextActive: { color: '#fff', fontWeight: '600' },

  // KPI historique avances
  avanceKpiRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  avanceKpi: { flex: 1, borderRadius: 12, padding: 10, alignItems: 'center' },
  avanceKpiLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  avanceKpiVal: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },

  // Actions infos
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnModifier: {
    flex: 1, backgroundColor: '#1a56db', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  btnModifierText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnSupprimer: {
    flex: 1, backgroundColor: '#fef2f2', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#fca5a5',
  },
  btnSupprimerText: { color: '#dc2626', fontWeight: 'bold', fontSize: 14 },

  // KPI achats / credits
  kpiBox: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 14,
    marginBottom: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  kpiBoxRed: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  kpiLabel: { color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  kpiVal: { color: '#1a56db', fontWeight: 'bold', fontSize: 22, marginTop: 4 },
  kpiSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  // Ventes
  venteItem: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  venteTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  venteDate: { flex: 1, color: '#475569', fontSize: 13, fontWeight: '500' },
  venteMontant: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  venteMode: { color: '#94a3b8', fontSize: 11 },
  badgeCredit: { backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  badgeCreditText: { color: '#92400e', fontSize: 10, fontWeight: 'bold' },
  emptyOnglet: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },

  // Credits
  creditItem: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  creditItemRegle: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  creditItemRetard: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  creditTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  creditNum: { flex: 1, fontWeight: '600', color: '#334155', fontSize: 13 },
  statutBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statutRegle: { backgroundColor: '#dcfce7' },
  statutEnCours: { backgroundColor: '#fef3c7' },
  statutRetard: { backgroundColor: '#fee2e2' },
  statutText: { fontSize: 11, fontWeight: '600' },
  creditRestant: { color: '#dc2626', fontWeight: 'bold', fontSize: 13, marginTop: 4 },
  creditEcheance: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  // Progression
  progressWrap: { marginVertical: 6 },
  progressBg: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#1a56db', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  progressText: { fontSize: 10, color: '#94a3b8' },

  // Pied modal detail
  detailFoot: { padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  btnFermer: {
    backgroundColor: '#f1f5f9', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  btnFermerText: { color: '#475569', fontWeight: '600', fontSize: 14 },
});
