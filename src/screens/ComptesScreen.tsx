import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api.service';
import { transfererCaisseVersBanque } from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { MontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Compte {
  id: number;
  nomBanque: string;
  numeroCompte?: string;
  agence?: string;
  titulaire?: string;
  soldeInitial: number;
  soldeActuel: number;
  actif: boolean;
  description?: string;
}

type TypeOperationCompte = 'VERSEMENT' | 'RETRAIT' | 'CHEQUE' | 'FRAIS' | 'BON_CAISSE' | 'PAIEMENT_FOURNISSEUR' | 'AVANCE_FOURNISSEUR';

interface OperationCompte {
  id: number;
  type: TypeOperationCompte;
  montant: number;
  soldeAvant: number;
  soldeApres: number;
  motif?: string;
  reference?: string;
  dateOperation: string;
}

// Types d'opération qui augmentent le solde — le reste (retrait, chèque,
// frais, paiement/avance fournisseur) le diminue.
const TYPES_CREDIT: TypeOperationCompte[] = ['VERSEMENT'];

// Mêmes 5 types que le <ion-select> "Type" de resources.page.html (case 'comptes') —
// Versement, Retrait, Chèque, Frais, Bon caisse.
const TYPES_OPERATION: { value: TypeOperationCompte; label: string }[] = [
  { value: 'VERSEMENT', label: 'Versement' },
  { value: 'RETRAIT', label: 'Retrait' },
  { value: 'CHEQUE', label: 'Chèque' },
  { value: 'FRAIS', label: 'Frais' },
  { value: 'BON_CAISSE', label: 'Bon caisse' },
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const masquerNumero = (num?: string) => {
  if (!num) return '—';
  if (num.length <= 4) return '****';
  return '****' + num.slice(-4);
};

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ComptesScreen() {
  const { lang } = useLang();
  const colors = useColors();

  const [comptes, setComptes] = useState<Compte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Modals
  const [showOperation, setShowOperation] = useState(false);
  const [showOpsListe, setShowOpsListe] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCompte, setSelectedCompte] = useState<Compte | null>(null);
  const [opType, setOpType] = useState<TypeOperationCompte>('VERSEMENT');
  const [operations, setOperations] = useState<OperationCompte[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Formulaire opération
  const [opMontant, setOpMontant] = useState(0);
  const [opDescription, setOpDescription] = useState('');
  const [savingOp, setSavingOp] = useState(false);
  const [userId, setUserId] = useState<number>(0);

  // Transfert caisse -> banque (compte.service.ts / transfererCaisseVersBanque,
  // même endpoint POST /caisse/transferer-vers-banque que Ionic) — débite la
  // caisse, crédite le compte bancaire choisi. Action globale, pas liée à une
  // carte compte en particulier (on choisit le compte destination dans le modal).
  const [showTransfert, setShowTransfert] = useState(false);
  const [transfertCompteId, setTransfertCompteId] = useState<number>(0);
  const [transfertMontant, setTransfertMontant] = useState(0);
  const [transfertMotif, setTransfertMotif] = useState('');
  const [savingTransfert, setSavingTransfert] = useState(false);

  // Formulaire compte
  const [formNomBanque, setFormNomBanque] = useState('');
  const [formNumeroCompte, setFormNumeroCompte] = useState('');
  const [formAgence, setFormAgence] = useState('');
  const [formTitulaire, setFormTitulaire] = useState('');
  const [formSoldeInitial, setFormSoldeInitial] = useState(0);
  const [formDescription, setFormDescription] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalSolde = useMemo(() => comptes.reduce((s, c) => s + c.soldeActuel, 0), [comptes]);

  const compteMax = useMemo(
    () => comptes.reduce<Compte | null>((max, c) => (!max || c.soldeActuel > max.soldeActuel ? c : max), null),
    [comptes]
  );

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const res = await api.get('/comptes');
      const liste = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setComptes(liste);
      setFromCache(false);
      sauvegarderCache('comptes', liste).catch(() => {});
    } catch {
      const cached = await lireCache<Compte>('comptes');
      if (cached.length > 0) { setComptes(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false);
    setRefreshing(false);
  }, [lang]);

  useEffect(() => {
    charger();
    AsyncStorage.getItem('user').then(raw => {
      if (raw) { try { setUserId(JSON.parse(raw)?.id || 0); } catch {} }
    });
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const openOperation = (compte: Compte, type: TypeOperationCompte) => {
    setSelectedCompte(compte);
    setOpType(type);
    setOpMontant(0);
    setOpDescription('');
    setShowOperation(true);
  };

  const openOpsListe = (compte: Compte) => {
    setSelectedCompte(compte);
    setOperations([]);
    setLoadingOps(true);
    setShowOpsListe(true);
    api.get(`/comptes/${compte.id}/operations`)
      .then(r => setOperations(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {})
      .finally(() => setLoadingOps(false));
  };

  const openFormNouveau = () => {
    setIsEditing(false);
    setSelectedCompte(null);
    setFormNomBanque('');
    setFormNumeroCompte('');
    setFormAgence('');
    setFormTitulaire('');
    setFormSoldeInitial(0);
    setFormDescription('');
    setShowForm(true);
  };

  const openFormModifier = (compte: Compte) => {
    setIsEditing(true);
    setSelectedCompte(compte);
    setFormNomBanque(compte.nomBanque);
    setFormNumeroCompte(compte.numeroCompte || '');
    setFormAgence(compte.agence || '');
    setFormTitulaire(compte.titulaire || '');
    setFormSoldeInitial(compte.soldeInitial);
    setFormDescription(compte.description || '');
    setShowForm(true);
  };

  const effectuerOperation = async () => {
    if (!selectedCompte) return;
    const montant = opMontant;
    if (!montant || montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    const estCredit = TYPES_CREDIT.includes(opType);
    if (!estCredit && montant > selectedCompte.soldeActuel) {
      Alert.alert(tr('erreur', lang), `Solde insuffisant : ${money(selectedCompte.soldeActuel)}`);
      return;
    }
    setSavingOp(true);
    const opData = {
      compteId: selectedCompte.id,
      type: opType,
      montant,
      motif: opDescription.trim() || undefined,
      utilisateurId: userId || undefined,
    };
    try {
      await executerOuMettreEnFile(
        estCredit ? 'compte_versement' : 'compte_retrait',
        opData,
        () => api.post('/comptes/operation', opData)
      );
      setShowOperation(false);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Opération impossible');
    }
    setSavingOp(false);
  };

  const ouvrirTransfert = () => {
    setTransfertCompteId(comptes[0]?.id || 0);
    setTransfertMontant(0);
    setTransfertMotif('');
    setShowTransfert(true);
  };

  const effectuerTransfert = async () => {
    if (!transfertCompteId) {
      Alert.alert(tr('erreur', lang), 'Sélectionnez un compte destination');
      return;
    }
    if (!transfertMontant || transfertMontant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    setSavingTransfert(true);
    try {
      await transfererCaisseVersBanque({
        compteId: transfertCompteId,
        montant: transfertMontant,
        motif: transfertMotif.trim() || undefined,
        utilisateurId: userId || undefined,
      });
      setShowTransfert(false);
      charger();
      Alert.alert(tr('succes', lang), 'Transfert caisse → banque effectué');
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || 'Transfert impossible (solde caisse insuffisant ?)');
    }
    setSavingTransfert(false);
  };

  const sauvegarderCompte = async () => {
    if (!formNomBanque.trim()) {
      Alert.alert(tr('erreur', lang), 'Le nom de la banque est requis');
      return;
    }
    setSavingForm(true);
    const data: Record<string, any> = {
      nomBanque: formNomBanque.trim(),
      numeroCompte: formNumeroCompte.trim() || undefined,
      agence: formAgence.trim() || undefined,
      titulaire: formTitulaire.trim() || undefined,
      description: formDescription.trim() || undefined,
    };
    if (!isEditing) {
      data.soldeInitial = formSoldeInitial || 0;
    }
    try {
      if (isEditing && selectedCompte) {
        await executerOuMettreEnFile('compte_update', { id: selectedCompte.id, data }, () => api.put(`/comptes/${selectedCompte.id}`, data));
      } else {
        await executerOuMettreEnFile('compte_create', data, () => api.post('/comptes', data));
      }
      setShowForm(false);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Enregistrement impossible');
    }
    setSavingForm(false);
  };

  // ─── Rendu principal ──────────────────────────────────────────────────────
  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} size="large" color={colors.primary} />;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>

      {/* ── Hero stats ─────────────────────────────────────────────────────── */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Solde total</Text>
          <Text style={[s.heroVal, { color: totalSolde >= 0 ? '#86efac' : '#fca5a5' }]}>
            {money(totalSolde)}
          </Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Nb comptes</Text>
          <Text style={s.heroVal}>{comptes.length}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Meilleur solde</Text>
          <Text style={s.heroVal} numberOfLines={1}>
            {compteMax ? compteMax.nomBanque : '—'}
          </Text>
        </View>
      </View>

      {/* ── Barre d'outils ────────────────────────────────────────────────── */}
      <View style={[s.toolbar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[s.toolbarTitle, { color: colors.textSecondary }]}>
          {comptes.length} compte{comptes.length !== 1 ? 's' : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: colors.success }]}
            onPress={ouvrirTransfert}
            disabled={!comptes.length}
          >
            <MaterialCommunityIcons name="bank-transfer" size={18} color="#fff" />
            <Text style={s.addBtnText}>Transfert caisse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.addBtn, { backgroundColor: colors.primary }]} onPress={openFormNouveau}>
            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            <Text style={s.addBtnText}>Nouveau compte</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Liste des comptes ──────────────────────────────────────────────── */}
      <FlatList
        data={comptes}
        keyExtractor={c => String(c.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="bank-off-outline" size={48} color={colors.textSecondary} />
            <Text style={[s.emptyStateText, { color: colors.textSecondary }]}>Aucun compte enregistré</Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <View style={[s.card, { backgroundColor: colors.card }]}>
            <View style={s.cardTop}>
              <View style={[s.typeIcon, { backgroundColor: c.actif === false ? colors.border : colors.infoBg }]}>
                <MaterialCommunityIcons name="bank-outline" size={22} color={c.actif === false ? colors.textSecondary : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.compteNom, { color: colors.text }]}>{c.nomBanque}</Text>
                <Text style={[s.compteNumero, { color: colors.textSecondary }]}>{masquerNumero(c.numeroCompte)}</Text>
                {!!c.titulaire && <Text style={[s.compteBanque, { color: colors.textSecondary }]}>{c.titulaire}{c.agence ? ` · ${c.agence}` : ''}</Text>}
                {c.actif === false && (
                  <View style={[s.typeBadge, { backgroundColor: colors.dangerBg }]}>
                    <Text style={[s.typeBadgeText, { color: colors.danger }]}>Inactif</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.soldeText, { color: c.soldeActuel >= 0 ? colors.success : colors.danger }]}>
                  {money(c.soldeActuel)}
                </Text>
                <Text style={[s.soldeLabel, { color: colors.textSecondary }]}>Solde</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={s.cardActions}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.successBg, borderColor: colors.successBg }]}
                onPress={() => openOperation(c, 'VERSEMENT')}
              >
                <MaterialCommunityIcons name="arrow-down-circle-outline" size={14} color={colors.success} />
                <Text style={[s.actionBtnText, { color: colors.success }]}>Déposer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBg }]}
                onPress={() => openOperation(c, 'RETRAIT')}
              >
                <MaterialCommunityIcons name="arrow-up-circle-outline" size={14} color={colors.danger} />
                <Text style={[s.actionBtnText, { color: colors.danger }]}>Retirer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { borderColor: colors.border }]}
                onPress={() => openOpsListe(c)}
              >
                <MaterialCommunityIcons name="history" size={14} color={colors.primary} />
                <Text style={[s.actionBtnText, { color: colors.primary }]}>Ops.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionIconBtn, { borderColor: colors.border }]} onPress={() => openFormModifier(c)}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ── Modal Opération (5 types, comme <ion-select> "Type" côté Ionic) ──── */}
      <Modal
        visible={showOperation}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOperation(false)}
      >
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[
              s.modalHead,
              { backgroundColor: TYPES_CREDIT.includes(opType) ? colors.successBg : colors.dangerBg, borderBottomColor: colors.border },
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MaterialCommunityIcons
                  name={TYPES_CREDIT.includes(opType) ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={22}
                  color={TYPES_CREDIT.includes(opType) ? colors.success : colors.danger}
                />
                <Text style={[
                  s.modalTitle,
                  { color: TYPES_CREDIT.includes(opType) ? colors.success : colors.danger },
                ]}>
                  Opération compte
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowOperation(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {selectedCompte && (
                <View style={[s.infoCard, { backgroundColor: colors.inputBg }]}>
                  <Text style={[s.infoCardTitle, { color: colors.primary }]}>{selectedCompte.nomBanque}</Text>
                  <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
                    <Text style={[s.infoLabel, { color: colors.textSecondary }]}>{tr('solde_actuel', lang)}</Text>
                    <Text style={[
                      s.infoVal,
                      { color: selectedCompte.soldeActuel >= 0 ? colors.success : colors.danger, fontWeight: '700' },
                    ]}>
                      {money(selectedCompte.soldeActuel)}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Type</Text>
              <View style={s.chips}>
                {TYPES_OPERATION.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[
                      s.chipType,
                      { borderColor: colors.border },
                      opType === t.value && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setOpType(t.value)}
                  >
                    <Text style={[s.chipTypeText, { color: opType === t.value ? '#fff' : colors.textSecondary }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{tr('montant', lang)} *</Text>
              <MontantInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={opMontant}
                onChangeValue={setOpMontant}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{tr('description', lang)}</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={opDescription}
                onChangeText={setOpDescription}
                placeholder="Motif de l'opération"
                placeholderTextColor={colors.placeholder}
              />
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: colors.border }]} onPress={() => setShowOperation(false)}>
                <Text style={[s.btnCancelText, { color: colors.textSecondary }]}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.btnConfirm,
                  { backgroundColor: TYPES_CREDIT.includes(opType) ? colors.success : colors.danger },
                  savingOp && { opacity: 0.5 },
                ]}
                onPress={effectuerOperation}
                disabled={savingOp}
              >
                {savingOp
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <MaterialCommunityIcons
                        name={TYPES_CREDIT.includes(opType) ? 'arrow-down' : 'arrow-up'}
                        size={15}
                        color="#fff"
                      />
                      <Text style={s.btnConfirmText}>
                        Enregistrer
                      </Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Transfert caisse → banque ──────────────────────────────────── */}
      <Modal
        visible={showTransfert}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTransfert(false)}
      >
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { backgroundColor: colors.successBg, borderBottomColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MaterialCommunityIcons name="bank-transfer" size={22} color={colors.success} />
                <Text style={[s.modalTitle, { color: colors.success }]}>Transfert caisse → banque</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTransfert(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Compte destination *</Text>
              <View style={s.chips}>
                {comptes.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      s.chipType,
                      { borderColor: colors.border },
                      transfertCompteId === c.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setTransfertCompteId(c.id)}
                  >
                    <Text style={[s.chipTypeText, { color: transfertCompteId === c.id ? '#fff' : colors.textSecondary }]}>
                      {c.nomBanque}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{tr('montant', lang)} *</Text>
              <MontantInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={transfertMontant}
                onChangeValue={setTransfertMontant}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Motif</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={transfertMotif}
                onChangeText={setTransfertMotif}
                placeholder="Motif du transfert"
                placeholderTextColor={colors.placeholder}
              />
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: colors.border }]} onPress={() => setShowTransfert(false)}>
                <Text style={[s.btnCancelText, { color: colors.textSecondary }]}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, { backgroundColor: colors.success }, savingTransfert && { opacity: 0.5 }]}
                onPress={effectuerTransfert}
                disabled={savingTransfert}
              >
                {savingTransfert
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <MaterialCommunityIcons name="bank-transfer" size={15} color="#fff" />
                      <Text style={s.btnConfirmText}>Transférer</Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Historique des opérations ─────────────────────────────────── */}
      <Modal
        visible={showOpsListe}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOpsListe(false)}
      >
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]} numberOfLines={1}>
                Opérations — {selectedCompte?.nomBanque}
              </Text>
              <TouchableOpacity onPress={() => setShowOpsListe(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {loadingOps ? (
                <ActivityIndicator size="small" style={{ margin: 16 }} color={colors.primary} />
              ) : operations.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>Aucune opération enregistrée</Text>
              ) : (
                <>
                  {operations.slice(0, 10).map((op, i) => {
                    const isCredit = TYPES_CREDIT.includes(op.type);
                    return (
                      <View key={op.id ?? i} style={[s.opRow, { borderBottomColor: colors.border }]}>
                        <View style={[
                          s.opDot,
                          { backgroundColor: isCredit ? colors.success : colors.danger },
                        ]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.opDesc, { color: colors.text }]}>{op.motif || op.type}</Text>
                          <Text style={[s.opDate, { color: colors.textSecondary }]}>{dateStr(op.dateOperation)}</Text>
                        </View>
                        <Text style={[
                          s.opMontant,
                          { color: isCredit ? colors.success : colors.danger },
                        ]}>
                          {isCredit ? '+' : '-'}{money(op.montant)}
                        </Text>
                      </View>
                    );
                  })}
                  {operations.length > 10 && (
                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>
                      10 dernières opérations affichées sur {operations.length}
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnConfirm, { flex: 1, backgroundColor: colors.primary }]} onPress={() => setShowOpsListe(false)}>
                <Text style={s.btnConfirmText}>{tr('fermer', lang)}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Formulaire compte (Ajouter / Modifier) ─────────────────────── */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <View style={[s.overlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.sheet, { backgroundColor: colors.card }]}>
            <View style={[s.handle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHead, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.text }]}>
                {isEditing ? 'Modifier le compte' : 'Nouveau compte'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Nom de la banque *</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formNomBanque}
                onChangeText={setFormNomBanque}
                placeholder="Ex : BDM SA, Ecobank..."
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Numéro de compte</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formNumeroCompte}
                onChangeText={setFormNumeroCompte}
                placeholder="Ex : 00123456789"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Agence</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formAgence}
                onChangeText={setFormAgence}
                placeholder="Ex : Agence centrale"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>Titulaire</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formTitulaire}
                onChangeText={setFormTitulaire}
                placeholder="Nom du titulaire"
                placeholderTextColor={colors.placeholder}
              />
              {!isEditing && (
                <>
                  <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{tr('solde_initial', lang)}</Text>
                  <MontantInput
                    style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={formSoldeInitial}
                    onChangeValue={setFormSoldeInitial}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                  />
                </>
              )}
              <Text style={[s.fieldLabel, { color: colors.textSecondary }]}>{tr('description', lang)}</Text>
              <TextInput
                style={[s.fieldInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Description (optionnel)"
                placeholderTextColor={colors.placeholder}
              />
            </ScrollView>
            <View style={[s.modalFoot, { borderTopColor: colors.border }]}>
              <TouchableOpacity style={[s.btnCancel, { borderColor: colors.border }]} onPress={() => setShowForm(false)}>
                <Text style={[s.btnCancelText, { color: colors.textSecondary }]}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, { backgroundColor: colors.primary }, savingForm && { opacity: 0.5 }]}
                onPress={sauvegarderCompte}
                disabled={savingForm}
              >
                {savingForm
                  ? <ActivityIndicator size="small" color="#fff" />
                  : (
                    <>
                      <MaterialCommunityIcons name="content-save" size={15} color="#fff" />
                      <Text style={s.btnConfirmText}>
                        {isEditing ? tr('modifier', lang) : 'Créer'}
                      </Text>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  // Hero
  hero: { backgroundColor: '#1e3a8a', flexDirection: 'row', padding: 14, alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginBottom: 2, textAlign: 'center' },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 14, textAlign: 'center' },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },

  // Toolbar
  toolbar: {
    flexDirection: 'row', padding: 12, alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  toolbarTitle: { fontSize: 14, color: '#555', fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1d4ed8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Carte compte
  // STYLE (2026-08-16) : coins plus arrondis + ombre plus douce/plus large.
  card: {
    backgroundColor: '#fff', borderRadius: 18, marginBottom: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  typeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  compteNom: { fontWeight: 'bold', fontSize: 15, color: '#1a1a1a', marginBottom: 2 },
  compteNumero: { fontSize: 13, color: '#888', marginBottom: 2 },
  compteBanque: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  soldeText: { fontWeight: 'bold', fontSize: 17 },
  soldeLabel: { fontSize: 11, color: '#aaa', marginTop: 2 },

  // Actions carte
  cardActions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, paddingVertical: 7, minWidth: 60,
  },
  actionBtnText: { fontSize: 11, fontWeight: '600' },
  actionIconBtn: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8,
  },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { color: '#999', fontSize: 15 },
  emptyText: { color: '#aaa', textAlign: 'center', padding: 12, fontSize: 13 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Info card (modal)
  infoCard: { backgroundColor: '#fafafa', borderRadius: 14, padding: 12, marginBottom: 14 },
  infoCardTitle: { fontWeight: 'bold', color: '#1d4ed8', fontSize: 15, marginBottom: 8 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 8 },

  // Ligne opération
  opRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  opDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  opDesc: { fontSize: 13, color: '#333', fontWeight: '500' },
  opDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  opMontant: { fontWeight: '700', fontSize: 14 },

  // Formulaire
  fieldLabel: { color: '#666', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipType: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  chipTypeText: { fontSize: 13, color: '#555' },

  // Boutons footer
  btnCancel: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: {
    flex: 2, backgroundColor: '#1d4ed8', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
