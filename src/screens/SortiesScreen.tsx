import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSorties } from '../services/api.service';
import { sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { useColors } from '../theme/colors';

type Periode = 'today' | 'week' | 'month' | 'year' | 'all';
type TypeSortie = 'DETAIL' | 'CONSOMMATION' | 'UTILISATION' | 'PERTE' | 'AUTRE';

interface SortieStock {
  id: number;
  produit?: { id: number; nom: string };
  produitNom?: string;
  quantite: number;
  typeSortie: TypeSortie;
  motif?: string;
  dateMouvement: string;
}

const TYPES_SORTIE: { value: string; label: string; icon: string; color: string }[] = [
  { value: '', label: 'Tous', icon: 'format-list-bulleted', color: '#1a56db' },
  { value: 'DETAIL', label: 'Détail/Vente', icon: 'cart-outline', color: '#7c3aed' },
  { value: 'CONSOMMATION', label: 'Consommation', icon: 'food-apple', color: '#f59e0b' },
  { value: 'UTILISATION', label: 'Utilisation', icon: 'wrench', color: '#0891b2' },
  { value: 'PERTE', label: 'Perte', icon: 'alert-circle', color: '#dc2626' },
  { value: 'AUTRE', label: 'Autre', icon: 'dots-horizontal', color: '#64748b' },
];

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'all', label: 'Tout' },
];

function getPeriodeDates(p: Periode): { dateDebut?: string; dateFin?: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  if (p === 'today') return { dateDebut: fmt(now), dateFin: fmt(now) };
  if (p === 'week') {
    const debut = new Date(now);
    debut.setDate(now.getDate() - 6);
    return { dateDebut: fmt(debut), dateFin: fmt(now) };
  }
  if (p === 'month') {
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateDebut: fmt(debut), dateFin: fmt(now) };
  }
  if (p === 'year') {
    const debut = new Date(now.getFullYear(), 0, 1);
    return { dateDebut: fmt(debut), dateFin: fmt(now) };
  }
  return {}; // 'all'
}

function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function SortiesScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const styles = createStyles(colors);
  const [sorties, setSorties] = useState<SortieStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Periode>('all');
  const [selectedType, setSelectedType] = useState('');

  const charger = useCallback(async (periode: Periode = selectedPeriod) => {
    setLoading(true);
    try {
      const params = getPeriodeDates(periode);
      const res: any = await getSorties(params);
      const data: SortieStock[] = res.data?.data || res.data || [];
      setSorties(data);
      setFromCache(false);
      sauvegarderCache('sorties_stock', data).catch(() => {});
    } catch {
      const cached = await lireCache<SortieStock>('sorties_stock');
      if (cached.length > 0) { setSorties(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [selectedPeriod]);

  useFocusEffect(useCallback(() => { charger(selectedPeriod); }, []));

  const onChangePeriode = (p: Periode) => {
    setSelectedPeriod(p);
    charger(p);
  };

  const onRefresh = () => { setRefreshing(true); charger(selectedPeriod); };

  const countByType = (type: string) =>
    type === '' ? sorties.length : sorties.filter(s => s.typeSortie === type).length;

  const sortiesFiltrees = selectedType
    ? sorties.filter(s => s.typeSortie === selectedType)
    : sorties;

  const getTypeInfo = (type: string) =>
    TYPES_SORTIE.find(t => t.value === type) || TYPES_SORTIE[TYPES_SORTIE.length - 1];

  return (
    <View style={styles.container}>
      {/* ── Hero banner ── */}
      <View style={styles.hero}>
        <View style={styles.heroStat}>
          <Text style={styles.heroVal}>{sorties.length}</Text>
          <Text style={styles.heroLbl}>Total sorties</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={[styles.heroVal, { color: '#dc2626' }]}>{countByType('PERTE')}</Text>
          <Text style={styles.heroLbl}>Pertes</Text>
        </View>
        <View style={styles.heroStat}>
          <Text style={[styles.heroVal, { color: '#7c3aed' }]}>{countByType('DETAIL')}</Text>
          <Text style={styles.heroLbl}>Détail/Vente</Text>
        </View>
      </View>


      {/* ── Filtre période ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
        <View style={styles.chipsRow}>
          {PERIODES.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[styles.chip, selectedPeriod === p.value && styles.chipActive]}
              onPress={() => onChangePeriode(p.value)}>
              <Text style={[styles.chipText, selectedPeriod === p.value && styles.chipTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ── Filtre type avec compteurs ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 10, paddingBottom: 4 }}>
        <View style={styles.chipsRow}>
          {TYPES_SORTIE.map(t => {
            const count = countByType(t.value);
            const isActive = selectedType === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeChip, isActive && { backgroundColor: t.color + '22', borderColor: t.color }]}
                onPress={() => setSelectedType(t.value)}>
                <MaterialCommunityIcons name={t.icon as any} size={13} color={isActive ? t.color : colors.textSecondary} />
                <Text style={[styles.typeChipText, isActive && { color: t.color, fontWeight: '700' }]}>
                  {t.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Liste ── */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={sortiesFiltrees}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="arrow-up-circle-outline" size={64} color={colors.border} />
              <Text style={styles.emptyTitle}>Aucune sortie</Text>
              <Text style={styles.emptySub}>Aucune sortie pour cette période</Text>
            </View>
          }
          renderItem={({ item }) => {
            const typeInfo = getTypeInfo(item.typeSortie);
            return (
              <Card style={styles.card}>
                <Card.Content style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: typeInfo.color + '22' }]}>
                    <MaterialCommunityIcons name={typeInfo.icon as any} size={22} color={typeInfo.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {item.produit?.nom || item.produitNom || '—'}
                    </Text>
                    <Text style={styles.cardSub}>{formatDate(item.dateMouvement)}</Text>
                    {item.motif ? <Text style={styles.cardSub}>{item.motif}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.badge, { backgroundColor: typeInfo.color + '22' }]}>
                      <Text style={[styles.badgeTxt, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                    </View>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: typeInfo.color }}>
                      −{item.quantite}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: { backgroundColor: colors.hero, flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.warningBg, paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: colors.warning, fontSize: 12 },

  chipsRow: { flexDirection: 'row', gap: 6 },

  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  chipTextActive: { color: '#fff' },

  typeChip: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  typeChipText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },

  card: { marginBottom: 8, borderRadius: 16, elevation: 1, backgroundColor: colors.card },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14, color: colors.text },
  cardSub: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textSecondary, marginTop: 12 },
  emptySub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
