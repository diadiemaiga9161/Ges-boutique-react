import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput, FlatList } from 'react-native';
import { Text, Button, ActivityIndicator, Chip, Modal, Portal, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCommandes, createCommande, updateCommande, validerCommande, deleteCommande, getProduits, getClients } from '../services/api.service';

type StatutCommande = 'BROUILLON' | 'VALIDEE';

interface LigneCommande {
  id?: number;
  produitId?: number;
  produitNom?: string;
  produit?: { id: number; nom: string; prixVente: number };
  quantite: number;
  prixUnitaire: number;
  sousTotal?: number;
}

interface Commande {
  id: number;
  numeroCommande: string;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  client?: { id: number; nom: string; prenom: string };
  lignes: LigneCommande[];
  montantTotal: number;
  modePaiement: string;
  estCredit: boolean;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  statut: StatutCommande;
  dateCommande: string;
  dateValidation?: string;
  notes?: string;
}

interface LigneForm {
  produitId: number;
  produitNom: string;
  prixOriginal: number;
  prixUnitaire: string;
  quantite: number;
}

const MODES = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'WAVE_MONEY', 'CARTE_BANCAIRE', 'VIREMENT'];
const MODES_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
  WAVE_MONEY: 'Wave', CARTE_BANCAIRE: 'Carte', VIREMENT: 'Virement'
};

function formatMontant(v: number) {
  return new Intl.NumberFormat('fr-FR').format(v || 0) + ' FCFA';
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getClientNom(c: Commande): string {
  return [c.clientNom, c.clientPrenom].filter(Boolean).join(' ') || c.client?.nom || 'N/A';
}

export default function CommandesScreen() {
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [statutFilter, setStatutFilter] = useState<'' | 'BROUILLON' | 'VALIDEE'>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [produits, setProduits] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [lignesForm, setLignesForm] = useState<LigneForm[]>([]);

  const [searchProduit, setSearchProduit] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [showProduitDrop, setShowProduitDrop] = useState(false);
  const [showClientDrop, setShowClientDrop] = useState(false);

  const [userId, setUserId] = useState<number>(0);

  const [form, setForm] = useState({
    clientId: null as number | null,
    clientNom: '',
    clientPrenom: '',
    clientTelephone: '',
    modePaiement: 'ESPECES',
    referencePaiement: '',
    estCredit: false,
    montantVerse: '',
    dateEcheance: '',
    notes: ''
  });

  useFocusEffect(useCallback(() => {
    charger();
    AsyncStorage.getItem('user').then(raw => {
      if (raw) { const u = JSON.parse(raw); setUserId(u.id || 0); }
    });
    getProduits().then((r: any) => setProduits(r.data || [])).catch(() => {});
    getClients().then((r: any) => {
      const data = r.data;
      setClients(data?.content || data || []);
    }).catch(() => {});
  }, []));

  const charger = async () => {
    setLoading(true);
    try {
      const r: any = await getCommandes();
      setCommandes(r.data || []);
    } catch {}
    setLoading(false);
  };

  const commandesFiltrees = commandes.filter(c => {
    if (statutFilter && c.statut !== statutFilter) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (c.numeroCommande || '').toLowerCase().includes(t) ||
             (c.clientNom || '').toLowerCase().includes(t);
    }
    return true;
  });

  const totalCommande = lignesForm.reduce((s, l) => s + Number(l.prixUnitaire || 0) * l.quantite, 0);
  const resteAPayer = Math.max(0, totalCommande - Number(form.montantVerse || 0));

  const nbBrouillons = commandes.filter(c => c.statut === 'BROUILLON').length;
  const nbValidees = commandes.filter(c => c.statut === 'VALIDEE').length;
  const totalValidees = commandes.filter(c => c.statut === 'VALIDEE').reduce((s, c) => s + (c.montantTotal || 0), 0);

  // ─── Produit search ──────────────────────────────────────────────────────
  const produitsFiltres = searchProduit
    ? produits.filter((p: any) => p.nom.toLowerCase().includes(searchProduit.toLowerCase())).slice(0, 8)
    : produits.slice(0, 8);

  const selectionnerProduit = (p: any) => {
    setLignesForm(prev => {
      const ex = prev.find(l => l.produitId === p.id);
      if (ex) return prev.map(l => l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l);
      return [...prev, { produitId: p.id, produitNom: p.nom, prixOriginal: p.prixVente, prixUnitaire: String(p.prixVente), quantite: 1 }];
    });
    setSearchProduit('');
    setShowProduitDrop(false);
  };

  const supprimerLigne = (i: number) => setLignesForm(prev => prev.filter((_, idx) => idx !== i));
  const changerQty = (i: number, d: number) => setLignesForm(prev =>
    prev.map((l, idx) => idx === i ? { ...l, quantite: Math.max(1, l.quantite + d) } : l)
  );

  // ─── Client search ───────────────────────────────────────────────────────
  const clientsFiltres = searchClient
    ? clients.filter((c: any) => `${c.nom} ${c.prenom} ${c.numeroTelephone}`.toLowerCase().includes(searchClient.toLowerCase())).slice(0, 6)
    : clients.slice(0, 6);

  const selectionnerClient = (c: any) => {
    setForm(f => ({ ...f, clientId: c.id, clientNom: c.nom, clientPrenom: c.prenom || '', clientTelephone: c.numeroTelephone || '' }));
    setSearchClient(`${c.nom} ${c.prenom || ''}`.trim());
    setShowClientDrop(false);
  };

  // ─── Modal ───────────────────────────────────────────────────────────────
  const ouvrirCreer = () => {
    setEditingId(null);
    setLignesForm([]);
    setForm({ clientId: null, clientNom: '', clientPrenom: '', clientTelephone: '', modePaiement: 'ESPECES', referencePaiement: '', estCredit: false, montantVerse: '', dateEcheance: '', notes: '' });
    setSearchClient('');
    setSearchProduit('');
    setShowModal(true);
  };

  const ouvrirModifier = (c: Commande) => {
    setEditingId(c.id);
    setForm({
      clientId: c.client?.id || null,
      clientNom: c.clientNom || '',
      clientPrenom: c.clientPrenom || '',
      clientTelephone: c.clientTelephone || '',
      modePaiement: c.modePaiement || 'ESPECES',
      referencePaiement: '',
      estCredit: c.estCredit || false,
      montantVerse: String(c.montantVerse || ''),
      dateEcheance: c.dateEcheance?.split('T')[0] || '',
      notes: c.notes || ''
    });
    setSearchClient(getClientNom(c));
    setLignesForm((c.lignes || []).map(l => ({
      produitId: l.produit?.id || l.produitId || 0,
      produitNom: l.produit?.nom || l.produitNom || '',
      prixOriginal: l.produit?.prixVente || l.prixUnitaire,
      prixUnitaire: String(l.prixUnitaire),
      quantite: l.quantite
    })));
    setShowModal(true);
  };

  const enregistrer = async () => {
    if (lignesForm.length === 0) { Alert.alert('Erreur', 'Ajoutez au moins un produit'); return; }
    setSubmitting(true);
    const request = {
      vendeurId: userId,
      clientId: form.clientId || undefined,
      clientNom: form.clientNom || undefined,
      clientPrenom: form.clientPrenom || undefined,
      clientTelephone: form.clientTelephone || undefined,
      lignes: lignesForm.map(l => ({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: Number(l.prixUnitaire) })),
      modePaiement: form.modePaiement,
      referencePaiement: form.referencePaiement || undefined,
      estCredit: form.estCredit,
      montantVerse: form.estCredit ? Number(form.montantVerse || 0) : undefined,
      dateEcheance: form.estCredit && form.dateEcheance ? form.dateEcheance : undefined,
      notes: form.notes || undefined
    };
    try {
      if (editingId) await updateCommande(editingId, request);
      else await createCommande(request);
      setShowModal(false);
      charger();
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Erreur lors de l\'enregistrement');
    }
    setSubmitting(false);
  };

  const handleValider = (c: Commande) => {
    Alert.alert('Valider ?', `Commande ${c.numeroCommande} → vente créée, stock décrémenté.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Valider', onPress: async () => {
        try { await validerCommande(c.id); charger(); }
        catch (e: any) { Alert.alert('Erreur', e.response?.data?.message || 'Erreur'); }
      }}
    ]);
  };

  const handleSupprimer = (c: Commande) => {
    Alert.alert('Supprimer ?', `Supprimer ${c.numeroCommande} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await deleteCommande(c.id); charger(); }
        catch (e: any) { Alert.alert('Erreur', e.response?.data?.message || 'Impossible'); }
      }}
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
          <Text style={styles.statVal}>{nbBrouillons}</Text>
          <Text style={styles.statLbl}>Brouillons</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#10b981' }]}>
          <Text style={styles.statVal}>{nbValidees}</Text>
          <Text style={styles.statLbl}>Validées</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#8b5cf6', flex: 2 }]}>
          <Text style={[styles.statVal, { fontSize: 13 }]}>{formatMontant(totalValidees)}</Text>
          <Text style={styles.statLbl}>CA validé</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filtersRow}>
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Rechercher..."
          placeholderTextColor="#9ca3af"
        />
        <View style={styles.chipsRow}>
          {(['', 'BROUILLON', 'VALIDEE'] as const).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, statutFilter === s && styles.chipActive]}
              onPress={() => setStatutFilter(s)}>
              <Text style={[styles.chipText, statutFilter === s && styles.chipTextActive]}>
                {s === '' ? 'Toutes' : s === 'BROUILLON' ? 'Brouillons' : 'Validées'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Bouton créer */}
      <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
        <Button mode="contained" onPress={ouvrirCreer} icon="plus" buttonColor="#1a56db">
          Nouvelle commande
        </Button>
      </View>

      {/* Liste */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1a56db" />
      ) : (
        <FlatList
          data={commandesFiltrees}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucune commande</Text>
            </View>
          }
          renderItem={({ item: c }) => (
            <View style={[styles.card, c.statut === 'VALIDEE' && styles.cardValidee]}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.cardNumero}>{c.numeroCommande}</Text>
                  <View style={[styles.badge, c.statut === 'VALIDEE' ? styles.badgeGreen : styles.badgeYellow]}>
                    <Text style={styles.badgeText}>{c.statut === 'VALIDEE' ? 'Validée' : 'Brouillon'}</Text>
                  </View>
                </View>
                <Text style={styles.cardDate}>{formatDate(c.dateCommande)}</Text>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardClient}>👤 {getClientNom(c)}</Text>
                <Text style={styles.cardMontant}>{formatMontant(c.montantTotal)}</Text>
              </View>

              {/* Lignes aperçu */}
              <View style={styles.linesRow}>
                {c.lignes.slice(0, 3).map((l, i) => (
                  <View key={i} style={styles.lineChip}>
                    <Text style={styles.lineChipText}>{l.produit?.nom || l.produitNom} ×{l.quantite}</Text>
                  </View>
                ))}
                {c.lignes.length > 3 && <Text style={{ color: '#6b7280', fontSize: 11 }}>+{c.lignes.length - 3}</Text>}
              </View>

              {c.estCredit && (
                <View style={styles.creditInfo}>
                  <Text style={styles.creditText}>Versé : {formatMontant(c.montantVerse)} · Reste : {formatMontant(c.montantRestant)}</Text>
                </View>
              )}

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => ouvrirModifier(c)}>
                  <Text style={styles.actionBtnText}>✏️ Modifier</Text>
                </TouchableOpacity>
                {c.statut === 'BROUILLON' && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGreen]} onPress={() => handleValider(c)}>
                    <Text style={[styles.actionBtnText, { color: '#16a34a' }]}>✔ Valider</Text>
                  </TouchableOpacity>
                )}
                {c.statut === 'BROUILLON' && (
                  <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRed]} onPress={() => handleSupprimer(c)}>
                    <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>🗑</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* ─── MODAL ─────────────────────────────────────────────────── */}
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editingId ? 'Modifier commande' : 'Nouvelle commande'}</Text>

            {/* Client */}
            <Text style={styles.sectionTitle}>👤 Client</Text>
            {form.clientId ? (
              <View style={styles.selectedClient}>
                <Text style={{ flex: 1, fontSize: 13 }}>{form.clientNom} {form.clientPrenom} · {form.clientTelephone}</Text>
                <TouchableOpacity onPress={() => setForm(f => ({ ...f, clientId: null, clientNom: '', clientPrenom: '', clientTelephone: '' }))}>
                  <Text style={{ color: '#dc2626', fontSize: 18 }}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <TextInput
                  style={styles.input}
                  value={searchClient}
                  onChangeText={v => { setSearchClient(v); setShowClientDrop(true); }}
                  placeholder="Rechercher un client..."
                  placeholderTextColor="#9ca3af"
                />
                {showClientDrop && clientsFiltres.length > 0 && (
                  <View style={styles.dropdown}>
                    {clientsFiltres.map((cl: any) => (
                      <TouchableOpacity key={cl.id} style={styles.dropItem} onPress={() => selectionnerClient(cl)}>
                        <Text style={{ fontSize: 13 }}>{cl.nom} {cl.prenom} — {cl.numeroTelephone}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TextInput style={styles.input} value={form.clientNom} onChangeText={v => setForm(f => ({ ...f, clientNom: v }))} placeholder="Nom" placeholderTextColor="#9ca3af" />
                <TextInput style={styles.input} value={form.clientPrenom} onChangeText={v => setForm(f => ({ ...f, clientPrenom: v }))} placeholder="Prénom" placeholderTextColor="#9ca3af" />
                <TextInput style={styles.input} value={form.clientTelephone} onChangeText={v => setForm(f => ({ ...f, clientTelephone: v }))} placeholder="Téléphone" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
              </View>
            )}

            {/* Produits */}
            <Text style={styles.sectionTitle}>📦 Produits</Text>
            <View>
              <TextInput
                style={styles.input}
                value={searchProduit}
                onChangeText={v => { setSearchProduit(v); setShowProduitDrop(true); }}
                placeholder="Rechercher un produit..."
                placeholderTextColor="#9ca3af"
              />
              {showProduitDrop && produitsFiltres.length > 0 && (
                <View style={styles.dropdown}>
                  {produitsFiltres.map((p: any) => (
                    <TouchableOpacity key={p.id} style={styles.dropItem} onPress={() => selectionnerProduit(p)}>
                      <Text style={{ fontSize: 13 }}>{p.nom} — {formatMontant(p.prixVente)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {lignesForm.map((l, i) => (
              <View key={i} style={styles.ligneRow}>
                <Text style={{ flex: 1, fontSize: 12, fontWeight: '600' }}>{l.produitNom}</Text>
                <View style={styles.qtyCtrl}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changerQty(i, -1)}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity>
                  <Text style={styles.qtyVal}>{l.quantite}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changerQty(i, 1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                </View>
                <TextInput
                  style={styles.prixInput}
                  value={l.prixUnitaire}
                  onChangeText={v => setLignesForm(prev => prev.map((x, idx) => idx === i ? { ...x, prixUnitaire: v } : x))}
                  keyboardType="numeric"
                />
                <TouchableOpacity onPress={() => supprimerLigne(i)} style={{ padding: 4 }}>
                  <Text style={{ color: '#dc2626', fontSize: 16 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}

            {lignesForm.length > 0 && (
              <View style={styles.totalBar}>
                <Text>Total</Text>
                <Text style={{ fontWeight: 'bold', color: '#1a56db', fontSize: 15 }}>{formatMontant(totalCommande)}</Text>
              </View>
            )}

            {/* Paiement */}
            <Text style={styles.sectionTitle}>💰 Paiement</Text>
            <View style={styles.modePaiRow}>
              {MODES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modePaiChip, form.modePaiement === m && styles.modePaiChipActive]}
                  onPress={() => setForm(f => ({ ...f, modePaiement: m }))}>
                  <Text style={[styles.modePaiText, form.modePaiement === m && { color: '#fff' }]}>{MODES_LABELS[m]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.creditToggleRow}>
              <Text style={{ fontSize: 14 }}>Paiement à crédit</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, form.estCredit && styles.toggleBtnActive]}
                onPress={() => setForm(f => ({ ...f, estCredit: !f.estCredit }))}>
                <View style={[styles.toggleThumb, form.estCredit && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {form.estCredit && (
              <>
                <TextInput style={styles.input} value={form.montantVerse} onChangeText={v => setForm(f => ({ ...f, montantVerse: v }))} placeholder="Montant versé maintenant" placeholderTextColor="#9ca3af" keyboardType="numeric" />
                {totalCommande > 0 && (
                  <Text style={styles.resteInfo}>Reste à payer : {formatMontant(resteAPayer)}</Text>
                )}
                <TextInput style={styles.input} value={form.dateEcheance} onChangeText={v => setForm(f => ({ ...f, dateEcheance: v }))} placeholder="Date échéance (YYYY-MM-DD)" placeholderTextColor="#9ca3af" />
              </>
            )}

            <TextInput style={[styles.input, { height: 60 }]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Notes..." placeholderTextColor="#9ca3af" multiline />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 }}>
              <Button mode="outlined" onPress={() => setShowModal(false)} style={{ flex: 1 }}>Annuler</Button>
              <Button mode="contained" onPress={enregistrer} loading={submitting} style={{ flex: 1 }} buttonColor="#1a56db">
                {editingId ? 'Modifier' : 'Enregistrer'}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  statsRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 6 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, borderLeftWidth: 3, elevation: 2 },
  statVal: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  statLbl: { fontSize: 10, color: '#6b7280' },

  filtersRow: { paddingHorizontal: 12, paddingBottom: 6 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, padding: 10, fontSize: 13, color: '#1f2937', marginBottom: 6, elevation: 1 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#1a56db' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  empty: { padding: 60, alignItems: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 15 },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#f59e0b', elevation: 3 },
  cardValidee: { borderLeftColor: '#10b981' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardNumero: { fontWeight: '700', fontSize: 13 },
  cardDate: { fontSize: 11, color: '#6b7280' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardClient: { fontSize: 13, color: '#374151' },
  cardMontant: { fontSize: 15, fontWeight: '700', color: '#1a56db' },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeGreen: { backgroundColor: '#d1fae5' },
  badgeYellow: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 10, fontWeight: '600', color: '#374151' },

  linesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  lineChip: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  lineChipText: { fontSize: 11, color: '#1e40af', fontWeight: '500' },

  creditInfo: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 6, marginBottom: 4 },
  creditText: { fontSize: 11, color: '#dc2626' },

  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, padding: 7, borderRadius: 8, backgroundColor: '#eff6ff', alignItems: 'center' },
  actionBtnGreen: { backgroundColor: '#f0fdf4' },
  actionBtnRed: { flex: 0, paddingHorizontal: 12 },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#1a56db' },

  // Modal
  modal: { backgroundColor: '#fff', margin: 12, borderRadius: 16, padding: 16, maxHeight: '90%' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e3a8a', marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1e3a8a', marginTop: 14, marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 13, color: '#1f2937', marginBottom: 8 },

  dropdown: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, elevation: 4, maxHeight: 140, overflow: 'hidden', marginBottom: 8 },
  dropItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },

  selectedClient: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 8 },

  ligneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, marginBottom: 6, flexWrap: 'wrap' },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1a56db', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: '#fff', fontSize: 16, lineHeight: 20 },
  qtyVal: { minWidth: 24, textAlign: 'center', fontWeight: '600' },
  prixInput: { width: 80, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 5, fontSize: 12, textAlign: 'right' },

  totalBar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, marginBottom: 8 },

  modePaiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  modePaiChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#e5e7eb' },
  modePaiChipActive: { backgroundColor: '#1a56db' },
  modePaiText: { fontSize: 11, fontWeight: '500', color: '#374151' },

  creditToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  toggleBtn: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#d1d5db', justifyContent: 'center', paddingHorizontal: 2 },
  toggleBtnActive: { backgroundColor: '#1a56db' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', elevation: 2 },
  toggleThumbActive: { marginLeft: 20 },

  resteInfo: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, fontSize: 13, color: '#dc2626', marginBottom: 8 },
});
