import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getResultatJournalier, getResultatMensuel, getResultatAnnuel } from '../services/api.service';

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
    <View style={styles.container}>
      {/* Onglets période */}
      <View style={styles.periodTabs}>
        {(['JOURNALIER', 'MENSUEL', 'ANNUEL'] as Periode[]).map(p => (
          <TouchableOpacity key={p} style={[styles.periodBtn, periodeActive === p && styles.periodBtnActive]} onPress={() => selectionner(p)}>
            <Text style={[styles.periodBtnText, periodeActive === p && styles.periodBtnTextActive]}>
              {p === 'JOURNALIER' ? 'Jour' : p === 'MENSUEL' ? 'Mois' : 'Année'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtres */}
      {periodeActive === 'JOURNALIER' && (
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Date</Text>
          <RNTextInput style={styles.dateInput} value={dateJour} onChangeText={setDateJour} onBlur={() => charger()} placeholder="AAAA-MM-JJ" />
        </View>
      )}
      {periodeActive === 'MENSUEL' && (
        <View style={styles.filterCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MOIS.map(m => (
              <TouchableOpacity key={m.v} style={[styles.chip, moisSelect === m.v && styles.chipActive]} onPress={() => { setMoisSelect(m.v); charger(); }}>
                <Text style={[styles.chipText, moisSelect === m.v && styles.chipTextActive]}>{m.l}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
            {ANNEES.map(a => (
              <TouchableOpacity key={a} style={[styles.chip, anneeSelect === a && styles.chipActive]} onPress={() => { setAnneeSelect(a); charger(); }}>
                <Text style={[styles.chipText, anneeSelect === a && styles.chipTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {periodeActive === 'ANNUEL' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ ...styles.filterCard, gap: 6 }}>
          {ANNEES.map(a => (
            <TouchableOpacity key={a} style={[styles.chip, anneeSelect === a && styles.chipActive]} onPress={() => { setAnneeSelect(a); charger(); }}>
              <Text style={[styles.chipText, anneeSelect === a && styles.chipTextActive]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" />
      ) : erreur ? (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#dc2626" />
          <Text style={styles.errorTxt}>{erreur}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        >
          {data && (
            <>
              {/* Carte principale GAIN/PERTE */}
              <View style={[styles.resultatCard, isGain ? styles.resultatCardGain : styles.resultatCardPerte]}>
                <View style={[styles.resultatBadge, { backgroundColor: isGain ? '#16a34a' : '#dc2626' }]}>
                  <MaterialCommunityIcons name={isGain ? 'trending-up' : 'trending-down'} size={14} color="#fff" />
                  <Text style={styles.resultatBadgeText}>{data.etat}</Text>
                </View>
                <Text style={[styles.resultatMontant, { color: isGain ? '#16a34a' : '#dc2626' }]}>{money(data.resultatNet)}</Text>
                <Text style={styles.resultatPeriode}>{data.periode} · {data.dateDebut} → {data.dateFin}</Text>
              </View>

              {/* Décomposition */}
              <View style={styles.detailCard}>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: '#16a34a22' }]}>
                    <MaterialCommunityIcons name="trending-up" size={18} color="#16a34a" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Bénéfices ventes</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: '#16a34a' }]}>{money(data.benefices)}</Text>
                </View>
                <Text style={styles.detailSep}>+</Text>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: '#1a56db22' }]}>
                    <MaterialCommunityIcons name="gift-outline" size={18} color="#1a56db" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Bonus fournisseurs</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: '#1a56db' }]}>{money(data.bonusFournisseurs)} <Text style={styles.detailPct}>({pctBonus}%)</Text></Text>
                </View>
                <Text style={styles.detailSep}>−</Text>
                <View style={styles.detailRow}>
                  <View style={[styles.detailIcon, { backgroundColor: '#dc262622' }]}>
                    <MaterialCommunityIcons name="trending-down" size={18} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailLabel}>Dépenses</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: '#dc2626' }]}>{money(data.depenses)} <Text style={styles.detailPct}>({pctDepenses}%)</Text></Text>
                </View>
                <View style={[styles.detailTotal, { borderTopColor: isGain ? '#16a34a' : '#dc2626' }]}>
                  <Text style={styles.detailTotalEq}>=</Text>
                  <Text style={styles.detailTotalLabel}>Résultat Net</Text>
                  <Text style={[styles.detailTotalValue, { color: isGain ? '#16a34a' : '#dc2626' }]}>{money(data.resultatNet)}</Text>
                </View>
              </View>

              {/* Barres */}
              <View style={styles.barsCard}>
                <View style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: '#16a34a' }]}>Bénéfices</Text>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pctBenefices}%` as any, backgroundColor: '#16a34a' }]} /></View>
                </View>
                <View style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: '#1a56db' }]}>Bonus</Text>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pctBonus}%` as any, backgroundColor: '#1a56db' }]} /></View>
                </View>
                <View style={styles.barRow}>
                  <Text style={[styles.barLabel, { color: '#dc2626' }]}>Dépenses</Text>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${pctDepenses}%` as any, backgroundColor: '#dc2626' }]} /></View>
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
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  periodTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#1a56db' },
  periodBtnText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  periodBtnTextActive: { color: '#fff' },

  filterCard: { marginHorizontal: 12, marginTop: 10, backgroundColor: '#fff', borderRadius: 10, padding: 10 },
  filterLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  dateInput: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f1f5f9' },
  chipActive: { backgroundColor: '#1a56db' },
  chipText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', margin: 12, padding: 14, borderRadius: 10 },
  errorTxt: { color: '#dc2626', fontSize: 13, flex: 1 },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  offlineBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  resultatCard: { alignItems: 'center', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1.5 },
  resultatCardGain: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  resultatCardPerte: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  resultatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  resultatBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  resultatMontant: { fontSize: 26, fontWeight: 'bold' },
  resultatPeriode: { fontSize: 11, color: '#64748b', marginTop: 6 },

  detailCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, elevation: 1 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  detailIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 13, color: '#334155' },
  detailValue: { fontSize: 13, fontWeight: '700' },
  detailPct: { fontSize: 11, fontWeight: '400', color: '#94a3b8' },
  detailSep: { textAlign: 'center', color: '#94a3b8', fontSize: 14, fontWeight: 'bold' },
  detailTotal: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 2, marginTop: 8, paddingTop: 10 },
  detailTotalEq: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8' },
  detailTotalLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1e293b' },
  detailTotalValue: { fontSize: 15, fontWeight: 'bold' },

  barsCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, elevation: 1 },
  barRow: { marginBottom: 10 },
  barLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  barTrack: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
