import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { MontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';

const STATUTS = ['ACTIF', 'INACTIF'];
const AVATAR_COLORS = ['#1e88e5', '#43a047', '#e53935', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60'];

function money(v: number) { return (v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA'; }

function avatarColor(name: string) {
  const code = (name || 'X').charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

const FORM_INITIAL = {
  nom: '', prenom: '', poste: '', telephone: '',
  salaireMensuel: 0, statut: 'ACTIF',
};

export default function EmployesScreen({ navigation }: any) {
  const { lang } = useLang();
  const colors = useColors();

  const [employes, setEmployes] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...FORM_INITIAL });

  const charger = async () => {
    try {
      const res = await api.get('/employes');
      const data = res.data?.data || res.data || [];
      const liste = Array.isArray(data) ? data : [];
      setEmployes(liste);
      setFiltered(liste);
      setFromCache(false);
      sauvegarderCache('employes', liste).catch(() => {});
    } catch {
      const cached = await lireCache<any>('employes');
      if (cached.length > 0) { setEmployes(cached); setFiltered(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); }, []);

  useEffect(() => {
    if (!search.trim()) { setFiltered(employes); return; }
    const s = search.toLowerCase();
    setFiltered(
      employes.filter((e: any) =>
        `${e.prenom || ''} ${e.nom || ''}`.toLowerCase().includes(s) ||
        (e.poste || '').toLowerCase().includes(s),
      ),
    );
  }, [search, employes]);

  const ouvrirCreation = () => {
    setEditing(null);
    setForm({ ...FORM_INITIAL });
    setShowModal(true);
  };

  const ouvrirEdition = (emp: any) => {
    setEditing(emp);
    setForm({
      nom: emp.nom || '',
      prenom: emp.prenom || '',
      poste: emp.poste || '',
      telephone: emp.telephone || '',
      salaireMensuel: emp.salaireMensuel != null ? emp.salaireMensuel : 0,
      statut: emp.statut || 'ACTIF',
    });
    setShowModal(true);
  };

  const sauvegarder = async () => {
    if (!form.nom.trim()) {
      Alert.alert(tr('erreur', lang), 'Le nom est obligatoire');
      return;
    }
    // Même règle que saveEmploye() côté Ionic (resources.page.ts) : le poste
    // est obligatoire, pas seulement le nom.
    if (!form.poste.trim()) {
      Alert.alert(tr('erreur', lang), 'Le poste est obligatoire');
      return;
    }
    const payload = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      poste: form.poste.trim(),
      telephone: form.telephone.trim(),
      salaireMensuel: form.salaireMensuel || 0,
      statut: form.statut,
    };
    try {
      if (editing) {
        await executerOuMettreEnFile('employe_update', { id: editing.id, data: payload }, () => api.put(`/employes/${editing.id}`, payload));
      } else {
        await executerOuMettreEnFile('employe_create', payload, () => api.post('/employes', payload));
      }
      setShowModal(false);
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Erreur serveur');
    }
  };

  const toggleStatut = async (emp: any) => {
    const actif = emp.statut !== 'ACTIF';
    try {
      await executerOuMettreEnFile('employe_toggle', { id: emp.id, actif }, () => api.patch(`/employes/${emp.id}/${actif ? 'activer' : 'desactiver'}`));
      charger();
    } catch (err: any) {
      Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Erreur serveur');
    }
  };

  const confirmerSupprimer = (emp: any) => {
    const nom = `${emp.prenom || ''} ${emp.nom || ''}`.trim() || '—';
    Alert.alert(
      `${tr('supprimer', lang)} ?`,
      nom,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang),
          style: 'destructive',
          onPress: async () => {
            try {
              await executerOuMettreEnFile('employe_delete', { id: emp.id }, () => api.delete(`/employes/${emp.id}`));
              charger();
            } catch (err: any) {
              Alert.alert(tr('erreur', lang), err.response?.data?.message || 'Erreur serveur');
            }
          },
        },
      ],
    );
  };

  const nbActifs = employes.filter(e => e.statut === 'ACTIF').length;

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} size="large" color={colors.primary} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.hero }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{tr('employes', lang) || 'Employes'}</Text>
          <Text style={styles.headerSub}>{nbActifs} actif(s) · {employes.length} au total</Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={ouvrirCreation}>
          <Text style={styles.headerAddText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Rechercher un employe..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.placeholder}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
            <Text style={{ color: colors.placeholder, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={filtered}
        keyExtractor={emp => String(emp.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.placeholder} />
            <Text style={[styles.empty, { color: colors.textSecondary }]}>{tr('aucun_resultat', lang)}</Text>
          </View>
        }
        renderItem={({ item: emp }) => {
          const nomComplet = `${emp.prenom || ''} ${emp.nom || ''}`.trim() || '—';
          const initiale = (emp.prenom || emp.nom || '?')[0].toUpperCase();
          const isActif = emp.statut === 'ACTIF';

          return (
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              {/* Haut de la carte */}
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(emp.nom || '?') }]}>
                  <Text style={styles.avatarText}>{initiale}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.empNom, { color: colors.text }]}>{nomComplet}</Text>
                  {emp.poste ? <Text style={[styles.empPoste, { color: colors.textSecondary }]}>{emp.poste}</Text> : null}
                  {emp.telephone ? <Text style={[styles.empTel, { color: colors.placeholder }]}>{emp.telephone}</Text> : null}
                  {emp.salaireMensuel ? (
                    <Text style={[styles.empSalaire, { color: colors.primary }]}>{money(emp.salaireMensuel)} / mois</Text>
                  ) : null}
                </View>
                <View style={[
                  styles.statutBadge,
                  { backgroundColor: isActif ? colors.successBg : colors.border },
                ]}>
                  <Text style={[
                    styles.statutText,
                    { color: isActif ? colors.success : colors.textSecondary },
                  ]}>
                    {emp.statut || 'ACTIF'}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.warningBg }]}
                  onPress={() => ouvrirEdition(emp)}
                >
                  <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                    {tr('modifier', lang)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isActif ? colors.successBg : colors.border },
                  ]}
                  onPress={() => toggleStatut(emp)}
                >
                  <Text style={[
                    styles.actionBtnText,
                    { color: isActif ? colors.success : colors.textSecondary },
                  ]}>
                    {isActif ? 'Desactiver' : 'Activer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.infoBg }]}
                  onPress={() => navigation.navigate('PaiementsEmploye', { employe: emp })}
                >
                  <Text style={[styles.actionBtnText, { color: colors.info }]}>Paiements</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.dangerBg }]}
                  onPress={() => confirmerSupprimer(emp)}
                >
                  <Text style={[styles.actionBtnText, { color: colors.danger }]}>
                    {tr('supprimer', lang)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.hero }]} onPress={ouvrirCreation}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* ── Modal Ajouter / Modifier ── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 12 }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editing
                  ? `${tr('modifier', lang)} employe`
                  : `${tr('ajouter', lang)} employe`}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{tr('nom', lang)} *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={form.nom}
                onChangeText={t => setForm({ ...form, nom: t })}
                placeholder="Nom de famille"
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{tr('prenom', lang)}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={form.prenom}
                onChangeText={t => setForm({ ...form, prenom: t })}
                placeholder="Prenom"
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Poste</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={form.poste}
                onChangeText={t => setForm({ ...form, poste: t })}
                placeholder="ex: Vendeur, Caissier..."
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{tr('telephone', lang)}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={form.telephone}
                onChangeText={t => setForm({ ...form, telephone: t })}
                placeholder="+224..."
                placeholderTextColor={colors.placeholder}
                keyboardType="phone-pad"
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Salaire mensuel (FCFA)</Text>
              <MontantInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={form.salaireMensuel}
                onChangeValue={v => setForm({ ...form, salaireMensuel: v })}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Statut</Text>
              <View style={styles.statutRow}>
                {STATUTS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statutBtn,
                      { borderColor: colors.border },
                      form.statut === s && { backgroundColor: colors.hero, borderColor: colors.hero },
                    ]}
                    onPress={() => setForm({ ...form, statut: s })}
                  >
                    <Text style={[
                      styles.statutBtnLabel,
                      { color: colors.textSecondary },
                      form.statut === s && { color: '#fff' },
                    ]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.hero }]} onPress={sauvegarder}>
                <Text style={styles.saveBtnText}>{tr('enregistrer', lang)}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerTitle: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  headerAddBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerAddText: { color: '#fff', fontSize: 26, fontWeight: 'bold', lineHeight: 32 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  searchInput: { flex: 1, height: 44, fontSize: 14 },
  searchClear: { padding: 4 },

  // Card
  card: {
    borderRadius: 16,
    marginBottom: 10,
    padding: 14,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  empNom: { fontWeight: '700', fontSize: 15 },
  empPoste: { fontSize: 12, marginTop: 2 },
  empTel: { fontSize: 12, marginTop: 1 },
  empSalaire: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statutBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statutText: { fontSize: 11, fontWeight: '700' },

  // Actions
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },

  // States
  emptyWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', fontSize: 14 },

  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', lineHeight: 36 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%' as any,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18 },

  // Form
  fieldLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  statutRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statutBtn: {
    flex: 1, padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  statutBtnLabel: { fontSize: 13, fontWeight: '600' },
  saveBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
