import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Searchbar, ActivityIndicator, Chip, Divider, Modal, Portal, TextInput, RadioButton } from 'react-native-paper';
import { getProduits, getClients } from '../services/api.service';
import { getProduitsCache, getClientsCache, cacheProduits } from '../db/database';
import { enregistrerVente, getNombreVentesPending } from '../services/offline.service';
import NetInfo from '@react-native-community/netinfo';
import { Produit, Client, LigneVenteRequest } from '../types';
import { ProduitNiveau, getNiveaux, calculerFacteurTotal } from '../services/produit-niveau.service';

interface CartItem {
  produit: Produit;
  quantite: number;
  prixUnitaire: number;
  remisePourcentage: number;
  niveauId?: number;          // ID du ProduitNiveau vendu
  niveauNom?: string;         // nom du niveau (ex: "Cartouche")
  niveauPrixAchat?: number;   // prix achat du niveau
  niveauFacteurTotal?: number; // facteur total vers unité de base
}

const MODES_PAIEMENT = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'CARTE_BANCAIRE'];

export default function VenteScreen() {
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
  const [offline, setOffline] = useState(false);

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
        await cacheProduits(p); // sauvegarder pour usage offline
      } catch {
        const [p, c] = await Promise.all([getProduitsCache(), getClientsCache()]);
        setProduits(p); setClients(c); setFiltered(p);
      }
    } else {
      const [p, c] = await Promise.all([getProduitsCache(), getClientsCache()]);
      setProduits(p); setClients(c); setFiltered(p);
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

  const ajouterAuPanier = async (p: Produit) => {
    // Vérifier si le produit a des niveaux de conditionnement
    setLoadingNiveaux(true);
    try {
      const res = await getNiveaux(p.id);
      const niveaux: ProduitNiveau[] = res.data?.niveaux || [];
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
      Alert.alert('Rupture de stock', `${p.nom} est en rupture de stock.`);
      return;
    }
    setPanier(prev => {
      const idx = prev.findIndex(i => i.produit.id === p.id && !i.niveauId);
      if (idx >= 0) {
        if (prev[idx].quantite >= p.quantite) {
          Alert.alert('Stock insuffisant', `Stock maximum atteint : ${p.quantite} unité(s).`);
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
    const facteurTotal = calculerFacteurTotal(niveauxDisponibles, niveau.ordre);
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
        Alert.alert('Stock insuffisant', `Stock maximum : ${item.produit.quantite} unité(s).`);
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
      cacheProduits(updated); // mettre à jour le cache offline
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
    // Vérification stock avant envoi
    for (const item of panier) {
      if (!item.niveauId && item.quantite > item.produit.quantite) {
        Alert.alert('Stock insuffisant', `${item.produit.nom} : demandé ${item.quantite}, disponible ${item.produit.quantite}`);
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
      mettreAJourStockLocal(panierSnapshot); // stock mis à jour immédiatement
      const msg = result.offline
        ? 'Vente enregistrée hors ligne — sera synchronisée quand internet revient'
        : 'Vente enregistrée avec succès !';
      Alert.alert(result.offline ? 'Hors ligne' : 'Succès', msg);
      setPanier([]);
      setShowCheckout(false);
      setMontantRecu('');
      const n = await getNombreVentesPending();
      setVentesPending(n);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Hors ligne — ventes sauvegardées localement</Text>
        </View>
      )}
      {ventesPending > 0 && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>{ventesPending} vente(s) en attente de sync</Text>
        </View>
      )}

      <View style={styles.body}>
        {/* Liste produits */}
        <View style={styles.left}>
          <Searchbar placeholder="Produit..." value={search} onChangeText={setSearch} style={styles.search} />
          <FlatList
            data={filtered}
            keyExtractor={p => String(p.id)}
            renderItem={({ item }) => (
              <Card style={styles.prodCard} onPress={() => ajouterAuPanier(item)}>
                <Card.Content style={{ padding: 10 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>{item.nom}</Text>
                  <Text style={styles.prix}>{item.prixVente} FCFA</Text>
                  <Text style={[styles.stock, { color: item.quantite === 0 ? '#f44336' : '#666' }]}>
                    Stock : {item.quantite}
                  </Text>
                </Card.Content>
              </Card>
            )}
          />
        </View>

        {/* Panier */}
        <View style={styles.right}>
          <Text variant="titleMedium" style={styles.panierTitle}>Panier ({panier.length})</Text>
          <FlatList
            data={panier}
            keyExtractor={i => String(i.produit.id)}
            renderItem={({ item }) => (
              <View style={styles.panierItem}>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13 }}>{item.produit.nom}</Text>
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
          <Text variant="titleLarge" style={styles.total}>Total : {total.toFixed(0)} FCFA</Text>
          <Button
            mode="contained"
            onPress={() => setShowCheckout(true)}
            disabled={panier.length === 0}
            style={styles.btnValider}
          >
            Encaisser
          </Button>
          {panier.length > 0 && (
            <Button onPress={() => setPanier([])} textColor="#f44336">Vider</Button>
          )}
        </View>
      </View>

      {/* Modal sélection niveau conditionnement */}
      <Portal>
        <Modal visible={showNiveauModal} onDismiss={() => { setShowNiveauModal(false); setProduitEnAttente(null); }} contentContainerStyle={styles.modal}>
          <Text variant="titleMedium" style={{ marginBottom: 8 }}>
            Choisir le niveau — {produitEnAttente?.nom}
          </Text>
          {loadingNiveaux ? (
            <ActivityIndicator />
          ) : (
            <>
              {niveauxDisponibles.map(n => (
                <TouchableOpacity key={n.id} onPress={() => choisirNiveau(n)} style={styles.niveauCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{n.nom}</Text>
                    <Text style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      1 parent = {n.facteur} {n.nom} · Achat: {n.prixAchat} FCFA
                    </Text>
                    <Text style={{ fontSize: 12, marginTop: 2, color: (n.stock || 0) > 0 ? '#4caf50' : '#ff9800' }}>
                      Stock: {n.stock || 0} (cascade auto si épuisé)
                    </Text>
                  </View>
                  <Text style={{ fontWeight: 'bold', color: '#1a56db', fontSize: 15 }}>{n.prixVente} FCFA</Text>
                </TouchableOpacity>
              ))}
              <Button onPress={() => { ajouterSansNiveau(produitEnAttente!); setShowNiveauModal(false); setProduitEnAttente(null); }} style={{ marginTop: 8 }}>
                Vendre sans niveau (produit de base)
              </Button>
            </>
          )}
        </Modal>
      </Portal>

      {/* Modal encaissement */}
      <Portal>
        <Modal visible={showCheckout} onDismiss={() => setShowCheckout(false)} contentContainerStyle={styles.modal}>
          <ScrollView>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>Encaissement</Text>
            <Text variant="titleMedium" style={{ color: '#1a56db', marginBottom: 12 }}>
              Total : {total.toFixed(0)} FCFA
            </Text>
            <Text variant="labelLarge">Mode de paiement</Text>
            {MODES_PAIEMENT.map(m => (
              <View key={m} style={styles.radioRow}>
                <RadioButton value={m} status={modePaiement === m ? 'checked' : 'unchecked'} onPress={() => setModePaiement(m)} />
                <Text>{m.replace('_', ' ')}</Text>
              </View>
            ))}
            {modePaiement === 'ESPECES' && (
              <TextInput
                label="Montant reçu"
                value={montantRecu}
                onChangeText={setMontantRecu}
                keyboardType="numeric"
                mode="outlined"
                style={{ marginTop: 12 }}
              />
            )}
            {montantRecu !== '' && modePaiement === 'ESPECES' && (
              <Text style={{ marginTop: 8, color: monnaie >= 0 ? '#4caf50' : '#f44336' }}>
                Monnaie : {monnaie.toFixed(0)} FCFA
              </Text>
            )}
            <Button mode="contained" onPress={valider} style={{ marginTop: 16 }}>
              Confirmer la vente
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  body: { flex: 1, flexDirection: 'row' },
  left: { flex: 1.2, padding: 8 },
  right: { flex: 1, padding: 8, backgroundColor: '#fff', borderLeftWidth: 1, borderColor: '#eee' },
  search: { marginBottom: 8, height: 42 },
  prodCard: { marginBottom: 6, borderRadius: 10 },
  prix: { color: '#1a56db', fontWeight: '600', fontSize: 13 },
  stock: { fontSize: 11, marginTop: 2 },
  panierTitle: { fontWeight: 'bold', marginBottom: 8 },
  panierItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  qteRow: { flexDirection: 'row', alignItems: 'center' },
  qte: { minWidth: 24, textAlign: 'center', fontWeight: 'bold' },
  sousTotal: { fontSize: 12, color: '#1a56db', marginLeft: 4 },
  total: { textAlign: 'center', fontWeight: 'bold', color: '#1a56db' },
  btnValider: { marginTop: 12, borderRadius: 8 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20, maxHeight: '85%' },
  radioRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  offlineBanner: { backgroundColor: '#ff9800', padding: 6, alignItems: 'center' },
  offlineText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  pendingBanner: { backgroundColor: '#2196F3', padding: 6, alignItems: 'center' },
  pendingText: { color: '#fff', fontSize: 12 },
  niveauBadge: { fontSize: 11, color: '#1a56db', fontWeight: '600', marginTop: 1 },
  niveauCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, marginBottom: 8, backgroundColor: '#f0f7ff',
    borderRadius: 10, borderWidth: 1, borderColor: '#bfdbfe'
  },
});
