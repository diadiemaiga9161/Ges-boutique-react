import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, FAB, ActivityIndicator, Modal, Portal, TextInput, Button } from 'react-native-paper';
import { getDepenses, createDepense } from '../services/api.service';

export default function DepensesScreen() {
  const [depenses, setDepenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ description: '', montant: '', categorie: '' });

  const charger = async () => {
    try {
      const res = await getDepenses();
      setDepenses(res.data?.data || res.data || []);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const ajouter = async () => {
    if (!form.description || !form.montant) return;
    try {
      await createDepense({ ...form, montant: parseFloat(form.montant) });
      setShowModal(false);
      setForm({ description: '', montant: '', categorie: '' });
      charger();
    } catch { Alert.alert('Erreur', 'Impossible d\'enregistrer la dépense'); }
  };

  const total = depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>Total dépenses</Text>
        <Text style={styles.totalVal}>{total.toLocaleString('fr-FR')} FCFA</Text>
      </View>
      <FlatList
        data={depenses}
        keyExtractor={d => String(d.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={{ flex: 1 }}>{item.description}</Text>
                <Text style={styles.montant}>{item.montant?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              {item.categorie && <Text style={styles.sub}>{item.categorie}</Text>}
              <Text style={styles.date}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : ''}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune dépense</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowModal(true)} />
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>Nouvelle dépense</Text>
          <TextInput label="Description *" value={form.description} onChangeText={t => setForm({ ...form, description: t })} mode="outlined" style={styles.input} />
          <TextInput label="Montant *" value={form.montant} onChangeText={t => setForm({ ...form, montant: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
          <TextInput label="Catégorie" value={form.categorie} onChangeText={t => setForm({ ...form, categorie: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={ajouter}>Enregistrer</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  totalBanner: { backgroundColor: '#f44336', padding: 16, alignItems: 'center' },
  totalLabel: { color: '#fff', fontSize: 12 },
  totalVal: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#f44336' },
  sub: { color: '#888', fontSize: 12, marginTop: 2 },
  date: { color: '#aaa', fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
});
