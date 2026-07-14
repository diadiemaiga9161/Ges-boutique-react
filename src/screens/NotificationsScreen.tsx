import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { getNotifications, marquerLue } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function NotificationsScreen() {
  const { lang } = useLang();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const charger = async (event?: any) => {
    setLoading(true);
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await getNotifications();
      const data = res.data?.data || res.data || [];
      setNotifs(data);
      setFromCache(false);
      sauvegarderCache('notifications', data).catch(() => {});
    } catch {
      const cached = await lireCache<any>('notifications');
      if (cached.length > 0) { setNotifs(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
    if (event?.target?.complete) event.target.complete();
  };

  useEffect(() => { charger(); }, []);

  const lire = async (id: number) => {
    try {
      await marquerLue(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    } catch { }
  };

  const icone = (type: string, lue: boolean): string => {
    if (type === 'RUPTURE_STOCK') return 'alert';
    if (type === 'STOCK_FAIBLE') return 'alert-circle';
    if (type === 'TRANSFERT_RECU') return 'bank-transfer';
    return lue ? 'bell-outline' : 'bell-ring';
  };

  const couleur = (type: string) => {
    if (type === 'RUPTURE_STOCK') return '#ef4444';
    if (type === 'STOCK_FAIBLE') return '#f59e0b';
    if (type === 'TRANSFERT_RECU') return '#1a56db';
    return '#f59e0b';
  };

  const total = notifs.length;
  const nonLues = notifs.filter(n => !n.lue).length;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Hero banner */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{total}</Text>
          <Text style={styles.heroLbl}>Total</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{nonLues}</Text>
          <Text style={styles.heroLbl}>Non lues</Text>
        </View>
      </View>

      {/* Bandeau offline */}
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      <FlatList
        data={notifs}
        keyExtractor={n => String(n.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20, paddingTop: 8 }}
        renderItem={({ item }) => {
          const color = couleur(item.type);
          return (
            <Card
              style={[styles.card, !item.lue && styles.cardUnread]}
              onPress={() => !item.lue && lire(item.id)}
            >
              <Card.Content style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
                  <MaterialCommunityIcons
                    name={icone(item.type, item.lue) as any}
                    size={22}
                    color={color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.cardName, item.lue && styles.cardNameLue]}
                    numberOfLines={2}
                  >
                    {item.message}
                  </Text>
                  {item.createdAt && (
                    <Text style={styles.cardSub}>
                      {new Date(item.createdAt).toLocaleString('fr-FR')}
                    </Text>
                  )}
                </View>
                {!item.lue && <View style={styles.unreadDot} />}
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-off-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>{tr('aucune_notif', lang)}</Text>
            <Text style={styles.emptySub}>Vous n'avez aucune notification</Text>
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

  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardUnread: { borderLeftWidth: 4, borderLeftColor: '#1a56db' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardNameLue: { fontWeight: 'normal', color: '#64748b' },
  cardSub: { color: '#64748b', fontSize: 12, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },
});
