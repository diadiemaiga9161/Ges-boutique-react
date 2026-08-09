import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Alert, RefreshControl, TouchableOpacity } from 'react-native';
import { Text, Card, FAB, ActivityIndicator, Modal, Portal, TextInput, Button, Switch, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// Modèle réel (TransfertController + transfert.service.ts Ionic) : une
// "config transferts" est un registre de boutiques PARTENAIRES (nom + URL de
// leur backend + actif), sous /api/transferts/partenaires — PAS une paire
// source/destination avec confirmation auto sous /config-transferts
// (endpoint inexistant utilisé par une version précédente de cet écran).
interface BoutiquePartenaire {
  id?: number;
  nom: string;
  url: string;
  actif: boolean;
}

const FORM_INITIAL: BoutiquePartenaire = { nom: '', url: '', actif: true };

export default function ConfigTransfertsScreen() {
  const { lang } = useLang();
  const [partenaires, setPartenaires] = useState<BoutiquePartenaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BoutiquePartenaire | null>(null);
  const [form, setForm] = useState<BoutiquePartenaire>({ ...FORM_INITIAL });
  const [saving, setSaving] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/transferts/partenaires');
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setPartenaires(data);
      setFromCache(false);
      sauvegarderCache('transferts_partenaires', data).catch(() => {});
    } catch {
      const cached = await lireCache<BoutiquePartenaire>('transferts_partenaires');
      setPartenaires(cached);
      setFromCache(cached.length > 0);
    }
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const ouvrirCreation = () => {
    setEditing(null);
    setForm({ ...FORM_INITIAL });
    setShowModal(true);
  };

  const ouvrirModif = (p: BoutiquePartenaire) => {
    setEditing(p);
    setForm({ ...p });
    setShowModal(true);
  };

  const sauvegarder = async () => {
    if (!form.nom.trim() || !form.url.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setSaving(true);
    const type = editing?.id ? 'transfert_partenaire_update' : 'transfert_partenaire_create';
    const payload = editing?.id ? { id: editing.id, data: form } : form;
    const { offline } = await executerOuMettreEnFile(type, payload, () =>
      editing?.id ? api.put(`/transferts/partenaires/${editing.id}`, form) : api.post('/transferts/partenaires', form)
    );
    setShowModal(false);
    if (offline) {
      Alert.alert(tr('hors_ligne', lang), 'Enregistré localement — sera synchronisé au retour du réseau.');
    } else {
      charger();
    }
    setSaving(false);
  };

  const supprimer = (p: BoutiquePartenaire) => {
    if (!p.id) return;
    Alert.alert('Supprimer', `Supprimer la boutique partenaire "${p.nom}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: tr('supprimer', lang),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/transferts/partenaires/${p.id}`);
            charger();
          } catch {
            Alert.alert(tr('erreur', lang), 'Suppression impossible');
          }
        },
      },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {fromCache && (
        <View style={styles.offlineBanner}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#fff" />
          <Text style={styles.offlineBannerText}>Hors ligne — dernières données connues</Text>
        </View>
      )}
      <FlatList
        data={partenaires}
        keyExtractor={(c, i) => String(c.id ?? i)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium">{item.nom}</Text>
                <Text style={styles.sub} numberOfLines={1}>{item.url}</Text>
                <View style={[styles.badge, { backgroundColor: item.actif ? '#4caf5022' : '#9e9e9e22' }]}>
                  <Text style={[styles.badgeText, { color: item.actif ? '#4caf50' : '#9e9e9e' }]}>
                    {item.actif ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row' }}>
                <IconButton icon="pencil-outline" size={18} iconColor="#1a56db" onPress={() => ouvrirModif(item)} />
                <IconButton icon="delete-outline" size={18} iconColor="#e53935" onPress={() => supprimer(item)} />
              </View>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Aucune boutique partenaire configurée</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={ouvrirCreation} />
      <Portal>
        <Modal visible={showModal} onDismiss={() => setShowModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>
            {editing ? 'Modifier la boutique partenaire' : 'Nouvelle boutique partenaire'}
          </Text>
          <TextInput label="Nom *" value={form.nom} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="URL du backend *" value={form.url} onChangeText={t => setForm({ ...form, url: t })} mode="outlined" autoCapitalize="none" keyboardType="url" placeholder="https://..." style={styles.input} />
          <View style={styles.switchRow}>
            <Text>Actif</Text>
            <Switch value={form.actif} onValueChange={v => setForm({ ...form, actif: v })} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button mode="outlined" onPress={() => setShowModal(false)} style={{ flex: 1 }}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" onPress={sauvegarder} loading={saving} disabled={saving} style={{ flex: 1 }}>
              {tr('enregistrer', lang)}
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6 },
  offlineBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sub: { color: '#666', marginTop: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20 },
  input: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
});
