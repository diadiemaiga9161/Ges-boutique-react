import React, { useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, FlatList, StyleSheet, Alert, RefreshControl,
  ScrollView, TouchableOpacity, Pressable, Linking,
  Modal as RNModal, TextInput as RNTextInput,
} from 'react-native';
import {
  Text, Card, FAB, ActivityIndicator, Modal, Portal,
  TextInput, Button, Divider, Searchbar,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import {
  getDepenses, createDepense, updateDepense, deleteDepense, getPaiementsEmploye,
  getTypesDepense, createTypeDepense, updateTypeDepense, deleteTypeDepense,
  getDepensesParPeriode, getEmployes,
} from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { sauvegarderCache, lireCache, creerDepenseOffline } from '../services/offline.service';
import { useMontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';

interface TypeDepense { id: number; nom: string; }

function getIconeType(nom: string): string {
  const n = (nom || '').toLowerCase();
  if (/loyer|maison|location|logement|appartement|bail/.test(n)) return 'home-outline';
  if (/transport|carburant|essence|voiture|taxi|moto|bus|v.hicule/.test(n)) return 'car-outline';
  if (/lectricit|courant|nergie|lumi.re|kwh/.test(n)) return 'flash-outline';
  if (/eau/.test(n)) return 'water-outline';
  if (/nourriture|alimentation|repas|restaurant|manger|vivres|provisions|courses/.test(n)) return 'restaurant-outline';
  if (/t.l.phone|mobile|forfait|appel/.test(n)) return 'call-outline';
  if (/internet|wifi|connexion|web|fibre/.test(n)) return 'wifi-outline';
  if (/salaire|employ|paie|personnel/.test(n)) return 'people-outline';
  if (/fourniture|mat.riel|bureau|papeterie/.test(n)) return 'construct-outline';
  if (/sant|m.decin|pharmacie|m.dicament|h.pital/.test(n)) return 'medkit-outline';
  if (/publicit|marketing|pub|annonce/.test(n)) return 'megaphone-outline';
  if (/entretien|nettoyage|maintenance|r.paration/.test(n)) return 'build-outline';
  if (/imp.t|taxe|fiscalit|douane/.test(n)) return 'receipt-outline';
  if (/assurance/.test(n)) return 'shield-checkmark-outline';
  if (/formation|.cole|.ducation|cours|stage/.test(n)) return 'school-outline';
  return 'pricetag-outline';
}

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
    <td style="text-align:right;font-weight:700;color:#dc2626">${(d.montant || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
  </tr>`).join('');

  const typesHtml = totauxParType.map(t => `<tr>
    <td>${t.type}</td>
    <td style="text-align:right;font-weight:700">${t.total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
  </tr>`).join('');

  const qrData = encodeURIComponent(`DEPENSES ${filtreTitre}\nTotal: ${total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA\nNombre: ${depenses.length}\nDate: ${new Date().toLocaleDateString('fr-FR')}`);

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
    <div class="total-val">${total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</div>
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
  const colors = useColors();

  // Créer/modifier/supprimer une dépense déduit ou ajuste directement le solde
  // de la caisse côté backend (@PreAuthorize hasRole('ADMIN')) — cet écran doit
  // masquer ces actions pour VENDEUR, qui ne doit avoir qu'un accès lecture.
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (!raw) return;
      try {
        const role: string = JSON.parse(raw)?.role || '';
        setIsAdmin(role === 'ROLE_ADMIN' || role === 'ADMIN');
      } catch {}
    });
  }, []);

  const [depenses, setDepenses] = useState<any[]>([]);
  const [paiementsEmploye, setPaiementsEmploye] = useState<any[]>([]);
  const [employes, setEmployes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [searchDepense, setSearchDepense] = useState('');
  const [showOfflineBadge, setShowOfflineBadge] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    nom: '',
    montant: 0,
    motif: '',
    typeDepense: '',
    date: new Date().toISOString().split('T')[0],
  });
  const montantInput = useMontantInput(form.montant, v => setForm(f => ({ ...f, montant: v })));
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
  // Filtre période (Du/Au) — GET /depenses/periode, comme filtrerPeriode() côté
  // Ionic. Ne remplace que `depenses` (les paiements employés affichés restent
  // ceux du chargement initial, à l'identique de depenses.page.ts).
  const [dateDebutFiltre, setDateDebutFiltre] = useState('');
  const [dateFinFiltre, setDateFinFiltre] = useState('');
  const [periodeLoading, setPeriodeLoading] = useState(false);

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
      const [resD, resP, resE] = await Promise.all([
        getDepenses(),
        getPaiementsEmploye().catch(() => ({ data: [] })),
        getEmployes().catch(() => ({ data: [] })),
      ]);
      const liste: any[] = resD.data?.depenses || resD.data?.data || [];
      const salaires: any[] = (Array.isArray(resP.data) ? resP.data : [])
        .filter((p: any) => p.statut === 'PAYE')
        .map((p: any) => ({
          id: 'emp_' + p.id,
          employeId: p.employeId,
          nom: p.employeNomComplet,
          motif: p.employePoste || 'Salaire',
          date: (p.datePaiement || '').split('T')[0],
          montant: p.montant,
          typeDepense: 'Salaire',
          periodeDebut: p.periodeDebut,
          periodeFin: p.periodeFin,
          salaireMensuel: p.salaireMensuel,
          nombreMois: p.nombreMois,
          employePoste: p.employePoste,
          sourceExterne: true,
        }));
      setDepenses(liste);
      setPaiementsEmploye(salaires);
      setEmployes(Array.isArray(resE.data) ? resE.data : (resE.data?.data || resE.data?.employes || []));
      const toutes = [...liste, ...salaires];
      sauvegarderCache('depenses', toutes).catch(() => {});
      setFromCache(false);
      setShowOfflineBadge(false);
      const map = new Map<string, number>();
      for (const d of toutes) {
        if (d.typeDepense) map.set(d.typeDepense, (map.get(d.typeDepense) || 0) + (d.montant || 0));
      }
      setTotauxParType(
        Array.from(map.entries())
          .map(([type, total]) => ({ type, total }))
          .sort((a, b) => b.total - a.total),
      );
    } catch {
      const cached = await lireCache<any>('depenses');
      if (cached.length > 0) {
        setDepenses(cached.filter((d: any) => !d.sourceExterne));
        setPaiementsEmploye(cached.filter((d: any) => !!d.sourceExterne));
        setFromCache(true);
        const map = new Map<string, number>();
        for (const d of cached) {
          if (d.typeDepense) map.set(d.typeDepense, (map.get(d.typeDepense) || 0) + (d.montant || 0));
        }
        setTotauxParType(Array.from(map.entries()).map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total));
      } else {
        setFromCache(false);
      }
    }
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
      montant: 0,
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
      montant: d.montant || 0,
      motif: d.motif || '',
      typeDepense: d.typeDepense || '',
      date: d.date || new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const sauvegarder = async () => {
    if (!form.nom?.trim()) { Alert.alert(tr('erreur', lang), 'Le nom est obligatoire'); return; }
    if (!form.montant || form.montant <= 0) { Alert.alert(tr('erreur', lang), 'Le montant doit être supérieur à 0'); return; }
    if (!form.date) { Alert.alert(tr('erreur', lang), 'La date est obligatoire'); return; }
    try {
      const payload = {
        nom: form.nom,
        montant: form.montant,
        motif: form.motif,
        typeDepense: form.typeDepense,
        date: form.date,
      };
      if (editing) {
        await updateDepense(editing.id, payload);
      } else {
        const result = await creerDepenseOffline(payload);
        if (result.offline) setShowOfflineBadge(true);
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
      `${d.nom} — ${d.montant?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA`,
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

  // ── Filtre période (Du/Au), comme filtrerPeriode() côté Ionic : ne
  //     remplace que la liste `depenses`, les paiements employés restent
  //     ceux déjà chargés (comportement identique à depenses.page.ts). ──
  const filtrerPeriode = async () => {
    if (!dateDebutFiltre || !dateFinFiltre) {
      Alert.alert(tr('erreur', lang), 'Veuillez saisir les deux dates');
      return;
    }
    setPeriodeLoading(true);
    try {
      const res = await getDepensesParPeriode(dateDebutFiltre, dateFinFiltre);
      const liste: any[] = res.data?.depenses || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      setDepenses(liste);
      setPageDepenses(1);
    } catch {
      Alert.alert(tr('erreur', lang), 'Erreur filtre période');
    }
    setPeriodeLoading(false);
  };

  const reinitialiserFiltres = () => {
    setFiltreType('');
    setFiltreMois('');
    setDateDebutFiltre('');
    setDateFinFiltre('');
    setShowTypePicker2(false);
    charger();
  };

  /** Envoi du reçu de paiement par WhatsApp au numéro enregistré sur la fiche
   *  employé — équivalent de envoyerRecuWhatsApp() côté Ionic. */
  const envoyerRecuWhatsApp = (dep: any) => {
    const employe = employes.find((e: any) => e.id === dep.employeId);
    const telephone = (employe?.telephone || '').replace(/\D/g, '');
    if (!telephone) {
      Alert.alert(tr('erreur', lang), `Ajoutez un numéro de téléphone à la fiche de ${dep.nom} pour activer l'envoi WhatsApp.`);
      return;
    }
    const montantFmt = (dep.montant || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 });
    const periodeLabel = dep.periodeFin && dep.periodeFin !== dep.periodeDebut ? `${dep.periodeDebut} à ${dep.periodeFin}` : dep.periodeDebut;
    const lignes = [
      `*Ges Boutique*`,
      `Reçu de paiement de salaire`,
      `Employé : ${dep.nom}`,
      `Date : ${dep.date || new Date().toLocaleDateString('fr-FR')}`,
      ``,
      `Poste : ${dep.employePoste || '—'}`,
      `Période : ${periodeLabel || '—'}`,
      `Nombre de mois : ${dep.nombreMois || 1}`,
      ``,
      `Montant payé : ${montantFmt} FCFA`,
      ``,
      `Merci de votre confiance.`,
    ];
    Linking.openURL(`https://wa.me/${telephone}?text=${encodeURIComponent(lignes.join('\n'))}`);
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

  const filtreActif = filtreType !== '' || filtreMois !== '' || dateDebutFiltre !== '';

  // ── Pagination dépenses ──
  const depensesPaginees = useMemo(
    () => depensesFiltrees.slice((pageDepenses - 1) * ITEMS_PAGE, pageDepenses * ITEMS_PAGE),
    [depensesFiltrees, pageDepenses],
  );
  const totalPagesDepenses = useMemo(
    () => Math.max(1, Math.ceil(depensesFiltrees.length / ITEMS_PAGE)),
    [depensesFiltrees],
  );

  // Recherche par description/nom
  const depensesFiltreesSearch = useMemo(() => {
    if (!searchDepense.trim()) return depensesFiltrees;
    const t = searchDepense.toLowerCase();
    return depensesFiltrees.filter(d =>
      (d.nom || '').toLowerCase().includes(t) ||
      (d.motif || '').toLowerCase().includes(t)
    );
  }, [depensesFiltrees, searchDepense]);

  // ── Pagination dépenses (sur résultat avec recherche) ──
  const depensesPagineesSearch = useMemo(
    () => depensesFiltreesSearch.slice((pageDepenses - 1) * ITEMS_PAGE, pageDepenses * ITEMS_PAGE),
    [depensesFiltreesSearch, pageDepenses],
  );
  const totalPagesSearch = useMemo(
    () => Math.max(1, Math.ceil(depensesFiltreesSearch.length / ITEMS_PAGE)),
    [depensesFiltreesSearch],
  );

  // Reset page quand les filtres changent
  useEffect(() => { setPageDepenses(1); }, [filtreType, filtreMois, searchDepense]);

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
    const montantFmt = (dep.montant || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 });
    const salaireFmt = (dep.salaireMensuel || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 });
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

  if (loading) return <View style={{ flex: 1, backgroundColor: colors.background }}><ActivityIndicator style={{ flex: 1 }} size="large" color={colors.danger} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.totalBanner, { backgroundColor: colors.danger }]}>
        <Text style={styles.totalLabel}>
          {filtreActif ? `${tr('depenses', lang)} — ${filtreTitre}` : `Total ${tr('depenses', lang).toLowerCase()}`}
        </Text>
        <Text style={styles.totalVal}>{totalFiltre.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
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
            colors={[colors.danger]}
          />
        }
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {/* ── Section filtres ── */}
            <View style={[styles.filtresSection, { backgroundColor: colors.card }]}>
              <View style={styles.filtresHeader}>
                <Text style={[styles.filtresTitle, { color: colors.text }]}>Filtres</Text>
                {filtreActif && (
                  <TouchableOpacity onPress={reinitialiserFiltres}>
                    <Text style={[styles.resetFiltres, { color: colors.danger }]}>Réinitialiser</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Filtre type */}
              <Pressable
                style={[styles.filtreTypeTrigger, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => setShowTypePicker2(v => !v)}
              >
                <Text style={filtreType ? [styles.filtreTypeValue, { color: colors.text }] : [styles.filtreTypePh, { color: colors.placeholder }]}>
                  {filtreType || 'Filtrer par type'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{showTypePicker2 ? '▲' : '▼'}</Text>
              </Pressable>

              {showTypePicker2 && (
                <View style={[styles.filtreTypePicker, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TouchableOpacity
                    style={[styles.filtreTypeItem, { borderBottomColor: colors.border }]}
                    onPress={() => { setFiltreType(''); setShowTypePicker2(false); }}
                  >
                    <Text style={[styles.filtreTypeText, { color: colors.text }, !filtreType && { color: colors.danger, fontWeight: 'bold' }]}>
                      Tous les types
                    </Text>
                  </TouchableOpacity>
                  {typesDepense.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.filtreTypeItem, { borderBottomColor: colors.border }]}
                      onPress={() => { setFiltreType(t.nom); setShowTypePicker2(false); }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name={getIconeType(t.nom) as any} size={14} color={filtreType === t.nom ? colors.danger : colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={[styles.filtreTypeText, { color: colors.text }, filtreType === t.nom && { color: colors.danger, fontWeight: 'bold' }]}>
                          {t.nom}
                        </Text>
                      </View>
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

              {/* Filtre période Du/Au — GET /depenses/periode, comme depenses.page.html */}
              <View style={styles.periodeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filtreTypePh, { color: colors.textSecondary, marginBottom: 4 }]}>Du</Text>
                  <RNTextInput
                    style={[styles.periodeInput, { borderColor: colors.border, color: colors.text }]}
                    value={dateDebutFiltre}
                    onChangeText={setDateDebutFiltre}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.filtreTypePh, { color: colors.textSecondary, marginBottom: 4 }]}>Au</Text>
                  <RNTextInput
                    style={[styles.periodeInput, { borderColor: colors.border, color: colors.text }]}
                    value={dateFinFiltre}
                    onChangeText={setDateFinFiltre}
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.periodeBtn, { backgroundColor: colors.danger }, periodeLoading && { opacity: 0.6 }]}
                  onPress={filtrerPeriode}
                  disabled={periodeLoading}
                >
                  <Ionicons name="funnel-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Bouton PDF */}
              <TouchableOpacity style={[styles.pdfBtn, { backgroundColor: colors.danger }]} onPress={genererPdf}>
                <Text style={styles.pdfBtnText}>Télécharger PDF</Text>
              </TouchableOpacity>
            </View>

            {/* ── Répartition par type (sur données filtrées) ── */}
            {totauxFiltres.length > 0 && (
              <View style={[styles.typeSummary, { backgroundColor: colors.card }]}>
                <Text style={[styles.typeSummaryTitle, { color: colors.text }]}>Répartition par type</Text>
                {totauxFiltres.map(t => (
                  <View key={t.type} style={[styles.typeRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name={getIconeType(t.type) as any} size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.typeLabel, { color: colors.textSecondary }]}>{t.type}</Text>
                    </View>
                    <Text style={[styles.typeTotal, { color: colors.danger }]}>{t.total.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        }
        renderItem={({ item: d }) => (
          <Card style={[styles.card, { backgroundColor: colors.card }, d.sourceExterne && { backgroundColor: colors.warningBg }]}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium" style={{ flex: 1, color: colors.text }}>{d.nom}</Text>
                <Text style={[styles.montant, { color: colors.danger }]}>{d.montant?.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</Text>
              </View>
              <View style={styles.badgeWrap}>
                {d.typeDepense ? (
                  <View style={[styles.badgeContainer, { backgroundColor: colors.dangerBg }]}>
                    <Ionicons name={getIconeType(d.typeDepense) as any} size={11} color={colors.danger} style={{ marginRight: 3 }} />
                    <Text style={[styles.badge, { color: colors.danger }]}>{d.typeDepense}</Text>
                  </View>
                ) : null}
                {d.sourceExterne ? (
                  <Text style={[styles.badge, { backgroundColor: colors.warningBg, color: colors.warning, marginLeft: 4 }]}>Via Employés</Text>
                ) : null}
              </View>
              {d.motif ? <Text style={[styles.sub, { color: colors.textSecondary }]}>{d.motif}{d.periodeDebut ? ` (${d.periodeDebut}${d.periodeFin ? '→' + d.periodeFin : ''})` : ''}</Text> : null}
              <Text style={[styles.date, { color: colors.textSecondary }]}>
                {d.date ? new Date(d.date).toLocaleDateString('fr-FR') : ''}
              </Text>
              {!d.sourceExterne && isAdmin && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.editBtn} onPress={() => ouvrirEdition(d)}>
                    <Text style={{ color: colors.primary, fontSize: 13 }}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => supprimer(d)}>
                    <Text style={{ color: colors.danger, fontSize: 13 }}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              )}
              {d.sourceExterne && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={[styles.recuBtn, { backgroundColor: colors.successBg, borderColor: colors.success }]} onPress={() => genererRecuSalaire(d)}>
                    <Text style={[styles.recuBtnText, { color: colors.success }]}>Reçu PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.recuBtn, { backgroundColor: '#25D366', borderColor: '#25D366', marginLeft: 8 }]} onPress={() => envoyerRecuWhatsApp(d)}>
                    <Ionicons name="logo-whatsapp" size={13} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={[styles.recuBtnText, { color: '#fff' }]}>WhatsApp</Text>
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
                <Text style={[
                  styles.paginationBtn,
                  { color: colors.danger, borderColor: colors.danger, backgroundColor: colors.card },
                  pageDepenses === 1 && { color: colors.textSecondary, borderColor: colors.border, backgroundColor: colors.inputBg },
                ]}>
                  Precedent
                </Text>
              </TouchableOpacity>
              <Text style={[styles.paginationInfo, { color: colors.textSecondary }]}>Page {pageDepenses}/{totalPagesDepenses}</Text>
              <TouchableOpacity
                onPress={() => setPageDepenses(p => Math.min(totalPagesDepenses, p + 1))}
                disabled={pageDepenses === totalPagesDepenses}
              >
                <Text style={[
                  styles.paginationBtn,
                  { color: colors.danger, borderColor: colors.danger, backgroundColor: colors.card },
                  pageDepenses === totalPagesDepenses && { color: colors.textSecondary, borderColor: colors.border, backgroundColor: colors.inputBg },
                ]}>
                  Suivant
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>{tr('aucune_depense', lang)}{filtreActif ? ` (${tr('aucun_resultat', lang).toLowerCase()})` : ''}</Text>}
      />

      {isAdmin && <FAB icon="plus" style={[styles.fab, { backgroundColor: colors.danger }]} color="#fff" onPress={() => ouvrirCreation()} />}

      {/* Modal Types Dépenses */}
      <RNModal
        visible={showTypesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTypesModal(false)}
      >
        <View style={[styles.typesModalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.typesModalSheet, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.typesModalHeader}>
              <Text style={[styles.typesModalTitle, { color: colors.text }]}>{tr('type_depense', lang)}</Text>
              <TouchableOpacity onPress={() => {
                setShowTypesModal(false);
                setNewTypeName('');
                setEditingTypeId(null);
                setTypesError('');
              }}>
                <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Erreur */}
            {typesError ? (
              <Text style={[styles.typesError, { color: colors.danger }]}>{typesError}</Text>
            ) : null}

            {/* Liste */}
            <ScrollView style={{ maxHeight: 300 }}>
              {typesDepense.map(t => (
                <View key={t.id} style={[styles.typesRow, { borderBottomColor: colors.border }]}>
                  {editingTypeId === t.id ? (
                    <>
                      <RNTextInput
                        value={editingTypeName}
                        onChangeText={setEditingTypeName}
                        style={[styles.typesEditInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                        placeholderTextColor={colors.placeholder}
                      />
                      <TouchableOpacity onPress={saveEditType} style={{ marginLeft: 8 }}>
                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { setEditingTypeId(null); setEditingTypeName(''); }} style={{ marginLeft: 4 }}>
                        <Ionicons name="close-circle" size={24} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Ionicons name={getIconeType(t.nom) as any} size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
                      <Text style={[styles.typesItemText, { color: colors.text }]}>{t.nom}</Text>
                      <TouchableOpacity onPress={() => { setEditingTypeId(t.id); setEditingTypeName(t.nom); }} style={{ marginLeft: 8 }}>
                        <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => supprimerType(t)} style={{ marginLeft: 8 }}>
                        <Ionicons name="trash-outline" size={20} color={colors.danger} />
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
                style={[styles.typesAddInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBg }]}
                placeholderTextColor={colors.placeholder}
              />
              <TouchableOpacity
                onPress={ajouterType}
                disabled={typesLoading || !newTypeName.trim()}
                style={[styles.typesAddBtn, { backgroundColor: colors.primary }, (!newTypeName.trim() || typesLoading) && { opacity: 0.5 }]}
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
          contentContainerStyle={[styles.modal, { backgroundColor: colors.card }]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text variant="titleLarge" style={{ marginBottom: 16, color: colors.text }}>
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
                style={[styles.typePickerTrigger, { flex: 1, marginBottom: 0, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => setShowTypePicker(v => !v)}
              >
                <Text style={form.typeDepense ? [styles.typePickerValue, { color: colors.text }] : [styles.typePickerPlaceholder, { color: colors.placeholder }]}>
                  {form.typeDepense || 'Type de dépense'}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{showTypePicker ? '▲' : '▼'}</Text>
              </Pressable>
              <TouchableOpacity
                onPress={() => { setShowTypesModal(true); setTypesError(''); }}
                style={{ padding: 8 }}
              >
                <Ionicons name="settings-outline" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {showTypePicker && (
              <View style={[styles.typePicker, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                {typesDepense.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typePickerItem, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setForm({ ...form, typeDepense: t.nom });
                      setShowTypePicker(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name={getIconeType(t.nom) as any} size={14} color={form.typeDepense === t.nom ? colors.danger : colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text
                        style={[
                          styles.typePickerText,
                          { color: colors.text },
                          form.typeDepense === t.nom && { color: colors.danger, fontWeight: 'bold' },
                        ]}
                      >
                        {t.nom}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              label="Montant *"
              value={montantInput.texte}
              onChangeText={montantInput.onChangeText}
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

            <Button mode="contained" onPress={sauvegarder} style={{ marginTop: 4 }} buttonColor={colors.danger}>
              {editing ? tr('modifier', lang) : tr('ajouter', lang)}
            </Button>
          </ScrollView>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  totalBanner: { padding: 16, alignItems: 'center' },
  totalLabel: { color: '#fff', fontSize: 12 },
  totalVal: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  totalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  card: { marginBottom: 10, borderRadius: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  montant: { fontWeight: 'bold' },
  badgeWrap: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  badge: {
    fontSize: 11,
  },
  sub: { fontSize: 12, marginTop: 4 },
  date: { fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { margin: 20, borderRadius: 20, padding: 20, maxHeight: '85%' },
  input: { marginBottom: 12 },
  // Filtres
  filtresSection: { marginBottom: 12, borderRadius: 16, padding: 14, elevation: 2 },
  filtresHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filtresTitle: { fontWeight: 'bold', fontSize: 13 },
  resetFiltres: { fontSize: 12, fontWeight: '600' },
  filtreTypeTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  filtreTypeValue: { fontSize: 13, fontWeight: '500' },
  filtreTypePh: { fontSize: 13 },
  filtreTypePicker: { borderRadius: 8, marginBottom: 8, borderWidth: 1, maxHeight: 200 },
  filtreTypeItem: { padding: 10, borderBottomWidth: 1 },
  filtreTypeText: { fontSize: 13 },
  filtreMoisInput: { marginBottom: 10 },
  periodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  periodeInput: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  periodeBtn: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pdfBtn: {
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
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  typePickerValue: { fontSize: 14 },
  typePickerPlaceholder: { fontSize: 14 },
  typeSummary: { marginBottom: 12, borderRadius: 16, padding: 14, elevation: 2 },
  typeSummaryTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1 },
  typeLabel: { fontSize: 13 },
  typeTotal: { fontWeight: '600', fontSize: 13 },
  typePicker: { borderRadius: 8, marginBottom: 8, borderWidth: 1 },
  typePickerItem: { padding: 10, borderBottomWidth: 1 },
  typePickerText: { fontSize: 13 },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  recuBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  recuBtnText: { fontSize: 12, fontWeight: '700' },
  // Pagination
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 8, marginTop: 4, marginBottom: 8 },
  paginationBtn: { fontSize: 14, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  paginationInfo: { fontSize: 13, fontWeight: '600' },
  // Modal types dépenses
  typesModalOverlay: { flex: 1, justifyContent: 'flex-end' },
  typesModalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' as any, padding: 20 },
  typesModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  typesModalTitle: { fontSize: 18, fontWeight: '700' },
  typesError: { fontSize: 13, marginBottom: 8 },
  typesRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  typesItemText: { flex: 1, fontSize: 15 },
  typesEditInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  typesAddRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  typesAddInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  typesAddBtn: { borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
});
