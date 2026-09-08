import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getNotifications, marquerLue, marquerToutesLues } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

// Redirection après clic sur une notification — parité avec notifications.page.ts
// (cliquer() navigue vers n.lien). Le backend n'émet que ces 3 routes Angular
// (NotificationPersistanceService/TransfertService/CommandeServiceImpl), donc
// une simple table de correspondance suffit ; toute autre valeur est ignorée.
function naviguerVersLien(navigation: any, lien?: string) {
  if (!lien) return;
  if (lien.includes('/pages/produit')) {
    navigation.navigate('MainTabs', { screen: 'Produits' });
  } else if (lien.includes('/pages/commandes')) {
    navigation.navigate('Commandes');
  } else if (lien.includes('/pages/transferts')) {
    navigation.navigate('Transferts');
  }
}

export default function NotificationsScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const navigation = useNavigation<any>();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const charger = async (event?: any) => {
    setLoading(true);
    try {
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

  // BUG FIX (parité Ionic) : le champ booléen renvoyé par le backend est "lu"
  // (entité Notification.java), pas "lue" — utilisé partout dans cet écran.
  const lire = async (id: number) => {
    try {
      await marquerLue(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n));
    } catch { }
  };

  // Parité avec notifications.page.ts (cliquer()) : marque lue puis navigue
  // vers n.lien si présent, même si la notification était déjà lue.
  const cliquer = (item: any) => {
    if (!item.lu) lire(item.id);
    naviguerVersLien(navigation, item.lien);
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
    if (type === 'TRANSFERT_RECU') return colors.primary;
    return '#f59e0b';
  };

  const total = notifs.length;
  const nonLues = notifs.filter(n => !n.lu).length;

  const lireTout = async () => {
    try {
      await marquerToutesLues();
      setNotifs(prev => prev.map(n => ({ ...n, lu: true })));
    } catch { }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero banner */}
      <View style={[styles.hero, { backgroundColor: colors.hero }]}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{total}</Text>
          <Text style={styles.heroLbl}>Total</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{nonLues}</Text>
          <Text style={styles.heroLbl}>Non lues</Text>
        </View>
      </View>

      {fromCache && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.warningBg }]}>
          <MaterialCommunityIcons name="cloud-off-outline" size={14} color={colors.warning} />
          <Text style={[styles.offlineTxt, { color: colors.warning }]}>Hors ligne — dernières notifications enregistrées sur l'appareil</Text>
        </View>
      )}

      {nonLues > 0 && (
        <TouchableOpacity style={[styles.btnToutLire, { borderColor: colors.primary }]} onPress={lireTout}>
          <MaterialCommunityIcons name="check-all" size={15} color={colors.primary} />
          <Text style={[styles.btnToutLireText, { color: colors.primary }]}>Tout marquer comme lu</Text>
        </TouchableOpacity>
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
              style={[styles.card, !item.lu && { borderLeftWidth: 4, borderLeftColor: colors.primary }]}
              onPress={() => cliquer(item)}
            >
              <Card.Content style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: color + '22' }]}>
                  <MaterialCommunityIcons
                    name={icone(item.type, item.lu) as any}
                    size={22}
                    color={color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {/* BUG FIX (parité Ionic, notifications.page.html) : le titre
                      (n.titre) n'était pas affiché du tout, seul le message
                      l'était — on affiche maintenant titre + message + date,
                      comme la version Ionic (lic-name / lic-sub / date). */}
                  <Text
                    style={[styles.cardName, { color: item.lu ? colors.textSecondary : colors.text, fontWeight: item.lu ? 'normal' : '600' }]}
                    numberOfLines={1}
                  >
                    {item.titre || item.message}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.message}
                  </Text>
                  {/* BUG FIX (parité Ionic) : le backend renvoie "dateCreation"
                      (notifications.page.html : n.dateCreation), pas "createdAt". */}
                  {item.dateCreation && (
                    <Text style={[styles.cardSub, { color: colors.placeholder, fontSize: 11 }]}>
                      {new Date(item.dateCreation).toLocaleString('fr-FR')}
                    </Text>
                  )}
                </View>
                {!item.lu && <View style={styles.unreadDot} />}
              </Card.Content>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-off-outline" size={64} color={colors.border} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>{tr('aucune_notif', lang)}</Text>
            <Text style={[styles.emptySub, { color: colors.placeholder }]}>Vous n'avez aucune notification</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { alignItems: 'center', justifyContent: 'center' },

  hero: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { fontSize: 12, flex: 1 },

  btnToutLire: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 12, marginTop: 10, paddingVertical: 9, borderRadius: 10, borderWidth: 1 },
  btnToutLireText: { fontWeight: '700', fontSize: 12 },

  card: { marginHorizontal: 12, marginBottom: 8, borderRadius: 16, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 14 },
  cardSub: { fontSize: 12, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 4 },
});
