import React, { useEffect, useState, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, Alert, RefreshControl,
  ScrollView, TouchableOpacity, Pressable,
  Modal as RNModal, TextInput as RNTextInput,
} from 'react-native';
import {
  Text, Card, FAB, ActivityIndicator, Modal, Portal,
  TextInput, Button, Divider,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import {
  getDepenses, createDepense, updateDepense, deleteDepense, getPaiementsEmploye,
  getTypesDepense, createTypeDepense, updateTypeDepense, deleteTypeDepense,
} from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

interface TypeDepense { id: number; nom: string; }

function buildDepensesPdfHtml(
  depenses: any[],
  total: number,
  totauxParType: { type: string; total: number }[],
  filtreTitre: string,
) {
  const lignes = depenses.map((d, i) => `<tr style="background:${d.sourceExterne ? '#fffbeb' : (i % 2 === 0 ? '#fff' : '#f8fafc')}">
    <td>${d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '—'}</td>
    <td>${d.nom}${d.sourceExterne ? ' <span style="font-size:10px;background:#f59e0b;color:#fff;padding:1px 5px;border-radius:3px">Salaire</span>' : ''}</td>
    <td>${d.typeDepense || '—'}</td>
    <td>${d.motif || '—'}${d.periodeDebut ? ` (${d.periodeDebut}${d.periodeFin ? '→' + d.periodeFin : ''})` : ''}</td>
    <td style="text-align:right;font-weight:700;color:#dc2626">${(d.montant || 0).toLocaleString('fr-FR')} FCFA</td>
  </tr>`).join('');

  const typesHtml = totauxParType.map(t => `<tr>
    <td>${t.type}</td>
    <td style="text-align:right;font-weight:700">${t.total.toLocaleString('fr-FR')} FCFA</td>
  </tr>`).join('');

  const qrData = encodeURIComponent(`DEPENSES ${filtreTitre}\nTotal: ${total.toLocaleString('fr-FR')} FCFA\nNombre: ${depenses.length}\nDate: ${new Date().toLocaleDateString('fr-FR')}`);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Dépenses — ${filtreTitre}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:20px;font-size:12px}
.sheet{background:#fff;max-width:800px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(220,38,38,.08)}
.hdr{background:linear-gradient(135deg,#7f1d1d,#dc2626);color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
.hdr-title{font-size:20px;font-weight:900}.hdr-sub{font-size:12px;opacity:.7;margin-top:4px}
.total-box{background:#fef2f2;border-bottom:1px solid #fecaca;padding:20px;text-align:center}
.total-val{font-size:32px;font-weight:900;color:#dc2626}
.total-lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px}
.section{padding:20px 24px}.section-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #dc2626}
table{width:100%;border-collapse:collapse}
th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
.ftr{background:#f8fafc;text-align:center;padding:14px;font-size:10px;color:#94a3b8;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div>
      <div class="hdr-title">DÉPENSES</div>
      <div class="hdr-sub">${filtreTitre} · ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" onerror="this.style.display='none'">
  </div>
  <div class="total-box">
    <div class="total-lbl">TOTAL DÉPENSES</div>
    <div class="total-val">${total.toLocaleString('fr-FR')} FCFA</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px">${depenses.length} dépense(s)</div>
  </div>
  ${totauxParType.length > 0 ? `
  <div class="section">
    <div class="section-title">Répartition par type</div>
    <table><thead><tr><th>Type</th><th>Total</th></tr></thead><tbody>${typesHtml}</tbody></table>
  </div>` : ''}
  <div class="section">
    <div class="section-title">Détail des dépenses</div>
    <table><thead><tr><th>Date</th><th>Nom</th><th>Type</th><th>Motif</th><th>Montant</th></tr></thead>
    <tbody>${lignes || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Aucune dépense</td></tr>'}</tbody></table>
  </div>
  <div class="ftr">Ges Boutique · Document généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
</body></html>`;
}

export default function DepensesScreen() {
  const { lang } = useLang();

  const [depenses, setDepenses] = useState<any[]>([]);
  const [paiementsEmploye, setPaiementsEmploye] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nom: '',
    montant: '',
    motif: '',
    typeDepense: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [totauxParType, setTotauxParType] = useState<{ type: string; total: number }[]>([]);

  // ── Types dépenses dynamiques ──
  const [typesDepense, setTypesDepense] = useState<TypeDepense[]>([]);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [typesError, setTypesError] = useState('');
  const [typesLoading, setTypesLoading] = useState(false);

  // ── Filtres ──
  const [filtreType, setFiltreType] = useState('');
  const [filtreMois, setFiltreMois] = useState('');
  const [showTypePicker2, setShowTypePicker2] = useState(false);

  // ── Pagination ──
  const [pageDepenses, setPageDepenses] = useState(1);
  const ITEMS_PAGE = 10;

  const loadTypes = async () => {
    try {
      const r = await getTypesDepense();
      const rawTypes = Array.isArray(r.data) ? r.data : (r.data?.types || []);
      setTypesDepense(rawTypes.sort((a: TypeDepense, b: TypeDepense) => a.nom.localeCompare(b.nom)));
    } catch {}
  };

  const charger = async () => {
    try {
      const [resD, resP] = await Promise.all([getDepenses(), getPaiementsEmploye().catch(() => ({ data: [] }))]);
      const liste: any[] = resD.data?.depenses || resD.data?.data || [];
      const salaires: any[] = (Array.isArray(resP.data) ? resP.data : [])
        .filter((p: any) => p.statut === 'PAYE')
        .map((p: any) => ({
          id: 'emp_' + p.id,
          nom: p.employeNomComplet,
          motif: p.employePoste || 'Salaire',
          date: (p.datePaiement || '').split('T')[0],
          montant: p.montant,
          typeDepense: 'Salaire',
          periodeDebut: p.periodeDebut,
          periodeFin: p.periodeFin,
          sourceExterne: true,
        }));
      setDepenses(liste);
      setPaiementsEmploye(salaires);
      const toutes = [...liste, ...salaires];
      const map = new Map<string, number>();
      for (const d of toutes) {
        if (d.typeDepense) map.set(d.typeDepense, (map.get(d.typeDepense) || 0) + (d.montant || 0));
      }
      setTotauxParType(
        Array.from(map.entries())
          .map(([type, total]) => ({ type, total }))
          .sort((a, b) => b.total - a.total),
      );
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { charger(); loadTypes(); }, []);

  const ajouterType = async () => {
    if (!newTypeName.trim()) return;
    setTypesLoading(true);
    try {
      const r = await createTypeDepense(newTypeName.trim());
      const t: TypeDepense = r.data?.type;
      setTypesDepense(prev => [...prev, t].sort((a, b) => a.nom.localeCompare(b.nom)));
      setNewTypeName('');
      setTypesError('');
    } catch (e: any) {
      setTypesError(e?.response?.data?.message || 'Erreur création type');
    } finally { setTypesLoading(false); }
  };

  const saveEditType = async () => {
    if (!editingTypeId || !editingTypeName.trim()) return;
    setTypesLoading(true);
    try {
      const r = await updateTypeDepense(editingTypeId, editingTypeName.trim());
      const updated: TypeDepense = r.data?.type;
      setTypesDepense(prev => prev.map(t => t.id === updated.id ? updated : t).sort((a, b) => a.nom.localeCompare(b.nom)));
      setEditingTypeId(null); setEditingTypeName(''); setTypesError('');
    } catch (e: any) {
      setTypesError(e?.response?.data?.message || 'Erreur modification type');
    } finally { setTypesLoading(false); }
  };

  const supprimerType = async (type: TypeDepense) => {
    Alert.alert(tr('supprimer', lang), `Supprimer le type "${type.nom}" ?`, [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
        setTypesLoading(true);
        try {
          await deleteTypeDepense(type.id);
          setTypesDepense(prev => prev.filter(t => t.id !== type.id));
          setTypesError('');
        } catch (e: any) {
          setTypesError(e?.response?.data?.message || 'Ce type est utilisé par des dépenses');
        } finally { setTypesLoading(false); }
      }},
    ]);
  };

  const ouvrirCreation = () => {
    setEditing(null);
    setForm({
      nom: '',
      montant: '',
      motif: '',
      typeDepense: '',
      date: new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const ouvrirEdition = (d: any) => {
    setEditing(d);
    setForm({
      nom: d.nom || '',
      montant: String(d.montant || ''),
      motif: d.motif || '',
      typeDepense: d.typeDepense || '',
      date: d.date || new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const sauvegarder = async () => {
    if (!form.nom || !form.montant) return;
    try {
      const payload = {
        nom: form.nom,
        montant: parseFloat(form.montant),
        motif: form.motif,
        typeDepense: form.typeDepense,
        date: form.date,
      };
      if (editing) {
        await updateDepense(editing.id, payload);
      } else {
        await createDepense(payload);
      }
      setShowModal(false);
      charger();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer la dépense');
    }
  };

  const supprimer = (d: any) => {
    Alert.alert(
      tr('supprimer', lang) + ' ?',
      `${d.nom} — ${d.montant?.toLocaleString('fr-FR')} FCFA`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('supprimer', lang), style: 'destructive', onPress: async () => {
            try { await deleteDepense(d.id); charger(); } catch { }
          },
        },
      ],
    );
  };

  // ── Données filtrées (dépenses DB + salaires) ──
  const toutesDepenses = [...depenses, ...paiementsEmploye];

  const depensesFiltrees = toutesDepenses.filter(d => {
    if (filtreType && (d.typeDepense || '') !== filtreType) return false;
    if (filtreMois && d.date) {
      const moisDepense = d.date.substring(0, 7);
      if (moisDepense !== filtreMois) return false;
    }
    return true;
  });

  const totalFiltre = depensesFiltrees.reduce((s, d) => s + (d.montant || 0), 0);

  const totauxFiltres = (() => {
    const map = new Map<string, number>();
    for (const d of depensesFiltrees) {
      if (d.typeDepense) map.set(d.typeDepense, (map.get(d.typeDepense) || 0) + (d.montant || 0));
    }
    return Array.from(map.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);
  })();

  const filtreActif = filtreType !== '' || filtreMois !== '';

  // ── Pagination dépenses ──
  const depensesPaginees = useMemo(
    () => depensesFiltrees.slice((pageDepenses - 1) * ITEMS_PAGE, pageDepenses * ITEMS_PAGE),
    [depensesFiltrees, pageDepenses],
  );
  const totalPagesDepenses = useMemo(
    () => Math.max(1, Math.ceil(depensesFiltrees.length / ITEMS_PAGE)),
    [depensesFiltrees],
  );

  // Reset page quand les filtres changent
  useEffect(() => { setPageDepenses(1); }, [filtreType, filtreMois]);

  const filtreTitre = (() => {
    const parts: string[] = [];
    if (filtreType) parts.push(filtreType);
    if (filtreMois) parts.push(filtreMois);
    return parts.length > 0 ? parts.join(' · ') : 'Toutes';
  })();

  const genererPdf = async () => {
    try {
      const html = buildDepensesPdfHtml(depensesFiltrees, totalFiltre, totauxFiltres, filtreTitre);
      await Print.printAsync({ html });
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de générer le PDF');
    }
  };

  const genererRecuSalaire = async (dep: any) => {
    const qrData = encodeURIComponent(`SALAIRE\nEmployé: ${dep.nom || dep.employeNomComplet || ''}\nPoste: ${dep.employePoste || ''}\nMontant: ${dep.montant} FCFA\nDate: ${dep.date || dep.datePaiement || ''}`);
    const montantFmt = (dep.montant || 0).toLocaleString('fr-FR');
    const salaireFmt = (dep.salaireMensuel || 0).toLocaleString('fr-FR');
    const nom = dep.nom || dep.employeNomComplet || '—';
    const poste = dep.employePoste || dep.motif || '—';
    const nbMois = dep.nombreMois || 1;
    const periodeDebut = dep.periodeDebut || '—';
    const periodeFin = dep.periodeFin && dep.periodeFin !== dep.periodeDebut ? ' → ' + dep.periodeFin : '';
    const datePaiement = dep.date || dep.datePaiement || '—';

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Reçu — ${nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f0f4f8;padding:20px;font-size:13px;color:#1e293b}
.sheet{background:#fff;max-width:520px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(5,80,40,.1)}
.hdr{background:linear-gradient(135deg,#064e3b,#10b981);color:#fff;padding:20px 22px;display:flex;justify-content:space-between;align-items:center}
.hdr-title{font-size:18px;font-weight:900}.hdr-sub{font-size:11px;opacity:.7;margin-top:3px}
.recu-label{text-align:center;padding:12px;font-size:11px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0}
.body{padding:16px 22px}
.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}
.lbl{color:#64748b;font-size:12px}.val{font-weight:700;color:#1e293b;font-size:12px;text-align:right;max-width:60%}
.montant-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;padding:18px;text-align:center;margin:16px 0}
.montant-val{font-size:2rem;font-weight:900;color:#166534}
.montant-lbl{font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-top:4px}
.stamp{display:inline-block;border:3px solid #10b981;border-radius:8px;padding:5px 14px;color:#064e3b;font-weight:900;font-size:14px;letter-spacing:2px;transform:rotate(-3deg);margin:8px auto}
.ftr{background:linear-gradient(135deg,#064e3b,#10b981);color:rgba(255,255,255,.6);text-align:center;padding:10px;font-size:10px}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div><div class="hdr-title">REÇU DE PAIEMENT</div><div class="hdr-sub">Ges Boutique — Paiement Employé</div></div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}" width="68" height="68" style="border-radius:8px;background:#fff;padding:3px" onerror="this.style.display='none'">
  </div>
  <div class="recu-label">Reçu de salaire</div>
  <div class="body">
    <div class="row"><span class="lbl">Employé</span><span class="val">${nom}</span></div>
    <div class="row"><span class="lbl">Poste</span><span class="val">${poste}</span></div>
    ${salaireFmt !== '0' ? `<div class="row"><span class="lbl">Salaire mensuel</span><span class="val">${salaireFmt} FCFA</span></div>` : ''}
    <div class="row"><span class="lbl">Nombre de mois</span><span class="val">${nbMois} mois</span></div>
    <div class="row"><span class="lbl">Période</span><span class="val">${periodeDebut}${periodeFin}</span></div>
    <div class="row"><span class="lbl">Date de paiement</span><span class="val">${datePaiement}</span></div>
    <div class="montant-box">
      <div class="montant-lbl">Montant payé</div>
      <div class="montant-val">${montantFmt} FCFA</div>
    </div>
    <div style="text-align:center"><div class="stamp">✓ PAYÉ</div></div>
  </div>
  <div class="ftr">Ges Boutique · Reçu généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</div></body></html>`;

    try {
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert(tr('erreur', lang), 'Impossible de générer le reçu');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.totalBanner}>
        <Text style={styles.totalLabel}>
          {filtreActif ? `${tr('depenses', lang)} — ${filtreTitre}` : `Total ${tr('depenses', lang).toLowerCase()}`}
        </Text>
        <Text style={styles.totalVal}>{totalFiltre.toLocaleString('fr-FR')} FCFA</Text>
        {filtreActif && (
          <Text style={styles.totalSub}>{depensesFiltrees.length} sur {toutesDepenses.length} dépenses</Text>
        )}
      </View>

      <FlatList
        data={depensesPaginees}
        keyExtractor={d => String(d.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); charger(); }}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* ── Section filtres ── */}
            <View style={styles.filtresSection}>
              <View style={styles.filtresHeader}>
                <Text style={styles.filtresTitle}>Filtres</Text>
                {filtreActif && (
                  <TouchableOpacity onPress={() => { setFiltreType(''); setFiltreMois(''); setShowTypePicker2(false); }}>
                    <Text style={styles.resetFiltres}>Réinitialiser</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Filtre type */}
              <Pressable
                style={styles.filtreTypeTrigger}
                onPress={() => setShowTypePicker2(v => !v)}
              >
                <Text style={filtreType ? styles.filtreTypeValue : styles.filtreTypePh}>
                  {filtreType || 'Filtrer par type'}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>{showTypePicker2 ? '▲' : '▼'}</Text>
              </Pressable>

              {showTypePicker2 && (
                <View style={styles.filtreTypePicker}>
                  <TouchableOpacity
                    style={styles.filtreTypeItem}
                    onPress={() => { setFiltreType(''); setShowTypePicker2(false); }}
                  >
                    <Text style={[styles.filtreTypeText, !filtreType && { color: '#f44336', fontWeight: 'bold' }]}>
                      Tous les types
                    </Text>
                  </TouchableOpacity>
                  {typesDepense.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={styles.filtreTypeItem}
                      onPress={() => { setFiltreType(t.nom); setShowTypePicker2(false); }}
                    >
                      <Text style={[styles.filtreTypeText, filtreType === t.nom && { color: '#f44336', fontWeight: 'bold' }]}>
                        {t.nom}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Filtre mois */}
              <TextInput
                label="Filtrer par mois (ex: 2026-07)"
                value={filtreMois}
                onChangeText={t => setFiltreMois(t)}
                mode="outlined"
                style={styles.filtreMoisInput}
                dense
              />

              {/* Bouton PDF */}
              <TouchableOpacity style={styles.pdfBtn} onPress={genererPdf}>
                <Text style={styles.pdfBtnText}>Télécharger PDF</Text>
              </TouchableOpacity>
            </View>

            {/* ── Répartition par type (sur données filtrées) ── */}
            {totauxFiltres.length > 0 && (
              <View style={styles.typeSummary}>
                <Text style={styles.typeSummaryTitle}>Répartition par type</Text>
                {totauxFiltres.map(t => (
                  <View key={t.type} style={styles.typeRow}>
                    <Text style={styles.typeLabel}>{t.type}</Text>
                    <Text style={styles.typeTotal}>{t.total.toLocaleString('fr-FR')} FCFA</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        }
        renderItem={({ item: d }) => (
          <Card style={[styles.card, d.sourceExterne && { backgroundColor: '#fffbeb' }]}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={{ flex: 1 }}>{d.nom}</Text>
                <Text style={styles.montant}>{d.montant?.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              <View style={styles.badgeWrap}>
                {d.typeDepense ? <Text style={styles.badge}>{d.typeDepense}</Text> : null}
                {d.sourceExterne ? (
                  <Text style={[styles.badge, { backgroundColor: '#fef3c7', color: '#b45309', marginLeft: 4 }]}>Via Employés</Text>
                ) : null}
              </View>
              {d.motif ? <Text style={styles.sub}>{d.motif}{d.periodeDebut ? ` (${d.periodeDebut}${d.periodeFin ? '→' + d.periodeFin : ''})` : ''}</Text> : null}
              <Text style={styles.date}>
                {d.date ? new Date(d.date).toLocaleDateString('fr-FR') : ''}
              </Text>
              {!d.sourceExterne && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => ouvrirEdition(d)}>
                    <Text style={{ color: '#1e88e5', fontSize: 13 }}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => supprimer(d)}>
                    <Text style={{ color: '#f44336', fontSize: 13 }}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              )}
              {d.sourceExterne && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.recuBtn} onPress={() => genererRecuSalaire(d)}>
                    <Text style={styles.recuBtnText}>Reçu PDF</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card.Content>
          </Card>
        )}
        ListFooterComponent={
          totalPagesDepenses > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                onPress={() => setPageDepenses(p => Math.max(1, p - 1))}
                disabled={pageDepenses === 1}
              >
                <Text style={[styles.paginationBtn, pageDepenses === 1 && styles.paginationDisabled]}>
                  Precedent
                </Text>
              </TouchableOpacity>
              <Text style={styles.paginationInfo}>Page {pageDepenses}/{totalPagesDepenses}</Text>
              <TouchableOpacity
                onPress={() => setPageDepenses(p => Math.min(totalPagesDepenses, p + 1))}
                disabled={pageDepenses === totalPagesDepenses}
              >
                <Text style={[styles.paginationBtn, pageDepenses === totalPagesDepenses && styles.paginationDisabled]}>
                  Suivant
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={<Text style={styles.empty}>{tr('aucune_depense', lang)}{filtreActif ? ` (${tr('aucun_resultat', lang).toLowerCase()})` : ''}</Text>}
      />

      <FAB icon="plus" style={styles.fab} onPress={() => ouvrirCreation()} />

      {/* Modal Types Dépenses */}
      <RNModal
        visible={showTypesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTypesModal(false)}
      >
        <View style={styles.typesModalOverlay}>
          <View style={styles.typesModalSheet}>
            {/* Header */}
            <View style={styles.typesModalHeader}>
              <Text style={styles.typesModalTitle}>{tr('type_depense', lang)}</Text>
              <TouchableOpacity onPress={() => {
                setShowTypesModal(false);
                setNewTypeName('');
                setEditingTypeId(null);
                setTypesError('');
              }}>
                <Ionicons name="close-circle" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Erreur */}
            {typesError ? (
              <Text style={styles.typesError}>{typesError}</Text>
            ) : null}

            {/* Liste */}
            <ScrollView style={{ maxHeight: 300 }}>
              {typesDepense.map(t => (
                <View key={t.id} style={styles.typesRow}>
                  {editingTypeId === t.id ? (
                    <>
                      <RNTextInput
                        value={editingTypeName}
                        onChangeText={setEditingTypeName}
                        style={styles.typesEditInput}
                      />
                      <TouchableOpacity onPress={saveEditType} style={{ marginLeft: 8 }}>
                        <Ionicons name="checkmark-circle" size={24} color="green" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingTypeId(null); setEditingTypeName(''); }} style={{ marginLeft: 4 }}>
                        <Ionicons name="close-circle" size={24} color="#999" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.typesItemText}>{t.nom}</Text>
                      <TouchableOpacity onPress={() => { setEditingTypeId(t.id); setEditingTypeName(t.nom); }} style={{ marginLeft: 8 }}>
                        <Ionicons name="pencil-outline" size={20} color="#1A56DB" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => supprimerType(t)} style={{ marginLeft: 8 }}>
                        <Ionicons name="trash-outline" size={20} color="#DC2626" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Ajouter */}
            <View style={styles.typesAddRow}>
              <RNTextInput
                value={newTypeName}
                onChangeText={setNewTypeName}
                placeholder="Nouveau type..."
                style={styles.typesAddInput}
              />
              <TouchableOpacity
                onPress={ajouterType}
                disabled={typesLoading || !newTypeName.trim()}
                style={[styles.typesAddBtn, (!newTypeName.trim() || typesLoading) && { opacity: 0.5 }]}
              >
                <Ionicons name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => { setShowModal(false); setShowTypePicker(false); }}
          contentContainerStyle={styles.modal}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>
              {editing ? tr('modifier', lang) : tr('nouvelle_depense', lang)}
            </Text>

            <TextInput
              label={tr('nom_client', lang)}
              value={form.nom}
              onChangeText={t => setForm({ ...form, nom: t })}
              mode="outlined"
              style={styles.input}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Pressable
                style={[styles.typePickerTrigger, { flex: 1, marginBottom: 0 }]}
                onPress={() => setShowTypePicker(v => !v)}
              >
                <Text style={form.typeDepense ? styles.typePickerValue : styles.typePickerPlaceholder}>
                  {form.typeDepense || 'Type de dépense'}
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>{showTypePicker ? '▲' : '▼'}</Text>
              </Pressable>
              <TouchableOpacity
                onPress={() => { setShowTypesModal(true); setTypesError(''); }}
                style={{ padding: 8 }}
              >
                <Ionicons name="settings-outline" size={20} color="#1A56DB" />
              </TouchableOpacity>
            </View>

            {showTypePicker && (
              <View style={styles.typePicker}>
                {typesDepense.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.typePickerItem}
                    onPress={() => {
                      setForm({ ...form, typeDepense: t.nom });
                      setShowTypePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.typePickerText,
                        form.typeDepense === t.nom && { color: '#f44336', fontWeight: 'bold' },
                      ]}
                    >
                      {t.nom}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              label="Montant *"
              value={form.montant}
              onChangeText={t => setForm({ ...form, montant: t })}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />

            <TextInput
              label="Motif"
              value={form.motif}
              onChangeText={t => setForm({ ...form, motif: t })}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Date (YYYY-MM-DD)"
              value={form.date}
              onChangeText={t => setForm({ ...form, date: t })}
              mode="outlined"
              style={styles.input}
            />

            <Button mode="contained" onPress={sauvegarder} style={{ marginTop: 4 }}>
              {editing ? tr('modifier', lang) : tr('ajouter', lang)}
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  totalBanner: { backgroundColor: '#f44336', padding: 16, alignItems: 'center' },
  totalLabel: { color: '#fff', fontSize: 12 },
  totalVal: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  totalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  card: { marginBottom: 10, borderRadius: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold', color: '#f44336' },
  badgeWrap: { marginTop: 4 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef2f2',
    color: '#f44336',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sub: { color: '#888', fontSize: 12, marginTop: 4 },
  date: { color: '#aaa', fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 20, maxHeight: '85%' },
  input: { marginBottom: 12 },
  // Filtres
  filtresSection: { backgroundColor: '#fff', marginBottom: 12, borderRadius: 12, padding: 14, elevation: 2 },
  filtresHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filtresTitle: { fontWeight: 'bold', fontSize: 13, color: '#1e293b' },
  resetFiltres: { color: '#f44336', fontSize: 12, fontWeight: '600' },
  filtreTypeTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  filtreTypeValue: { color: '#1e293b', fontSize: 13, fontWeight: '500' },
  filtreTypePh: { color: '#94a3b8', fontSize: 13 },
  filtreTypePicker: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 200 },
  filtreTypeItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filtreTypeText: { color: '#334155', fontSize: 13 },
  filtreMoisInput: { marginBottom: 10 },
  pdfBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  pdfBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  // Type picker dans le formulaire
  typePickerTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  typePickerValue: { color: '#1e293b', fontSize: 14 },
  typePickerPlaceholder: { color: '#94a3b8', fontSize: 14 },
  typeSummary: { backgroundColor: '#fff', marginBottom: 12, borderRadius: 12, padding: 14, elevation: 2 },
  typeSummaryTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 8, color: '#1e293b' },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  typeLabel: { color: '#475569', fontSize: 13 },
  typeTotal: { fontWeight: '600', color: '#f44336', fontSize: 13 },
  typePicker: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  typePickerItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  typePickerText: { color: '#334155', fontSize: 13 },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  recuBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  recuBtnText: { color: '#166534', fontSize: 12, fontWeight: '700' },
  // Pagination
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8, marginTop: 4, marginBottom: 8 },
  paginationBtn: { fontSize: 14, color: '#dc2626', fontWeight: '700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#dc2626', backgroundColor: '#fff' },
  paginationDisabled: { color: '#ccc', borderColor: '#eee', backgroundColor: '#fafafa' },
  paginationInfo: { fontSize: 13, color: '#555', fontWeight: '600' },
  // Modal types dépenses
  typesModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  typesModalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' as any, padding: 20 },
  typesModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  typesModalTitle: { fontSize: 18, fontWeight: '700' },
  typesError: { color: 'red', fontSize: 13, marginBottom: 8 },
  typesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  typesItemText: { flex: 1, fontSize: 15 },
  typesEditInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  typesAddRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  typesAddInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  typesAddBtn: { backgroundColor: '#1A56DB', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
});
