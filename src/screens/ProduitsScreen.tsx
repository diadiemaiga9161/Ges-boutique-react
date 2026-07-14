import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert, Modal,
  ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import {
  Text, Card, FAB, Searchbar, Chip, ActivityIndicator,
  TextInput, Button, IconButton, Divider,
} from 'react-native-paper';
import * as Print from 'expo-print';
import { getProduits, deleteProduit } from '../services/api.service';
import { cacheProduits, getProduitsCache } from '../db/database';
import { creerProduitOffline, modifierProduitOffline, getNombreProduitsPending } from '../services/offline.service';
import NetInfo from '@react-native-community/netinfo';
import { Produit } from '../types';
import { getNiveaux, creerNiveau, modifierNiveau, supprimerNiveau, decomposer, ProduitNiveau } from '../services/produit-niveau.service';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

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
  const { lang } = useLang();
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
  const [formNiveau, setFormNiveau] = useState({ nom: '', parentId: '' as string, facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });
  const [editingNiveauId, setEditingNiveauId] = useState<number | null>(null);
  const [formEditNiveau, setFormEditNiveau] = useState({ nom: '', parentId: '' as string, facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });

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
      tr('supprimer', lang), `Supprimer "${p.nom}" ?`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang), style: 'destructive',
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

  // Construit la chaîne ordonnée depuis la racine vers les feuilles en suivant parentId
  const buildNiveauxChaine = (niveaux: ProduitNiveau[]): ProduitNiveau[] => {
    const roots = niveaux.filter(n => !n.parentId);
    const result: ProduitNiveau[] = [];
    const addWithChildren = (n: ProduitNiveau) => {
      result.push(n);
      niveaux.filter(c => c.parentId === n.id).forEach(addWithChildren);
    };
    roots.forEach(addWithChildren);
    // Si aucune racine trouvée (ancienne API sans parentId), retourner tel quel trié par ordre
    if (result.length === 0 && niveaux.length > 0) {
      return [...niveaux].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    }
    return result;
  };

  const nomParentNiveau = (niveau: ProduitNiveau, liste: ProduitNiveau[]): string => {
    if (!niveau.parentId) return '';
    return liste.find(n => n.id === niveau.parentId)?.nom || '';
  };

  const labelFacteur = (niveau: ProduitNiveau, liste: ProduitNiveau[]): string => {
    const parent = nomParentNiveau(niveau, liste);
    if (!parent) return 'Quantite par unite superieure';
    return `Combien de ${niveau.nom || '...'} dans 1 ${parent} ?`;
  };

  const rechargerNiveaux = async (produitId: number) => {
    const data = await getNiveaux(produitId);
    setNiveaux(data);
  };

  const ouvrirNiveaux = async (p: Produit) => {
    setProduitCourant(p);
    setShowNiveauxModal(true);
    setEditingNiveauId(null);
    setFormNiveau({ nom: '', parentId: '', facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });
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
    const facteurNum = parseFloat(formNiveau.facteur);
    if (isNaN(facteurNum) || facteurNum < 1) {
      Alert.alert('Erreur', 'La quantité doit être >= 1');
      return;
    }
    if (Number(formNiveau.prixVente) <= 0) { Alert.alert('Erreur', 'Prix de vente obligatoire'); return; }
    setSavingNiveau(true);
    const parseNum = (val: string, fallback: number = 0) => {
      const n = parseFloat(val);
      return isNaN(n) ? fallback : n;
    };
    try {
      const payload = {
        nom: formNiveau.nom.trim(),
        parentId: formNiveau.parentId ? Number(formNiveau.parentId) : undefined,
        facteur: Math.max(1, parseNum(formNiveau.facteur, 1)),
        prixAchat: parseNum(formNiveau.prixAchat, 0),
        prixVente: parseNum(formNiveau.prixVente, 0),
        stock: parseNum(formNiveau.stock, 0),
      };
      await creerNiveau(produitCourant.id, payload);
      await rechargerNiveaux(produitCourant.id);
      setFormNiveau({ nom: '', parentId: '', facteur: '1', prixAchat: '0', prixVente: '0', stock: '0' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erreur lors de la creation du niveau';
      Alert.alert('Erreur', msg);
    } finally {
      setSavingNiveau(false);
    }
  };

  const ouvrirEditNiveau = (n: ProduitNiveau) => {
    setEditingNiveauId(n.id!);
    setFormEditNiveau({
      nom: n.nom,
      parentId: n.parentId !== undefined && n.parentId !== null ? String(n.parentId) : '',
      facteur: String(n.facteur),
      prixAchat: String(n.prixAchat),
      prixVente: String(n.prixVente),
      stock: String(n.stock ?? 0),
    });
  };

  const sauvegarderEditNiveauFn = async () => {
    if (!editingNiveauId || !produitCourant) return;
    setSavingNiveau(true);
    try {
      const parentIdVal = formEditNiveau.parentId ? Number(formEditNiveau.parentId) : undefined;
      await modifierNiveau(editingNiveauId, {
        nom: formEditNiveau.nom.trim(),
        parentId: parentIdVal,
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
    Alert.alert(tr('supprimer', lang), `Supprimer "${n.nom}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
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

  const genererPdfStock = async () => {
    const liste = filtered.length > 0 ? filtered : produits;
    const totalArticles = liste.reduce((s, p) => s + (p.quantite || 0), 0);
    const valeurTotale = liste.reduce((s, p) => s + (p.quantite || 0) * (p.prixVente || 0), 0);
    const date = new Date().toLocaleDateString('fr-FR');
    const lignes = liste.map((p, i) => {
      const qColor = p.quantite === 0 ? '#ef4444' : (p.quantite <= (p.seuilAlerte || 5) ? '#d97706' : '#16a34a');
      const qLabel = p.quantite === 0 ? 'Rupture' : (p.quantite <= (p.seuilAlerte || 5) ? 'Faible' : 'OK');
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">${p.nom}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">${p.categorie || '—'}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center"><span style="background:${qColor}22;color:${qColor};border-radius:4px;padding:2px 8px;font-weight:700;font-size:11px">${p.quantite || 0} · ${qLabel}</span></td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">${(p.prixAchat || 0).toLocaleString('fr-FR')} FCFA</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700">${(p.prixVente || 0).toLocaleString('fr-FR')} FCFA</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#1d4ed8">${((p.quantite || 0) * (p.prixVente || 0)).toLocaleString('fr-FR')} FCFA</td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stock Produits</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:20px;font-size:12px;background:#f0f4f8}
.sheet{background:#fff;max-width:960px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;padding:24px;display:flex;justify-content:space-between;align-items:center}
.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:12px;opacity:.7;margin-top:4px}
.kpis{display:flex;padding:16px 24px;gap:12px;border-bottom:1px solid #e5e7eb}
.kpi{flex:1;border-radius:8px;padding:12px;text-align:center}
.kpi-val{font-size:18px;font-weight:900}.kpi-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase}
.kpi--b{background:#dbeafe;color:#1d4ed8}.kpi--s{background:#f1f5f9;color:#475569}.kpi--g{background:#dcfce7;color:#15803d}
.body{padding:20px 24px}
table{width:100%;border-collapse:collapse}
thead th{background:#1d4ed8;color:#fff;padding:9px 8px;font-size:11px;font-weight:700;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f1f5f9}
.ftr{background:#eff6ff;text-align:center;padding:14px;font-size:10px;color:#1e40af}
</style></head><body>
<div class="sheet">
<div class="hdr"><div><h1>Stock Produits</h1><p>Ges Boutique · ${date}</p></div>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('Stock ' + date + ' ' + liste.length + ' produits')}" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px"></div>
<div class="kpis">
<div class="kpi kpi--b"><div class="kpi-val">${liste.length}</div><div class="kpi-lbl">Produits</div></div>
<div class="kpi kpi--s"><div class="kpi-val">${totalArticles}</div><div class="kpi-lbl">Total articles</div></div>
<div class="kpi kpi--g"><div class="kpi-val">${valeurTotale.toLocaleString('fr-FR')} FCFA</div><div class="kpi-lbl">Valeur stock</div></div>
</div>
<div class="body">
<table><thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>P. Achat</th><th>P. Vente</th><th>Valeur</th></tr></thead>
<tbody>${lignes || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">Aucun produit</td></tr>'}</tbody></table>
</div>
<div class="ftr">Ges Boutique · Stock · ${date} · ${liste.length} produit(s)</div>
</div></body></html>`;
    try { await Print.printAsync({ html }); } catch { Alert.alert('Erreur', 'Impossible de générer le PDF'); }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Bannière hors ligne */}
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            {tr('hors_ligne', lang)} — données en cache
            {pendingCount > 0 ? ` · ${pendingCount} ${tr('en_attente_sync', lang)}` : ''}
          </Text>
        </View>
      )}
      {!offline && pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Text style={styles.syncText}>🔄 {pendingCount} produit(s) en cours de synchronisation</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 }}>
        <Searchbar
          placeholder={tr('recherche_produit', lang)}
          value={search}
          onChangeText={setSearch}
          style={[styles.search, { flex: 1, margin: 0 }]}
        />
        <TouchableOpacity
          onPress={genererPdfStock}
          style={{ backgroundColor: '#1d4ed8', borderRadius: 8, padding: 10 }}
        >
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>PDF</Text>
        </TouchableOpacity>
      </View>

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
        label={tr('nouveau_produit', lang)}
        style={styles.fab}
        color="#fff"
        onPress={ouvrirCreation}
      />

      {/* Modal créer / modifier */}
      <Modal visible={showModal} animationType="slide" onRequestClose={fermerModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <Text variant="titleLarge" style={styles.modalTitle}>
              {editing ? tr('modifier', lang) : tr('nouveau_produit', lang)}
            </Text>
            <IconButton icon="close" onPress={fermerModal} />
          </View>
          {offline && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineText}>{tr('hors_ligne', lang)} — sera synchronisé au retour</Text>
            </View>
          )}
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <TextInput label={tr('nom_produit', lang)} value={form.nom}
              onChangeText={v => setForm(f => ({ ...f, nom: v }))}
              style={styles.input} mode="outlined" />
            <View style={styles.row2}>
              <TextInput label={`${tr('prix_achat', lang)} (FCFA)`} value={form.prixAchat}
                onChangeText={v => setForm(f => ({ ...f, prixAchat: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" />
              <TextInput label={`${tr('prix_vente', lang)} (FCFA) *`} value={form.prixVente}
                onChangeText={v => setForm(f => ({ ...f, prixVente: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1 }]} mode="outlined" />
            </View>
            <View style={styles.row2}>
              <TextInput label={tr('stock', lang)} value={form.quantite}
                onChangeText={v => setForm(f => ({ ...f, quantite: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1, marginRight: 8 }]} mode="outlined" />
              <TextInput label={tr('seuil_alerte', lang)} value={form.seuilAlerte}
                onChangeText={v => setForm(f => ({ ...f, seuilAlerte: v }))}
                keyboardType="numeric" style={[styles.input, { flex: 1 }]} mode="outlined" />
            </View>
            <TextInput label={tr('categorie', lang)} value={form.categorie}
              onChangeText={v => setForm(f => ({ ...f, categorie: v }))}
              style={styles.input} mode="outlined" />
            <TextInput label="Description" value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              style={styles.input} mode="outlined" multiline numberOfLines={3} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput label={tr('code_barres', lang)} value={form.codeBarres}
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
              {editing ? tr('enregistrer', lang) : tr('nouveau_produit', lang)}
            </Button>
            <Button mode="outlined" onPress={fermerModal} style={{ marginTop: 8 }}>
              {tr('annuler', lang)}
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

              {/* Chaine visuelle des niveaux */}
              {niveaux.length > 0 && (
                <View style={nStyles.chaineContainer}>
                  {buildNiveauxChaine(niveaux).map((n, i, arr) => (
                    <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={nStyles.chaineBadge}>
                        <Text style={nStyles.chaineNom}>{n.nom}</Text>
                      </View>
                      {i < arr.length - 1 && (
                        <Text style={nStyles.chaineArrow}> → </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Liste des niveaux existants */}
              {niveaux.length === 0 && (
                <Text style={{ textAlign: 'center', color: '#94a3b8', marginBottom: 20, marginTop: 10 }}>
                  Aucun niveau defini pour ce produit
                </Text>
              )}

              {buildNiveauxChaine(niveaux).map(n => {
                const parentNom = nomParentNiveau(n, niveaux);
                return (
                  <View key={n.id} style={nStyles.niveauCard}>
                    {editingNiveauId === n.id ? (
                      /* Mode edition */
                      <View>
                        <Text style={nStyles.niveauEditTitle}>Modifier {n.nom}</Text>
                        <TextInput label="Nom de l'emballage (ex: Carton, Sachet, Piece)"
                          value={formEditNiveau.nom}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, nom: v }))}
                          style={nStyles.inp} mode="outlined" />

                        {/* Selecteur parent */}
                        <Text style={nStyles.selectLabel}>Il est contenu dans :</Text>
                        <View style={nStyles.parentSelect}>
                          <TouchableOpacity
                            style={[nStyles.parentOption, !formEditNiveau.parentId && nStyles.parentOptionActive]}
                            onPress={() => setFormEditNiveau(f => ({ ...f, parentId: '', facteur: '1' }))}
                          >
                            <Text style={[nStyles.parentOptionText, !formEditNiveau.parentId && nStyles.parentOptionTextActive]}>
                              C'est le plus grand
                            </Text>
                          </TouchableOpacity>
                          {niveaux.filter(pn => pn.id !== n.id).map(pn => (
                            <TouchableOpacity
                              key={pn.id}
                              style={[nStyles.parentOption, formEditNiveau.parentId === String(pn.id) && nStyles.parentOptionActive]}
                              onPress={() => setFormEditNiveau(f => ({ ...f, parentId: String(pn.id) }))}
                            >
                              <Text style={[nStyles.parentOptionText, formEditNiveau.parentId === String(pn.id) && nStyles.parentOptionTextActive]}>
                                {pn.nom}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        {formEditNiveau.parentId !== '' && (
                          <TextInput
                            label={labelFacteur(
                              { ...n, nom: formEditNiveau.nom || n.nom, parentId: Number(formEditNiveau.parentId) },
                              niveaux
                            )}
                            value={formEditNiveau.facteur}
                            onChangeText={v => setFormEditNiveau(f => ({ ...f, facteur: v }))}
                            keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                        )}

                        <View style={nStyles.row2}>
                          <TextInput label="Prix achat (FCFA)" value={formEditNiveau.prixAchat}
                            onChangeText={v => setFormEditNiveau(f => ({ ...f, prixAchat: v }))}
                            keyboardType="numeric" style={[nStyles.inp, { flex: 1, marginRight: 6 }]} mode="outlined" />
                          <TextInput label="Prix vente (FCFA)" value={formEditNiveau.prixVente}
                            onChangeText={v => setFormEditNiveau(f => ({ ...f, prixVente: v }))}
                            keyboardType="numeric" style={[nStyles.inp, { flex: 1 }]} mode="outlined" />
                        </View>
                        <TextInput label="Stock actuel" value={formEditNiveau.stock}
                          onChangeText={v => setFormEditNiveau(f => ({ ...f, stock: v }))}
                          keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                        <View style={nStyles.row2}>
                          <Button mode="contained" onPress={sauvegarderEditNiveauFn} loading={savingNiveau}
                            style={{ flex: 1, marginRight: 6 }} buttonColor="#7c3aed">{tr('enregistrer', lang)}</Button>
                          <Button mode="outlined" onPress={() => setEditingNiveauId(null)}
                            style={{ flex: 1 }}>{tr('annuler', lang)}</Button>
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

                        {/* Relation parent → enfant */}
                        {parentNom ? (
                          <View style={nStyles.contientBadge}>
                            <Text style={nStyles.contientText}>
                              1 {parentNom} = {n.facteur} {n.nom}
                            </Text>
                          </View>
                        ) : (
                          <View style={[nStyles.contientBadge, { backgroundColor: '#fdf4ff' }]}>
                            <Text style={[nStyles.contientText, { color: '#7c3aed' }]}>
                              Plus grand emballage
                            </Text>
                          </View>
                        )}

                        {/* Prix achat et vente — exigence client */}
                        <View style={nStyles.prixRow}>
                          <View style={nStyles.prixBox}>
                            <Text style={nStyles.prixLabel}>Achat</Text>
                            <Text style={nStyles.prixAchatVal}>{n.prixAchat.toLocaleString('fr-FR')} F</Text>
                          </View>
                          <View style={[nStyles.prixBox, { backgroundColor: '#f0fdf4' }]}>
                            <Text style={[nStyles.prixLabel, { color: '#15803d' }]}>Vente</Text>
                            <Text style={nStyles.prixVenteVal}>{n.prixVente.toLocaleString('fr-FR')} F</Text>
                          </View>
                        </View>

                        <View style={nStyles.stockRow}>
                          <Text style={nStyles.stockLabel}>Stock :</Text>
                          <View style={nStyles.stockBadge}>
                            <Text style={nStyles.stockVal}>{n.stock ?? 0}</Text>
                          </View>
                          <Text style={{ color: '#94a3b8', fontSize: 11 }}>(modifiable via crayon)</Text>
                        </View>

                        {/* Bouton decomposer si ce niveau a un enfant */}
                        {niveaux.some(c => c.parentId === n.id) && (
                          <TouchableOpacity
                            style={nStyles.decomposerBtn}
                            onPress={async () => {
                              const enfants = niveaux.filter(c => c.parentId === n.id);
                              const enfant = enfants[0];
                              Alert.alert(
                                'Ouvrir 1 ' + n.nom,
                                `Decomposer 1 ${n.nom} en ${n.facteur} ${enfant?.nom || 'unites'} ?`,
                                [
                                  { text: 'Annuler', style: 'cancel' },
                                  {
                                    text: 'Ouvrir', onPress: async () => {
                                      try {
                                        const res = await decomposer(n.id!);
                                        Alert.alert('OK', res.message || 'Decompose avec succes');
                                        if (produitCourant) await rechargerNiveaux(produitCourant.id);
                                      } catch (e: any) {
                                        Alert.alert('Erreur', e.response?.data?.message || 'Impossible de decomposer');
                                      }
                                    }
                                  },
                                ]
                              );
                            }}
                          >
                            <Text style={nStyles.decomposerText}>
                              Ouvrir 1 {n.nom} → {n.facteur} {niveaux.find(c => c.parentId === n.id)?.nom || 'unites'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              <Divider style={{ marginVertical: 16 }} />

              {/* Formulaire ajouter un niveau */}
              <View style={nStyles.addSection}>
                <Text style={nStyles.addTitle}>+ Ajouter un emballage</Text>
                <Text style={nStyles.addHint}>
                  Ex : Carton contient 20 Sachets → nom = "Sachet", contenu dans = "Carton"
                </Text>

                <TextInput label="Nom de l'emballage (ex: Carton, Sachet, Piece)"
                  value={formNiveau.nom}
                  onChangeText={v => setFormNiveau(f => ({ ...f, nom: v }))}
                  style={nStyles.inp} mode="outlined" />

                {/* Selecteur parent : "Il est contenu dans :" */}
                <Text style={nStyles.selectLabel}>Il est contenu dans :</Text>
                <View style={nStyles.parentSelect}>
                  <TouchableOpacity
                    style={[nStyles.parentOption, formNiveau.parentId === '' && nStyles.parentOptionActive]}
                    onPress={() => setFormNiveau(f => ({ ...f, parentId: '', facteur: '1' }))}
                  >
                    <Text style={[nStyles.parentOptionText, formNiveau.parentId === '' && nStyles.parentOptionTextActive]}>
                      {produitCourant?.nom} (produit principal)
                    </Text>
                  </TouchableOpacity>
                  {niveaux.map(pn => (
                    <TouchableOpacity
                      key={pn.id}
                      style={[nStyles.parentOption, formNiveau.parentId === String(pn.id) && nStyles.parentOptionActive]}
                      onPress={() => setFormNiveau(f => ({ ...f, parentId: String(pn.id), facteur: '1' }))}
                    >
                      <Text style={[nStyles.parentOptionText, formNiveau.parentId === String(pn.id) && nStyles.parentOptionTextActive]}>
                        {pn.nom}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Facteur — toujours visible */}
                <TextInput
                  label={(() => {
                    if (formNiveau.parentId) {
                      const parent = niveaux.find(n => String(n.id) === formNiveau.parentId);
                      return `Quantité dans 1 ${parent?.nom || 'unité parent'}`;
                    }
                    return `Quantité dans 1 ${produitCourant?.nom || 'produit'}`;
                  })()}
                  value={formNiveau.facteur}
                  onChangeText={v => setFormNiveau(f => ({ ...f, facteur: v }))}
                  keyboardType="numeric" style={nStyles.inp} mode="outlined" />

                <View style={nStyles.row2}>
                  <TextInput label="Prix achat (FCFA)" value={formNiveau.prixAchat}
                    onChangeText={v => setFormNiveau(f => ({ ...f, prixAchat: v }))}
                    keyboardType="numeric" style={[nStyles.inp, { flex: 1, marginRight: 6 }]} mode="outlined" />
                  <TextInput label="Prix vente (FCFA) *" value={formNiveau.prixVente}
                    onChangeText={v => setFormNiveau(f => ({ ...f, prixVente: v }))}
                    keyboardType="numeric" style={[nStyles.inp, { flex: 1 }]} mode="outlined" />
                </View>
                <TextInput label="Stock actuel" value={formNiveau.stock}
                  onChangeText={v => setFormNiveau(f => ({ ...f, stock: v }))}
                  keyboardType="numeric" style={nStyles.inp} mode="outlined" />
                <Button mode="contained" onPress={ajouterNiveauFn} loading={savingNiveau}
                  style={{ marginTop: 8, borderRadius: 10 }} contentStyle={{ height: 48 }}
                  buttonColor="#16a34a" icon="plus">
                  Ajouter cet emballage
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
  // Chaine visuelle
  chaineContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 14 },
  chaineBadge: { backgroundColor: '#1a56db', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chaineNom: { color: '#fff', fontWeight: '700', fontSize: 13 },
  chaineArrow: { color: '#64748b', fontSize: 18, fontWeight: '700' },
  // Cartes niveaux
  niveauCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 2 },
  niveauHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  niveauNom: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  niveauActions: { flexDirection: 'row' },
  contientBadge: { backgroundColor: '#eff6ff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 6, marginBottom: 10 },
  contientText: { color: '#1e40af', fontSize: 13, fontWeight: '600' },
  // Prix achat + vente cote a cote
  prixRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  prixBox: { flex: 1, backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, alignItems: 'center' },
  prixLabel: { fontSize: 10, color: '#ef4444', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  prixAchatVal: { fontSize: 15, fontWeight: '800', color: '#b91c1c' },
  prixVenteVal: { fontSize: 15, fontWeight: '800', color: '#15803d' },
  // Stock
  stockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stockLabel: { color: '#64748b', fontSize: 13, marginRight: 8 },
  stockBadge: { backgroundColor: '#e0e7ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginRight: 6 },
  stockVal: { color: '#3730a3', fontWeight: '700', fontSize: 14 },
  // Bouton decomposer
  decomposerBtn: { backgroundColor: '#fff7ed', borderRadius: 8, borderWidth: 1, borderColor: '#fdba74', paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', marginTop: 4 },
  decomposerText: { color: '#c2410c', fontWeight: '600', fontSize: 13 },
  // Formulaire edition
  niveauEditTitle: { fontWeight: '700', color: '#7c3aed', marginBottom: 10 },
  // Selecteur parent
  selectLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  parentSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  parentOption: { borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f8fafc' },
  parentOptionActive: { borderColor: '#7c3aed', backgroundColor: '#faf5ff' },
  parentOptionText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  parentOptionTextActive: { color: '#7c3aed', fontWeight: '700' },
  // Formulaire ajout
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
