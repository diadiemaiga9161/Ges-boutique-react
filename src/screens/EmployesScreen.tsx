import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const STATUTS = ['ACTIF', 'INACTIF'];
const AVATAR_COLORS = ['#1e88e5', '#43a047', '#e53935', '#8e24aa', '#fb8c00', '#00acc1', '#d81b60'];

function money(v: number) { return (v || 0).toLocaleString('fr-FR') + ' FCFA'; }

function avatarColor(name: string) {
  const code = (name || 'X').charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

const FORM_INITIAL = {
  nom: '', prenom: '', poste: '', telephone: '', email: '',
  salaireMensuel: '', statut: 'ACTIF',
};

export default function EmployesScreen({ navigation }: any) {
  const { lang } = useLang();

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
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
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
      email: emp.email || '',
      salaireMensuel: emp.salaireMensuel != null ? String(emp.salaireMensuel) : '',
      statut: emp.statut || 'ACTIF',
    });
    setShowModal(true);
  };

  const sauvegarder = async () => {
    if (!form.nom.trim()) {
      Alert.alert(tr('erreur', lang), 'Le nom est obligatoire');
      return;
    }
    const payload = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim(),
      poste: form.poste.trim(),
      telephone: form.telephone.trim(),
      email: form.email.trim(),
      salaireMensuel: form.salaireMensuel ? parseFloat(form.salaireMensuel) : 0,
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
      await executerOuMettreEnFile('employe_toggle', { id: emp.id, actif }, () => api.patch(`/employes/${emp.id}/statut`, { actif }));
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

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#081648" />;

  return (
    <View style={styles.container}>
      {fromCache && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={{ color: '#92400e', fontSize: 12 }}>Mode hors ligne — données locales</Text>
        </View>
      )}
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{tr('employes', lang) || 'Employes'}</Text>
          <Text style={styles.headerSub}>{nbActifs} actif(s) · {employes.length} au total</Text>
        </View>
        <TouchableOpacity style={styles.headerAddBtn} onPress={ouvrirCreation}>
          <Text style={styles.headerAddText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* ── Barre de recherche ── */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un employe..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear}>
            <Text style={{ color: '#94a3b8', fontSize: 16 }}>✕</Text>
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
          <Text style={styles.empty}>{tr('aucun_resultat', lang)}</Text>
        }
        renderItem={({ item: emp }) => {
          const nomComplet = `${emp.prenom || ''} ${emp.nom || ''}`.trim() || '—';
          const initiale = (emp.prenom || emp.nom || '?')[0].toUpperCase();
          const isActif = emp.statut === 'ACTIF';

          return (
            <View style={styles.card}>
              {/* Haut de la carte */}
              <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: avatarColor(emp.nom || '?') }]}>
                  <Text style={styles.avatarText}>{initiale}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empNom}>{nomComplet}</Text>
                  {emp.poste ? <Text style={styles.empPoste}>{emp.poste}</Text> : null}
                  {emp.telephone ? <Text style={styles.empTel}>{emp.telephone}</Text> : null}
                  {emp.salaireMensuel ? (
                    <Text style={styles.empSalaire}>{money(emp.salaireMensuel)} / mois</Text>
                  ) : null}
                </View>
                <View style={[
                  styles.statutBadge,
                  { backgroundColor: isActif ? '#dcfce7' : '#f3f4f6' },
                ]}>
                  <Text style={[
                    styles.statutText,
                    { color: isActif ? '#16a34a' : '#6b7280' },
                  ]}>
                    {emp.statut || 'ACTIF'}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionOrange]}
                  onPress={() => ouvrirEdition(emp)}
                >
                  <Text style={[styles.actionBtnText, { color: '#c2410c' }]}>
                    {tr('modifier', lang)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isActif ? '#f0fdf4' : '#f9fafb' },
                  ]}
                  onPress={() => toggleStatut(emp)}
                >
                  <Text style={[
                    styles.actionBtnText,
                    { color: isActif ? '#16a34a' : '#6b7280' },
                  ]}>
                    {isActif ? 'Desactiver' : 'Activer'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBlue]}
                  onPress={() => navigation.navigate('PaiementsEmploye', { employe: emp })}
                >
                  <Text style={[styles.actionBtnText, { color: '#1d4ed8' }]}>Paiements</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionRed]}
                  onPress={() => confirmerSupprimer(emp)}
                >
                  <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>
                    {tr('supprimer', lang)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} onPress={ouvrirCreation}>
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing
                  ? `${tr('modifier', lang)} employe`
                  : `${tr('ajouter', lang)} employe`}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{tr('nom', lang)} *</Text>
              <TextInput
                style={styles.input}
                value={form.nom}
                onChangeText={t => setForm({ ...form, nom: t })}
                placeholder="Nom de famille"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>{tr('prenom', lang)}</Text>
              <TextInput
                style={styles.input}
                value={form.prenom}
                onChangeText={t => setForm({ ...form, prenom: t })}
                placeholder="Prenom"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>Poste</Text>
              <TextInput
                style={styles.input}
                value={form.poste}
                onChangeText={t => setForm({ ...form, poste: t })}
                placeholder="ex: Vendeur, Caissier..."
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>{tr('telephone', lang)}</Text>
              <TextInput
                style={styles.input}
                value={form.telephone}
                onChangeText={t => setForm({ ...form, telephone: t })}
                placeholder="+224..."
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>{tr('email', lang)}</Text>
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={t => setForm({ ...form, email: t })}
                placeholder="email@exemple.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.fieldLabel}>Salaire mensuel (FCFA)</Text>
              <TextInput
                style={styles.input}
                value={form.salaireMensuel}
                onChangeText={t => setForm({ ...form, salaireMensuel: t })}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Statut</Text>
              <View style={styles.statutRow}>
                {STATUTS.map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.statutBtn, form.statut === s && styles.statutBtnActive]}
                    onPress={() => setForm({ ...form, statut: s })}
                  >
                    <Text style={[
                      styles.statutBtnLabel,
                      form.statut === s && { color: '#fff' },
                    ]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.saveBtn} onPress={sauvegarder}>
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
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Header
  header: {
    backgroundColor: '#081648',
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
    backgroundColor: '#fff',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
  },
  searchInput: { flex: 1, height: 44, color: '#1e293b', fontSize: 14 },
  searchClear: { padding: 4 },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
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
  empNom: { fontWeight: '700', fontSize: 15, color: '#1e293b' },
  empPoste: { color: '#64748b', fontSize: 12, marginTop: 2 },
  empTel: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  empSalaire: { color: '#081648', fontSize: 12, fontWeight: '600', marginTop: 2 },
  statutBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statutText: { fontSize: 11, fontWeight: '700' },

  // Actions
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  actionOrange: { backgroundColor: '#fff7ed' },
  actionBlue: { backgroundColor: '#eff6ff' },
  actionRed: { backgroundColor: '#fef2f2' },

  // States
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },

  // FAB
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#081648',
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', lineHeight: 36 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%' as any,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalCloseBtn: { padding: 4 },
  modalCloseText: { fontSize: 18, color: '#94a3b8' },

  // Form
  fieldLabel: { color: '#475569', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#fafafa',
  },
  statutRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statutBtn: {
    flex: 1, padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  statutBtnActive: { backgroundColor: '#081648', borderColor: '#081648' },
  statutBtnLabel: { color: '#374151', fontSize: 13, fontWeight: '600' },
  saveBtn: {
    backgroundColor: '#081648',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
