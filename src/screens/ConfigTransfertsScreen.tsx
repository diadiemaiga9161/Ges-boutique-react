import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, FAB, ActivityIndicator, Modal, Portal, TextInput, Button, Switch } from 'react-native-paper';
import api from '../services/api.service';

export default function ConfigTransfertsScreen() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ boutiqueSrcId: '', boutiqueDestId: '', autoConfirm: false });

  const charger = async () => {
    try {
      const res = await api.get('/config-transferts');
      setConfigs(res.data?.data || res.data || []);
    } catch { }
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={configs}
        keyExtractor={c => String(c.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.boutiqueSrcNom} → {item.boutiqueDestNom}</Text>
              <Text style={styles.sub}>Confirmation auto : {item.autoConfirm ? 'Oui' : 'Non'}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune configuration</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowModal(true)} />
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>Nouvelle configuration</Text>
          <TextInput label="ID Boutique source" value={form.boutiqueSrcId} onChangeText={t => setForm({ ...form, boutiqueSrcId: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
          <TextInput label="ID Boutique destination" value={form.boutiqueDestId} onChangeText={t => setForm({ ...form, boutiqueDestId: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
          <View style={styles.switchRow}>
            <Text>Confirmation automatique</Text>
            <Switch value={form.autoConfirm} onValueChange={v => setForm({ ...form, autoConfirm: v })} />
          </View>
          <Button mode="contained" onPress={async () => {
            try {
              await api.post('/config-transferts', form);
              setShowModal(false);
              charger();
            } catch { Alert.alert('Erreur', 'Impossible d\'enregistrer'); }
          }}>Enregistrer</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { marginBottom: 10, borderRadius: 12 },
  sub: { color: '#666', marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
});
