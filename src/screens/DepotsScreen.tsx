import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import api from '../services/api.service';

export default function DepotsScreen() {
  const [depots, setDepots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/depots');
      setDepots(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={depots}
        keyExtractor={d => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.nom || item.produitNom}</Text>
                <Text style={styles.montant}>{item.montant?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              <Text style={styles.sub}>{item.type === 'ENTREE' ? '+ Entrée' : '- Sortie'} — {item.quantite} unité(s)</Text>
              <Text style={styles.date}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : ''}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun dépôt enregistré</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#1a56db' },
  sub: { color: '#666', fontSize: 12, marginTop: 4 },
  date: { color: '#aaa', fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
