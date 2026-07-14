import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Text, Card, FAB, ActivityIndicator, Modal, Portal, TextInput, Button } from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

export default function BonusFournisseursScreen() {
  const { lang } = useLang();
  const [bonus, setBonus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fournisseurId: '', montant: '', description: '', date: '' });

  const charger = async () => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await api.get('/bonus-fournisseurs');
      const liste = res.data?.data || res.data || [];
      setBonus(liste);
      setFromCache(false);
      sauvegarderCache('bonus_fournisseurs', liste).catch(() => {});
    } catch {
      const cached = await lireCache<any>('bonus_fournisseurs');
      if (cached.length > 0) { setBonus(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const total = bonus.reduce((s: number, b: any) => s + (b.montant || 0), 0);

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {fromCache && (
        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#92400e', fontSize: 12 }}>⚠ Mode hors ligne — données locales</Text>
        </View>
      )}
      <View style={styles.banner}>
        <Text style={styles.bannerLabel}>{tr('total', lang)} {tr('bonus_fournisseurs', lang)}</Text>
        <Text style={styles.bannerVal}>{total.toLocaleString('fr-FR')} FCFA</Text>
      </View>
      <FlatList
        data={bonus}
        keyExtractor={b => String(b.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.fournisseurNom || `${tr('fournisseur', lang)} #${item.fournisseurId}`}</Text>
                <Text style={styles.montant}>{item.montant?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              {item.description && <Text style={styles.sub}>{item.description}</Text>}
              <Text style={styles.date}>{item.date ? new Date(item.date).toLocaleDateString('fr-FR') : ''}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucun bonus enregistré</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowModal(true)} />
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('nouveau_bonus', lang)}</Text>
          <TextInput label={tr('montant', lang) + ' *'} value={form.montant} onChangeText={t => setForm({ ...form, montant: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
          <TextInput label={tr('description', lang)} value={form.description} onChangeText={t => setForm({ ...form, description: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={async () => {
            const payload = { ...form, montant: parseFloat(form.montant) };
            try {
              await executerOuMettreEnFile('bonus_fournisseur', payload, () => api.post('/bonus-fournisseurs', payload));
              setShowModal(false);
              setForm({ fournisseurId: '', montant: '', description: '', date: '' });
              charger();
            } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer'); }
          }}>{tr('enregistrer', lang)}</Button>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  banner: { backgroundColor: '#7b1fa2', padding: 16, alignItems: 'center' },
  bannerLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  bannerVal: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#7b1fa2', fontSize: 16 },
  sub: { color: '#666', fontSize: 12, marginTop: 4 },
  date: { color: '#aaa', fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
});
