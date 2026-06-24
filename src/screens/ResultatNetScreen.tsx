import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, ActivityIndicator, Divider } from 'react-native-paper';
import { getRapportMois } from '../services/api.service';
import { getDepenses } from '../services/api.service';

export default function ResultatNetScreen() {
  const [rapport, setRapport] = useState<any>(null);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getRapportMois(), getDepenses()]).then(([r, d]) => {
      setRapport(r.data?.data || r.data);
      const deps = d.data?.data || d.data || [];
      // Filtre dépenses du mois courant
      const mois = new Date().getMonth();
      const annee = new Date().getFullYear();
      setDepenses(deps.filter((dep: any) => {
        if (!dep.date) return true;
        const d = new Date(dep.date);
        return d.getMonth() === mois && d.getFullYear() === annee;
      }));
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const ca = rapport?.chiffreAffaireTotal || 0;
  const beneficeBrut = rapport?.beneficeTotal || 0;
  const totalDepenses = depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);
  const resultatNet = beneficeBrut - totalDepenses;

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.hero, { backgroundColor: resultatNet >= 0 ? '#388e3c' : '#c62828' }]}>
        <Text style={styles.heroLabel}>Résultat net du mois</Text>
        <Text style={styles.heroVal}>{resultatNet.toLocaleString('fr-FR')} FCFA</Text>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>Calcul du résultat</Text>
          <View style={styles.row}><Text>Chiffre d'affaires</Text><Text style={styles.green}>{ca.toLocaleString('fr-FR')} FCFA</Text></View>
          <View style={styles.row}><Text>Bénéfice brut ventes</Text><Text style={styles.green}>{beneficeBrut.toLocaleString('fr-FR')} FCFA</Text></View>
          <Divider style={{ marginVertical: 8 }} />
          <View style={styles.row}><Text>Total dépenses</Text><Text style={styles.red}>- {totalDepenses.toLocaleString('fr-FR')} FCFA</Text></View>
          <Divider style={{ marginVertical: 8 }} />
          <View style={styles.row}>
            <Text variant="titleMedium">Résultat net</Text>
            <Text variant="titleMedium" style={{ color: resultatNet >= 0 ? '#388e3c' : '#f44336' }}>
              {resultatNet.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  hero: { borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 4 },
  card: { borderRadius: 12 },
  title: { fontWeight: 'bold', color: '#1a56db', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  green: { color: '#388e3c', fontWeight: '600' },
  red: { color: '#f44336', fontWeight: '600' },
});
