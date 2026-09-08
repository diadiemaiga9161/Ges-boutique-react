import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Modal } from 'react-native';
import { Text, ActivityIndicator, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api.service';
import { getJournalAudit, libelleActionAudit, JournalAuditEntree } from '../services/journalAudit.service';
import { useAuth } from '../hooks/useAuth';
import { useColors } from '../theme/colors';

// ─── Écran Journal d'audit — réservé ADMIN (403 côté backend pour un vendeur,
// lien déjà masqué côté menu/tiroir — voir DrawerContent.tsx/MenuScreen.tsx).
// Pas de bouton impression/export ici (couvert par l'écran Export, séparé).
// Pagination SERVEUR : page/size/totalPages/totalElements viennent tous du
// backend, on ne pagine jamais côté client.

interface UtilisateurLite { id: number; nomComplet: string; username?: string }

const PAGE_SIZE = 20;

// Par défaut, l'écran affiche les actions du jour même (pas tout l'historique).
// Pour voir un autre jour ou un autre utilisateur, on change le filtre.
function todayStr(): string {
  const now = new Date();
  const mois = String(now.getMonth() + 1).padStart(2, '0');
  const jour = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mois}-${jour}`;
}

function formatDateHeure(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR')} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso; }
}

// Réponse enveloppée {data: [...]} ou {utilisateurs:[...]} ou tableau brut —
// même tolérance que les autres écrans (VendeursScreen, DettesAnciennesScreen).
function extractUsers(payload: any): UtilisateurLite[] {
  const raw = Array.isArray(payload) ? payload
    : Array.isArray(payload?.data) ? payload.data
    : Array.isArray(payload?.utilisateurs) ? payload.utilisateurs
    : [];
  return raw.map((u: any) => ({ id: u.id, nomComplet: u.nomComplet || u.username || `#${u.id}`, username: u.username }));
}

export default function JournalAuditScreen() {
  const { user, loading: authLoading } = useAuth();
  const colors = useColors();
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState('');
  const [journaux, setJournaux] = useState<JournalAuditEntree[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const [showFiltres, setShowFiltres] = useState(false);
  const [dateDebut, setDateDebut] = useState(todayStr());
  const [dateFin, setDateFin] = useState(todayStr());
  const [utilisateurId, setUtilisateurId] = useState<number | undefined>(undefined);
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurLite[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const utilisateurSelectionne = utilisateurs.find(u => u.id === utilisateurId);

  const charger = useCallback(async (
    pageVoulue: number,
    dDebut: string,
    dFin: string,
    uid: number | undefined,
  ) => {
    setErreur('');
    try {
      const res = await getJournalAudit({
        page: pageVoulue,
        size: PAGE_SIZE,
        dateDebut: dDebut || undefined,
        dateFin: dFin || undefined,
        utilisateurId: uid,
      });
      const data = res.data;
      setJournaux(Array.isArray(data?.journaux) ? data.journaux : []);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? 0);
      setPage(data?.page ?? pageVoulue);
    } catch {
      setErreur("Impossible de charger le journal d'audit.");
      setJournaux([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { setLoading(false); return; }
    charger(0, todayStr(), todayStr(), undefined);
    api.get('/utilisateurs').then(res => setUtilisateurs(extractUsers(res.data))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const appliquerFiltres = () => {
    setShowFiltres(false);
    setLoading(true);
    charger(0, dateDebut, dateFin, utilisateurId);
  };

  /** Revient à la vue par défaut (jour même, tous les utilisateurs), pas à un historique complet non filtré. */
  const reinitialiserFiltres = () => {
    setDateDebut(todayStr());
    setDateFin(todayStr());
    setUtilisateurId(undefined);
    setShowFiltres(false);
    setLoading(true);
    charger(0, todayStr(), todayStr(), undefined);
  };

  const changerPage = (nouvellePage: number) => {
    if (nouvellePage < 0 || (totalPages > 0 && nouvellePage >= totalPages)) return;
    setLoading(true);
    charger(nouvellePage, dateDebut, dateFin, utilisateurId);
  };

  const filtreActif = dateDebut !== todayStr() || dateFin !== todayStr() || !!utilisateurId;

  // ─── Accès réservé ADMIN ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (!isAdmin) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="lock-outline" size={56} color={colors.danger} />
        <Text style={[s.accesRefuseTxt, { color: colors.textSecondary }]}>
          Accès réservé aux administrateurs.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* ── Bandeau stats ──────────────────────────────────────────────── */}
      <View style={[s.hero, { backgroundColor: colors.hero }]}>
        <MaterialCommunityIcons name="clipboard-text-clock-outline" size={22} color="#fff" />
        <Text style={s.heroText}>{totalElements} action{totalElements > 1 ? 's' : ''} enregistrée{totalElements > 1 ? 's' : ''}</Text>
      </View>

      {/* ── Barre filtre ───────────────────────────────────────────────── */}
      <View style={[s.toolbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            s.filterBtn,
            { borderColor: colors.border, backgroundColor: colors.inputBg },
            (showFiltres || filtreActif) && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => setShowFiltres(v => !v)}
        >
          <MaterialCommunityIcons name="filter-variant" size={18} color={(showFiltres || filtreActif) ? '#fff' : colors.primary} />
          <Text style={[s.filterBtnText, { color: colors.text }, (showFiltres || filtreActif) && { color: '#fff' }]}>
            Filtrer{filtreActif ? ' (actif)' : ''}
          </Text>
        </TouchableOpacity>
        {filtreActif && (
          <TouchableOpacity onPress={reinitialiserFiltres} style={s.resetBtn}>
            <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.danger} />
            <Text style={[s.resetBtnText, { color: colors.danger }]}>Réinitialiser</Text>
          </TouchableOpacity>
        )}
      </View>

      {showFiltres && (
        <View style={[s.filtresPanel, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Période</Text>
          <View style={s.periodeRow}>
            <TextInput
              mode="outlined" dense style={s.dateInput}
              value={dateDebut} onChangeText={setDateDebut}
              placeholder="Du (AAAA-MM-JJ)"
            />
            <TextInput
              mode="outlined" dense style={s.dateInput}
              value={dateFin} onChangeText={setDateFin}
              placeholder="Au (AAAA-MM-JJ)"
            />
          </View>

          <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Utilisateur</Text>
          <TouchableOpacity style={[s.userSelect, { borderColor: colors.border, backgroundColor: colors.inputBg }]} onPress={() => setShowUserPicker(true)}>
            <Text style={[s.userSelectText, { color: colors.text }]}>
              {utilisateurSelectionne ? utilisateurSelectionne.nomComplet : 'Tous les utilisateurs'}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.applyBtn, { backgroundColor: colors.primary }]} onPress={appliquerFiltres}>
            <Text style={s.applyBtnText}>Appliquer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Liste ──────────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : erreur ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color={colors.danger} />
          <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>{erreur}</Text>
        </View>
      ) : (
        <FlatList
          data={journaux}
          keyExtractor={j => String(j.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); charger(page, dateDebut, dateFin, utilisateurId); }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ padding: 12, paddingBottom: 12 }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color={colors.textSecondary} />
              <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>Aucune action enregistrée</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={s.cardTop}>
                <Text style={[s.actionLabel, { color: colors.text }]} numberOfLines={2}>{libelleActionAudit(item.action)}</Text>
                <Text style={[s.dateText, { color: colors.textSecondary }]}>{formatDateHeure(item.dateAction)}</Text>
              </View>
              <Text style={[s.userText, { color: colors.primary }]}>Par {item.utilisateurNom || `#${item.utilisateurId}`}</Text>
              {!!item.details && <Text style={[s.detailsText, { color: colors.textSecondary }]}>{item.details}</Text>}
            </View>
          )}
        />
      )}

      {/* ── Pagination serveur ─────────────────────────────────────────── */}
      {!loading && !erreur && totalPages > 0 && (
        <View style={[s.pagination, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[s.pageBtn, page <= 0 && s.pageBtnDisabled]}
            disabled={page <= 0}
            onPress={() => changerPage(page - 1)}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={page <= 0 ? colors.placeholder : colors.primary} />
            <Text style={[s.pageBtnText, { color: page <= 0 ? colors.placeholder : colors.primary }]}>Précédent</Text>
          </TouchableOpacity>
          <Text style={[s.pageInfo, { color: colors.textSecondary }]}>Page {page + 1} / {totalPages}</Text>
          <TouchableOpacity
            style={[s.pageBtn, page >= totalPages - 1 && s.pageBtnDisabled]}
            disabled={page >= totalPages - 1}
            onPress={() => changerPage(page + 1)}
          >
            <Text style={[s.pageBtnText, { color: page >= totalPages - 1 ? colors.placeholder : colors.primary }]}>Suivant</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={page >= totalPages - 1 ? colors.placeholder : colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Sélecteur utilisateur ──────────────────────────────────────── */}
      <Modal visible={showUserPicker} animationType="slide" transparent onRequestClose={() => setShowUserPicker(false)}>
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]}>Choisir un utilisateur</Text>
              <TouchableOpacity onPress={() => setShowUserPicker(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: undefined as any, nomComplet: 'Tous les utilisateurs' }, ...utilisateurs]}
              keyExtractor={u => String(u.id ?? 'tous')}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.userOption, { borderBottomColor: colors.border }]}
                  onPress={() => { setUtilisateurId(item.id); setShowUserPicker(false); }}
                >
                  <Text style={[s.userOptionText, { color: colors.text }, utilisateurId === item.id && { color: colors.primary, fontWeight: '700' }]}>
                    {item.nomComplet}
                  </Text>
                  {utilisateurId === item.id && <MaterialCommunityIcons name="check" size={18} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  accesRefuseTxt: { fontSize: 15, textAlign: 'center' },

  hero: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, padding: 14,
  },
  heroText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1,
  },
  filterBtnText: { fontSize: 13, fontWeight: '600' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetBtnText: { fontSize: 12, fontWeight: '600' },

  filtresPanel: { padding: 12, borderBottomWidth: 1, gap: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  periodeRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1, height: 40 },
  userSelect: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
  },
  userSelectText: { fontSize: 13 },
  applyBtn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  applyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  card: {
    borderRadius: 14, padding: 12, marginBottom: 10,
    borderWidth: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  actionLabel: { fontWeight: '700', fontSize: 14, flex: 1 },
  dateText: { fontSize: 11, fontWeight: '500' },
  userText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  detailsText: { fontSize: 12.5, marginTop: 6, lineHeight: 18 },

  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  pagination: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, borderTopWidth: 1,
  },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 6 },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { fontSize: 13, fontWeight: '600' },
  pageInfo: { fontSize: 12, textAlign: 'center', flex: 1 },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16 },
  userOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1,
  },
  userOptionText: { fontSize: 14 },
});
