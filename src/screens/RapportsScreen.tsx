import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, RefreshControl } from 'react-native';
import { Text, Card, Button, SegmentedButtons, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRapportJour, getRapportSemaine, getRapportMois, getCA30Jours, getTopProduits, getVentesParHeure, getPrevisionStock } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useAuth } from '../hooks/useAuth';

export default function RapportsScreen() {
  const { lang } = useLang();
  const { user } = useAuth();
  const isVendeur = user?.role === 'VENDEUR';
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [rapport, setRapport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [boutique, setBoutique] = useState<any>({});
  const [ca30Jours, setCA30Jours] = useState<any[]>([]);
  const [topProduits, setTopProduits] = useState<any[]>([]);
  const [ventesParHeure, setVentesParHeure] = useState<any[]>([]);
  const [previsionStock, setPrevisionStock] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [maxCA, setMaxCA] = useState(1);
  const [maxQte, setMaxQte] = useState(1);
  const [maxVentes, setMaxVentes] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (raw) setBoutique(JSON.parse(raw));
    });
    charger('jour');
    chargerAnalytics();
  }, []);

  const charger = async (p: 'jour' | 'semaine' | 'mois') => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      let res;
      const today = new Date().toISOString().split('T')[0];
      if (p === 'jour') res = await getRapportJour(today);
      else if (p === 'semaine') res = await getRapportSemaine();
      else res = await getRapportMois();
      const data = res.data?.data || res.data;
      setRapport(data);
      setFromCache(false);
      AsyncStorage.setItem(`cache_rapport_${p}`, JSON.stringify(data)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem(`cache_rapport_${p}`);
        if (s) { setRapport(JSON.parse(s)); setFromCache(true); }
        else { setRapport(null); setFromCache(false); }
      } catch { setRapport(null); setFromCache(false); }
    }
    setLoading(false);
    setRefreshing(false);
  };

  const chargerAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) return;
      const [r1, r2, r3, r4] = await Promise.all([
        getCA30Jours().catch(() => ({ data: [] })),
        getTopProduits().catch(() => ({ data: [] })),
        getVentesParHeure().catch(() => ({ data: [] })),
        getPrevisionStock().catch(() => ({ data: [] })),
      ]);
      const d1: any[] = r1.data?.data || r1.data || [];
      const d2: any[] = r2.data?.data || r2.data || [];
      const d3: any[] = r3.data?.data || r3.data || [];
      const d4: any[] = r4.data?.data || r4.data || [];
      setCA30Jours(d1);
      setMaxCA(Math.max(...d1.map((x: any) => x.ca || 0), 1));
      setTopProduits(d2);
      setMaxQte(Math.max(...d2.map((x: any) => x.quantiteVendue || 0), 1));
      setVentesParHeure(d3);
      setMaxVentes(Math.max(...d3.map((x: any) => x.nbVentes || 0), 1));
      setPrevisionStock(d4);
    } catch {}
    setLoadingAnalytics(false);
  };

  const switchPeriode = (p: 'jour' | 'semaine' | 'mois') => {
    setPeriode(p);
    charger(p);
  };

  const money = (v: number) => `${(v || 0).toLocaleString('fr-FR')} ${boutique.devise || 'FCFA'}`;

  const envoyerWhatsApp = () => {
    if (!rapport) return;
    const numeros = [boutique.telephone, boutique.telephone2, boutique.telephone3].filter(Boolean);
    if (!numeros.length) return;
    const msg = [
      `📊 *Rapport ${periode} — ${new Date().toLocaleDateString('fr-FR')}*`,
      `🏪 ${boutique.nom || ''}`,
      ``,
      !isVendeur ? `💰 CA : ${money(rapport.chiffreAffaireTotal)}` : null,
      // Bénéfice retiré de l'envoi WhatsApp (données financières internes)
      `🛒 Ventes : ${rapport.nombreVentes || 0}`,
    ].filter(Boolean).join('\n');

    numeros.forEach((num: string, i: number) => {
      setTimeout(() => {
        const clean = num.replace(/[\s()\-+]/g, '');
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
      }, i * 2500);
    });
  };

  const labelPeriode = periode === 'jour' ? 'jour' : periode === 'semaine' ? 'semaine' : 'mois';

  const pct = (val: number, max: number) => (max > 0 ? (val / max) * 100 : 0);

  return (
    <View style={styles.container}>

      {/* ── Sélecteur de période ─────────────────────────────────────────────── */}
      <SegmentedButtons
        value={periode}
        onValueChange={v => switchPeriode(v as any)}
        buttons={[
          { value: 'jour', label: tr('rapport_journalier', lang) },
          { value: 'semaine', label: tr('rapport_semaine', lang) },
          { value: 'mois', label: tr('rapport_mois', lang) },
        ]}
        style={styles.segments}
      />

      {/* ── Bandeau offline ─────────────────────────────────────────────────── */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 28 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); charger(periode); }}
              colors={['#1a56db']}
            />
          }
        >
          {rapport ? (
            <>
              {/* ── Hero banner ─────────────────────────────────────────────── */}
              <View style={styles.hero}>
                {!isVendeur && (
                  <View style={styles.heroStat}>
                    <Text style={styles.heroVal} numberOfLines={1}>
                      {money(rapport.chiffreAffaireTotal)}
                    </Text>
                    <Text style={styles.heroLbl}>CA {labelPeriode}</Text>
                  </View>
                )}
                <View style={styles.heroStat}>
                  <Text style={styles.heroVal}>{rapport.nombreVentes || 0}</Text>
                  <Text style={styles.heroLbl}>Ventes</Text>
                </View>
                {/* Bénéfice hero retiré pour tous — données financières internes */}
                {/* {rapport.beneficeTotal != null && (
                  <View style={styles.heroStat}>
                    <Text style={styles.heroVal} numberOfLines={1}>
                      {money(rapport.beneficeTotal)}
                    </Text>
                    <Text style={styles.heroLbl}>Bénéfice</Text>
                  </View>
                )} */}
              </View>

              <View style={{ padding: 16 }}>

                {/* ── Card CA + détails ──────────────────────────────────── */}
                <Card style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      {isVendeur ? tr('vente', lang) : tr('chiffre_affaires', lang)}
                    </Text>
                    {!isVendeur && (
                      <Text variant="headlineMedium" style={styles.bigNum}>
                        {money(rapport.chiffreAffaireTotal)}
                      </Text>
                    )}
                    <Divider style={{ marginVertical: 8 }} />
                    {/* Ligne bénéfice retirée pour tous — données financières internes */}
                    {/* {rapport.beneficeTotal != null && (
                      <View style={styles.row}>
                        <Text>{tr('benefice', lang)}</Text>
                        <Text style={styles.green}>{money(rapport.beneficeTotal)}</Text>
                      </View>
                    )} */}
                    <View style={styles.row}>
                      <Text>{tr('nb_ventes', lang)}</Text>
                      <Text style={styles.bold}>{rapport.nombreVentes || 0}</Text>
                    </View>
                    {!isVendeur && rapport.montantRemisesTotal > 0 && (
                      <View style={styles.row}>
                        <Text>Remises</Text>
                        <Text style={styles.orange}>{money(rapport.montantRemisesTotal)}</Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>

                {/* ── Top produits ────────────────────────────────────────── */}
                {rapport.topProduits?.length > 0 && (
                  <Card style={styles.card}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.cardTitle}>
                        Top {tr('produits', lang).toLowerCase()}
                      </Text>
                      {rapport.topProduits.slice(0, 5).map((p: any, i: number) => (
                        <View key={i} style={styles.row}>
                          <Text>{i + 1}. {p.nom}</Text>
                          <Text style={styles.bold}>{p.quantite} vendus</Text>
                        </View>
                      ))}
                    </Card.Content>
                  </Card>
                )}

                {/* ── Catégories ──────────────────────────────────────────── */}
                {rapport.categoriesStats?.length > 0 && (
                  <Card style={styles.card}>
                    <Card.Content>
                      <Text variant="titleMedium" style={styles.cardTitle}>
                        {tr('vente', lang)} / catégorie
                      </Text>
                      {rapport.categoriesStats.map((c: any, i: number) => (
                        <View key={i} style={styles.row}>
                          <Text>{c.nom}</Text>
                          <Text style={styles.bold}>{c.nombreProduits || 0} produits</Text>
                        </View>
                      ))}
                    </Card.Content>
                  </Card>
                )}

                {/* ── Bouton WhatsApp ─────────────────────────────────────── */}
                <Button
                  mode="contained"
                  icon="whatsapp"
                  onPress={envoyerWhatsApp}
                  style={[styles.btnWA, { backgroundColor: '#25D366' }]}
                >
                  Envoyer sur WhatsApp
                </Button>
              </View>
            </>
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chart-bar-stacked" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>{tr('aucun_resultat', lang)}</Text>
              <Text style={styles.emptySub}>Aucune donnée disponible pour cette période</Text>
            </View>
          )}

          {/* ===== ANALYSES VISUELLES ===== */}
          {loadingAnalytics ? (
            <ActivityIndicator style={{ margin: 24 }} size="small" color="#1a56db" />
          ) : ((!isVendeur && ca30Jours.length > 0) || topProduits.length > 0 || ventesParHeure.length > 0) ? (
            <Card style={{ margin: 12, marginTop: 8 }}>
              <Card.Title title="Analyses visuelles" titleStyle={{ fontSize: 14 }} />
              <Card.Content>

                {/* CA 30 jours — masqué pour les vendeurs */}
                {!isVendeur && ca30Jours.length > 0 && (
                  <>
                    <Text style={{ fontWeight: '600', fontSize: 12, marginBottom: 6 }}>CA des 30 derniers jours</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 70, gap: 1, marginBottom: 16 }}>
                      {ca30Jours.map((d, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <View style={{
                            width: '100%',
                            height: Math.max(2, pct(d.ca || 0, maxCA) * 0.7),
                            backgroundColor: '#4f46e5',
                            borderRadius: 2,
                          }} />
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {topProduits.length > 0 && (
                  <>
                    <Divider style={{ marginVertical: 8 }} />
                    {/* Top produits */}
                    <Text style={{ fontWeight: '600', fontSize: 12, marginBottom: 6 }}>Top 10 produits</Text>
                    {topProduits.map((p, i) => (
                      <View key={i} style={{ marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                          <Text style={{ fontSize: 11 }} numberOfLines={1}>{p.produitNom}</Text>
                          <Text style={{ fontSize: 11, color: '#6b7280' }}>{p.quantiteVendue}</Text>
                        </View>
                        <View style={{ backgroundColor: '#e5e7eb', borderRadius: 4, height: 6 }}>
                          <View style={{
                            width: `${pct(p.quantiteVendue || 0, maxQte)}%` as any,
                            backgroundColor: '#10b981', height: '100%', borderRadius: 4
                          }} />
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {ventesParHeure.length > 0 && (
                  <>
                    <Divider style={{ marginVertical: 8 }} />
                    {/* Ventes par heure */}
                    <Text style={{ fontWeight: '600', fontSize: 12, marginBottom: 6 }}>Ventes par heure</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 50, gap: 2 }}>
                      {ventesParHeure.map((h, i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <View style={{
                            width: '100%',
                            height: Math.max(2, pct(h.nbVentes || 0, maxVentes) * 0.5),
                            backgroundColor: '#f59e0b',
                            borderRadius: 2,
                          }} />
                          <Text style={{ fontSize: 8, color: '#6b7280' }}>{h.heure}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

              </Card.Content>
            </Card>
          ) : null}

          {/* Prévisions de stock */}
          {previsionStock.length > 0 && (
            <Card style={{ margin: 12, marginTop: 0 }}>
              <Card.Title title="Prévisions de stock" titleStyle={{ fontSize: 14 }} />
              <Card.Content style={{ padding: 0 }}>
                {previsionStock.slice(0, 15).map((p, i) => (
                  <View key={i} style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 12, paddingVertical: 8,
                    borderBottomWidth: i < Math.min(previsionStock.length, 15) - 1 ? 1 : 0,
                    borderBottomColor: '#f3f4f6'
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '500' }}>{p.produitNom}</Text>
                      <Text style={{ fontSize: 10, color: '#6b7280' }}>
                        Stock: {p.stockActuel} | Jours: {p.joursAvantRupture >= 999 ? '—' : p.joursAvantRupture} | Reco: {p.quantiteRecommandee}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: p.urgence === 'CRITIQUE' ? '#fee2e2' : p.urgence === 'ATTENTION' ? '#fef3c7' : '#dcfce7',
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12
                    }}>
                      <Text style={{
                        fontSize: 10, fontWeight: '600',
                        color: p.urgence === 'CRITIQUE' ? '#dc2626' : p.urgence === 'ATTENTION' ? '#d97706' : '#16a34a'
                      }}>
                        {p.urgence}
                      </Text>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  segments: { margin: 12 },

  // Hero
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  // Offline
  offlineBanner: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
    backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6,
  },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  // Cards
  card: { marginBottom: 12, borderRadius: 12, elevation: 1 },
  cardTitle: { fontWeight: 'bold', marginBottom: 8, color: '#1a56db' },
  bigNum: { fontWeight: 'bold', color: '#1a56db', textAlign: 'center', marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bold: { fontWeight: 'bold' },
  green: { color: '#16a34a', fontWeight: 'bold' },
  orange: { color: '#f59e0b', fontWeight: 'bold' },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },

  // WhatsApp
  btnWA: { marginTop: 8, borderRadius: 8 },
});
