import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getResultatJournalier, getResultatMensuel, getResultatAnnuel } from '../services/api.service';
import { useColors } from '../theme/colors';

type Periode = 'JOURNALIER' | 'MENSUEL' | 'ANNUEL';

const MOIS = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fév' }, { v: 3, l: 'Mar' }, { v: 4, l: 'Avr' },
  { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' }, { v: 7, l: 'Jul' }, { v: 8, l: 'Aoû' },
  { v: 9, l: 'Sep' }, { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Déc' },
];
const ANNEES = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const money = (v: number) => `${(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`;

interface ResultatNet {
  periode: string; dateDebut: string; dateFin: string;
  benefices: number; bonusFournisseurs: number; depenses: number; resultatNet: number;
  etat: 'GAIN' | 'PERTE';
}

export default function ResultatNetScreen() {
  const colors = useColors();
  const [periodeActive, setPeriodeActive] = useState<Periode>('MENSUEL');
  const [dateJour, setDateJour] = useState(new Date().toISOString().split('T')[0]);
  const [moisSelect, setMoisSelect] = useState(new Date().getMonth() + 1);
  const [anneeSelect, setAnneeSelect] = useState(new Date().getFullYear());
  const [data, setData] = useState<ResultatNet | null>(null);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const charger = async (p: Periode = periodeActive) => {
    setLoading(true);
    setErreur('');
    const cleCache = `cache_resultat_net_${p}_${p === 'JOURNALIER' ? dateJour : p === 'MENSUEL' ? `${moisSelect}-${anneeSelect}` : anneeSelect}`;
    try {
      let res;
      if (p === 'JOURNALIER') res = await getResultatJournalier(dateJour);
      else if (p === 'MENSUEL') res = await getResultatMensuel(moisSelect, anneeSelect);
      else res = await getResultatAnnuel(anneeSelect);
      const resultat = res.data?.data || res.data || null;
      setData(resultat);
      setFromCache(false);
      if (resultat) AsyncStorage.setItem(cleCache, JSON.stringify(resultat)).catch(() => {});
    } catch (e: any) {
      try {
        const s = await AsyncStorage.getItem(cleCache);
        if (s) {
          setData(JSON.parse(s));
          setFromCache(true);
        } else {
          setErreur(e.response?.data?.message || 'Erreur résultat');
          setData(null);
        }
      } catch {
        setErreur(e.response?.data?.message || 'Erreur résultat');
        setData(null);
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const selectionner = (p: Periode) => { setPeriodeActive(p); charger(p); };

  const totalPositif = data ? data.benefices + data.bonusFournisseurs : 0;
  const pctBonus = data && totalPositif > 0 ? Math.round((data.bonusFournisseurs / totalPositif) * 100) : 0;
  const pctDepenses = data && totalPositif > 0 ? Math.round((data.depenses / totalPositif) * 100) : 0;
  const pctBenefices = data && totalPositif > 0 ? Math.round((data.benefices / totalPositif) * 100) : 0;
  const isGain = data?.etat === 'GAIN';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Onglets période */}
      <View style={styles.periodTabs}>
        {(['JOURNALIER', 'MENSUEL', 'ANNUEL'] as Periode[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, { backgroundColor: periodeActive === p ? colors.primary : colors.surface }]}
            onPress={() => selectionner(p)}>
            <Text style={[styles.periodBtnText, { color: periodeActive === p ? '#fff' : colors.textSecondary }]}>
              {p === 'JOURNALIER' ? 'Jour' : p === 'MENSUEL' ? 'Mois' : 'Année'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtres */}
      {periodeActive === 'JOURNALIER' && (
        <View style={[styles.filterCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Date</Text>
          <RNTextInput
            style={[styles.dateInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
            value={dateJour}
            onChangeText={setDateJour}
            onBlur={() => charger()}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.placeholder}
          />
        </View>
      )}
      {periodeActive === 'MENSUEL' && (
        <View style={[styles.filterCard, { backgroundColor: colors.card }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MOIS.map(m => (
              <TouchableOpacity
                key={m.v}
                style={[styles.chip, { backgroundColor: moisSelect === m.v ? colors.primary : colors.inputBg }]}
                onPress={() => { setMoisSelect(m.v); charger(); }}>
                <Text style={[styles.chipText, { color: moisSelect === m.v ? '#fff' : colors.textSecondary }]}>{m.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
            {ANNEES.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, { backgroundColor: anneeSelect === a ? colors.primary : colors.inputBg }]}
                onPress={() => { setAnneeSelect(a); charger(); }}>
                <Text style={[styles.chipText, { color: anneeSelect === a ? '#fff' : colors.textSecondary }]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {periodeActive === 'ANNUEL' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ ...styles.filterCard, gap: 6, backgroundColor: colors.card }}>
          {ANNEES.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.chip, { backgroundColor: anneeSelect === a ? colors.primary : colors.inputBg }]}
              onPress={() => { setAnneeSelect(a); charger(); }}>
              <Text style={[styles.chipText, { color: anneeSelect === a ? '#fff' : colors.textSecondary }]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : erreur ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerBg }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} />
          <Text style={[styles.errorTxt, { color: colors.danger }]}>{erreur}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} colors={[colors.primary]} />}
        >
          {data && (
            <>
              {/* Carte principale GAIN/PERTE */}
              <View style={[styles.resultatCard, { backgroundColor: isGain ? colors.successBg : colors.dangerBg, borderColor: isGain ? colors.success : colors.danger }]}>
                <View style={[styles.resultatBadge, { backgroundColor: isGain ? colors.success : colors.danger }]}>
                  <MaterialCommunityIcons name={isGain ? 'trending-up' : 'trending-down'} size={14} color="#fff" />
                  <Text style={styles.resultatBadgeText}>{data.etat}</Text>
                </View>
                <Text style={[styles.resultatMontant, { color: isGain ? colors.success : colors.danger }]}>{money(data.resultatNet)}</Text>
                <Text style={[styles.resultatPeriode, { color: colors.textSecondary }]}>{data.periode} · {data.dateDebut} → {data.dateFin}</Text>
              </View>

              {/* Décomposition */}
              <View style={[styles.detailCard, { backgroundColor: colors.card }]}>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: colors.successBg }]}>
                    <MaterialCommunityIcons name="trending-up" size={18} color={colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.text }]}>Bénéfices ventes</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: colors.success }]}>{money(data.benefices)}</Text>
                </View>
                <Text style={[styles.detailSep, { color: colors.textSecondary }]}>+</Text>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: colors.infoBg }]}>
                    <MaterialCommunityIcons name="gift-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.text }]}>Bonus fournisseurs</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: colors.primary }]}>{money(data.bonusFournisseurs)} <Text style={[styles.detailPct, { color: colors.textSecondary }]}>({pctBonus}%)</Text></Text>
                </View>
                <Text style={[styles.detailSep, { color: colors.textSecondary }]}>−</Text>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: colors.dangerBg }]}>
                    <MaterialCommunityIcons name="trending-down" size={18} color={colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailLabel, { color: colors.text }]}>Dépenses</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: colors.danger }]}>{money(data.depenses)} <Text style={[styles.detailPct, { color: colors.textSecondary }]}>({pctDepenses}%)</Text></Text>
                </View>
                <View style={[styles.detailTotal, { borderTopColor: isGain ? colors.success : colors.danger }]}>
                  <Text style={[styles.detailTotalEq, { color: colors.textSecondary }]}>=</Text>
                  <Text style={[styles.detailTotalLabel, { color: colors.text }]}>Résultat Net</Text>
                  <Text style={[styles.detailTotalValue, { color: isGain ? colors.success : colors.danger }]}>{money(data.resultatNet)}</Text>
                </View>
              </View>

              {/* Barres */}
              <View style={[styles.barsCard, { backgroundColor: colors.card }]}>
                <View style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.success }]}>Bénéfices</Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.border }]}><View style={[styles.barFill, { width: `${pctBenefices}%` as any, backgroundColor: colors.success }]} /></View>
                </View>
                <View style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.primary }]}>Bonus</Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.border }]}><View style={[styles.barFill, { width: `${pctBonus}%` as any, backgroundColor: colors.primary }]} /></View>
                </View>
                <View style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: colors.danger }]}>Dépenses</Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.border }]}><View style={[styles.barFill, { width: `${pctDepenses}%` as any, backgroundColor: colors.danger }]} /></View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  periodTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodBtnText: { fontSize: 12, fontWeight: '600' },

  filterCard: { marginHorizontal: 12, marginTop: 10, borderRadius: 10, padding: 10 },
  filterLabel: { fontSize: 11, marginBottom: 4 },
  dateInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 12, fontWeight: '600' },

  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, padding: 14, borderRadius: 10 },
  errorTxt: { fontSize: 13, flex: 1 },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  offlineBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  resultatCard: { alignItems: 'center', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1.5 },
  resultatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  resultatBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  resultatMontant: { fontSize: 26, fontWeight: 'bold' },
  resultatPeriode: { fontSize: 11, marginTop: 6 },

  detailCard: { borderRadius: 18, padding: 14, marginBottom: 12, elevation: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  detailIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 13 },
  detailValue: { fontSize: 13, fontWeight: '700' },
  detailPct: { fontSize: 11, fontWeight: '400' },
  detailSep: { textAlign: 'center', fontSize: 14, fontWeight: 'bold' },
  detailTotal: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 2, marginTop: 8, paddingTop: 10 },
  detailTotalEq: { fontSize: 14, fontWeight: 'bold' },
  detailTotalLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  detailTotalValue: { fontSize: 15, fontWeight: 'bold' },

  barsCard: { borderRadius: 18, padding: 14, elevation: 1 },
  barRow: { marginBottom: 10 },
  barLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
