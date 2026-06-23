import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import { getVentes } from '../services/api.service';

const MOBILE_MONEY_MODES = ['ORANGE_MONEY', 'MOOV_MONEY', 'WAVE', 'MTN_MONEY'];

export default function MobileMoneyScreen() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const charger = async () => {
    try {
      const res = await getVentes();
      const all = res.data?.data || res.data || [];
      setTransactions(all.filter((v: any) => MOBILE_MONEY_MODES.includes(v.modePaiement)));
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const total = transactions.reduce((s: number, t: any) => s + (t.montantTotal || 0), 0);

  const couleurMode = (mode: string) => {
    if (mode === 'ORANGE_MONEY') return '#ff6600';
    if (mode === 'WAVE') return '#0066ff';
    if (mode === 'MOOV_MONEY') return '#00aaff';
    return '#388e3c';
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total Mobile Money</Text>
        <Text style={styles.totalVal}>{total.toLocaleString('fr-FR')} FCFA</Text>
        <Text style={styles.totalSub}>{transactions.length} transaction(s)</Text>
      </View>
      <FlatList
        data={transactions}
        keyExtractor={t => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="bodyMedium">{item.clientNom || 'Client anonyme'}</Text>
                <Text style={styles.montant}>{item.montantTotal?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              <View style={styles.row}>
                <Chip compact style={{ backgroundColor: couleurMode(item.modePaiement) }}>
                  <Text style={{ color: '#fff', fontSize: 11 }}>{item.modePaiement?.replace('_', ' ')}</Text>
                </Chip>
                <Text style={styles.date}>{item.dateVente ? new Date(item.dateVente).toLocaleDateString('fr-FR') : ''}</Text>
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune transaction Mobile Money</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  totalBanner: { backgroundColor: '#1976D2', padding: 20, alignItems: 'center' },
  totalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  totalVal: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginVertical: 4 },
  totalSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  montant: { fontWeight: 'bold', color: '#1976D2' },
  date: { color: '#aaa', fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
