import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  ActivityIndicator,
  Modal,
  Portal,
  TextInput,
  Button,
  Divider,
  IconButton,
} from 'react-native-paper';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

interface ObjectifFournisseur {
  id: number;
  fournisseurNom: string;
  description: string;
  montantCible: number;
  montantActuel: number;
  pourcentage: number;
  dateLimite: string;
  statut: 'EN_COURS' | 'ATTEINT' | 'ECHOUE';
  bonusPrevu?: number;
  bonusAccorde?: number;
}

const STATUT_LABEL: Record<string, string> = {
  EN_COURS: 'En cours',
  ATTEINT: 'Atteint',
  ECHOUE: 'Echoué',
};

const STATUT_COLOR: Record<string, string> = {
  EN_COURS: '#1a56db',
  ATTEINT: '#4caf50',
  ECHOUE: '#e53935',
};

function couleurProgression(pct: number): string {
  if (pct >= 80) return '#4caf50';
  if (pct >= 50) return '#ff9800';
  return '#e53935';
}

export default function ObjectifsFournisseurScreen() {
  const { lang } = useLang();
  const [objectifs, setObjectifs] = useState<ObjectifFournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Modal ajout
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    fournisseurNom: '',
    description: '',
    montantCible: '',
    dateLimite: '',
    bonusPrevu: '',
  });
  const [saving, setSaving] = useState(false);

  // Modal détails / avancement
  const [selected, setSelected] = useState<ObjectifFournisseur | null>(null);
  const [avancement, setAvancement] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loadingAv, setLoadingAv] = useState(false);

  const charger = async () => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
      const res = await api.get('/objectifs-fournisseur');
      const liste = res.data?.data || res.data || [];
      setObjectifs(liste);
      setFromCache(false);
      sauvegarderCache('objectifs_fournisseur', liste).catch(() => {});
    } catch {
      const cached = await lireCache<ObjectifFournisseur>('objectifs_fournisseur');
      if (cached.length > 0) { setObjectifs(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  const nbActifs = objectifs.filter(o => o.statut === 'EN_COURS').length;
  const totalBonus = objectifs.reduce(
    (s, o) => s + (o.bonusAccorde || 0),
    0,
  );
  const nbAtteints = objectifs.filter(o => o.statut === 'ATTEINT').length;

  const ouvrir = async (obj: ObjectifFournisseur) => {
    setSelected(obj);
    setShowDetails(true);
    setLoadingAv(true);
    try {
      const res = await api.get(`/objectifs-fournisseur/${obj.id}/avancement`);
      setAvancement(res.data?.data || res.data);
    } catch { setAvancement(null); }
    setLoadingAv(false);
  };

  const supprimer = (id: number) => {
    Alert.alert(
      'Confirmer',
      'Supprimer cet objectif ?',
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await executerOuMettreEnFile('objectif_delete', { id }, () => api.delete(`/objectifs-fournisseur/${id}`));
              charger();
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible de supprimer');
            }
          },
        },
      ],
    );
  };

  const enregistrer = async () => {
    if (!form.fournisseurNom.trim() || !form.montantCible.trim()) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setSaving(true);
    const payloadObj = { fournisseurNom: form.fournisseurNom.trim(), description: form.description.trim(), montantCible: parseFloat(form.montantCible), dateLimite: form.dateLimite.trim() || null, bonusPrevu: form.bonusPrevu ? parseFloat(form.bonusPrevu) : null };
    try {
      await executerOuMettreEnFile('objectif_create', payloadObj, () => api.post('/objectifs-fournisseur', payloadObj));
      setShowModal(false);
      setForm({ fournisseurNom: '', description: '', montantCible: '', dateLimite: '', bonusPrevu: '' });
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), "Impossible d'enregistrer l'objectif");
    }
    setSaving(false);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {fromCache && (
        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <Text style={{ color: '#92400e', fontSize: 12 }}>⚠ Mode hors ligne — données locales</Text>
        </View>
      )}
      {/* Bannière stats */}
      <View style={styles.banner}>
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{nbActifs}</Text>
          <Text style={styles.bannerLabel}>Actifs</Text>
        </View>
        <View style={styles.bannerSep} />
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{totalBonus.toLocaleString('fr-FR')}</Text>
          <Text style={styles.bannerLabel}>Bonus gagnés (FCFA)</Text>
        </View>
        <View style={styles.bannerSep} />
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{nbAtteints}</Text>
          <Text style={styles.bannerLabel}>Atteints</Text>
        </View>
      </View>

      <FlatList
        data={objectifs}
        keyExtractor={o => String(o.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Aucun objectif enregistré</Text>
        }
        renderItem={({ item }) => {
          const pct = Math.min(item.pourcentage || 0, 100);
          const couleur = couleurProgression(pct);
          return (
            <TouchableOpacity onPress={() => ouvrir(item)}>
              <Card style={styles.card}>
                <Card.Content>
                  {/* Ligne titre + statut + supprimer */}
                  <View style={styles.row}>
                    <Text variant="titleMedium" style={styles.fournisseurNom}>
                      {item.fournisseurNom}
                    </Text>
                    <View style={styles.rowEnd}>
                      <View style={[styles.badge, { backgroundColor: STATUT_COLOR[item.statut] + '22' }]}>
                        <Text style={[styles.badgeText, { color: STATUT_COLOR[item.statut] }]}>
                          {STATUT_LABEL[item.statut] || item.statut}
                        </Text>
                      </View>
                      <IconButton
                        icon="delete-outline"
                        size={18}
                        iconColor="#e53935"
                        onPress={() => supprimer(item.id)}
                      />
                    </View>
                  </View>

                  {item.description ? (
                    <Text style={styles.sub}>{item.description}</Text>
                  ) : null}

                  {/* Barre de progression */}
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` as any, backgroundColor: couleur },
                      ]}
                    />
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.progLabel}>
                      {item.montantActuel?.toLocaleString('fr-FR')} / {item.montantCible?.toLocaleString('fr-FR')} FCFA
                    </Text>
                    <Text style={[styles.progPct, { color: couleur }]}>{pct.toFixed(0)}%</Text>
                  </View>

                  <Divider style={{ marginVertical: 6 }} />

                  <View style={styles.row}>
                    {item.dateLimite ? (
                      <Text style={styles.date}>
                        Limite : {new Date(item.dateLimite).toLocaleDateString('fr-FR')}
                      </Text>
                    ) : (
                      <Text style={styles.date}>Sans date limite</Text>
                    )}
                    {item.bonusAccorde ? (
                      <Text style={styles.bonusOk}>
                        Bonus accordé : {item.bonusAccorde.toLocaleString('fr-FR')} FCFA
                      </Text>
                    ) : item.bonusPrevu ? (
                      <Text style={styles.bonusPrevu}>
                        Bonus prévu : {item.bonusPrevu.toLocaleString('fr-FR')} FCFA
                      </Text>
                    ) : null}
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => setShowModal(true)} />

      <Portal>
        {/* Modal ajout */}
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            Nouvel objectif
          </Text>
          <TextInput
            label="Fournisseur *"
            value={form.fournisseurNom}
            onChangeText={t => setForm({ ...form, fournisseurNom: t })}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label={tr('description', lang)}
            value={form.description}
            onChangeText={t => setForm({ ...form, description: t })}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Montant cible *"
            value={form.montantCible}
            onChangeText={t => setForm({ ...form, montantCible: t })}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Date limite (AAAA-MM-JJ)"
            value={form.dateLimite}
            onChangeText={t => setForm({ ...form, dateLimite: t })}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Bonus prévu si atteint"
            value={form.bonusPrevu}
            onChangeText={t => setForm({ ...form, bonusPrevu: t })}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <View style={styles.modalBtns}>
            <Button
              mode="outlined"
              onPress={() => setShowModal(false)}
              style={{ flex: 1, marginRight: 8 }}
            >
              {tr('annuler', lang)}
            </Button>
            <Button
              mode="contained"
              onPress={enregistrer}
              loading={saving}
              disabled={saving}
              style={{ flex: 1 }}
            >
              {tr('enregistrer', lang)}
            </Button>
          </View>
        </Modal>

        {/* Modal détails avancement */}
        <Modal
          visible={showDetails}
          onDismiss={() => { setShowDetails(false); setSelected(null); setAvancement(null); }}
          contentContainerStyle={styles.modal}
        >
          {selected && (
            <>
              <Text variant="titleLarge" style={styles.modalTitle}>
                {selected.fournisseurNom}
              </Text>
              <Text style={styles.sub}>{selected.description}</Text>

              <View style={[styles.badge, { alignSelf: 'flex-start', marginBottom: 10, backgroundColor: STATUT_COLOR[selected.statut] + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUT_COLOR[selected.statut] }]}>
                  {STATUT_LABEL[selected.statut] || selected.statut}
                </Text>
              </View>

              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(selected.pourcentage || 0, 100)}%` as any,
                      backgroundColor: couleurProgression(selected.pourcentage || 0),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progPct, { color: couleurProgression(selected.pourcentage || 0), marginBottom: 12 }]}>
                {(selected.pourcentage || 0).toFixed(1)}% — {selected.montantActuel?.toLocaleString('fr-FR')} / {selected.montantCible?.toLocaleString('fr-FR')} FCFA
              </Text>

              <Divider style={{ marginBottom: 10 }} />

              {loadingAv ? (
                <ActivityIndicator />
              ) : avancement ? (
                <>
                  <Text style={styles.detailLine}>
                    Achats liés : {avancement.nombreAchats ?? '—'}
                  </Text>
                  {avancement.derniersAchats?.length > 0 && (
                    <>
                      <Text style={[styles.sub, { marginTop: 6 }]}>Derniers achats :</Text>
                      {avancement.derniersAchats.slice(0, 5).map((a: any, i: number) => (
                        <View key={i} style={styles.row}>
                          <Text style={styles.date}>
                            {a.date ? new Date(a.date).toLocaleDateString('fr-FR') : '—'}
                          </Text>
                          <Text style={styles.bold}>{a.montant?.toLocaleString('fr-FR')} FCFA</Text>
                        </View>
                      ))}
                    </>
                  )}
                  {selected.bonusAccorde ? (
                    <Text style={[styles.bonusOk, { marginTop: 8 }]}>
                      Bonus accordé : {selected.bonusAccorde.toLocaleString('fr-FR')} FCFA
                    </Text>
                  ) : selected.bonusPrevu ? (
                    <Text style={[styles.bonusPrevu, { marginTop: 8 }]}>
                      Bonus prévu : {selected.bonusPrevu.toLocaleString('fr-FR')} FCFA
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.empty}>Aucun avancement disponible</Text>
              )}

              <Button
                mode="outlined"
                onPress={() => { setShowDetails(false); setSelected(null); setAvancement(null); }}
                style={{ marginTop: 16 }}
              >
                {tr('fermer', lang)}
              </Button>
            </>
          )}
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Bannière stats
  banner: {
    flexDirection: 'row',
    backgroundColor: '#1a56db',
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bannerItem: { alignItems: 'center', flex: 1 },
  bannerVal: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  bannerLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, textAlign: 'center' },
  bannerSep: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Cards
  card: { marginBottom: 10, borderRadius: 12 },
  fournisseurNom: { fontWeight: 'bold', flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center' },

  // Badge statut
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: 'bold' },

  // Barre de progression
  progressBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginTop: 10,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    minWidth: 4,
  },
  progLabel: { color: '#666', fontSize: 11 },
  progPct: { fontWeight: 'bold', fontSize: 13 },

  // Divers
  sub: { color: '#666', fontSize: 12, marginTop: 2 },
  date: { color: '#aaa', fontSize: 11 },
  bold: { fontWeight: 'bold', fontSize: 13 },
  bonusOk: { color: '#4caf50', fontWeight: 'bold', fontSize: 12 },
  bonusPrevu: { color: '#ff9800', fontSize: 12 },
  detailLine: { fontSize: 14, marginBottom: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 20 },

  // Modals
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontWeight: 'bold', marginBottom: 14, color: '#1a56db' },
  modalBtns: { flexDirection: 'row', marginTop: 8 },
  input: { marginBottom: 10 },
});
