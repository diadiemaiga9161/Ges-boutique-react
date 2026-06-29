import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Searchbar, ActivityIndicator, Chip, Button } from 'react-native-paper';
import { getProduits } from '../services/api.service';
import { getNiveaux, decomposer } from '../services/produit-niveau.service';
import { Produit } from '../types';
import { ProduitNiveau } from '../services/produit-niveau.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { IconButton } from 'react-native-paper';

export default function InventaireScreen() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<'tous' | 'faible' | 'rupture' | 'niveaux'>('tous');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Niveaux
  const [niveauxMap, setNiveauxMap] = useState<{ [id: number]: ProduitNiveau[] }>({});
  const [niveauxLoading, setNiveauxLoading] = useState<{ [id: number]: boolean }>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [searchNiveaux, setSearchNiveaux] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const charger = async () => {
    try {
      const res = await getProduits();
      const data = res.data?.data || res.data || [];
      setProduits(data);
      appliquerFiltres(data, filtre, search);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  const appliquerFiltres = (data: Produit[], f: string, s: string) => {
    if (f === 'niveaux') { setFiltered(data); return; }
    let result = data;
    if (f === 'faible') result = result.filter(p => p.quantite > 0 && p.quantite <= (p.seuilAlerte || 5));
    if (f === 'rupture') result = result.filter(p => p.quantite === 0);
    if (s) result = result.filter(p => p.nom.toLowerCase().includes(s.toLowerCase()));
    setFiltered(result);
  };

  useEffect(() => { charger(); }, []);
  useEffect(() => { appliquerFiltres(produits, filtre, search); }, [filtre, search, produits]);

  const valeurTotale = produits.reduce((s, p) => s + p.prixAchat * p.quantite, 0);
  const ruptures = produits.filter(p => p.quantite === 0).length;
  const stockFaible = produits.filter(p => p.quantite > 0 && p.quantite <= (p.seuilAlerte || 5)).length;

  const couleurStock = (p: Produit) => {
    if (p.quantite === 0) return '#f44336';
    if (p.quantite <= (p.seuilAlerte || 5)) return '#ff9800';
    return '#4caf50';
  };

  const toggleNiveaux = async (produit: Produit) => {
    if (expanded === produit.id) { setExpanded(null); return; }
    setExpanded(produit.id);
    if (!niveauxMap[produit.id]) {
      setNiveauxLoading(prev => ({ ...prev, [produit.id]: true }));
      try {
        const niveaux = await getNiveaux(produit.id);
        setNiveauxMap(prev => ({ ...prev, [produit.id]: niveaux }));
      } catch { }
      setNiveauxLoading(prev => ({ ...prev, [produit.id]: false }));
    }
  };

  const handleDecomposer = async (niveau: ProduitNiveau, produit: Produit) => {
    try {
      const res = await decomposer(niveau.id!);
      setNiveauxMap(prev => ({ ...prev, [produit.id]: res.niveaux }));
      setProduits(prev => prev.map(p => p.id === produit.id ? { ...p, quantite: res.produitQuantite } : p));
      Alert.alert('✓', res.message || 'Décomposition effectuée');
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Décomposition impossible');
    }
  };

  const couleurNiveau = (n: ProduitNiveau) => {
    const s = n.stock ?? 0;
    if (s === 0) return '#f44336';
    if (s <= 5) return '#ff9800';
    return '#4caf50';
  };

  const produitsFiltresNiveaux = produits.filter(p =>
    !searchNiveaux || p.nom.toLowerCase().includes(searchNiveaux.toLowerCase())
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiVal}>{produits.length}</Text>
          <Text style={styles.kpiLabel}>Produits</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#fff3e0' }]}>
          <Text style={[styles.kpiVal, { color: '#ff9800' }]}>{stockFaible}</Text>
          <Text style={styles.kpiLabel}>Stock bas</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#ffebee' }]}>
          <Text style={[styles.kpiVal, { color: '#f44336' }]}>{ruptures}</Text>
          <Text style={styles.kpiLabel}>Ruptures</Text>
        </View>
      </View>
      <Text style={styles.valeur}>Valeur stock : {valeurTotale.toLocaleString('fr-FR')} FCFA</Text>

      <View style={styles.filtreRow}>
        {(['tous', 'faible', 'rupture', 'niveaux'] as const).map(f => (
          <Chip key={f} selected={filtre === f} onPress={() => setFiltre(f)} style={styles.filtreChip}>
            {f === 'tous' ? 'Tous' : f === 'faible' ? 'Stock bas' : f === 'rupture' ? 'Rupture' : '📦 Niveaux'}
          </Chip>
        ))}
      </View>

      {filtre === 'niveaux' ? (
        /* ─── Vue Niveaux ─── */
        <FlatList
          data={produitsFiltresNiveaux}
          keyExtractor={p => String(p.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
          ListHeaderComponent={
            <Searchbar placeholder="Rechercher un produit..." value={searchNiveaux}
                       onChangeText={setSearchNiveaux} style={{ margin: 12 }} />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.pnCard}>
              <TouchableOpacity style={styles.pnHeader} onPress={() => toggleNiveaux(item)} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pnNom}>{item.nom}</Text>
                  <Text style={styles.pnStock}>Stock : {item.quantite}</Text>
                </View>
                <Text style={{ fontSize: 18 }}>{expanded === item.id ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expanded === item.id && (
                <View style={styles.pnBody}>
                  {niveauxLoading[item.id] ? (
                    <ActivityIndicator size="small" style={{ padding: 12 }} />
                  ) : !niveauxMap[item.id]?.length ? (
                    <Text style={styles.pnEmpty}>Aucun niveau de conditionnement</Text>
                  ) : (
                    niveauxMap[item.id].map((niveau, i) => (
                      <View key={niveau.id} style={styles.niveauRow}>
                        <View style={styles.niveauInfo}>
                          <View style={[styles.niveauBadge, { backgroundColor: couleurNiveau(niveau) }]}>
                            <Text style={styles.niveauBadgeText}>{niveau.stock ?? 0}</Text>
                          </View>
                          <View>
                            <Text style={styles.niveauNom}>{niveau.nom}</Text>
                            <Text style={styles.niveauFacteur}>
                              1 {i === 0 ? item.nom : niveauxMap[item.id][i - 1].nom} = {niveau.facteur} {niveau.nom}
                            </Text>
                          </View>
                        </View>
                        <Button mode="outlined" compact
                                onPress={() => handleDecomposer(niveau, item)}
                                style={styles.decompBtn}>
                          ✂ Prendre 1 {i === 0 ? item.nom : niveauxMap[item.id][i - 1].nom}
                        </Button>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
        />
      ) : (
        /* ─── Vue stock normale ─── */
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 4 }}>
            <Searchbar placeholder="Rechercher..." value={search} onChangeText={setSearch} style={[styles.search, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]} />
            <IconButton icon="barcode-scan" size={26} iconColor="#1a56db" onPress={() => setShowScanner(true)} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={p => String(p.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.row}>
                    <Text variant="titleMedium" style={{ flex: 1 }}>{item.nom}</Text>
                    <View style={[styles.badge, { backgroundColor: couleurStock(item) }]}>
                      <Text style={styles.badgeText}>{item.quantite}</Text>
                    </View>
                  </View>
                  <Text style={styles.sub}>Achat : {item.prixAchat} FCFA | Valeur : {(item.prixAchat * item.quantite).toLocaleString('fr-FR')} FCFA</Text>
                </Card.Content>
              </Card>
            )}
          />
        </>
      )}
      <BarcodeScannerModal
        visible={showScanner}
        title="Scanner un produit"
        onScan={code => {
          setShowScanner(false);
          setSearch(code);
        }}
        onClose={() => setShowScanner(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  kpiRow: { flexDirection: 'row', padding: 12, gap: 8 },
  kpi: { flex: 1, backgroundColor: '#e3f2fd', borderRadius: 12, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: 'bold', color: '#1a56db' },
  kpiLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  valeur: { textAlign: 'center', color: '#1a56db', fontWeight: '600', marginBottom: 8 },
  filtreRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  filtreChip: { borderRadius: 20 },
  search: { marginHorizontal: 12, marginBottom: 4 },
  card: { marginBottom: 8, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  sub: { color: '#666', fontSize: 12, marginTop: 4 },

  // Niveaux styles
  pnCard: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 10, borderRadius: 12, overflow: 'hidden', elevation: 2 },
  pnHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#f8f9fa' },
  pnNom: { fontWeight: 'bold', fontSize: 15, color: '#1a1a1a' },
  pnStock: { color: '#666', fontSize: 12, marginTop: 2 },
  pnBody: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  pnEmpty: { color: '#999', fontSize: 13, textAlign: 'center', padding: 12 },
  niveauRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  niveauInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  niveauBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, minWidth: 36, alignItems: 'center' },
  niveauBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  niveauNom: { fontWeight: '600', fontSize: 14, color: '#1a1a1a' },
  niveauFacteur: { color: '#888', fontSize: 12 },
  decompBtn: { alignSelf: 'flex-start' },
});
