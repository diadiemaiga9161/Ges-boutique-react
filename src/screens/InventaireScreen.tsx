import { useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert, ScrollView,
} from 'react-native';
import {
  Text, Card, Searchbar, ActivityIndicator, Chip, Button, FAB, Portal, Modal,
  TextInput, IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { getProduits, getMouvements, getMouvementsParDate, ajouterMouvement } from '../services/api.service';
import { getNiveaux, decomposer } from '../services/produit-niveau.service';
import { Produit } from '../types';
import { ProduitNiveau } from '../services/produit-niveau.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';
import { StockBadge } from '../components/StockBadge';

type FiltrePrincipal = 'tous' | 'faible' | 'rupture' | 'niveaux' | 'mouvements';
// Les 10 types de mouvements réellement produits par le backend (voir
// MouvementStock.typeMouvement / inventory.page.html sur Ionic) — filtrer
// uniquement Entrée/Sortie/Ajustement (comme avant) masquait la grande
// majorité des mouvements réels (ventes, retours, annulations...).
type TypeMouvement = 'TOUS' | 'ENTREE' | 'SORTIE' | 'VENTE' | 'CREDIT' | 'ANNULATION_VENTE'
  | 'ANNULATION_CREDIT' | 'RETOUR' | 'AJUSTEMENT' | 'BONUS_FOURNISSEUR' | 'DECOMPOSITION';

const TYPE_MOUVEMENT_LABELS: Record<TypeMouvement, string> = {
  TOUS: 'Tous', ENTREE: 'Entrée stock', SORTIE: 'Sortie stock', VENTE: 'Vente', CREDIT: 'Crédit',
  ANNULATION_VENTE: 'Annulation vente', ANNULATION_CREDIT: 'Annulation crédit', RETOUR: 'Retour fournisseur',
  AJUSTEMENT: 'Ajustement', BONUS_FOURNISSEUR: 'Bonus Fournisseur', DECOMPOSITION: 'Décomposition',
};

function toIsoDebut(d: string) { return `${d}T00:00:00`; }
function toIsoFin(d: string) { return `${d}T23:59:59`; }
function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function InventaireScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<FiltrePrincipal>('tous');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (!raw) return;
      try {
        const role: string = JSON.parse(raw)?.role || '';
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      } catch {}
    });
  }, []);

  // Niveaux
  const [niveauxMap, setNiveauxMap] = useState<{ [id: number]: ProduitNiveau[] }>({});
  const [niveauxLoading, setNiveauxLoading] = useState<{ [id: number]: boolean }>({});
  const [expanded, setExpanded] = useState<number | null>(null);
  const [searchNiveaux, setSearchNiveaux] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showScannerMouv, setShowScannerMouv] = useState(false);

  // Mouvements
  const [mouvements, setMouvements] = useState<any[]>([]);
  const [mouvementsFiltered, setMouvementsFiltered] = useState<any[]>([]);
  const [loadingMouvements, setLoadingMouvements] = useState(false);
  const [filtreType, setFiltreType] = useState<TypeMouvement>('TOUS');
  const [searchMouvements, setSearchMouvements] = useState('');
  // Par défaut = aujourd'hui, pour ne pas tout charger dès l'ouverture de
  // l'onglet Mouvements — l'utilisateur élargit via Semaine/Mois/Tout ou une
  // période personnalisée (voir filterByPeriod / appliquerDatesManuelles).
  const [dateDebut, setDateDebut] = useState(todayStr());
  const [dateFin, setDateFin] = useState(todayStr());

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
      // Toujours tenter l'appel réel en premier — NetInfo.fetch() peut renvoyer
      // isConnected=null au premier appel et ferait sauter l'appel réel à tort.
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

  // ─── Mouvements : chargement + filtres (type/dates/recherche appliqués
  //     côté client sur le lot chargé, comme applyFilters() sur Ionic). ─────
  const chargerMouvements = useCallback(async (debut: string, fin: string) => {
    setLoadingMouvements(true);
    try {
      const res = (debut && fin)
        ? await getMouvementsParDate(toIsoDebut(debut), toIsoFin(fin))
        : await getMouvements();
      const data: any[] = res.data?.data || res.data || [];
      setMouvements(data);
    } catch {
      setMouvements([]);
    }
    setLoadingMouvements(false);
  }, []);

  const appliquerFiltresMouvements = useCallback((data: any[], type: TypeMouvement, search: string) => {
    let result = data;
    if (type !== 'TOUS') result = result.filter(m => m.typeMouvement === type);
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      result = result.filter(m =>
        (m.produit?.nom || '').toLowerCase().includes(term) ||
        (m.motif || '').toLowerCase().includes(term) ||
        (m.utilisateur?.nomComplet || '').toLowerCase().includes(term)
      );
    }
    setMouvementsFiltered(result);
  }, []);

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
    if (filtre === 'mouvements' && mouvements.length === 0 && !loadingMouvements) {
      chargerMouvements(dateDebut, dateFin);
    }
  }, [filtre, search, produits]);

  useEffect(() => {
    appliquerFiltresMouvements(mouvements, filtreType, searchMouvements);
  }, [filtreType, searchMouvements, mouvements, appliquerFiltresMouvements]);

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

  const produitsFiltresNiveaux = produits.filter(p =>
    !searchNiveaux || p.nom.toLowerCase().includes(searchNiveaux.toLowerCase())
  );

  const couleurTypeMouvement = (type: string) => {
    if (type === 'ENTREE' || type === 'BONUS_FOURNISSEUR') return '#16a34a';
    if (type === 'SORTIE' || type === 'ANNULATION_VENTE' || type === 'ANNULATION_CREDIT') return '#dc2626';
    if (type === 'VENTE' || type === 'CREDIT') return '#1a56db';
    if (type === 'RETOUR' || type === 'DECOMPOSITION') return '#7c3aed';
    return '#d97706'; // AJUSTEMENT et autres
  };

  const iconTypeMouvement = (type: string) => {
    if (type === 'ENTREE' || type === 'BONUS_FOURNISSEUR') return 'arrow-down-circle';
    if (type === 'SORTIE') return 'arrow-up-circle';
    if (type === 'VENTE' || type === 'CREDIT') return 'cart-outline';
    if (type === 'ANNULATION_VENTE' || type === 'ANNULATION_CREDIT') return 'close-circle-outline';
    if (type === 'RETOUR') return 'undo-variant';
    if (type === 'DECOMPOSITION') return 'layers-outline';
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
      if (!res.offline) chargerMouvements(dateDebut, dateFin);
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

  const onCodeScanneMouvement = (code: string) => {
    setShowScannerMouv(false);
    const found = produits.find(p => p.codeBarre === code || p.nom.toLowerCase() === code.toLowerCase());
    if (found) {
      setMouvForm(f => ({ ...f, produitId: found.id, produitNom: found.nom }));
      setShowProduitPicker(false);
    } else {
      Alert.alert('Code scanné', `Code "${code}" non trouvé parmi les produits.`);
    }
  };

  // Filtres période rapide — alimentent dateDebut/dateFin puis relancent le
  // chargement, exactement comme filterByPeriod() sur Ionic.
  const filterByPeriod = (period: 'today' | 'week' | 'month' | 'all') => {
    if (period === 'all') { setDateDebut(''); setDateFin(''); chargerMouvements('', ''); return; }
    const today = new Date();
    const fin = todayStr();
    let debut = fin;
    if (period === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      debut = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      debut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    }
    setDateDebut(debut);
    setDateFin(fin);
    chargerMouvements(debut, fin);
  };

  const appliquerDatesManuelles = () => chargerMouvements(dateDebut, dateFin);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* KPI row — fond #081648 */}
      <View style={[styles.kpiRow, { backgroundColor: colors.hero }]}>
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
        <View style={styles.kpi}>
          <Text style={[styles.kpiVal, { color: '#34d399' }]}>{mouvements.length}</Text>
          <Text style={styles.kpiLabel}>Mouvements</Text>
        </View>
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <Text style={[styles.valeur, { color: colors.primary }]}>{tr('valeur_stock', lang)} : {valeurTotale.toLocaleString('fr-FR')} FCFA</Text>

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
              <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Aucun produit</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Aucun produit ne correspond à la recherche</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.pnCard, { backgroundColor: colors.card }]}>
              <TouchableOpacity style={[styles.pnHeader, { backgroundColor: colors.inputBg }]} onPress={() => toggleNiveaux(item)} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pnNom, { color: colors.text }]}>{item.nom}</Text>
                  <Text style={[styles.pnStock, { color: colors.textSecondary }]}>Stock : {item.quantite}</Text>
                </View>
                <Text style={{ fontSize: 18, color: colors.textSecondary }}>{expanded === item.id ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {expanded === item.id && (
                <View style={[styles.pnBody, { borderTopColor: colors.border }]}>
                  {niveauxLoading[item.id] ? (
                    <ActivityIndicator size="small" style={{ padding: 12 }} />
                  ) : !niveauxMap[item.id]?.length ? (
                    <Text style={[styles.pnEmpty, { color: colors.textSecondary }]}>{tr('aucun_resultat', lang)}</Text>
                  ) : (
                    niveauxMap[item.id].map((niveau, i) => (
                      <View key={niveau.id} style={[styles.niveauRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.niveauInfo}>
                          <StockBadge quantite={niveau.stock ?? 0} seuilAlerte={5} />
                          <View>
                            <Text style={[styles.niveauNom, { color: colors.text }]}>{niveau.nom}</Text>
                            <Text style={[styles.niveauFacteur, { color: colors.textSecondary }]}>
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
          {/* Filtres période rapide + reset */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousFiltreRow}>
            <Button mode="outlined" compact onPress={() => filterByPeriod('today')} style={styles.periodBtn}>Aujourd'hui</Button>
            <Button mode="outlined" compact onPress={() => filterByPeriod('week')} style={styles.periodBtn}>Semaine</Button>
            <Button mode="outlined" compact onPress={() => filterByPeriod('month')} style={styles.periodBtn}>Mois</Button>
            <Button mode="text" compact onPress={() => filterByPeriod('all')} textColor={colors.textSecondary}>Réinitialiser</Button>
          </ScrollView>

          {/* Dates manuelles Du / Au */}
          <View style={styles.datesRow}>
            <TextInput
              mode="outlined"
              label="Du"
              value={dateDebut}
              onChangeText={setDateDebut}
              onBlur={appliquerDatesManuelles}
              placeholder="AAAA-MM-JJ"
              dense
              style={{ flex: 1 }}
            />
            <TextInput
              mode="outlined"
              label="Au"
              value={dateFin}
              onChangeText={setDateFin}
              onBlur={appliquerDatesManuelles}
              placeholder="AAAA-MM-JJ"
              dense
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>

          {/* Filtre type — 10 types, comme Ionic */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sousFiltreRow}>
            {(Object.keys(TYPE_MOUVEMENT_LABELS) as TypeMouvement[]).map(t => (
              <Chip
                key={t}
                selected={filtreType === t}
                onPress={() => setFiltreType(t)}
                style={[styles.filtreChip, filtreType === t && t !== 'TOUS' && { backgroundColor: couleurTypeMouvement(t) + '22' }]}
                selectedColor={t === 'TOUS' ? '#1a56db' : couleurTypeMouvement(t)}
              >
                {TYPE_MOUVEMENT_LABELS[t]}
              </Chip>
            ))}
          </ScrollView>

          {/* Recherche */}
          <Searchbar
            placeholder="Rechercher (produit, motif, utilisateur...)"
            value={searchMouvements}
            onChangeText={setSearchMouvements}
            style={styles.searchBar}
          />

          <Text style={[styles.compteurTxt, { color: colors.textSecondary }]}>{mouvementsFiltered.length} mouvement(s)</Text>

          {loadingMouvements ? (
            <ActivityIndicator style={{ flex: 1 }} size="large" />
          ) : (
            <FlatList
              data={mouvementsFiltered}
              keyExtractor={(m, i) => String(m.id ?? i)}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); chargerMouvements(dateDebut, dateFin).finally(() => setRefreshing(false)); }}
                />
              }
              contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons name="swap-horizontal-bold" size={64} color="#cbd5e1" />
                  <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{tr('aucun_mouvement', lang)}</Text>
                  <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Aucun mouvement pour ces filtres</Text>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                          {item.produit?.nom || item.produitNom || '—'}
                        </Text>
                        {!!item.niveauNom && (
                          <View style={[styles.niveauMouvBadge, { backgroundColor: colors.infoBg }]}>
                            <Text style={[styles.niveauMouvBadgeText, { color: colors.info }]}>{item.niveauNom}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                        {item.dateMouvement ? new Date(item.dateMouvement).toLocaleDateString('fr-FR') : '—'}
                        {(item.utilisateur?.nomComplet || item.utilisateur?.username) ? ` · ${item.utilisateur.nomComplet || item.utilisateur.username}` : ''}
                        {item.motif ? ` · ${item.motif}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={[styles.typeBadge, { backgroundColor: couleurTypeMouvement(item.typeMouvement) }]}>
                        <Text style={styles.typeBadgeText}>{TYPE_MOUVEMENT_LABELS[item.typeMouvement as TypeMouvement] || item.typeMouvement}</Text>
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

          {/* FAB ajout mouvement — admin uniquement, comme le segment "Mouvement"
              masqué au vendeur sur Ionic (*ngIf="!isVendeur") : un vendeur ne doit
              pas pouvoir ajuster le stock librement. */}
          {isAdmin && (
            <FAB
              icon="plus"
              style={styles.fab}
              onPress={() => {
                setMouvForm({ produitId: 0, produitNom: '', typeMouvement: 'ENTREE', quantite: '', motif: '', typeSortie: 'DETAIL' });
                setShowProduitPicker(false);
                setShowMouvModal(true);
              }}
            />
          )}

          {/* Modal ajout mouvement */}
          <Portal>
            <Modal
              visible={showMouvModal}
              onDismiss={() => setShowMouvModal(false)}
              contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}
            >
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text variant="titleLarge" style={{ marginBottom: 16, color: colors.text }}>{tr('nouveau_mouvement', lang)}</Text>

                {/* Sélecteur produit + scan */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.picker, { backgroundColor: colors.inputBg, borderColor: colors.border, flex: 1 }]}
                    onPress={() => setShowProduitPicker(v => !v)}
                  >
                    <Text style={[mouvForm.produitNom ? styles.pickerVal : styles.pickerPh, { color: mouvForm.produitNom ? colors.text : colors.placeholder }]}>
                      {mouvForm.produitNom || tr('selectionner_produit', lang)}
                    </Text>
                    <Text style={{ color: colors.placeholder }}>{showProduitPicker ? '▲' : '▼'}</Text>
                  </TouchableOpacity>
                  <IconButton icon="barcode-scan" size={24} iconColor={colors.primary} onPress={() => setShowScannerMouv(true)} />
                </View>
                {showProduitPicker && (
                  <View style={[styles.pickerList, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                    {produits.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                        onPress={() => {
                          setMouvForm({ ...mouvForm, produitId: p.id, produitNom: p.nom });
                          setShowProduitPicker(false);
                        }}
                      >
                        <Text style={[styles.pickerItemText, { color: colors.text }, mouvForm.produitId === p.id && { color: colors.primary, fontWeight: 'bold' }]}>
                          {p.nom}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Type mouvement */}
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{tr('type_mouvement', lang)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {(['ENTREE', 'SORTIE', 'AJUSTEMENT'] as const).map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.typeBtn,
                        { backgroundColor: colors.inputBg, borderColor: colors.border },
                        mouvForm.typeMouvement === t && { backgroundColor: couleurTypeMouvement(t), borderColor: couleurTypeMouvement(t) },
                      ]}
                      onPress={() => setMouvForm({ ...mouvForm, typeMouvement: t, typeSortie: 'DETAIL' })}
                    >
                      <Text style={[styles.typeBtnText, { color: colors.textSecondary }, mouvForm.typeMouvement === t && { color: '#fff' }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Type de sortie — visible uniquement pour SORTIE */}
                {mouvForm.typeMouvement === 'SORTIE' && (
                  <>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Type de sortie</Text>
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
                          style={[styles.typeBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }, mouvForm.typeSortie === val && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                          onPress={() => setMouvForm({ ...mouvForm, typeSortie: val })}
                        >
                          <Text style={[styles.typeBtnText, { color: colors.textSecondary }, mouvForm.typeSortie === val && { color: '#fff' }]}>{label}</Text>
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

          <BarcodeScannerModal
            visible={showScannerMouv}
            title="Scanner un produit"
            onScan={onCodeScanneMouvement}
            onClose={() => setShowScannerMouv(false)}
          />
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
                <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
                  {filtre === 'rupture' ? 'Aucune rupture' : filtre === 'faible' ? 'Aucun stock faible' : 'Aucun produit'}
                </Text>
                <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
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
                    <Text style={[styles.cardName, { color: colors.text }]}>{item.nom}</Text>
                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
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
  kpiRow: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 4 },
  kpi: { flex: 1, alignItems: 'center' },
  kpiVal: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  kpiLabel: { fontSize: 10, color: '#93c5fd', marginTop: 2 },

  // Offline
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  valeur: { textAlign: 'center', color: '#1a56db', fontWeight: '600', marginVertical: 8 },
  filtreRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  sousFiltreRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 6, alignItems: 'center' },
  periodBtn: { marginRight: 2 },
  datesRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 6 },
  compteurTxt: { paddingHorizontal: 12, fontSize: 12, marginBottom: 4 },
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
  niveauMouvBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  niveauMouvBadgeText: { fontSize: 10, fontWeight: '700' },

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
