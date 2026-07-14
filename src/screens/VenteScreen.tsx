import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Searchbar, ActivityIndicator, Divider, Modal, Portal, TextInput, RadioButton, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getProduits, getClients } from '../services/api.service';
import { getProduitsCache, getClientsCache, cacheProduits } from '../db/database';
import { enregistrerVente, getNombreVentesPending, sauvegarderCache, lireCache } from '../services/offline.service';
import NetInfo from '@react-native-community/netinfo';
import { Produit, Client, LigneVenteRequest } from '../types';
import { ProduitNiveau, getNiveaux, calculerFacteurTotal } from '../services/produit-niveau.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

interface CartItem {
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remisePourcentage: number;
  niveauId?: number;
  niveauNom?: string;
  niveauPrixAchat?: number;
  niveauFacteurTotal?: number;
}

const MODES_PAIEMENT = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'CARTE_BANCAIRE'];

export default function VenteScreen() {
  const { lang } = useLang();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [panier, setPanier] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [modePaiement, setModePaiement] = useState('ESPECES');
  const [clientId, setClientId] = useState<number | null>(null);
  const [montantRecu, setMontantRecu] = useState('');
  const [estCredit, setEstCredit] = useState(false);
  const [ventesPending, setVentesPending] = useState(0);
  const [showScanner, setShowScanner] = useState(false);
  const [offline, setOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Conditionnement
  const [showNiveauModal, setShowNiveauModal] = useState(false);
  const [produitEnAttente, setProduitEnAttente] = useState<Produit | null>(null);
  const [niveauxDisponibles, setNiveauxDisponibles] = useState<ProduitNiveau[]>([]);
  const [loadingNiveaux, setLoadingNiveaux] = useState(false);

  const charger = useCallback(async () => {
    const state = await NetInfo.fetch();
    setOffline(!state.isConnected);
    if (state.isConnected) {
      try {
        const [rP, rC] = await Promise.all([getProduits(), getClients()]);
        const p = rP.data?.data || rP.data || [];
        const c = rC.data?.data || rC.data || [];
        setProduits(p); setClients(c); setFiltered(p);
        setFromCache(false);
        await cacheProduits(p);
        sauvegarderCache('vente_produits', p).catch(() => {});
      } catch {
        const [p, c] = await Promise.all([getProduitsCache(), getClientsCache()]);
        setProduits(p); setClients(c); setFiltered(p);
        setFromCache(p.length > 0);
      }
    } else {
      const [p, c] = await Promise.all([getProduitsCache(), getClientsCache()]);
      setProduits(p); setClients(c); setFiltered(p);
      setFromCache(p.length > 0);
    }
    const n = await getNombreVentesPending();
    setVentesPending(n);
    setLoading(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!search) { setFiltered(produits); return; }
    const q = search.toLowerCase();
    setFiltered(produits.filter(p => p.nom.toLowerCase().includes(q)));
  }, [search, produits]);

  const onCodeScanne = (code: string) => {
    const found = produits.find(p =>
      p.codeBarres === code || p.nom.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      ajouterAuPanier(found);
    } else {
      setSearch(code);
      Alert.alert('Code scanné', `Code "${code}" non trouvé — affiché dans la recherche.`);
    }
  };

  const ajouterAuPanier = async (p: Produit) => {
    setLoadingNiveaux(true);
    try {
      const niveaux: ProduitNiveau[] = await getNiveaux(p.id) || [];
      if (niveaux.length > 0) {
        setNiveauxDisponibles(niveaux);
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

  const ajouterSansNiveau = (p: Produit) => {
    if (p.quantite <= 0) {
      Alert.alert(tr('rupture_stock', lang), `${p.nom} est en rupture de stock.`);
      return;
    }
    setPanier(prev => {
      const idx = prev.findIndex(i => i.produit.id === p.id && !i.niveauId);
      if (idx >= 0) {
        if (prev[idx].quantite >= p.quantite) {
          Alert.alert(tr('stock_insuffisant', lang), `Stock maximum atteint : ${p.quantite} unité(s).`);
          return prev;
        }
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantite: updated[idx].quantite + 1 };
        return updated;
      }
      return [...prev, { produit: p, quantite: 1, prixUnitaire: p.prixVente, remisePourcentage: 0 }];
    });
  };

  const choisirNiveau = (niveau: ProduitNiveau) => {
    const p = produitEnAttente;
    if (!p) return;
    const facteurTotal = niveau.id !== undefined
      ? calculerFacteurTotal(niveauxDisponibles, niveau.id, true)
      : calculerFacteurTotal(niveauxDisponibles, niveau.ordre ?? 1, false);
    setShowNiveauModal(false);
    setProduitEnAttente(null);
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
        prixUnitaire: niveau.prixVente,
        remisePourcentage: 0,
        niveauId: niveau.id,
        niveauNom: niveau.nom,
        niveauPrixAchat: niveau.prixAchat,
        niveauFacteurTotal: facteurTotal,
      }];
    });
  };

  const modifierQte = (id: number, delta: number) => {
    setPanier(prev => {
      const item = prev.find(i => i.produit.id === id);
      if (item && delta > 0 && item.quantite >= item.produit.quantite) {
        Alert.alert(tr('stock_insuffisant', lang), `Stock maximum : ${item.produit.quantite} unité(s).`);
        return prev;
      }
      return prev
        .map(i => i.produit.id === id ? { ...i, quantite: i.quantite + delta } : i)
        .filter(i => i.quantite > 0);
    });
  };

  const total = panier.reduce((s, i) => s + i.prixUnitaire * i.quantite * (1 - i.remisePourcentage / 100), 0);
  const monnaie = montantRecu ? parseFloat(montantRecu) - total : 0;

  const mettreAJourStockLocal = (panierVendu: CartItem[]) => {
    setProduits(prev => {
      const updated = prev.map(p => {
        const ligne = panierVendu.find(i => i.produit.id === p.id);
        if (!ligne) return p;
        return { ...p, quantite: Math.max(0, p.quantite - ligne.quantite) };
      });
      cacheProduits(updated);
      return updated;
    });
    setFiltered(prev => {
      const updated = prev.map(p => {
        const ligne = panierVendu.find(i => i.produit.id === p.id);
        if (!ligne) return p;
        return { ...p, quantite: Math.max(0, p.quantite - ligne.quantite) };
      }).filter(p => p.quantite > 0);
      return updated;
    });
  };

  const valider = async () => {
    if (panier.length === 0) return;
    for (const item of panier) {
      if (!item.niveauId && item.quantite > item.produit.quantite) {
        Alert.alert(tr('stock_insuffisant', lang), `${item.produit.nom} : demandé ${item.quantite}, disponible ${item.produit.quantite}`);
        return;
      }
    }
    const lignes: LigneVenteRequest[] = panier.map(i => ({
      produitId: i.produit.id,
      quantite: i.quantite,
      prixUnitaire: i.prixUnitaire,
      remisePourcentage: i.remisePourcentage,
      prixAchat: i.niveauPrixAchat || i.produit.prixAchat,
      niveauId: i.niveauId,
      niveauNom: i.niveauNom,
      niveauFacteur: i.niveauFacteurTotal || 1,
    }));
    const vente = {
      lignes,
      modePaiement,
      clientId: clientId || undefined,
      montantRecu: montantRecu ? parseFloat(montantRecu) : total,
      estCredit,
    };
    const panierSnapshot = [...panier];
    const result = await enregistrerVente(vente);
    if (result.success) {
      mettreAJourStockLocal(panierSnapshot);
      const msg = result.offline
        ? tr('vente_hors_ligne', lang)
        : tr('vente_enregistree', lang);
      Alert.alert(result.offline ? tr('hors_ligne', lang) : tr('succes', lang), msg);
      setPanier([]);
      setShowCheckout(false);
      setMontantRecu('');
      const n = await getNombreVentesPending();
      setVentesPending(n);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Stat bar */}
      <View style={styles.statBar}>
        <View style={styles.statItem}>
          <Text style={styles.statVal}>{panier.length}</Text>
          <Text style={styles.statLbl}>articles</Text>
        </View>
        <View style={styles.statSep} />
        <View style={styles.statItem}>
          <Text style={[styles.statVal, { color: '#1a56db' }]}>{total.toLocaleString('fr-FR')} F</Text>
          <Text style={styles.statLbl}>total panier</Text>
        </View>
        {ventesPending > 0 && (
          <>
            <View style={styles.statSep} />
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: '#d97706', fontSize: 14 }]}>{ventesPending}</Text>
              <Text style={styles.statLbl}>en attente</Text>
            </View>
          </>
        )}
      </View>

      {/* Bandeau hors-ligne réseau */}
      {offline && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#fff" />
          <Text style={styles.offlineText}>{tr('hors_ligne', lang)} — ventes sauvegardées localement</Text>
        </View>
      )}

      {/* Bandeau catalogue depuis cache */}
      {fromCache && (
        <View style={styles.cacheBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.cacheTxt}>Mode hors ligne — catalogue local</Text>
        </View>
      )}

      <View style={styles.body}>
        {/* Liste produits */}
        <View style={styles.left}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Searchbar
              placeholder={tr('recherche_produit', lang)}
              value={search}
              onChangeText={setSearch}
              style={[styles.search, { flex: 1 }]}
            />
            <IconButton icon="barcode-scan" size={26} iconColor="#1a56db" onPress={() => setShowScanner(true)} />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="magnify-close" size={56} color="#cbd5e1" />
                <Text style={styles.emptyTxt}>Aucun produit trouvé</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.prodCard} onPress={() => ajouterAuPanier(item)}>
                <Card.Content style={styles.prodCardRow}>
                  <View style={[styles.prodAvatar, { backgroundColor: item.quantite === 0 ? '#fee2e2' : '#1a56db22' }]}>
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={20}
                      color={item.quantite === 0 ? '#dc2626' : '#1a56db'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName} numberOfLines={1}>{item.nom}</Text>
                    <Text style={styles.prodSub}>
                      {item.prixVente?.toLocaleString('fr-FR')} FCFA · Stock: {item.quantite}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="plus-circle" size={28} color="#1a56db" />
                </Card.Content>
              </Card>
            )}
          />
        </View>

        {/* Panier */}
        <View style={styles.right}>
          <Text variant="titleMedium" style={styles.panierTitle}>{tr('panier', lang)} ({panier.length})</Text>
          <FlatList
            data={panier}
            keyExtractor={i => `${i.produit.id}_${i.niveauId ?? 'base'}`}
            renderItem={({ item }) => (
              <View style={styles.panierItem}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: '#1e293b', fontWeight: '500' }}>{item.produit.nom}</Text>
                  {item.niveauNom && (
                    <Text style={styles.niveauBadge}>{item.niveauNom}</Text>
                  )}
                </View>
                <View style={styles.qteRow}>
                  <Button compact onPress={() => modifierQte(item.produit.id, -1)}>-</Button>
                  <Text style={styles.qte}>{item.quantite}</Text>
                  <Button compact onPress={() => modifierQte(item.produit.id, 1)}>+</Button>
                </View>
                <Text style={styles.sousTotal}>{(item.prixUnitaire * item.quantite).toFixed(0)}</Text>
              </View>
            )}
          />
          <Divider style={{ marginVertical: 8 }} />
          <Text variant="titleLarge" style={styles.total}>{tr('total', lang)} : {total.toFixed(0)} FCFA</Text>
          <Button
            mode="contained"
            onPress={() => setShowCheckout(true)}
            disabled={panier.length === 0}
            style={styles.btnValider}
            contentStyle={styles.btnValiderContent}
            buttonColor="#1a56db"
            labelStyle={styles.btnValiderLabel}
            icon={() => <MaterialCommunityIcons name="cash-register" size={18} color="#fff" />}
          >
            {tr('encaisser', lang)}
          </Button>
          {panier.length > 0 && (
            <Button onPress={() => setPanier([])} textColor="#dc2626" style={{ marginTop: 4 }}>
              {tr('vider', lang)}
            </Button>
          )}
        </View>
      </View>

      {/* Modal sélection niveau conditionnement */}
      <Portal>
        <Modal
          visible={showNiveauModal}
          onDismiss={() => { setShowNiveauModal(false); setProduitEnAttente(null); }}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>
            Choisir le niveau — {produitEnAttente?.nom}
          </Text>
          {loadingNiveaux ? (
            <ActivityIndicator color="#1a56db" />
          ) : (
            <>
              {niveauxDisponibles.map((n, i) => {
                const parentNom = i === 0 ? (produitEnAttente?.nom || 'produit') : niveauxDisponibles[i - 1].nom;
                const stockPropre = n.stock || 0;
                const parent = i > 0 ? niveauxDisponibles[i - 1] : null;
                const parentADuStock = parent ? (parent.stock || 0) > 0 : false;
                const enRuptureTotale = stockPropre === 0 && !parentADuStock;
                const stockColor = stockPropre > 0 ? '#16a34a' : (parentADuStock ? '#d97706' : '#dc2626');
                const stockLabel = stockPropre > 0
                  ? `Stock : ${stockPropre}`
                  : (parentADuStock ? '(cascade)' : '(rupture)');
                return (
                  <TouchableOpacity
                    key={n.id}
                    onPress={() => { if (!enRuptureTotale) choisirNiveau(n); }}
                    style={[styles.niveauCard, enRuptureTotale && { opacity: 0.45 }]}
                    disabled={enRuptureTotale}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{n.nom}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, backgroundColor: '#eff6ff', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#1e40af' }}>
                          1 {parentNom} = {n.facteur} {n.nom}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
                        Achat : {n.prixAchat} FCFA
                      </Text>
                      <Text style={{ fontSize: 12, marginTop: 2, fontWeight: '600', color: stockColor }}>
                        {stockLabel}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', color: '#1a56db', fontSize: 15 }}>{n.prixVente} FCFA</Text>
                  </TouchableOpacity>
                );
              })}
              <Button
                onPress={() => { ajouterSansNiveau(produitEnAttente!); setShowNiveauModal(false); setProduitEnAttente(null); }}
                style={{ marginTop: 8 }}
              >
                Vendre sans niveau (produit de base)
              </Button>
            </>
          )}
        </Modal>
      </Portal>

      {/* Modal encaissement */}
      <Portal>
        <Modal
          visible={showCheckout}
          onDismiss={() => setShowCheckout(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('encaissement', lang)}</Text>
            <Text variant="titleMedium" style={{ color: '#1a56db', marginBottom: 12 }}>
              {tr('total', lang)} : {total.toFixed(0)} FCFA
            </Text>
            <Text variant="labelLarge">{tr('mode_paiement', lang)}</Text>
            {MODES_PAIEMENT.map(m => (
              <View key={m} style={styles.radioRow}>
                <RadioButton value={m} status={modePaiement === m ? 'checked' : 'unchecked'} onPress={() => setModePaiement(m)} />
                <Text>{m.replace('_', ' ')}</Text>
              </View>
            ))}
            {modePaiement === 'ESPECES' && (
              <TextInput
                label={tr('montant_recu', lang)}
                value={montantRecu}
                onChangeText={setMontantRecu}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginTop: 12 }}
              />
            )}
            {montantRecu !== '' && modePaiement === 'ESPECES' && (
              <Text style={{ marginTop: 8, color: monnaie >= 0 ? '#16a34a' : '#dc2626' }}>
                {tr('monnaie', lang)} : {monnaie.toFixed(0)} FCFA
              </Text>
            )}
            <Button
              mode="contained"
              onPress={valider}
              style={{ marginTop: 16, borderRadius: 10 }}
              buttonColor="#1a56db"
              contentStyle={{ paddingVertical: 4 }}
            >
              {tr('confirmer_vente', lang)}
            </Button>
          </ScrollView>
        </Modal>
      </Portal>

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
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Stat bar
  statBar: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statSep: { width: 1, backgroundColor: '#e2e8f0', marginVertical: 4 },
  statVal: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  statLbl: { fontSize: 10, color: '#64748b', marginTop: 1 },

  // Bandeaux
  offlineBanner: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#f97316',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  offlineText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cacheBanner: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  cacheTxt: { color: '#92400e', fontSize: 11 },

  // Layout
  body: { flex: 1, flexDirection: 'row' },
  left: { flex: 1.2, padding: 8 },
  right: { flex: 1, padding: 8, backgroundColor: '#fff', borderLeftWidth: 1, borderColor: '#e2e8f0' },

  // Searchbar
  search: { marginBottom: 8, height: 42, backgroundColor: '#fff' },

  // Product card
  prodCard: { marginHorizontal: 8, marginBottom: 6, borderRadius: 12, elevation: 1 },
  prodCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  prodAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  prodName: { fontWeight: '600', fontSize: 13, color: '#1e293b' },
  prodSub: { color: '#64748b', fontSize: 11, marginTop: 1 },

  // Empty state
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyTxt: { color: '#94a3b8', fontSize: 14, marginTop: 8 },

  // Panier
  panierTitle: { fontWeight: 'bold', marginBottom: 8, color: '#1e293b' },
  panierItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  qteRow: { flexDirection: 'row', alignItems: 'center' },
  qte: { minWidth: 24, textAlign: 'center', fontWeight: 'bold', color: '#1e293b' },
  sousTotal: { fontSize: 12, color: '#1a56db', marginLeft: 4, fontWeight: '600' },
  total: { textAlign: 'center', fontWeight: 'bold', color: '#1a56db', marginBottom: 4 },
  niveauBadge: { fontSize: 11, color: '#1a56db', fontWeight: '600', marginTop: 1 },

  // Bouton valider
  btnValider: { marginTop: 12, borderRadius: 10 },
  btnValiderContent: { paddingVertical: 6 },
  btnValiderLabel: { fontSize: 15, fontWeight: 'bold', letterSpacing: 0.3 },

  // Modals
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20, maxHeight: '85%' },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },

  // Niveau conditionnement
  niveauCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
});
