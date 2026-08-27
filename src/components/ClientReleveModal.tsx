import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, StyleSheet, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { Text, ActivityIndicator, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getReleveClient } from '../services/api.service';
import { Client } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ClientReleveLigne {
  date?: string;
  type: 'VENTE' | 'VERSEMENT' | 'RETOUR';
  referenceVente?: string;
  referenceReglement?: string;
  venteId?: number;
  produitNom?: string;
  quantite?: number;
  prixUnitaire?: number;
  montantVente?: number | null;
  montantVersement?: number | null;
  resteAPayerApres?: number | null;
  modePaiement?: string;
  utilisateurNom?: string;
}

interface ClientReleveReponse {
  success: boolean;
  client: { id: number; nom: string; prenom?: string; telephone?: string; adresse?: string };
  soldeActuel: number;
  totalVentes: number;
  totalVersements: number;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  lignes: ClientReleveLigne[];
}

type PeriodePreset = 'aujourdhui' | 'hier' | 'semaine' | 'mois' | 'annee' | 'personnalise' | 'tout';
type TypeFiltre = '' | 'VENTE' | 'VERSEMENT';

const PAGE_SIZE = 20;

// ─── Utilitaires ──────────────────────────────────────────────────────────────
function money(v?: number | null) { return (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA'; }

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

function fdate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

function fheure(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// Calcule dateDebut/dateFin (AAAA-MM-JJ) pour un préréglage de période donné
function calculerPeriode(
  preset: PeriodePreset,
  dateDebutPerso: string,
  dateFinPerso: string,
): { dateDebut?: string; dateFin?: string } {
  const now = new Date();
  if (preset === 'aujourdhui') {
    const d = toLocalDate(now);
    return { dateDebut: d, dateFin: d };
  }
  if (preset === 'hier') {
    const hier = new Date(now);
    hier.setDate(now.getDate() - 1);
    const d = toLocalDate(hier);
    return { dateDebut: d, dateFin: d };
  }
  if (preset === 'semaine') {
    const debut = new Date(now);
    const jourSemaine = (now.getDay() + 6) % 7; // 0 = lundi
    debut.setDate(now.getDate() - jourSemaine);
    return { dateDebut: toLocalDate(debut), dateFin: toLocalDate(now) };
  }
  if (preset === 'mois') {
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    return { dateDebut: toLocalDate(debut), dateFin: toLocalDate(now) };
  }
  if (preset === 'annee') {
    const debut = new Date(now.getFullYear(), 0, 1);
    return { dateDebut: toLocalDate(debut), dateFin: toLocalDate(now) };
  }
  if (preset === 'personnalise') {
    return { dateDebut: dateDebutPerso || undefined, dateFin: dateFinPerso || undefined };
  }
  return {}; // 'tout' — pas de filtre, historique complet
}

const TYPE_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  VENTE: { bg: '#eff6ff', fg: '#1a56db', label: 'Vente' },
  VERSEMENT: { bg: '#f0fdf4', fg: '#16a34a', label: 'Versement' },
  RETOUR: { bg: '#fef3c7', fg: '#d97706', label: 'Retour' },
};

// ─── Composant ──────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  client: Client | null;
  onClose: () => void;
}

export default function ClientReleveModal({ visible, client, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClientReleveReponse | null>(null);
  const [erreur, setErreur] = useState('');

  const [periodePreset, setPeriodePreset] = useState<PeriodePreset>('tout');
  const [dateDebutPerso, setDateDebutPerso] = useState('');
  const [dateFinPerso, setDateFinPerso] = useState('');
  const [typeFiltre, setTypeFiltre] = useState<TypeFiltre>('');
  const [page, setPage] = useState(0);

  const charger = useCallback(async (
    clientId: number,
    preset: PeriodePreset,
    dDebut: string,
    dFin: string,
    type: TypeFiltre,
    pageVoulue: number,
  ) => {
    setLoading(true);
    setErreur('');
    try {
      const { dateDebut, dateFin } = calculerPeriode(preset, dDebut, dFin);
      const res = await getReleveClient(clientId, {
        page: pageVoulue,
        size: PAGE_SIZE,
        dateDebut,
        dateFin,
        type: type || undefined,
      });
      const reponse: ClientReleveReponse = res.data;
      setData(reponse);
    } catch {
      setErreur('Impossible de charger le relevé du client');
      setData(null);
    }
    setLoading(false);
  }, []);

  // Ouverture de la modale : réinitialise les filtres et charge la première page
  useEffect(() => {
    if (visible && client) {
      setPeriodePreset('tout');
      setDateDebutPerso('');
      setDateFinPerso('');
      setTypeFiltre('');
      setPage(0);
      charger(client.id, 'tout', '', '', '', 0);
    }
  }, [visible, client, charger]);

  const changerPeriode = (preset: PeriodePreset) => {
    setPeriodePreset(preset);
    setPage(0);
    if (preset === 'personnalise' || !client) return;
    charger(client.id, preset, '', '', typeFiltre, 0);
  };

  const validerPeriodePersonnalisee = () => {
    if (!dateDebutPerso || !dateFinPerso) {
      Alert.alert('Erreur', 'Renseignez les deux dates (AAAA-MM-JJ)');
      return;
    }
    if (!client) return;
    setPage(0);
    charger(client.id, 'personnalise', dateDebutPerso, dateFinPerso, typeFiltre, 0);
  };

  const changerType = (type: TypeFiltre) => {
    setTypeFiltre(type);
    setPage(0);
    if (!client) return;
    charger(client.id, periodePreset, dateDebutPerso, dateFinPerso, type, 0);
  };

  const changerPage = (nouvellePage: number) => {
    if (!client) return;
    if (nouvellePage < 0) return;
    if (data && nouvellePage >= data.totalPages) return;
    setPage(nouvellePage);
    charger(client.id, periodePreset, dateDebutPerso, dateFinPerso, typeFiltre, nouvellePage);
  };

  if (!client) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* ── En-tête ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerNom}>{client.nom}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {[client.telephone, client.adresse].filter(Boolean).join('  ·  ') || '—'}
            </Text>
          </View>
        </View>

        {/* ── Bandeau KPI ─────────────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total ventes</Text>
            <Text style={styles.kpiVal}>{money(data?.totalVentes)}</Text>
          </View>
          <View style={styles.kpiBox}>
            <Text style={styles.kpiLabel}>Total versé</Text>
            <Text style={[styles.kpiVal, { color: '#16a34a' }]}>{money(data?.totalVersements)}</Text>
          </View>
          <View style={[styles.kpiBox, (data?.soldeActuel ?? 0) > 0 && styles.kpiBoxAlert]}>
            <Text style={styles.kpiLabel}>Solde actuel</Text>
            <Text style={[styles.kpiVal, (data?.soldeActuel ?? 0) > 0 && { color: '#dc2626' }]}>
              {money(data?.soldeActuel)}
            </Text>
          </View>
        </View>

        {/* ── Filtre période ──────────────────────────────────────────────── */}
        <View style={styles.periodBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
            {([
              ['tout', 'Tout'],
              ['aujourdhui', "Aujourd'hui"],
              ['hier', 'Hier'],
              ['semaine', 'Cette semaine'],
              ['mois', 'Ce mois'],
              ['annee', 'Cette année'],
              ['personnalise', 'Personnalisée'],
            ] as [PeriodePreset, string][]).map(([p, label]) => (
              <TouchableOpacity
                key={p}
                style={[styles.periodBtn, periodePreset === p && styles.periodBtnActive]}
                onPress={() => changerPeriode(p)}
              >
                <Text style={[styles.periodBtnText, periodePreset === p && styles.periodBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {periodePreset === 'personnalise' && (
            <View style={styles.customDateRow}>
              <TextInput
                mode="outlined"
                dense
                value={dateDebutPerso}
                onChangeText={setDateDebutPerso}
                placeholder="Du (AAAA-MM-JJ)"
                style={styles.dateInput}
              />
              <TextInput
                mode="outlined"
                dense
                value={dateFinPerso}
                onChangeText={setDateFinPerso}
                placeholder="Au (AAAA-MM-JJ)"
                style={styles.dateInput}
              />
              <TouchableOpacity style={styles.applyBtn} onPress={validerPeriodePersonnalisee}>
                <Text style={styles.applyBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Filtre type ─────────────────────────────────────────────────── */}
        <View style={styles.typeRow}>
          {([
            ['', 'Toutes les opérations'],
            ['VENTE', 'Ventes uniquement'],
            ['VERSEMENT', 'Versements uniquement'],
          ] as [TypeFiltre, string][]).map(([t, label]) => (
            <TouchableOpacity
              key={t || 'tout'}
              style={[styles.typeBtn, typeFiltre === t && styles.typeBtnActive]}
              onPress={() => changerType(t)}
            >
              <Text style={[styles.typeBtnText, typeFiltre === t && styles.typeBtnTextActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Liste des lignes ────────────────────────────────────────────── */}
        {loading ? (
          <ActivityIndicator size="large" color="#1a56db" style={{ marginTop: 40 }} />
        ) : erreur ? (
          <Text style={styles.empty}>{erreur}</Text>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
            {(!data || data.lignes.length === 0) ? (
              <Text style={styles.empty}>Aucun mouvement pour cette période</Text>
            ) : (
              data.lignes.map((l, idx) => {
                const badge = TYPE_BADGE[l.type] || TYPE_BADGE.VENTE;
                const reference = l.referenceVente || l.referenceReglement || '—';
                return (
                  <View key={`${l.type}-${l.venteId ?? idx}-${l.date ?? idx}-${idx}`} style={styles.ligneCard}>
                    <View style={styles.ligneTop}>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.label}</Text>
                      </View>
                      <Text style={styles.ligneDate}>{fdate(l.date)}  ·  {fheure(l.date)}</Text>
                    </View>

                    <Text style={styles.ligneRef}>Réf. {reference}</Text>

                    {l.type === 'VENTE' && (
                      <View style={styles.ligneRow}>
                        <Text style={styles.ligneLabel} numberOfLines={1}>{l.produitNom || '—'}</Text>
                        <Text style={styles.ligneQty}>
                          {l.quantite != null ? `${l.quantite} × ${money(l.prixUnitaire)}` : ''}
                        </Text>
                      </View>
                    )}

                    <View style={styles.ligneMontants}>
                      {l.montantVente != null && (
                        <View style={styles.montantBox}>
                          <Text style={styles.montantLabel}>Montant vente</Text>
                          <Text style={[styles.montantVal, { color: '#1a56db' }]}>{money(l.montantVente)}</Text>
                        </View>
                      )}
                      {l.montantVersement != null && (
                        <View style={styles.montantBox}>
                          <Text style={styles.montantLabel}>Montant versé</Text>
                          <Text style={[styles.montantVal, { color: '#16a34a' }]}>{money(l.montantVersement)}</Text>
                        </View>
                      )}
                      {l.resteAPayerApres != null && (
                        <View style={styles.montantBox}>
                          <Text style={styles.montantLabel}>Reste à payer</Text>
                          <Text style={[styles.montantVal, { color: l.resteAPayerApres > 0 ? '#dc2626' : '#16a34a' }]}>
                            {money(l.resteAPayerApres)}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.ligneFoot}>
                      {l.modePaiement ? <Text style={styles.ligneFootTxt}>Mode : {l.modePaiement}</Text> : null}
                      {l.utilisateurNom ? <Text style={styles.ligneFootTxt}>Par {l.utilisateurNom}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {data && data.totalPages > 0 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageBtn, page <= 0 && styles.pageBtnDisabled]}
              disabled={page <= 0}
              onPress={() => changerPage(page - 1)}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={page <= 0 ? '#cbd5e1' : '#1a56db'} />
              <Text style={[styles.pageBtnText, page <= 0 && styles.pageBtnTextDisabled]}>Précédent</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>
              Page {data.page + 1} / {data.totalPages}  ({data.totalElements} mouvement{data.totalElements > 1 ? 's' : ''})
            </Text>
            <TouchableOpacity
              style={[styles.pageBtn, page >= data.totalPages - 1 && styles.pageBtnDisabled]}
              disabled={page >= data.totalPages - 1}
              onPress={() => changerPage(page + 1)}
            >
              <Text style={[styles.pageBtnText, page >= data.totalPages - 1 && styles.pageBtnTextDisabled]}>Suivant</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={page >= data.totalPages - 1 ? '#cbd5e1' : '#1a56db'} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  header: {
    backgroundColor: '#081648', flexDirection: 'row', alignItems: 'center',
    padding: 14, paddingTop: 50,
  },
  backBtn: { padding: 6, marginRight: 8 },
  backArrow: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  headerNom: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  headerSub: { color: '#93c5fd', fontSize: 12, marginTop: 2 },

  // KPI
  kpiRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  kpiBox: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  kpiBoxAlert: { backgroundColor: '#fef2f2', borderColor: '#fca5a5' },
  kpiLabel: { color: '#64748b', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  kpiVal: { color: '#081648', fontWeight: 'bold', fontSize: 13, marginTop: 3, textAlign: 'center' },

  // Filtre période
  periodBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 8 },
  periodRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  periodBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  periodBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },
  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 4 },
  dateInput: { flex: 1, backgroundColor: '#fff', height: 40 },
  applyBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Filtre type
  typeRow: { flexDirection: 'row', gap: 6, backgroundColor: '#fff', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  typeBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  typeBtnActive: { backgroundColor: '#081648', borderColor: '#081648' },
  typeBtnText: { fontSize: 11, color: '#666', fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },

  // Empty state
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 14 },

  // Ligne / carte de mouvement
  ligneCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  ligneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  ligneDate: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  ligneRef: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
  ligneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  ligneLabel: { color: '#1e293b', fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  ligneQty: { color: '#475569', fontSize: 12 },

  ligneMontants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  montantBox: { backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  montantLabel: { color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' },
  montantVal: { fontWeight: 'bold', fontSize: 13, marginTop: 2 },

  ligneFoot: { flexDirection: 'row', gap: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 6 },
  ligneFootTxt: { color: '#94a3b8', fontSize: 11 },

  // Pagination
  pagination: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  pageBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 6 },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { color: '#1a56db', fontSize: 13, fontWeight: '600' },
  pageBtnTextDisabled: { color: '#cbd5e1' },
  pageInfo: { color: '#64748b', fontSize: 11, textAlign: 'center', flex: 1 },
});
