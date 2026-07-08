import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, Alert, RefreshControl,
  TouchableOpacity, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  Text, Card, FAB, Searchbar, ActivityIndicator,
  Portal, Modal as PaperModal, TextInput, Button,
} from 'react-native-paper';
import {
  getClients, createClient, updateClient, deleteClient,
  getClientVentes, getCreditsNonRegles,
} from '../services/api.service';
import { cacheClients } from '../db/database';
import { Client } from '../types';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// ─── Types locaux ─────────────────────────────────────────────────────────────
interface VenteClient {
  id: number;
  dateVente?: string;
  montantTotal?: number;
  modePaiement?: string;
  estCredit?: boolean;
  numeroVente?: string;
}

interface CreditClient {
  venteId: number;
  numeroVente?: string;
  clientNom?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  estReglee?: boolean;
}

type Onglet = 'infos' | 'achats' | 'credits';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function money(v: number) { return (v ?? 0).toLocaleString('fr-FR') + ' FCFA'; }
function fdate(d?: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR'); }
function initiales(nom: string) { return nom.trim().split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2); }

// ─── Composant principal ───────────────────────────────────────────────────────
export default function ClientsScreen() {
  const { lang } = useLang();

  // ── Liste ──────────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Modal ajout / modification ─────────────────────────────────────────────
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' });

  // ── Modal détail ───────────────────────────────────────────────────────────
  const [showDetail, setShowDetail] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('infos');
  const [ventes, setVentes] = useState<VenteClient[]>([]);
  const [credits, setCredits] = useState<CreditClient[]>([]);
  const [loadingVentes, setLoadingVentes] = useState(false);
  const [loadingCredits, setLoadingCredits] = useState(false);

  // ── Chargement liste ───────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const res = await getClients();
      const data: Client[] = res.data?.data || res.data || [];
      setClients(data);
      setFiltered(data);
      await cacheClients(data);
    } catch { /* réseau indisponible, liste offline déjà en cache */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  useEffect(() => {
    if (!search) { setFiltered(clients); return; }
    const q = search.toLowerCase();
    setFiltered(clients.filter(c =>
      c.nom.toLowerCase().includes(q) || (c.telephone ?? '').includes(q),
    ));
  }, [search, clients]);

  // ── Ajout / Modification ───────────────────────────────────────────────────
  const ouvrirFormAjout = () => {
    setEditingClient(null);
    setForm({ nom: '', telephone: '', email: '', adresse: '' });
    setShowFormModal(true);
  };

  const ouvrirFormModif = (client: Client) => {
    setEditingClient(client);
    setForm({
      nom: client.nom,
      telephone: client.telephone ?? '',
      email: client.email ?? '',
      adresse: client.adresse ?? '',
    });
    setShowDetail(false);
    setShowFormModal(true);
  };

  const enregistrer = async () => {
    if (!form.nom.trim()) return;
    try {
      if (editingClient) {
        await updateClient(editingClient.id, form);
      } else {
        await createClient(form);
      }
      setShowFormModal(false);
      setForm({ nom: '', telephone: '', email: '', adresse: '' });
      setEditingClient(null);
      await charger();
    } catch {
      Alert.alert(tr('erreur', lang), editingClient ? 'Impossible de modifier le client' : 'Impossible d\'ajouter le client');
    }
  };

  // ── Suppression ────────────────────────────────────────────────────────────
  const confirmerSuppression = (client: Client) => {
    Alert.alert(
      'Supprimer ce client ?',
      `${client.nom} sera définitivement supprimé.`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClient(client.id);
              setShowDetail(false);
              await charger();
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible de supprimer ce client');
            }
          },
        },
      ],
    );
  };

  // ── Ouverture modal détail ─────────────────────────────────────────────────
  const ouvrirDetail = (client: Client) => {
    setSelectedClient(client);
    setOnglet('infos');
    setVentes([]);
    setCredits([]);
    setShowDetail(true);
  };

  // ── Chargement onglet Achats ───────────────────────────────────────────────
  const chargerVentes = useCallback(async (client: Client) => {
    setLoadingVentes(true);
    try {
      // Essaie d'abord par clientId, puis filtre par nom si vide
      let data: VenteClient[] = [];
      try {
        const res = await getClientVentes(client.id);
        data = res.data?.data || res.data || [];
      } catch {
        data = [];
      }
      // Fallback : si aucun résultat, tente filtre par nom côté serveur
      if (!data.length) {
        try {
          const { getVentes } = await import('../services/api.service');
          const res2 = await getVentes({ clientNom: client.nom });
          data = res2.data?.data || res2.data || [];
        } catch { /* ignore */ }
      }
      setVentes(data);
    } catch { /* ignore */ }
    setLoadingVentes(false);
  }, []);

  // ── Chargement onglet Crédits ──────────────────────────────────────────────
  const chargerCredits = useCallback(async (client: Client) => {
    setLoadingCredits(true);
    try {
      const res = await getCreditsNonRegles();
      const all: CreditClient[] = res.data?.data || res.data?.credits || res.data || [];
      // Filtre côté frontend par nom client
      const nom = client.nom.toLowerCase().trim();
      const filtered2 = all.filter((c: CreditClient) =>
        (c.clientNom ?? '').toLowerCase().trim() === nom,
      );
      setCredits(filtered2);
    } catch { /* ignore */ }
    setLoadingCredits(false);
  }, []);

  // ── Changement d'onglet dans le détail ────────────────────────────────────
  const changerOnglet = (o: Onglet) => {
    setOnglet(o);
    if (!selectedClient) return;
    if (o === 'achats' && !ventes.length && !loadingVentes) chargerVentes(selectedClient);
    if (o === 'credits' && !credits.length && !loadingCredits) chargerCredits(selectedClient);
  };

  // ── KPI dérivés ────────────────────────────────────────────────────────────
  const totalCAClient = ventes.reduce((s, v) => s + (v.montantTotal ?? 0), 0);
  const totalRestantDu = credits.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* ── Barre de recherche ─────────────────────────────────────────────── */}
      <Searchbar
        placeholder={tr('recherche_client', lang)}
        value={search}
        onChangeText={setSearch}
        style={styles.search}
      />

      {/* ── Liste clients ──────────────────────────────────────────────────── */}
      <FlatList
        data={filtered}
        keyExtractor={c => String(c.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => ouvrirDetail(item)} activeOpacity={0.8}>
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initiales(item.nom)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={styles.clientNom}>{item.nom}</Text>
                  {item.telephone ? <Text style={styles.sub}>{item.telephone}</Text> : null}
                  {item.soldeCredit && item.soldeCredit > 0 ? (
                    <Text style={styles.credit}>Credit du : {money(item.soldeCredit)}</Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{tr('aucun_client', lang)}</Text>}
      />

      {/* ── FAB ajout ──────────────────────────────────────────────────────── */}
      <FAB icon="plus" style={styles.fab} onPress={ouvrirFormAjout} />

      {/* ════════════════════════════════════════════════════════════════════
          MODAL AJOUT / MODIFICATION
      ════════════════════════════════════════════════════════════════════ */}
      <Portal>
        <PaperModal
          visible={showFormModal}
          onDismiss={() => { setShowFormModal(false); setEditingClient(null); }}
          contentContainerStyle={styles.paperModal}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>
              {editingClient ? tr('modifier', lang) + ' ' + tr('clients', lang).toLowerCase() : tr('nouveau_client', lang)}
            </Text>
            <TextInput
              label={tr('nom_client', lang)}
              value={form.nom}
              onChangeText={t => setForm({ ...form, nom: t })}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label={tr('telephone', lang)}
              value={form.telephone}
              onChangeText={t => setForm({ ...form, telephone: t })}
              mode="outlined"
              keyboardType="phone-pad"
              style={styles.input}
            />
            <TextInput
              label={tr('email', lang)}
              value={form.email}
              onChangeText={t => setForm({ ...form, email: t })}
              mode="outlined"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              label={tr('adresse', lang)}
              value={form.adresse}
              onChangeText={t => setForm({ ...form, adresse: t })}
              mode="outlined"
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={enregistrer}
              style={{ marginTop: 8, backgroundColor: '#1a56db' }}
            >
              {editingClient ? tr('enregistrer', lang) : tr('enregistrer', lang)}
            </Button>
          </KeyboardAvoidingView>
        </PaperModal>
      </Portal>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL DETAIL CLIENT
      ════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showDetail}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Poignee */}
            <View style={styles.handle} />

            {/* Header modal : avatar + nom + fermer */}
            {selectedClient && (
              <View style={styles.detailHeader}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>{initiales(selectedClient.nom)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailNom}>{selectedClient.nom}</Text>
                  {selectedClient.telephone ? (
                    <Text style={styles.detailSub}>{selectedClient.telephone}</Text>
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Barre onglets */}
            <View style={styles.tabBar}>
              {(['infos', 'achats', 'credits'] as Onglet[]).map(o => {
                const labels: Record<Onglet, string> = { infos: 'Infos', achats: tr('achat', lang), credits: tr('credits', lang) };
                return (
                  <TouchableOpacity
                    key={o}
                    style={[styles.tabBtn, onglet === o && styles.tabBtnActive]}
                    onPress={() => changerOnglet(o)}
                  >
                    <Text style={[styles.tabLabel, onglet === o && styles.tabLabelActive]}>
                      {labels[o]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Contenu onglets */}
            <ScrollView style={styles.detailBody} contentContainerStyle={{ paddingBottom: 20 }}>

              {/* ── ONGLET INFOS ── */}
              {onglet === 'infos' && selectedClient && (
                <View>
                  <View style={styles.infoCard}>
                    {[
                      [tr('nom_client', lang).replace(' *', ''), selectedClient.nom],
                      [tr('telephone', lang), selectedClient.telephone ?? '—'],
                      [tr('email', lang), selectedClient.email ?? '—'],
                      [tr('adresse', lang), selectedClient.adresse ?? '—'],
                    ].map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoVal}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  {selectedClient.soldeCredit && selectedClient.soldeCredit > 0 ? (
                    <View style={styles.alertCredit}>
                      <Text style={styles.alertCreditText}>
                        {money(selectedClient.soldeCredit)} a rembourser
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.btnModifier}
                      onPress={() => ouvrirFormModif(selectedClient)}
                    >
                      <Text style={styles.btnModifierText}>{tr('modifier', lang)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnSupprimer}
                      onPress={() => confirmerSuppression(selectedClient)}
                    >
                      <Text style={styles.btnSupprimerText}>{tr('supprimer', lang)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── ONGLET ACHATS ── */}
              {onglet === 'achats' && (
                <>
                  {loadingVentes ? (
                    <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
                  ) : (
                    <>
                      {/* KPI Total CA */}
                      <View style={styles.kpiBox}>
                        <Text style={styles.kpiLabel}>Total CA client</Text>
                        <Text style={styles.kpiVal}>{money(totalCAClient)}</Text>
                        <Text style={styles.kpiSub}>{ventes.length} vente(s)</Text>
                      </View>

                      {ventes.length === 0 ? (
                        <Text style={styles.emptyOnglet}>Aucune vente pour ce client</Text>
                      ) : (
                        ventes.map(v => (
                          <View key={v.id} style={styles.venteItem}>
                            <View style={styles.venteTop}>
                              <Text style={styles.venteDate}>{fdate(v.dateVente)}</Text>
                              {v.estCredit ? (
                                <View style={styles.badgeCredit}>
                                  <Text style={styles.badgeCreditText}>CREDIT</Text>
                                </View>
                              ) : null}
                              <Text style={styles.venteMontant}>{money(v.montantTotal ?? 0)}</Text>
                            </View>
                            <Text style={styles.venteMode}>
                              {v.modePaiement ?? 'ESPECES'}
                              {v.numeroVente ? `  ·  N° ${v.numeroVente}` : ''}
                            </Text>
                          </View>
                        ))
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── ONGLET CREDITS ── */}
              {onglet === 'credits' && (
                <>
                  {loadingCredits ? (
                    <ActivityIndicator size="large" color="#dc2626" style={{ marginTop: 40 }} />
                  ) : (
                    <>
                      {/* KPI Total restant du */}
                      {totalRestantDu > 0 ? (
                        <View style={[styles.kpiBox, styles.kpiBoxRed]}>
                          <Text style={[styles.kpiLabel, { color: '#dc2626' }]}>Total restant du</Text>
                          <Text style={[styles.kpiVal, { color: '#dc2626' }]}>{money(totalRestantDu)}</Text>
                        </View>
                      ) : (
                        <View style={[styles.kpiBox, { borderColor: '#16a34a' }]}>
                          <Text style={[styles.kpiLabel, { color: '#16a34a' }]}>Aucun credit en cours</Text>
                        </View>
                      )}

                      {credits.length === 0 ? (
                        <Text style={styles.emptyOnglet}>Aucun credit pour ce client</Text>
                      ) : (
                        credits.map(c => {
                          const pct = c.montantTotal > 0
                            ? Math.min(1, c.montantVerse / c.montantTotal)
                            : 0;
                          return (
                            <View key={c.venteId} style={[styles.creditItem, c.estReglee && styles.creditItemRegle]}>
                              <View style={styles.creditTop}>
                                <Text style={styles.creditNum}>{c.numeroVente ?? `Vente #${c.venteId}`}</Text>
                                <View style={[styles.statutBadge, c.estReglee ? styles.statutRegle : styles.statutEnCours]}>
                                  <Text style={[styles.statutText, c.estReglee ? { color: '#16a34a' } : { color: '#d97706' }]}>
                                    {c.estReglee ? 'Solde' : 'En cours'}
                                  </Text>
                                </View>
                              </View>

                              {/* Barre de progression */}
                              <View style={styles.progressWrap}>
                                <View style={styles.progressBg}>
                                  <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
                                </View>
                                <View style={styles.progressLabels}>
                                  <Text style={styles.progressText}>Verse {money(c.montantVerse)}</Text>
                                  <Text style={styles.progressText}>/ {money(c.montantTotal)}</Text>
                                </View>
                              </View>

                              {!c.estReglee && (
                                <Text style={styles.creditRestant}>
                                  Restant : {money(c.montantRestant)}
                                </Text>
                              )}
                            </View>
                          );
                        })
                      )}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            {/* Pied modal */}
            <View style={styles.detailFoot}>
              <TouchableOpacity style={styles.btnFermer} onPress={() => setShowDetail(false)}>
                <Text style={styles.btnFermerText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Liste
  search: { margin: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  cardContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  clientNom: { fontWeight: 'bold', color: '#1e293b' },
  sub: { color: '#666', marginTop: 2, fontSize: 13 },
  credit: { color: '#dc2626', fontWeight: '600', marginTop: 4, fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  chevron: { color: '#94a3b8', fontSize: 22, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 20, right: 20 },

  // Modal ajout / modification (Paper)
  paperModal: {
    backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20,
  },
  input: { marginBottom: 12 },

  // Modal detail (RN)
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2,
    alignSelf: 'center', marginTop: 10,
  },

  // Header detail
  detailHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  detailAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center',
  },
  detailAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  detailNom: { fontWeight: 'bold', fontSize: 17, color: '#1e293b' },
  detailSub: { color: '#64748b', fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#64748b', fontSize: 18, fontWeight: '600' },

  // Onglets
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  tabBtn: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: '#1a56db' },
  tabLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tabLabelActive: { color: '#1a56db', fontWeight: 'bold' },

  // Corps detail
  detailBody: { padding: 16, maxHeight: 440 },

  // Infos
  infoCard: {
    backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  infoLabel: { color: '#64748b', fontSize: 13 },
  infoVal: { color: '#1e293b', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Alerte credit
  alertCredit: {
    backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#fca5a5', alignItems: 'center',
  },
  alertCreditText: { color: '#dc2626', fontWeight: 'bold', fontSize: 15 },

  // Actions infos
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnModifier: {
    flex: 1, backgroundColor: '#1a56db', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  btnModifierText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnSupprimer: {
    flex: 1, backgroundColor: '#fef2f2', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#fca5a5',
  },
  btnSupprimerText: { color: '#dc2626', fontWeight: 'bold', fontSize: 14 },

  // KPI achats / credits
  kpiBox: {
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 14,
    marginBottom: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  kpiBoxRed: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  kpiLabel: { color: '#475569', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  kpiVal: { color: '#1a56db', fontWeight: 'bold', fontSize: 22, marginTop: 4 },
  kpiSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  // Ventes
  venteItem: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  venteTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  venteDate: { flex: 1, color: '#475569', fontSize: 13, fontWeight: '500' },
  venteMontant: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  venteMode: { color: '#94a3b8', fontSize: 11 },
  badgeCredit: {
    backgroundColor: '#fef3c7', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeCreditText: { color: '#92400e', fontSize: 10, fontWeight: 'bold' },
  emptyOnglet: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },

  // Credits
  creditItem: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  creditItemRegle: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  creditTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  creditNum: { flex: 1, fontWeight: '600', color: '#334155', fontSize: 13 },
  statutBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  statutRegle: { backgroundColor: '#dcfce7' },
  statutEnCours: { backgroundColor: '#fef3c7' },
  statutText: { fontSize: 11, fontWeight: '600' },
  creditRestant: { color: '#dc2626', fontWeight: 'bold', fontSize: 13, marginTop: 4 },

  // Progression
  progressWrap: { marginVertical: 6 },
  progressBg: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#1a56db', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  progressText: { fontSize: 10, color: '#94a3b8' },

  // Pied modal detail
  detailFoot: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  btnFermer: {
    backgroundColor: '#f1f5f9', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  btnFermerText: { color: '#475569', fontWeight: '600', fontSize: 14 },
});
