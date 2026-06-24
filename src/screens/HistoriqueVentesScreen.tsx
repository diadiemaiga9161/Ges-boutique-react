import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, Chip, Searchbar, ActivityIndicator } from 'react-native-paper';
import { getVentes } from '../services/api.service';

export default function HistoriqueVentesScreen() {
  const [ventes, setVentes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const charger = async () => {
    try {
      const res = await getVentes();
      const data = res.data?.data || res.data || [];
      setVentes(data);
      setFiltered(data);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(ventes); return; }
    const q = search.toLowerCase();
    setFiltered(ventes.filter((v: any) => v.clientNom?.toLowerCase().includes(q)));
  }, [search, ventes]);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Rechercher client..." value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={v => String(v.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.clientNom || 'Client anonyme'}</Text>
                <Text style={styles.montant}>{item.montantTotal?.toFixed(0)} FCFA</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.date}>{new Date(item.dateVente).toLocaleString('fr-FR')}</Text>
                <Chip compact>{item.modePaiement?.replace('_', ' ')}</Chip>
              </View>
              {item.estCredit && <Chip compact icon="alert" style={{ marginTop: 4, alignSelf: 'flex-start' }}>Crédit</Chip>}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune vente</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  search: { margin: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  montant: { fontWeight: 'bold', color: '#1a56db', fontSize: 16 },
  date: { color: '#888', fontSize: 12 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
