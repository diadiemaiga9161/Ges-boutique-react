import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, FAB, Searchbar, ActivityIndicator, Modal, Portal, TextInput, Button } from 'react-native-paper';
import { getFournisseurs, createFournisseur } from '../services/api.service';

export default function FournisseursScreen() {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' });

  const charger = async () => {
    try {
      const res = await getFournisseurs();
      const data = res.data?.data || res.data || [];
      setFournisseurs(data); setFiltered(data);
    } catch { }
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);
  useEffect(() => {
    if (!search) { setFiltered(fournisseurs); return; }
    setFiltered(fournisseurs.filter((f: any) => f.nom?.toLowerCase().includes(search.toLowerCase())));
  }, [search, fournisseurs]);

  const ajouter = async () => {
    if (!form.nom) return;
    try {
      await createFournisseur(form);
      setShowModal(false);
      setForm({ nom: '', telephone: '', email: '', adresse: '' });
      charger();
    } catch { Alert.alert('Erreur', 'Impossible d\'ajouter'); }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <Searchbar placeholder="Rechercher..." value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.nom}</Text>
              {item.telephone && <Text style={styles.sub}>{item.telephone}</Text>}
              {item.email && <Text style={styles.sub}>{item.email}</Text>}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun fournisseur</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowModal(true)} />
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>Nouveau fournisseur</Text>
          <TextInput label="Nom *" value={form.nom} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Téléphone" value={form.telephone} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" style={styles.input} />
          <TextInput label="Email" value={form.email} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={ajouter}>Enregistrer</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  search: { margin: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  sub: { color: '#666', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
});
