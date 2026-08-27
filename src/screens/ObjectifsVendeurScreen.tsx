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
import api, { getVendeurs } from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useMontantInput } from '../components/MontantInput';

// Modèle réel (ObjectifVendeurController/Dto) : une PRIME HEBDOMADAIRE pour un
// vendeur — semaine ISO-8601 (1 à 53) + année, objectif de nombre de ventes,
// bonus FIXE en FCFA versé si l'objectif est atteint. Module totalement séparé
// du paiement de salaire (PaiementsEmployeScreen) : "valider" ne fait que
// marquer un flag admin, ça ne déclenche AUCUN paiement automatique ni écriture
// stock (contrairement au bonus fournisseur, qui ajoute au stock). Tout ce qui
// est calculé (nombreVentesAtteint, statut) vient du backend à chaque lecture —
// on ne l'envoie jamais dans le payload POST/PUT.
interface ObjectifVendeur {
  id: number;
  vendeurId: number;
  vendeurNom: string;
  semaine: number;
  annee: number;
  objectifNombreVentes: number;
  bonusMontant: number;
  nombreVentesAtteint: number;
  statut: 'ATTEINT' | 'NON_ATTEINT';
  bonusValide: boolean;
  observation?: string;
  dateValidation?: string;
  dateCreation: string;
}

interface VendeurLite { id: number; nom: string }

const STATUT_LABEL: Record<string, string> = {
  ATTEINT: 'Atteint',
  NON_ATTEINT: 'Non atteint',
};

const STATUT_COLOR: Record<string, string> = {
  ATTEINT: '#4caf50',
  NON_ATTEINT: '#e53935',
};

function couleurProgression(pct: number): string {
  if (pct >= 80) return '#4caf50';
  if (pct >= 50) return '#ff9800';
  return '#e53935';
}

const money = (v: number) => `${Math.round(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`;

function semaineISOCourante(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const FORM_INITIAL = {
  vendeurId: 0,
  semaine: semaineISOCourante(new Date()),
  annee: new Date().getFullYear(),
  objectifNombreVentes: '',
  bonusMontant: 0,
  observation: '',
};

export default function ObjectifsVendeurScreen() {
  const { lang } = useLang();
  const [objectifs, setObjectifs] = useState<ObjectifVendeur[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const [vendeurs, setVendeurs] = useState<VendeurLite[]>([]);

  // Modal ajout/modification
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ObjectifVendeur | null>(null);
  const [form, setForm] = useState({ ...FORM_INITIAL });
  const bonusMontantInput = useMontantInput(form.bonusMontant, v => setForm(f => ({ ...f, bonusMontant: v })));
  const [vendeurSearch, setVendeurSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal détails
  const [selected, setSelected] = useState<ObjectifVendeur | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/objectifs-vendeur');
      const liste = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setObjectifs(liste);
      setFromCache(false);
      sauvegarderCache('objectifs_vendeur', liste).catch(() => {});
    } catch {
      const cached = await lireCache<ObjectifVendeur>('objectifs_vendeur');
      if (cached.length > 0) { setObjectifs(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    charger();
    getVendeurs().then(res => {
      const liste = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setVendeurs(
        liste
          .filter((v: any) => v.role === 'VENDEUR' || v.role === 'ADMIN')
          .map((v: any) => ({ id: v.id, nom: v.nomComplet || v.nom || v.username }))
      );
    }).catch(() => {});
  }, []);

  const nbActifs = objectifs.filter(o => o.statut === 'NON_ATTEINT').length;
  const totalBonusValide = objectifs.filter(o => o.bonusValide).reduce((s, o) => s + (o.bonusMontant || 0), 0);
  const nbAtteints = objectifs.filter(o => o.statut === 'ATTEINT').length;

  const ouvrirCreation = () => {
    setEditing(null);
    setForm({ ...FORM_INITIAL });
    setVendeurSearch('');
    setShowModal(true);
  };

  const ouvrirModif = (o: ObjectifVendeur) => {
    setEditing(o);
    setForm({
      vendeurId: o.vendeurId,
      semaine: o.semaine,
      annee: o.annee,
      objectifNombreVentes: String(o.objectifNombreVentes),
      bonusMontant: o.bonusMontant || 0,
      observation: o.observation || '',
    });
    setVendeurSearch(o.vendeurNom);
    setShowModal(true);
  };

  const ouvrir = (o: ObjectifVendeur) => {
    setSelected(o);
    setShowDetails(true);
  };

  const supprimer = (o: ObjectifVendeur) => {
    if (o.bonusValide) {
      Alert.alert(tr('erreur', lang), 'Impossible de supprimer une prime déjà validée');
      return;
    }
    Alert.alert('Confirmer', 'Supprimer cette prime ?', [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await executerOuMettreEnFile('objectif_vendeur_delete', { id: o.id }, () => api.delete(`/objectifs-vendeur/${o.id}`));
            charger();
          } catch (err: any) {
            Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const enregistrer = async () => {
    if (!form.vendeurId) {
      Alert.alert(tr('erreur', lang), 'Sélectionnez un vendeur');
      return;
    }
    if (!form.semaine || form.semaine < 1 || form.semaine > 53) {
      Alert.alert(tr('erreur', lang), 'La semaine doit être comprise entre 1 et 53');
      return;
    }
    if (!form.annee) {
      Alert.alert(tr('erreur', lang), "L'année est invalide");
      return;
    }
    const objectifNombreVentes = parseFloat(form.objectifNombreVentes);
    if (!objectifNombreVentes || objectifNombreVentes <= 0) {
      Alert.alert(tr('erreur', lang), "L'objectif de ventes doit être supérieur à 0");
      return;
    }
    const bonusMontant = form.bonusMontant;
    if (bonusMontant === undefined || isNaN(bonusMontant) || bonusMontant < 0) {
      Alert.alert(tr('erreur', lang), 'Le montant du bonus est invalide');
      return;
    }
    setSaving(true);
    // ObjectifVendeurRequest : vendeurId, semaine, annee, objectifNombreVentes,
    // bonusMontant, observation? — jamais nombreVentesAtteint/statut, calculés
    // côté backend à chaque lecture.
    const payload = {
      vendeurId: form.vendeurId,
      semaine: form.semaine,
      annee: form.annee,
      objectifNombreVentes,
      bonusMontant,
      observation: form.observation.trim() || undefined,
    };
    try {
      if (editing) {
        await executerOuMettreEnFile('objectif_vendeur_update', { id: editing.id, data: payload }, () => api.put(`/objectifs-vendeur/${editing.id}`, payload));
      } else {
        await executerOuMettreEnFile('objectif_vendeur_create', payload, () => api.post('/objectifs-vendeur', payload));
      }
      setShowModal(false);
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.message || "Impossible d'enregistrer la prime");
    }
    setSaving(false);
  };

  const confirmerValider = (o: ObjectifVendeur) => {
    if (o.statut !== 'ATTEINT') {
      Alert.alert(tr('erreur', lang), 'Seules les primes atteintes peuvent être validées');
      return;
    }
    Alert.alert(
      'Valider la prime ?',
      `${o.vendeurNom} a atteint son objectif de ${o.objectifNombreVentes} ventes (semaine ${o.semaine}/${o.annee}). Le bonus de ${money(o.bonusMontant)} sera marqué comme validé (aucun paiement automatique).`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await api.patch(`/objectifs-vendeur/${o.id}/valider`, {});
              setShowDetails(false);
              charger();
              Alert.alert('✅ Prime validée', `Le bonus de ${money(o.bonusMontant)} pour ${o.vendeurNom} a été marqué comme validé.`);
            } catch (err: any) {
              Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Validation impossible');
            }
          },
        },
      ],
    );
  };

  const vendeursFiltres = vendeurSearch.trim()
    ? vendeurs.filter(v => v.nom.toLowerCase().includes(vendeurSearch.toLowerCase())).slice(0, 15)
    : [];

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      {/* Bannière stats */}
      <View style={styles.banner}>
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{nbActifs}</Text>
          <Text style={styles.bannerLabel}>En cours</Text>
        </View>
        <View style={styles.bannerSep} />
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{totalBonusValide.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</Text>
          <Text style={styles.bannerLabel}>Primes validées (FCFA)</Text>
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
          <Text style={styles.empty}>Aucune prime enregistrée</Text>
        }
        renderItem={({ item }) => {
          const pct = item.objectifNombreVentes > 0
            ? Math.min(Math.round((item.nombreVentesAtteint / item.objectifNombreVentes) * 100), 100)
            : 0;
          const couleur = couleurProgression(pct);
          return (
            <TouchableOpacity onPress={() => ouvrir(item)}>
              <Card style={styles.card}>
                <Card.Content>
                  {/* Ligne titre + statut + supprimer */}
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={styles.vendeurNom}>
                        {item.vendeurNom}
                      </Text>
                      <Text style={styles.sub}>Semaine {item.semaine}/{item.annee}</Text>
                    </View>
                    <View style={styles.rowEnd}>
                      <View style={[styles.badge, { backgroundColor: STATUT_COLOR[item.statut] + '22' }]}>
                        <Text style={[styles.badgeText, { color: STATUT_COLOR[item.statut] }]}>
                          {STATUT_LABEL[item.statut] || item.statut}
                        </Text>
                      </View>
                      {!item.bonusValide && (
                        <IconButton
                          icon="pencil-outline"
                          size={18}
                          iconColor="#1a56db"
                          onPress={() => ouvrirModif(item)}
                        />
                      )}
                      <IconButton
                        icon="delete-outline"
                        size={18}
                        iconColor="#e53935"
                        onPress={() => supprimer(item)}
                      />
                    </View>
                  </View>

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
                      {item.nombreVentesAtteint?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} / {item.objectifNombreVentes?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} ventes
                    </Text>
                    <Text style={[styles.progPct, { color: couleur }]}>{pct}%</Text>
                  </View>

                  <Divider style={{ marginVertical: 6 }} />

                  <View style={styles.row}>
                    <Text style={styles.date}>Bonus : {money(item.bonusMontant)}</Text>
                    {item.bonusValide && (
                      <Text style={styles.bonusOk}>
                        Prime validée
                      </Text>
                    )}
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <FAB icon="plus" style={styles.fab} onPress={ouvrirCreation} />

      <Portal>
        {/* Modal ajout / modification */}
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>
            {editing ? 'Modifier la prime' : 'Nouvelle prime'}
          </Text>

          <Text style={styles.fieldLabel}>Vendeur *</Text>
          <TextInput
            value={vendeurSearch}
            onChangeText={t => { setVendeurSearch(t); setForm({ ...form, vendeurId: 0 }); }}
            mode="outlined"
            placeholder="Rechercher un vendeur..."
            style={styles.input}
          />
          {vendeursFiltres.length > 0 && !form.vendeurId && (
            <View style={styles.pickerList}>
              {vendeursFiltres.map(v => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.pickerItem}
                  onPress={() => { setForm({ ...form, vendeurId: v.id }); setVendeurSearch(v.nom); }}
                >
                  <Text style={styles.pickerItemText}>{v.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TextInput
            label="Semaine (1-53) *"
            value={String(form.semaine)}
            onChangeText={t => setForm({ ...form, semaine: parseInt(t) || form.semaine })}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Année *"
            value={String(form.annee)}
            onChangeText={t => setForm({ ...form, annee: parseInt(t) || form.annee })}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Objectif nombre de ventes *"
            value={form.objectifNombreVentes}
            onChangeText={t => setForm({ ...form, objectifNombreVentes: t })}
            mode="outlined"
            keyboardType="numeric"
            placeholder="ex: 1000"
            style={styles.input}
          />
          <TextInput
            label="Bonus (FCFA) *"
            value={bonusMontantInput.texte}
            onChangeText={bonusMontantInput.onChangeText}
            mode="outlined"
            keyboardType="numeric"
            placeholder="ex: 10000"
            style={styles.input}
          />
          <TextInput
            label={tr('description', lang)}
            value={form.observation}
            onChangeText={t => setForm({ ...form, observation: t })}
            mode="outlined"
            multiline
            style={styles.input}
          />

          <View style={styles.modalBtns}>
            <Button mode="outlined" onPress={() => setShowModal(false)} style={{ flex: 1, marginRight: 8 }}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" onPress={enregistrer} loading={saving} disabled={saving} style={{ flex: 1 }}>
              {tr('enregistrer', lang)}
            </Button>
          </View>
        </Modal>

        {/* Modal détails */}
        <Modal
          visible={showDetails}
          onDismiss={() => { setShowDetails(false); setSelected(null); }}
          contentContainerStyle={styles.modal}
        >
          {selected && (
            <>
              <Text variant="titleLarge" style={styles.modalTitle}>
                {selected.vendeurNom}
              </Text>
              <Text style={styles.sub}>Semaine {selected.semaine}/{selected.annee}</Text>

              <View style={[styles.badge, { alignSelf: 'flex-start', marginTop: 10, marginBottom: 10, backgroundColor: STATUT_COLOR[selected.statut] + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUT_COLOR[selected.statut] }]}>
                  {STATUT_LABEL[selected.statut] || selected.statut}
                </Text>
              </View>

              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${selected.objectifNombreVentes > 0 ? Math.min(Math.round((selected.nombreVentesAtteint / selected.objectifNombreVentes) * 100), 100) : 0}%` as any,
                      backgroundColor: couleurProgression(selected.objectifNombreVentes > 0 ? (selected.nombreVentesAtteint / selected.objectifNombreVentes) * 100 : 0),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progPct, { marginBottom: 12 }]}>
                {selected.nombreVentesAtteint?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} / {selected.objectifNombreVentes?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} ventes
              </Text>

              <Divider style={{ marginBottom: 10 }} />

              <Text style={styles.detailLine}>Bonus : {money(selected.bonusMontant)}</Text>
              {!!selected.observation && <Text style={[styles.sub, { marginTop: 6 }]}>{selected.observation}</Text>}

              {selected.bonusValide ? (
                <Text style={[styles.bonusOk, { marginTop: 8 }]}>
                  ✅ Prime déjà validée{selected.dateValidation ? ` le ${new Date(selected.dateValidation).toLocaleDateString('fr-FR')}` : ''}
                </Text>
              ) : selected.statut === 'ATTEINT' ? (
                <Button
                  mode="contained"
                  onPress={() => confirmerValider(selected)}
                  style={{ marginTop: 12, backgroundColor: '#4caf50' }}
                >
                  Valider la prime
                </Button>
              ) : null}

              <Button
                mode="outlined"
                onPress={() => { setShowDetails(false); setSelected(null); }}
                style={{ marginTop: 10 }}
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
  card: { marginBottom: 10, borderRadius: 16 },
  vendeurNom: { fontWeight: 'bold' },
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
  bonusOk: { color: '#4caf50', fontWeight: 'bold', fontSize: 12 },
  detailLine: { fontSize: 14, marginBottom: 4 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },

  // FAB
  fab: { position: 'absolute', bottom: 20, right: 20 },

  // Modals
  modal: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontWeight: 'bold', marginBottom: 14, color: '#1a56db' },
  modalBtns: { flexDirection: 'row', marginTop: 8 },
  input: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4, marginTop: 4 },

  // Picker vendeur
  pickerList: { maxHeight: 150, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, marginBottom: 10 },
  pickerItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 13, color: '#1e293b' },
});
