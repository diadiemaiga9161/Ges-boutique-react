import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { getVentes } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const MOBILE_MONEY_MODES = ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'MTN_MONEY'];

export default function MobileMoneyScreen() {
  const { lang } = useLang();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await getVentes();
      const all = res.data?.data || res.data || [];
      const data = all.filter((v: any) => MOBILE_MONEY_MODES.includes(v.modePaiement));
      setTransactions(data);
      setFromCache(false);
      sauvegarderCache('mobile_money', data).catch(() => {});
    } catch {
      const cached = await lireCache<any>('mobile_money');
      if (cached.length > 0) { setTransactions(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
    if (event?.target?.complete) event.target.complete();
  };

  useEffect(() => { charger(); }, []);

  const total = transactions.reduce((s: number, t: any) => s + (t.montantTotal || 0), 0);

  const couleurMode = (mode: string) => {
    if (mode === 'ORANGE_MONEY') return '#ff6600';
    if (mode === 'WAVE') return '#0066ff';
    if (mode === 'MOOV_MONEY') return '#00aaff';
    return '#388e3c';
  };

  const filtered = transactions.filter(t =>
    !search ||
    [t.clientNom, t.modePaiement]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Hero banner */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{transactions.length}</Text>
          <Text style={styles.heroLbl}>Transactions</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{total.toLocaleString('fr-FR')} F</Text>
          <Text style={styles.heroLbl}>Montant total</Text>
        </View>
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <Searchbar
        placeholder={tr('rechercher', lang)}
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
        inputStyle={{ fontSize: 13 }}
      />

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, paddingTop: 8 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: '#1a56db22' }]}>
                <MaterialCommunityIcons name="cellphone-nfc" size={22} color="#1a56db" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.clientNom || 'Client anonyme'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <Chip compact style={{ backgroundColor: couleurMode(item.modePaiement) }}>
                    <Text style={{ color: '#fff', fontSize: 10 }}>
                      {item.modePaiement?.replace(/_/g, ' ')}
                    </Text>
                  </Chip>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardAmt}>
                  {item.montantTotal?.toLocaleString('fr-FR')} F
                </Text>
                <Text style={styles.cardDate}>
                  {item.dateVente ? new Date(item.dateVente).toLocaleDateString('fr-FR') : ''}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="cellphone-off" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Aucune transaction</Text>
            <Text style={styles.emptySub}>Les paiements Mobile Money apparaîtront ici</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  searchbar: { marginHorizontal: 12, marginVertical: 8, borderRadius: 10, elevation: 1 },

  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },
  cardDate: { color: '#94a3b8', fontSize: 11, marginTop: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },
});
