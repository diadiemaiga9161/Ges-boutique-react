import { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import {
  Text, Card, Searchbar, ActivityIndicator, Chip, Button, FAB, Portal, Modal,
  TextInput, IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { getProduits, getMouvements, ajouterMouvement } from '../services/api.service';
import { getNiveaux, decomposer } from '../services/produit-niveau.service';
import { Produit } from '../types';
import { ProduitNiveau } from '../services/produit-niveau.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

type FiltrePrincipal = 'tous' | 'faible' | 'rupture' | 'niveaux' | 'mouvements';
type TypeMouvement = 'TOUS' | 'ENTREE' | 'SORTIE' | 'AJUSTEMENT';
type FiltrePeriode = 'tout' | 'aujourd_hui' | 'semaine' | 'mois';

function getPeriodeDates(p: FiltrePeriode): { dateDebut?: string; dateFin?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (p === 'aujourd_hui') {
    return { dateDebut: fmt(now), dateFin: fmt(now) };
  }
  if (p === 'semaine') {
    const debut = new Date(now);
    debut.setDate(now.getDate() - 6);
    return { dateDebut: fmt(debut), dateFin: fmt(now) };
  }
  if (p === 'mois') {
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateDebut: fmt(debut), dateFin: fmt(now) };
  }
  return {};
}

export default function InventaireScreen() {
  const { lang } = useLang();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<FiltrePrincipal>('tous');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Niveaux
  const [niveauxMap, setNiveauxMap] = useState<{ [id: number]: ProduitNiveau[] }>({});
  const [niveauxLoading, setNiveauxLoading] = useState<{ [id: number]: boolean }>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [searchNiveaux, setSearchNiveaux] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  // Mouvements
  const [mouvements, setMouvements] = useState<any[]>([]);
  const [mouvementsFiltered, setMouvementsFiltered] = useState<any[]>([]);
  const [loadingMouvements, setLoadingMouvements] = useState(false);
  const [filtreType, setFiltreType] = useState<TypeMouvement>('TOUS');
  const [filtrePeriode, setFiltrePeriode] = useState<FiltrePeriode>('tout');

  // Modal ajout mouvement
  const [showMouvModal, setShowMouvModal] = useState(false);
  const [showProduitPicker, setShowProduitPicker] = useState(false);
  const [mouvForm, setMouvForm] = useState({
    produitId: 0,
    produitNom: '',
    typeMouvement: 'ENTREE' as 'ENTREE' | 'SORTIE' | 'AJUSTEMENT',
    quantite: '',
    motif: '',
    typeSortie: 'DETAIL',
  });

  const charger = async () => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await getProduits();
      const data = res.data?.data || res.data || [];
      setProduits(data);
      appliquerFiltres(data, filtre, search);
      setFromCache(false);
      sauvegarderCache('inventaire_produits', data).catch(() => {});
    } catch {
      const cached = await lireCache<Produit>('inventaire_produits');
      if (cached.length > 0) {
        setProduits(cached);
        appliquerFiltres(cached, filtre, search);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  const chargerMouvements = useCallback(async (periode: FiltrePeriode) => {
    setLoadingMouvements(true);
    try {
      const params = getPeriodeDates(periode);
      const res = await getMouvements(params);
      const data: any[] = res.data?.data || res.data || [];
      setMouvements(data);
      appliquerFiltresMouvements(data, filtreType);
    } catch {
      setMouvements([]);
      setMouvementsFiltered([]);
    }
    setLoadingMouvements(false);
  }, [filtreType]);

  const appliquerFiltresMouvements = (data: any[], type: TypeMouvement) => {
    if (type === 'TOUS') {
      setMouvementsFiltered(data);
    } else {
      setMouvementsFiltered(data.filter(m => m.typeMouvement === type));
    }
  };

  const appliquerFiltres = (data: Produit[], f: string, s: string) => {
    if (f === 'niveaux' || f === 'mouvements') { setFiltered(data); return; }
    let result = data;
    if (f === 'faible') result = result.filter(p => p.quantite > 0 && p.quantite <= (p.seuilAlerte || 5));
    if (f === 'rupture') result = result.filter(p => p.quantite === 0);
    if (s) result = result.filter(p => p.nom.toLowerCase().includes(s.toLowerCase()));
    setFiltered(result);
  };

  useEffect(() => { charger(); }, []);

  useEffect(() => {
    appliquerFiltres(produits, filtre, search);
    if (filtre === 'mouvements') {
      chargerMouvements(filtrePeriode);
    }
  }, [filtre, search, produits]);

  useEffect(() => {
    appliquerFiltresMouvements(mouvements, filtreType);
  }, [filtreType, mouvements]);

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
      Alert.alert(tr('succes', lang), res.message || tr('succes', lang));
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.message || tr('erreur', lang));
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

  const couleurTypeMouvement = (type: string) => {
    if (type === 'ENTREE') return '#16a34a';
    if (type === 'SORTIE') return '#dc2626';
    return '#d97706';
  };

  const iconTypeMouvement = (type: string) => {
    if (type === 'ENTREE') return 'arrow-down-circle';
    if (type === 'SORTIE') return 'arrow-up-circle';
    return 'swap-horizontal';
  };

  const enregistrerMouvement = async () => {
    if (!mouvForm.produitId) { Alert.alert(tr('erreur', lang), tr('selectionner_produit', lang)); return; }
    if (!mouvForm.quantite || isNaN(Number(mouvForm.quantite)) || Number(mouvForm.quantite) <= 0) {
      Alert.alert(tr('erreur', lang), tr('quantite', lang)); return;
    }
    try {
      const quantite = parseFloat(mouvForm.quantite);
      const { produitId, typeMouvement, motif, typeSortie } = mouvForm;
      let res: { success: boolean; offline: boolean; result?: any };
      if (typeMouvement === 'ENTREE') {
        const payload = { produitId, quantite, motif };
        res = await executerOuMettreEnFile(
          'mouvement_entree',
          payload,
          () => ajouterMouvement({ ...payload, typeMouvement: 'ENTREE' })
        );
      } else if (typeMouvement === 'SORTIE') {
        const payload = { produitId, quantite, motif, typeSortie };
        res = await executerOuMettreEnFile(
          'mouvement_sortie',
          payload,
          () => ajouterMouvement({ ...payload, typeMouvement: 'SORTIE' })
        );
      } else {
        // AJUSTEMENT
        const payload = { produitId, nouvelleQuantite: quantite, motif };
        res = await executerOuMettreEnFile(
          'mouvement_ajustement',
          payload,
          () => ajouterMouvement({ produitId, quantite, motif, typeMouvement: 'AJUSTEMENT' })
        );
      }
      setShowMouvModal(false);
      setMouvForm({ produitId: 0, produitNom: '', typeMouvement: 'ENTREE', quantite: '', motif: '', typeSortie: 'DETAIL' });
      if (!res.offline) chargerMouvements(filtrePeriode);
      Alert.alert(
        tr('succes', lang),
        res.offline
          ? 'Mouvement sauvegardé — synchronisation au retour connexion'
          : tr('enregistrer', lang)
      );
    } catch {
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  const onChangePeriode = (p: FiltrePeriode) => {
    setFiltrePeriode(p);
    chargerMouvements(p);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {/* KPI row — fond #081648 */}
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiVal}>{produits.length}</Text>
          <Text style={styles.kpiLabel}>{tr('produits', lang)}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={[styles.kpiVal, { color: '#fbbf24' }]}>{stockFaible}</Text>
          <Text style={styles.kpiLabel}>{tr('stock_bas', lang)}</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={[styles.kpiVal, { color: '#f87171' }]}>{ruptures}</Text>
          <Text style={styles.kpiLabel}>{tr('ruptures', lang)}</Text>
        </View>
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <Text style={styles.valeur}>{tr('valeur_stock', lang)} : {valeurTotale.toLocaleString('fr-FR')} FCFA</Text>

      <View style={styles.filtreRow}>
        {(['tous', 'faible', 'rupture', 'niveaux', 'mouvements'] as const).map(f => (
          <Chip key={f} selected={filtre === f} onPress={() => setFiltre(f)} style={styles.filtreChip}>
            {f === 'tous' ? 'Tous' : f === 'faible' ? tr('stock_bas', lang) : f === 'rupture' ? tr('en_rupture', lang) : f === 'niveaux' ? tr('niveaux', lang) : tr('mouvements', lang)}
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
            <Searchbar placeholder={tr('recherche_produit', lang)} value={searchNiveaux}
                       onChangeText={setSearchNiveaux} style={{ margin: 12 }} />
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="package-variant" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Aucun produit</Text>
              <Text style={styles.emptySub}>Aucun produit ne correspond à la recherche</Text>
            </View>
          }
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
                    <Text style={styles.pnEmpty}>{tr('aucun_resultat', lang)}</Text>
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
                          Prendre 1 {i === 0 ? item.nom : niveauxMap[item.id][i - 1].nom}
                        </Button>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
          )}
        />
      ) : filtre === 'mouvements' ? (
        /* ─── Vue Mouvements ─── */
        <View style={{ flex: 1 }}>
          {/* Filtre type */}
          <View style={styles.sousFiltreRow}>
            {(['TOUS', 'ENTREE', 'SORTIE', 'AJUSTEMENT'] as TypeMouvement[]).map(t => (
              <Chip
                key={t}
                selected={filtreType === t}
                onPress={() => setFiltreType(t)}
                style={[styles.filtreChip, filtreType === t && t !== 'TOUS' && { backgroundColor: couleurTypeMouvement(t) + '22' }]}
                selectedColor={t === 'TOUS' ? '#1a56db' : couleurTypeMouvement(t)}
              >
                {t === 'TOUS' ? 'Tous' : t}
              </Chip>
            ))}
          </View>
          {/* Filtre période */}
          <View style={styles.sousFiltreRow}>
            {([
              { val: 'tout' as FiltrePeriode, label: 'Tout' },
              { val: 'aujourd_hui' as FiltrePeriode, label: "Aujourd'hui" },
              { val: 'semaine' as FiltrePeriode, label: 'Semaine' },
              { val: 'mois' as FiltrePeriode, label: 'Mois' },
            ]).map(({ val, label }) => (
              <Chip
                key={val}
                selected={filtrePeriode === val}
                onPress={() => onChangePeriode(val)}
                style={styles.filtreChip}
              >
                {label}
              </Chip>
            ))}
          </View>

          {loadingMouvements ? (
            <ActivityIndicator style={{ flex: 1 }} size="large" />
          ) : (
            <FlatList
              data={mouvementsFiltered}
              keyExtractor={(m, i) => String(m.id ?? i)}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); chargerMouvements(filtrePeriode).finally(() => setRefreshing(false)); }}
                />
              }
              contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="swap-horizontal-bold" size={64} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>{tr('aucun_mouvement', lang)}</Text>
                  <Text style={styles.emptySub}>Aucun mouvement pour cette période</Text>
                </View>
              }
              renderItem={({ item }) => (
                <Card style={styles.card}>
                  <Card.Content style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: couleurTypeMouvement(item.typeMouvement) + '22' }]}>
                      <MaterialCommunityIcons
                        name={iconTypeMouvement(item.typeMouvement) as any}
                        size={22}
                        color={couleurTypeMouvement(item.typeMouvement)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.produit?.nom || item.produitNom || '—'}
                      </Text>
                      <Text style={styles.cardSub}>
                        {item.dateMouvement ? new Date(item.dateMouvement).toLocaleDateString('fr-FR') : '—'}
                        {item.motif ? ` · ${item.motif}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.typeBadge, { backgroundColor: couleurTypeMouvement(item.typeMouvement) }]}>
                        <Text style={styles.typeBadgeText}>{item.typeMouvement}</Text>
                      </View>
                      <Text style={{ fontWeight: 'bold', fontSize: 15, color: couleurTypeMouvement(item.typeMouvement), marginTop: 4 }}>
                        {item.typeMouvement === 'ENTREE' ? '+' : item.typeMouvement === 'SORTIE' ? '-' : ''}{item.quantite}
                      </Text>
                    </View>
                  </Card.Content>
                </Card>
              )}
            />
          )}

          {/* FAB ajout mouvement */}
          <FAB
            icon="plus"
            style={styles.fab}
            onPress={() => {
              setMouvForm({ produitId: 0, produitNom: '', typeMouvement: 'ENTREE', quantite: '', motif: '', typeSortie: 'DETAIL' });
              setShowProduitPicker(false);
              setShowMouvModal(true);
            }}
          />

          {/* Modal ajout mouvement */}
          <Portal>
            <Modal
              visible={showMouvModal}
              onDismiss={() => setShowMouvModal(false)}
              contentContainerStyle={styles.modal}
            >
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('nouveau_mouvement', lang)}</Text>

                {/* Sélecteur produit */}
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowProduitPicker(v => !v)}
                >
                  <Text style={mouvForm.produitNom ? styles.pickerVal : styles.pickerPh}>
                    {mouvForm.produitNom || tr('selectionner_produit', lang)}
                  </Text>
                  <Text style={{ color: '#94a3b8' }}>{showProduitPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showProduitPicker && (
                  <View style={styles.pickerList}>
                    {produits.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setMouvForm({ ...mouvForm, produitId: p.id, produitNom: p.nom });
                          setShowProduitPicker(false);
                        }}
                      >
                        <Text style={[styles.pickerItemText, mouvForm.produitId === p.id && { color: '#1a56db', fontWeight: 'bold' }]}>
                          {p.nom}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Type mouvement */}
                <Text style={styles.inputLabel}>{tr('type_mouvement', lang)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(['ENTREE', 'SORTIE', 'AJUSTEMENT'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeBtn,
                        mouvForm.typeMouvement === t && { backgroundColor: couleurTypeMouvement(t), borderColor: couleurTypeMouvement(t) },
                      ]}
                      onPress={() => setMouvForm({ ...mouvForm, typeMouvement: t, typeSortie: 'DETAIL' })}
                    >
                      <Text style={[styles.typeBtnText, mouvForm.typeMouvement === t && { color: '#fff' }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Type de sortie — visible uniquement pour SORTIE */}
                {mouvForm.typeMouvement === 'SORTIE' && (
                  <>
                    <Text style={styles.inputLabel}>Type de sortie</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {([
                        { val: 'DETAIL', label: 'Détail' },
                        { val: 'CONSOMMATION', label: 'Consommation' },
                        { val: 'UTILISATION', label: 'Utilisation' },
                        { val: 'PERTE', label: 'Perte' },
                        { val: 'AUTRE', label: 'Autre' },
                      ] as const).map(({ val, label }) => (
                        <TouchableOpacity
                          key={val}
                          style={[styles.typeBtn, mouvForm.typeSortie === val && { backgroundColor: '#1a56db', borderColor: '#1a56db' }]}
                          onPress={() => setMouvForm({ ...mouvForm, typeSortie: val })}
                        >
                          <Text style={[styles.typeBtnText, mouvForm.typeSortie === val && { color: '#fff' }]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                <TextInput
                  label={tr('quantite', lang) + ' *'}
                  value={mouvForm.quantite}
                  onChangeText={t => setMouvForm({ ...mouvForm, quantite: t })}
                  mode="outlined"
                  keyboardType="numeric"
                  style={styles.input}
                />
                <TextInput
                  label={tr('raison', lang)}
                  value={mouvForm.motif}
                  onChangeText={t => setMouvForm({ ...mouvForm, motif: t })}
                  mode="outlined"
                  style={styles.input}
                />
                <Button mode="contained" onPress={enregistrerMouvement} style={{ marginTop: 4 }}>
                  {tr('enregistrer', lang)}
                </Button>
              </ScrollView>
            </Modal>
          </Portal>
        </View>
      ) : (
        /* ─── Vue stock normale ─── */
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 4 }}>
            <Searchbar
              placeholder={tr('recherche_produit', lang)}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchBar, { flex: 1, marginHorizontal: 0, marginBottom: 0 }]}
            />
            <IconButton icon="barcode-scan" size={26} iconColor="#1a56db" onPress={() => setShowScanner(true)} />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={p => String(p.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
            contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name={filtre === 'rupture' ? 'package-variant-closed-remove' : 'package-variant'}
                  size={64}
                  color="#cbd5e1"
                />
                <Text style={styles.emptyTitle}>
                  {filtre === 'rupture' ? 'Aucune rupture' : filtre === 'faible' ? 'Aucun stock faible' : 'Aucun produit'}
                </Text>
                <Text style={styles.emptySub}>
                  {filtre === 'rupture' ? 'Tous les produits ont du stock' : 'Aucun produit disponible'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <Card.Content style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: couleurStock(item) + '22' }]}>
                    <MaterialCommunityIcons name="package-variant" size={22} color={couleurStock(item)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{item.nom}</Text>
                    <Text style={styles.cardSub}>
                      Achat : {item.prixAchat.toLocaleString('fr-FR')} FCFA | Valeur : {(item.prixAchat * item.quantite).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: couleurStock(item) }]}>
                    <Text style={styles.badgeText}>{item.quantite}</Text>
                  </View>
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

  // KPI row — fond #081648
  kpiRow: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  kpi: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  kpiLabel: { fontSize: 11, color: '#93c5fd', marginTop: 2 },

  // Offline
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  valeur: { textAlign: 'center', color: '#1a56db', fontWeight: '600', marginVertical: 8 },
  filtreRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  sousFiltreRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  filtreChip: { borderRadius: 20 },
  searchBar: { marginHorizontal: 12, marginBottom: 4 },

  // Design system cards
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },

  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { color: '#fff', fontWeight: 'bold' },

  // Empty states
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: '#1a56db' },

  // Mouvements
  typeBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  typeBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Modal mouvement
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20, maxHeight: '85%' },
  inputLabel: { color: '#475569', fontSize: 13, marginBottom: 6 },
  input: { marginBottom: 12 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#94a3b8', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 8, backgroundColor: '#fff' },
  pickerVal: { color: '#1e293b', fontSize: 14 },
  pickerPh: { color: '#94a3b8', fontSize: 14 },
  pickerList: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 180 },
  pickerItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerItemText: { color: '#334155', fontSize: 13 },
  typeBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  typeBtnText: { color: '#374151', fontSize: 11, fontWeight: '600' },

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
