import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert, Modal,
  ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  Text, Card, FAB, Searchbar, Chip, ActivityIndicator,
  TextInput, Button, IconButton, Divider,
} from 'react-native-paper';
import { getProduits, deleteProduit } from '../services/api.service';
import { cacheProduits, getProduitsCache } from '../db/database';
import { creerProduitOffline, modifierProduitOffline, getNombreProduitsPending } from '../services/offline.service';
import NetInfo from '@react-native-community/netinfo';
import { Produit } from '../types';

interface FormProduit {
  nom: string;
  prixAchat: string;
  prixVente: string;
  quantite: string;
  seuilAlerte: string;
  categorie: string;
  description: string;
}

const emptyForm = (): FormProduit => ({
  nom: '', prixAchat: '', prixVente: '', quantite: '0',
  seuilAlerte: '5', categorie: '', description: '',
});

export default function ProduitsScreen() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [form, setForm] = useState<FormProduit>(emptyForm());
  const [saving, setSaving] = useState(false);

  const charger = useCallback(async () => {
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      try {
        const res = await getProduits();
        const data = res.data?.data || res.data || [];
        setProduits(data);
        setFiltered(data);
        await cacheProduits(data);
        setOffline(false);
      } catch {
        const cached = await getProduitsCache();
        setProduits(cached);
        setFiltered(cached);
        setOffline(true);
      }
    } else {
      const cached = await getProduitsCache();
      setProduits(cached);
      setFiltered(cached);
      setOffline(true);
    }
    const n = await getNombreProduitsPending();
    setPendingCount(n);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!search) { setFiltered(produits); return; }
    const q = search.toLowerCase();
    setFiltered(produits.filter(p => p.nom.toLowerCase().includes(q)));
  }, [search, produits]);

  const ouvrirCreation = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const ouvrirEdition = (p: Produit) => {
    setEditing(p);
    setForm({
      nom: p.nom,
      prixAchat: String(p.prixAchat),
      prixVente: String(p.prixVente),
      quantite: String(p.quantite),
      seuilAlerte: String(p.seuilAlerte || 5),
      categorie: p.categorie || '',
      description: p.description || '',
    });
    setShowModal(true);
  };

  const fermerModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm()); };

  const sauvegarder = async () => {
    if (!form.nom.trim()) { Alert.alert('Erreur', 'Le nom est obligatoire'); return; }
    if (!form.prixVente || Number(form.prixVente) <= 0) { Alert.alert('Erreur', 'Prix de vente obligatoire'); return; }
    setSaving(true);
    const data = {
      nom: form.nom.trim(),
      prixAchat: Number(form.prixAchat) || 0,
      prixVente: Number(form.prixVente),
      quantite: Number(form.quantite) || 0,
      seuilAlerte: Number(form.seuilAlerte) || 5,
      categorie: form.categorie.trim() || undefined,
      description: form.description.trim() || undefined,
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
      'Supprimer', `Supprimer "${p.nom}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive',
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

  const stockColor = (p: Produit) => {
    if (p.quantite === 0) return '#f44336';
    if (p.quantite <= (p.seuilAlerte || 5)) return '#ff9800';
    return '#4caf50';
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Bannière hors ligne */}
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📡 Hors ligne — données en cache
            {pendingCount > 0 ? ` · ${pendingCount} en attente de sync` : ''}
          </Text>
        </View>
      )}
      {!offline && pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncText}>🔄 {pendingCount} produit(s) en cours de synchronisation</Text>
        </View>
      )}

      <Searchbar
        placeholder="Rechercher un produit..."
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      <FlatList
        data={filtered}
        keyExtractor={p => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <Card style={[styles.card, item.id < 0 && styles.cardPending]}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={{ flex: 1 }}>{item.nom}</Text>
                <View style={[styles.stockBadge, { backgroundColor: stockColor(item) }]}>
                  <Text style={styles.stockText}>{item.quantite}</Text>
                </View>
              </View>
              <View style={styles.row}>
                <Text style={styles.prix}>Vente : {item.prixVente} FCFA</Text>
                <Text style={styles.prixAchat}>Achat : {item.prixAchat} FCFA</Text>
              </View>
              {item.categorie ? <Chip compact style={styles.chip}>{item.categorie}</Chip> : null}
              {item.id < 0 && <Text style={styles.pendingLabel}>⏳ En attente de sync</Text>}
            </Card.Content>
            <Card.Actions style={styles.actions}>
              <IconButton icon="pencil" size={20} iconColor="#1a56db" onPress={() => ouvrirEdition(item)} />
              <IconButton icon="delete" size={20} iconColor="#f44336" onPress={() => confirmerSuppression(item)} />
            </Card.Actions>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun produit trouvé</Text>}
      />

      <FAB
        icon="plus"
        label="Nouveau produit"
        style={styles.fab}
        color="#fff"
        onPress={ouvrirCreation}
      />

      {/* Modal créer / modifier */}
      <Modal visible={showModal} animationType="slide" onRequestClose={fermerModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editing ? 'Modifier le produit' : 'Nouveau produit'}
            </Text>
            <IconButton icon="close" onPress={fermerModal} />
          </View>
          {offline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>📡 Mode hors ligne — sera synchronisé au retour</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <TextInput label="Nom du produit *" value={form.nom}
              onChangeText={v => setForm(f => ({ ...f, nom: v }))}
              style={styles.input} mode="outlined" />
            <View style={styles.row2}>
              <TextInput label="Prix achat (FCFA)" value={form.prixAchat}
                onChangeText={v => setForm(f => ({ ...f, prixAchat: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" />
              <TextInput label="Prix vente (FCFA) *" value={form.prixVente}
                onChangeText={v => setForm(f => ({ ...f, prixVente: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1 }]} mode="outlined" />
            </View>
            <View style={styles.row2}>
              <TextInput label="Stock initial" value={form.quantite}
                onChangeText={v => setForm(f => ({ ...f, quantite: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" />
              <TextInput label="Seuil alerte" value={form.seuilAlerte}
                onChangeText={v => setForm(f => ({ ...f, seuilAlerte: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1 }]} mode="outlined" />
            </View>
            <TextInput label="Catégorie" value={form.categorie}
              onChangeText={v => setForm(f => ({ ...f, categorie: v }))}
              style={styles.input} mode="outlined" />
            <TextInput label="Description" value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              style={styles.input} mode="outlined" multiline numberOfLines={3} />
            <Divider style={{ marginVertical: 12 }} />
            <Button mode="contained" onPress={sauvegarder} loading={saving}
              disabled={saving} style={styles.btnSave} contentStyle={{ height: 48 }}
              buttonColor="#1a56db">
              {editing ? 'Enregistrer les modifications' : 'Créer le produit'}
            </Button>
            <Button mode="outlined" onPress={fermerModal} style={{ marginTop: 8 }}>
              Annuler
            </Button>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

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
  offlineBanner: { backgroundColor: '#ff9800', padding: 10, alignItems: 'center' },
  offlineText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  syncBanner: { backgroundColor: '#1a56db', padding: 8, alignItems: 'center' },
  syncText: { color: '#fff', fontSize: 12 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#1a56db', borderRadius: 16 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  modalTitle: { fontWeight: '800', color: '#0f172a' },
  modalBody: { padding: 16, backgroundColor: '#f0f4ff', paddingBottom: 40 },
  input: { marginBottom: 12, backgroundColor: '#fff' },
  btnSave: { borderRadius: 10, marginTop: 4 },
});
