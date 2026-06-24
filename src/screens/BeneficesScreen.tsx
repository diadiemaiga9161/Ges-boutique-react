import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, ActivityIndicator, SegmentedButtons } from 'react-native-paper';
import { getRapportJour, getRapportSemaine, getRapportMois } from '../services/api.service';

export default function BeneficesScreen() {
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const charger = async (p: 'jour' | 'semaine' | 'mois') => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = p === 'jour' ? await getRapportJour(today) : p === 'semaine' ? await getRapportSemaine() : await getRapportMois();
      setData(res.data?.data || res.data);
    } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { charger('jour'); }, []);

  const benefice = data?.beneficeTotal || 0;
  const ca = data?.chiffreAffaireTotal || 0;
  const marge = ca > 0 ? ((benefice / ca) * 100).toFixed(1) : '0';

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={periode}
        onValueChange={v => { setPeriode(v as any); charger(v as any); }}
        buttons={[{ value: 'jour', label: 'Jour' }, { value: 'semaine', label: 'Semaine' }, { value: 'mois', label: 'Mois' }]}
        style={styles.segments}
      />
      {loading ? <ActivityIndicator style={{ flex: 1 }} size="large" /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={[styles.hero, { backgroundColor: benefice >= 0 ? '#388e3c' : '#c62828' }]}>
            <Text style={styles.heroLabel}>Bénéfice</Text>
            <Text style={styles.heroVal}>{benefice.toLocaleString('fr-FR')} FCFA</Text>
            <Text style={styles.heroSub}>Marge : {marge}%</Text>
          </View>
          <View style={styles.kpiRow}>
            <View style={styles.kpi}>
              <Text style={styles.kpiVal}>{ca.toLocaleString('fr-FR')}</Text>
              <Text style={styles.kpiLabel}>Chiffre d'affaires</Text>
            </View>
            <View style={[styles.kpi, { backgroundColor: '#fce4ec' }]}>
              <Text style={[styles.kpiVal, { color: '#c62828' }]}>{(ca - benefice).toLocaleString('fr-FR')}</Text>
              <Text style={styles.kpiLabel}>Coût des ventes</Text>
            </View>
          </View>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium" style={{ color: '#1a56db', marginBottom: 8 }}>Résumé</Text>
              <View style={styles.row}><Text>CA total</Text><Text style={styles.bold}>{ca.toLocaleString('fr-FR')} FCFA</Text></View>
              <View style={styles.row}><Text>Bénéfice net</Text><Text style={[styles.bold, { color: benefice >= 0 ? '#388e3c' : '#f44336' }]}>{benefice.toLocaleString('fr-FR')} FCFA</Text></View>
              <View style={styles.row}><Text>Nombre de ventes</Text><Text style={styles.bold}>{data?.nombreVentes || 0}</Text></View>
              {data?.montantRemisesTotal > 0 && <View style={styles.row}><Text>Remises accordées</Text><Text style={[styles.bold, { color: '#ff9800' }]}>{data.montantRemisesTotal.toLocaleString('fr-FR')} FCFA</Text></View>}
            </Card.Content>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  segments: { margin: 12 },
  hero: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 4 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: '#e8f5e9', borderRadius: 12, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 15, fontWeight: 'bold', color: '#388e3c' },
  kpiLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  card: { borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  bold: { fontWeight: 'bold' },
});
