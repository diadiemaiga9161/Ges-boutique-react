import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, Alert,
  Modal, ScrollView, TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, Searchbar, ActivityIndicator, ProgressBar, FAB } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  getVentes, getVentesJour, getVentesParPeriode,
  getVenteDetail, annulerVente, getVentesAnnulees,
} from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const money = (v: number) => (v || 0).toLocaleString('fr-FR') + ' FCFA';

const toLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

// ─── Types ────────────────────────────────────────────────────────────────────
type TypeFilter = '' | 'COMPTANT' | 'CREDIT' | 'EN_RETARD';
type ActivePeriod = 'today' | 'week' | 'month' | 'all';
type ActiveTab = 'ventes' | 'annulees';

interface VenteAnnulee {
  id: number;
  numeroVente: string;
  dateVente: string;
  dateAnnulation: string;
  montantTotal: number;
  motifAnnulation: string;
  clientNom: string;
  vendeurNom: string;
  annuleurNom: string;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function HistoriqueVentesScreen() {
  const { lang } = useLang();
  const navigation = useNavigation<any>();

  // ─── Onglets ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('ventes');

  // ─── Onglet Ventes ─────────────────────────────────────────────────────────
  const [ventes, setVentes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [activePeriod, setActivePeriod] = useState<ActivePeriod>('today');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // ─── Onglet Annulées ───────────────────────────────────────────────────────
  const [ventesAnnulees, setVentesAnnulees] = useState<VenteAnnulee[]>([]);
  const [loadingAnnulees, setLoadingAnnulees] = useState(true);
  const [refreshingAnnulees, setRefreshingAnnulees] = useState(false);

  // Modal détail (onglet Ventes)
  const [showModal, setShowModal] = useState(false);
  const [selectedVente, setSelectedVente] = useState<any | null>(null);
  const [venteDetail, setVenteDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);

  // ─── Récupération boutiqueId ───────────────────────────────────────────────
  const getBoutiqueId = async (): Promise<number | null> => {
    try {
      const raw = await AsyncStorage.getItem('boutique_info');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return Number(parsed.id);
      }
    } catch { }
    return null;
  };

  // ─── Chargement ventes ─────────────────────────────────────────────────────
  const charger = useCallback(async (period: ActivePeriod = activePeriod) => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');

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
      setFromCache(false);
      sauvegarderCache('historique_ventes', data).catch(() => {});
    } catch {
      const cached = await lireCache<any>('historique_ventes');
      if (cached.length > 0) {
        setVentes(cached);
        applyFilter(cached, search, typeFilter);
        setFromCache(true);
      } else {
        setFromCache(false);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [activePeriod, search, typeFilter]);

  // ─── Chargement ventes annulées ────────────────────────────────────────────
  const chargerAnnulees = useCallback(async () => {
    const boutiqueId = await getBoutiqueId();
    if (boutiqueId === null) {
      setLoadingAnnulees(false);
      setRefreshingAnnulees(false);
      return;
    }
    try {
      const res = await getVentesAnnulees(boutiqueId);
      const data: VenteAnnulee[] = res.data?.data || res.data || [];
      setVentesAnnulees(data);
    } catch { }
    setLoadingAnnulees(false);
    setRefreshingAnnulees(false);
  }, []);

  useEffect(() => {
    charger();
    chargerAnnulees();
  }, []);

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
  const panierMoyen = nbVentes > 0 ? Math.round(caTotal / nbVentes) : 0;
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

    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : {};
      const role: string = user.role || '';
      setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
    } catch {
      setIsAdmin(false);
    }

    setLoadingDetail(true);
    try {
      const res = await getVenteDetail(vente.id);
      setVenteDetail(res.data?.data || res.data);
    } catch { }
    setLoadingDetail(false);
  };

  const handleAnnuler = (vente: any) => {
    Alert.alert(
      tr('annuler_vente', lang),
      `${vente.numeroVente || '#' + vente.id} ?`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('oui', lang) + ', ' + tr('annuler', lang).toLowerCase(), style: 'destructive',
          onPress: async () => {
            const net = await NetInfo.fetch();
            if (!net.isConnected) {
              Alert.alert('Connexion requise', 'Connexion internet requise pour annuler une vente.');
              return;
            }
            setAnnulationEnCours(true);
            try {
              await annulerVente(vente.id);
              setShowModal(false);
              setLoading(true);
              charger(activePeriod);
              chargerAnnulees();
            } catch (e: any) {
              Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('erreur', lang));
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
      Alert.alert(tr('erreur', lang), tr('erreur', lang));
    }
  };

  // ─── Rendu si chargement initial (onglet actif) ────────────────────────────
  if (activeTab === 'ventes' && loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;
  }

  // ─── Rendu principal ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* ── Barre d'onglets ── */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ventes' && styles.tabBtnActive]}
          onPress={() => setActiveTab('ventes')}
        >
          <Text style={[styles.tabBtnText, activeTab === 'ventes' && styles.tabBtnTextActive]}>
            Ventes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'annulees' && styles.tabBtnActive]}
          onPress={() => setActiveTab('annulees')}
        >
          <View style={styles.tabBtnInner}>
            <Text style={[styles.tabBtnText, activeTab === 'annulees' && styles.tabBtnTextActive]}>
              Annulées
            </Text>
            {ventesAnnulees.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{ventesAnnulees.length}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* ══════════════ ONGLET VENTES ══════════════ */}
      {activeTab === 'ventes' && (
        <>
          {/* ── Hero banner ── */}
          <View style={styles.hero}>
            <View style={styles.heroStat}>
              <Text style={styles.heroVal}>{nbVentes}</Text>
              <Text style={styles.heroLbl}>Ventes</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroVal} numberOfLines={1}>{money(caTotal)}</Text>
              <Text style={styles.heroLbl}>CA total</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroVal} numberOfLines={1}>{money(panierMoyen)}</Text>
              <Text style={styles.heroLbl}>Panier moy.</Text>
            </View>
          </View>

          {/* ── Bandeau offline ── */}
          {fromCache && (
            <View style={styles.offlineBanner}>
              <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
              <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
            </View>
          )}

          {/* ── Filtres période ── */}
          <View style={styles.periodRow}>
            {([ ['today', tr('rapport_journalier', lang)], ['week', tr('rapport_semaine', lang)], ['month', tr('rapport_mois', lang)], ['all', tr('historique', lang)] ] as [ActivePeriod, string][]).map(([p, label]) => (
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

          {/* ── Chips type ── */}
          <View style={styles.chipRow}>
            {([ ['', 'Tous'], ['COMPTANT', 'Comptant'], ['CREDIT', tr('credits', lang)], ['EN_RETARD', tr('non_regle', lang)] ] as [TypeFilter, string][]).map(([t, label]) => (
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

          {/* ── Barre de recherche ── */}
          <Searchbar
            placeholder={tr('recherche_vente', lang)}
            value={search}
            onChangeText={onSearch}
            style={styles.search}
            inputStyle={{ fontSize: 14 }}
          />

          {/* ── Liste ventes ── */}
          <FlatList
            data={filtered}
            keyExtractor={(v: any) => String(v.id)}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); charger(activePeriod); }}
              />
            }
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="cart-off" size={64} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>{tr('aucune_vente', lang)}</Text>
                <Text style={styles.emptySub}>Aucune vente pour cette période</Text>
              </View>
            }
            renderItem={({ item }) => {
              const isAnnulee = item.annulee || item.statut === 'ANNULEE';
              const isCredit = item.estCredit;
              const montantVerse = item.montantVerse || 0;
              const montantTotal = item.montantTotal || 0;
              const progression = montantTotal > 0 ? montantVerse / montantTotal : 0;

              // Avatar
              const iconColor = isAnnulee ? '#dc2626' : '#16a34a';
              const avatarBg  = isAnnulee ? '#dc262222' : '#16a34a22';

              // Badge statut
              let badgeBg: string, badgeColor: string, statusLabel: string;
              if (isAnnulee) {
                badgeBg = '#fee2e2'; badgeColor = '#dc2626'; statusLabel = 'ANNULEE';
              } else if (item.statut === 'COMPLETEE') {
                badgeBg = '#dcfce7'; badgeColor = '#16a34a'; statusLabel = 'PAYEE';
              } else if (isCredit) {
                badgeBg = '#fef3c7'; badgeColor = '#d97706'; statusLabel = 'CREDIT';
              } else {
                badgeBg = '#eff6ff'; badgeColor = '#1a56db'; statusLabel = 'COMPTANT';
              }

              return (
                <Card
                  style={[styles.card, isAnnulee && styles.cardAnnulee]}
                  onPress={() => openModal(item)}
                >
                  <Card.Content style={styles.cardRow}>
                    <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                      <MaterialCommunityIcons
                        name={isAnnulee ? 'cart-remove' : 'cart-check'}
                        size={22}
                        color={iconColor}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>
                        {item.clientNom || tr('client_anonyme', lang)}
                      </Text>
                      <Text style={styles.cardSub}>
                        {new Date(item.dateVente).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                        {' · '}{(item.modePaiement || 'COMPTANT').replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.cardAmt}>{money(montantTotal)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.statusBadgeTxt, { color: badgeColor }]}>{statusLabel}</Text>
                      </View>
                    </View>
                  </Card.Content>

                  {/* Section crédit (barre de progression) */}
                  {isCredit && !isAnnulee && (
                    <Card.Content style={{ paddingTop: 0, paddingBottom: 8 }}>
                      <View style={styles.creditSection}>
                        <Text style={styles.creditInfo}>
                          {tr('verse', lang)} {money(montantVerse)} / {money(montantTotal)}
                        </Text>
                        <ProgressBar
                          progress={progression}
                          color="#1a56db"
                          style={styles.progressBar}
                        />
                      </View>
                    </Card.Content>
                  )}
                </Card>
              );
            }}
          />
        </>
      )}

      {/* ══════════════ ONGLET ANNULEES ══════════════ */}
      {activeTab === 'annulees' && (
        loadingAnnulees ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" color="#dc2626" />
        ) : (
          <FlatList
            data={ventesAnnulees}
            keyExtractor={(v: VenteAnnulee) => String(v.id)}
            refreshControl={
              <RefreshControl
                refreshing={refreshingAnnulees}
                onRefresh={() => {
                  setRefreshingAnnulees(true);
                  chargerAnnulees();
                }}
              />
            }
            contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="cart-off" size={64} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Aucune vente annulée</Text>
                <Text style={styles.emptySub}>Toutes les ventes sont actives</Text>
              </View>
            }
            renderItem={({ item }: { item: VenteAnnulee }) => (
              <Card style={styles.cardAnnuleeItem}>
                <Card.Content>
                  {/* Badge + numéro */}
                  <View style={styles.row}>
                    <View style={styles.badgeAnnuleeGrand}>
                      <Text style={styles.badgeAnnuleeGrandText}>ANNULEE</Text>
                    </View>
                    <Text style={styles.numeroVente} numberOfLines={1}>
                      {item.numeroVente || '#' + item.id}
                    </Text>
                  </View>

                  {/* Client + montant */}
                  <View style={[styles.row, { marginTop: 8 }]}>
                    <Text style={styles.clientNomAnn} numberOfLines={1}>
                      {item.clientNom || 'Client anonyme'}
                    </Text>
                    <Text style={styles.montantAnnulee}>{money(item.montantTotal)}</Text>
                  </View>

                  {/* Date vente */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Date vente</Text>
                    <Text style={styles.infoLineVal}>{formatDate(item.dateVente)}</Text>
                  </View>

                  {/* Vendu par */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Vendu par</Text>
                    <Text style={styles.infoLineVal}>{item.vendeurNom || '—'}</Text>
                  </View>

                  {/* Séparateur */}
                  <View style={styles.separateur} />

                  {/* Annulé par */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Annulé par</Text>
                    <Text style={styles.annuleurNom}>{item.annuleurNom || '—'}</Text>
                  </View>

                  {/* Date annulation */}
                  <View style={styles.infoLineRow}>
                    <Text style={styles.infoLineLabel}>Date annulation</Text>
                    <Text style={styles.infoLineVal}>{formatDate(item.dateAnnulation)}</Text>
                  </View>

                  {/* Motif (si présent) */}
                  {!!item.motifAnnulation && (
                    <View style={styles.motifBox}>
                      <Text style={styles.motifLabel}>Motif</Text>
                      <Text style={styles.motifText}>{item.motifAnnulation}</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}
          />
        )
      )}

      {/* ─── MODAL DETAIL (onglet Ventes) ─── */}
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
                  {selectedVente ? (selectedVente.numeroVente || tr('detail_vente', lang)) : tr('detail_vente', lang)}
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
                    <Text style={styles.sectionTitle}>{tr('informations', lang)}</Text>
                    {[
                      [tr('clients', lang), selectedVente.clientNom || tr('client_anonyme', lang)],
                      selectedVente.clientTelephone ? [tr('telephone', lang), selectedVente.clientTelephone] : null,
                      ['N°', selectedVente.numeroVente || '—'],
                    ].filter((r): r is [string, string] => r !== null).map(([label, val]) => (
                      <View key={label} style={styles.infoRow}>
                        <Text style={styles.infoLabel}>{label}</Text>
                        <Text style={styles.infoVal}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Produits */}
                  <Text style={styles.sectionTitle}>{tr('produits', lang)}</Text>
                  {loadingDetail ? (
                    <ActivityIndicator size="small" color="#1a56db" style={{ margin: 12 }} />
                  ) : venteDetail ? (
                    (() => {
                      const lignes: any[] = venteDetail.lignes || venteDetail.produits || [];
                      if (!lignes.length) return <Text style={styles.emptyText}>{tr('aucun_resultat', lang)}</Text>;
                      return lignes.map((l: any, i: number) => (
                        <View key={i} style={styles.ligneRow}>
                          <Text style={styles.ligneName} numberOfLines={2}>{l.produitNom}</Text>
                          <Text style={styles.ligneQty}>x{l.quantite}</Text>
                          <Text style={styles.lignePrice}>{money(l.sousTotal)}</Text>
                        </View>
                      ));
                    })()
                  ) : (
                    <Text style={styles.emptyText}>{tr('erreur', lang)}</Text>
                  )}

                  {/* Paiement */}
                  <View style={[styles.infoCard, { marginTop: 14 }]}>
                    <Text style={styles.sectionTitle}>{tr('paiement', lang)}</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{tr('mode', lang)}</Text>
                      <Text style={styles.infoVal}>
                        {(selectedVente.modePaiement || 'COMPTANT').replace('_', ' ')}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{tr('total', lang)}</Text>
                      <Text style={[styles.infoVal, { fontWeight: 'bold', color: '#1a56db' }]}>
                        {money(selectedVente.montantTotal)}
                      </Text>
                    </View>
                    {selectedVente.estCredit && (
                      <>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>{tr('verse', lang)}</Text>
                          <Text style={[styles.infoVal, { color: '#16a34a' }]}>
                            {money(selectedVente.montantVerse || 0)}
                          </Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoLabel}>{tr('reste_du', lang)}</Text>
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
                <Text style={styles.btnCloseText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>

              {selectedVente && !(selectedVente.annulee || selectedVente.statut === 'ANNULEE') && (
                <TouchableOpacity
                  style={styles.btnPrint}
                  onPress={() => handleImprimer(selectedVente, venteDetail)}
                >
                  <Text style={styles.btnPrintText}>{tr('imprimer', lang)}</Text>
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
                    : <Text style={styles.btnCancelText}>{tr('annuler_vente', lang)}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── FAB Nouvelle vente (comme Ionic sales page) ─── */}
      <FAB
        icon="cart-plus"
        style={styles.fab}
        onPress={() => navigation.navigate('Vente')}
        label="Nouvelle vente"
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // FAB
  fab: { position: 'absolute', right: 16, bottom: 20, backgroundColor: '#1a56db' },

  // Onglets
  tabRow: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#1a56db' },
  tabBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: '#888' },
  tabBtnTextActive: { color: '#1a56db' },
  tabBadge: { backgroundColor: '#dc2626', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

  // Hero
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  // Offline
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  // Période
  periodRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  periodBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  periodBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },

  // Chips type
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, marginBottom: 2 },
  filterChip: { backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  filterChipActive: { backgroundColor: '#1a56db' },
  filterChipText: { fontSize: 12, color: '#555' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  // Searchbar
  search: { marginHorizontal: 12, marginTop: 6, marginBottom: 4, borderRadius: 12, elevation: 0, backgroundColor: '#fff' },

  // Card design system (onglet Ventes)
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardAnnulee: { opacity: 0.6, borderLeftWidth: 3, borderLeftColor: '#dc2626' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },

  // Badge statut
  statusBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  statusBadgeTxt: { fontSize: 10, fontWeight: 'bold' },

  // Section crédit
  creditSection: { marginTop: 4 },
  creditInfo: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  progressBar: { height: 5, borderRadius: 3, backgroundColor: '#e5e7eb' },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#aaa', fontSize: 13, padding: 12 },

  // Card annulée (onglet Annulées)
  cardAnnuleeItem: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#dc2626' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  badgeAnnuleeGrand: { backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeAnnuleeGrandText: { color: '#fff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  numeroVente: { flex: 1, textAlign: 'right', color: '#555', fontSize: 13, fontWeight: '600' },
  clientNomAnn: { flex: 1, fontWeight: 'bold', color: '#1a1a1a', marginRight: 8 },
  montantAnnulee: { fontWeight: 'bold', color: '#dc2626', fontSize: 16 },
  infoLineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLineLabel: { color: '#888', fontSize: 12, flex: 1 },
  infoLineVal: { color: '#333', fontSize: 12, fontWeight: '500', flex: 2, textAlign: 'right' },
  separateur: { height: 1, backgroundColor: '#fee2e2', marginVertical: 8 },
  annuleurNom: { color: '#dc2626', fontSize: 12, fontWeight: 'bold', flex: 2, textAlign: 'right' },
  motifBox: { backgroundColor: '#fff7f7', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  motifLabel: { color: '#dc2626', fontSize: 11, fontWeight: 'bold', marginBottom: 3, textTransform: 'uppercase' },
  motifText: { color: '#555', fontSize: 13, fontStyle: 'italic' },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 17, color: '#1a1a1a' },
  modalSub: { fontSize: 12, color: '#888', marginTop: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#666', fontSize: 14, fontWeight: 'bold' },
  modalBody: { padding: 16, maxHeight: 440 },

  // Info card (modal)
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 10 },
  sectionTitle: { fontWeight: 'bold', color: '#1a56db', fontSize: 13, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Lignes produits (modal)
  ligneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  ligneName: { flex: 1, color: '#333', fontSize: 13 },
  ligneQty: { color: '#888', fontSize: 12, marginHorizontal: 10 },
  lignePrice: { color: '#1a56db', fontWeight: '600', fontSize: 13 },

  // Footer modal
  modalFoot: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0', flexWrap: 'wrap' },
  btnClose: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 80 },
  btnCloseText: { color: '#666', fontWeight: '600' },
  btnPrint: { flex: 1, backgroundColor: '#1a56db', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 80 },
  btnPrintText: { color: '#fff', fontWeight: 'bold' },
  btnCancel: { flex: 1, backgroundColor: '#dc2626', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, minWidth: 100 },
  btnCancelText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
});
