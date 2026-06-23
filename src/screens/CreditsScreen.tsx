import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal
} from 'react-native';
import { Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CreditInfo {
  venteId: number;
  numeroVente: string;
  clientNom: string;
  clientTelephone?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  enRetard: boolean;
  venteAnnulee?: boolean;
  estReglee?: boolean;
}

interface LigneProduit {
  produitNom: string;
  quantite: number;
  sousTotal: number;
}

interface VenteDetail {
  produits?: LigneProduit[];
  lignes?: LigneProduit[];
}

interface ClientGroup {
  clientNom: string;
  clientTelephone?: string;
  credits: CreditInfo[];
  totalRestant: number;
  enRetard: boolean;
  expanded: boolean;
}

const MODES = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'VIREMENT'] as const;
type Mode = typeof MODES[number];
const MODE_LABELS: Record<Mode, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange',
  MOOV_MONEY: 'Moov',
  VIREMENT: 'Virement',
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => v?.toLocaleString('fr-FR') + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CreditsScreen() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [filtered, setFiltered] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRetard, setFilterRetard] = useState(false);

  // Modal détail (lecture seule)
  const [showDetail, setShowDetail] = useState(false);
  const [detailCredit, setDetailCredit] = useState<CreditInfo | null>(null);
  const [detailVente, setDetailVente] = useState<VenteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal règlement simple
  const [showSimple, setShowSimple] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditInfo | null>(null);
  const [simpleVente, setSimpleVente] = useState<VenteDetail | null>(null);
  const [loadingVente, setLoadingVente] = useState(false);
  const [simpleMontant, setSimpleMontant] = useState('');
  const [simpleMode, setSimpleMode] = useState<Mode>('ESPECES');
  const [simpleRef, setSimpleRef] = useState('');
  const [savingSimple, setSavingSimple] = useState(false);

  // Modal règlement groupé
  const [showGroupe, setShowGroupe] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupeMontant, setGroupeMontant] = useState('');
  const [groupeMode, setGroupeMode] = useState<Mode>('ESPECES');
  const [groupeRef, setGroupeRef] = useState('');
  const [savingGroupe, setSavingGroupe] = useState(false);

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const res = await api.get('/caisse/credits/non-regles');
      const all: CreditInfo[] = res.data?.data || res.data || [];
      const actifs = all.filter(c => !c.venteAnnulee && !c.estReglee);
      const grps = buildGroups(actifs);
      setGroups(grps);
      applyFilter(grps, search, filterRetard);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { charger(); }, []);

  const buildGroups = (credits: CreditInfo[]): ClientGroup[] => {
    const map = new Map<string, CreditInfo[]>();
    credits.forEach(c => {
      if (!map.has(c.clientNom)) map.set(c.clientNom, []);
      map.get(c.clientNom)!.push(c);
    });
    return Array.from(map.entries()).map(([nom, list]) => ({
      clientNom: nom,
      clientTelephone: list[0].clientTelephone,
      credits: list,
      totalRestant: list.reduce((s, c) => s + c.montantRestant, 0),
      enRetard: list.some(c => c.enRetard),
      expanded: false,
    })).sort((a, b) => b.totalRestant - a.totalRestant);
  };

  const applyFilter = (grps: ClientGroup[], term: string, retard: boolean) => {
    const t = term.trim().toLowerCase();
    setFiltered(grps.filter(g => {
      if (retard && !g.enRetard) return false;
      if (t) return g.clientNom.toLowerCase().includes(t) || (g.clientTelephone || '').includes(t);
      return true;
    }));
  };

  const onSearch = (v: string) => { setSearch(v); applyFilter(groups, v, filterRetard); };
  const toggleRetard = () => { const r = !filterRetard; setFilterRetard(r); applyFilter(groups, search, r); };
  const toggleGroup = (nom: string) => {
    setGroups(prev => prev.map(g => g.clientNom === nom ? { ...g, expanded: !g.expanded } : g));
    setFiltered(prev => prev.map(g => g.clientNom === nom ? { ...g, expanded: !g.expanded } : g));
  };

  // ─── Totaux ──────────────────────────────────────────────────────────────
  const totalCredits = groups.reduce((s, g) => s + g.totalRestant, 0);
  const nbRetard = groups.filter(g => g.enRetard).length;

  // ─── Chargement vente ────────────────────────────────────────────────────
  const loadVente = async (venteId: number, setter: (v: VenteDetail) => void, loadSetter: (b: boolean) => void) => {
    loadSetter(true);
    try {
      const res = await api.get(`/ventes/${venteId}`);
      setter(res.data?.data || res.data);
    } catch { }
    loadSetter(false);
  };

  // ─── Modal détail ────────────────────────────────────────────────────────
  const openDetail = (credit: CreditInfo) => {
    setDetailCredit(credit);
    setDetailVente(null);
    setShowDetail(true);
    loadVente(credit.venteId, setDetailVente, setLoadingDetail);
  };

  // ─── Règlement simple ────────────────────────────────────────────────────
  const openSimple = (credit: CreditInfo) => {
    setSelectedCredit(credit);
    setSimpleMontant(String(credit.montantRestant));
    setSimpleMode('ESPECES');
    setSimpleRef('');
    setSimpleVente(null);
    setShowSimple(true);
    loadVente(credit.venteId, setSimpleVente, setLoadingVente);
  };

  const saveSimple = async () => {
    if (!selectedCredit) return;
    const montant = parseFloat(simpleMontant);
    if (!montant || montant <= 0) { Alert.alert('Erreur', 'Montant invalide'); return; }
    if (montant > selectedCredit.montantRestant) {
      Alert.alert('Erreur', `Montant max : ${money(selectedCredit.montantRestant)}`); return;
    }
    setSavingSimple(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : {};
      await api.post('/caisse/credits/reglement', {
        venteCreditId: selectedCredit.venteId,
        montantRegle: montant,
        modePaiement: simpleMode,
        referencePaiement: simpleRef || undefined,
        utilisateurId: user.id,
      });
      setShowSimple(false);
      charger();
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Règlement impossible');
    }
    setSavingSimple(false);
  };

  // ─── Règlement groupé ────────────────────────────────────────────────────
  const openGroupe = (group: ClientGroup) => {
    setSelectedGroup(group);
    setSelectedIds(new Set(group.credits.map(c => c.venteId)));
    setGroupeMontant(String(group.totalRestant));
    setGroupeMode('ESPECES');
    setGroupeRef('');
    setShowGroupe(true);
  };

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      const total = (selectedGroup?.credits || [])
        .filter(c => next.has(c.venteId))
        .reduce((s, c) => s + c.montantRestant, 0);
      setGroupeMontant(String(total));
      return next;
    });
  };

  const groupeTotal = () => (selectedGroup?.credits || [])
    .filter(c => selectedIds.has(c.venteId))
    .reduce((s, c) => s + c.montantRestant, 0);

  const saveGroupe = async () => {
    const creditsSelec = (selectedGroup?.credits || []).filter(c => selectedIds.has(c.venteId));
    if (!creditsSelec.length) { Alert.alert('Erreur', 'Sélectionnez au moins un crédit'); return; }
    const montant = parseFloat(groupeMontant);
    if (!montant || montant <= 0) { Alert.alert('Erreur', 'Montant invalide'); return; }

    Alert.alert(
      'Confirmer règlement groupé',
      `${creditsSelec.length} crédit(s) — ${money(montant)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', onPress: async () => {
            setSavingGroupe(true);
            const raw = await AsyncStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : {};
            const total = groupeTotal();
            const ratio = montant / total;
            try {
              for (const c of creditsSelec) {
                await api.post('/caisse/credits/reglement', {
                  venteCreditId: c.venteId,
                  montantRegle: Math.round(c.montantRestant * ratio),
                  modePaiement: groupeMode,
                  referencePaiement: groupeRef || undefined,
                  utilisateurId: user.id,
                });
              }
              setShowGroupe(false);
              charger();
            } catch (e: any) {
              Alert.alert('Erreur', e.response?.data?.message || 'Règlement groupé impossible');
            }
            setSavingGroupe(false);
          }
        }
      ]
    );
  };

  // ─── Render helpers ──────────────────────────────────────────────────────
  const renderLignes = (vente: VenteDetail | null, loading: boolean) => {
    if (loading) return <ActivityIndicator size="small" style={{ margin: 12 }} />;
    if (!vente) return <Text style={s.emptyText}>Impossible de charger les produits</Text>;
    const lignes: LigneProduit[] = vente.produits || vente.lignes || [];
    if (!lignes.length) return <Text style={s.emptyText}>Aucun produit</Text>;
    return lignes.map((l, i) => (
      <View key={i} style={s.ligneRow}>
        <Text style={s.ligneName}>{l.produitNom}</Text>
        <Text style={s.ligneQty}>× {l.quantite}</Text>
        <Text style={s.lignePrice}>{money(l.sousTotal)}</Text>
      </View>
    ));
  };

  const renderModeChips = (current: Mode, onSelect: (m: Mode) => void) => (
    <View style={s.chips}>
      {MODES.map(m => (
        <TouchableOpacity key={m} style={[s.chip, current === m && s.chipActive]} onPress={() => onSelect(m)}>
          <Text style={[s.chipText, current === m && s.chipTextActive]}>{MODE_LABELS[m]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Rendu principal ─────────────────────────────────────────────────────
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#9c27b0" />;

  return (
    <View style={s.container}>

      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Total dû</Text>
          <Text style={s.heroVal}>{money(totalCredits)}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Clients</Text>
          <Text style={s.heroVal}>{groups.length}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={[s.heroStat, { opacity: nbRetard > 0 ? 1 : 0.5 }]}>
          <Text style={s.heroLabel}>En retard</Text>
          <Text style={[s.heroVal, { color: '#ff6b6b' }]}>{nbRetard}</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={s.filters}>
        <View style={s.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={onSearch}
            placeholder="Nom ou téléphone..."
            placeholderTextColor="#bbb"
          />
        </View>
        <TouchableOpacity style={[s.retardBtn, filterRetard && s.retardBtnActive]} onPress={toggleRetard}>
          <MaterialCommunityIcons name="alert-outline" size={14} color={filterRetard ? '#fff' : '#f44336'} />
          <Text style={[s.retardBtnText, filterRetard && { color: '#fff' }]}>Retard</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={g => g.clientNom}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color="#4caf50" />
            <Text style={s.emptyStateText}>Aucun crédit en attente</Text>
          </View>
        }
        renderItem={({ item: g }) => (
          <View style={[s.groupCard, g.enRetard && s.groupCardRetard]}>

            {/* En-tête groupe */}
            <TouchableOpacity style={s.groupHeader} onPress={() => toggleGroup(g.clientNom)}>
              <View style={[s.avatar, g.enRetard && s.avatarRetard]}>
                <Text style={s.avatarText}>{g.clientNom[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.clientNom}>{g.clientNom}</Text>
                {g.clientTelephone ? <Text style={s.clientTel}>{g.clientTelephone}</Text> : null}
                <View style={s.badges}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{g.credits.length} crédit{g.credits.length > 1 ? 's' : ''}</Text>
                  </View>
                  {g.enRetard && (
                    <View style={s.badgeRetard}>
                      <MaterialCommunityIcons name="alert" size={10} color="#fff" />
                      <Text style={[s.badgeText, { color: '#fff', marginLeft: 3 }]}>Retard</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.groupTotal, g.enRetard && { color: '#f44336' }]}>{money(g.totalRestant)}</Text>
                <TouchableOpacity style={s.groupeBtn} onPress={() => openGroupe(g)}>
                  <MaterialCommunityIcons name="account-group" size={13} color="#9c27b0" />
                  <Text style={s.groupeBtnText}>Groupé</Text>
                </TouchableOpacity>
                <MaterialCommunityIcons
                  name={g.expanded ? 'chevron-up' : 'chevron-down'}
                  size={20} color="#999" style={{ marginTop: 4 }}
                />
              </View>
            </TouchableOpacity>

            {/* Crédits dépliés */}
            {g.expanded && g.credits.map(credit => (
              <View key={credit.venteId} style={s.creditItem}>
                <View style={s.creditTop}>
                  <View>
                    <Text style={s.creditNum}>{credit.numeroVente}</Text>
                    {credit.dateEcheance && (
                      <Text style={s.creditDate}>
                        <MaterialCommunityIcons name="calendar-outline" size={11} /> {dateStr(credit.dateEcheance)}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.creditMontant, credit.enRetard && { color: '#f44336' }]}>
                      {money(credit.montantRestant)}
                    </Text>
                    <View style={[s.statusBadge, credit.enRetard && s.statusBadgeRetard]}>
                      <Text style={s.statusText}>{credit.enRetard ? '⚠ Retard' : 'En cours'}</Text>
                    </View>
                  </View>
                </View>

                {/* Barre de progression */}
                <View style={s.progressWrap}>
                  <View style={s.progressBg}>
                    <View style={[
                      s.progressFill,
                      credit.enRetard && { backgroundColor: '#f44336' },
                      { width: `${credit.montantTotal > 0 ? Math.round((credit.montantVerse / credit.montantTotal) * 100) : 0}%` as any }
                    ]} />
                  </View>
                  <View style={s.progressLabels}>
                    <Text style={s.progressText}>Versé {money(credit.montantVerse)}</Text>
                    <Text style={s.progressText}>/ {money(credit.montantTotal)}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={s.creditBtns}>
                  <TouchableOpacity style={s.detailBtn} onPress={() => openDetail(credit)}>
                    <MaterialCommunityIcons name="eye-outline" size={14} color="#9c27b0" />
                    <Text style={s.detailBtnText}>Voir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.payBtn} onPress={() => openSimple(credit)}>
                    <MaterialCommunityIcons name="cash" size={14} color="#fff" />
                    <Text style={s.payBtnText}>Payer ce crédit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      />

      {/* ─── MODAL DÉTAIL ─── */}
      <Modal visible={showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Détail du crédit</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {detailCredit && (
                <>
                  <View style={s.infoCard}>
                    {[
                      ['Client', detailCredit.clientNom],
                      ['N° vente', detailCredit.numeroVente],
                      ['Total', money(detailCredit.montantTotal)],
                      ['Versé', money(detailCredit.montantVerse)],
                      ['Reste dû', money(detailCredit.montantRestant)],
                    ].map(([label, val]) => (
                      <View key={label} style={s.infoRow}>
                        <Text style={s.infoLabel}>{label}</Text>
                        <Text style={[s.infoVal, label === 'Reste dû' && { color: '#f44336', fontWeight: 'bold' }]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.sectionTitle}>Produits achetés</Text>
                  {renderLignes(detailVente, loadingDetail)}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowDetail(false)}>
                <Text style={s.btnCancelText}>Fermer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnConfirm} onPress={() => { setShowDetail(false); if (detailCredit) openSimple(detailCredit); }}>
                <MaterialCommunityIcons name="cash" size={15} color="#fff" />
                <Text style={s.btnConfirmText}>Régler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RÈGLEMENT SIMPLE ─── */}
      <Modal visible={showSimple} animationType="slide" transparent onRequestClose={() => setShowSimple(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Règlement crédit</Text>
              <TouchableOpacity onPress={() => setShowSimple(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {selectedCredit && (
                <>
                  <View style={s.infoCard}>
                    {[
                      ['Client', selectedCredit.clientNom],
                      ['N° vente', selectedCredit.numeroVente],
                      ['Total', money(selectedCredit.montantTotal)],
                      ['Versé', money(selectedCredit.montantVerse)],
                      ['Reste dû', money(selectedCredit.montantRestant)],
                    ].map(([label, val]) => (
                      <View key={label} style={s.infoRow}>
                        <Text style={s.infoLabel}>{label}</Text>
                        <Text style={[s.infoVal, label === 'Reste dû' && { color: '#f44336', fontWeight: 'bold' }]}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={s.sectionTitle}>Produits achetés</Text>
                  {renderLignes(simpleVente, loadingVente)}

                  <Text style={s.sectionTitle}>Règlement</Text>
                  <Text style={s.fieldLabel}>Montant à régler</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={simpleMontant}
                    onChangeText={setSimpleMontant}
                    keyboardType="numeric"
                    placeholder={`Max : ${money(selectedCredit.montantRestant)}`}
                  />
                  <Text style={s.fieldLabel}>Mode de paiement</Text>
                  {renderModeChips(simpleMode, setSimpleMode)}
                  {simpleMode !== 'ESPECES' && (
                    <>
                      <Text style={s.fieldLabel}>Référence</Text>
                      <TextInput style={s.fieldInput} value={simpleRef} onChangeText={setSimpleRef} placeholder="N° transaction..." />
                    </>
                  )}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowSimple(false)}>
                <Text style={s.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, savingSimple && { opacity: 0.6 }]} onPress={saveSimple} disabled={savingSimple}>
                {savingSimple
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><MaterialCommunityIcons name="cash" size={15} color="#fff" /><Text style={s.btnConfirmText}>Enregistrer</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RÈGLEMENT GROUPÉ ─── */}
      <Modal visible={showGroupe} animationType="slide" transparent onRequestClose={() => setShowGroupe(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '90%' }]}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle} numberOfLines={1}>Groupé — {selectedGroup?.clientNom}</Text>
              <TouchableOpacity onPress={() => setShowGroupe(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.hint}>Sélectionnez les crédits à inclure :</Text>
              {(selectedGroup?.credits || []).map(c => (
                <TouchableOpacity key={c.venteId} style={[s.groupeItem, selectedIds.has(c.venteId) && s.groupeItemSelected]}
                  onPress={() => toggleId(c.venteId)}>
                  <MaterialCommunityIcons
                    name={selectedIds.has(c.venteId) ? 'checkbox-outline' : 'checkbox-blank-outline'}
                    size={20} color={selectedIds.has(c.venteId) ? '#9c27b0' : '#bbb'}
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.groupeItemNum}>{c.numeroVente}</Text>
                    {c.dateEcheance && <Text style={s.groupeItemDate}>Éch. {dateStr(c.dateEcheance)}</Text>}
                  </View>
                  <Text style={[s.groupeItemMontant, c.enRetard && { color: '#f44336' }]}>{money(c.montantRestant)}</Text>
                </TouchableOpacity>
              ))}

              <View style={s.groupeTotal}>
                <Text style={s.groupeTotalLabel}>{selectedIds.size} crédit(s) sélectionné(s)</Text>
                <Text style={s.groupeTotalVal}>{money(groupeTotal())}</Text>
              </View>

              <Text style={s.fieldLabel}>Montant total à régler</Text>
              <TextInput style={s.fieldInput} value={groupeMontant} onChangeText={setGroupeMontant} keyboardType="numeric" />
              {parseFloat(groupeMontant) < groupeTotal() && (
                <Text style={s.hint}>Montant partiel — distribué proportionnellement</Text>
              )}
              <Text style={s.fieldLabel}>Mode de paiement</Text>
              {renderModeChips(groupeMode, setGroupeMode)}
              {groupeMode !== 'ESPECES' && (
                <>
                  <Text style={s.fieldLabel}>Référence</Text>
                  <TextInput style={s.fieldInput} value={groupeRef} onChangeText={setGroupeRef} placeholder="N° transaction..." />
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowGroupe(false)}>
                <Text style={s.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, (savingGroupe || !selectedIds.size) && { opacity: 0.5 }]}
                onPress={saveGroupe}
                disabled={savingGroupe || !selectedIds.size}
              >
                {savingGroupe
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><MaterialCommunityIcons name="account-group" size={15} color="#fff" /><Text style={s.btnConfirmText}>Régler ({selectedIds.size})</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // Hero
  hero: { backgroundColor: '#9c27b0', flexDirection: 'row', padding: 16, alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginBottom: 2 },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  heroDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Filtres
  filters: { flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: '#333' },
  retardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#f44336' },
  retardBtnActive: { backgroundColor: '#f44336' },
  retardBtnText: { fontSize: 12, color: '#f44336', fontWeight: '600' },

  // Groupe client
  groupCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden', elevation: 2 },
  groupCardRetard: { borderLeftWidth: 3, borderLeftColor: '#f44336' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#9c27b0', alignItems: 'center', justifyContent: 'center' },
  avatarRetard: { backgroundColor: '#f44336' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  clientNom: { fontWeight: 'bold', fontSize: 15, color: '#1a1a1a' },
  clientTel: { color: '#888', fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { backgroundColor: '#f3e5f5', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeRetard: { backgroundColor: '#f44336', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  badgeText: { fontSize: 11, color: '#9c27b0' },
  groupTotal: { fontWeight: 'bold', fontSize: 15, color: '#9c27b0' },
  groupeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#f3e5f5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  groupeBtnText: { fontSize: 11, color: '#9c27b0', fontWeight: '600' },

  // Crédit item
  creditItem: { borderTopWidth: 1, borderTopColor: '#f5f5f5', padding: 12 },
  creditTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  creditNum: { fontWeight: '600', color: '#333', fontSize: 13 },
  creditDate: { color: '#999', fontSize: 11, marginTop: 2 },
  creditMontant: { fontWeight: 'bold', color: '#9c27b0', fontSize: 14 },
  statusBadge: { backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  statusBadgeRetard: { backgroundColor: '#ffebee' },
  statusText: { fontSize: 11, color: '#666' },

  // Barre progression
  progressWrap: { marginBottom: 8 },
  progressBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#9c27b0', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  progressText: { fontSize: 10, color: '#aaa' },

  // Boutons crédit
  creditBtns: { flexDirection: 'row', gap: 8 },
  detailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#9c27b0', borderRadius: 8, paddingVertical: 7 },
  detailBtnText: { color: '#9c27b0', fontSize: 13, fontWeight: '600' },
  payBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#9c27b0', borderRadius: 8, paddingVertical: 7 },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { color: '#999', fontSize: 15 },
  emptyText: { color: '#aaa', textAlign: 'center', padding: 12, fontSize: 13 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Info card
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500' },

  // Lignes produits
  sectionTitle: { fontWeight: 'bold', color: '#9c27b0', marginBottom: 8, fontSize: 13 },
  ligneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  ligneName: { flex: 1, color: '#333', fontSize: 13 },
  ligneQty: { color: '#888', fontSize: 12, marginHorizontal: 8 },
  lignePrice: { color: '#9c27b0', fontWeight: '600', fontSize: 13 },

  // Formulaire
  fieldLabel: { color: '#666', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipActive: { backgroundColor: '#9c27b0', borderColor: '#9c27b0' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { color: '#999', fontSize: 12, fontStyle: 'italic', marginTop: 6 },

  // Groupé
  groupeItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#eee' },
  groupeItemSelected: { borderColor: '#9c27b0', backgroundColor: '#f3e5f5' },
  groupeItemNum: { fontWeight: '600', color: '#333', fontSize: 13 },
  groupeItemDate: { color: '#999', fontSize: 11, marginTop: 2 },
  groupeItemMontant: { fontWeight: 'bold', color: '#9c27b0', fontSize: 14 },
  groupeTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3e5f5', borderRadius: 10, padding: 12, marginVertical: 10 },
  groupeTotalLabel: { color: '#666', fontSize: 13 },
  groupeTotalVal: { fontWeight: 'bold', color: '#9c27b0', fontSize: 16 },

  // Boutons footer modal
  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: { flex: 2, backgroundColor: '#9c27b0', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
