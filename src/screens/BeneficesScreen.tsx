import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getRapportJour, getRapportSemaine, getRapportMois } from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function BeneficesScreen() {
  const { lang } = useLang();
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const charger = async (p: 'jour' | 'semaine' | 'mois') => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const today = new Date().toISOString().split('T')[0];
      const res = p === 'jour' ? await getRapportJour(today) : p === 'semaine' ? await getRapportSemaine() : await getRapportMois();
      const d = res.data?.data || res.data;
      setData(d);
      setFromCache(false);
      AsyncStorage.setItem('cache_benefices', JSON.stringify(d)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem('cache_benefices');
        if (s) { setData(JSON.parse(s)); setFromCache(true); }
      } catch {}
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger('jour'); }, []);

  const benefice = data?.beneficeTotal || 0;
  const ca = data?.chiffreAffaireTotal || 0;
  const charges = ca - benefice;
  const marge = ca > 0 ? ((benefice / ca) * 100).toFixed(1) : '0';

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={periode}
        onValueChange={v => { setPeriode(v as any); charger(v as any); }}
        buttons={[
          { value: 'jour', label: 'Jour' },
          { value: 'semaine', label: 'Semaine' },
          { value: 'mois', label: 'Mois' },
        ]}
        style={styles.segments}
      />
      {loading && !refreshing ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); charger(periode); }}
            />
          }
        >
          {/* Hero banner */}
          <View style={styles.hero}>
            <View style={styles.heroStat}>
              <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit>
                {ca.toLocaleString('fr-FR')}
              </Text>
              <Text style={styles.heroLbl}>CA Total (FCFA)</Text>
            </View>
            <View style={styles.heroSep} />
            <View style={styles.heroStat}>
              <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit>
                {charges.toLocaleString('fr-FR')}
              </Text>
              <Text style={styles.heroLbl}>Charges (FCFA)</Text>
            </View>
            <View style={styles.heroSep} />
            <View style={styles.heroStat}>
              <Text
                style={[styles.heroVal, { color: benefice >= 0 ? '#4ade80' : '#f87171' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {benefice.toLocaleString('fr-FR')}
              </Text>
              <Text style={styles.heroLbl}>Bénéfice net (FCFA)</Text>
            </View>
          </View>

          {/* Bandeau offline */}
          {fromCache && (
            <View style={styles.offlineBanner}>
              <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
              <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
            </View>
          )}

          {/* Card CA */}
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: '#1a56db22' }]}>
                <MaterialCommunityIcons name="cash-multiple" size={22} color="#1a56db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{tr('chiffre_affaires', lang)}</Text>
                <Text style={styles.cardSub}>Marge brute : {marge}%</Text>
              </View>
              <Text style={styles.cardAmt}>{ca.toLocaleString('fr-FR')} F</Text>
            </Card.Content>
          </Card>

          {/* Card charges */}
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: '#f4433622' }]}>
                <MaterialCommunityIcons name="cart-minus" size={22} color="#f44336" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>Coût des ventes</Text>
                <Text style={styles.cardSub}>Charges directes</Text>
              </View>
              <Text style={[styles.cardAmt, { color: '#f44336' }]}>{charges.toLocaleString('fr-FR')} F</Text>
            </Card.Content>
          </Card>

          {/* Card nombre de ventes */}
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: '#1a56db22' }]}>
                <MaterialCommunityIcons name="receipt" size={22} color="#1a56db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{tr('nb_ventes', lang)}</Text>
                <Text style={styles.cardSub}>Transactions enregistrées</Text>
              </View>
              <Text style={styles.cardAmt}>{data?.nombreVentes || 0}</Text>
            </Card.Content>
          </Card>

          {/* Card bénéfice net */}
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: benefice >= 0 ? '#16a34a22' : '#dc262622' }]}>
                <MaterialCommunityIcons
                  name={benefice >= 0 ? 'trending-up' : 'trending-down'}
                  size={22}
                  color={benefice >= 0 ? '#16a34a' : '#dc2626'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{tr('benefice_net', lang)}</Text>
                <Text style={styles.cardSub}>Résultat de la période</Text>
              </View>
              <Text style={[styles.cardAmt, { color: benefice >= 0 ? '#16a34a' : '#dc2626' }]}>
                {benefice.toLocaleString('fr-FR')} F
              </Text>
            </Card.Content>
          </Card>

          {/* Card remises — conditionnelle */}
          {data?.montantRemisesTotal > 0 && (
            <Card style={styles.card}>
              <Card.Content style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: '#ff980022' }]}>
                  <MaterialCommunityIcons name="tag-multiple" size={22} color="#ff9800" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Remises accordées</Text>
                  <Text style={styles.cardSub}>Total des remises</Text>
                </View>
                <Text style={[styles.cardAmt, { color: '#ff9800' }]}>
                  {data.montantRemisesTotal.toLocaleString('fr-FR')} F
                </Text>
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  segments: { margin: 12 },
  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2, textAlign: 'center' },
  heroSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },
  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 14 },
});
