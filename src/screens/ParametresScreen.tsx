import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Checkbox, Button, ActivityIndicator, Portal, Modal, TextInput, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getStatutParametres, reinitialiserParametres, supprimerParametres,
  SelectionParametres,
} from '../services/api.service';
import { useColors } from '../theme/colors';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { showToast } from '../services/toast.service';

interface StatutParametres {
  nombreOperationsCaisse: number;
  soldeCaisseActuel: number;
  nombreCreditsRegles: number;
  nombreVentesAnnulees: number;
}

const STATUT_VIDE: StatutParametres = {
  nombreOperationsCaisse: 0,
  soldeCaisseActuel: 0,
  nombreCreditsRegles: 0,
  nombreVentesAnnulees: 0,
};

const MOT_CONFIRMATION = 'CONFIRMER';

function formatMontant(valeur: number): string {
  const n = Math.round(valeur || 0);
  return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} F CFA`;
}

export default function ParametresScreen() {
  const colors = useColors();
  const { lang } = useLang();

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [statut, setStatut] = useState<StatutParametres>(STATUT_VIDE);
  const [selection, setSelection] = useState<SelectionParametres>({
    soldeCaisse: false,
    historiqueOperationsCaisse: false,
    creditsRegles: false,
    historiqueVentesAnnulees: false,
  });

  const [showReinitConfirm, setShowReinitConfirm] = useState(false);
  const [showSupprimerConfirm, setShowSupprimerConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const chargerStatut = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStatutParametres();
      const data = res.data?.data || res.data;
      setStatut({ ...STATUT_VIDE, ...data });
    } catch {
      showToast("Impossible de récupérer le statut des paramètres — vérifiez votre connexion.", 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : {};
        const admin = user?.role === 'ADMIN' || user?.role === 'ROLE_ADMIN';
        setIsAdmin(admin);
        if (admin) await chargerStatut();
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, [chargerStatut]);

  const aucuneSelection =
    !selection.soldeCaisse &&
    !selection.historiqueOperationsCaisse &&
    !selection.creditsRegles &&
    !selection.historiqueVentesAnnulees;

  const toggle = (key: keyof SelectionParametres) => {
    setSelection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const demanderReinitialiser = () => {
    if (aucuneSelection) {
      showToast('Sélectionnez au moins un élément à réinitialiser.', 'warning');
      return;
    }
    setShowReinitConfirm(true);
  };

  const executerReinitialiser = async () => {
    setShowReinitConfirm(false);
    setEnCours(true);
    try {
      await reinitialiserParametres(selection);
      showToast('Données réinitialisées avec succès.', 'success');
      await chargerStatut();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Impossible de réinitialiser les données.', 'error');
    } finally {
      setEnCours(false);
    }
  };

  const demanderSupprimer = () => {
    if (aucuneSelection) {
      showToast('Sélectionnez au moins un élément à supprimer.', 'warning');
      return;
    }
    setConfirmText('');
    setShowSupprimerConfirm(true);
  };

  const executerSupprimer = async () => {
    if (confirmText.trim() !== MOT_CONFIRMATION) {
      showToast(`Tapez exactement "${MOT_CONFIRMATION}" pour confirmer.`, 'warning');
      return;
    }
    setShowSupprimerConfirm(false);
    setEnCours(true);
    try {
      await supprimerParametres(selection);
      showToast('Données supprimées avec succès.', 'success');
      await chargerStatut();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Impossible de supprimer les données.', 'error');
    } finally {
      setEnCours(false);
    }
  };

  if (checkingAuth) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="lock-outline" size={56} color={colors.danger} />
        <Text style={[styles.accesRefuseTxt, { color: colors.textSecondary }]}>
          Accès réservé aux administrateurs.
        </Text>
      </View>
    );
  }

  const items: { key: keyof SelectionParametres; label: string; detail: string }[] = [
    { key: 'soldeCaisse', label: 'Solde de caisse', detail: formatMontant(statut.soldeCaisseActuel) },
    { key: 'historiqueOperationsCaisse', label: 'Historique des opérations de caisse', detail: `${statut.nombreOperationsCaisse} opération(s)` },
    { key: 'creditsRegles', label: 'Crédits réglés', detail: `${statut.nombreCreditsRegles} crédit(s)` },
    { key: 'historiqueVentesAnnulees', label: 'Ventes annulées', detail: `${statut.nombreVentesAnnulees} vente(s)` },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.headerRow}>
          <Text variant="titleMedium" style={[styles.sectionLabel, { color: colors.textSecondary }]}>STATUT ACTUEL</Text>
          <IconButton icon="refresh" size={20} iconColor={colors.primary} onPress={chargerStatut} disabled={loading} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {items.map((it, i) => (
              <View key={it.key} style={[styles.statutRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.statutLabel, { color: colors.text }]}>{it.label}</Text>
                <Text style={[styles.statutValue, { color: colors.primary }]}>{it.detail}</Text>
              </View>
            ))}
          </View>
        )}

        <Text variant="titleMedium" style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>
          SÉLECTION À TRAITER
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {items.map((it, i) => (
            <View key={it.key} style={[styles.checkRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Checkbox
                status={selection[it.key] ? 'checked' : 'unchecked'}
                onPress={() => toggle(it.key)}
                color={colors.warning}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statutLabel, { color: colors.text }]}>{it.label}</Text>
                <Text style={[styles.checkDetail, { color: colors.textSecondary }]}>{it.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.warningBox, { backgroundColor: colors.warningBg, borderLeftColor: colors.warning }]}>
          <MaterialCommunityIcons name="alert-outline" size={20} color={colors.warning} />
          <Text style={[styles.warningTxt, { color: colors.text }]}>
            Ces actions sont irréversibles et affectent directement les données de la boutique.
            Sélectionnez uniquement ce que vous souhaitez traiter.
          </Text>
        </View>

        <Button
          mode="contained"
          icon="refresh-circle"
          buttonColor={colors.warning}
          style={styles.actionBtn}
          contentStyle={{ height: 48 }}
          disabled={aucuneSelection || enCours}
          loading={enCours}
          onPress={demanderReinitialiser}
        >
          Réinitialiser
        </Button>

        <Button
          mode="contained"
          icon="trash-can-outline"
          buttonColor={colors.danger}
          style={styles.actionBtn}
          contentStyle={{ height: 48 }}
          disabled={aucuneSelection || enCours}
          loading={enCours}
          onPress={demanderSupprimer}
        >
          Supprimer
        </Button>
      </ScrollView>

      {/* Modal confirmation réinitialisation — simple */}
      <Portal>
        <Modal
          visible={showReinitConfirm}
          onDismiss={() => setShowReinitConfirm(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}
        >
          <View style={[styles.modalIcon, { backgroundColor: colors.warningBg }]}>
            <MaterialCommunityIcons name="refresh-circle" size={28} color={colors.warning} />
          </View>
          <Text variant="titleMedium" style={[styles.modalTitle, { color: colors.text }]}>Réinitialiser les données</Text>
          <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
            Cette action va réinitialiser les éléments sélectionnés. Voulez-vous continuer ?
          </Text>
          <View style={styles.modalActions}>
            <Button mode="outlined" style={[styles.modalBtn, { borderColor: colors.border }]} textColor={colors.text} onPress={() => setShowReinitConfirm(false)}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" style={styles.modalBtn} buttonColor={colors.primary} onPress={executerReinitialiser}>
              {tr('confirmer', lang)}
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Modal confirmation suppression — renforcée (saisie "CONFIRMER") */}
      <Portal>
        <Modal
          visible={showSupprimerConfirm}
          onDismiss={() => setShowSupprimerConfirm(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}
        >
          <View style={[styles.modalIcon, { backgroundColor: colors.dangerBg }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={28} color={colors.danger} />
          </View>
          <Text variant="titleMedium" style={[styles.modalTitle, { color: colors.text }]}>Supprimer les données</Text>
          <Text style={[styles.modalMsg, { color: colors.textSecondary }]}>
            Cette action est irréversible et supprimera définitivement les éléments sélectionnés.
            Tapez « {MOT_CONFIRMATION} » ci-dessous pour confirmer.
          </Text>
          <TextInput
            mode="outlined"
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={MOT_CONFIRMATION}
            autoCapitalize="characters"
            style={{ marginBottom: 4 }}
          />
          <View style={styles.modalActions}>
            <Button mode="outlined" style={[styles.modalBtn, { borderColor: colors.border }]} textColor={colors.text} onPress={() => setShowSupprimerConfirm(false)}>
              {tr('annuler', lang)}
            </Button>
            <Button mode="contained" style={styles.modalBtn} buttonColor={colors.danger} onPress={executerSupprimer}>
              Supprimer
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  accesRefuseTxt: { fontSize: 15, textAlign: 'center' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },

  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginTop: 8 },
  statutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  statutLabel: { fontSize: 13, fontWeight: '500' },
  statutValue: { fontSize: 13, fontWeight: '700' },

  checkRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  checkDetail: { fontSize: 11, marginTop: 1 },

  warningBox: { flexDirection: 'row', gap: 10, borderLeftWidth: 3, borderRadius: 8, padding: 12, marginTop: 20, alignItems: 'flex-start' },
  warningTxt: { flex: 1, fontSize: 12, lineHeight: 17 },

  actionBtn: { marginTop: 14, borderRadius: 10 },

  modal: { marginHorizontal: 20, borderRadius: 18, padding: 22, maxHeight: '85%' },
  modalIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  modalTitle: { fontWeight: '800', marginBottom: 8 },
  modalMsg: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 10 },
});
