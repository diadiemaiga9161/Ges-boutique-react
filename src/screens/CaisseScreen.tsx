import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, TextInput, Divider, ActivityIndicator, Chip } from 'react-native-paper';
import { getVentesJour } from '../services/api.service';

export default function CaisseScreen() {
  const [ventesJour, setVentesJour] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const charger = async () => {
    try {
      const res = await getVentesJour();
      setVentesJour(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const totalJour = ventesJour.reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const totalEspeces = ventesJour.filter((v: any) => v.modePaiement === 'ESPECES').reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const totalMobileMoney = ventesJour.filter((v: any) => v.modePaiement !== 'ESPECES').reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);
  const totalCredits = ventesJour.filter((v: any) => v.estCredit).reduce((s: number, v: any) => s + (v.montantTotal || 0), 0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {/* Hero caisse */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Encaissements du jour</Text>
        <Text style={styles.heroVal}>{totalJour.toLocaleString('fr-FR')} FCFA</Text>
        <Text style={styles.heroSub}>{ventesJour.length} vente(s)</Text>
      </View>

      {/* KPIs */}
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiVal}>{totalEspeces.toLocaleString('fr-FR')}</Text>
          <Text style={styles.kpiLabel}>Espèces</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#e8f5e9' }]}>
          <Text style={[styles.kpiVal, { color: '#388e3c' }]}>{totalMobileMoney.toLocaleString('fr-FR')}</Text>
          <Text style={styles.kpiLabel}>Mobile Money</Text>
        </View>
        <View style={[styles.kpi, { backgroundColor: '#fce4ec' }]}>
          <Text style={[styles.kpiVal, { color: '#c62828' }]}>{totalCredits.toLocaleString('fr-FR')}</Text>
          <Text style={styles.kpiLabel}>Crédits</Text>
        </View>
      </View>

      {/* Liste ventes du jour */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Ventes du jour</Text>
      {ventesJour.map((v: any) => (
        <Card key={v.id} style={styles.card}>
          <Card.Content>
            <View style={styles.row}>
              <Text variant="bodyMedium">{v.clientNom || 'Client anonyme'}</Text>
              <Text style={styles.montant}>{v.montantTotal?.toLocaleString('fr-FR')} FCFA</Text>
            </View>
            <View style={styles.row}>
              <Chip compact>{v.modePaiement?.replace('_', ' ')}</Chip>
              {v.estCredit && <Chip compact icon="alert" textStyle={{ color: '#f44336' }}>Crédit</Chip>}
              <Text style={styles.heure}>{v.dateVente ? new Date(v.dateVente).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
            </View>
          </Card.Content>
        </Card>
      ))}
      {ventesJour.length === 0 && <Text style={styles.empty}>Aucune vente aujourd'hui</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  hero: { backgroundColor: '#1976D2', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  heroVal: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 4 },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, backgroundColor: '#e3f2fd', borderRadius: 12, padding: 12, alignItems: 'center' },
  kpiVal: { fontSize: 16, fontWeight: 'bold', color: '#1976D2' },
  kpiLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 8, color: '#333' },
  card: { marginBottom: 8, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  montant: { fontWeight: 'bold', color: '#1976D2' },
  heure: { color: '#aaa', fontSize: 12 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
});
