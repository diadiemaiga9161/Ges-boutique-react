import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { Text, Card, Button, SegmentedButtons, ActivityIndicator, Divider } from 'react-native-paper';
import { getRapportJour, getRapportSemaine, getRapportMois } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RapportsScreen() {
  const [periode, setPeriode] = useState<'jour' | 'semaine' | 'mois'>('jour');
  const [rapport, setRapport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [boutique, setBoutique] = useState<any>({});

  useEffect(() => {
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (raw) setBoutique(JSON.parse(raw));
    });
    charger('jour');
  }, []);

  const charger = async (p: 'jour' | 'semaine' | 'mois') => {
    setLoading(true);
    try {
      let res;
      const today = new Date().toISOString().split('T')[0];
      if (p === 'jour') res = await getRapportJour(today);
      else if (p === 'semaine') res = await getRapportSemaine();
      else res = await getRapportMois();
      setRapport(res.data?.data || res.data);
    } catch { setRapport(null); }
    setLoading(false);
  };

  const switchPeriode = (p: 'jour' | 'semaine' | 'mois') => {
    setPeriode(p);
    charger(p);
  };

  const money = (v: number) => `${(v || 0).toLocaleString('fr-FR')} ${boutique.devise || 'FCFA'}`;

  const envoyerWhatsApp = () => {
    if (!rapport) return;
    const numeros = [boutique.telephone, boutique.telephone2, boutique.telephone3].filter(Boolean);
    if (!numeros.length) return;
    const msg = [
      `📊 *Rapport ${periode} — ${new Date().toLocaleDateString('fr-FR')}*`,
      `🏪 ${boutique.nom || ''}`,
      ``,
      `💰 CA : ${money(rapport.chiffreAffaireTotal)}`,
      rapport.beneficeTotal != null ? `📈 Bénéfice : ${money(rapport.beneficeTotal)}` : null,
      `🛒 Ventes : ${rapport.nombreVentes || 0}`,
    ].filter(Boolean).join('\n');

    numeros.forEach((num: string, i: number) => {
      setTimeout(() => {
        const clean = num.replace(/[\s()\-+]/g, '');
        Linking.openURL(`https://wa.me/${clean}?text=${encodeURIComponent(msg)}`);
      }, i * 2500);
    });
  };

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={periode}
        onValueChange={v => switchPeriode(v as any)}
        buttons={[
          { value: 'jour', label: 'Jour' },
          { value: 'semaine', label: 'Semaine' },
          { value: 'mois', label: 'Mois' },
        ]}
        style={styles.segments}
      />

      {loading ? <ActivityIndicator style={{ flex: 1 }} size="large" /> : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {rapport ? (
            <>
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.cardTitle}>Chiffre d'affaires</Text>
                  <Text variant="headlineMedium" style={styles.bigNum}>{money(rapport.chiffreAffaireTotal)}</Text>
                  <Divider style={{ marginVertical: 8 }} />
                  {rapport.beneficeTotal != null && (
                    <View style={styles.row}>
                      <Text>Bénéfice</Text>
                      <Text style={styles.green}>{money(rapport.beneficeTotal)}</Text>
                    </View>
                  )}
                  <View style={styles.row}>
                    <Text>Nombre de ventes</Text>
                    <Text style={styles.bold}>{rapport.nombreVentes || 0}</Text>
                  </View>
                  {rapport.montantRemisesTotal > 0 && (
                    <View style={styles.row}>
                      <Text>Remises</Text>
                      <Text style={styles.orange}>{money(rapport.montantRemisesTotal)}</Text>
                    </View>
                  )}
                </Card.Content>
              </Card>

              {rapport.topProduits?.length > 0 && (
                <Card style={styles.card}>
                  <Card.Content>
                    <Text variant="titleMedium" style={styles.cardTitle}>Top produits</Text>
                    {rapport.topProduits.slice(0, 5).map((p: any, i: number) => (
                      <View key={i} style={styles.row}>
                        <Text>{i + 1}. {p.nom}</Text>
                        <Text style={styles.bold}>{p.quantite} vendus</Text>
                      </View>
                    ))}
                  </Card.Content>
                </Card>
              )}

              <Button
                mode="contained"
                icon="whatsapp"
                onPress={envoyerWhatsApp}
                style={[styles.btnWA, { backgroundColor: '#25D366' }]}
              >
                Envoyer sur WhatsApp
              </Button>
            </>
          ) : (
            <Text style={styles.empty}>Données non disponibles</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  segments: { margin: 12 },
  card: { marginBottom: 12, borderRadius: 12 },
  cardTitle: { fontWeight: 'bold', marginBottom: 8, color: '#1a56db' },
  bigNum: { fontWeight: 'bold', color: '#1a56db', textAlign: 'center', marginVertical: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  bold: { fontWeight: 'bold' },
  green: { color: '#4caf50', fontWeight: 'bold' },
  orange: { color: '#ff9800', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  btnWA: { marginTop: 8, borderRadius: 8 },
});
