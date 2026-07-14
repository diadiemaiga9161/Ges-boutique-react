import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import api from '../services/api.service';
import { executerOuMettreEnFile, sauvegarderCache, lireCache } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Compte {
  id: number;
  nom: string;
  numero?: string;
  banque?: string;
  type: 'COURANT' | 'EPARGNE' | 'CAISSE';
  solde: number;
}

interface OperationCompte {
  id: number;
  date: string;
  description: string;
  montant: number;
  type: 'CREDIT' | 'DEBIT';
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const TYPES_COMPTE = ['COURANT', 'EPARGNE', 'CAISSE'] as const;

const TYPE_CONFIG: Record<Compte['type'], {
  label: string;
  icon: 'bank-outline' | 'piggy-bank-outline' | 'cash-multiple';
  color: string;
  bg: string;
}> = {
  COURANT: { label: 'Courant', icon: 'bank-outline',       color: '#1d4ed8', bg: '#eff6ff' },
  EPARGNE: { label: 'Épargne', icon: 'piggy-bank-outline', color: '#7c3aed', bg: '#f5f3ff' },
  CAISSE:  { label: 'Caisse',  icon: 'cash-multiple',      color: '#047857', bg: '#ecfdf5' },
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('fr-FR') + ' FCFA';
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
  const [opMontant, setOpMontant] = useState('');
  const [opDescription, setOpDescription] = useState('');
  const [savingOp, setSavingOp] = useState(false);

  // Formulaire compte
  const [formNom, setFormNom] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formBanque, setFormBanque] = useState('');
  const [formType, setFormType] = useState<Compte['type']>('COURANT');
  const [formSolde, setFormSolde] = useState('');
  const [savingForm, setSavingForm] = useState(false);

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalSolde = useMemo(() => comptes.reduce((s, c) => s + c.solde, 0), [comptes]);

  const compteMax = useMemo(
    () => comptes.reduce<Compte | null>((max, c) => (!max || c.solde > max.solde ? c : max), null),
    [comptes]
  );

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) throw new Error('offline');
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

  useEffect(() => { charger(); }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────
  const openOperation = (compte: Compte, type: 'depot' | 'retrait') => {
    setSelectedCompte(compte);
    setOperationType(type);
    setOpMontant('');
    setOpDescription(type === 'depot' ? 'Dépôt' : 'Retrait');
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
    setFormNom('');
    setFormNumero('');
    setFormBanque('');
    setFormType('COURANT');
    setFormSolde('');
    setShowForm(true);
  };

  const openFormModifier = (compte: Compte) => {
    setIsEditing(true);
    setSelectedCompte(compte);
    setFormNom(compte.nom);
    setFormNumero(compte.numero || '');
    setFormBanque(compte.banque || '');
    setFormType(compte.type);
    setFormSolde(String(compte.solde));
    setShowForm(true);
  };

  const supprimerCompte = (compte: Compte) => {
    Alert.alert('Supprimer', `Supprimer le compte "${compte.nom}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      {
        text: tr('supprimer', lang), style: 'destructive',
        onPress: async () => {
          try {
            await executerOuMettreEnFile('compte_delete', { id: compte.id }, () => api.delete(`/comptes/${compte.id}`));
            charger();
          } catch {
            Alert.alert(tr('erreur', lang), 'Suppression impossible');
          }
        },
      },
    ]);
  };

  const effectuerOperation = async () => {
    if (!selectedCompte) return;
    const montant = parseFloat(opMontant);
    if (!montant || montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide');
      return;
    }
    if (operationType === 'retrait' && montant > selectedCompte.solde) {
      Alert.alert(tr('erreur', lang), `Solde insuffisant : ${money(selectedCompte.solde)}`);
      return;
    }
    setSavingOp(true);
    const opType = operationType === 'depot' ? 'compte_versement' : 'compte_retrait';
    const opData = { montant, description: opDescription.trim() || (operationType === 'depot' ? 'Dépôt' : 'Retrait') };
    const endpoint = operationType === 'depot' ? 'versement' : 'retrait';
    try {
      await executerOuMettreEnFile(opType, { id: selectedCompte.id, data: opData }, () => api.post(`/comptes/${selectedCompte.id}/${endpoint}`, opData));
      setShowOperation(false);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), `${operationType === 'depot' ? 'Dépôt' : 'Retrait'} impossible`);
    }
    setSavingOp(false);
  };

  const sauvegarderCompte = async () => {
    if (!formNom.trim()) {
      Alert.alert(tr('erreur', lang), 'Le nom du compte est requis');
      return;
    }
    setSavingForm(true);
    const data: Record<string, any> = {
      nom: formNom.trim(),
      numero: formNumero.trim() || undefined,
      banque: formBanque.trim() || undefined,
      type: formType,
    };
    if (!isEditing) {
      data.solde = parseFloat(formSolde) || 0;
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
      {fromCache && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 12, paddingVertical: 6 }}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#92400e" />
          <Text style={{ color: '#92400e', fontSize: 12 }}>Mode hors ligne — données locales</Text>
        </View>
      )}

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
            {compteMax ? compteMax.nom : '—'}
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
        renderItem={({ item: c }) => {
          const cfg = TYPE_CONFIG[c.type];
          return (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.typeIcon, { backgroundColor: cfg.bg }]}>
                  <MaterialCommunityIcons name={cfg.icon} size={22} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.compteNom}>{c.nom}</Text>
                  <Text style={s.compteNumero}>{masquerNumero(c.numero)}</Text>
                  {!!c.banque && <Text style={s.compteBanque}>{c.banque}</Text>}
                  <View style={[s.typeBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[s.soldeText, { color: c.solde >= 0 ? '#16a34a' : '#dc2626' }]}>
                    {money(c.solde)}
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
                <TouchableOpacity
                  style={[s.actionIconBtn, { borderColor: '#fca5a5' }]}
                  onPress={() => supprimerCompte(c)}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
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
                  <Text style={s.infoCardTitle}>{selectedCompte.nom}</Text>
                  <View style={s.infoRow}>
                    <Text style={s.infoLabel}>{tr('solde_actuel', lang)}</Text>
                    <Text style={[
                      s.infoVal,
                      { color: selectedCompte.solde >= 0 ? '#16a34a' : '#dc2626', fontWeight: '700' },
                    ]}>
                      {money(selectedCompte.solde)}
                    </Text>
                  </View>
                </View>
              )}
              <Text style={s.fieldLabel}>{tr('montant', lang)} *</Text>
              <TextInput
                style={s.fieldInput}
                value={opMontant}
                onChangeText={setOpMontant}
                keyboardType="numeric"
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
                Opérations — {selectedCompte?.nom}
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
                  {operations.slice(0, 10).map((op, i) => (
                    <View key={op.id ?? i} style={s.opRow}>
                      <View style={[
                        s.opDot,
                        { backgroundColor: op.type === 'CREDIT' ? '#16a34a' : '#dc2626' },
                      ]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.opDesc}>{op.description}</Text>
                        <Text style={s.opDate}>{dateStr(op.date)}</Text>
                      </View>
                      <Text style={[
                        s.opMontant,
                        { color: op.type === 'CREDIT' ? '#16a34a' : '#dc2626' },
                      ]}>
                        {op.type === 'CREDIT' ? '+' : '-'}{money(op.montant)}
                      </Text>
                    </View>
                  ))}
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
              <Text style={s.fieldLabel}>Nom du compte *</Text>
              <TextInput
                style={s.fieldInput}
                value={formNom}
                onChangeText={setFormNom}
                placeholder="Ex : Compte principal"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Numéro de compte</Text>
              <TextInput
                style={s.fieldInput}
                value={formNumero}
                onChangeText={setFormNumero}
                placeholder="Ex : 00123456789"
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Banque / Institution</Text>
              <TextInput
                style={s.fieldInput}
                value={formBanque}
                onChangeText={setFormBanque}
                placeholder="Ex : BDM SA, Ecobank..."
                placeholderTextColor="#bbb"
              />
              <Text style={s.fieldLabel}>Type de compte</Text>
              <View style={s.chips}>
                {TYPES_COMPTE.map(t => {
                  const cfg = TYPE_CONFIG[t];
                  const active = formType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        s.chipType,
                        active && { backgroundColor: cfg.color, borderColor: cfg.color },
                      ]}
                      onPress={() => setFormType(t)}
                    >
                      <MaterialCommunityIcons
                        name={cfg.icon}
                        size={14}
                        color={active ? '#fff' : '#666'}
                      />
                      <Text style={[s.chipTypeText, active && { color: '#fff', fontWeight: '600' }]}>
                        {cfg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {!isEditing && (
                <>
                  <Text style={s.fieldLabel}>{tr('solde_initial', lang)}</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={formSolde}
                    onChangeText={setFormSolde}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                  />
                </>
              )}
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
    backgroundColor: '#1d4ed8', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Carte compte
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, padding: 14,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Info card (modal)
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 14 },
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
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
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
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: {
    flex: 2, backgroundColor: '#1d4ed8', borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
