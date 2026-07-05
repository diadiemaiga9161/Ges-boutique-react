import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert,
  Modal, ScrollView, TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, Searchbar, ActivityIndicator, ProgressBar } from 'react-native-paper';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getVentes, getVentesJour, getVentesParPeriode,
  getVenteDetail, annulerVente,
} from '../services/api.service';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const money = (v: number) => (v || 0).toLocaleString('fr-FR') + ' FCFA';

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type TypeFilter = '' | 'COMPTANT' | 'CREDIT' | 'EN_RETARD';
type ActivePeriod = 'today' | 'week' | 'month' | 'all';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function HistoriqueVentesScreen() {
  const [ventes, setVentes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [activePeriod, setActivePeriod] = useState<ActivePeriod>('today');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // Modal détail
  const [showModal, setShowModal] = useState(false);
  const [selectedVente, setSelectedVente] = useState<any | null>(null);
  const [venteDetail, setVenteDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);

  // ─── Chargement ────────────────────────────────────────────────────────────
  const charger = useCallback(async (period: ActivePeriod = activePeriod) => {
    try {
      let res: any;
      const now = new Date();

      if (period === 'today') {
        res = await getVentesJour();
      } else if (period === 'week') {
        const debut = new Date(now);
        debut.setDate(now.getDate() - 6);
        const dd = toLocalDate(debut);
        const df = toLocalDate(now);
        setDateDebut(dd);
        setDateFin(df);
        res = await getVentesParPeriode(dd, df);
      } else if (period === 'month') {
        const debut = new Date(now.getFullYear(), now.getMonth(), 1);
        const dd = toLocalDate(debut);
        const df = toLocalDate(now);
        setDateDebut(dd);
        setDateFin(df);
        res = await getVentesParPeriode(dd, df);
      } else {
        res = await getVentes();
      }

      const data: any[] = res.data?.data || res.data || [];
      setVentes(data);
      applyFilter(data, search, typeFilter);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  }, [activePeriod, search, typeFilter]);

  useEffect(() => { charger(); }, []);

  // ─── Filtre ────────────────────────────────────────────────────────────────
  const applyFilter = (data: any[], term: string, type: TypeFilter) => {
    const now = new Date();
    let result = [...data];

    if (type === 'COMPTANT') {
      result = result.filter((v: any) => !v.estCredit);
    } else if (type === 'CREDIT') {
      result = result.filter((v: any) => v.estCredit);
    } else if (type === 'EN_RETARD') {
      result = result.filter((v: any) => {
        if (!v.estCredit) return false;
        if (v.creditRegle) return false;
        if (!v.dateEcheance) return false;
        return new Date(v.dateEcheance) < now;
      });
    }

    if (term.trim()) {
      const q = term.trim().toLowerCase();
      result = result.filter((v: any) =>
        (v.clientNom || '').toLowerCase().includes(q) ||
        (v.numeroVente || '').toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  };

  const onSearch = (v: string) => {
    setSearch(v);
    applyFilter(ventes, v, typeFilter);
  };

  const onTypeFilter = (t: TypeFilter) => {
    setTypeFilter(t);
    applyFilter(ventes, search, t);
  };

  const onPeriod = (p: ActivePeriod) => {
    setActivePeriod(p);
    setLoading(true);
    charger(p);
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const caTotal = filtered.reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const nbVentes = filtered.length;
  const totalCreditRestant = filtered
    .filter((v: any) => v.estCredit && !v.creditRegle)
    .reduce((s: number, v: any) => {
      const restant = v.montantRestant ?? Math.max(0, (v.montantTotal || 0) - (v.montantVerse || 0));
      return s + restant;
    }, 0);

  // ─── Modal détail ──────────────────────────────────────────────────────────
  const openModal = async (vente: any) => {
    setSelectedVente(vente);
    setVenteDetail(null);
    setShowModal(true);

    // Charger le rôle utilisateur
    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : {};
      const role: string = user.role || '';
      setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
    } catch {
      setIsAdmin(false);
    }

    // Charger le détail vente
    setLoadingDetail(true);
    try {
      const res = await getVenteDetail(vente.id);
      setVenteDetail(res.data?.data || res.data);
    } catch { }
    setLoadingDetail(false);
  };

  const handleAnnuler = (vente: any) => {
    Alert.alert(
      'Annuler la vente',
      `Confirmer l'annulation de la vente ${vente.numeroVente || '#' + vente.id} ?`,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler', style: 'destructive',
          onPress: async () => {
            setAnnulationEnCours(true);
            try {
              await annulerVente(vente.id);
              setShowModal(false);
              setLoading(true);
              charger(activePeriod);
            } catch (e: any) {
              Alert.alert('Erreur', e.response?.data?.message || 'Impossible d\'annuler la vente');
            }
            setAnnulationEnCours(false);
          },
        },
      ]
    );
  };

  const handleImprimer = async (vente: any, detail: any) => {
    const lignes: any[] = detail?.lignes || detail?.produits || [];
    const clientNom = vente.clientNom || 'Client anonyme';
    const dateStr = new Date(vente.dateVente).toLocaleDateString('fr-FR');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial;padding:20px}h2{color:#1a56db}.total{font-size:18px;font-weight:bold}</style>
</head><body>
<h2>FACTURE ${vente.numeroVente || '#' + vente.id}</h2>
<p>Date: ${dateStr} | Client: ${clientNom}</p>
<hr>
${lignes.map((l: any) => `<p>${l.produitNom} x${l.quantite} = ${l.sousTotal} FCFA</p>`).join('')}
<hr>
<p class="total">TOTAL: ${vente.montantTotal} FCFA</p>
${vente.estCredit ? `<p>Versé: ${vente.montantVerse || 0} FCFA | Reste: ${vente.montantRestant ?? Math.max(0, vente.montantTotal - (vente.montantVerse || 0))} FCFA</p>` : ''}
</body></html>`;
    try {
      await Print.printAsync({ html });
    } catch {
      Alert.alert('Erreur', 'Impossible d\'imprimer');
    }
  };

  // ─── Rendu si chargement initial ───────────────────────────────────────────
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>CA Total</Text>
          <Text style={styles.kpiVal}>{money(caTotal)}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Ventes</Text>
          <Text style={styles.kpiVal}>{nbVentes}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Crédit restant</Text>
          <Text style={styles.kpiVal}>{money(totalCreditRestant)}</Text>
        </View>
      </View>

      {/* Filtres période */}
      <View style={styles.periodRow}>
        {([ ['today', 'Aujourd\'hui'], ['week', 'Semaine'], ['month', 'Mois'], ['all', 'Tout'] ] as [ActivePeriod, string][]).map(([p, label]) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, activePeriod === p && styles.periodBtnActive]}
            onPress={() => onPeriod(p)}
          >
            <Text style={[styles.periodBtnText, activePeriod === p && styles.periodBtnTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Chips type */}
      <View style={styles.chipRow}>
        {([ ['', 'Tous'], ['COMPTANT', 'Comptant'], ['CREDIT', 'Crédit'], ['EN_RETARD', 'En retard'] ] as [TypeFilter, string][]).map(([t, label]) => (
          <Chip
            key={t}
            compact
            onPress={() => onTypeFilter(t)}
            style={[styles.filterChip, typeFilter === t && styles.filterChipActive]}
            textStyle={[styles.filterChipText, typeFilter === t && styles.filterChipTextActive]}
          >
            {label}
          </Chip>
        ))}
      </View>

      {/* Barre de recherche */}
      <Searchbar
        placeholder="Rechercher client, N° vente..."
        value={search}
        onChangeText={onSearch}
        style={styles.search}
        inputStyle={{ fontSize: 14 }}
      />

      {/* Liste ventes */}
      <FlatList
        data={filtered}
        keyExtractor={(v: any) => String(v.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(activePeriod); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucune vente pour cette période</Text>
        }
        renderItem={({ item }) => {
          const isAnnulee = item.annulee || item.statut === 'ANNULEE';
          const isCredit = item.estCredit;
          const montantVerse = item.montantVerse || 0;
          const montantTotal = item.montantTotal || 0;
          const progression = montantTotal > 0 ? montantVerse / montantTotal : 0;

          return (
            <TouchableOpacity onPress={() => openModal(item)} activeOpacity={0.85}>
              <Card style={[styles.card, isAnnulee && styles.cardAnnulee]}>
                <Card.Content>
                  {/* Ligne 1 : client + montant */}
                  <View style={styles.row}>
                    <Text variant="titleMedium" style={styles.clientNom} numberOfLines={1}>
                      {item.clientNom || 'Client anonyme'}
                    </Text>
                    <Text style={styles.montant}>{money(montantTotal)}</Text>
                  </View>

                  {/* Ligne 2 : date + mode paiement */}
                  <View style={styles.row}>
                    <Text style={styles.date}>
                      {new Date(item.dateVente).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                    <Chip compact style={styles.modeChip} textStyle={styles.modeChipText}>
                      {(item.modePaiement || 'COMPTANT').replace('_', ' ')}
                    </Chip>
                  </View>

                  {/* Ligne 3 : badge crédit + barre progression */}
                  {isCredit && !isAnnulee && (
                    <View style={styles.creditSection}>
                      <View style={styles.row}>
                        <View style={styles.badgeCredit}>
                          <Text style={styles.badgeCreditText}>CREDIT</Text>
                        </View>
                        <Text style={styles.creditInfo}>
                          Versé {money(montantVerse)} / {money(montantTotal)}
                        </Text>
                      </View>
                      <ProgressBar
                        progress={progression}
                        color="#1a56db"
                        style={styles.progressBar}
                      />
                    </View>
                  )}

                  {/* Ligne 4 : badge annulée */}
                  {isAnnulee && (
                    <View style={styles.badgeAnnulee}>
                      <Text style={styles.badgeAnnuleeText}>ANNULEE</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      {/* ─── MODAL DETAIL ─── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.handle} />

            {/* Header modal */}
            <View style={styles.modalHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedVente ? (selectedVente.numeroVente || 'Détail vente') : 'Détail vente'}
                </Text>
                {selectedVente && (
                  <Text style={styles.modalSub}>
                    {new Date(selectedVente.dateVente).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedVente && (
                <>
                  {/* Infos client */}
                  <View style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Informations</Text>
                    {[
                      ['Client', selectedVente.clientNom || 'Client anonyme'],
                      selectedVente.clientTelephone ? ['Téléphone', selectedVente.clientTelephone] : null,
                      ['N° vente', selectedVente.numeroVente || '—'],
                    ].filter((r): r is [string, string] => r !== null).map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoVal}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Produits */}
                  <Text style={styles.sectionTitle}>Produits</Text>
                  {loadingDetail ? (
                    <ActivityIndicator size="small" color="#1a56db" style={{ margin: 12 }} />
                  ) : venteDetail ? (
                    (() => {
                      const lignes: any[] = venteDetail.lignes || venteDetail.produits || [];
                      if (!lignes.length) return <Text style={styles.emptyText}>Aucun produit</Text>;
                      return lignes.map((l: any, i: number) => (
                        <View key={i} style={styles.ligneRow}>
                          <Text style={styles.ligneName} numberOfLines={2}>{l.produitNom}</Text>
                          <Text style={styles.ligneQty}>x{l.quantite}</Text>
                          <Text style={styles.lignePrice}>{money(l.sousTotal)}</Text>
                        </View>
                      ));
                    })()
                  ) : (
                    <Text style={styles.emptyText}>Impossible de charger les produits</Text>
                  )}

                  {/* Paiement */}
                  <View style={[styles.infoCard, { marginTop: 14 }]}>
                    <Text style={styles.sectionTitle}>Paiement</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Mode</Text>
                      <Text style={styles.infoVal}>
                        {(selectedVente.modePaiement || 'COMPTANT').replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Total</Text>
                      <Text style={[styles.infoVal, { fontWeight: 'bold', color: '#1a56db' }]}>
                        {money(selectedVente.montantTotal)}
                      </Text>
                    </View>
                    {selectedVente.estCredit && (
                      <>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Versé</Text>
                          <Text style={[styles.infoVal, { color: '#16a34a' }]}>
                            {money(selectedVente.montantVerse || 0)}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>Reste dû</Text>
                          <Text style={[styles.infoVal, { color: '#dc2626', fontWeight: 'bold' }]}>
                            {money(selectedVente.montantRestant ?? Math.max(0, selectedVente.montantTotal - (selectedVente.montantVerse || 0)))}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Boutons footer */}
            <View style={styles.modalFoot}>
              <TouchableOpacity style={styles.btnClose} onPress={() => setShowModal(false)}>
                <Text style={styles.btnCloseText}>Fermer</Text>
              </TouchableOpacity>

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity
                  style={styles.btnPrint}
                  onPress={() => handleImprimer(selectedVente, venteDetail)}
                >
                  <Text style={styles.btnPrintText}>Imprimer</Text>
                </TouchableOpacity>
              )}

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && isAdmin && (
                <TouchableOpacity
                  style={[styles.btnCancel, annulationEnCours && { opacity: 0.5 }]}
                  onPress={() => handleAnnuler(selectedVente)}
                  disabled={annulationEnCours}
                >
                  {annulationEnCours
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.btnCancelText}>Annuler vente</Text>
                  }
                </TouchableOpacity>
              )}
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

  // KPI
  kpiRow: {
    flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 6,
  },
  kpiCard: {
    flex: 1, backgroundColor: '#1a56db', borderRadius: 12,
    padding: 12, alignItems: 'center',
  },
  kpiLabel: {
    color: 'rgba(255,255,255,0.75)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase',
  },
  kpiVal: {
    color: '#fff', fontWeight: 'bold', fontSize: 13, textAlign: 'center',
  },

  // Période
  periodRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6,
  },
  periodBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed',
  },
  periodBtnActive: {
    backgroundColor: '#1a56db', borderColor: '#1a56db',
  },
  periodBtnText: {
    fontSize: 12, color: '#666', fontWeight: '600',
  },
  periodBtnTextActive: {
    color: '#fff',
  },

  // Chips type
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, marginBottom: 2,
  },
  filterChip: {
    backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed',
  },
  filterChipActive: {
    backgroundColor: '#1a56db',
  },
  filterChipText: {
    fontSize: 12, color: '#555',
  },
  filterChipTextActive: {
    color: '#fff', fontWeight: '700',
  },

  // Searchbar
  search: {
    marginHorizontal: 12, marginTop: 6, marginBottom: 4,
    borderRadius: 12, elevation: 0, backgroundColor: '#fff',
  },

  // Card vente
  card: {
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, elevation: 2,
  },
  cardAnnulee: {
    opacity: 0.6, borderLeftWidth: 3, borderLeftColor: '#dc2626',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
  },
  clientNom: {
    flex: 1, fontWeight: 'bold', color: '#1a1a1a', marginRight: 8,
  },
  montant: {
    fontWeight: 'bold', color: '#1a56db', fontSize: 16,
  },
  date: {
    color: '#888', fontSize: 11, flex: 1,
  },
  modeChip: {
    backgroundColor: '#eff6ff',
  },
  modeChipText: {
    fontSize: 11, color: '#1a56db',
  },
  creditSection: {
    marginTop: 6,
  },
  badgeCredit: {
    backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeCreditText: {
    color: '#dc2626', fontSize: 10, fontWeight: 'bold',
  },
  creditInfo: {
    fontSize: 11, color: '#888', marginLeft: 8,
  },
  progressBar: {
    marginTop: 6, height: 5, borderRadius: 3, backgroundColor: '#e5e7eb',
  },
  badgeAnnulee: {
    backgroundColor: '#fee2e2', borderRadius: 6, paddingHorizontal: 8,
    paddingVertical: 3, alignSelf: 'flex-start', marginTop: 4,
  },
  badgeAnnuleeText: {
    color: '#dc2626', fontSize: 10, fontWeight: 'bold',
  },
  empty: {
    textAlign: 'center', marginTop: 60, color: '#999', fontSize: 15,
  },
  emptyText: {
    textAlign: 'center', color: '#aaa', fontSize: 13, padding: 12,
  },

  // Modal
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2,
    alignSelf: 'center', marginTop: 10,
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontWeight: 'bold', fontSize: 17, color: '#1a1a1a',
  },
  modalSub: {
    fontSize: 12, color: '#888', marginTop: 2,
  },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f5f5',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: {
    color: '#666', fontSize: 14, fontWeight: 'bold',
  },
  modalBody: {
    padding: 16, maxHeight: 440,
  },

  // Info card
  infoCard: {
    backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: 'bold', color: '#1a56db', fontSize: 13, marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: {
    color: '#888', fontSize: 13,
  },
  infoVal: {
    color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right',
  },

  // Lignes produits
  ligneRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  ligneName: {
    flex: 1, color: '#333', fontSize: 13,
  },
  ligneQty: {
    color: '#888', fontSize: 12, marginHorizontal: 10,
  },
  lignePrice: {
    color: '#1a56db', fontWeight: '600', fontSize: 13,
  },

  // Footer modal
  modalFoot: {
    flexDirection: 'row', gap: 8, padding: 16,
    borderTopWidth: 1, borderTopColor: '#f0f0f0', flexWrap: 'wrap',
  },
  btnClose: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 80,
  },
  btnCloseText: {
    color: '#666', fontWeight: '600',
  },
  btnPrint: {
    flex: 1, backgroundColor: '#1a56db', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 80,
  },
  btnPrintText: {
    color: '#fff', fontWeight: 'bold',
  },
  btnCancel: {
    flex: 1, backgroundColor: '#dc2626', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 100,
  },
  btnCancelText: {
    color: '#fff', fontWeight: 'bold', fontSize: 13,
  },
});
