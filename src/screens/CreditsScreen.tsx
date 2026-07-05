import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import api, { getPaiementsGroupes } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRecuReglementCreditHtml } from '../services/invoice.service';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CreditInfo {
  venteId: number;
  numeroVente: string;
  clientNom: string;
  clientPrenom?: string;
  clientTelephone?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  dateReglement?: string;
  regleParNom?: string;
  vendeurNom?: string;
  enRetard: boolean;
  venteAnnulee?: boolean;
  estReglee?: boolean;
}

interface LigneProduit {
  produitNom: string;
  quantite: number;
  sousTotal: number;
}

interface VenteDetail {
  produits?: LigneProduit[];
  lignes?: LigneProduit[];
}

interface OperationCaisse {
  id?: number;
  montant: number;
  dateOperation: string;
  modePaiement?: string;
  referencePaiement?: string;
  utilisateurNom?: string;
  motif?: string;
}

interface ClientGroup {
  clientNom: string;
  clientPrenom?: string;
  clientTelephone?: string;
  credits: CreditInfo[];
  totalRestant: number;
  enRetard: boolean;
  nbRegles: number;
  expanded: boolean;
}

interface VenteImpliquee {
  venteCreditId: number;
  numeroVente?: string;
  montantApplique: number;
  statutCredit: string;
  resteARegler: number;
}

interface PaiementGroupe {
  referenceGroupe: string;
  clientNom: string;
  date: string;
  montantTotalApporte: number;
  ventesImpliquees: VenteImpliquee[];
}

type StatutFilter = 'EN_COURS' | 'REGLES' | 'TOUS';

const MODES = ['ESPECES', 'ORANGE_MONEY', 'MOOV_MONEY', 'VIREMENT'] as const;
type Mode = typeof MODES[number];
const MODE_LABELS: Record<Mode, string> = {
  ESPECES: 'Espèces',
  ORANGE_MONEY: 'Orange',
  MOOV_MONEY: 'Moov',
  VIREMENT: 'Virement',
};

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('fr-FR') + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CreditsScreen() {
  const [allCredits, setAllCredits] = useState<CreditInfo[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [filtered, setFiltered] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRetard, setFilterRetard] = useState(false);
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('EN_COURS');

  // Modal détail (lecture seule)
  const [showDetail, setShowDetail] = useState(false);
  const [detailCredit, setDetailCredit] = useState<CreditInfo | null>(null);
  const [detailVente, setDetailVente] = useState<VenteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [versements, setVersements] = useState<OperationCaisse[]>([]);
  const [loadingVersements, setLoadingVersements] = useState(false);

  // Modal règlement simple
  const [showSimple, setShowSimple] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditInfo | null>(null);
  const [simpleVente, setSimpleVente] = useState<VenteDetail | null>(null);
  const [loadingVente, setLoadingVente] = useState(false);
  const [simpleMontant, setSimpleMontant] = useState('');
  const [simpleMode, setSimpleMode] = useState<Mode>('ESPECES');
  const [simpleRef, setSimpleRef] = useState('');
  const [savingSimple, setSavingSimple] = useState(false);

  // Modal règlement groupé
  const [showGroupe, setShowGroupe] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupeMontant, setGroupeMontant] = useState('');
  const [groupeMode, setGroupeMode] = useState<Mode>('ESPECES');
  const [groupeRef, setGroupeRef] = useState('');
  const [savingGroupe, setSavingGroupe] = useState(false);

  // Onglets principaux + paiements groupés
  const [activeTab, setActiveTab] = useState<'credits' | 'groupes'>('credits');
  const [paiementsGroupes, setPaiementsGroupes] = useState<PaiementGroupe[]>([]);
  const [paiementsGroupesLoading, setPaiementsGroupesLoading] = useState(false);
  const [expandedGroupes, setExpandedGroupes] = useState<Set<string>>(new Set());

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      const [resNonRegles, resRegles, resVentes] = await Promise.all([
        api.get('/caisse/credits/non-regles').catch(() => ({ data: [] })),
        api.get('/caisse/credits/regles').catch(() => ({ data: [] })),
        api.get('/ventes').catch(() => ({ data: [] })),
      ]);
      const caisseList: CreditInfo[] = [
        ...(resNonRegles.data?.data || resNonRegles.data?.credits || resNonRegles.data || []),
        ...(resRegles.data?.data || resRegles.data?.credits || resRegles.data || []),
      ];
      const caisseMap = new Map<number, CreditInfo>();
      caisseList.forEach((c: CreditInfo) => { if (c.venteId) caisseMap.set(c.venteId, c); });

      const toutesVentes: any[] = (resVentes.data?.data || resVentes.data || [])
        .filter((v: any) => v.estCredit && !v.annulee);

      const maintenant = new Date();
      const all: CreditInfo[] = toutesVentes.map((v: any) => {
        const c = caisseMap.get(v.id);
        if (c) {
          const montantRestant = c.montantRestant ?? Math.max(0, (v.montantTotal || 0) - (v.montantVerse || 0));
          const estReglee = c.estReglee || !!v.creditRegle || montantRestant <= 0.01;
          return { ...c, montantRestant, estReglee };
        }
        const montantTotal = v.montantTotal || 0;
        const montantVerse = v.montantVerse || 0;
        const montantRestant = v.montantRestant ?? Math.max(0, montantTotal - montantVerse);
        const echeance = v.dateEcheance ? new Date(v.dateEcheance) : null;
        const estReglee = !!v.creditRegle || montantRestant <= 0;
        const enRetard = !estReglee && echeance ? echeance < maintenant : false;
        const joursRetard = enRetard && echeance
          ? Math.ceil((maintenant.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        return {
          venteId: v.id, numeroVente: v.numeroVente || '',
          clientNom: v.clientNom || 'Client divers',
          clientPrenom: v.clientPrenom, clientTelephone: v.clientTelephone || '',
          montantTotal, montantVerse, montantRestant,
          dateEcheance: v.dateEcheance, dateReglement: v.dateReglement,
          regleParNom: v.regleParNom, vendeurNom: v.vendeurNom,
          estReglee, enRetard, joursRetard,
        } as CreditInfo;
      });

      setAllCredits(all);
      applyFilters(all, statutFilter, search, filterRetard);
    } catch { }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadPaiementsGroupes = useCallback(async () => {
    setPaiementsGroupesLoading(true);
    try {
      const res = await getPaiementsGroupes();
      setPaiementsGroupes(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPaiementsGroupes([]);
    } finally {
      setPaiementsGroupesLoading(false);
    }
  }, []);

  useEffect(() => { charger(); loadPaiementsGroupes(); }, []);

  const applyFilters = (
    all: CreditInfo[],
    statut: StatutFilter,
    term: string,
    retard: boolean
  ) => {
    let filtered: CreditInfo[];
    if (statut === 'EN_COURS') filtered = all.filter(c => !c.estReglee);
    else if (statut === 'REGLES') filtered = all.filter(c => !!c.estReglee);
    else filtered = [...all];

    const grps = buildGroups(filtered);
    setGroups(grps);

    const t = term.trim().toLowerCase();
    const vis = grps.filter(g => {
      if (retard && !g.enRetard) return false;
      if (t) {
        const nom = (g.clientNom + ' ' + (g.clientPrenom || '')).toLowerCase();
        return nom.includes(t) || (g.clientTelephone || '').includes(t);
      }
      return true;
    });
    setFiltered(vis);
  };

  const buildGroups = (credits: CreditInfo[]): ClientGroup[] => {
    const map = new Map<string, CreditInfo[]>();
    credits.forEach(c => {
      const key = `${c.clientNom}__${c.clientTelephone || ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries()).map(([, list]) => ({
      clientNom: list[0].clientNom,
      clientPrenom: list[0].clientPrenom,
      clientTelephone: list[0].clientTelephone,
      credits: list,
      totalRestant: list.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0),
      enRetard: list.some(c => c.enRetard),
      nbRegles: list.filter(c => c.estReglee).length,
      expanded: false,
    })).sort((a, b) => b.totalRestant - a.totalRestant);
  };

  const changeStatut = (s: StatutFilter) => {
    setStatutFilter(s);
    setFilterRetard(false);
    applyFilters(allCredits, s, search, false);
  };

  const onSearch = (v: string) => {
    setSearch(v);
    applyFilters(allCredits, statutFilter, v, filterRetard);
  };

  const toggleRetard = () => {
    const r = !filterRetard;
    setFilterRetard(r);
    applyFilters(allCredits, statutFilter, search, r);
  };

  const toggleGroup = (key: string) => {
    const update = (arr: ClientGroup[]) =>
      arr.map(g => `${g.clientNom}__${g.clientTelephone || ''}` === key ? { ...g, expanded: !g.expanded } : g);
    setGroups(update);
    setFiltered(update);
  };

  const toggleGroupe = (ref: string) => {
    setExpandedGroupes(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  // ─── Totaux ──────────────────────────────────────────────────────────────
  const totalDu = allCredits.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0);
  const nbClients = new Set(allCredits.filter(c => !c.estReglee).map(c => c.clientNom)).size;
  const nbRetard = allCredits.filter(c => c.enRetard).length;
  const nbRegles = allCredits.filter(c => c.estReglee).length;

  // ─── PDF liste crédits ───────────────────────────────────────────────────
  const genererPdfListe = async () => {
    const labels: Record<StatutFilter, string> = { EN_COURS: 'En cours', REGLES: 'Réglés', TOUS: 'Tous' };
    const liste = allCredits.filter(c => {
      if (statutFilter === 'EN_COURS') return !c.estReglee;
      if (statutFilter === 'REGLES') return c.estReglee;
      return true;
    });
    const totalInitial = liste.reduce((s, c) => s + c.montantTotal, 0);
    const totalVerse = liste.reduce((s, c) => s + c.montantVerse, 0);
    const totalRestant = liste.reduce((s, c) => s + c.montantRestant, 0);
    const lignes = liste.map((c, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">${c.clientNom}${c.clientPrenom ? ' ' + c.clientPrenom : ''}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">${c.clientTelephone || '—'}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">${money(c.montantTotal)}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#16a34a">${money(c.montantVerse)}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700;color:${c.estReglee ? '#16a34a' : '#d97706'}">${money(c.montantRestant)}</td>
      <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center">${c.estReglee ? '<span style="color:#16a34a;font-weight:700">Réglé</span>' : c.enRetard ? '<span style="color:#ef4444;font-weight:700">Retard</span>' : '<span style="color:#d97706">En cours</span>'}</td>
    </tr>`).join('');
    const date = new Date().toLocaleDateString('fr-FR');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Crédits ${labels[statutFilter]}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:20px;font-size:12px;background:#f0f4f8}
.sheet{background:#fff;max-width:900px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;padding:24px;display:flex;justify-content:space-between;align-items:center}
.hdr h1{font-size:20px;font-weight:900}.hdr p{font-size:12px;opacity:.7;margin-top:4px}
.kpis{display:flex;padding:16px 24px;gap:12px;border-bottom:1px solid #e5e7eb}
.kpi{flex:1;background:#f0fdfa;border-radius:8px;padding:12px;text-align:center}
.kpi-val{font-size:18px;font-weight:900;color:#0f766e}.kpi-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase}
.body{padding:20px 24px}
table{width:100%;border-collapse:collapse}
thead th{background:#0f766e;color:#fff;padding:9px 8px;font-size:11px;font-weight:700;text-align:left}
td{padding:7px 8px;border-bottom:1px solid #f1f5f9}
.ftr{background:#f0fdfa;text-align:center;padding:14px;font-size:10px;color:#94a3b8}
</style></head><body>
<div class="sheet">
<div class="hdr"><div><h1>Crédits : ${labels[statutFilter]}</h1><p>Généré le ${date}</p></div>
<img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent('Credits ' + labels[statutFilter] + ' ' + date)}" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px"></div>
<div class="kpis">
<div class="kpi"><div class="kpi-val">${money(totalInitial)}</div><div class="kpi-lbl">Total initial</div></div>
<div class="kpi"><div class="kpi-val">${money(totalVerse)}</div><div class="kpi-lbl">Total versé</div></div>
<div class="kpi"><div class="kpi-val">${money(totalRestant)}</div><div class="kpi-lbl">Restant dû</div></div>
</div>
<div class="body">
<table><thead><tr><th>Client</th><th>Téléphone</th><th>Initial</th><th>Versé</th><th>Restant</th><th>Statut</th></tr></thead>
<tbody>${lignes || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">Aucun crédit</td></tr>'}</tbody></table>
</div>
<div class="ftr">Ges Boutique · Crédits ${labels[statutFilter]} · ${date} · ${liste.length} crédit(s)</div>
</div></body></html>`;
    try { await Print.printAsync({ html }); } catch { Alert.alert('Erreur', 'Impossible de générer le PDF'); }
  };

  // ─── Chargement vente ────────────────────────────────────────────────────
  const loadVente = async (venteId: number, setter: (v: VenteDetail) => void, loadSetter: (b: boolean) => void) => {
    loadSetter(true);
    try {
      const res = await api.get(`/ventes/${venteId}`);
      setter(res.data?.data || res.data);
    } catch { }
    loadSetter(false);
  };

  // ─── Modal détail ────────────────────────────────────────────────────────
  const openDetail = (credit: CreditInfo) => {
    setDetailCredit(credit);
    setDetailVente(null);
    setVersements([]);
    setShowDetail(true);
    loadVente(credit.venteId, setDetailVente, setLoadingDetail);
    setLoadingVersements(true);
    api.get(`/caisse/credits/${credit.venteId}/reglements`)
      .then(r => setVersements((r.data?.reglements || []) as OperationCaisse[]))
      .catch(() => {})
      .finally(() => setLoadingVersements(false));
  };

  // ─── PDF versements ──────────────────────────────────────────────────────
  const imprimerVersements = async () => {
    if (!detailCredit) return;
    const credit = detailCredit;
    const vers = versements;

    const qrData = encodeURIComponent(`CREDIT_N${credit.numeroVente}_${credit.clientNom}_VERSE_${credit.montantVerse}`);
    const isGrouped = vers.some(v => (v.motif || '').toLowerCase().includes('group'));

    const versRows = vers.length ? vers.map((v, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td>${dateStr(v.dateOperation)}</td>
      <td style="text-align:right;font-weight:700;color:#166534">${money(v.montant)}</td>
      <td>${v.modePaiement || 'ESPECES'}</td>
      <td>${v.referencePaiement || '—'}</td>
      <td>${v.utilisateurNom || '—'}</td>
      <td>${v.motif || '—'}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:14px">Aucun versement</td></tr>`;

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Versements — ${credit.clientNom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;background:#f0f4f8;padding:16px;font-size:12px;color:#1e293b}
.sheet{background:#fff;max-width:780px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(8,22,72,.1)}
.hdr{background:linear-gradient(135deg,#0f3460,#1a56db);color:#fff;padding:18px 22px;display:flex;justify-content:space-between;align-items:flex-start}
.hdr-title{font-size:18px;font-weight:900}.hdr-sub{font-size:11px;opacity:.7;margin-top:3px}
.body{padding:16px 20px}
.kpi-row{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.kpi{flex:1;min-width:100px;background:#eff6ff;border-radius:10px;padding:10px;text-align:center}
.kpi.green{background:#f0fdf4}.kpi.red{background:#fef2f2}
.kpi-val{font-size:0.9rem;font-weight:900;color:#1a56db}
.kpi.green .kpi-val{color:#166534}.kpi.red .kpi-val{color:#dc2626}
.kpi-lbl{font-size:0.65rem;color:#64748b;margin-top:2px}
.info-tbl{width:100%;margin-bottom:12px}
.info-tbl td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:11px}
.info-tbl td:first-child{font-weight:700;color:#475569;width:120px}
.sec-title{font-size:9px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:10px 0 6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#eff6ff;padding:6px 8px;text-align:left;font-weight:700;color:#1e40af;border-bottom:2px solid #bfdbfe}
td{padding:5px 8px;border-bottom:1px solid #f1f5f9}
.ftr{background:linear-gradient(135deg,#0f3460,#1a56db);color:rgba(255,255,255,.6);text-align:center;padding:10px;font-size:10px}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div>
      <div class="hdr-title">Historique des versements</div>
      <div class="hdr-sub">Crédit N° ${credit.numeroVente} — ${credit.clientNom}${credit.clientPrenom ? ' ' + credit.clientPrenom : ''}</div>
      ${credit.clientTelephone ? `<div class="hdr-sub">${credit.clientTelephone}</div>` : ''}
      ${isGrouped ? `<div style="margin-top:5px"><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700">Paiement groupé inclus</span></div>` : ''}
    </div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}" width="68" height="68" style="border-radius:8px;background:#fff;padding:3px" onerror="this.style.display='none'">
  </div>
  <div class="body">
    <div class="sec-title">Informations du crédit</div>
    <table class="info-tbl">
      <tr><td>N° Vente</td><td>${credit.numeroVente}</td><td>Statut</td><td>${credit.estReglee ? '<span style="color:#166534;font-weight:700">✓ Réglé</span>' : '<span style="color:#d97706;font-weight:700">En cours</span>'}</td></tr>
      ${credit.vendeurNom ? `<tr><td>Vendeur</td><td colspan="3">${credit.vendeurNom}</td></tr>` : ''}
      ${credit.regleParNom ? `<tr><td>Réglé par</td><td colspan="3">${credit.regleParNom}</td></tr>` : ''}
    </table>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-val">${money(credit.montantTotal)}</div><div class="kpi-lbl">Total</div></div>
      <div class="kpi green"><div class="kpi-val">${money(credit.montantVerse)}</div><div class="kpi-lbl">Versé</div></div>
      ${!credit.estReglee ? `<div class="kpi red"><div class="kpi-val">${money(credit.montantRestant)}</div><div class="kpi-lbl">Reste à payer</div></div>` : ''}
    </div>
    <div class="sec-title">Versements effectués (${vers.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th><th>Par</th><th>Motif</th></tr></thead>
      <tbody>${versRows}</tbody>
      <tfoot><tr style="background:#eff6ff;font-weight:700"><td>Total</td><td style="color:#166534">${money(credit.montantVerse)}</td><td colspan="4"></td></tr></tfoot>
    </table>
    ${!credit.estReglee ? `<div style="margin-top:10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;text-align:center;font-weight:700;color:#dc2626">Reste à payer : ${money(credit.montantRestant)}</div>` : ''}
  </div>
  <div class="ftr">Ges Boutique · Historique versements · ${new Date().toLocaleDateString('fr-FR')}</div>
</div></body></html>`;

    try {
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    }
  };

  // ─── Règlement simple ────────────────────────────────────────────────────
  const openSimple = (credit: CreditInfo) => {
    if (credit.estReglee) return;
    setSelectedCredit(credit);
    setSimpleMontant(String(credit.montantRestant));
    setSimpleMode('ESPECES');
    setSimpleRef('');
    setSimpleVente(null);
    setShowSimple(true);
    loadVente(credit.venteId, setSimpleVente, setLoadingVente);
  };

  const saveSimple = async () => {
    if (!selectedCredit) return;
    const montant = parseFloat(simpleMontant);
    if (!montant || montant <= 0) { Alert.alert('Erreur', 'Montant invalide'); return; }
    if (montant > selectedCredit.montantRestant) {
      Alert.alert('Erreur', `Montant max : ${money(selectedCredit.montantRestant)}`); return;
    }
    setSavingSimple(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : {};
      await api.post('/caisse/credits/reglement', {
        venteCreditId: selectedCredit.venteId,
        montantRegle: montant,
        modePaiement: simpleMode,
        referencePaiement: simpleRef || undefined,
        utilisateurId: user.id,
      });
      setShowSimple(false);
      charger();
      // Impression automatique du reçu après règlement réussi
      try {
        const resteApres = Math.max(0, selectedCredit.montantRestant - montant);
        const html = buildRecuReglementCreditHtml(
          { montant, modePaiement: simpleMode, datePaiement: new Date().toISOString(), montantRestant: resteApres },
          { nom: selectedCredit.clientNom, prenom: selectedCredit.clientPrenom, telephone: selectedCredit.clientTelephone },
          { nom: 'Ges Boutique' }
        );
        await Print.printAsync({ html });
      } catch { /* impression optionnelle, ne pas bloquer */ }
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.message || 'Règlement impossible');
    }
    setSavingSimple(false);
  };

  // ─── Règlement groupé ────────────────────────────────────────────────────
  const openGroupe = (group: ClientGroup) => {
    setSelectedGroup(group);
    setSelectedIds(new Set(group.credits.filter(c => !c.estReglee).map(c => c.venteId)));
    const total = group.credits.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0);
    setGroupeMontant(String(total));
    setGroupeMode('ESPECES');
    setGroupeRef('');
    setShowGroupe(true);
  };

  const toggleId = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      const total = (selectedGroup?.credits || [])
        .filter(c => !c.estReglee && next.has(c.venteId))
        .reduce((s, c) => s + c.montantRestant, 0);
      setGroupeMontant(String(total));
      return next;
    });
  };

  const groupeTotal = () => (selectedGroup?.credits || [])
    .filter(c => !c.estReglee && selectedIds.has(c.venteId))
    .reduce((s, c) => s + c.montantRestant, 0);

  const saveGroupe = async () => {
    const creditsSelec = (selectedGroup?.credits || []).filter(c => !c.estReglee && selectedIds.has(c.venteId));
    if (!creditsSelec.length) { Alert.alert('Erreur', 'Sélectionnez au moins un crédit'); return; }
    const montant = parseFloat(groupeMontant);
    if (!montant || montant <= 0) { Alert.alert('Erreur', 'Montant invalide'); return; }

    Alert.alert(
      'Confirmer règlement groupé',
      `${creditsSelec.length} crédit(s) — ${money(montant)}`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer', onPress: async () => {
            setSavingGroupe(true);
            const raw = await AsyncStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : {};
            const total = groupeTotal();
            const ratio = montant / total;
            const refGroupe = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            try {
              const motifGroupe = `Paiement groupé | Total apporté: ${montant}`;
              for (const c of creditsSelec) {
                await api.post('/caisse/credits/reglement', {
                  venteCreditId: c.venteId,
                  montantRegle: Math.round(c.montantRestant * ratio),
                  modePaiement: groupeMode,
                  referencePaiement: groupeRef || undefined,
                  utilisateurId: user.id,
                  motif: motifGroupe,
                  referenceGroupe: refGroupe,
                });
              }
              setShowGroupe(false);
              charger();
            } catch (e: any) {
              Alert.alert('Erreur', e.response?.data?.message || 'Règlement groupé impossible');
            }
            setSavingGroupe(false);
          }
        }
      ]
    );
  };

  // ─── Render helpers ──────────────────────────────────────────────────────
  const renderLignes = (vente: VenteDetail | null, loading: boolean) => {
    if (loading) return <ActivityIndicator size="small" style={{ margin: 12 }} />;
    if (!vente) return <Text style={s.emptyText}>Impossible de charger les produits</Text>;
    const lignes: LigneProduit[] = vente.produits || vente.lignes || [];
    if (!lignes.length) return <Text style={s.emptyText}>Aucun produit</Text>;
    return lignes.map((l, i) => (
      <View key={i} style={s.ligneRow}>
        <Text style={s.ligneName}>{l.produitNom}</Text>
        <Text style={s.ligneQty}>× {l.quantite}</Text>
        <Text style={s.lignePrice}>{money(l.sousTotal)}</Text>
      </View>
    ));
  };

  const renderVersements = (vers: OperationCaisse[], loading: boolean, totalVerse: number) => {
    if (loading) return <ActivityIndicator size="small" style={{ margin: 12 }} />;
    if (!vers.length) return <Text style={s.emptyText}>Aucun versement enregistré</Text>;

    // Détection paiement groupé et extraction du montant total apporté
    const versGroupé = vers.find(v => (v.motif || '').toLowerCase().includes('paiement groupé'));
    let montantTotalApporteGroupe: string | null = null;
    if (versGroupé?.motif) {
      const match = versGroupé.motif.match(/Total apporté:\s*([\d\s]+)/);
      if (match) montantTotalApporteGroupe = match[1].trim();
    }

    return (
      <>
        {versGroupé && (
          <View style={s.groupeBanner}>
            <View style={s.groupeBannerRow}>
              <MaterialCommunityIcons name="account-group" size={16} color="#92400e" />
              <Text style={s.groupeBannerTitle}>Paiement groupé</Text>
            </View>
            {montantTotalApporteGroupe && (
              <Text style={s.groupeBannerSub}>
                Montant total apporté : {Number(montantTotalApporteGroupe.replace(/\s/g, '')).toLocaleString('fr-FR')} FCFA
              </Text>
            )}
          </View>
        )}
        {vers.map((v, i) => (
          <View key={i} style={s.versRow}>
            <View style={s.versTop}>
              <Text style={s.versDate}>{dateStr(v.dateOperation)}</Text>
              <Text style={s.versMontant}>+{money(v.montant)}</Text>
              <Text style={s.versMode}>{v.modePaiement || 'ESPECES'}</Text>
            </View>
            {!!v.referencePaiement && <Text style={s.versSub}>Réf : {v.referencePaiement}</Text>}
            {!!v.utilisateurNom && <Text style={s.versSub}>Par {v.utilisateurNom}</Text>}
            {(v.motif || '').toLowerCase().includes('paiement groupé') && (
              <View style={s.versGroupeBadge}>
                <Text style={s.versGroupeBadgeText}>Paiement groupé</Text>
              </View>
            )}
          </View>
        ))}
        <View style={s.versTotal}>
          <Text style={s.versTotalLabel}>Total versé</Text>
          <Text style={s.versTotalVal}>{money(totalVerse)}</Text>
        </View>
      </>
    );
  };

  const renderModeChips = (current: Mode, onSelect: (m: Mode) => void) => (
    <View style={s.chips}>
      {MODES.map(m => (
        <TouchableOpacity key={m} style={[s.chip, current === m && s.chipActive]} onPress={() => onSelect(m)}>
          <Text style={[s.chipText, current === m && s.chipTextActive]}>{MODE_LABELS[m]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Rendu principal ─────────────────────────────────────────────────────
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#9c27b0" />;

  return (
    <View style={s.container}>

      {/* ── Onglets principaux ── */}
      <View style={{ flexDirection: 'row', margin: 12, marginBottom: 4, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === 'credits' ? '#1a56db' : '#f9fafb' }}
          onPress={() => setActiveTab('credits')}>
          <Text style={{ color: activeTab === 'credits' ? '#fff' : '#374151', fontWeight: '700', fontSize: 13 }}>Crédits</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === 'groupes' ? '#d97706' : '#f9fafb' }}
          onPress={() => { setActiveTab('groupes'); loadPaiementsGroupes(); }}>
          <Text style={{ color: activeTab === 'groupes' ? '#fff' : '#374151', fontWeight: '700', fontSize: 13 }}>
            {'Paiements groupés'}{paiementsGroupes.length > 0 ? ` (${paiementsGroupes.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'credits' && (
        <>

      {/* Hero — 4 stats */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Total dû</Text>
          <Text style={s.heroVal}>{money(totalDu)}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroLabel}>Clients</Text>
          <Text style={s.heroVal}>{nbClients}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={[s.heroStat, { opacity: nbRetard > 0 ? 1 : 0.5 }]}>
          <Text style={s.heroLabel}>En retard</Text>
          <Text style={[s.heroVal, { color: '#ffcdd2' }]}>{nbRetard}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={[s.heroStat, { opacity: nbRegles > 0 ? 1 : 0.5 }]}>
          <Text style={s.heroLabel}>Réglés</Text>
          <Text style={[s.heroVal, { color: '#c8e6c9' }]}>{nbRegles}</Text>
        </View>
      </View>

      {/* Onglets statut + bouton PDF */}
      <View style={[s.statutTabs, { justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
        {(['EN_COURS', 'REGLES', 'TOUS'] as StatutFilter[]).map(s2 => {
          const labels: Record<StatutFilter, string> = { EN_COURS: 'En cours', REGLES: 'Réglés', TOUS: 'Tous' };
          const icons: Record<StatutFilter, string> = { EN_COURS: 'clock-outline', REGLES: 'check-circle-outline', TOUS: 'view-list-outline' };
          return (
            <TouchableOpacity
              key={s2}
              style={[s.stab, statutFilter === s2 && s.stabActive]}
              onPress={() => changeStatut(s2)}
            >
              <MaterialCommunityIcons
                name={icons[s2] as any}
                size={14}
                color={statutFilter === s2 ? '#9c27b0' : '#999'}
              />
              <Text style={[s.stabText, statutFilter === s2 && s.stabTextActive]}>{labels[s2]}</Text>
            </TouchableOpacity>
          );
        })}
        </View>
        <TouchableOpacity
          onPress={genererPdfListe}
          style={{ backgroundColor: '#0f766e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <MaterialCommunityIcons name="printer-outline" size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Filtres */}
      <View style={s.filters}>
        <View style={s.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color="#999" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={onSearch}
            placeholder="Nom ou téléphone..."
            placeholderTextColor="#bbb"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#bbb" />
            </TouchableOpacity>
          )}
        </View>
        {statutFilter !== 'REGLES' && (
          <TouchableOpacity style={[s.retardBtn, filterRetard && s.retardBtnActive]} onPress={toggleRetard}>
            <MaterialCommunityIcons name="alert-outline" size={14} color={filterRetard ? '#fff' : '#f44336'} />
            <Text style={[s.retardBtnText, filterRetard && { color: '#fff' }]}>Retard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={g => `${g.clientNom}__${g.clientTelephone || ''}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color="#4caf50" />
            <Text style={s.emptyStateText}>
              {statutFilter === 'EN_COURS' ? 'Aucun crédit en attente' :
               statutFilter === 'REGLES' ? 'Aucun crédit réglé' : 'Aucun crédit'}
            </Text>
          </View>
        }
        renderItem={({ item: g }) => (
          <View style={[s.groupCard, g.enRetard && s.groupCardRetard]}>

            {/* En-tête groupe */}
            <TouchableOpacity
              style={s.groupHeader}
              onPress={() => toggleGroup(`${g.clientNom}__${g.clientTelephone || ''}`)}
            >
              <View style={[s.avatar, g.enRetard && s.avatarRetard, g.nbRegles > 0 && !g.enRetard && g.totalRestant === 0 && s.avatarRegle]}>
                <Text style={s.avatarText}>{g.clientNom[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.clientNom}>
                  {g.clientNom}{g.clientPrenom ? <Text style={s.clientPrenom}> {g.clientPrenom}</Text> : null}
                </Text>
                {g.clientTelephone ? <Text style={s.clientTel}>📞 {g.clientTelephone}</Text> : null}
                <View style={s.badges}>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{g.credits.length} crédit{g.credits.length > 1 ? 's' : ''}</Text>
                  </View>
                  {g.enRetard && (
                    <View style={s.badgeRetard}>
                      <MaterialCommunityIcons name="alert" size={10} color="#fff" />
                      <Text style={[s.badgeText, { color: '#fff', marginLeft: 3 }]}>Retard</Text>
                    </View>
                  )}
                  {g.nbRegles > 0 && (
                    <View style={s.badgeRegle}>
                      <MaterialCommunityIcons name="check" size={10} color="#2e7d32" />
                      <Text style={[s.badgeText, { color: '#2e7d32', marginLeft: 3 }]}>{g.nbRegles} réglé{g.nbRegles > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.groupTotal, g.enRetard && { color: '#f44336' }, g.totalRestant === 0 && { color: '#4caf50' }]}>
                  {g.totalRestant > 0 ? money(g.totalRestant) : '✓ Réglé'}
                </Text>
                {g.totalRestant > 0 && (
                  <TouchableOpacity style={s.groupeBtn} onPress={() => openGroupe(g)}>
                    <MaterialCommunityIcons name="account-group" size={13} color="#9c27b0" />
                    <Text style={s.groupeBtnText}>Groupé</Text>
                  </TouchableOpacity>
                )}
                <MaterialCommunityIcons
                  name={g.expanded ? 'chevron-up' : 'chevron-down'}
                  size={20} color="#999" style={{ marginTop: 4 }}
                />
              </View>
            </TouchableOpacity>

            {/* Crédits dépliés */}
            {g.expanded && g.credits.map(credit => (
              <View key={credit.venteId} style={[s.creditItem, credit.estReglee && s.creditItemRegle]}>
                <View style={s.creditTop}>
                  <View>
                    <Text style={s.creditNum}>{credit.numeroVente}</Text>
                    {credit.estReglee ? (
                      credit.dateReglement && (
                        <Text style={[s.creditDate, { color: '#4caf50' }]}>
                          <MaterialCommunityIcons name="check-circle-outline" size={11} /> {dateStr(credit.dateReglement)}
                        </Text>
                      )
                    ) : (
                      credit.dateEcheance && (
                        <Text style={[s.creditDate, credit.enRetard && { color: '#f44336' }]}>
                          <MaterialCommunityIcons name="calendar-outline" size={11} /> {dateStr(credit.dateEcheance)}
                        </Text>
                      )
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.creditMontant, credit.estReglee && { color: '#4caf50' }, credit.enRetard && { color: '#f44336' }]}>
                      {credit.estReglee ? money(credit.montantTotal) : money(credit.montantRestant)}
                    </Text>
                    <View style={[
                      s.statusBadge,
                      credit.estReglee ? s.statusBadgeRegle : credit.enRetard ? s.statusBadgeRetard : null
                    ]}>
                      <Text style={[s.statusText, credit.estReglee && { color: '#2e7d32' }, credit.enRetard && { color: '#c62828' }]}>
                        {credit.estReglee ? '✓ Réglé' : credit.enRetard ? '⚠ Retard' : 'En cours'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Réglé par */}
                {credit.regleParNom && (
                  <Text style={s.regleParText}>
                    <MaterialCommunityIcons name="account-check-outline" size={12} color="#777" /> Réglé par{' '}
                    <Text style={{ fontWeight: '600', color: '#333' }}>{credit.regleParNom}</Text>
                  </Text>
                )}
                {credit.vendeurNom && (
                  <Text style={s.vendeurText}>
                    <MaterialCommunityIcons name="store-outline" size={12} color="#aaa" /> Vente par{' '}
                    <Text style={{ fontWeight: '500' }}>{credit.vendeurNom}</Text>
                  </Text>
                )}

                {/* Barre de progression (seulement si pas réglé) */}
                {!credit.estReglee && (
                  <View style={s.progressWrap}>
                    <View style={s.progressBg}>
                      <View style={[
                        s.progressFill,
                        credit.enRetard && { backgroundColor: '#f44336' },
                        { width: `${credit.montantTotal > 0 ? Math.round((credit.montantVerse / credit.montantTotal) * 100) : 0}%` as any }
                      ]} />
                    </View>
                    <View style={s.progressLabels}>
                      <Text style={s.progressText}>Versé {money(credit.montantVerse)}</Text>
                      <Text style={s.progressText}>/ {money(credit.montantTotal)}</Text>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={s.creditBtns}>
                  <TouchableOpacity style={s.detailBtn} onPress={() => openDetail(credit)}>
                    <MaterialCommunityIcons name="eye-outline" size={14} color="#9c27b0" />
                    <Text style={s.detailBtnText}>Voir</Text>
                  </TouchableOpacity>
                  {!credit.estReglee && (
                    <TouchableOpacity style={s.payBtn} onPress={() => openSimple(credit)}>
                      <MaterialCommunityIcons name="cash" size={14} color="#fff" />
                      <Text style={s.payBtnText}>Payer ce crédit</Text>
                    </TouchableOpacity>
                  )}
                  {credit.estReglee && (
                    <TouchableOpacity
                      style={s.recuBtn}
                      onPress={async () => {
                        try {
                          const html = buildRecuReglementCreditHtml(
                            { montant: credit.montantTotal, modePaiement: undefined, datePaiement: credit.dateReglement, montantRestant: 0 },
                            { nom: credit.clientNom, prenom: credit.clientPrenom, telephone: credit.clientTelephone },
                            { nom: 'Ges Boutique' }
                          );
                          await Print.printAsync({ html });
                        } catch { Alert.alert('Erreur', 'Impossible de générer le reçu'); }
                      }}
                    >
                      <MaterialCommunityIcons name="receipt" size={14} color="#2e7d32" />
                      <Text style={s.recuBtnText}>Recu PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      />

        </>
      )}

      {activeTab === 'groupes' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {paiementsGroupesLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color="#d97706" />
              <Text style={{ color: '#888', marginTop: 8 }}>Chargement…</Text>
            </View>
          )}
          {!paiementsGroupesLoading && paiementsGroupes.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <MaterialCommunityIcons name="cash-multiple" size={48} color="#d1d5db" />
              <Text style={{ color: '#888', marginTop: 12, fontSize: 16 }}>Aucun paiement groupé</Text>
            </View>
          )}
          {!paiementsGroupesLoading && paiementsGroupes.map(pg => (
            <View key={pg.referenceGroupe} style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fff' }}>

              {/* Header session */}
              <TouchableOpacity
                style={{ backgroundColor: '#fef3c7', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => toggleGroupe(pg.referenceGroupe)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: '#92400e' }}>{pg.clientNom}</Text>
                  <Text style={{ color: '#78350f', fontSize: 12, marginTop: 2 }}>
                    {pg.date ? new Date(pg.date).toLocaleDateString('fr-FR') : '—'}
                    {'  ·  Apporté : '}
                    {(pg.montantTotalApporte ?? 0).toLocaleString('fr-FR')} FCFA
                  </Text>
                  <Text style={{ color: '#92400e', fontSize: 11, marginTop: 2 }}>
                    {pg.ventesImpliquees?.length || 0} crédit(s)
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={expandedGroupes.has(pg.referenceGroupe) ? 'chevron-down' : 'chevron-right'}
                  size={20} color="#92400e" />
              </TouchableOpacity>

              {/* Détail des ventes (arbre) */}
              {expandedGroupes.has(pg.referenceGroupe) && (
                <View style={{ backgroundColor: '#fffbeb', paddingHorizontal: 16, paddingVertical: 8 }}>
                  {(pg.ventesImpliquees || []).map((v, idx) => (
                    <View key={v.venteCreditId} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: idx < (pg.ventesImpliquees.length - 1) ? 1 : 0, borderBottomColor: '#fde68a' }}>
                      {/* Connecteur arbre */}
                      <Text style={{ color: '#92400e', fontSize: 16, width: 20, marginTop: 2 }}>
                        {idx === pg.ventesImpliquees.length - 1 ? '└' : '├'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#374151', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start' }}>
                          {v.numeroVente || `Crédit #${v.venteCreditId}`}
                        </Text>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#1e293b', marginTop: 4 }}>
                          {(v.montantApplique ?? 0).toLocaleString('fr-FR')} FCFA
                        </Text>
                        {v.resteARegler > 0 && (
                          <Text style={{ color: '#6b7280', fontSize: 11 }}>
                            Reste : {v.resteARegler.toLocaleString('fr-FR')} FCFA
                          </Text>
                        )}
                      </View>
                      <View style={{ backgroundColor: v.statutCredit === 'REGLE' ? '#dcfce7' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: v.statutCredit === 'REGLE' ? '#166534' : '#991b1b', fontWeight: '700', fontSize: 11 }}>
                          {v.statutCredit === 'REGLE' ? 'Regle' : 'En cours'}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {/* Total */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: '#fde68a' }}>
                    <Text style={{ color: '#78350f', fontSize: 12 }}>Total apporté</Text>
                    <Text style={{ fontWeight: '800', color: '#b45309', fontSize: 14 }}>
                      {(pg.montantTotalApporte ?? 0).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* ─── MODAL DÉTAIL ─── */}
      <Modal visible={showDetail} animationType="slide" transparent onRequestClose={() => setShowDetail(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Détail du crédit</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {detailCredit && (
                <>
                  {/* Badge statut */}
                  <View style={[s.statutBadge, detailCredit.estReglee ? s.statutRegle : detailCredit.enRetard ? s.statutRetard : s.statutEnCours]}>
                    <MaterialCommunityIcons
                      name={detailCredit.estReglee ? 'check-circle' : detailCredit.enRetard ? 'alert-circle' : 'clock-outline'}
                      size={16}
                      color={detailCredit.estReglee ? '#2e7d32' : detailCredit.enRetard ? '#c62828' : '#1565c0'}
                    />
                    <Text style={[s.statutText, detailCredit.estReglee && { color: '#2e7d32' }, detailCredit.enRetard && { color: '#c62828' }, !detailCredit.estReglee && !detailCredit.enRetard && { color: '#1565c0' }]}>
                      {detailCredit.estReglee ? 'Crédit réglé' : detailCredit.enRetard ? 'En retard' : 'En cours'}
                    </Text>
                  </View>

                  <View style={s.infoCard}>
                    {(([
                      ['Client', `${detailCredit.clientNom}${detailCredit.clientPrenom ? ' ' + detailCredit.clientPrenom : ''}`],
                      detailCredit.clientTelephone ? ['Téléphone', detailCredit.clientTelephone] : null,
                      ['N° vente', detailCredit.numeroVente],
                      ['Total', money(detailCredit.montantTotal)],
                      ['Versé', money(detailCredit.montantVerse)],
                      !detailCredit.estReglee ? ['Reste dû', money(detailCredit.montantRestant)] : null,
                      detailCredit.dateReglement ? ['Réglé le', dateStr(detailCredit.dateReglement)] : null,
                      detailCredit.regleParNom ? ['Réglé par', detailCredit.regleParNom] : null,
                      detailCredit.vendeurNom ? ['Vendeur', detailCredit.vendeurNom] : null,
                    ]).filter((r): r is [string, string] => r !== null)).map(([label, val]) => (
                      <View key={label} style={s.infoRow}>
                        <Text style={s.infoLabel}>{label}</Text>
                        <Text style={[
                          s.infoVal,
                          label === 'Reste dû' && { color: '#f44336', fontWeight: 'bold' },
                          label === 'Réglé par' && { fontWeight: '600' },
                        ]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.sectionTitle}>Produits achetés</Text>
                  {renderLignes(detailVente, loadingDetail)}
                  <Text style={[s.sectionTitle, { marginTop: 16 }]}>Historique des versements</Text>
                  {renderVersements(versements, loadingVersements, detailCredit?.montantVerse ?? 0)}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowDetail(false)}>
                <Text style={s.btnCancelText}>Fermer</Text>
              </TouchableOpacity>
              {versements.length > 0 && !loadingVersements && (
                <TouchableOpacity style={s.btnPdf} onPress={imprimerVersements}>
                  <MaterialCommunityIcons name="file-document-outline" size={15} color="#fff" />
                  <Text style={s.btnPdfText}>PDF</Text>
                </TouchableOpacity>
              )}
              {!detailCredit?.estReglee && (
                <TouchableOpacity style={s.btnConfirm} onPress={() => { setShowDetail(false); if (detailCredit) openSimple(detailCredit); }}>
                  <MaterialCommunityIcons name="cash" size={15} color="#fff" />
                  <Text style={s.btnConfirmText}>Régler</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RÈGLEMENT SIMPLE ─── */}
      <Modal visible={showSimple} animationType="slide" transparent onRequestClose={() => setShowSimple(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Règlement crédit</Text>
              <TouchableOpacity onPress={() => setShowSimple(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              {selectedCredit && (
                <>
                  <View style={s.infoCard}>
                    {[
                      ['Client', selectedCredit.clientNom + (selectedCredit.clientPrenom ? ' ' + selectedCredit.clientPrenom : '')],
                      ['N° vente', selectedCredit.numeroVente],
                      ['Total', money(selectedCredit.montantTotal)],
                      ['Versé', money(selectedCredit.montantVerse)],
                      ['Reste dû', money(selectedCredit.montantRestant)],
                    ].map(([label, val]) => (
                      <View key={label} style={s.infoRow}>
                        <Text style={s.infoLabel}>{label}</Text>
                        <Text style={[s.infoVal, label === 'Reste dû' && { color: '#f44336', fontWeight: 'bold' }]}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={s.sectionTitle}>Produits achetés</Text>
                  {renderLignes(simpleVente, loadingVente)}

                  <Text style={s.sectionTitle}>Règlement</Text>
                  <Text style={s.fieldLabel}>Montant à régler</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={simpleMontant}
                    onChangeText={setSimpleMontant}
                    keyboardType="numeric"
                    placeholder={`Max : ${money(selectedCredit.montantRestant)}`}
                  />
                  <Text style={s.fieldLabel}>Mode de paiement</Text>
                  {renderModeChips(simpleMode, setSimpleMode)}
                  {simpleMode !== 'ESPECES' && (
                    <>
                      <Text style={s.fieldLabel}>Référence</Text>
                      <TextInput style={s.fieldInput} value={simpleRef} onChangeText={setSimpleRef} placeholder="N° transaction..." />
                    </>
                  )}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowSimple(false)}>
                <Text style={s.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, savingSimple && { opacity: 0.6 }]} onPress={saveSimple} disabled={savingSimple}>
                {savingSimple
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><MaterialCommunityIcons name="cash" size={15} color="#fff" /><Text style={s.btnConfirmText}>Enregistrer</Text></>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL RÈGLEMENT GROUPÉ ─── */}
      <Modal visible={showGroupe} animationType="slide" transparent onRequestClose={() => setShowGroupe(false)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { maxHeight: '90%' }]}>
            <View style={s.handle} />
            <View style={s.modalHead}>
              <Text style={s.modalTitle} numberOfLines={1}>Groupé — {selectedGroup?.clientNom}</Text>
              <TouchableOpacity onPress={() => setShowGroupe(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={s.modalBody}>
              <Text style={s.hint}>Sélectionnez les crédits à inclure :</Text>
              {(selectedGroup?.credits || []).map(c => {
                const isRegle = c.estReglee;
                return (
                  <TouchableOpacity
                    key={c.venteId}
                    style={[s.groupeItem, !isRegle && selectedIds.has(c.venteId) && s.groupeItemSelected, isRegle && s.groupeItemRegle]}
                    onPress={() => { if (!isRegle) toggleId(c.venteId); }}
                    disabled={isRegle}
                  >
                    {isRegle ? (
                      <MaterialCommunityIcons name="check-circle" size={20} color="#4caf50" />
                    ) : (
                      <MaterialCommunityIcons
                        name={selectedIds.has(c.venteId) ? 'checkbox-outline' : 'checkbox-blank-outline'}
                        size={20} color={selectedIds.has(c.venteId) ? '#9c27b0' : '#bbb'}
                      />
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.groupeItemNum}>{c.numeroVente}</Text>
                      {isRegle && c.dateReglement ? (
                        <Text style={[s.groupeItemDate, { color: '#4caf50' }]}>Réglé le {dateStr(c.dateReglement)}</Text>
                      ) : c.dateEcheance ? (
                        <Text style={s.groupeItemDate}>Éch. {dateStr(c.dateEcheance)}</Text>
                      ) : null}
                    </View>
                    <Text style={[s.groupeItemMontant, isRegle && { color: '#4caf50' }, c.enRetard && { color: '#f44336' }]}>
                      {isRegle ? money(c.montantTotal) : money(c.montantRestant)}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <View style={s.groupeTotal}>
                <Text style={s.groupeTotalLabel}>{selectedIds.size} crédit(s) sélectionné(s)</Text>
                <Text style={s.groupeTotalVal}>{money(groupeTotal())}</Text>
              </View>

              <Text style={s.fieldLabel}>Montant total à régler</Text>
              <TextInput style={s.fieldInput} value={groupeMontant} onChangeText={setGroupeMontant} keyboardType="numeric" />
              {parseFloat(groupeMontant) < groupeTotal() && (
                <Text style={s.hint}>Montant partiel — distribué proportionnellement</Text>
              )}
              <Text style={s.fieldLabel}>Mode de paiement</Text>
              {renderModeChips(groupeMode, setGroupeMode)}
              {groupeMode !== 'ESPECES' && (
                <>
                  <Text style={s.fieldLabel}>Référence</Text>
                  <TextInput style={s.fieldInput} value={groupeRef} onChangeText={setGroupeRef} placeholder="N° transaction..." />
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowGroupe(false)}>
                <Text style={s.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, (savingGroupe || !selectedIds.size) && { opacity: 0.5 }]}
                onPress={saveGroupe}
                disabled={savingGroupe || !selectedIds.size}
              >
                {savingGroupe
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><MaterialCommunityIcons name="account-group" size={15} color="#fff" /><Text style={s.btnConfirmText}>Régler ({selectedIds.size})</Text></>
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
  hero: { backgroundColor: '#9c27b0', flexDirection: 'row', padding: 14, alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginBottom: 2 },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Onglets statut
  statutTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  stab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stabActive: { borderBottomColor: '#9c27b0' },
  stabText: { fontSize: 12, color: '#999', fontWeight: '600' },
  stabTextActive: { color: '#9c27b0' },

  // Filtres
  filters: { flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: '#e0e0e0' },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: '#333' },
  retardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#f44336' },
  retardBtnActive: { backgroundColor: '#f44336' },
  retardBtnText: { fontSize: 12, color: '#f44336', fontWeight: '600' },

  // Groupe client
  groupCard: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden', elevation: 2 },
  groupCardRetard: { borderLeftWidth: 3, borderLeftColor: '#f44336' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#9c27b0', alignItems: 'center', justifyContent: 'center' },
  avatarRetard: { backgroundColor: '#f44336' },
  avatarRegle: { backgroundColor: '#4caf50' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  clientNom: { fontWeight: 'bold', fontSize: 15, color: '#1a1a1a' },
  clientPrenom: { fontWeight: '400', color: '#555' } as any,
  clientTel: { color: '#888', fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  badge: { backgroundColor: '#f3e5f5', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeRetard: { backgroundColor: '#f44336', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  badgeRegle: { backgroundColor: '#e8f5e9', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  badgeText: { fontSize: 11, color: '#9c27b0' },
  groupTotal: { fontWeight: 'bold', fontSize: 15, color: '#9c27b0' },
  groupeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: '#f3e5f5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  groupeBtnText: { fontSize: 11, color: '#9c27b0', fontWeight: '600' },

  // Crédit item
  creditItem: { borderTopWidth: 1, borderTopColor: '#f5f5f5', padding: 12 },
  creditItemRegle: { backgroundColor: '#f1f8e9' },
  creditTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  creditNum: { fontWeight: '600', color: '#333', fontSize: 13 },
  creditDate: { color: '#999', fontSize: 11, marginTop: 2 },
  creditMontant: { fontWeight: 'bold', color: '#9c27b0', fontSize: 14 },
  statusBadge: { backgroundColor: '#e3f2fd', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  statusBadgeRetard: { backgroundColor: '#ffebee' },
  statusBadgeRegle: { backgroundColor: '#e8f5e9' },
  statusText: { fontSize: 11, color: '#666' },
  regleParText: { fontSize: 11, color: '#777', marginTop: 4 },
  vendeurText: { fontSize: 11, color: '#aaa', marginTop: 2 },

  // Barre progression
  progressWrap: { marginTop: 6, marginBottom: 8 },
  progressBg: { height: 6, backgroundColor: '#f0f0f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: '#9c27b0', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  progressText: { fontSize: 10, color: '#aaa' },

  // Boutons crédit
  creditBtns: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  detailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#9c27b0', borderRadius: 8, paddingVertical: 7 },
  detailBtnText: { color: '#9c27b0', fontSize: 13, fontWeight: '600' },
  payBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#9c27b0', borderRadius: 8, paddingVertical: 7 },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  recuBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e8f5e9', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  recuBtnText: { color: '#2e7d32', fontSize: 12, fontWeight: '600' },

  // Statut badge modal
  statutBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, marginBottom: 14 },
  statutRegle: { backgroundColor: '#e8f5e9' },
  statutRetard: { backgroundColor: '#ffebee' },
  statutEnCours: { backgroundColor: '#e3f2fd' },
  statutText: { fontWeight: '700', fontSize: 14 },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { color: '#999', fontSize: 15 },
  emptyText: { color: '#aaa', textAlign: 'center', padding: 12, fontSize: 13 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: '#e0e0e0', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: '#1a1a1a', flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },

  // Info card
  infoCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 12, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel: { color: '#888', fontSize: 13 },
  infoVal: { color: '#333', fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Lignes produits
  sectionTitle: { fontWeight: 'bold', color: '#9c27b0', marginBottom: 8, marginTop: 4, fontSize: 13 },
  ligneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  ligneName: { flex: 1, color: '#333', fontSize: 13 },
  ligneQty: { color: '#888', fontSize: 12, marginHorizontal: 8 },
  lignePrice: { color: '#9c27b0', fontWeight: '600', fontSize: 13 },

  // Versements
  versRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  versTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  versDate: { flex: 1, fontSize: 12, color: '#64748b' },
  versMontant: { fontWeight: '700', color: '#16a34a', fontSize: 13 },
  versMode: { fontSize: 11, backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: '#475569', marginLeft: 8 },
  versSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  versTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 2, borderTopColor: '#e2e8f0' },
  versTotalLabel: { fontWeight: '700', color: '#475569', fontSize: 13 },
  versTotalVal: { fontWeight: '700', color: '#16a34a', fontSize: 13 },
  // Banner paiement groupé (en tête de la liste de versements)
  groupeBanner: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#fde68a' },
  groupeBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupeBannerTitle: { fontWeight: 'bold', color: '#92400e', fontSize: 13 },
  groupeBannerSub: { color: '#92400e', fontSize: 12, marginTop: 4 },
  // Badge inline par versement
  versGroupeBadge: { alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  versGroupeBadgeText: { color: '#92400e', fontSize: 10, fontWeight: '700' },

  // Formulaire
  fieldLabel: { color: '#666', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa' },
  chipActive: { backgroundColor: '#9c27b0', borderColor: '#9c27b0' },
  chipText: { fontSize: 13, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { color: '#999', fontSize: 12, fontStyle: 'italic', marginTop: 6 },

  // Groupé
  groupeItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#eee' },
  groupeItemSelected: { borderColor: '#9c27b0', backgroundColor: '#f3e5f5' },
  groupeItemRegle: { opacity: 0.65, backgroundColor: '#f1f8e9', borderColor: '#c8e6c9' },
  groupeItemNum: { fontWeight: '600', color: '#333', fontSize: 13 },
  groupeItemDate: { color: '#999', fontSize: 11, marginTop: 2 },
  groupeItemMontant: { fontWeight: 'bold', color: '#9c27b0', fontSize: 14 },
  groupeTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f3e5f5', borderRadius: 10, padding: 12, marginVertical: 10 },
  groupeTotalLabel: { color: '#666', fontSize: 13 },
  groupeTotalVal: { fontWeight: 'bold', color: '#9c27b0', fontSize: 16 },

  // Boutons footer modal
  btnCancel: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: '#666', fontWeight: '600' },
  btnConfirm: { flex: 2, backgroundColor: '#9c27b0', borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnPdf: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0f766e', borderRadius: 10 },
  btnPdfText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
