import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMobileMoneyOperations, getMobileMoneyResume } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

type Type = 'TOUS' | 'ORANGE_MONEY' | 'MOOV_MONEY';
type Periode = 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';

const money = (v: number) => `${(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`;

export default function MobileMoneyScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const [operations, setOperations] = useState<any[]>([]);
  const [totaux, setTotaux] = useState({ orange: 0, moov: 0, global: 0, nombre: 0 });
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<Type>('TOUS');
  const [periode, setPeriode] = useState<Periode>('JOUR');

  const charger = async (t: Type = type, p: Periode = periode) => {
    setLoading(true);
    try {
      const [resOps, resResume] = await Promise.all([
        getMobileMoneyOperations(t, p),
        getMobileMoneyResume().catch(() => ({ data: null })),
      ]);
      const d = resOps.data?.data || resOps.data;
      const ops = d?.operations || [];
      setOperations(ops);
      setTotaux({
        orange: d?.totalOrangeMoney || 0,
        moov: d?.totalMoovMoney || 0,
        global: d?.totalGlobal || 0,
        nombre: d?.nombreOperations || 0,
      });
      setResume(resResume.data?.data || resResume.data || null);
      setFromCache(false);
      sauvegarderCache('mobile_money', ops).catch(() => {});
    } catch {
      const cached = await lireCache<any>('mobile_money');
      if (cached.length > 0) { setOperations(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const changerType = (t: Type) => { setType(t); charger(t, periode); };
  const changerPeriode = (p: Periode) => { setPeriode(p); charger(type, p); };

  const couleurMode = (mode: string) => {
    if (mode === 'ORANGE_MONEY') return '#ff6600';
    if (mode === 'MOOV_MONEY') return '#00aaff';
    return '#388e3c';
  };

  const filtered = operations.filter(t =>
    !search ||
    [t.clientNom, t.numeroVente].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero — totaux de la période/type sélectionnés */}
      <View style={[styles.hero, { backgroundColor: colors.hero }]}>
        <View style={styles.heroStat}>
          <Text style={[styles.heroVal, { color: '#ff9955' }]} numberOfLines={1}>{money(totaux.orange)}</Text>
          <Text style={styles.heroLbl}>Orange Money</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={[styles.heroVal, { color: '#5ec8ff' }]} numberOfLines={1}>{money(totaux.moov)}</Text>
          <Text style={styles.heroLbl}>Moov Money</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{totaux.nombre}</Text>
          <Text style={styles.heroLbl}>Opérations</Text>
        </View>
      </View>

      {/* Résumé multi-période (jour/semaine/mois/année) */}
      {resume && (
        <View style={[styles.resumeRow, { backgroundColor: colors.card }]}>
          {(['jour', 'semaine', 'mois', 'annee'] as const).map(p => (
            <View key={p} style={styles.resumeCol}>
              <Text style={[styles.resumeLbl, { color: colors.textSecondary }]}>{p === 'jour' ? "Aujourd'hui" : p === 'semaine' ? 'Semaine' : p === 'mois' ? 'Mois' : 'Année'}</Text>
              <Text style={[styles.resumeVal, { color: colors.primary }]} numberOfLines={1}>{money(resume[p]?.total || 0)}</Text>
            </View>
          ))}
        </View>
      )}


      {/* Filtre type */}
      <View style={styles.filterRow}>
        {(['TOUS', 'ORANGE_MONEY', 'MOOV_MONEY'] as Type[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, { backgroundColor: type === t ? colors.primary : colors.surface, borderColor: type === t ? colors.primary : colors.border }]}
            onPress={() => changerType(t)}>
            <Text style={[styles.chipTxt, { color: type === t ? '#fff' : colors.textSecondary }]}>{t === 'TOUS' ? 'Tous' : t === 'ORANGE_MONEY' ? 'Orange' : 'Moov'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Filtre période */}
      <View style={styles.filterRow}>
        {(['JOUR', 'SEMAINE', 'MOIS', 'ANNEE'] as Periode[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, { backgroundColor: periode === p ? colors.primary : colors.surface, borderColor: periode === p ? colors.primary : colors.border }]}
            onPress={() => changerPeriode(p)}>
            <Text style={[styles.chipTxt, { color: periode === p ? '#fff' : colors.textSecondary }]}>{p === 'JOUR' ? 'Jour' : p === 'SEMAINE' ? 'Semaine' : p === 'MOIS' ? 'Mois' : 'Année'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Searchbar
        style={[styles.searchBar, { backgroundColor: colors.surface }]}
        inputStyle={{ fontSize: 13, color: colors.text }}
        placeholderTextColor={colors.placeholder}
        iconColor={colors.textSecondary}
        placeholder="Client ou n° vente..."
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} colors={[colors.primary]} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="cellphone-nfc" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune opération</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>Aucune transaction mobile money pour cette période</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={[styles.card, { backgroundColor: colors.card }]}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: couleurMode(item.modePaiement) + '22' }]}>
                <MaterialCommunityIcons name="cellphone" size={22} color={couleurMode(item.modePaiement)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.clientNom || 'Client divers'}</Text>
                <Text style={[styles.cardSub, { color: colors.textSecondary }]}>
                  {item.numeroVente} · {item.dateVente ? new Date(item.dateVente).toLocaleDateString('fr-FR') : ''}
                  {item.referencePaiement ? ` · Réf: ${item.referencePaiement}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.cardAmt, { color: colors.text }]}>{money(item.montantTotal)}</Text>
                <View style={[styles.badge, { backgroundColor: couleurMode(item.modePaiement) }]}>
                  <Text style={styles.badgeTxt}>{item.modePaiement === 'ORANGE_MONEY' ? 'Orange' : 'Moov'}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  resumeRow: { flexDirection: 'row', marginHorizontal: 12, marginTop: 10, borderRadius: 14, paddingVertical: 10, elevation: 1 },
  resumeCol: { flex: 1, alignItems: 'center' },
  resumeLbl: { fontSize: 10 },
  resumeVal: { fontSize: 12, fontWeight: '700', marginTop: 2 },

  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipTxt: { fontSize: 11, fontWeight: '600' },

  searchBar: { marginHorizontal: 12, marginTop: 8, marginBottom: 4, borderRadius: 10, elevation: 1 },

  card: { marginBottom: 8, borderRadius: 16, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14 },
  cardSub: { fontSize: 11, marginTop: 2 },
  cardAmt: { fontWeight: '700', fontSize: 13 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 13, textAlign: 'center', marginTop: 4 },
});
