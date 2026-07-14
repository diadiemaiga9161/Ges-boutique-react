import React, { useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert,
  Modal, ScrollView, TextInput, TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, ActivityIndicator, FAB, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import api, { getBoutiques, getProduits, createTransfert } from '../services/api.service';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

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
  const [searchProduit, setSearchProduit] = useState('');
  const [etape, setEtape] = useState<'src' | 'dest' | 'produit' | 'confirm'>('src');

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
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

  useEffect(() => { charger(); }, []);

  const ouvrirCreate = async () => {
    setBoutiqueSrc(null);
    setBoutiqueDest(null);
    setProduit(null);
    setQuantite('');
    setMotif('');
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
        motif: motif.trim() || undefined,
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

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
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
                <Chip compact style={{ backgroundColor: couleurStatut(item.statut) }}>
                  <Text style={{ color: '#fff', fontSize: 10 }}>
                    {item.statut?.replace('_', ' ')}
                  </Text>
                </Chip>
                <Text style={styles.cardDate}>
                  {item.dateTransfert
                    ? new Date(item.dateTransfert).toLocaleDateString('fr-FR')
                    : ''}
                </Text>
              </View>
            </Card.Content>
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
                  onPress={() => { setBoutiqueDest(b); setEtape('produit'); }}
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
                  <Text style={styles.stepLabel}>Motif (facultatif) :</Text>
                  <TextInput
                    style={styles.input}
                    value={motif}
                    onChangeText={setMotif}
                    placeholder="Raison du transfert..."
                    placeholderTextColor="#94a3b8"
                  />
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
                  ...(motif ? [['Motif', motif]] : []),
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
});
