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
import api, { getFournisseurs, getProduits } from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useMontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';

// Modèle réel (ObjectifFournisseurController/Dto) : un objectif est un
// QUANTITATIF d'achat (objectifQuantite unités, sur un fournisseur+mois/année,
// optionnellement lié à un produit précis) avec un bonus par unité — PAS un
// "montant cible" en FCFA avec date limite comme une version précédente de cet
// écran l'implémentait (endpoints /avancement, montantCible, dateLimite
// inexistants côté backend). Voir objectif-fournisseur.service.ts (Ionic).
interface ObjectifFournisseur {
  id: number;
  fournisseurId: number;
  fournisseurNom: string;
  produitId?: number;
  produitNom?: string;
  mois: number;
  annee: number;
  objectifQuantite: number;
  bonusParUnite: number;
  quantiteAtteinte: number;
  bonusCalcule: number;
  quantiteBonusRecue: number;
  statut: 'ATTEINT' | 'NON_ATTEINT';
  observation?: string;
  stockAjoute: boolean;
  dateValidation?: string;
  dateCreation: string;
}

interface FournisseurLite { id: number; nom: string }
interface ProduitLite { id: number; nom: string }

const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

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

const FORM_INITIAL = {
  fournisseurId: 0,
  produitId: undefined as number | undefined,
  mois: new Date().getMonth() + 1,
  annee: new Date().getFullYear(),
  objectifQuantite: '',
  bonusParUnite: 0,
  quantiteBonusRecue: '',
  observation: '',
};

export default function ObjectifsFournisseurScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const [objectifs, setObjectifs] = useState<ObjectifFournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const [fournisseurs, setFournisseurs] = useState<FournisseurLite[]>([]);
  const [produits, setProduits] = useState<ProduitLite[]>([]);

  // Modal ajout/modification
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ObjectifFournisseur | null>(null);
  const [form, setForm] = useState({ ...FORM_INITIAL });
  const bonusParUniteInput = useMontantInput(form.bonusParUnite, v => setForm(f => ({ ...f, bonusParUnite: v })));
  const [fournisseurSearch, setFournisseurSearch] = useState('');
  const [produitSearch, setProduitSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal détails
  const [selected, setSelected] = useState<ObjectifFournisseur | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const charger = async () => {
    try {
      const res = await api.get('/objectifs-fournisseur');
      const liste = Array.isArray(res.data) ? res.data : (res.data?.data || []);
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

  useEffect(() => {
    charger();
    getFournisseurs().then(res => {
      const liste = res.data?.data || res.data?.fournisseurs || (Array.isArray(res.data) ? res.data : []);
      setFournisseurs(liste.map((f: any) => ({ id: f.id, nom: f.nom })));
    }).catch(() => {});
    getProduits().then(res => {
      const liste = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setProduits(liste.map((p: any) => ({ id: p.id, nom: p.nom })));
    }).catch(() => {});
  }, []);

  const nbActifs = objectifs.filter(o => o.statut === 'NON_ATTEINT').length;
  const totalBonus = objectifs.reduce((s, o) => s + (o.bonusCalcule || 0), 0);
  const nbAtteints = objectifs.filter(o => o.statut === 'ATTEINT').length;

  const ouvrirCreation = () => {
    setEditing(null);
    setForm({ ...FORM_INITIAL });
    setFournisseurSearch('');
    setProduitSearch('');
    setShowModal(true);
  };

  const ouvrirModif = (o: ObjectifFournisseur) => {
    setEditing(o);
    setForm({
      fournisseurId: o.fournisseurId,
      produitId: o.produitId,
      mois: o.mois,
      annee: o.annee,
      objectifQuantite: String(o.objectifQuantite),
      bonusParUnite: o.bonusParUnite || 0,
      quantiteBonusRecue: o.quantiteBonusRecue ? String(o.quantiteBonusRecue) : '',
      observation: o.observation || '',
    });
    setFournisseurSearch(o.fournisseurNom);
    setProduitSearch(o.produitNom || '');
    setShowModal(true);
  };

  const ouvrir = (o: ObjectifFournisseur) => {
    setSelected(o);
    setShowDetails(true);
  };

  const supprimer = (o: ObjectifFournisseur) => {
    if (o.stockAjoute) {
      Alert.alert(tr('erreur', lang), 'Impossible de supprimer un objectif déjà validé (stock ajouté)');
      return;
    }
    Alert.alert('Confirmer', 'Supprimer cet objectif ?', [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await executerOuMettreEnFile('objectif_delete', { id: o.id }, () => api.delete(`/objectifs-fournisseur/${o.id}`));
            charger();
          } catch (err: any) {
            Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const enregistrer = async () => {
    if (!form.fournisseurId) {
      Alert.alert(tr('erreur', lang), 'Sélectionnez un fournisseur');
      return;
    }
    const objectifQuantite = parseFloat(form.objectifQuantite);
    if (!objectifQuantite || objectifQuantite <= 0) {
      Alert.alert(tr('erreur', lang), "L'objectif de quantité doit être supérieur à 0");
      return;
    }
    const bonusParUnite = form.bonusParUnite;
    if (bonusParUnite === undefined || isNaN(bonusParUnite) || bonusParUnite < 0) {
      Alert.alert(tr('erreur', lang), 'Le bonus par unité est invalide');
      return;
    }
    setSaving(true);
    // ObjectifFournisseurRequest : fournisseurId, produitId?, mois, annee,
    // objectifQuantite, bonusParUnite, quantiteAtteinte?, quantiteBonusRecue?, observation?
    const payload = {
      fournisseurId: form.fournisseurId,
      produitId: form.produitId,
      mois: form.mois,
      annee: form.annee,
      objectifQuantite,
      bonusParUnite,
      quantiteAtteinte: editing?.quantiteAtteinte || 0,
      quantiteBonusRecue: form.quantiteBonusRecue ? parseFloat(form.quantiteBonusRecue) : 0,
      observation: form.observation.trim() || undefined,
    };
    try {
      const res = editing
        ? await executerOuMettreEnFile('objectif_update', { id: editing.id, data: payload }, () => api.put(`/objectifs-fournisseur/${editing.id}`, payload))
        : await executerOuMettreEnFile('objectif_create', payload, () => api.post('/objectifs-fournisseur', payload));
      setShowModal(false);
      charger();
      // Comme Ionic (alertObjectifAtteint) : si l'objectif vient de passer ATTEINT
      // suite à cet enregistrement, on propose immédiatement de valider le bonus
      // (ajout au stock) plutôt que de laisser l'utilisateur le découvrir plus tard.
      const objectifSauvegarde = (res as any)?.result?.data;
      if (!res.offline && objectifSauvegarde?.statut === 'ATTEINT') {
        Alert.alert(
          '🎯 Objectif atteint !',
          `${objectifSauvegarde.fournisseurNom} — ${MOIS_LABELS[objectifSauvegarde.mois]} ${objectifSauvegarde.annee}\n\nVous pouvez valider pour ajouter les bonus au stock.`,
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Valider maintenant', onPress: () => confirmerValider(objectifSauvegarde) },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.message || "Impossible d'enregistrer l'objectif");
    }
    setSaving(false);
  };

  const confirmerValider = (o: ObjectifFournisseur) => {
    if (o.statut !== 'ATTEINT') {
      Alert.alert(tr('erreur', lang), 'Seuls les objectifs atteints peuvent être validés');
      return;
    }
    if (!o.produitId) {
      Alert.alert(tr('erreur', lang), 'Associez un produit avant de valider');
      return;
    }
    if (!o.quantiteBonusRecue || o.quantiteBonusRecue <= 0) {
      Alert.alert(tr('erreur', lang), 'Renseignez la quantité bonus reçue');
      return;
    }
    Alert.alert(
      'Valider le bonus ?',
      `${o.quantiteBonusRecue} unités de "${o.produitNom}" seront ajoutées au stock.`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await api.patch(`/objectifs-fournisseur/${o.id}/valider`, {});
              setShowDetails(false);
              charger();
              Alert.alert('✅ Stock mis à jour', `${o.quantiteBonusRecue} unité(s) de "${o.produitNom}" ajoutées au stock.`);
            } catch (err: any) {
              Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Validation impossible');
            }
          },
        },
      ],
    );
  };

  const fournisseursFiltres = fournisseurSearch.trim()
    ? fournisseurs.filter(f => f.nom.toLowerCase().includes(fournisseurSearch.toLowerCase())).slice(0, 15)
    : [];
  const produitsFiltres = produitSearch.trim()
    ? produits.filter(p => p.nom.toLowerCase().includes(produitSearch.toLowerCase())).slice(0, 15)
    : [];

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} size="large" color={colors.primary} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Bannière stats */}
      <View style={styles.banner}>
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{nbActifs}</Text>
          <Text style={styles.bannerLabel}>En cours</Text>
        </View>
        <View style={styles.bannerSep} />
        <View style={styles.bannerItem}>
          <Text style={styles.bannerVal}>{totalBonus.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</Text>
          <Text style={styles.bannerLabel}>Bonus calculés (FCFA)</Text>
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
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSecondary }]}>Aucun objectif enregistré</Text>
        }
        renderItem={({ item }) => {
          const pct = item.objectifQuantite > 0
            ? Math.min(Math.round((item.quantiteAtteinte / item.objectifQuantite) * 100), 100)
            : 0;
          const couleur = couleurProgression(pct);
          return (
            <TouchableOpacity onPress={() => ouvrir(item)}>
              <Card style={styles.card}>
                <Card.Content>
                  {/* Ligne titre + statut + supprimer */}
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleMedium" style={[styles.fournisseurNom, { color: colors.text }]}>
                        {item.fournisseurNom}
                      </Text>
                      <Text style={[styles.sub, { color: colors.textSecondary }]}>{MOIS_LABELS[item.mois]} {item.annee}{item.produitNom ? ` · ${item.produitNom}` : ''}</Text>
                    </View>
                    <View style={styles.rowEnd}>
                      <View style={[styles.badge, { backgroundColor: STATUT_COLOR[item.statut] + '22' }]}>
                        <Text style={[styles.badgeText, { color: STATUT_COLOR[item.statut] }]}>
                          {STATUT_LABEL[item.statut] || item.statut}
                        </Text>
                      </View>
                      {item.statut === 'ATTEINT' && !item.stockAjoute && (
                        <IconButton
                          icon="check-circle-outline"
                          size={18}
                          iconColor={colors.success}
                          onPress={() => confirmerValider(item)}
                        />
                      )}
                      {!item.stockAjoute && (
                        <IconButton
                          icon="pencil-outline"
                          size={18}
                          iconColor={colors.primary}
                          onPress={() => ouvrirModif(item)}
                        />
                      )}
                      {!item.stockAjoute && (
                        <IconButton
                          icon="delete-outline"
                          size={18}
                          iconColor={colors.danger}
                          onPress={() => supprimer(item)}
                        />
                      )}
                    </View>
                  </View>

                  {/* Barre de progression */}
                  <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct}%` as any, backgroundColor: couleur },
                      ]}
                    />
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.progLabel, { color: colors.textSecondary }]}>
                      {item.quantiteAtteinte?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} / {item.objectifQuantite?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} unités
                    </Text>
                    <Text style={[styles.progPct, { color: couleur }]}>{pct}%</Text>
                  </View>

                  <Divider style={{ marginVertical: 6 }} />

                  <View style={styles.row}>
                    <Text style={[styles.date, { color: colors.textSecondary }]}>Bonus/unité : {money(item.bonusParUnite)}</Text>
                    {item.stockAjoute ? (
                      <Text style={[styles.bonusOk, { color: colors.success }]}>
                        Stock ajouté : {item.quantiteBonusRecue} u.
                      </Text>
                    ) : item.quantiteBonusRecue ? (
                      <Text style={[styles.bonusPrevu, { color: colors.warning }]}>
                        Bonus reçu : {item.quantiteBonusRecue} u.
                      </Text>
                    ) : null}
                  </View>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <FAB icon="plus" style={[styles.fab, { backgroundColor: colors.primary }]} color="#fff" onPress={ouvrirCreation} />

      <Portal>
        {/* Modal ajout / modification */}
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.primary }]}>
            {editing ? 'Modifier l\'objectif' : 'Nouvel objectif'}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Fournisseur *</Text>
          <TextInput
            value={fournisseurSearch}
            onChangeText={t => { setFournisseurSearch(t); setForm({ ...form, fournisseurId: 0 }); }}
            mode="outlined"
            placeholder="Rechercher un fournisseur..."
            style={styles.input}
          />
          {fournisseursFiltres.length > 0 && !form.fournisseurId && (
            <View style={[styles.pickerList, { borderColor: colors.border }]}>
              {fournisseursFiltres.map(f => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setForm({ ...form, fournisseurId: f.id }); setFournisseurSearch(f.nom); }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{f.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Produit concerné (pour le bonus stock)</Text>
          <TextInput
            value={produitSearch}
            onChangeText={t => { setProduitSearch(t); setForm({ ...form, produitId: undefined }); }}
            mode="outlined"
            placeholder="Rechercher un produit..."
            style={styles.input}
          />
          {produitsFiltres.length > 0 && !form.produitId && (
            <View style={[styles.pickerList, { borderColor: colors.border }]}>
              {produitsFiltres.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setForm({ ...form, produitId: p.id }); setProduitSearch(p.nom); }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.text }]}>{p.nom}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.rowFields}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mois *</Text>
              <View style={styles.moisRow}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.moisChip, { borderColor: colors.border }, form.mois === m && [styles.moisChipActive, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
                    onPress={() => setForm({ ...form, mois: m })}
                  >
                    <Text style={[styles.moisChipText, { color: colors.textSecondary }, form.mois === m && { color: '#fff' }]}>{MOIS_LABELS[m].slice(0, 3)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <TextInput
            label="Année *"
            value={String(form.annee)}
            onChangeText={t => setForm({ ...form, annee: parseInt(t) || form.annee })}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label="Objectif quantité *"
            value={form.objectifQuantite}
            onChangeText={t => setForm({ ...form, objectifQuantite: t })}
            mode="outlined"
            keyboardType="numeric"
            placeholder="ex: 50000"
            style={styles.input}
          />
          <TextInput
            label="Bonus/unité (FCFA) *"
            value={bonusParUniteInput.texte}
            onChangeText={bonusParUniteInput.onChangeText}
            mode="outlined"
            keyboardType="numeric"
            placeholder="ex: 25"
            style={styles.input}
          />
          {editing && (
            <TextInput
              label="Quantité atteinte"
              value={String(editing.quantiteAtteinte)}
              mode="outlined"
              disabled
              style={styles.input}
            />
          )}
          <TextInput
            label="Quantité bonus reçue"
            value={form.quantiteBonusRecue}
            onChangeText={t => setForm({ ...form, quantiteBonusRecue: t })}
            mode="outlined"
            keyboardType="numeric"
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
            <Button mode="contained" onPress={enregistrer} loading={saving} disabled={saving} style={{ flex: 1 }} buttonColor={colors.primary}>
              {tr('enregistrer', lang)}
            </Button>
          </View>
        </Modal>

        {/* Modal détails */}
        <Modal
          visible={showDetails}
          onDismiss={() => { setShowDetails(false); setSelected(null); }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}
        >
          {selected && (
            <>
              <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.primary }]}>
                {selected.fournisseurNom}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>{MOIS_LABELS[selected.mois]} {selected.annee}{selected.produitNom ? ` · ${selected.produitNom}` : ' · Aucun produit lié'}</Text>

              <View style={[styles.badge, { alignSelf: 'flex-start', marginTop: 10, marginBottom: 10, backgroundColor: STATUT_COLOR[selected.statut] + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUT_COLOR[selected.statut] }]}>
                  {STATUT_LABEL[selected.statut] || selected.statut}
                </Text>
              </View>

              <View style={[styles.progressBg, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${selected.objectifQuantite > 0 ? Math.min(Math.round((selected.quantiteAtteinte / selected.objectifQuantite) * 100), 100) : 0}%` as any,
                      backgroundColor: couleurProgression(selected.objectifQuantite > 0 ? (selected.quantiteAtteinte / selected.objectifQuantite) * 100 : 0),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.progPct, { marginBottom: 12, color: colors.text }]}>
                {selected.quantiteAtteinte?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} / {selected.objectifQuantite?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} unités
              </Text>

              <Divider style={{ marginBottom: 10 }} />

              <Text style={[styles.detailLine, { color: colors.text }]}>Bonus par unité : {money(selected.bonusParUnite)}</Text>
              <Text style={[styles.detailLine, { color: colors.text }]}>Bonus calculé : {money(selected.bonusCalcule)}</Text>
              <Text style={[styles.detailLine, { color: colors.text }]}>Quantité bonus reçue : {selected.quantiteBonusRecue || 0}</Text>
              {!!selected.observation && <Text style={[styles.sub, { marginTop: 6, color: colors.textSecondary }]}>{selected.observation}</Text>}

              {selected.stockAjoute ? (
                <Text style={[styles.bonusOk, { marginTop: 8, color: colors.success }]}>
                  ✅ Stock déjà ajouté{selected.dateValidation ? ` le ${new Date(selected.dateValidation).toLocaleDateString('fr-FR')}` : ''}
                </Text>
              ) : (
                <Button
                  mode="contained"
                  onPress={() => confirmerValider(selected)}
                  style={{ marginTop: 12, backgroundColor: '#4caf50' }}
                >
                  Valider et ajouter au stock
                </Button>
              )}

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
  fournisseurNom: { fontWeight: 'bold' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowEnd: { flexDirection: 'row', alignItems: 'center' },
  rowFields: { marginBottom: 4 },

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
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { fontWeight: 'bold', marginBottom: 14, color: '#1a56db' },
  modalBtns: { flexDirection: 'row', marginTop: 8 },
  input: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 4, marginTop: 4 },

  // Picker fournisseur/produit
  pickerList: { maxHeight: 150, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, marginBottom: 10 },
  pickerItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 13, color: '#1e293b' },

  // Chips mois
  moisRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  moisChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: '#d1d5db' },
  moisChipActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  moisChipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
});
