import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking, RefreshControl } from 'react-native';
import { Text, Card, Button, SegmentedButtons, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getRapportJour, getRapportSemaine, getRapportMois } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function RapportsScreen() {
  const { lang } = useLang();
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [rapport, setRapport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [boutique, setBoutique] = useState<any>({});
  const [isVendeur, setIsVendeur] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (raw) setBoutique(JSON.parse(raw));
    });
    AsyncStorage.getItem('user').then(raw => {
      if (raw) {
        const u = JSON.parse(raw);
        const role = (u.role || '').toUpperCase().replace('ROLE_', '');
        setIsVendeur(role === 'VENDEUR');
      }
    });
    charger('jour');
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
      `💰 CA : ${money(rapport.chiffreAffaireTotal)}`,
      (!isVendeur && rapport.beneficeTotal != null) ? `📈 Bénéfice : ${money(rapport.beneficeTotal)}` : null,
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
                {!isVendeur && rapport.beneficeTotal != null && (
                  <View style={styles.heroStat}>
                    <Text style={styles.heroVal} numberOfLines={1}>
                      {money(rapport.beneficeTotal)}
                    </Text>
                    <Text style={styles.heroLbl}>Bénéfice</Text>
                  </View>
                )}
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
                    {!isVendeur && rapport.beneficeTotal != null && (
                      <View style={styles.row}>
                        <Text>{tr('benefice', lang)}</Text>
                        <Text style={styles.green}>{money(rapport.beneficeTotal)}</Text>
                      </View>
                    )}
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
