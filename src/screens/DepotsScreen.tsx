import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, ScrollView, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import api from '../services/api.service';

interface DepotClient {
  id: number;
  nom: string;
  prenom?: string;
  nomComplet: string;
  numero: string;
}

interface RetraitDepot {
  id: number;
  montant: number;
  dateRetrait: string;
  observation?: string;
}

interface DepotGarde {
  id: number;
  depotClientId?: number;
  nom: string;
  prenom?: string;
  nomComplet: string;
  numero: string;
  montantInitial: number;
  montantRestant: number;
  montantRetire: number;
  statut: 'ACTIF' | 'CLOTURE';
  dateDepot: string;
  observation?: string;
  retraits: RetraitDepot[];
}

interface Stats {
  totalDepots: number;
  totalActifs: number;
  totalClotures: number;
  totalMontantGarde: number;
}

const money = (v: number) =>
  new Intl.NumberFormat('fr-FR').format(v || 0) + ' FCFA';

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

export default function DepotsScreen() {
  const [depots, setDepots] = useState<DepotGarde[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<'TOUS' | 'ACTIF' | 'CLOTURE'>('TOUS');

  // Modal création
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depotClients, setDepotClients] = useState<DepotClient[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<DepotClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<DepotClient | null>(null);
  const [form, setForm] = useState({ nom: '', prenom: '', numero: '', montant: '', observation: '' });

  // Modal détail + retrait
  const [selected, setSelected] = useState<DepotGarde | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showRetrait, setShowRetrait] = useState(false);
  const [retraitMontant, setRetraitMontant] = useState('');
  const [retraitObs, setRetraitObs] = useState('');

  const charger = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        api.get('/depots-garde').catch(() => ({ data: [] })),
        api.get('/depots-garde/statistiques').catch(() => ({ data: null })),
      ]);
      const list: DepotGarde[] = r1.data?.depots || r1.data?.data || r1.data || [];
      setDepots(list);
      setStats(r2.data?.statistiques || r2.data || null);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const chargerClients = useCallback(async () => {
    try {
      const r = await api.get('/depot-clients');
      setDepotClients(r.data?.clients || r.data || []);
    } catch { }
  }, []);

  useEffect(() => { charger(); chargerClients(); }, []);

  const rechercherClients = (q: string) => {
    setClientSearch(q);
    if (!q.trim()) { setClientSuggestions([]); return; }
    const lower = q.toLowerCase();
    setClientSuggestions(
      depotClients.filter(c =>
        c.nomComplet.toLowerCase().includes(lower) || c.numero.includes(lower)
      ).slice(0, 8)
    );
  };

  const choisirClient = (c: DepotClient) => {
    setSelectedClient(c);
    setForm(f => ({ ...f, nom: c.nom, prenom: c.prenom || '', numero: c.numero }));
    setClientSearch(c.nomComplet);
    setClientSuggestions([]);
  };

  const effacerClient = () => {
    setSelectedClient(null);
    setClientSearch('');
    setClientSuggestions([]);
    setForm(f => ({ ...f, nom: '', prenom: '', numero: '' }));
  };

  const openCreate = () => {
    setForm({ nom: '', prenom: '', numero: '', montant: '', observation: '' });
    setSelectedClient(null);
    setClientSearch('');
    setClientSuggestions([]);
    setShowCreate(true);
  };

  const sauvegarder = async () => {
    if (!form.nom.trim()) { Alert.alert('Erreur', 'Le nom est obligatoire'); return; }
    if (!form.numero.trim()) { Alert.alert('Erreur', 'Le numéro est obligatoire'); return; }
    const mt = parseFloat(form.montant);
    if (!mt || mt <= 0) { Alert.alert('Erreur', 'Le montant doit être supérieur à 0'); return; }
    setSaving(true);
    try {
      await api.post('/depots-garde', {
        depotClientId: selectedClient?.id,
        nom: form.nom.trim(),
        prenom: form.prenom.trim() || undefined,
        numero: form.numero.trim(),
        montant: mt,
        observation: form.observation.trim() || undefined,
      });
      setShowCreate(false);
      charger();
      chargerClients();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Enregistrement impossible');
    }
    setSaving(false);
  };

  const effectuerRetrait = async () => {
    if (!selected) return;
    const mt = parseFloat(retraitMontant);
    if (!mt || mt <= 0) { Alert.alert('Erreur', 'Montant invalide'); return; }
    if (mt > selected.montantRestant) { Alert.alert('Erreur', `Max : ${money(selected.montantRestant)}`); return; }
    try {
      await api.post(`/depots-garde/${selected.id}/retrait`, { montant: mt, observation: retraitObs });
      setShowRetrait(false);
      setShowDetail(false);
      charger();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Retrait impossible');
    }
  };

  const filtered = depots.filter(d => {
    if (filtre !== 'TOUS' && d.statut !== filtre) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.nomComplet.toLowerCase().includes(q) || d.numero.includes(q);
  });

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={s.container}>
      {/* Stats */}
      {stats && (
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#1a56db' }]}>
            <Text style={s.statNum}>{stats.totalActifs}</Text>
            <Text style={s.statLbl}>Actifs</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#0e9f6e' }]}>
            <Text style={s.statNum}>{money(stats.totalMontantGarde)}</Text>
            <Text style={s.statLbl}>En garde</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#6b7280' }]}>
            <Text style={s.statNum}>{stats.totalClotures}</Text>
            <Text style={s.statLbl}>Clôturés</Text>
          </View>
        </View>
      )}

      {/* Filtres */}
      <View style={s.filtreRow}>
        {(['TOUS', 'ACTIF', 'CLOTURE'] as const).map(f => (
          <TouchableOpacity key={f} style={[s.filtreBtn, filtre === f && s.filtreBtnActive]} onPress={() => setFiltre(f)}>
            <Text style={[s.filtreTxt, filtre === f && s.filtreTxtActive]}>{f === 'TOUS' ? 'Tous' : f === 'ACTIF' ? 'Actifs' : 'Clôturés'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={s.addBtn} onPress={openCreate}>
          <Text style={s.addBtnTxt}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* Recherche */}
      <TextInput
        style={s.searchInput}
        placeholder="Rechercher par nom ou numéro..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#94a3b8"
      />

      <FlatList
        data={filtered}
        keyExtractor={d => String(d.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        ListEmptyComponent={<Text style={s.empty}>Aucun dépôt enregistré</Text>}
        renderItem={({ item: d }) => {
          const pct = d.montantInitial > 0 ? (d.montantRetire / d.montantInitial) * 100 : 0;
          return (
            <TouchableOpacity style={s.card} onPress={() => { setSelected(d); setShowDetail(true); }}>
              <View style={s.cardTop}>
                <View style={s.avatar}>
                  <Text style={s.avatarTxt}>{(d.nom || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardNom}>{d.nomComplet}</Text>
                  <Text style={s.cardSub}>{d.numero} · {fmt(d.dateDepot)}</Text>
                </View>
                <View style={[s.badge, d.statut === 'ACTIF' ? s.badgeActif : s.badgeCloture]}>
                  <Text style={s.badgeTxt}>{d.statut}</Text>
                </View>
              </View>
              <View style={s.montantRow}>
                <Text style={s.montantLabel}>Restant</Text>
                <Text style={s.montantVal}>{money(d.montantRestant)}</Text>
                <Text style={s.montantLabel}>Initial</Text>
                <Text style={s.montantSub}>{money(d.montantInitial)}</Text>
              </View>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` as any }]} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Modal Création ── */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Nouveau dépôt</Text>
          <TouchableOpacity onPress={() => setShowCreate(false)}>
            <Text style={s.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
          {/* Recherche personne existante */}
          <View style={s.clientSearchBox}>
            <Text style={s.clientSearchLabel}>Sélectionner une personne existante</Text>
            {selectedClient ? (
              <View style={s.clientChip}>
                <Text style={s.clientChipTxt}>{selectedClient.nomComplet} — {selectedClient.numero}</Text>
                <TouchableOpacity onPress={effacerClient}>
                  <Text style={s.clientChipX}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={s.clientSearchInput}
                  placeholder="Rechercher par nom ou téléphone..."
                  value={clientSearch}
                  onChangeText={rechercherClients}
                  placeholderTextColor="#94a3b8"
                />
                {clientSuggestions.map(c => (
                  <TouchableOpacity key={c.id} style={s.clientSugg} onPress={() => choisirClient(c)}>
                    <View style={s.suggAvatar}>
                      <Text style={s.suggAvatarTxt}>{c.nom[0].toUpperCase()}</Text>
                    </View>
                    <View>
                      <Text style={s.suggNom}>{c.nomComplet}</Text>
                      <Text style={s.suggTel}>{c.numero}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {clientSearch.length > 0 && clientSuggestions.length === 0 && (
                  <Text style={s.noSugg}>Aucune personne trouvée — remplir manuellement</Text>
                )}
              </>
            )}
            <View style={s.divider}><View style={s.dividerLine} /><Text style={s.dividerTxt}>ou manuellement</Text><View style={s.dividerLine} /></View>
          </View>

          <Text style={s.fieldLabel}>Nom *</Text>
          <TextInput style={s.input} value={form.nom} onChangeText={v => setForm(f => ({ ...f, nom: v }))} placeholder="Nom du déposant" />
          <Text style={s.fieldLabel}>Prénom</Text>
          <TextInput style={s.input} value={form.prenom} onChangeText={v => setForm(f => ({ ...f, prenom: v }))} placeholder="Prénom (optionnel)" />
          <Text style={s.fieldLabel}>Numéro (téléphone) *</Text>
          <TextInput style={s.input} value={form.numero} onChangeText={v => setForm(f => ({ ...f, numero: v }))} placeholder="Ex: 77 000 00 00" keyboardType="phone-pad" />
          <Text style={s.fieldLabel}>Montant déposé *</Text>
          <TextInput style={s.input} value={form.montant} onChangeText={v => setForm(f => ({ ...f, montant: v }))} placeholder="0" keyboardType="numeric" />
          <Text style={s.fieldLabel}>Observation</Text>
          <TextInput style={[s.input, { height: 70 }]} value={form.observation} onChangeText={v => setForm(f => ({ ...f, observation: v }))} placeholder="Remarque..." multiline />

          <TouchableOpacity style={s.saveBtn} onPress={sauvegarder} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Enregistrer</Text>}
          </TouchableOpacity>
        </ScrollView>
      </Modal>

      {/* ── Modal Détail ── */}
      <Modal visible={showDetail} animationType="slide" onRequestClose={() => setShowDetail(false)}>
        {selected && (
          <>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{selected.nomComplet}</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Text style={s.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <View style={s.detailRow}><Text style={s.detailLbl}>Téléphone</Text><Text style={s.detailVal}>{selected.numero}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>Statut</Text><Text style={[s.detailVal, selected.statut === 'ACTIF' ? { color: '#0e9f6e' } : { color: '#6b7280' }]}>{selected.statut}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>Date dépôt</Text><Text style={s.detailVal}>{fmt(selected.dateDepot)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>Montant initial</Text><Text style={s.detailVal}>{money(selected.montantInitial)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>Montant restant</Text><Text style={[s.detailVal, { color: '#1a56db', fontWeight: '700' }]}>{money(selected.montantRestant)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>Retiré</Text><Text style={[s.detailVal, { color: '#dc2626' }]}>{money(selected.montantRetire)}</Text></View>
              {selected.observation && <View style={s.detailRow}><Text style={s.detailLbl}>Observation</Text><Text style={s.detailVal}>{selected.observation}</Text></View>}

              {selected.retraits?.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={s.sectionTitle}>Historique des retraits</Text>
                  {selected.retraits.map(r => (
                    <View key={r.id} style={s.retraitRow}>
                      <Text style={s.retraitDate}>{fmt(r.dateRetrait)}</Text>
                      <Text style={s.retraitMontant}>- {money(r.montant)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selected.statut === 'ACTIF' && (
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#dc2626', marginTop: 24 }]} onPress={() => {
                  setRetraitMontant('');
                  setRetraitObs('');
                  setShowRetrait(true);
                }}>
                  <Text style={s.saveBtnTxt}>Effectuer un retrait</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </>
        )}
      </Modal>

      {/* ── Modal Retrait ── */}
      <Modal visible={showRetrait} animationType="slide" transparent onRequestClose={() => setShowRetrait(false)}>
        <View style={s.retraitOverlay}>
          <View style={s.retraitCard}>
            <Text style={s.modalTitle}>Retrait</Text>
            <Text style={s.retraitInfo}>Disponible : {selected ? money(selected.montantRestant) : ''}</Text>
            <Text style={s.fieldLabel}>Montant *</Text>
            <TextInput style={s.input} value={retraitMontant} onChangeText={setRetraitMontant} keyboardType="numeric" placeholder="0" />
            <Text style={s.fieldLabel}>Observation</Text>
            <TextInput style={s.input} value={retraitObs} onChangeText={setRetraitObs} placeholder="Remarque..." />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#6b7280' }]} onPress={() => setShowRetrait(false)}>
                <Text style={s.saveBtnTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={effectuerRetrait}>
                <Text style={s.saveBtnTxt}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  statsRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 4 },
  statCard: { flex: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  statNum: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statLbl: { color: 'rgba(255,255,255,.75)', fontSize: 11, marginTop: 2 },
  filtreRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  filtreBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filtreBtnActive: { backgroundColor: '#1a56db' },
  filtreTxt: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filtreTxtActive: { color: '#fff' },
  addBtn: { marginLeft: 'auto', backgroundColor: '#1a56db', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  addBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  searchInput: { marginHorizontal: 12, marginBottom: 4, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14, elevation: 2, shadowColor: '#000', shadowOpacity: .06, shadowRadius: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1a56db', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { color: '#fff', fontWeight: '700', fontSize: 18 },
  cardNom: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeActif: { backgroundColor: '#d1fae5' },
  badgeCloture: { backgroundColor: '#f1f5f9' },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: '#0f172a' },
  montantRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  montantLabel: { fontSize: 11, color: '#94a3b8' },
  montantVal: { fontSize: 15, fontWeight: '700', color: '#1a56db' },
  montantSub: { fontSize: 13, color: '#64748b', marginLeft: 4 },
  progressBg: { height: 5, backgroundColor: '#e2e8f0', borderRadius: 3 },
  progressFill: { height: 5, backgroundColor: '#dc2626', borderRadius: 3 },
  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },
  // Modal
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#1a56db' },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalClose: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalBody: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  // Recherche client
  clientSearchBox: { backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 16 },
  clientSearchLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: '#1a56db', letterSpacing: 0.6, marginBottom: 8 },
  clientChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#0e9f6e', borderRadius: 10, padding: 10 },
  clientChipTxt: { fontSize: 14, fontWeight: '600', color: '#065f46', flex: 1 },
  clientChipX: { color: '#dc2626', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  clientSearchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  clientSugg: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 8, padding: 10, marginTop: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  suggAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#1a56db', justifyContent: 'center', alignItems: 'center' },
  suggAvatarTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  suggNom: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  suggTel: { fontSize: 12, color: '#64748b' },
  noSugg: { fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 8 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#cbd5e1' },
  dividerTxt: { fontSize: 11, color: '#94a3b8' },
  // Formulaire
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#e2e8f0', color: '#0f172a' },
  saveBtn: { backgroundColor: '#1a56db', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  // Détail
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  detailLbl: { fontSize: 13, color: '#64748b' },
  detailVal: { fontSize: 13, fontWeight: '600', color: '#0f172a' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  retraitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  retraitDate: { fontSize: 13, color: '#64748b' },
  retraitMontant: { fontSize: 13, fontWeight: '700', color: '#dc2626' },
  // Retrait overlay
  retraitOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
  retraitCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  retraitInfo: { fontSize: 13, color: '#64748b', marginBottom: 12 },
});
