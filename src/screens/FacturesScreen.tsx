import React, { useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Linking, Alert, Image,
  TouchableOpacity, Modal, ScrollView, TextInput as RNTextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getFactures, creerFactureProforma, changerStatutFacture, getBackendRootUrl, getProduits } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useAuth } from '../hooks/useAuth';
import { MontantInput } from '../components/MontantInput';

const money = (v?: number) => `${(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`;
const fdate = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const STATUTS = ['BROUILLON', 'VALIDE', 'PAYEE', 'ANNULEE'] as const;
type Statut = typeof STATUTS[number];
const STATUT_LABEL: Record<Statut, string> = { BROUILLON: 'Brouillon', VALIDE: 'Validée', PAYEE: 'Payée', ANNULEE: 'Annulée' };
const STATUT_COLOR: Record<Statut, string> = { BROUILLON: '#94a3b8', VALIDE: '#1a56db', PAYEE: '#16a34a', ANNULEE: '#dc2626' };

interface LigneProforma { designation: string; quantite: string; prixUnitaire: number; }

export default function FacturesScreen() {
  const { lang } = useLang();
  const { user } = useAuth();
  const isAdmin = user?.role !== 'VENDEUR';

  const [factures, setFactures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState<Statut | ''>('');

  // Modal détail (bandeau statut + actions admin)
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [changingStatut, setChangingStatut] = useState(false);

  // Modal QR
  const [showQr, setShowQr] = useState(false);

  // Modal création pro forma
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clientNom, setClientNom] = useState('');
  const [clientTelephone, setClientTelephone] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<LigneProforma[]>([]);
  const [newLigne, setNewLigne] = useState<LigneProforma>({ designation: '', quantite: '1', prixUnitaire: 0 });
  const [produits, setProduits] = useState<any[]>([]);
  const [produitSearch, setProduitSearch] = useState('');
  const [showProduitSearch, setShowProduitSearch] = useState(false);

  const charger = async () => {
    try {
      const res = await getFactures();
      const brute = res.data?.data || res.data?.factures || res.data || [];
      // BUG FIX (2026-08-14) : le backend renvoie chaque facture enveloppee
      // { facture: {...}, boutique: {...} } (cf. wrapFactureWithBoutique cote
      // Spring), pas les champs a plat -> item.numeroFacture/montantTotal/id
      // etc. etaient tous undefined (0 FCFA, "Client divers", cle dupliquee
      // "undefined" -> avertissement React + PDF/detail casses).
      const liste = brute.map((w: any) => (w && w.facture) ? w.facture : w);
      setFactures(liste);
      setFromCache(false);
      AsyncStorage.setItem('cache_factures_pf', JSON.stringify(liste)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem('cache_factures_pf');
        if (s) { setFactures(JSON.parse(s)); setFromCache(true); } else setFromCache(false);
      } catch { setFromCache(false); }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const filtered = factures.filter(f => {
    if (filterStatut && f.statut !== filterStatut) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      if (!(f.numeroFacture || '').toLowerCase().includes(t) && !(f.clientNom || '').toLowerCase().includes(t)) return false;
    }
    return true;
  });

  const totalMontant = factures.reduce((s, f) => s + (f.montantTotal || 0), 0);
  const nbBrouillons = factures.filter(f => f.statut === 'BROUILLON').length;
  const nbValides = factures.filter(f => f.statut === 'VALIDE').length;
  const nbPayees = factures.filter(f => f.statut === 'PAYEE').length;

  // ─── Création pro forma ───────────────────────────────────────────────────
  const ouvrirCreation = async () => {
    setClientNom(''); setClientTelephone(''); setNotes(''); setLignes([]);
    setNewLigne({ designation: '', quantite: '1', prixUnitaire: 0 });
    setShowCreate(true);
    try {
      const res = await getProduits();
      setProduits(res.data?.data || res.data || []);
    } catch { setProduits([]); }
  };

  const produitsFiltres = produitSearch.trim()
    ? produits.filter(p => p.nom.toLowerCase().includes(produitSearch.toLowerCase())).slice(0, 8)
    : [];

  const selectProduit = (p: any) => {
    setNewLigne({ designation: p.nom, quantite: '1', prixUnitaire: p.prixVente || 0 });
    setProduitSearch('');
    setShowProduitSearch(false);
  };

  const addLigne = () => {
    if (!newLigne.designation.trim() || !newLigne.quantite || !newLigne.prixUnitaire) {
      Alert.alert(tr('erreur', lang), 'Désignation, quantité et prix requis'); return;
    }
    setLignes(prev => [...prev, newLigne]);
    setNewLigne({ designation: '', quantite: '1', prixUnitaire: 0 });
  };

  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i));

  const proformaTotal = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (l.prixUnitaire || 0), 0);

  const submitProforma = async () => {
    if (!lignes.length) return;
    setCreating(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const utilisateurId = raw ? JSON.parse(raw)?.id : undefined;
      await creerFactureProforma({
        clientNom: clientNom.trim() || undefined,
        clientTelephone: clientTelephone.trim() || undefined,
        notes: notes.trim() || undefined,
        utilisateurId,
        lignes: lignes.map(l => ({
          designation: l.designation,
          quantite: parseInt(l.quantite, 10) || 1,
          prixUnitaire: l.prixUnitaire || 0,
        })),
      });
      setShowCreate(false);
      await charger();
      Alert.alert(tr('succes', lang), 'Facture pro forma créée');
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Impossible de créer la facture');
    }
    setCreating(false);
  };

  // ─── Actions carte ─────────────────────────────────────────────────────────
  const voirPdf = (f: any) => Linking.openURL(`${getBackendRootUrl()}/api/caisse/factures/${f.id}/pdf/view`);
  const telechargerPdf = (f: any) => Linking.openURL(`${getBackendRootUrl()}/api/caisse/factures/${f.id}/pdf`);

  const ouvrirDetail = (f: any) => { setSelected(f); setShowDetail(true); };
  const ouvrirQr = (f: any) => { setSelected(f); setShowQr(true); };

  const changerStatut = async (statut: Statut) => {
    if (!selected) return;
    setChangingStatut(true);
    try {
      await changerStatutFacture(selected.id, statut);
      setShowDetail(false);
      await charger();
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Changement de statut impossible');
    }
    setChangingStatut(false);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Hero stats */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroLbl}>Total</Text>
          <Text style={styles.heroVal} numberOfLines={1}>{money(totalMontant)}</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroLbl}>Brouillons</Text>
          <Text style={styles.heroVal}>{nbBrouillons}</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={[styles.heroLbl, { color: '#4ade80' }]}>Validées</Text>
          <Text style={[styles.heroVal, { color: '#4ade80' }]}>{nbValides}</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroLbl}>Payées</Text>
          <Text style={styles.heroVal}>{nbPayees}</Text>
        </View>
      </View>


      {/* Filtres */}
      <View style={styles.filterZone}>
        <RNTextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="N° facture ou client..."
        />
        <View style={styles.statutChips}>
          {STATUTS.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.chip, { borderColor: STATUT_COLOR[s] }, filterStatut === s && { backgroundColor: STATUT_COLOR[s] }]}
              onPress={() => setFilterStatut(filterStatut === s ? '' : s)}
            >
              <Text style={[styles.chipText, { color: filterStatut === s ? '#fff' : STATUT_COLOR[s] }]}>{STATUT_LABEL[s]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.btnCreer} onPress={ouvrirCreation}>
        <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#fff" />
        <Text style={styles.btnCreerText}>Nouvelle facture pro forma</Text>
      </TouchableOpacity>

      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
        ListEmptyComponent={<Text style={styles.empty}>{tr('aucune_facture', lang)}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => ouvrirDetail(item)} activeOpacity={0.8}>
            <View style={styles.cardTop}>
              <Text style={styles.factNum}>{item.numeroFacture}</Text>
              <Text style={styles.factMontant}>{money(item.montantTotal)}</Text>
            </View>
            <View style={styles.cardMid}>
              <Text style={styles.factClient}>
                <MaterialCommunityIcons name="account-outline" size={12} /> {item.clientNom || 'Client divers'}
              </Text>
              <Text style={styles.factDate}>{fdate(item.dateCreation)}</Text>
            </View>
            <View style={styles.cardActions}>
              <View style={[styles.statutBadge, { backgroundColor: (STATUT_COLOR[item.statut as Statut] || '#94a3b8') + '22' }]}>
                <Text style={[styles.statutBadgeText, { color: STATUT_COLOR[item.statut as Statut] || '#94a3b8' }]}>
                  {STATUT_LABEL[item.statut as Statut] || item.statut}
                </Text>
              </View>
              <TouchableOpacity style={styles.actBtn} onPress={() => voirPdf(item)}>
                <MaterialCommunityIcons name="eye-outline" size={16} color="#1a56db" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actBtn} onPress={() => ouvrirQr(item)}>
                <MaterialCommunityIcons name="qrcode" size={16} color="#7c3aed" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, styles.actBtnPdf]} onPress={() => telechargerPdf(item)}>
                <MaterialCommunityIcons name="file-pdf-box" size={14} color="#fff" />
                <Text style={styles.actBtnPdfText}>PDF</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* ── Modal détail + actions admin ─────────────────────────────────────── */}
      <Modal visible={showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {selected && (
              <>
                <View style={styles.detailHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailNom}>{selected.numeroFacture}</Text>
                    <Text style={styles.detailSub}>{selected.clientNom || 'Client divers'} · {fdate(selected.dateCreation)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.closeBtn}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ padding: 16 }}>
                  <View style={[styles.statutBadge, { alignSelf: 'flex-start', backgroundColor: (STATUT_COLOR[selected.statut as Statut] || '#94a3b8') + '22', marginBottom: 12 }]}>
                    <Text style={[styles.statutBadgeText, { color: STATUT_COLOR[selected.statut as Statut] || '#94a3b8' }]}>
                      {STATUT_LABEL[selected.statut as Statut] || selected.statut}
                    </Text>
                  </View>
                  {(selected.lignes || []).map((l: any, i: number) => (
                    <View key={i} style={styles.detailLigne}>
                      <Text style={{ flex: 1, fontSize: 13 }}>{l.designation || l.produitNom}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b', marginRight: 8 }}>×{l.quantite}</Text>
                      <Text style={{ fontWeight: '700', fontSize: 13 }}>{money(l.sousTotal || l.quantite * l.prixUnitaire)}</Text>
                    </View>
                  ))}
                  <View style={[styles.detailLigne, { borderTopWidth: 2, borderTopColor: '#1a56db', marginTop: 6, paddingTop: 10 }]}>
                    <Text style={{ flex: 1, fontWeight: 'bold' }}>Total</Text>
                    <Text style={{ fontWeight: 'bold', color: '#1a56db', fontSize: 15 }}>{money(selected.montantTotal)}</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                    <TouchableOpacity style={styles.btnPdfLarge} onPress={() => telechargerPdf(selected)}>
                      <MaterialCommunityIcons name="download-outline" size={16} color="#1a56db" />
                      <Text style={styles.btnPdfLargeText}>PDF</Text>
                    </TouchableOpacity>
                  </View>

                  {isAdmin && (
                    <View style={{ marginTop: 16, gap: 8 }}>
                      {selected.statut === 'BROUILLON' && (
                        <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#1a56db' }]} disabled={changingStatut} onPress={() => changerStatut('VALIDE')}>
                          <Text style={styles.adminBtnText}>✓ Valider</Text>
                        </TouchableOpacity>
                      )}
                      {selected.statut === 'VALIDE' && (
                        <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#16a34a' }]} disabled={changingStatut} onPress={() => changerStatut('PAYEE')}>
                          <Text style={styles.adminBtnText}>✓ Marquer payée</Text>
                        </TouchableOpacity>
                      )}
                      {selected.statut !== 'ANNULEE' && selected.statut !== 'PAYEE' && (
                        <TouchableOpacity style={[styles.adminBtn, { backgroundColor: '#dc2626' }]} disabled={changingStatut} onPress={() => changerStatut('ANNULEE')}>
                          <Text style={styles.adminBtnText}>✕ Annuler</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal QR ──────────────────────────────────────────────────────────── */}
      <Modal visible={showQr} animationType="slide" transparent onRequestClose={() => setShowQr(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailNom}>QR · {selected?.numeroFacture}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowQr(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                Scanner pour obtenir la facture PDF
              </Text>
              {selected?.id ? (
                <Image
                  source={{ uri: `${getBackendRootUrl()}/api/caisse/factures/${selected.id}/qrcode` }}
                  style={{ width: 200, height: 200, borderRadius: 12, borderWidth: 2, borderColor: '#e2e8f0' }}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal création pro forma ──────────────────────────────────────────── */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailNom}>Nouvelle facture pro forma</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCreate(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.pfSectionTitle}>Client (optionnel)</Text>
                <RNTextInput style={styles.pfInput} value={clientNom} onChangeText={setClientNom} placeholder="Nom du client..." />
                <RNTextInput style={styles.pfInput} value={clientTelephone} onChangeText={setClientTelephone} placeholder="Téléphone..." keyboardType="phone-pad" />

                <Text style={styles.pfSectionTitle}>Articles</Text>
                <RNTextInput
                  style={styles.pfInput}
                  value={produitSearch}
                  onChangeText={t => { setProduitSearch(t); setShowProduitSearch(true); }}
                  onFocus={() => setShowProduitSearch(true)}
                  placeholder="Chercher un produit du catalogue..."
                />
                {showProduitSearch && produitsFiltres.length > 0 && (
                  <View style={styles.pfCatalogList}>
                    {produitsFiltres.map(p => (
                      <TouchableOpacity key={p.id} style={styles.pfCatalogItem} onPress={() => selectProduit(p)}>
                        <Text style={{ fontSize: 13 }}>{p.nom}</Text>
                        <Text style={{ fontSize: 12, color: '#1a56db', fontWeight: '600' }}>{money(p.prixVente)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <RNTextInput
                  style={styles.pfInput}
                  value={newLigne.designation}
                  onChangeText={t => setNewLigne(l => ({ ...l, designation: t }))}
                  placeholder="Désignation (modifiable) *"
                />
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pfLabel}>Qté</Text>
                    <RNTextInput style={styles.pfInput} value={newLigne.quantite} onChangeText={t => setNewLigne(l => ({ ...l, quantite: t }))} keyboardType="numeric" />
                  </View>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.pfLabel}>Prix unitaire (FCFA)</Text>
                    <MontantInput style={styles.pfInput} value={newLigne.prixUnitaire} onChangeValue={v => setNewLigne(l => ({ ...l, prixUnitaire: v }))} />
                  </View>
                  <TouchableOpacity style={styles.pfAddBtn} onPress={addLigne}>
                    <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {lignes.length === 0 ? (
                  <Text style={styles.pfEmpty}>Aucun article ajouté</Text>
                ) : (
                  lignes.map((l, i) => (
                    <View key={i} style={styles.pfLigne}>
                      <Text style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>{l.designation}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b' }}>×{l.quantite}</Text>
                      <Text style={{ fontWeight: '700', fontSize: 13, marginLeft: 8 }}>
                        {money((parseFloat(l.quantite) || 0) * (l.prixUnitaire || 0))}
                      </Text>
                      <TouchableOpacity onPress={() => removeLigne(i)} style={{ marginLeft: 8 }}>
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#dc2626" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
                {lignes.length > 0 && (
                  <View style={styles.pfTotal}>
                    <Text style={{ fontWeight: 'bold' }}>Total</Text>
                    <Text style={{ fontWeight: 'bold', color: '#1a56db', fontSize: 15 }}>{money(proformaTotal)}</Text>
                  </View>
                )}

                <Text style={styles.pfSectionTitle}>Notes</Text>
                <RNTextInput
                  style={[styles.pfInput, { height: 70, textAlignVertical: 'top' }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Informations complémentaires..."
                  multiline
                />

                <TouchableOpacity
                  style={[styles.pfSubmit, (creating || !lignes.length) && { opacity: 0.5 }]}
                  disabled={creating || !lignes.length}
                  onPress={submitProforma}
                >
                  {creating ? <ActivityIndicator size="small" color="#fff" /> : <MaterialCommunityIcons name="check" size={18} color="#fff" />}
                  <Text style={styles.pfSubmitText}>{creating ? 'Création...' : 'Créer la facture'}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 10, marginBottom: 3 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  filterZone: { padding: 12, paddingBottom: 6 },
  searchInput: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 8 },
  statutChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11, fontWeight: '700' },

  btnCreer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a56db', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, paddingVertical: 11 },
  btnCreerText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  factNum: { fontWeight: '700', fontSize: 13, color: '#1e293b' },
  factMontant: { fontWeight: '700', fontSize: 14, color: '#1a56db' },
  cardMid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  factClient: { fontSize: 12, color: '#64748b' },
  factDate: { fontSize: 11, color: '#94a3b8' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statutBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 'auto' },
  statutBadgeText: { fontSize: 11, fontWeight: '700' },
  actBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  actBtnPdf: { flexDirection: 'row', gap: 3, width: 'auto', paddingHorizontal: 10, backgroundColor: '#1a56db' },
  actBtnPdfText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  empty: { textAlign: 'center', marginTop: 40, color: '#94a3b8' },

  // Sheets
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailNom: { fontWeight: 'bold', fontSize: 16, color: '#1e293b' },
  detailSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 8 },
  closeBtnText: { color: '#64748b', fontSize: 18, fontWeight: '600' },

  detailLigne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  btnPdfLarge: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#1a56db', borderRadius: 10, paddingVertical: 11 },
  btnPdfLargeText: { color: '#1a56db', fontWeight: '700' },
  adminBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  adminBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Pro forma
  pfSectionTitle: { fontSize: 12, fontWeight: '700', color: '#475569', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  pfInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, marginBottom: 8, backgroundColor: '#fff' },
  pfLabel: { fontSize: 11, color: '#64748b', marginBottom: 3 },
  pfAddBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  pfCatalogList: { backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8, maxHeight: 180 },
  pfCatalogItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pfEmpty: { textAlign: 'center', color: '#94a3b8', fontSize: 12, paddingVertical: 12 },
  pfLigne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pfTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 2, borderTopColor: '#1a56db', marginTop: 8, paddingTop: 8 },
  pfSubmit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1a56db', borderRadius: 10, paddingVertical: 13, marginTop: 18 },
  pfSubmitText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
