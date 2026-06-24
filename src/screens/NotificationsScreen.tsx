import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator, Icon } from 'react-native-paper';
import { getNotifications, marquerLue } from '../services/api.service';

export default function NotificationsScreen() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const charger = async () => {
    try {
      const res = await getNotifications();
      setNotifs(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const lire = async (id: number) => {
    try {
      await marquerLue(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    } catch { }
  };

  const icone = (type: string) => {
    if (type === 'RUPTURE_STOCK') return 'alert';
    if (type === 'STOCK_FAIBLE') return 'alert-circle';
    if (type === 'TRANSFERT_RECU') return 'swap-horizontal';
    return 'bell';
  };

  const couleur = (type: string) => {
    if (type === 'RUPTURE_STOCK') return '#f44336';
    if (type === 'STOCK_FAIBLE') return '#ff9800';
    return '#1a56db';
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={notifs}
        keyExtractor={n => String(n.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card
            style={[styles.card, !item.lue && styles.nonLue]}
            onPress={() => !item.lue && lire(item.id)}
          >
            <Card.Content style={styles.content}>
              <Icon source={icone(item.type)} size={28} color={couleur(item.type)} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text variant="bodyMedium" style={{ fontWeight: item.lue ? 'normal' : 'bold' }}>{item.message}</Text>
                {item.createdAt && (
                  <Text style={styles.date}>{new Date(item.createdAt).toLocaleString('fr-FR')}</Text>
                )}
              </View>
              {!item.lue && <View style={styles.dot} />}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune notification</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  card: { marginBottom: 10, borderRadius: 12 },
  nonLue: { borderLeftWidth: 4, borderLeftColor: '#1a56db' },
  content: { flexDirection: 'row', alignItems: 'center' },
  date: { color: '#aaa', fontSize: 11, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a56db' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
