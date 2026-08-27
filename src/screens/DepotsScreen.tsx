import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, ScrollView, Modal, Alert,
} from 'react-native';
import { Text, Card, FAB, Searchbar, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api, { createDepot, effectuerRetraitDepot, cloturerDepot, getGroupesClientDepot, retraitGlobalDepot } from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { MontantInput } from '../components/MontantInput';

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

interface ClientDepotGroupe {
  numero: string;
  nom: string;
  prenom?: string;
  nomComplet: string;
  nombreDepotsActifs: number;
  totalMontantInitial: number;
  totalMontantRestant: number;
  totalMontantRetire: number;
}

const money = (v: number) =>
  new Intl.NumberFormat('fr-FR').format(v || 0) + ' FCFA';

const fmt = (d?: string) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

export default function DepotsScreen() {
  const { lang } = useLang();
  const [depots, setDepots] = useState<DepotGarde[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');
  const [filtre, setFiltre] = useState<'TOUS' | 'ACTIF' | 'CLOTURE'>('TOUS');

  // Modal création
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [depotClients, setDepotClients] = useState<DepotClient[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<DepotClient[]>([]);
  const [selectedClient, setSelectedClient] = useState<DepotClient | null>(null);
  const [form, setForm] = useState({ nom: '', prenom: '', numero: '', montant: 0, observation: '' });

  // Modal détail + retrait
  const [selected, setSelected] = useState<DepotGarde | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showRetrait, setShowRetrait] = useState(false);
  const [retraitMontant, setRetraitMontant] = useState(0);
  const [retraitObs, setRetraitObs] = useState('');
  const [cloturing, setCloturing] = useState(false);

  // Vue groupée par client + retrait global
  const [vueMode, setVueMode] = useState<'liste' | 'groupes'>('liste');
  const [groupesClient, setGroupesClient] = useState<ClientDepotGroupe[]>([]);
  const [loadingGroupes, setLoadingGroupes] = useState(false);
  const [showRetraitGlobal, setShowRetraitGlobal] = useState(false);
  const [clientRetraitGlobal, setClientRetraitGlobal] = useState<ClientDepotGroupe | null>(null);
  const [retraitGlobalMontant, setRetraitGlobalMontant] = useState(0);
  const [retraitGlobalObs, setRetraitGlobalObs] = useState('');
  const [savingRetraitGlobal, setSavingRetraitGlobal] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        api.get('/depots-garde').catch(() => ({ data: [] })),
        api.get('/depots-garde/statistiques').catch(() => ({ data: null })),
      ]);
      const list: DepotGarde[] = r1.data?.depots || r1.data?.data || r1.data || [];
      const statsData: Stats | null = r2.data?.statistiques || r2.data || null;
      setDepots(list);
      setStats(statsData);
      setFromCache(false);
      sauvegarderCache('depots', { list, stats: statsData }).catch(() => {});
    } catch {
      const cached = await lireCache<any>('depots');
      if (cached.length > 0) {
        const c = cached[0] as any;
        setDepots(c.list || []);
        setStats(c.stats || null);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
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
    setForm({ nom: '', prenom: '', numero: '', montant: 0, observation: '' });
    setSelectedClient(null);
    setClientSearch('');
    setClientSuggestions([]);
    setShowCreate(true);
  };

  const sauvegarder = async () => {
    if (!form.nom.trim()) { Alert.alert(tr('erreur', lang), tr('nom', lang) + ' ' + tr('remplir_champs', lang).toLowerCase()); return; }
    if (!form.numero.trim()) { Alert.alert(tr('erreur', lang), tr('telephone', lang) + ' ' + tr('remplir_champs', lang).toLowerCase()); return; }
    const mt = form.montant;
    if (!mt || mt <= 0) { Alert.alert(tr('erreur', lang), tr('montant_depot', lang)); return; }
    setSaving(true);
    try {
      const payload = {
        depotClientId: selectedClient?.id,
        nom: form.nom.trim(),
        prenom: form.prenom.trim() || undefined,
        numero: form.numero.trim(),
        montant: mt,
        observation: form.observation.trim() || undefined,
      };
      const res = await executerOuMettreEnFile(
        'depot_create',
        payload,
        () => createDepot(payload)
      );
      setShowCreate(false);
      if (res.offline) {
        Alert.alert('Sauvegardé hors ligne', 'Dépôt mis en file — sync au retour connexion');
      } else {
        charger();
        chargerClients();
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e?.response?.data?.message || tr('erreur', lang));
    }
    setSaving(false);
  };

  const effectuerRetrait = async () => {
    if (!selected) return;
    const mt = retraitMontant;
    if (!mt || mt <= 0) { Alert.alert(tr('erreur', lang), tr('montant_retrait', lang)); return; }
    if (mt > selected.montantRestant) { Alert.alert(tr('erreur', lang), `Max : ${money(selected.montantRestant)}`); return; }
    try {
      const retraitData = { montant: mt, observation: retraitObs };
      const res = await executerOuMettreEnFile(
        'depot_retrait',
        { id: selected.id, data: retraitData },
        () => effectuerRetraitDepot(selected.id, retraitData)
      );
      setShowRetrait(false);
      if (res.offline) {
        Alert.alert('Sauvegardé hors ligne', 'Retrait mis en file — sync au retour connexion');
      } else {
        setShowDetail(false);
        charger();
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e?.response?.data?.message || tr('erreur', lang));
    }
  };

  // ── Clôture d'un dépôt (comme cloturerDepot() sur Ionic) ──────────────────
  const cloturer = (depot: DepotGarde) => {
    Alert.alert(
      'Clôturer ce dépôt ?',
      `${depot.nomComplet} — Solde restant : ${money(depot.montantRestant)}`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: 'Clôturer', style: 'destructive',
          onPress: async () => {
            setCloturing(true);
            try {
              await cloturerDepot(depot.id);
              setShowDetail(false);
              await charger();
            } catch (e: any) {
              Alert.alert(tr('erreur', lang), e?.response?.data?.message || 'Clôture impossible');
            }
            setCloturing(false);
          },
        },
      ],
    );
  };

  // ── Vue groupée par client ─────────────────────────────────────────────────
  const chargerGroupes = async () => {
    setLoadingGroupes(true);
    try {
      const res = await getGroupesClientDepot();
      setGroupesClient(res.data?.data || res.data || []);
    } catch {
      Alert.alert(tr('erreur', lang), 'Chargement des groupes impossible');
    }
    setLoadingGroupes(false);
  };

  const basculerVue = (mode: 'liste' | 'groupes') => {
    setVueMode(mode);
    if (mode === 'groupes' && groupesClient.length === 0) chargerGroupes();
  };

  const ouvrirRetraitGlobal = (client: ClientDepotGroupe) => {
    setClientRetraitGlobal(client);
    setRetraitGlobalMontant(0);
    setRetraitGlobalObs('');
    setShowRetraitGlobal(true);
  };

  const saveRetraitGlobal = () => {
    if (!clientRetraitGlobal) return;
    const total = clientRetraitGlobal.totalMontantRestant;
    const montant = retraitGlobalMontant || 0;
    if (montant > 0 && montant > total) {
      Alert.alert(tr('erreur', lang), `Montant max : ${money(total)}`); return;
    }
    Alert.alert(
      'Confirmer le retrait global ?',
      `Client : ${clientRetraitGlobal.nomComplet}\nMontant : ${montant > 0 ? money(montant) : money(total) + ' (total)'}\n${clientRetraitGlobal.nombreDepotsActifs} dépôt(s) concerné(s)`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('confirmer', lang),
          onPress: async () => {
            setSavingRetraitGlobal(true);
            try {
              await retraitGlobalDepot({
                numero: clientRetraitGlobal.numero,
                montant: montant > 0 ? montant : undefined,
                observation: retraitGlobalObs || undefined,
              });
              setShowRetraitGlobal(false);
              setClientRetraitGlobal(null);
              setGroupesClient([]);
              await charger();
              await chargerGroupes();
            } catch (e: any) {
              Alert.alert(tr('erreur', lang), e?.response?.data?.message || 'Retrait global impossible');
            }
            setSavingRetraitGlobal(false);
          },
        },
      ],
    );
  };

  const filtered = depots.filter(d => {
    if (filtre !== 'TOUS' && d.statut !== filtre) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return d.nomComplet.toLowerCase().includes(q) || d.numero.includes(q);
  });

  const totalGarde = stats?.totalMontantGarde ?? depots.reduce((s, d) => s + (d.montantRestant || 0), 0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={s.container}>
      {/* ── Hero banner ── */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{stats?.totalDepots ?? depots.length}</Text>
          <Text style={s.heroLbl}>Dépôts</Text>
        </View>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{money(totalGarde)}</Text>
          <Text style={s.heroLbl}>En garde</Text>
        </View>
        <View style={s.heroStat}>
          <Text style={[s.heroVal, { color: '#86efac' }]}>{stats?.totalActifs ?? depots.filter(d => d.statut === 'ACTIF').length}</Text>
          <Text style={s.heroLbl}>Actifs</Text>
        </View>
      </View>


      {/* ── Bascule vue liste / groupée par client ── */}
      <View style={s.vueRow}>
        <TouchableOpacity style={[s.vueBtn, vueMode === 'liste' && s.vueBtnActive]} onPress={() => basculerVue('liste')}>
          <MaterialCommunityIcons name="format-list-bulleted" size={14} color={vueMode === 'liste' ? '#fff' : '#64748b'} />
          <Text style={[s.vueTxt, vueMode === 'liste' && s.vueTxtActive]}>Liste</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.vueBtn, vueMode === 'groupes' && s.vueBtnActive]} onPress={() => basculerVue('groupes')}>
          <MaterialCommunityIcons name="account-group-outline" size={14} color={vueMode === 'groupes' ? '#fff' : '#64748b'} />
          <Text style={[s.vueTxt, vueMode === 'groupes' && s.vueTxtActive]}>Par client</Text>
        </TouchableOpacity>
      </View>

      {vueMode === 'liste' ? (
        <>
          {/* ── Filtres ── */}
          <View style={s.filtreRow}>
            {(['TOUS', 'ACTIF', 'CLOTURE'] as const).map(f => (
              <TouchableOpacity key={f} style={[s.filtreBtn, filtre === f && s.filtreBtnActive]} onPress={() => setFiltre(f)}>
                <Text style={[s.filtreTxt, filtre === f && s.filtreTxtActive]}>{f === 'TOUS' ? 'Tous' : f === 'ACTIF' ? tr('actifs', lang) : tr('clotures', lang)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Searchbar ── */}
          <Searchbar
            style={s.searchBar}
            inputStyle={{ fontSize: 13 }}
            placeholder={tr('recherche_client', lang)}
            value={search}
            onChangeText={setSearch}
          />

          {/* ── Liste ── */}
          <FlatList
            data={filtered}
            keyExtractor={d => String(d.id)}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} colors={['#1a56db']} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <MaterialCommunityIcons name="safe" size={64} color="#cbd5e1" />
                <Text style={s.emptyTitle}>{tr('aucun_depot', lang)}</Text>
                <Text style={s.emptySub}>Appuyez sur + pour créer</Text>
              </View>
            }
            renderItem={({ item: d }) => {
              const pct = d.montantInitial > 0 ? (d.montantRetire / d.montantInitial) * 100 : 0;
              return (
                <Card style={s.card} onPress={() => { setSelected(d); setShowDetail(true); }}>
                  <Card.Content style={s.cardRow}>
                    <View style={[s.avatar, { backgroundColor: '#1a56db22' }]}>
                      <MaterialCommunityIcons name="safe" size={22} color="#1a56db" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardName} numberOfLines={1}>{d.nomComplet}</Text>
                      <Text style={s.cardSub}>{d.numero} · {fmt(d.dateDepot)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.cardAmt}>{money(d.montantRestant)}</Text>
                      <View style={[s.badge, { backgroundColor: d.statut === 'ACTIF' ? '#d1fae5' : '#f1f5f9' }]}>
                        <Text style={[s.badgeTxt, { color: d.statut === 'ACTIF' ? '#16a34a' : '#6b7280' }]}>{d.statut}</Text>
                      </View>
                    </View>
                  </Card.Content>
                  <Card.Content style={{ paddingTop: 0 }}>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: `${Math.min(pct, 100)}%` as any }]} />
                    </View>
                    <Text style={s.progressLbl}>{money(d.montantRetire)} retiré / {money(d.montantInitial)} initial</Text>
                  </Card.Content>
                </Card>
              );
            }}
          />
        </>
      ) : (
        /* ── Vue groupée par client ── */
        loadingGroupes ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />
        ) : (
          <FlatList
            data={groupesClient}
            keyExtractor={g => g.numero}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 80 }}
            refreshControl={<RefreshControl refreshing={loadingGroupes} onRefresh={chargerGroupes} colors={['#1a56db']} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <MaterialCommunityIcons name="account-group-outline" size={64} color="#cbd5e1" />
                <Text style={s.emptyTitle}>Aucun client</Text>
              </View>
            }
            renderItem={({ item: g }) => (
              <Card style={s.card}>
                <Card.Content style={s.cardRow}>
                  <View style={[s.avatar, { backgroundColor: '#1a56db22' }]}>
                    <Text style={{ fontWeight: '700', color: '#1a56db' }}>{(g.nom || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardName} numberOfLines={1}>{g.nomComplet}</Text>
                    <Text style={s.cardSub}>{g.numero} · {g.nombreDepotsActifs} dépôt(s) actif(s)</Text>
                  </View>
                  <Text style={s.cardAmt}>{money(g.totalMontantRestant)}</Text>
                </Card.Content>
                <Card.Content style={{ paddingTop: 0, flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <TouchableOpacity style={s.btnRetraitGlobal} onPress={() => ouvrirRetraitGlobal(g)}>
                    <MaterialCommunityIcons name="cash-minus" size={14} color="#fff" />
                    <Text style={s.btnRetraitGlobalTxt}>Retrait global</Text>
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            )}
          />
        )
      )}

      {/* ── FAB ── */}
      <FAB icon="plus" style={s.fab} onPress={openCreate} />

      {/* ── Modal Création ── */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{tr('nouveau_depot', lang)}</Text>
          <TouchableOpacity onPress={() => setShowCreate(false)}>
            <Text style={s.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
          {/* Recherche personne existante */}
          <View style={s.clientSearchBox}>
            <Text style={s.clientSearchLabel}>{tr('personne_existante', lang)}</Text>
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
                  placeholder={tr('recherche_client', lang)}
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

          <Text style={s.fieldLabel}>{tr('nom', lang)} *</Text>
          <TextInput style={s.input} value={form.nom} onChangeText={v => setForm(f => ({ ...f, nom: v }))} placeholder={tr('nom_deposant', lang)} />
          <Text style={s.fieldLabel}>{tr('prenom', lang)}</Text>
          <TextInput style={s.input} value={form.prenom} onChangeText={v => setForm(f => ({ ...f, prenom: v }))} placeholder={tr('prenom', lang)} />
          <Text style={s.fieldLabel}>{tr('telephone', lang)} *</Text>
          <TextInput style={s.input} value={form.numero} onChangeText={v => setForm(f => ({ ...f, numero: v }))} placeholder="Ex: 77 000 00 00" keyboardType="phone-pad" />
          <Text style={s.fieldLabel}>{tr('montant_depot', lang)} *</Text>
          <MontantInput style={s.input} value={form.montant} onChangeValue={v => setForm(f => ({ ...f, montant: v }))} placeholder="0" />
          <Text style={s.fieldLabel}>{tr('description', lang)}</Text>
          <TextInput style={[s.input, { height: 70 }]} value={form.observation} onChangeText={v => setForm(f => ({ ...f, observation: v }))} placeholder={tr('description', lang)} multiline />

          <TouchableOpacity style={s.saveBtn} onPress={sauvegarder} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>{tr('enregistrer', lang)}</Text>}
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
              <View style={s.detailRow}><Text style={s.detailLbl}>{tr('telephone', lang)}</Text><Text style={s.detailVal}>{selected.numero}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>{tr('actif', lang)}</Text><Text style={[s.detailVal, selected.statut === 'ACTIF' ? { color: '#0e9f6e' } : { color: '#6b7280' }]}>{selected.statut === 'ACTIF' ? tr('actif', lang) : tr('cloture', lang)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>{tr('date', lang)}</Text><Text style={s.detailVal}>{fmt(selected.dateDepot)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>{tr('montant_depot', lang)}</Text><Text style={s.detailVal}>{money(selected.montantInitial)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>{tr('restant', lang)}</Text><Text style={[s.detailVal, { color: '#1a56db', fontWeight: '700' }]}>{money(selected.montantRestant)}</Text></View>
              <View style={s.detailRow}><Text style={s.detailLbl}>{tr('retire', lang)}</Text><Text style={[s.detailVal, { color: '#dc2626' }]}>{money(selected.montantRetire)}</Text></View>
              {selected.observation && <View style={s.detailRow}><Text style={s.detailLbl}>{tr('description', lang)}</Text><Text style={s.detailVal}>{selected.observation}</Text></View>}

              {selected.retraits?.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={s.sectionTitle}>{tr('historique_retraits', lang)}</Text>
                  {selected.retraits.map(r => (
                    <View key={r.id} style={s.retraitRow}>
                      <Text style={s.retraitDate}>{fmt(r.dateRetrait)}</Text>
                      <Text style={s.retraitMontant}>- {money(r.montant)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {selected.statut === 'ACTIF' && (
                <>
                  <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#dc2626', marginTop: 24 }]} onPress={() => {
                    setRetraitMontant(0);
                    setRetraitObs('');
                    setShowRetrait(true);
                  }}>
                    <Text style={s.saveBtnTxt}>{tr('effectuer_retrait', lang)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: '#6b7280', marginTop: 10 }]}
                    disabled={cloturing}
                    onPress={() => cloturer(selected)}
                  >
                    {cloturing ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Clôturer le dépôt</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </>
        )}
      </Modal>

      {/* ── Modal Retrait ── */}
      <Modal visible={showRetrait} animationType="slide" transparent onRequestClose={() => setShowRetrait(false)}>
        <View style={s.retraitOverlay}>
          <View style={s.retraitCard}>
            <Text style={s.retraitTitle}>{tr('retrait', lang)}</Text>
            <Text style={s.retraitInfo}>{tr('disponible', lang)} : {selected ? money(selected.montantRestant) : ''}</Text>
            <Text style={s.fieldLabel}>{tr('montant_retrait', lang)} *</Text>
            <MontantInput style={s.input} value={retraitMontant} onChangeValue={setRetraitMontant} placeholder="0" />
            <Text style={s.fieldLabel}>{tr('description', lang)}</Text>
            <TextInput style={s.input} value={retraitObs} onChangeText={setRetraitObs} placeholder={tr('description', lang)} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#6b7280' }]} onPress={() => setShowRetrait(false)}>
                <Text style={s.saveBtnTxt}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#dc2626' }]} onPress={effectuerRetrait}>
                <Text style={s.saveBtnTxt}>{tr('confirmer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Retrait global (vue groupée) ── */}
      <Modal visible={showRetraitGlobal} animationType="slide" transparent onRequestClose={() => setShowRetraitGlobal(false)}>
        <View style={s.retraitOverlay}>
          <View style={s.retraitCard}>
            <Text style={s.retraitTitle}>Retrait global — {clientRetraitGlobal?.nomComplet}</Text>
            <Text style={s.retraitInfo}>
              {tr('disponible', lang)} : {clientRetraitGlobal ? money(clientRetraitGlobal.totalMontantRestant) : ''} · {clientRetraitGlobal?.nombreDepotsActifs} dépôt(s)
            </Text>
            <Text style={s.fieldLabel}>Montant (laisser vide pour tout retirer)</Text>
            <MontantInput style={s.input} value={retraitGlobalMontant} onChangeValue={setRetraitGlobalMontant} placeholder="Total si vide" />
            <Text style={s.fieldLabel}>{tr('description', lang)}</Text>
            <TextInput style={s.input} value={retraitGlobalObs} onChangeText={setRetraitGlobalObs} placeholder={tr('description', lang)} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#6b7280' }]} onPress={() => setShowRetraitGlobal(false)}>
                <Text style={s.saveBtnTxt}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, { flex: 1, backgroundColor: '#dc2626' }]} disabled={savingRetraitGlobal} onPress={saveRetraitGlobal}>
                {savingRetraitGlobal ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>{tr('confirmer', lang)}</Text>}
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

  // Hero banner
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  // Offline banner
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  // Bascule vue liste / groupée
  vueRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  vueBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  vueBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  vueTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  vueTxtActive: { color: '#fff' },
  btnRetraitGlobal: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  btnRetraitGlobalTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Filtres
  filtreRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  filtreBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e2e8f0' },
  filtreBtnActive: { backgroundColor: '#1a56db' },
  filtreTxt: { fontSize: 12, color: '#475569', fontWeight: '600' },
  filtreTxtActive: { color: '#fff' },

  // Searchbar
  searchBar: { marginHorizontal: 12, marginBottom: 4, borderRadius: 10, backgroundColor: '#fff', elevation: 1 },

  // Paper Card
  card: { marginBottom: 10, borderRadius: 16, elevation: 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },

  // Progress bar
  progressBg: { height: 5, backgroundColor: '#e2e8f0', borderRadius: 3, marginTop: 8 },
  progressFill: { height: 5, backgroundColor: '#dc2626', borderRadius: 3 },
  progressLbl: { fontSize: 10, color: '#94a3b8', marginTop: 3 },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  // FAB
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: '#1a56db' },

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
  retraitCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  retraitTitle: { color: '#0f172a', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  retraitInfo: { fontSize: 13, color: '#64748b', marginBottom: 12 },
});
