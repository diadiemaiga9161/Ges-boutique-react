import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Text,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonCard } from '../components/SkeletonLoader';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getVentes, getProduits, getSituationCredits, getCreditsEnRetard } from '../services/api.service';
import { getNombreOperationsPending, getNombreOperationsBloquees, getOperationsBloquees } from '../services/offline.service';
import { formaterDate, totalVentes } from '../services/rapport.helpers';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';
import { GL, kpiTile, quickTile, sectionLabel, mobileCard } from '../theme/styles';

export default function HomeScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const navigation = useNavigation<any>();

  const [user, setUser] = useState<any>(null);
  const [boutique, setBoutique] = useState<any>({});
  const [pendingCount, setPendingCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ventes, setVentes] = useState<any[]>([]);
  const [alertesStock, setAlertesStock] = useState<any[]>([]);
  const [nbTransferts, setNbTransferts] = useState<number>(0);
  const [fromCache, setFromCache] = useState(false);
  const isVendeur = user?.role === 'VENDEUR' || user?.role === 'ROLE_VENDEUR';

  // ── Stats (comme obtenirStatistiquesGenerales() sur Ionic) — indépendantes
  //     de toute période, PAS de sélecteur jour/semaine/mois sur le home Ionic.
  const [caJour, setCAJour] = useState(0);
  const [nbVentesJour, setNbVentesJour] = useState(0);
  const [totalVentesCount, setTotalVentesCount] = useState(0);
  const [produitsStockFaible, setProduitsStockFaible] = useState(0);
  const [montantTotalCredits, setMontantTotalCredits] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => { if (raw) setUser(JSON.parse(raw)); });
    AsyncStorage.getItem('boutique_info').then(raw => { if (raw) setBoutique(JSON.parse(raw)); });
    getNombreOperationsPending().then(setPendingCount);
    getNombreOperationsBloquees().then(setBlockedCount);
    charger();
  }, []);

  const voirOperationsBloquees = useCallback(async () => {
    const ops = await getOperationsBloquees();
    if (ops.length === 0) return;
    const detail = ops.map(o => `• ${o.libelle} (${o.attempts} tentatives)`).join('\n');
    Alert.alert(
      'Opérations non synchronisées',
      `Ces actions n'ont pas pu être envoyées au serveur après plusieurs tentatives et restent uniquement enregistrées sur cet appareil :\n\n${detail}\n\nContactez le support si elles doivent être appliquées manuellement.`,
      [{ text: 'OK' }]
    );
  }, []);

  const charger = useCallback(async () => {
    setLoading(true);

    // Stats générales — même calcul que obtenirStatistiquesGenerales() sur
    // Ionic (rapport.service.ts) : PAS d'endpoint /rapports/jour|semaine|mois
    // (ils n'existent pas côté backend), tout est agrégé côté client.
    try {
      const today = formaterDate(new Date());
      const [resVentes, resProduits, resSituation, resRetard] = await Promise.all([
        getVentes(),
        getProduits(),
        getSituationCredits().catch(() => null),
        getCreditsEnRetard().catch(() => null),
      ]);
      const allVentes = resVentes.data?.data || resVentes.data || [];
      const produits = resProduits.data?.data || resProduits.data || [];
      const ventesJour = allVentes.filter((v: any) => (v.dateVente || '').startsWith(today));
      const situation = resSituation?.data?.situation || resSituation?.data?.data || resSituation?.data || null;

      setCAJour(totalVentes(ventesJour));
      setNbVentesJour(ventesJour.length);
      setTotalVentesCount(allVentes.length);
      setProduitsStockFaible(produits.filter((p: any) => Number(p.quantite || 0) <= Number(p.seuilAlerte || 0)).length);
      setMontantTotalCredits(situation?.montantTotalCredits ?? situation?.montantRestantTotal ?? 0);
      setFromCache(false);
      AsyncStorage.setItem('cache_home_stats', JSON.stringify({
        caJour: totalVentes(ventesJour), nbVentesJour: ventesJour.length, totalVentesCount: allVentes.length,
        produitsStockFaible: produits.filter((p: any) => Number(p.quantite || 0) <= Number(p.seuilAlerte || 0)).length,
        montantTotalCredits: situation?.montantTotalCredits ?? situation?.montantRestantTotal ?? 0,
      })).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem('cache_home_stats');
        if (s) {
          const c = JSON.parse(s);
          setCAJour(c.caJour || 0); setNbVentesJour(c.nbVentesJour || 0); setTotalVentesCount(c.totalVentesCount || 0);
          setProduitsStockFaible(c.produitsStockFaible || 0); setMontantTotalCredits(c.montantTotalCredits || 0);
          setFromCache(true);
        }
      } catch { /* pas de cache non plus — stats restent à 0 */ }
    }

    // Ventes récentes du jour (aperçu)
    try {
      const vRes = await api.get('/ventes/jour', { params: { limite: 5 } });
      const raw = vRes.data?.data || vRes.data;
      const v = Array.isArray(raw) ? raw.slice(0, 5) : [];
      setVentes(v);
      AsyncStorage.setItem('cache_home_ventes', JSON.stringify(v)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem('cache_home_ventes');
        if (s) setVentes(JSON.parse(s)); else setVentes([]);
      } catch { setVentes([]); }
    }

    // Alertes rupture IA (GET /ia/previsions) — comme chargerAlertesIA() sur Ionic
    try {
      const iaRes = await api.get('/ia/previsions');
      const rawIA = iaRes.data?.data || iaRes.data;
      const aIA = Array.isArray(rawIA)
        ? rawIA.filter((p: any) => p.alerteRupture === true || p.ruptureImminente === true)
        : [];
      setAlertesStock(aIA);
    } catch {
      setAlertesStock([]);
    }

    // Transferts en attente de confirmation — comme chargerTransfertsEnAttente()
    try {
      const tRes = await api.get('/transferts/recus');
      const rawT = tRes.data?.data || tRes.data;
      const enAttente = Array.isArray(rawT)
        ? rawT.filter((t: any) => t.statut === 'EN_ATTENTE_CONFIRMATION')
        : [];
      setNbTransferts(enAttente.length);
    } catch {
      setNbTransferts(0);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  const money = (v?: number) =>
    `${((v) || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} ${boutique.devise || 'FCFA'}`;

  const dateAujourdhui = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const nomAffiche = user
    ? user.nomComplet || user.username || 'Utilisateur'
    : 'Utilisateur';
  const roleAffiche = (user?.role || '').replace(/^ROLE_/, '') || 'Utilisateur';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: GL.bg }]}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); charger(); }}
        />
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroDeco1} />
        <View style={styles.heroDeco2} />

        <View style={styles.heroTop}>
          <View style={styles.heroAvatar}>
            <Ionicons name="storefront-outline" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroStore}>{boutique.nom || 'Boutique'}</Text>
            <Text style={styles.heroRole}>{roleAffiche}</Text>
          </View>
        </View>

        <View style={styles.heroGreeting}>
          <Text style={styles.heroName}>{nomAffiche}</Text>
          <Text style={styles.heroDate}>{dateAujourdhui}</Text>
        </View>

        {!isVendeur && (
          <View style={styles.heroCaBox}>
            <Text style={styles.heroCaLabel}>CA DU JOUR</Text>
            <Text style={styles.heroCaVal}>{money(caJour)}</Text>
            <View style={styles.heroCaSub}>
              <Ionicons name="receipt-outline" size={13} color="rgba(255,255,255,0.65)" />
              <Text style={styles.heroCaSubTxt}>{nbVentesJour} vente{nbVentesJour > 1 ? 's' : ''} aujourd'hui</Text>
            </View>
          </View>
        )}
      </View>

      {fromCache && (
        <View style={[styles.syncBanner, { backgroundColor: colors.warningBg }]}>
          <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
          <Text style={[styles.syncTxt, { color: colors.warning }]}>Hors ligne — chiffres de la dernière synchronisation</Text>
        </View>
      )}

      {pendingCount > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: colors.infoBg }]}>
          <Ionicons name="cloud-upload-outline" size={14} color={colors.info} />
          <Text style={[styles.syncTxt, { color: colors.info }]}>{pendingCount} opération{pendingCount > 1 ? 's' : ''} en attente de synchronisation</Text>
        </View>
      )}
      {blockedCount > 0 && (
        <TouchableOpacity style={styles.blockedBanner} onPress={voirOperationsBloquees}>
          <Ionicons name="alert-circle" size={14} color="#fff" />
          <Text style={styles.blockedTxt}>
            {blockedCount} opération{blockedCount > 1 ? 's' : ''} bloquée{blockedCount > 1 ? 's' : ''} — jamais synchronisée{blockedCount > 1 ? 's' : ''}, touchez pour voir
          </Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={{ padding: 16 }}>
          <SkeletonCard count={6} />
        </View>
      ) : (
        <View style={{ padding: 16, gap: 12 }}>

          <View style={styles.kpiRow}>
            <View style={[kpiTile.base, kpiTile.blue]}>
              <View style={[kpiTile.iconWrap, kpiTile.iconWrapBlue]}>
                <Ionicons name="trending-up-outline" size={16} color={GL.blue600} />
              </View>
              <Text style={kpiTile.label}>Ventes</Text>
              <Text style={kpiTile.value}>{totalVentesCount}</Text>
            </View>
            <View style={[kpiTile.base, kpiTile.orange]}>
              <View style={[kpiTile.iconWrap, kpiTile.iconWrapOrange]}>
                <Ionicons name="alert-circle-outline" size={16} color={GL.orange600} />
              </View>
              <Text style={kpiTile.label}>Stock faible</Text>
              <Text style={kpiTile.value}>{produitsStockFaible}</Text>
            </View>
            {!isVendeur && (
              <View style={[kpiTile.base, kpiTile.red]}>
                <View style={[kpiTile.iconWrap, kpiTile.iconWrapRed]}>
                  <Ionicons name="card-outline" size={16} color={GL.red600} />
                </View>
                <Text style={kpiTile.label}>Crédits</Text>
                <Text style={[kpiTile.value, { fontSize: 12 }]} numberOfLines={1}>{money(montantTotalCredits)}</Text>
              </View>
            )}
          </View>

          {nbTransferts > 0 && (
            <TouchableOpacity
              style={styles.transfertCard}
              onPress={() => navigation.navigate('Transferts')}
            >
              <Ionicons name="swap-horizontal-outline" size={22} color={GL.red600} />
              <Text style={styles.transfertCardLabel}>{nbTransferts} transfert(s) en attente de confirmation</Text>
              <View style={styles.transfertBadge}>
                <Text style={styles.transfertBadgeText}>{nbTransferts}</Text>
              </View>
            </TouchableOpacity>
          )}

          {alertesStock.length > 0 && (
            <View>
              <Text style={sectionLabel.text}>Alertes stock</Text>
              {alertesStock.slice(0, 3).map((a: any, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.alerteCard,
                    { borderLeftColor: a.ruptureImminente ? GL.red600 : GL.orange500 },
                    a.ruptureImminente ? styles.alerteCardRupture : styles.alerteCardWarn,
                  ]}
                >
                  <View style={styles.alerteHeader}>
                    <View style={[styles.alerteBadge, { backgroundColor: a.ruptureImminente ? GL.red600 : GL.orange500 }]}>
                      <Text style={styles.alerteBadgeText}>
                        {a.ruptureImminente ? 'Rupture imminente' : 'Stock bas'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.alerteNom}>{a.produitNom}</Text>
                  {a.joursAvantRupture >= 0 && (
                    <Text style={styles.alerteDetail}>
                      {a.joursAvantRupture === 0 ? 'En rupture actuellement' : `Rupture dans ${a.joursAvantRupture} jour(s)`}
                    </Text>
                  )}
                  <Text style={styles.alerteDetail}>
                    Stock : <Text style={{ fontWeight: '700' }}>{a.stockActuel}</Text>
                    {a.quantiteReappro > 0 && ` — Commander ${a.quantiteReappro} unités`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {ventes.length > 0 && (
            <View style={mobileCard.base}>
              <Text style={styles.cardTitle}>Ventes récentes</Text>
              {ventes.map((v: any, i: number) => (
                <View key={v.id || i}>
                  <View style={styles.venteRow}>
                    <View>
                      <Text style={styles.venteHeure}>
                        {v.date
                          ? new Date(v.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                          : v.heure || '—'}
                      </Text>
                      <View style={[styles.venteBadge, { backgroundColor: v.estCredit ? GL.orange50 : GL.green50 }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: v.estCredit ? GL.orange600 : GL.green600 }}>
                          {v.estCredit ? 'Crédit' : 'Comptant'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.venteMontant}>{money(v.montantTotal)}</Text>
                  </View>
                  {i < ventes.length - 1 && <View style={styles.venteDivider} />}
                </View>
              ))}
            </View>
          )}

          {/* ── Accès rapide — 10 raccourcis, identique à Ionic ── */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Accès rapide</Text>
          <View style={styles.quickGrid}>
            {[
              { title: 'Caisse', subtitle: 'Solde et opérations', icon: 'cash-multiple', onPress: () => navigation.navigate('MainTabs', { screen: 'Caisse' }) },
              { title: 'Ventes', subtitle: 'Historique', icon: 'receipt-text-outline', onPress: () => navigation.navigate('MainTabs', { screen: 'Ventes' }) },
              { title: 'Inventaire', subtitle: 'Entrées et sorties', icon: 'clipboard-list-outline', onPress: () => navigation.navigate('MainTabs', { screen: 'Inventaire' }) },
              { title: 'Produits', subtitle: 'Stock et prix', icon: 'cube-outline', onPress: () => navigation.navigate('MainTabs', { screen: 'Produits' }) },
              { title: 'Rapports', subtitle: 'Chiffres clés', icon: 'chart-bar', onPress: () => navigation.navigate('MainTabs', { screen: 'Rapports' }) },
              { title: 'Nouvelle vente', subtitle: 'Panier mobile', icon: 'cart-outline', onPress: () => navigation.navigate('Vente') },
              { title: 'Clients', subtitle: 'Fidélité et crédits', icon: 'account-group-outline', onPress: () => navigation.navigate('Clients') },
              { title: 'Commandes', subtitle: 'Bons de commande', icon: 'file-document-outline', onPress: () => navigation.navigate('Commandes') },
              { title: 'Boutique', subtitle: 'Paramètres', icon: 'storefront-outline', onPress: () => navigation.navigate('BoutiqueSettings') },
              { title: 'Mobile Money', subtitle: 'Orange & Moov', icon: 'cellphone', onPress: () => navigation.navigate('MobileMoney') },
            ].map(a => (
              <TouchableOpacity
                key={a.title}
                style={[styles.quickTile, { backgroundColor: colors.card }]}
                onPress={a.onPress}
              >
                <View style={[styles.quickTileIcon, { backgroundColor: colors.primary + '18' }]}>
                  <MaterialCommunityIcons name={a.icon as any} size={20} color={colors.primary} />
                </View>
                <Text style={[styles.quickTileTitle, { color: colors.text }]} numberOfLines={1}>{a.title}</Text>
                <Text style={[styles.quickTileSub, { color: colors.textSecondary }]} numberOfLines={1}>{a.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Sync banner
  syncBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#dbeafe', paddingHorizontal: 12, paddingVertical: 6 },
  syncTxt: { color: '#1e40af', fontSize: 12 },
  blockedBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6 },
  blockedTxt: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },

  // Hero
  hero: { backgroundColor: '#081648', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, position: 'relative', overflow: 'hidden' },
  heroDeco1: { position: 'absolute', width: 180, height: 180, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', top: -70, right: -50 },
  heroDeco2: { position: 'absolute', width: 110, height: 110, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)', top: 10, left: -40 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  heroAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroStore: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  heroRole: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
  heroGreeting: {},
  heroName: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  heroDate: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  heroCaBox: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 },
  heroCaLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  heroCaVal: { color: '#fff', fontWeight: 'bold', fontSize: 26, marginTop: 4 },
  heroCaSub: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  heroCaSubTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  // KPI 3 tuiles
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  kpiTile: { flex: 1, borderRadius: 14, padding: 12, elevation: 2 },
  kpiBlue: { backgroundColor: '#1a56db' },
  kpiOrange: { backgroundColor: '#f59e0b' },
  kpiRed: { backgroundColor: '#dc2626' },
  kpiLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600', marginTop: 6 },
  kpiVal: { color: '#fff', fontWeight: 'bold', fontSize: 15, marginTop: 2 },

  // Cards
  card: { marginBottom: 12, borderRadius: 12 },
  cardTitle: { fontWeight: 'bold', color: '#1a56db', marginBottom: 10 },

  // Ventes
  venteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  venteHeure: { fontSize: 13, color: '#444' },
  venteBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  venteMontant: { fontWeight: 'bold', fontSize: 15, color: '#333' },
  venteDivider: { height: 1, backgroundColor: '#eef2f7' },

  // Boutons rapides
  sectionTitle: { marginTop: 4, marginBottom: 10, fontWeight: 'bold', color: '#444', fontSize: 15 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickTile: { width: '47%', borderRadius: 14, padding: 14, elevation: 2 },
  quickTileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickTileTitle: { fontWeight: 'bold', fontSize: 13 },
  quickTileSub: { fontSize: 11, marginTop: 2 },

  // Alertes rupture IA
  alertesSection: { marginBottom: 12 },
  alerteCard: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  alerteCardWarn: {},
  alerteCardRupture: { backgroundColor: '#fee2e2', borderLeftColor: '#dc2626' },
  alerteHeader: { flexDirection: 'row', marginBottom: 4 },
  alerteBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  alerteBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  alerteNom: { fontWeight: '700', fontSize: 13, color: '#1e293b' },
  alerteDetail: { fontSize: 12, color: '#64748b', marginTop: 2 },

  // Transferts badge
  transfertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, gap: 10, borderLeftWidth: 4, borderLeftColor: '#dc2626', elevation: 2 },
  transfertCardLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1e293b' },
  transfertBadge: { backgroundColor: '#dc2626', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  transfertBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
