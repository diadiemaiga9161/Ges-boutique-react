import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, FAB, Searchbar, ActivityIndicator, Modal, Portal, TextInput, Button } from 'react-native-paper';
import { getClients, createClient } from '../services/api.service';
import { cacheClients } from '../db/database';
import { Client } from '../types';

export default function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' });

  const charger = async () => {
    try {
      const res = await getClients();
      const data = res.data?.data || res.data || [];
      setClients(data);
      setFiltered(data);
      await cacheClients(data);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(clients); return; }
    const q = search.toLowerCase();
    setFiltered(clients.filter(c => c.nom.toLowerCase().includes(q) || c.telephone?.includes(q)));
  }, [search, clients]);

  const ajouter = async () => {
    if (!form.nom) return;
    try {
      await createClient(form);
      setShowModal(false);
      setForm({ nom: '', telephone: '', email: '', adresse: '' });
      charger();
    } catch { Alert.alert('Erreur', 'Impossible d\'ajouter le client'); }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Rechercher..." value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={c => String(c.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.nom}</Text>
              {item.telephone && <Text style={styles.sub}>{item.telephone}</Text>}
              {item.soldeCredit && item.soldeCredit > 0 && (
                <Text style={styles.credit}>Crédit dû : {item.soldeCredit} FCFA</Text>
              )}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun client</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowModal(true)} />

      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>Nouveau client</Text>
          <TextInput label="Nom *" value={form.nom} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Téléphone" value={form.telephone} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
          <TextInput label="Email" value={form.email} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={ajouter} style={{ marginTop: 8 }}>Enregistrer</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  search: { margin: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  sub: { color: '#666', marginTop: 2 },
  credit: { color: '#f44336', fontWeight: '600', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
});
