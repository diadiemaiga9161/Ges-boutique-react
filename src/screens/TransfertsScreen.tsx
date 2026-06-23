import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Chip, ActivityIndicator } from 'react-native-paper';
import api from '../services/api.service';

export default function TransfertsScreen() {
  const [transferts, setTransferts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/transferts');
      setTransferts(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const couleurStatut = (s: string) => {
    if (s === 'CONFIRME') return '#4caf50';
    if (s === 'EN_ATTENTE') return '#ff9800';
    return '#f44336';
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={transferts}
        keyExtractor={t => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.boutiqueSrcNom} → {item.boutiqueDestNom}</Text>
                <Chip compact style={{ backgroundColor: couleurStatut(item.statut) }}>
                  <Text style={{ color: '#fff', fontSize: 11 }}>{item.statut?.replace('_', ' ')}</Text>
                </Chip>
              </View>
              <Text style={styles.sub}>{item.produitNom} — {item.quantite} unité(s)</Text>
              <Text style={styles.date}>{item.dateTransfert ? new Date(item.dateTransfert).toLocaleDateString('fr-FR') : ''}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun transfert</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sub: { color: '#666', fontSize: 13 },
  date: { color: '#aaa', fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
