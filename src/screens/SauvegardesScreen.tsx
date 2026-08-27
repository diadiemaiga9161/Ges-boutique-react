import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, ActivityIndicator, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';
import { getListe, declencher, telecharger, BackupInfo } from '../services/backup.service';

/**
 * Écran "Sauvegardes" (ADMIN uniquement) — sauvegarde automatique programmée
 * de la base de données. Liste les sauvegardes déjà générées côté serveur
 * (rotation automatique, pas de suppression manuelle possible ici), permet
 * d'en déclencher une nouvelle à la demande (mysqldump synchrone côté
 * serveur, peut prendre plusieurs secondes — bouton bloqué + spinner pendant
 * l'appel) et de télécharger/partager un fichier existant (voir
 * backup.service.ts — même mécanisme expo-file-system + expo-sharing que
 * ExportDonneesScreen).
 */

function formatDateHeure(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return `${d.toLocaleDateString('fr-FR')} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } catch { return iso; }
}

function formatTaille(octets?: number): string {
  if (octets == null || isNaN(octets)) return '—';
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(2)} Mo`;
}

export default function SauvegardesScreen() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useLang();
  const colors = useColors();
  const isAdmin = user?.role === 'ADMIN';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erreur, setErreur] = useState('');
  const [sauvegardes, setSauvegardes] = useState<BackupInfo[]>([]);
  const [declenchementEnCours, setDeclenchementEnCours] = useState(false);
  const [telechargementsEnCours, setTelechargementsEnCours] = useState<Record<string, boolean>>({});

  const charger = useCallback(async () => {
    setErreur('');
    try {
      const res = await getListe();
      setSauvegardes(Array.isArray(res?.sauvegardes) ? res.sauvegardes : []);
    } catch {
      setErreur(tr('backup_erreur', lang));
      setSauvegardes([]);
    }
    setLoading(false);
    setRefreshing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) { setLoading(false); return; }
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAdmin]);

  const confirmerSauvegarde = () => {
    Alert.alert(
      tr('backup_confirm_titre', lang),
      tr('backup_confirm_texte', lang),
      [
        { text: tr('annuler', lang), style: 'cancel' },
        { text: tr('oui', lang), onPress: lancerSauvegarde },
      ],
    );
  };

  const lancerSauvegarde = async () => {
    setDeclenchementEnCours(true);
    try {
      const res = await declencher();
      if (res.success) {
        Alert.alert(tr('succes', lang), res.message || tr('backup_succes', lang));
        await charger();
      } else {
        Alert.alert(tr('erreur', lang), res.message || tr('backup_erreur', lang));
      }
    } catch {
      Alert.alert(tr('erreur', lang), tr('backup_erreur', lang));
    }
    setDeclenchementEnCours(false);
  };

  const telechargerFichier = async (nomFichier: string) => {
    setTelechargementsEnCours(prev => ({ ...prev, [nomFichier]: true }));
    try {
      const res = await telecharger(nomFichier);
      if (!res.success) {
        Alert.alert(tr('erreur', lang), res.message || tr('backup_erreur', lang));
      }
    } catch {
      Alert.alert(tr('erreur', lang), tr('backup_erreur', lang));
    }
    setTelechargementsEnCours(prev => ({ ...prev, [nomFichier]: false }));
  };

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
          {tr('backup_admin_only', lang)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <View style={s.hero}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={26} color="#fff" />
        <Text style={s.heroTitle}>{tr('backup_titre', lang)}</Text>
        <Text style={s.heroSub}>{tr('backup_sous_titre', lang)}</Text>
      </View>

      {/* ── Bouton déclenchement ─────────────────────────────────────────── */}
      <View style={s.section}>
        <TouchableOpacity
          style={[s.btnSauvegarder, declenchementEnCours && { opacity: 0.6 }]}
          onPress={confirmerSauvegarde}
          disabled={declenchementEnCours}
        >
          {declenchementEnCours
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="cloud-upload" size={18} color="#fff" />
          }
          <Text style={s.btnSauvegarderText}>
            {declenchementEnCours ? tr('backup_en_cours', lang) : tr('backup_lancer', lang)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Liste des sauvegardes ────────────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{tr('backup_chargement', lang)}</Text>
        </View>
      ) : erreur ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="alert-circle-outline" size={40} color="#dc2626" />
          <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>{erreur}</Text>
        </View>
      ) : (
        <FlatList
          data={sauvegardes}
          keyExtractor={item => item.nomFichier}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />
          }
          ListEmptyComponent={
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="database-off-outline" size={44} color="#ccc" />
              <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>{tr('backup_liste_vide', lang)}</Text>
            </View>
          }
          renderItem={({ item }) => {
            const enCours = !!telechargementsEnCours[item.nomFichier];
            return (
              <Card style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Card.Content style={s.cardContent}>
                  <View style={s.cardInfo}>
                    <Text style={[s.nomFichier, { color: colors.text }]} numberOfLines={2}>{item.nomFichier}</Text>
                    <Text style={[s.metaLigne, { color: colors.textSecondary }]}>
                      {tr('backup_col_date', lang)} : {formatDateHeure(item.dateCreation)}
                    </Text>
                    <Text style={[s.metaLigne, { color: colors.textSecondary }]}>
                      {tr('backup_col_taille', lang)} : {formatTaille(item.tailleOctets)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[s.btnTelecharger, enCours && { opacity: 0.6 }]}
                    onPress={() => telechargerFichier(item.nomFichier)}
                    disabled={enCours}
                  >
                    {enCours
                      ? <ActivityIndicator size="small" color="#081648" />
                      : <MaterialCommunityIcons name="tray-arrow-down" size={20} color="#081648" />
                    }
                  </TouchableOpacity>
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  accesRefuseTxt: { fontSize: 15, textAlign: 'center' },

  hero: { backgroundColor: '#081648', padding: 20, gap: 4 },
  heroTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  section: { padding: 16, paddingBottom: 4 },
  btnSauvegarder: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#081648', borderRadius: 12, paddingVertical: 14,
  },
  btnSauvegarderText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  card: { marginBottom: 10, borderWidth: 1 },
  cardContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardInfo: { flex: 1 },
  nomFichier: { fontSize: 14, fontWeight: '700' },
  metaLigne: { fontSize: 12, marginTop: 2 },
  btnTelecharger: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,22,72,0.08)',
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  emptyStateText: { fontSize: 14, textAlign: 'center' },
});
