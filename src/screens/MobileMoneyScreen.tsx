import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getMobileMoneyOperations, getMobileMoneyResume } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

type Type = 'TOUS' | 'ORANGE_MONEY' | 'MOOV_MONEY';
type Periode = 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';

const money = (v: number) => `${(v || 0).toLocaleString('fr-FR')} FCFA`;

export default function MobileMoneyScreen() {
  const { lang } = useLang();
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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1a56db" />;

  return (
    <View style={styles.container}>
      {/* Hero — totaux de la période/type sélectionnés */}
      <View style={styles.hero}>
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
        <View style={styles.resumeRow}>
          {(['jour', 'semaine', 'mois', 'annee'] as const).map(p => (
            <View key={p} style={styles.resumeCol}>
              <Text style={styles.resumeLbl}>{p === 'jour' ? "Aujourd'hui" : p === 'semaine' ? 'Semaine' : p === 'mois' ? 'Mois' : 'Année'}</Text>
              <Text style={styles.resumeVal} numberOfLines={1}>{money(resume[p]?.total || 0)}</Text>
            </View>
          ))}
        </View>
      )}

      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={styles.offlineTxt}>Mode hors ligne — données locales</Text>
        </View>
      )}

      {/* Filtre type */}
      <View style={styles.filterRow}>
        {(['TOUS', 'ORANGE_MONEY', 'MOOV_MONEY'] as Type[]).map(t => (
          <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipActive]} onPress={() => changerType(t)}>
            <Text style={[styles.chipTxt, type === t && styles.chipTxtActive]}>{t === 'TOUS' ? 'Tous' : t === 'ORANGE_MONEY' ? 'Orange' : 'Moov'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Filtre période */}
      <View style={styles.filterRow}>
        {(['JOUR', 'SEMAINE', 'MOIS', 'ANNEE'] as Periode[]).map(p => (
          <TouchableOpacity key={p} style={[styles.chip, periode === p && styles.chipActive]} onPress={() => changerPeriode(p)}>
            <Text style={[styles.chipTxt, periode === p && styles.chipTxtActive]}>{p === 'JOUR' ? 'Jour' : p === 'SEMAINE' ? 'Semaine' : p === 'MOIS' ? 'Mois' : 'Année'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Searchbar
        style={styles.searchBar}
        inputStyle={{ fontSize: 13 }}
        placeholder="Client ou n° vente..."
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="cellphone-nfc" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Aucune opération</Text>
            <Text style={styles.emptySub}>Aucune transaction mobile money pour cette période</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: couleurMode(item.modePaiement) + '22' }]}>
                <MaterialCommunityIcons name="cellphone" size={22} color={couleurMode(item.modePaiement)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>{item.clientNom || 'Client divers'}</Text>
                <Text style={styles.cardSub}>
                  {item.numeroVente} · {item.dateVente ? new Date(item.dateVente).toLocaleDateString('fr-FR') : ''}
                  {item.referencePaiement ? ` · Réf: ${item.referencePaiement}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardAmt}>{money(item.montantTotal)}</Text>
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
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  hero: { backgroundColor: '#081648', flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  resumeRow: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10, borderRadius: 10, paddingVertical: 10, elevation: 1 },
  resumeCol: { flex: 1, alignItems: 'center' },
  resumeLbl: { fontSize: 10, color: '#94a3b8' },
  resumeVal: { fontSize: 12, fontWeight: '700', color: '#1a56db', marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  filterRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingTop: 10 },
  chip: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  chipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  chipTxt: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  chipTxtActive: { color: '#fff' },

  searchBar: { marginHorizontal: 12, marginTop: 8, marginBottom: 4, borderRadius: 10, backgroundColor: '#fff', elevation: 1 },

  card: { marginBottom: 8, borderRadius: 12, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  cardSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  cardAmt: { fontWeight: '700', color: '#081648', fontSize: 13 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  badgeTxt: { fontSize: 10, fontWeight: '700', color: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', textAlign: 'center', marginTop: 4 },
});
