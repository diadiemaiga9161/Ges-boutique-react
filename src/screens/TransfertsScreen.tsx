import React, { useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert,
  Modal, ScrollView, TextInput, TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, ActivityIndicator, FAB, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api, { getBoutiques, getProduits, createTransfert, getTransfertsEnvoyes, getTransfertsRecus, accepterTransfert, rejeterTransfert } from '../services/api.service';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const TYPES_PAIEMENT = [
  { value: 'SANS_PAIEMENT', label: 'Sans paiement' },
  { value: 'IMMEDIAT', label: 'Paiement immédiat' },
  { value: 'CREDIT', label: 'Crédit' },
] as const;

const MODES_PAIEMENT = [
  { v: 'ESPECES', l: 'Espèces' },
  { v: 'ORANGE_MONEY', l: 'Orange Money' },
  { v: 'MOOV_MONEY', l: 'Moov Money' },
  { v: 'WAVE_MONEY', l: 'Wave Money' },
  { v: 'VIREMENT', l: 'Virement' },
];

type TypePaiement = typeof TYPES_PAIEMENT[number]['value'];

export default function TransfertsScreen() {
  const { lang } = useLang();
  const [transferts, setTransferts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');

  // ── Modal création ──
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [produits, setProduits] = useState<any[]>([]);
  const [boutiqueSrc, setBoutiqueSrc] = useState<any | null>(null);
  const [boutiqueDest, setBoutiqueDest] = useState<any | null>(null);
  const [produit, setProduit] = useState<any | null>(null);
  const [quantite, setQuantite] = useState('');
  const [motif, setMotif] = useState('');
  const [typePaiement, setTypePaiement] = useState<TypePaiement>('SANS_PAIEMENT');
  const [searchProduit, setSearchProduit] = useState('');
  const [etape, setEtape] = useState<'src' | 'dest' | 'produit' | 'confirm'>('src');
  const [onglet, setOnglet] = useState<'tous' | 'envoyes' | 'recus'>('tous');
  const [transfertsEnvoyes, setTransfertsEnvoyes] = useState<any[]>([]);
  const [transfertsRecus, setTransfertsRecus] = useState<any[]>([]);
  const [nbEnAttente, setNbEnAttente] = useState(0);

  // ── Modal accusé de réception ──
  const [transfertsEnAttente, setTransfertsEnAttente] = useState<any[]>([]);
  const [transfertEnCours, setTransfertEnCours] = useState<any>(null);
  const [showAccuseModal, setShowAccuseModal] = useState(false);
  const [showMotifRejet, setShowMotifRejet] = useState(false);
  const [motifRejet, setMotifRejet] = useState('');
  const [actionEnCours, setActionEnCours] = useState(false);

  // ── Produits boutique dest ──
  const [produitsBoutiqueDest, setProduitsBoutiqueDest] = useState<any[]>([]);
  const [loadingProduitsDest, setLoadingProduitsDest] = useState(false);

  // ── Modal détail transfert ──
  const [detailTransfert, setDetailTransfert] = useState<any>(null);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [loadingPaiements, setLoadingPaiements] = useState(false);
  const [showPaiementForm, setShowPaiementForm] = useState(false);
  const [montantPaiement, setMontantPaiement] = useState('');
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [notesPaiement, setNotesPaiement] = useState('');

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const res = await api.get('/transferts');
      const data = res.data?.data || res.data || [];
      setTransferts(data);
      setFromCache(false);
      sauvegarderCache('transferts', data).catch(() => {});
    } catch {
      const cached = await lireCache<any>('transferts');
      if (cached.length > 0) { setTransferts(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
    if (event?.target?.complete) event.target.complete();
  };

  const chargerOnglets = async () => {
    try {
      const [rEnv, rRec] = await Promise.all([
        getTransfertsEnvoyes().catch(() => ({ data: [] })),
        getTransfertsRecus().catch(() => ({ data: [] })),
      ]);
      const envoyes = rEnv.data?.data || rEnv.data || [];
      const recus = rRec.data?.data || rRec.data || [];
      setTransfertsEnvoyes(envoyes);
      setTransfertsRecus(recus);
      setNbEnAttente(recus.filter((t: any) =>
        t.statut === 'EN_ATTENTE_CONFIRMATION' || t.statut === 'EN_ATTENTE'
      ).length);
    } catch {}
  };

  useEffect(() => { charger(); chargerOnglets(); verifierTransfertsEnAttente(); }, []);

  const handleAccepter = (t: any) => {
    Alert.alert(
      'Accepter ce transfert ?',
      'Les produits seront ajoutés à votre stock.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Accepter',
          onPress: async () => {
            try {
              await accepterTransfert(t.id);
              charger();
              chargerOnglets();
              Alert.alert('Succès', 'Transfert accepté, stock mis à jour.');
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Erreur');
            }
          }
        }
      ]
    );
  };

  const handleRejeter = (t: any) => {
    Alert.alert(
      'Rejeter ce transfert ?',
      'Le transfert sera marqué comme rejeté.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Rejeter',
          style: 'destructive',
          onPress: async () => {
            try {
              await rejeterTransfert(t.id);
              charger();
              chargerOnglets();
            } catch (e: any) {
              Alert.alert('Erreur', e?.response?.data?.message || 'Erreur');
            }
          }
        }
      ]
    );
  };

  const verifierTransfertsEnAttente = async () => {
    try {
      const rRec = await getTransfertsRecus().catch(() => ({ data: [] }));
      const recus: any[] = rRec.data?.data || rRec.data || [];
      const enAttente = recus.filter((t: any) =>
        t.statut === 'EN_ATTENTE_CONFIRMATION' || t.statut === 'EN_ATTENTE' || t.statut === 'CREE'
      );
      setTransfertsEnAttente(enAttente);
      if (enAttente.length > 0) {
        setTransfertEnCours(enAttente[0]);
        setShowAccuseModal(true);
      }
    } catch { }
  };

  const accepterTransfertModal = async (id: number) => {
    setActionEnCours(true);
    try {
      await accepterTransfert(id);
      setShowAccuseModal(false);
      setActionEnCours(false);
      Alert.alert('Succès', 'Transfert accepté, stock mis à jour.');
      charger();
      chargerOnglets();
    } catch (e: any) {
      setActionEnCours(false);
      Alert.alert('Erreur', e?.response?.data?.message || 'Erreur');
    }
  };

  const confirmerRejet = async () => {
    if (!transfertEnCours) return;
    setActionEnCours(true);
    try {
      await rejeterTransfert(transfertEnCours.id, motifRejet.trim() || undefined);
      setShowAccuseModal(false);
      setShowMotifRejet(false);
      setMotifRejet('');
      setActionEnCours(false);
      charger();
      chargerOnglets();
    } catch (e: any) {
      setActionEnCours(false);
      Alert.alert('Erreur', e?.response?.data?.message || 'Erreur');
    }
  };

  const statutColor = (statut: string) => {
    const map: Record<string, string> = {
      CREE: '#3b82f6', EN_ATTENTE_CONFIRMATION: '#f59e0b', EN_ATTENTE: '#f59e0b',
      CONFIRME: '#10b981', ACCEPTE: '#10b981', REJETE: '#ef4444', COMPLETE: '#8b5cf6', ANNULE: '#6b7280'
    };
    return map[statut] || '#6b7280';
  };

  const ouvrirCreate = async () => {
    setBoutiqueSrc(null);
    setBoutiqueDest(null);
    setProduit(null);
    setQuantite('');
    setMotif('');
    setTypePaiement('SANS_PAIEMENT');
    setSearchProduit('');
    setEtape('src');
    setShowCreate(true);
    try {
      const [rb, rp] = await Promise.all([
        getBoutiques().catch(() => ({ data: [] })),
        getProduits().catch(() => ({ data: [] })),
      ]);
      setBoutiques(rb.data?.boutiques || rb.data?.data || rb.data || []);
      setProduits(rp.data?.produits || rp.data?.data || rp.data || []);
    } catch { }
  };

  const sauvegarderTransfert = async () => {
    if (!boutiqueSrc) { Alert.alert(tr('erreur', lang), 'Choisissez la boutique source'); return; }
    if (!boutiqueDest) { Alert.alert(tr('erreur', lang), 'Choisissez la boutique destination'); return; }
    if (boutiqueSrc.id === boutiqueDest.id) { Alert.alert(tr('erreur', lang), 'Source et destination différentes'); return; }
    if (!produit) { Alert.alert(tr('erreur', lang), 'Choisissez un produit'); return; }
    const qty = parseFloat(quantite);
    if (!qty || qty <= 0) { Alert.alert(tr('erreur', lang), 'Quantité invalide'); return; }

    setSaving(true);
    try {
      const payload = {
        boutiqueSrcId: boutiqueSrc.id,
        boutiqueDestId: boutiqueDest.id,
        produitId: produit.id,
        quantite: qty,
        notes: motif.trim() || undefined,
        typePaiement: typePaiement,
      };
      const res = await executerOuMettreEnFile(
        'transfert_create',
        payload,
        () => createTransfert(payload)
      );
      setShowCreate(false);
      if (res.offline) {
        Alert.alert('Sauvegardé hors ligne', 'Transfert mis en file — sync au retour connexion');
      } else {
        charger();
        Alert.alert('Succès', 'Transfert créé');
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e?.response?.data?.message || tr('erreur', lang));
    }
    setSaving(false);
  };

  const couleurStatut = (s: string) => {
    if (s === 'CONFIRME') return '#16a34a';
    if (s === 'EN_ATTENTE') return '#f59e0b';
    return '#ef4444';
  };

  const chargerProduitsBoutiqueDest = async (partenaire: any) => {
    if (!partenaire?.id) return;
    setLoadingProduitsDest(true);
    try {
      const res = await api.get(`/transferts/partenaires/${partenaire.id}/produits`);
      setProduitsBoutiqueDest(res.data?.data || res.data || []);
    } catch {
      setProduitsBoutiqueDest([]);
    }
    setLoadingProduitsDest(false);
  };

  const voirDetail = async (t: any) => {
    setDetailTransfert(t);
    setPaiements([]);
    setShowPaiementForm(false);
    setMontantPaiement('');
    setNotesPaiement('');
    setModePaiement('ESPECES');
    setLoadingPaiements(true);
    try {
      const res = await api.get(`/transferts/${t.id}/paiements`);
      setPaiements(res.data?.data || res.data || []);
    } catch { setPaiements([]); }
    setLoadingPaiements(false);
  };

  const enregistrerPaiement = async () => {
    if (!detailTransfert || !montantPaiement) return;
    try {
      await api.post(`/transferts/${detailTransfert.id}/paiements`, {
        montant: parseFloat(montantPaiement),
        modePaiement,
        notes: notesPaiement.trim() || undefined,
      });
      setMontantPaiement('');
      setNotesPaiement('');
      setShowPaiementForm(false);
      const res = await api.get(`/transferts/${detailTransfert.id}/paiements`);
      setPaiements(res.data?.data || res.data || []);
      Alert.alert('Succès', 'Paiement enregistré');
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Erreur');
    }
  };

  const montantTotal = transferts.reduce((sum, t) => sum + (t.montant || t.montantTotal || 0), 0);

  const filtered = transferts.filter(t =>
    !search ||
    [t.produitNom, t.boutiqueSrcNom, t.boutiqueDestNom]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  const produitsFiltres = produits.filter(p =>
    !searchProduit || (p.nom || '').toLowerCase().includes(searchProduit.toLowerCase())
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Hero banner */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{transferts.length}</Text>
          <Text style={styles.heroLbl}>Transferts</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{montantTotal.toLocaleString('fr-FR')} F</Text>
          <Text style={styles.heroLbl}>Montant total</Text>
        </View>
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <Searchbar
        placeholder={tr('rechercher', lang)}
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={{ fontSize: 13 }}
      />

      {/* Sélecteur onglet */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 4 }}>
        {(['tous', 'envoyes', 'recus'] as const).map(o => (
          <TouchableOpacity
            key={o}
            onPress={() => { setOnglet(o); if (o !== 'tous') chargerOnglets(); }}
            style={{
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: onglet === o ? '#4f46e5' : '#e5e7eb',
              position: 'relative'
            }}
          >
            <Text style={{ color: onglet === o ? '#fff' : '#374151', fontSize: 12 }}>
              {o === 'tous' ? 'Tous' : o === 'envoyes' ? 'Envoyés' : 'Reçus'}
            </Text>
            {o === 'recus' && nbEnAttente > 0 && (
              <View style={{
                position: 'absolute', top: -4, right: -4,
                backgroundColor: '#f59e0b', borderRadius: 8,
                minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center'
              }}>
                <Text style={{ color: '#fff', fontSize: 9 }}>{nbEnAttente}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={onglet === 'envoyes' ? transfertsEnvoyes : onglet === 'recus' ? transfertsRecus : filtered}
        keyExtractor={t => String(t.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); chargerOnglets(); }}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 90, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: '#1a56db22' }]}>
                <MaterialCommunityIcons name="bank-transfer" size={22} color="#1a56db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.boutiqueSrcNom} → {item.boutiqueDestNom}
                </Text>
                <Text style={styles.cardSub}>{item.produitNom} — {item.quantite} unité(s)</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Chip compact style={{ backgroundColor: statutColor(item.statut) }}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>
                    {item.statut?.replace(/_/g, ' ')}
                  </Text>
                </Chip>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.cardDate}>
                    {item.dateTransfert
                      ? new Date(item.dateTransfert).toLocaleDateString('fr-FR')
                      : ''}
                  </Text>
                  <TouchableOpacity onPress={() => voirDetail(item)} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="eye-outline" size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>
            </Card.Content>
            {onglet === 'recus' && (item.statut === 'EN_ATTENTE_CONFIRMATION' || item.statut === 'EN_ATTENTE') && (
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => handleAccepter(item)}
                  style={{ flex: 1, backgroundColor: '#10b981', padding: 8, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>Accepter</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRejeter(item)}
                  style={{ flex: 1, backgroundColor: '#ef4444', padding: 8, borderRadius: 8, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontSize: 12 }}>Rejeter</Text>
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bank-transfer-out" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Aucun transfert</Text>
            <Text style={styles.emptySub}>Les transferts entre boutiques apparaîtront ici</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={ouvrirCreate}
      />

      {/* ── Modal détail transfert ── */}
      <Modal visible={!!detailTransfert} animationType="slide" onRequestClose={() => setDetailTransfert(null)}>
        <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
          <View style={[styles.modalHeader, { flexDirection: 'row', justifyContent: 'space-between' }]}>
            <Text style={styles.modalTitle}>Détail du transfert</Text>
            <TouchableOpacity onPress={() => setDetailTransfert(null)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
            {detailTransfert && (
              <>
                {/* Infos générales */}
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  {([
                    ['N°', detailTransfert.numeroTransfert],
                    ['Source', detailTransfert.boutiqueSourceNom || detailTransfert.boutiqueSrcNom],
                    ['Destination', detailTransfert.boutiqueDestNom],
                    ['Statut', detailTransfert.statut?.replace(/_/g, ' ')],
                    ['Paiement', detailTransfert.typePaiement],
                    ['Notes', detailTransfert.notes || '—'],
                  ] as [string, string][]).map(([label, val]) => (
                    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                      <Text style={{ color: '#64748b', fontSize: 13 }}>{label}</Text>
                      <Text style={{ fontWeight: '600', fontSize: 13, color: '#0f172a', flex: 1, textAlign: 'right' }}>{val}</Text>
                    </View>
                  ))}
                </View>

                {/* Lignes produits */}
                {(detailTransfert.lignes || []).length > 0 && (
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <Text style={{ fontWeight: '700', marginBottom: 8, color: '#0f172a' }}>Produits</Text>
                    {(detailTransfert.lignes || []).map((l: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text style={{ fontSize: 13, color: '#0f172a' }}>{l.produitNom}</Text>
                        <Text style={{ fontSize: 13, color: '#1a56db', fontWeight: '600' }}>{l.quantite} unités</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Paiements inter-boutiques */}
                <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontWeight: '700', color: '#0f172a', flex: 1 }}>Paiements inter-boutiques</Text>
                    <TouchableOpacity
                      onPress={() => setShowPaiementForm(!showPaiementForm)}
                      style={{ backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
                    >
                      <Text style={{ color: '#16a34a', fontSize: 12, fontWeight: '600' }}>+ Ajouter</Text>
                    </TouchableOpacity>
                  </View>

                  {showPaiementForm && (
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                      <TextInput
                        style={styles.input}
                        value={montantPaiement}
                        onChangeText={setMontantPaiement}
                        placeholder="Montant"
                        keyboardType="numeric"
                        placeholderTextColor="#94a3b8"
                      />
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                        {MODES_PAIEMENT.map(m => (
                          <TouchableOpacity
                            key={m.v}
                            onPress={() => setModePaiement(m.v)}
                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: modePaiement === m.v ? '#1a56db' : '#e2e8f0' }}
                          >
                            <Text style={{ fontSize: 11, color: modePaiement === m.v ? '#fff' : '#374151' }}>{m.l}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={styles.input}
                        value={notesPaiement}
                        onChangeText={setNotesPaiement}
                        placeholder="Notes (optionnel)"
                        placeholderTextColor="#94a3b8"
                      />
                      <TouchableOpacity onPress={enregistrerPaiement} style={styles.saveBtn}>
                        <Text style={styles.saveBtnTxt}>Enregistrer le paiement</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {loadingPaiements ? (
                    <ActivityIndicator color="#1a56db" />
                  ) : paiements.length > 0 ? (
                    paiements.map((p: any) => (
                      <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#0f172a' }}>{p.modePaiement?.replace(/_/g, ' ')}</Text>
                          <Text style={{ fontSize: 11, color: '#64748b' }}>{p.notes || ''} {p.enregistrePar || ''}</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#16a34a' }}>{(p.montant || 0).toLocaleString('fr-FR')} F</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', paddingVertical: 8 }}>Aucun paiement enregistré</Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal accusé de réception transfert entrant ── */}
      <Modal visible={showAccuseModal} animationType="slide" transparent onRequestClose={() => {}}>
        <View style={accuseStyles.overlay}>
          <View style={accuseStyles.card}>
            <View style={accuseStyles.header}>
              <Text style={accuseStyles.icon}>📦</Text>
              <Text style={accuseStyles.titre}>Transfert reçu !</Text>
              <Text style={accuseStyles.soustitre}>
                De {transfertEnCours?.boutiqueSrcNom || transfertEnCours?.boutiqueSourceNom || 'Boutique partenaire'}
              </Text>
            </View>

            <ScrollView style={accuseStyles.body} showsVerticalScrollIndicator={false}>
              {transfertEnCours?.dateTransfert && (
                <View style={accuseStyles.infoRow}>
                  <Text style={accuseStyles.infoLabel}>Date</Text>
                  <Text style={accuseStyles.infoValue}>
                    {new Date(transfertEnCours.dateTransfert).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              )}
              {transfertEnCours?.notes && (
                <View style={accuseStyles.infoRow}>
                  <Text style={accuseStyles.infoLabel}>Notes</Text>
                  <Text style={accuseStyles.infoValue}>{transfertEnCours.notes}</Text>
                </View>
              )}
              <Text style={accuseStyles.sectionTitre}>Produits envoyés :</Text>
              {(transfertEnCours?.lignes && transfertEnCours.lignes.length > 0)
                ? transfertEnCours.lignes.map((ligne: any, idx: number) => (
                  <View key={idx} style={accuseStyles.produit}>
                    <Text style={accuseStyles.produitNom}>{ligne.produitNom}</Text>
                    <View style={accuseStyles.produitBadge}>
                      <Text style={accuseStyles.produitQte}>x {ligne.quantite}</Text>
                    </View>
                  </View>
                ))
                : transfertEnCours?.produitNom ? (
                  <View style={accuseStyles.produit}>
                    <Text style={accuseStyles.produitNom}>{transfertEnCours.produitNom}</Text>
                    <View style={accuseStyles.produitBadge}>
                      <Text style={accuseStyles.produitQte}>x {transfertEnCours.quantite}</Text>
                    </View>
                  </View>
                ) : null
              }
              {showMotifRejet && (
                <TextInput
                  placeholder="Motif du rejet (optionnel)"
                  value={motifRejet}
                  onChangeText={setMotifRejet}
                  style={accuseStyles.motifInput}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#94a3b8"
                />
              )}
            </ScrollView>

            <View style={accuseStyles.actions}>
              {!showMotifRejet && (
                <TouchableOpacity
                  style={[accuseStyles.btnAccepter, actionEnCours && accuseStyles.btnDisabled]}
                  onPress={() => accepterTransfertModal(transfertEnCours?.id)}
                  disabled={actionEnCours}>
                  <Text style={accuseStyles.btnTexte}>
                    {actionEnCours ? '...' : 'Accepter'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[accuseStyles.btnRejeter, actionEnCours && accuseStyles.btnDisabled]}
                onPress={() => showMotifRejet ? confirmerRejet() : setShowMotifRejet(true)}
                disabled={actionEnCours}>
                <Text style={accuseStyles.btnTexte}>
                  {showMotifRejet ? 'Confirmer rejet' : 'Rejeter'}
                </Text>
              </TouchableOpacity>
            </View>
            {showMotifRejet && (
              <TouchableOpacity
                onPress={() => setShowMotifRejet(false)}
                style={{ padding: 12, alignItems: 'center' }}>
                <Text style={{ color: '#6b7280', fontSize: 13 }}>Annuler</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal création transfert ── */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Nouveau transfert</Text>
            <Text style={styles.modalSubtitle}>
              {etape === 'src' ? 'Étape 1 — Boutique source' :
               etape === 'dest' ? 'Étape 2 — Boutique destination' :
               etape === 'produit' ? 'Étape 3 — Produit & quantité' :
               'Étape 4 — Confirmation'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowCreate(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Indicateur d'étapes */}
        <View style={styles.stepsRow}>
          {(['src', 'dest', 'produit', 'confirm'] as const).map((e, i) => (
            <View key={e} style={[styles.stepDot, etape === e && styles.stepDotActive,
              (etape === 'dest' && i < 1) || (etape === 'produit' && i < 2) || (etape === 'confirm' && i < 3)
                ? styles.stepDotDone : null
            ]} />
          ))}
        </View>

        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">

          {/* ÉTAPE 1 — Source */}
          {etape === 'src' && (
            <>
              <Text style={styles.stepLabel}>Choisir la boutique source :</Text>
              {boutiques.length === 0 && (
                <View style={{ alignItems: 'center', padding: 24 }}>
                  <ActivityIndicator color="#1a56db" />
                  <Text style={{ color: '#888', marginTop: 8 }}>Chargement…</Text>
                </View>
              )}
              {boutiques.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.boutiqueItem, boutiqueSrc?.id === b.id && styles.boutiqueItemSelected]}
                  onPress={() => { setBoutiqueSrc(b); setEtape('dest'); }}
                >
                  <MaterialCommunityIcons name="store" size={20} color={boutiqueSrc?.id === b.id ? '#fff' : '#1a56db'} />
                  <Text style={[styles.boutiqueNom, boutiqueSrc?.id === b.id && { color: '#fff' }]}>{b.nom}</Text>
                  {boutiqueSrc?.id === b.id && <MaterialCommunityIcons name="check" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* ÉTAPE 2 — Destination */}
          {etape === 'dest' && (
            <>
              <View style={styles.recapRow}>
                <MaterialCommunityIcons name="store-check-outline" size={16} color="#0e9f6e" />
                <Text style={styles.recapTxt}>Source : <Text style={{ fontWeight: '700' }}>{boutiqueSrc?.nom}</Text></Text>
              </View>
              <Text style={styles.stepLabel}>Choisir la boutique destination :</Text>
              {boutiques.filter(b => b.id !== boutiqueSrc?.id).map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.boutiqueItem, boutiqueDest?.id === b.id && styles.boutiqueItemSelected]}
                  onPress={() => { setBoutiqueDest(b); chargerProduitsBoutiqueDest(b); setEtape('produit'); }}
                >
                  <MaterialCommunityIcons name="store" size={20} color={boutiqueDest?.id === b.id ? '#fff' : '#1a56db'} />
                  <Text style={[styles.boutiqueNom, boutiqueDest?.id === b.id && { color: '#fff' }]}>{b.nom}</Text>
                  {boutiqueDest?.id === b.id && <MaterialCommunityIcons name="check" size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.retourBtn} onPress={() => setEtape('src')}>
                <MaterialCommunityIcons name="arrow-left" size={14} color="#64748b" />
                <Text style={styles.retourTxt}>Retour</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ÉTAPE 3 — Produit & quantité */}
          {etape === 'produit' && (
            <>
              <View style={styles.recapRow}>
                <MaterialCommunityIcons name="bank-transfer" size={16} color="#0e9f6e" />
                <Text style={styles.recapTxt}>{boutiqueSrc?.nom} → {boutiqueDest?.nom}</Text>
              </View>
              {/* Stock boutique destinataire */}
              {boutiqueDest && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.stepLabel, { color: '#0891b2' }]}>
                    Stock actuel chez {boutiqueDest.nom} :
                  </Text>
                  {loadingProduitsDest ? (
                    <ActivityIndicator color="#0891b2" />
                  ) : produitsBoutiqueDest.length > 0 ? (
                    <View style={{ backgroundColor: '#f0f9ff', borderRadius: 10, padding: 8, borderWidth: 1, borderColor: '#bae6fd' }}>
                      {produitsBoutiqueDest.map((p: any) => (
                        <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#e0f2fe' }}>
                          <Text style={{ fontSize: 13, color: '#0c4a6e', flex: 1 }}>{p.nom}</Text>
                          <Text style={{ fontSize: 13, color: '#0891b2', fontWeight: '600' }}>
                            Stock: {p.quantite ?? p.stock ?? 0}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                      Connexion impossible ou boutique vide
                    </Text>
                  )}
                </View>
              )}

              <Text style={styles.stepLabel}>Rechercher un produit :</Text>
              <TextInput
                style={styles.searchInput}
                value={searchProduit}
                onChangeText={setSearchProduit}
                placeholder="Nom du produit..."
                placeholderTextColor="#94a3b8"
              />
              {produitsFiltres.slice(0, 10).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.produitItem, produit?.id === p.id && styles.produitItemSelected]}
                  onPress={() => setProduit(p)}
                >
                  <MaterialCommunityIcons name="package-variant" size={18} color={produit?.id === p.id ? '#fff' : '#64748b'} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.produitNom, produit?.id === p.id && { color: '#fff' }]}>{p.nom}</Text>
                    {p.stock !== undefined && (
                      <Text style={[styles.produitStock, produit?.id === p.id && { color: 'rgba(255,255,255,0.7)' }]}>
                        Stock : {p.stock} {p.unite || ''}
                      </Text>
                    )}
                  </View>
                  {produit?.id === p.id && <MaterialCommunityIcons name="check" size={16} color="#fff" />}
                </TouchableOpacity>
              ))}

              {produit && (
                <>
                  <Text style={[styles.stepLabel, { marginTop: 16 }]}>Quantité à transférer :</Text>
                  <TextInput
                    style={styles.input}
                    value={quantite}
                    onChangeText={setQuantite}
                    keyboardType="numeric"
                    placeholder="Ex : 10"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.stepLabel}>Notes (facultatif) :</Text>
                  <TextInput
                    style={styles.input}
                    value={motif}
                    onChangeText={setMotif}
                    placeholder="Raison du transfert..."
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.stepLabel}>Type de paiement :</Text>
                  <View style={styles.typePaiementRow}>
                    {TYPES_PAIEMENT.map(tp => (
                      <TouchableOpacity
                        key={tp.value}
                        style={[styles.typePaiementBtn, typePaiement === tp.value && styles.typePaiementBtnActive]}
                        onPress={() => setTypePaiement(tp.value)}
                      >
                        <Text style={[styles.typePaiementBtnText, typePaiement === tp.value && styles.typePaiementBtnTextActive]}>
                          {tp.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={() => {
                      if (!produit) return;
                      const qty = parseFloat(quantite);
                      if (!qty || qty <= 0) { Alert.alert(tr('erreur', lang), 'Quantité invalide'); return; }
                      setEtape('confirm');
                    }}
                  >
                    <Text style={styles.saveBtnTxt}>Suivant</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.retourBtn} onPress={() => setEtape('dest')}>
                <MaterialCommunityIcons name="arrow-left" size={14} color="#64748b" />
                <Text style={styles.retourTxt}>Retour</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ÉTAPE 4 — Confirmation */}
          {etape === 'confirm' && (
            <>
              <Text style={styles.stepLabel}>Récapitulatif du transfert :</Text>
              <View style={styles.recapCard}>
                {[
                  ['Source', boutiqueSrc?.nom],
                  ['Destination', boutiqueDest?.nom],
                  ['Produit', produit?.nom],
                  ['Quantité', quantite],
                  ['Type paiement', TYPES_PAIEMENT.find(t => t.value === typePaiement)?.label || typePaiement],
                  ...(motif ? [['Notes', motif]] : []),
                ].map(([label, val]) => (
                  <View key={label as string} style={styles.recapLine}>
                    <Text style={styles.recapLabel}>{label}</Text>
                    <Text style={styles.recapVal}>{val}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={sauvegarderTransfert}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.saveBtnTxt}>Confirmer le transfert</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.retourBtn} onPress={() => setEtape('produit')}>
                <MaterialCommunityIcons name="arrow-left" size={14} color="#64748b" />
                <Text style={styles.retourTxt}>Retour</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  searchbar: { marginHorizontal: 12, marginVertical: 8, borderRadius: 10, elevation: 1 },

  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardDate: { color: '#94a3b8', fontSize: 11 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: '#1a56db' },

  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1a56db' },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  modalClose: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalBody: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },

  // Étapes
  stepsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingVertical: 10, backgroundColor: '#1a56db' },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#fff', width: 24, borderRadius: 5 },
  stepDotDone: { backgroundColor: 'rgba(255,255,255,0.6)' },

  stepLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginBottom: 10, marginTop: 4 },

  // Boutique
  boutiqueItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1.5, borderColor: '#e2e8f0' },
  boutiqueItemSelected: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  boutiqueNom: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0f172a' },

  // Produit
  produitItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 10, padding: 10, marginBottom: 5, borderWidth: 1.5, borderColor: '#e2e8f0' },
  produitItemSelected: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  produitNom: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  produitStock: { fontSize: 11, color: '#64748b', marginTop: 1 },

  searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a', marginBottom: 12 },

  // Récap
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  recapTxt: { fontSize: 13, color: '#065f46' },
  recapCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  recapLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  recapLabel: { fontSize: 13, color: '#64748b' },
  recapVal: { fontSize: 13, fontWeight: '600', color: '#0f172a', flex: 1, textAlign: 'right' },

  retourBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, padding: 8, alignSelf: 'flex-start' },
  retourTxt: { fontSize: 13, color: '#64748b' },

  saveBtn: { backgroundColor: '#1a56db', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8, marginBottom: 4 },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Type paiement
  typePaiementRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typePaiementBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#fff' },
  typePaiementBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  typePaiementBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  typePaiementBtnTextActive: { color: '#fff' },
});

const accuseStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#1a56db',
    padding: 24,
    alignItems: 'center',
  },
  icon: { fontSize: 44, marginBottom: 8 },
  titre: { fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  soustitre: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  body: { padding: 16, maxHeight: 300 },
  infoRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  infoLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 13, color: '#111827', marginTop: 2 },
  sectionTitre: { fontWeight: '700', fontSize: 13, marginBottom: 8, color: '#374151' },
  produit: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f4ff',
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1a56db',
  },
  produitNom: { fontWeight: '600', fontSize: 13, color: '#1e40af', flex: 1 },
  produitBadge: {
    backgroundColor: '#1a56db',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  produitQte: { color: '#fff', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', padding: 12, gap: 10 },
  btnAccepter: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnRejeter: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnTexte: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  motifInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    minHeight: 60,
    textAlignVertical: 'top',
    color: '#374151',
  },
});
