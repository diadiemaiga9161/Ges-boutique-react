import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert, Modal,
  ScrollView, KeyboardAvoidingView, Platform,
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
import { getNiveaux, creerNiveau, modifierNiveau, supprimerNiveau, ProduitNiveau } from '../services/produit-niveau.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

interface FormProduit {
  nom: string;
  prixAchat: string;
  prixVente: string;
  quantite: string;
  seuilAlerte: string;
  categorie: string;
  description: string;
  codeBarres: string;
}

const emptyForm = (): FormProduit => ({
  nom: '', prixAchat: '', prixVente: '', quantite: '0',
  seuilAlerte: '5', categorie: '', description: '', codeBarres: '',
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

  const [showScanner, setShowScanner] = useState(false);

  // Niveaux
  const [showNiveauxModal, setShowNiveauxModal] = useState(false);
  const [produitCourant, setProduitCourant] = useState<Produit | null>(null);
  const [niveaux, setNiveaux] = useState<ProduitNiveau[]>([]);
  const [loadingNiveaux, setLoadingNiveaux] = useState(false);
  const [savingNiveau, setSavingNiveau] = useState(false);
  const [formNiveau, setFormNiveau] = useState({ nom: '', facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });
  const [editingNiveauId, setEditingNiveauId] = useState<number | null>(null);
  const [formEditNiveau, setFormEditNiveau] = useState({ nom: '', facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });

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
      codeBarres: p.codeBarres || '',
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
      codeBarres: form.codeBarres.trim() || undefined,
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

  // ==================== NIVEAUX ====================
  const rechargerNiveaux = async (produitId: number) => {
    const data = await getNiveaux(produitId);
    setNiveaux(data);
  };

  const ouvrirNiveaux = async (p: Produit) => {
    setProduitCourant(p);
    setShowNiveauxModal(true);
    setEditingNiveauId(null);
    setFormNiveau({ nom: '', facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });
    setLoadingNiveaux(true);
    try {
      const data = await getNiveaux(p.id);
      setNiveaux(data);
    } catch {
      Alert.alert('Erreur', 'Chargement des niveaux impossible');
    } finally {
      setLoadingNiveaux(false);
    }
  };

  const ajouterNiveauFn = async () => {
    if (!produitCourant || !formNiveau.nom.trim()) { Alert.alert('Erreur', 'Nom du niveau obligatoire'); return; }
    if (Number(formNiveau.facteur) < 1) { Alert.alert('Erreur', 'Contient doit être >= 1'); return; }
    if (Number(formNiveau.prixVente) <= 0) { Alert.alert('Erreur', 'Prix de vente obligatoire'); return; }
    setSavingNiveau(true);
    try {
      const ordre = niveaux.length > 0 ? Math.max(...niveaux.map(n => n.ordre)) + 1 : 1;
      await creerNiveau(produitCourant.id, {
        nom: formNiveau.nom.trim(), ordre,
        facteur: Number(formNiveau.facteur),
        prixAchat: Number(formNiveau.prixAchat),
        prixVente: Number(formNiveau.prixVente),
        stock: Number(formNiveau.stock),
      });
      await rechargerNiveaux(produitCourant.id);
      setFormNiveau({ nom: '', facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Ajout impossible');
    } finally {
      setSavingNiveau(false);
    }
  };

  const ouvrirEditNiveau = (n: ProduitNiveau) => {
    setEditingNiveauId(n.id!);
    setFormEditNiveau({ nom: n.nom, facteur: String(n.facteur), prixAchat: String(n.prixAchat), prixVente: String(n.prixVente), stock: String(n.stock ?? 0) });
  };

  const sauvegarderEditNiveauFn = async () => {
    if (!editingNiveauId || !produitCourant) return;
    setSavingNiveau(true);
    try {
      await modifierNiveau(editingNiveauId, {
        nom: formEditNiveau.nom.trim(),
        facteur: Number(formEditNiveau.facteur),
        prixAchat: Number(formEditNiveau.prixAchat),
        prixVente: Number(formEditNiveau.prixVente),
        stock: Number(formEditNiveau.stock),
      });
      setEditingNiveauId(null);
      await rechargerNiveaux(produitCourant.id);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Modification impossible');
    } finally {
      setSavingNiveau(false);
    }
  };

  const supprimerNiveauFn = (n: ProduitNiveau) => {
    Alert.alert('Supprimer niveau', `Supprimer "${n.nom}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await supprimerNiveau(n.id!);
          if (produitCourant) await rechargerNiveaux(produitCourant.id);
        } catch (e: any) {
          Alert.alert('Erreur', e.response?.data?.message || 'Suppression impossible');
        }
      }},
    ]);
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
              <IconButton icon="layers" size={20} iconColor="#7c3aed" onPress={() => ouvrirNiveaux(item)} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput label="Code-barres" value={form.codeBarres}
                onChangeText={v => setForm(f => ({ ...f, codeBarres: v }))}
                style={[styles.input, { flex: 1 }]} mode="outlined"
                keyboardType="default" placeholder="Ex: 3017620422003" />
              <IconButton icon="barcode-scan" size={28} iconColor="#1a56db"
                onPress={() => setShowScanner(true)} style={{ marginTop: 4 }} />
            </View>
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
      <BarcodeScannerModal
        visible={showScanner}
        title="Scanner le code-barres produit"
        onScan={code => setForm(f => ({ ...f, codeBarres: code }))}
        onClose={() => setShowScanner(false)}
      />

      {/* Modal Niveaux */}
      <Modal visible={showNiveauxModal} animationType="slide" onRequestClose={() => setShowNiveauxModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text variant="titleMedium" style={styles.modalTitle}>Niveaux — {produitCourant?.nom}</Text>
              <Text style={{ fontSize: 12, color: '#64748b' }}>Conditionnement multi-niveaux</Text>
            </View>
            <IconButton icon="close" onPress={() => setShowNiveauxModal(false)} />
          </View>

          {loadingNiveaux ? (
            <ActivityIndicator style={{ flex: 1 }} size="large" color="#7c3aed" />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">

              {/* Liste des niveaux existants */}
              {niveaux.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 20, marginTop: 10 }}>
                  Aucun niveau défini pour ce produit
                </Text>
              )}

              {niveaux.map((n, i) => (
                <View key={n.id} style={nStyles.niveauCard}>
                  {editingNiveauId === n.id ? (
                    /* Mode édition */
                    <View>
                      <Text style={nStyles.niveauEditTitle}>Modifier {n.nom}</Text>
                      <TextInput label="Nom du niveau (ex: Paquet, Pièce)" value={formEditNiveau.nom}
                        onChangeText={v => setFormEditNiveau(f => ({ ...f, nom: v }))}
                        style={nStyles.inp} mode="outlined" />
                      <TextInput
                        label={`1 ${i === 0 ? (produitCourant?.nom || 'unité parente') : niveaux[i - 1].nom} contient`}
                        value={formEditNiveau.facteur}
                        onChangeText={v => setFormEditNiveau(f => ({ ...f, facteur: v }))}
                        keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                      <View style={nStyles.row2}>
                        <TextInput label="Prix achat" value={formEditNiveau.prixAchat}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, prixAchat: v }))}
                          keyboardType="numeric" style={[nStyles.inp, { flex: 1, marginRight: 6 }]} mode="outlined" />
                        <TextInput label="Prix vente" value={formEditNiveau.prixVente}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, prixVente: v }))}
                          keyboardType="numeric" style={[nStyles.inp, { flex: 1 }]} mode="outlined" />
                      </View>
                      <TextInput label="Stock actuel" value={formEditNiveau.stock}
                        onChangeText={v => setFormEditNiveau(f => ({ ...f, stock: v }))}
                        keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                      <View style={nStyles.row2}>
                        <Button mode="contained" onPress={sauvegarderEditNiveauFn} loading={savingNiveau}
                          style={{ flex: 1, marginRight: 6 }} buttonColor="#7c3aed">Enregistrer</Button>
                        <Button mode="outlined" onPress={() => setEditingNiveauId(null)}
                          style={{ flex: 1 }}>Annuler</Button>
                      </View>
                    </View>
                  ) : (
                    /* Mode affichage */
                    <View>
                      <View style={nStyles.niveauHeader}>
                        <Text style={nStyles.niveauNom}>{n.nom}</Text>
                        <View style={nStyles.niveauActions}>
                          <IconButton icon="pencil" size={18} iconColor="#1a56db" onPress={() => ouvrirEditNiveau(n)} />
                          <IconButton icon="delete" size={18} iconColor="#f44336" onPress={() => supprimerNiveauFn(n)} />
                        </View>
                      </View>
                      <View style={nStyles.contientBadge}>
                        <Text style={nStyles.contientText}>
                          1 {i === 0 ? (produitCourant?.nom || '—') : niveaux[i - 1].nom} contient {n.facteur} {n.nom}
                        </Text>
                      </View>
                      <Text style={nStyles.prix}>
                        Achat : {n.prixAchat} FCFA  ·  Vente : {n.prixVente} FCFA
                      </Text>
                      <View style={nStyles.stockRow}>
                        <Text style={nStyles.stockLabel}>Stock :</Text>
                        <View style={nStyles.stockBadge}>
                          <Text style={nStyles.stockVal}>{n.stock ?? 0}</Text>
                        </View>
                        <Text style={{ color: '#94a3b8', fontSize: 11 }}>(modifiable via crayon)</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <Divider style={{ marginVertical: 16 }} />

              {/* Formulaire ajouter un niveau */}
              <View style={nStyles.addSection}>
                <Text style={nStyles.addTitle}>+ Ajouter un niveau</Text>
                <Text style={nStyles.addHint}>
                  Ex : 1 {produitCourant?.nom || 'Carton'} contient 6 Paquets → nom = "Paquet", contient = 6
                </Text>
                <TextInput label="Nom du niveau (ex: Paquet, Pièce)" value={formNiveau.nom}
                  onChangeText={v => setFormNiveau(f => ({ ...f, nom: v }))}
                  style={nStyles.inp} mode="outlined" />
                <TextInput
                  label={`1 ${niveaux.length === 0 ? (produitCourant?.nom || 'unité parente') : niveaux[niveaux.length - 1].nom} contient`}
                  value={formNiveau.facteur}
                  onChangeText={v => setFormNiveau(f => ({ ...f, facteur: v }))}
                  keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                <View style={nStyles.row2}>
                  <TextInput label="Prix achat" value={formNiveau.prixAchat}
                    onChangeText={v => setFormNiveau(f => ({ ...f, prixAchat: v }))}
                    keyboardType="numeric" style={[nStyles.inp, { flex: 1, marginRight: 6 }]} mode="outlined" />
                  <TextInput label="Prix vente *" value={formNiveau.prixVente}
                    onChangeText={v => setFormNiveau(f => ({ ...f, prixVente: v }))}
                    keyboardType="numeric" style={[nStyles.inp, { flex: 1 }]} mode="outlined" />
                </View>
                <TextInput label="Stock initial" value={formNiveau.stock}
                  onChangeText={v => setFormNiveau(f => ({ ...f, stock: v }))}
                  keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                <Button mode="contained" onPress={ajouterNiveauFn} loading={savingNiveau}
                  style={{ marginTop: 8, borderRadius: 10 }} contentStyle={{ height: 48 }}
                  buttonColor="#16a34a" icon="plus">
                  Ajouter ce niveau
                </Button>
              </View>

            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const nStyles = StyleSheet.create({
  niveauCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  niveauHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  niveauNom: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  niveauActions: { flexDirection: 'row' },
  contientBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginVertical: 6 },
  contientText: { color: '#1e40af', fontSize: 13, fontWeight: '600' },
  prix: { color: '#64748b', fontSize: 12, marginBottom: 8 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockLabel: { color: '#64748b', fontSize: 13, marginRight: 8 },
  stockBadge: { backgroundColor: '#e0e7ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginRight: 6 },
  stockVal: { color: '#3730a3', fontWeight: '700', fontSize: 14 },
  niveauEditTitle: { fontWeight: '700', color: '#7c3aed', marginBottom: 10 },
  addSection: { backgroundColor: '#f0fdf4', borderRadius: 12, padding: 14 },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#15803d', marginBottom: 4 },
  addHint: { color: '#64748b', fontSize: 12, marginBottom: 12 },
  inp: { marginBottom: 10, backgroundColor: '#fff' },
  row2: { flexDirection: 'row', marginBottom: 0 },
});

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
