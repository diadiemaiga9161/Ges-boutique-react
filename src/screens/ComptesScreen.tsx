import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { MontantInput } from '../components/MontantInput';

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

  const [comptes, setComptes] = useState<Compte[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  // Modals
  const [showOperation, setShowOperation] = useState(false);
  const [showOpsListe, setShowOpsListe] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedCompte, setSelectedCompte] = useState<Compte | null>(null);
  const [operationType, setOperationType] = useState<'depot' | 'retrait'>('depot');
  const [operations, setOperations] = useState<OperationCompte[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Formulaire opération
  const [opMontant, setOpMontant] = useState(0);
  const [opDescription, setOpDescription] = useState('');
  const [savingOp, setSavingOp] = useState(false);
  const [userId, setUserId] = useState<number>(0);

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
  const openOperation = (compte: Compte, type: 'depot' | 'retrait') => {
    setSelectedCompte(compte);
    setOperationType(type);
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
    if (operationType === 'retrait' && montant > selectedCompte.soldeActuel) {
      Alert.alert(tr('erreur', lang), `Solde insuffisant : ${money(selectedCompte.soldeActuel)}`);
      return;
    }
    setSavingOp(true);
    const opData = {
      compteId: selectedCompte.id,
      type: (operationType === 'depot' ? 'VERSEMENT' : 'RETRAIT') as TypeOperationCompte,
      montant,
      motif: opDescription.trim() || undefined,
      utilisateurId: userId || undefined,
    };
    try {
      await executerOuMettreEnFile(
        operationType === 'depot' ? 'compte_versement' : 'compte_retrait',
        opData,
        () => api.post('/comptes/operation', opData)
      );
      setShowOperation(false);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), `${operationType === 'depot' ? 'Dépôt' : 'Retrait'} impossible`);
    }
    setSavingOp(false);
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
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#1d4ed8" />;

  return (
    <View style={s.container}>

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
      <View style={s.toolbar}>
        <Text style={s.toolbarTitle}>
          {comptes.length} compte{comptes.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity style={s.addBtn} onPress={openFormNouveau}>
          <MaterialCommunityIcons name="plus" size={18} color="#fff" />
          <Text style={s.addBtnText}>Nouveau compte</Text>
        </TouchableOpacity>
      </View>

      {/* ── Liste des comptes ──────────────────────────────────────────────── */}
      <FlatList
        data={comptes}
        keyExtractor={c => String(c.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="bank-off-outline" size={48} color="#ccc" />
            <Text style={s.emptyStateText}>Aucun compte enregistré</Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <View style={s.card}>
            <View style={s.cardTop}>
              <View style={[s.typeIcon, { backgroundColor: c.actif === false ? '#f3f4f6' : '#eff6ff' }]}>
                <MaterialCommunityIcons name="bank-outline" size={22} color={c.actif === false ? '#9ca3af' : '#1d4ed8'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.compteNom}>{c.nomBanque}</Text>
                <Text style={s.compteNumero}>{masquerNumero(c.numeroCompte)}</Text>
                {!!c.titulaire && <Text style={s.compteBanque}>{c.titulaire}{c.agence ? ` · ${c.agence}` : ''}</Text>}
                {c.actif === false && (
                  <View style={[s.typeBadge, { backgroundColor: '#fef2f2' }]}>
                    <Text style={[s.typeBadgeText, { color: '#dc2626' }]}>Inactif</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.soldeText, { color: c.soldeActuel >= 0 ? '#16a34a' : '#dc2626' }]}>
                  {money(c.soldeActuel)}
                </Text>
                <Text style={s.soldeLabel}>Solde</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={s.cardActions}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}
                onPress={() => openOperation(c, 'depot')}
              >
                <MaterialCommunityIcons name="arrow-down-circle-outline" size={14} color="#047857" />
                <Text style={[s.actionBtnText, { color: '#047857' }]}>Déposer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}
                onPress={() => openOperation(c, 'retrait')}
              >
                <MaterialCommunityIcons name="arrow-up-circle-outline" size={14} color="#dc2626" />
                <Text style={[s.actionBtnText, { color: '#dc2626' }]}>Retirer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { borderColor: '#bfdbfe' }]}
                onPress={() => openOpsListe(c)}
              >
                <MaterialCommunityIcons name="history" size={14} color="#1d4ed8" />
                <Text style={[s.actionBtnText, { color: '#1d4ed8' }]}>Ops.</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionIconBtn} onPress={() => openFormModifier(c)}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ── Modal Opération (Dépôt / Retrait) ──────────────────────────────── */}
      <Modal
        visible={showOperation}
        animationType="slide"
        transparent
        onRequestClose={() => setShowOperation(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={[
              s.modalHead,
              { backgroundColor: operationType === 'depot' ? '#ecfdf5' : '#fef2f2' },
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <MaterialCommunityIcons
                  name={operationType === 'depot' ? 'arrow-down-circle' : 'arrow-up-circle'}
                  size={22}
                  color={operationType === 'depot' ? '#047857' : '#dc2626'}
                />
                <Text style={[
                  s.modalTitle,
                  { color: operationType === 'depot' ? '#047857' : '#dc2626' },
                ]}>
                  {operationType === 'depot' ? 'Effectuer un dépôt' : 'Effectuer un retrait'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowOperation(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              {selectedCompte && (
                <View style={s.infoCard}>
                  <Text style={s.infoCardTitle}>{selectedCompte.nomBanque}</Text>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>{tr('solde_actuel', lang)}</Text>
                    <Text style={[
                      s.infoVal,
                      { color: selectedCompte.soldeActuel >= 0 ? '#16a34a' : '#dc2626', fontWeight: '700' },
                    ]}>
                      {money(selectedCompte.soldeActuel)}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.fieldLabel}>{tr('montant', lang)} *</Text>
              <MontantInput
                style={s.fieldInput}
                value={opMontant}
                onChangeValue={setOpMontant}
                placeholder="0"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>{tr('description', lang)}</Text>
              <TextInput
                style={s.fieldInput}
                value={opDescription}
                onChangeText={setOpDescription}
                placeholder="Description de l'opération"
                placeholderTextColor="#bbb"
              />
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowOperation(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.btnConfirm,
                  { backgroundColor: operationType === 'depot' ? '#047857' : '#dc2626' },
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
                        name={operationType === 'depot' ? 'arrow-down' : 'arrow-up'}
                        size={15}
                        color="#fff"
                      />
                      <Text style={s.btnConfirmText}>
                        {operationType === 'depot' ? 'Déposer' : 'Retirer'}
                      </Text>
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
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle} numberOfLines={1}>
                Opérations — {selectedCompte?.nomBanque}
              </Text>
              <TouchableOpacity onPress={() => setShowOpsListe(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {loadingOps ? (
                <ActivityIndicator size="small" style={{ margin: 16 }} />
              ) : operations.length === 0 ? (
                <Text style={s.emptyText}>Aucune opération enregistrée</Text>
              ) : (
                <>
                  {operations.slice(0, 10).map((op, i) => {
                    const isCredit = TYPES_CREDIT.includes(op.type);
                    return (
                      <View key={op.id ?? i} style={s.opRow}>
                        <View style={[
                          s.opDot,
                          { backgroundColor: isCredit ? '#16a34a' : '#dc2626' },
                        ]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.opDesc}>{op.motif || op.type}</Text>
                          <Text style={s.opDate}>{dateStr(op.dateOperation)}</Text>
                        </View>
                        <Text style={[
                          s.opMontant,
                          { color: isCredit ? '#16a34a' : '#dc2626' },
                        ]}>
                          {isCredit ? '+' : '-'}{money(op.montant)}
                        </Text>
                      </View>
                    );
                  })}
                  {operations.length > 10 && (
                    <Text style={s.emptyText}>
                      10 dernières opérations affichées sur {operations.length}
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={[s.btnConfirm, { flex: 1 }]} onPress={() => setShowOpsListe(false)}>
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
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>
                {isEditing ? 'Modifier le compte' : 'Nouveau compte'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Nom de la banque *</Text>
              <TextInput
                style={s.fieldInput}
                value={formNomBanque}
                onChangeText={setFormNomBanque}
                placeholder="Ex : BDM SA, Ecobank..."
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Numéro de compte</Text>
              <TextInput
                style={s.fieldInput}
                value={formNumeroCompte}
                onChangeText={setFormNumeroCompte}
                placeholder="Ex : 00123456789"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Agence</Text>
              <TextInput
                style={s.fieldInput}
                value={formAgence}
                onChangeText={setFormAgence}
                placeholder="Ex : Agence centrale"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Titulaire</Text>
              <TextInput
                style={s.fieldInput}
                value={formTitulaire}
                onChangeText={setFormTitulaire}
                placeholder="Nom du titulaire"
                placeholderTextColor="#bbb"
              />
              {!isEditing && (
                <>
                  <Text style={s.fieldLabel}>{tr('solde_initial', lang)}</Text>
                  <MontantInput
                    style={s.fieldInput}
                    value={formSoldeInitial}
                    onChangeValue={setFormSoldeInitial}
                    placeholder="0"
                    placeholderTextColor="#bbb"
                  />
                </>
              )}
              <Text style={s.fieldLabel}>{tr('description', lang)}</Text>
              <TextInput
                style={s.fieldInput}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Description (optionnel)"
                placeholderTextColor="#bbb"
              />
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowForm(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, savingForm && { opacity: 0.5 }]}
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
