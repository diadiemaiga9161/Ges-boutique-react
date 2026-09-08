import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Text, Card, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBeneficeJournalier, getBeneficeHebdomadaire, getBeneficeMensuel, getBeneficeAnnuel } from '../services/api.service';
import { imprimerRapportPdfRN } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

type Periode = 'JOURNALIER' | 'HEBDOMADAIRE' | 'MENSUEL' | 'ANNUEL';

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const ANNEES = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

const formatPrix = (v: number) => `${(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`;

export default function BeneficesScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const [periode, setPeriode] = useState<Periode>('JOURNALIER');
  // Éditable — équivalent de l'ion-datetime-button (dtJour, max=today) côté
  // Ionic, absent ici jusqu'à présent (toujours figé sur la date du jour).
  const [dateJour, setDateJour] = useState(new Date().toISOString().split('T')[0]);
  const [mois, setMois] = useState(new Date().getMonth() + 1);
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [exporting, setExporting] = useState(false);

  const charger = async (p: Periode) => {
    setLoading(true);
    try {
      let res;
      if (p === 'JOURNALIER') res = await getBeneficeJournalier(dateJour);
      else if (p === 'HEBDOMADAIRE') res = await getBeneficeHebdomadaire();
      else if (p === 'MENSUEL') res = await getBeneficeMensuel(mois, annee);
      else res = await getBeneficeAnnuel(annee);
      const d = res.data?.data || res.data;
      setData(d);
      setFromCache(false);
      AsyncStorage.setItem(`cache_benefices_${p}`, JSON.stringify(d)).catch(() => {});
    } catch {
      try {
        const s = await AsyncStorage.getItem(`cache_benefices_${p}`);
        if (s) { setData(JSON.parse(s)); setFromCache(true); } else setData(null);
      } catch { setData(null); }
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger('JOURNALIER'); }, []);

  const selectionner = (p: Periode) => { setPeriode(p); charger(p); };

  const exporterPdf = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await imprimerRapportPdfRN({
        titre: `Bénéfices — ${periode}`,
        chiffreAffaireTotal: data.chiffreAffaireTotal || 0,
        nombreVentes: data.nombreVentes || 0,
        topProduits: (data.lignes || []).map((l: any) => ({ nom: l.label, quantite: l.nombreVentes, chiffreAffaire: l.benefice })),
      }, 1);
    } catch { /* impression annulée — pas bloquant */ }
    setExporting(false);
  };

  const benefice = data?.beneficeTotal || 0;
  const ca = data?.chiffreAffaireTotal || 0;
  const marge = data?.margeMoyenne ?? (ca > 0 ? (benefice / ca) * 100 : 0);
  const evolution = data?.evolution ?? 0;
  const lignes: { label: string; benefice: number; nombreVentes: number }[] = data?.lignes || [];
  const maxAbs = Math.max(...lignes.map(l => Math.abs(l.benefice)), 1);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.periodRow}>
        {(['JOURNALIER', 'HEBDOMADAIRE', 'MENSUEL', 'ANNUEL'] as Periode[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, { backgroundColor: periode === p ? colors.primary : colors.surface }]}
            onPress={() => selectionner(p)}>
            <Text style={[styles.periodBtnText, { color: periode === p ? '#fff' : colors.textSecondary }]}>
              {p === 'JOURNALIER' ? 'Jour' : p === 'HEBDOMADAIRE' ? 'Semaine' : p === 'MENSUEL' ? 'Mois' : 'Année'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sélecteur date (Jour) — équivalent de l'ion-datetime-button (dtJour) côté Ionic */}
      {periode === 'JOURNALIER' && (
        <View style={styles.selectorRow}>
          <RNTextInput
            style={[styles.dateInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            value={dateJour}
            onChangeText={setDateJour}
            onBlur={() => charger('JOURNALIER')}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.placeholder}
          />
        </View>
      )}

      {/* Sélecteur mois/année (Mensuel) ou année (Annuel) */}
      {periode === 'MENSUEL' && (
        <View style={styles.selectorRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MOIS.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, { backgroundColor: mois === i + 1 ? colors.primary : colors.surface, borderColor: mois === i + 1 ? colors.primary : colors.border }]}
                onPress={() => { setMois(i + 1); charger('MENSUEL'); }}>
                <Text style={[styles.chipText, { color: mois === i + 1 ? '#fff' : colors.textSecondary }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginTop: 6 }}>
            {ANNEES.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, { backgroundColor: annee === a ? colors.primary : colors.surface, borderColor: annee === a ? colors.primary : colors.border }]}
                onPress={() => { setAnnee(a); charger('MENSUEL'); }}>
                <Text style={[styles.chipText, { color: annee === a ? '#fff' : colors.textSecondary }]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      {periode === 'ANNUEL' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ ...styles.selectorRow, gap: 6 }}>
          {ANNEES.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.chip, { backgroundColor: annee === a ? colors.primary : colors.surface, borderColor: annee === a ? colors.primary : colors.border }]}
              onPress={() => { setAnnee(a); charger('ANNUEL'); }}>
              <Text style={[styles.chipText, { color: annee === a ? '#fff' : colors.textSecondary }]}>{a}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading && !refreshing ? (
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(periode); }} colors={[colors.primary]} />}
        >
          {!data ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chart-line" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>Aucune donnée disponible</Text>
            </View>
          ) : (
            <>
              {/* Hero */}
              <View style={[styles.hero, { backgroundColor: colors.hero }]}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroVal} numberOfLines={1} adjustsFontSizeToFit>{ca.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</Text>
                  <Text style={styles.heroLbl}>CA Total (FCFA)</Text>
                </View>
                <View style={styles.heroSep} />
                <View style={styles.heroStat}>
                  <Text style={[styles.heroVal, { color: benefice >= 0 ? '#4ade80' : '#f87171' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {benefice.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                  </Text>
                  <Text style={styles.heroLbl}>Bénéfice net (FCFA)</Text>
                </View>
                <View style={styles.heroSep} />
                <View style={styles.heroStat}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <MaterialCommunityIcons
                      name={evolution > 0 ? 'trending-up' : evolution < 0 ? 'trending-down' : 'minus'}
                      size={16}
                      color={evolution > 0 ? '#4ade80' : evolution < 0 ? '#f87171' : '#94a3b8'}
                    />
                    <Text style={[styles.heroVal, { color: evolution > 0 ? '#4ade80' : evolution < 0 ? '#f87171' : '#94a3b8' }]}>
                      {evolution >= 0 ? '+' : ''}{evolution.toFixed(1)}%
                    </Text>
                  </View>
                  <Text style={styles.heroLbl}>Évolution</Text>
                </View>
              </View>


              {/* Export PDF */}
              <TouchableOpacity style={[styles.exportBtn, { borderColor: colors.primary }]} onPress={exporterPdf} disabled={exporting}>
                <MaterialCommunityIcons name="download-outline" size={16} color={colors.primary} />
                <Text style={[styles.exportBtnText, { color: colors.primary }]}>Exporter en PDF</Text>
              </TouchableOpacity>

              {/* Cards résumé */}
              <Card style={[styles.card, { backgroundColor: colors.card }]}>
                <Card.Content style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: colors.infoBg }]}>
                    <MaterialCommunityIcons name="cash-multiple" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.text }]}>{tr('chiffre_affaires', lang)}</Text>
                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Marge moyenne : {marge.toFixed(1)}%</Text>
                  </View>
                  <Text style={[styles.cardAmt, { color: colors.text }]}>{formatPrix(ca)}</Text>
                </Card.Content>
              </Card>

              <Card style={[styles.card, { backgroundColor: colors.card }]}>
                <Card.Content style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: colors.infoBg }]}>
                    <MaterialCommunityIcons name="receipt" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.text }]}>{tr('nb_ventes', lang)}</Text>
                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Transactions enregistrées</Text>
                  </View>
                  <Text style={[styles.cardAmt, { color: colors.text }]}>{data.nombreVentes || 0}</Text>
                </Card.Content>
              </Card>

              <Card style={[styles.card, { backgroundColor: colors.card }]}>
                <Card.Content style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: benefice >= 0 ? colors.successBg : colors.dangerBg }]}>
                    <MaterialCommunityIcons name={benefice >= 0 ? 'trending-up' : 'trending-down'} size={22} color={benefice >= 0 ? colors.success : colors.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardName, { color: colors.text }]}>{tr('benefice_net', lang)}</Text>
                    <Text style={[styles.cardSub, { color: colors.textSecondary }]}>Résultat de la période</Text>
                  </View>
                  <Text style={[styles.cardAmt, { color: benefice >= 0 ? colors.success : colors.danger }]}>{formatPrix(benefice)}</Text>
                </Card.Content>
              </Card>

              {/* Graphique bénéfice par sous-période (équivalent Chart.js Ionic, en barres RN) */}
              {lignes.length > 0 && (
                <Card style={[styles.card, { backgroundColor: colors.card }]}>
                  <Card.Content>
                    <Text style={[styles.cardName, { color: colors.text }]}>Détail par période</Text>
                    <View style={styles.chart}>
                      {lignes.map((l, i) => (
                        <View key={i} style={styles.chartCol}>
                          <View style={styles.chartBarWrap}>
                            <View style={[
                              styles.chartBar,
                              { height: Math.max(3, (Math.abs(l.benefice) / maxAbs) * 60), backgroundColor: l.benefice >= 0 ? '#10b981' : '#ef4444' },
                            ]} />
                          </View>
                          <Text style={[styles.chartLbl, { color: colors.textSecondary }]} numberOfLines={1}>{l.label}</Text>
                        </View>
                      ))}
                    </View>
                  </Card.Content>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  periodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  periodBtnText: { fontSize: 12, fontWeight: '600' },

  selectorRow: { paddingHorizontal: 12, marginBottom: 8 },
  dateInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },

  hero: {
    flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8, marginHorizontal: 12, borderRadius: 18,
    elevation: 3, shadowColor: '#081648', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  heroLbl: { color: '#93c5fd', fontSize: 11, marginTop: 2, textAlign: 'center' },
  heroSep: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },

  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6, marginTop: 8, marginHorizontal: 12, borderRadius: 8 },
  offlineTxt: { color: '#92400e', fontSize: 12 },

  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 8, marginHorizontal: 12, marginTop: 12 },
  exportBtnText: { fontWeight: '700', fontSize: 12 },

  card: { marginHorizontal: 12, marginBottom: 8, marginTop: 8, borderRadius: 16, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontWeight: '600', fontSize: 14 },
  cardSub: { fontSize: 12, marginTop: 2 },
  cardAmt: { fontWeight: '700', fontSize: 14 },

  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 90, marginTop: 12, gap: 4 },
  chartCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  chartBarWrap: { height: 60, justifyContent: 'flex-end', width: '100%' },
  chartBar: { width: '100%', borderRadius: 2 },
  chartLbl: { fontSize: 8, marginTop: 4 },

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyTxt: { fontSize: 14, marginTop: 12 },
});
