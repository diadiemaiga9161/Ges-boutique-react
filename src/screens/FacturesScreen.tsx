import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, Linking } from 'react-native';
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper';
import { getVentes } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function FacturesScreen() {
  const [ventes, setVentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [boutique, setBoutique] = useState<any>({});

  const charger = async () => {
    const raw = await AsyncStorage.getItem('boutique_info');
    if (raw) setBoutique(JSON.parse(raw));
    try {
      const res = await getVentes();
      setVentes(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const envoyerWhatsApp = (vente: any) => {
    const lignes = vente.lignes?.map((l: any) => `  - ${l.produitNom} x${l.quantite} = ${l.sousTotal?.toLocaleString('fr-FR')} FCFA`).join('\n') || '';
    const message = [
      `🧾 *FACTURE — ${boutique.nom || 'Boutique'}*`,
      ``,
      `Client : ${vente.clientNom || 'Anonyme'}`,
      `Date : ${vente.dateVente ? new Date(vente.dateVente).toLocaleDateString('fr-FR') : ''}`,
      ``,
      lignes,
      ``,
      `*Total : ${vente.montantTotal?.toLocaleString('fr-FR')} FCFA*`,
      `Paiement : ${vente.modePaiement?.replace('_', ' ')}`,
    ].join('\n');

    const num = boutique.telephone?.replace(/[\s()\-+]/g, '') || '';
    if (num) Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(message)}`);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={ventes}
        keyExtractor={v => String(v.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">Facture #{item.id}</Text>
                <Text style={styles.montant}>{item.montantTotal?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              <Text style={styles.sub}>{item.clientNom || 'Client anonyme'}</Text>
              <Text style={styles.date}>{item.dateVente ? new Date(item.dateVente).toLocaleDateString('fr-FR') : ''}</Text>
            </Card.Content>
            <Card.Actions>
              <Button icon="whatsapp" onPress={() => envoyerWhatsApp(item)} textColor="#25D366">
                Envoyer
              </Button>
            </Card.Actions>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune facture</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#1976D2', fontSize: 16 },
  sub: { color: '#666', marginTop: 4 },
  date: { color: '#aaa', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
});
