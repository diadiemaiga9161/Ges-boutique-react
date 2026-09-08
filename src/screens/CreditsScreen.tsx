import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity,
  TextInput, Alert, ScrollView, Modal
} from 'react-native';
import { Text, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import api, { getPaiementsGroupes, reglerCreditCaisse } from '../services/api.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRecuReglementCreditHtml } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import { MontantInput } from '../components/MontantInput';
import { useColors } from '../theme/colors';

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
  dateOperation?: string;
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
  referenceGroupe?: string;
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

const ITEMS_PAR_PAGE = 10;

// ─── Utilitaires ─────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';
const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CreditsScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const s = createStyles(colors);

  const [allCredits, setAllCredits] = useState<CreditInfo[]>([]);
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [filtered, setFiltered] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRetard, setFilterRetard] = useState(false);
  const [statutFilter, setStatutFilter] = useState<StatutFilter>('EN_COURS');

  // Filtres dates + client
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [clientSelectionne, setClientSelectionne] = useState('');

  // Pagination
  const [pageActuelle, setPageActuelle] = useState(1);

  // Modal détail (lecture seule)
  const [showDetail, setShowDetail] = useState(false);
  const [detailCredit, setDetailCredit] = useState<CreditInfo | null>(null);
  const [detailVente, setDetailVente] = useState<VenteDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [versements, setVersements] = useState<OperationCaisse[]>([]);
  const [loadingVersements, setLoadingVersements] = useState(false);

  // States supplémentaires modal détail
  const [versementsSimples, setVersementsSimples] = useState<OperationCaisse[]>([]);
  const [paiementsGroupesDetail, setPaiementsGroupesDetail] = useState<Map<string, OperationCaisse[]>>(new Map());
  const [rechercheVersement, setRechercheVersement] = useState('');
  const [expandedGroupesDetail, setExpandedGroupesDetail] = useState<Set<string>>(new Set());

  // Modal règlement simple
  const [showSimple, setShowSimple] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditInfo | null>(null);
  const [simpleVente, setSimpleVente] = useState<VenteDetail | null>(null);
  const [loadingVente, setLoadingVente] = useState(false);
  const [simpleMontant, setSimpleMontant] = useState(0);
  const [simpleMode, setSimpleMode] = useState<Mode>('ESPECES');
  const [simpleRef, setSimpleRef] = useState('');
  const [savingSimple, setSavingSimple] = useState(false);

  // Modal règlement groupé
  const [showGroupe, setShowGroupe] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupeMontant, setGroupeMontant] = useState(0);
  const [groupeMode, setGroupeMode] = useState<Mode>('ESPECES');
  const [groupeRef, setGroupeRef] = useState('');
  const [savingGroupe, setSavingGroupe] = useState(false);

  // Onglets principaux + paiements groupés
  const [activeTab, setActiveTab] = useState<'credits' | 'groupes'>('credits');
  const [paiementsGroupes, setPaiementsGroupes] = useState<PaiementGroupe[]>([]);
  const [paiementsGroupesLoading, setPaiementsGroupesLoading] = useState(false);
  const [expandedGroupes, setExpandedGroupes] = useState<Set<string>>(new Set());

  // ── Filtres onglet paiements groupés ──
  const [rechercheGroupe, setRechercheGroupe] = useState('');
  const [dateDebutGroupe, setDateDebutGroupe] = useState('');
  const [dateFinGroupe, setDateFinGroupe] = useState('');
  const [clientGroupeSelectionne, setClientGroupeSelectionne] = useState('');

  // ─── Clients uniques (pour filtre chip) ──────────────────────────────────
  const clientsUniques = useMemo(() => {
    const noms = allCredits.map(c => c.clientNom).filter(Boolean);
    return Array.from(new Set(noms)).sort();
  }, [allCredits]);

  // ─── Clients uniques onglet paiements groupés ──────────────────────────
  const clientsGroupesUniques = useMemo(() => {
    const noms = (paiementsGroupes || []).map((g: PaiementGroupe) => g.clientNom || '').filter(Boolean);
    return [...new Set(noms)].sort();
  }, [paiementsGroupes]);

  // ─── Paiements groupés filtrés ────────────────────────────────────────
  const paiementsGroupesFiltres = useMemo(() => {
    return (paiementsGroupes || []).filter((g: PaiementGroupe) => {
      const client = g.clientNom || '';
      const date = g.date || '';
      const okRecherche = !rechercheGroupe || client.toLowerCase().includes(rechercheGroupe.toLowerCase());
      const okClient = !clientGroupeSelectionne || client === clientGroupeSelectionne;
      const okDebut = !dateDebutGroupe || date >= dateDebutGroupe;
      const okFin = !dateFinGroupe || date <= dateFinGroupe + 'T23:59:59';
      return okRecherche && okClient && okDebut && okFin;
    });
  }, [paiementsGroupes, rechercheGroupe, clientGroupeSelectionne, dateDebutGroupe, dateFinGroupe]);

  // ─── Pagination ───────────────────────────────────────────────────────────
  const creditsPagines = useMemo(() => {
    const debut = (pageActuelle - 1) * ITEMS_PAR_PAGE;
    return filtered.slice(debut, debut + ITEMS_PAR_PAGE);
  }, [filtered, pageActuelle]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / ITEMS_PAR_PAGE)), [filtered]);

  // Reset page quand un filtre change
  useEffect(() => { setPageActuelle(1); }, [search, filterRetard, statutFilter, dateDebut, dateFin, clientSelectionne]);

  // ─── Versements filtrés (modal détail) ───────────────────────────────────
  const versementsFiltres = useMemo(() => {
    if (!rechercheVersement.trim()) return versementsSimples;
    const t = rechercheVersement.toLowerCase();
    return versementsSimples.filter(v =>
      (v.utilisateurNom || '').toLowerCase().includes(t) ||
      (v.referencePaiement || '').toLowerCase().includes(t) ||
      (v.modePaiement || '').toLowerCase().includes(t) ||
      dateStr(v.dateOperation).includes(t)
    );
  }, [versementsSimples, rechercheVersement]);

  // ─── Chargement ──────────────────────────────────────────────────────────
  const charger = useCallback(async () => {
    try {
      // Toujours tenter l'appel réel en premier — NetInfo.fetch() peut renvoyer
      // isConnected=null au premier appel et ferait sauter l'appel réel à tort.
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
          return { ...c, montantRestant, estReglee, dateOperation: v.dateOperation || v.dateVente };
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
          dateEcheance: v.dateEcheance, dateOperation: v.dateOperation || v.dateVente,
          dateReglement: v.dateReglement,
          regleParNom: v.regleParNom, vendeurNom: v.vendeurNom,
          estReglee, enRetard, joursRetard,
        } as CreditInfo;
      });

      setAllCredits(all);
      sauvegarderCache('credits', all).catch(() => {});
      setFromCache(false);
      applyFilters(all, statutFilter, search, filterRetard, dateDebut, dateFin, clientSelectionne);
    } catch {
      const cached = await lireCache<CreditInfo>('credits');
      if (cached.length > 0) {
        setAllCredits(cached);
        setFromCache(true);
        applyFilters(cached, statutFilter, search, filterRetard, dateDebut, dateFin, clientSelectionne);
      } else {
        setFromCache(false);
      }
    }
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
    retard: boolean,
    debut: string,
    fin: string,
    client: string
  ) => {
    let liste: CreditInfo[];
    if (statut === 'EN_COURS') liste = all.filter(c => !c.estReglee);
    else if (statut === 'REGLES') liste = all.filter(c => !!c.estReglee);
    else liste = [...all];

    // Filtre dates
    if (debut) {
      const d = new Date(debut);
      if (!isNaN(d.getTime())) {
        liste = liste.filter(c => {
          const ref = c.dateOperation || c.dateEcheance || c.dateReglement;
          if (!ref) return false;
          return new Date(ref) >= d;
        });
      }
    }
    if (fin) {
      const d = new Date(fin);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        liste = liste.filter(c => {
          const ref = c.dateOperation || c.dateEcheance || c.dateReglement;
          if (!ref) return false;
          return new Date(ref) <= d;
        });
      }
    }

    // Filtre client sélectionné
    if (client) {
      liste = liste.filter(c => c.clientNom === client);
    }

    const grps = buildGroups(liste);
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
    applyFilters(allCredits, s, search, false, dateDebut, dateFin, clientSelectionne);
  };

  const onSearch = (v: string) => {
    setSearch(v);
    applyFilters(allCredits, statutFilter, v, filterRetard, dateDebut, dateFin, clientSelectionne);
  };

  const toggleRetard = () => {
    const r = !filterRetard;
    setFilterRetard(r);
    applyFilters(allCredits, statutFilter, search, r, dateDebut, dateFin, clientSelectionne);
  };

  const onChangeDateDebut = (v: string) => {
    setDateDebut(v);
    applyFilters(allCredits, statutFilter, search, filterRetard, v, dateFin, clientSelectionne);
  };

  const onChangeDateFin = (v: string) => {
    setDateFin(v);
    applyFilters(allCredits, statutFilter, search, filterRetard, dateDebut, v, clientSelectionne);
  };

  const effacerDates = () => {
    setDateDebut('');
    setDateFin('');
    applyFilters(allCredits, statutFilter, search, filterRetard, '', '', clientSelectionne);
  };

  const onSelectClient = (nom: string) => {
    const next = clientSelectionne === nom ? '' : nom;
    setClientSelectionne(next);
    applyFilters(allCredits, statutFilter, search, filterRetard, dateDebut, dateFin, next);
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

  const toggleGroupeDetail = (ref: string) => {
    setExpandedGroupesDetail(prev => {
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
    try { await Print.printAsync({ html }); } catch { Alert.alert(tr('erreur', lang), 'Impossible de générer le PDF'); }
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

  // ─── Séparation versements simples / groupés ─────────────────────────────
  const separerVersements = (vers: OperationCaisse[]) => {
    const simples: OperationCaisse[] = [];
    const groupesMap = new Map<string, OperationCaisse[]>();
    vers.forEach(v => {
      if (v.referenceGroupe) {
        if (!groupesMap.has(v.referenceGroupe)) groupesMap.set(v.referenceGroupe, []);
        groupesMap.get(v.referenceGroupe)!.push(v);
      } else {
        // Aussi vérifier via motif (rétrocompatibilité)
        const motifGroupé = (v.motif || '').toLowerCase().includes('paiement groupé');
        if (motifGroupé && !v.referenceGroupe) {
          // Versement groupé sans referenceGroupe : traiter comme simple mais avec badge
          simples.push(v);
        } else {
          simples.push(v);
        }
      }
    });
    setVersementsSimples(simples);
    setPaiementsGroupesDetail(groupesMap);
  };

  // ─── Modal détail ────────────────────────────────────────────────────────
  const openDetail = (credit: CreditInfo) => {
    setDetailCredit(credit);
    setDetailVente(null);
    setVersements([]);
    setVersementsSimples([]);
    setPaiementsGroupesDetail(new Map());
    setRechercheVersement('');
    setExpandedGroupesDetail(new Set());
    setShowDetail(true);
    loadVente(credit.venteId, setDetailVente, setLoadingDetail);
    setLoadingVersements(true);
    api.get(`/caisse/credits/${credit.venteId}/reglements`)
      .then(r => {
        const liste = (r.data?.reglements || []) as OperationCaisse[];
        setVersements(liste);
        separerVersements(liste);
      })
      .catch(() => {})
      .finally(() => setLoadingVersements(false));
  };

  // ─── PDF versements ──────────────────────────────────────────────────────
  const imprimerVersements = async () => {
    if (!detailCredit) return;
    const credit = detailCredit;
    const vers = versements;

    const qrData = encodeURIComponent(`CREDIT_N${credit.numeroVente}_${credit.clientNom}_VERSE_${credit.montantVerse}`);
    const isGrouped = vers.some(v => (v.motif || '').toLowerCase().includes('group') || !!v.referenceGroupe);

    // Versements simples pour le tableau principal
    const simplesRows = versementsSimples.length ? versementsSimples.map((v, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
      <td>${dateStr(v.dateOperation)}</td>
      <td style="text-align:right;font-weight:700;color:#166534">${money(v.montant)}</td>
      <td>${v.modePaiement || 'ESPECES'}</td>
      <td>${v.referencePaiement || '—'}</td>
      <td>${v.utilisateurNom || '—'}</td>
      <td>${v.motif || '—'}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:14px">Aucun versement simple</td></tr>`;

    // Section paiements groupés
    let groupesSection = '';
    if (paiementsGroupesDetail.size > 0) {
      const groupesHtml = Array.from(paiementsGroupesDetail.entries()).map(([ref, gVers]) => {
        const totalGroupe = gVers.reduce((s, v) => s + v.montant, 0);
        const lignesGroupe = gVers.map((v, i) => `
        <tr style="background:${i % 2 === 0 ? '#fffbeb' : '#fef3c7'}">
          <td style="padding:5px 8px">${dateStr(v.dateOperation)}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:700;color:#b45309">${money(v.montant)}</td>
          <td style="padding:5px 8px">${v.modePaiement || 'ESPECES'}</td>
          <td style="padding:5px 8px">${v.referencePaiement || '—'}</td>
          <td style="padding:5px 8px">${v.utilisateurNom || '—'}</td>
        </tr>`).join('');
        return `<div style="margin-bottom:12px;border:1px solid #fde68a;border-radius:8px;overflow:hidden">
          <div style="background:#fef3c7;padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-weight:700;color:#92400e;font-size:12px">GROUPE : ${ref.substring(0, 8).toUpperCase()}</span>
              ${gVers[0]?.dateOperation ? `<span style="color:#78350f;font-size:11px;margin-left:8px">${dateStr(gVers[0].dateOperation)}</span>` : ''}
            </div>
            <span style="font-weight:800;color:#b45309;font-size:13px">${money(totalGroupe)}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="background:#fde68a"><th style="padding:5px 8px;text-align:left">Date</th><th style="padding:5px 8px;text-align:right">Montant</th><th style="padding:5px 8px">Mode</th><th style="padding:5px 8px">Référence</th><th style="padding:5px 8px">Par</th></tr></thead>
            <tbody>${lignesGroupe}</tbody>
          </table>
        </div>`;
      }).join('');
      groupesSection = `
      <div class="sec-title" style="margin-top:16px">Paiements groupés (${paiementsGroupesDetail.size} groupe(s))</div>
      ${groupesHtml}`;
    }

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
    <div class="sec-title">Versements simples (${versementsSimples.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th><th>Par</th><th>Motif</th></tr></thead>
      <tbody>${simplesRows}</tbody>
      <tfoot><tr style="background:#eff6ff;font-weight:700"><td>Total</td><td style="color:#166534">${money(credit.montantVerse)}</td><td colspan="4"></td></tr></tfoot>
    </table>
    ${!credit.estReglee ? `<div style="margin-top:10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;text-align:center;font-weight:700;color:#dc2626">Reste à payer : ${money(credit.montantRestant)}</div>` : ''}
    ${groupesSection}
  </div>
  <div class="ftr">Ges Boutique · Historique versements · ${new Date().toLocaleDateString('fr-FR')}</div>
</div></body></html>`;

    try {
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert(tr('erreur', lang), 'Impossible de générer le PDF');
    }
  };

  // ─── Règlement simple ────────────────────────────────────────────────────
  const openSimple = (credit: CreditInfo) => {
    if (credit.estReglee) return;
    setSelectedCredit(credit);
    setSimpleMontant(credit.montantRestant);
    setSimpleMode('ESPECES');
    setSimpleRef('');
    setSimpleVente(null);
    setShowSimple(true);
    loadVente(credit.venteId, setSimpleVente, setLoadingVente);
  };

  const saveSimple = async () => {
    if (!selectedCredit) return;
    const montant = simpleMontant;
    if (!montant || montant <= 0) { Alert.alert(tr('erreur', lang), 'Montant invalide'); return; }
    if (montant > selectedCredit.montantRestant) {
      Alert.alert(tr('erreur', lang), `Montant max : ${money(selectedCredit.montantRestant)}`); return;
    }
    setSavingSimple(true);
    try {
      const raw = await AsyncStorage.getItem('user');
      const user = raw ? JSON.parse(raw) : {};
      const payload = {
        venteCreditId: selectedCredit.venteId,
        montantRegle: montant,
        modePaiement: simpleMode,
        referencePaiement: simpleRef || undefined,
        utilisateurId: user.id,
      };
      const res = await executerOuMettreEnFile(
        'credit_reglement',
        payload,
        () => reglerCreditCaisse(payload)
      );
      setShowSimple(false);
      if (res.offline) {
        // Mise à jour locale optimiste
        setAllCredits(prev => prev.map(c =>
          c.venteId === selectedCredit.venteId
            ? { ...c, montantVerse: c.montantVerse + montant, montantRestant: Math.max(0, c.montantRestant - montant) }
            : c
        ));
        Alert.alert('Sauvegardé hors ligne', 'Règlement mis en file — sync au retour connexion');
      } else {
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
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e?.response?.data?.message || 'Règlement impossible');
    }
    setSavingSimple(false);
  };

  // ─── Règlement groupé ────────────────────────────────────────────────────
  const openGroupe = (group: ClientGroup) => {
    setSelectedGroup(group);
    setSelectedIds(new Set(group.credits.filter(c => !c.estReglee).map(c => c.venteId)));
    const total = group.credits.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0);
    setGroupeMontant(total);
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
      setGroupeMontant(total);
      return next;
    });
  };

  const groupeTotal = () => (selectedGroup?.credits || [])
    .filter(c => !c.estReglee && selectedIds.has(c.venteId))
    .reduce((s, c) => s + c.montantRestant, 0);

  const saveGroupe = async () => {
    const creditsSelec = (selectedGroup?.credits || []).filter(c => !c.estReglee && selectedIds.has(c.venteId));
    if (!creditsSelec.length) { Alert.alert(tr('erreur', lang), 'Sélectionnez au moins un crédit'); return; }
    const montant = groupeMontant;
    if (!montant || montant <= 0) { Alert.alert(tr('erreur', lang), 'Montant invalide'); return; }

    Alert.alert(
      tr('confirmer', lang),
      `${creditsSelec.length} crédit(s) — ${money(montant)}`,
      [
        { text: tr('annuler', lang), style: 'cancel' },
        {
          text: tr('confirmer', lang), onPress: async () => {
            setSavingGroupe(true);
            const raw = await AsyncStorage.getItem('user');
            const user = raw ? JSON.parse(raw) : {};
            const total = groupeTotal();
            const ratio = montant / total;
            const refGroupe = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            const motifGroupe = `Paiement groupé | Total apporté: ${montant}`;
            let anyOffline = false;
            for (const c of creditsSelec) {
              const payload = {
                venteCreditId: c.venteId,
                montantRegle: Math.round(c.montantRestant * ratio),
                modePaiement: groupeMode,
                referencePaiement: groupeRef || undefined,
                utilisateurId: user.id,
                motif: motifGroupe,
                referenceGroupe: refGroupe,
              };
              const res = await executerOuMettreEnFile(
                'credit_reglement',
                payload,
                () => reglerCreditCaisse(payload)
              );
              if (res.offline) anyOffline = true;
            }
            setShowGroupe(false);
            if (anyOffline) {
              Alert.alert('Sauvegardé hors ligne', 'Règlements groupés mis en file — sync au retour connexion');
            } else {
              charger();
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

  const renderVersementsModal = () => {
    if (loadingVersements) return <ActivityIndicator size="small" style={{ margin: 12 }} />;
    if (!versements.length) return <Text style={s.emptyText}>Aucun versement enregistré</Text>;

    // Detection banner paiement groupé (rétrocompatibilité motif)
    const versGroupéMotif = versementsSimples.find(v => (v.motif || '').toLowerCase().includes('paiement groupé'));
    let montantTotalApporteGroupe: string | null = null;
    if (versGroupéMotif?.motif) {
      const match = versGroupéMotif.motif.match(/Total apporté:\s*([\d\s]+)/);
      if (match) montantTotalApporteGroupe = match[1].trim();
    }

    return (
      <>
        {/* Barre de recherche versements */}
        <View style={s.versSearchWrap}>
          <MaterialCommunityIcons name="magnify" size={15} color={colors.textSecondary} />
          <TextInput
            style={s.versSearchInput}
            value={rechercheVersement}
            onChangeText={setRechercheVersement}
            placeholder="Rechercher dans les versements..."
            placeholderTextColor={colors.placeholder}
          />
          {rechercheVersement.length > 0 && (
            <TouchableOpacity onPress={() => setRechercheVersement('')}>
              <MaterialCommunityIcons name="close-circle" size={14} color={colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>

        {/* Banner paiement groupé (motif rétrocompatibilité) */}
        {versGroupéMotif && (
          <View style={s.groupeBanner}>
            <View style={s.groupeBannerRow}>
              <MaterialCommunityIcons name="account-group" size={16} color={colors.warning} />
              <Text style={s.groupeBannerTitle}>Paiement groupé</Text>
            </View>
            {montantTotalApporteGroupe && (
              <Text style={s.groupeBannerSub}>
                Montant total apporté : {Number(montantTotalApporteGroupe.replace(/\s/g, '')).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
              </Text>
            )}
          </View>
        )}

        {/* Versements simples filtrés */}
        {versementsFiltres.length === 0 && rechercheVersement.length > 0 ? (
          <Text style={s.emptyText}>Aucun versement correspondant</Text>
        ) : (
          versementsFiltres.map((v, i) => (
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
          ))
        )}

        <View style={s.versTotal}>
          <Text style={s.versTotalLabel}>Total versé</Text>
          <Text style={s.versTotalVal}>{money(detailCredit?.montantVerse ?? 0)}</Text>
        </View>

        {/* Section paiements groupés (referenceGroupe non-null) */}
        {paiementsGroupesDetail.size > 0 && (
          <>
            <Text style={[s.sectionTitle, { marginTop: 16, color: colors.warning }]}>
              Paiements groupés ({paiementsGroupesDetail.size} groupe{paiementsGroupesDetail.size > 1 ? 's' : ''})
            </Text>
            {Array.from(paiementsGroupesDetail.entries()).map(([ref, gVers]) => {
              const totalGroupe = gVers.reduce((sum, v) => sum + v.montant, 0);
              const isExpanded = expandedGroupesDetail.has(ref);
              const refCourte = ref.substring(0, 8).toUpperCase();
              return (
                <View key={ref} style={s.groupeDetailCard}>
                  <TouchableOpacity
                    style={s.groupeDetailHeader}
                    onPress={() => toggleGroupeDetail(ref)}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={s.groupeRefBadge}>
                          <Text style={s.groupeRefBadgeText}>GROUPE</Text>
                        </View>
                        <Text style={s.groupeDetailRef}>{refCourte}</Text>
                      </View>
                      <Text style={s.groupeDetailDate}>
                        {gVers[0]?.dateOperation ? dateStr(gVers[0].dateOperation) : '—'}
                        {'  ·  '}{gVers.length} versement{gVers.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={s.groupeDetailTotal}>{money(totalGroupe)}</Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18} color={colors.warning} style={{ marginTop: 2 }}
                      />
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={s.groupeDetailBody}>
                      {gVers.map((v, idx) => (
                        <View key={idx} style={[s.versRow, { backgroundColor: colors.warningBg }]}>
                          <View style={s.versTop}>
                            <Text style={s.versDate}>{dateStr(v.dateOperation)}</Text>
                            <Text style={[s.versMontant, { color: colors.warning }]}>+{money(v.montant)}</Text>
                            <Text style={s.versMode}>{v.modePaiement || 'ESPECES'}</Text>
                          </View>
                          {!!v.referencePaiement && <Text style={s.versSub}>Réf : {v.referencePaiement}</Text>}
                          {!!v.utilisateurNom && <Text style={s.versSub}>Par {v.utilisateurNom}</Text>}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
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
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <View style={s.container}>

      {/* Onglets principaux */}
      <View style={{ flexDirection: 'row', margin: 12, marginBottom: 4, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === 'credits' ? colors.primary : colors.inputBg }}
          onPress={() => setActiveTab('credits')}>
          <Text style={{ color: activeTab === 'credits' ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{tr('credits', lang)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: activeTab === 'groupes' ? '#d97706' : colors.inputBg }}
          onPress={() => { setActiveTab('groupes'); loadPaiementsGroupes(); }}>
          <Text style={{ color: activeTab === 'groupes' ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
            {'Paiements groupés'}{paiementsGroupes.length > 0 ? ` (${paiementsGroupes.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'credits' && (
        <>

      {/* Hero — 4 stats */}
      <View style={s.hero}>
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{money(totalDu)}</Text>
          <Text style={s.heroLabel}>{tr('reste_a_payer', lang)}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={s.heroStat}>
          <Text style={s.heroVal}>{nbClients}</Text>
          <Text style={s.heroLabel}>{tr('clients', lang)}</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={[s.heroStat, { opacity: nbRetard > 0 ? 1 : 0.5 }]}>
          <Text style={[s.heroVal, { color: '#fca5a5' }]}>{nbRetard}</Text>
          <Text style={s.heroLabel}>En retard</Text>
        </View>
        <View style={s.heroDivider} />
        <View style={[s.heroStat, { opacity: nbRegles > 0 ? 1 : 0.5 }]}>
          <Text style={[s.heroVal, { color: '#86efac' }]}>{nbRegles}</Text>
          <Text style={s.heroLabel}>{tr('regle', lang)}</Text>
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
                color={statutFilter === s2 ? colors.primary : colors.textSecondary}
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

      {/* Filtres texte + retard */}
      <View style={s.filters}>
        <View style={s.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textSecondary} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={onSearch}
            placeholder="Nom ou téléphone..."
            placeholderTextColor={colors.placeholder}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => onSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.placeholder} />
            </TouchableOpacity>
          )}
        </View>
        {statutFilter !== 'REGLES' && (
          <TouchableOpacity style={[s.retardBtn, filterRetard && s.retardBtnActive]} onPress={toggleRetard}>
            <MaterialCommunityIcons name="alert-outline" size={14} color={filterRetard ? '#fff' : colors.danger} />
            <Text style={[s.retardBtnText, filterRetard && { color: '#fff' }]}>Retard</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtre par plage de dates */}
      <View style={s.dateFilterRow}>
        <View style={s.dateInputWrap}>
          <MaterialCommunityIcons name="calendar-start" size={14} color={colors.primary} />
          <TextInput
            style={s.dateInput}
            value={dateDebut}
            onChangeText={onChangeDateDebut}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.placeholder}
          />
        </View>
        <Text style={s.dateSep}>→</Text>
        <View style={s.dateInputWrap}>
          <MaterialCommunityIcons name="calendar-end" size={14} color={colors.primary} />
          <TextInput
            style={s.dateInput}
            value={dateFin}
            onChangeText={onChangeDateFin}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor={colors.placeholder}
          />
        </View>
        {(dateDebut || dateFin) && (
          <TouchableOpacity style={s.dateClearBtn} onPress={effacerDates}>
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      {/* Chips clients */}
      {clientsUniques.length > 0 && (
        <View style={s.clientChipsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.clientChipsContent}>
            <TouchableOpacity
              style={[s.clientChip, !clientSelectionne && s.clientChipActive]}
              onPress={() => onSelectClient('')}
            >
              <Text style={[s.clientChipText, !clientSelectionne && s.clientChipTextActive]}>Tous</Text>
            </TouchableOpacity>
            {clientsUniques.map(nom => (
              <TouchableOpacity
                key={nom}
                style={[s.clientChip, clientSelectionne === nom && s.clientChipActive]}
                onPress={() => onSelectClient(nom)}
              >
                <Text style={[s.clientChipText, clientSelectionne === nom && s.clientChipTextActive]} numberOfLines={1}>
                  {nom}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Compteur résultats */}
      <View style={s.resultCountRow}>
        <Text style={s.resultCountText}>
          {filtered.length} client{filtered.length !== 1 ? 's' : ''} · page {pageActuelle}/{totalPages}
        </Text>
      </View>

      {/* Liste paginée */}
      <FlatList
        data={creditsPagines}
        keyExtractor={g => `${g.clientNom}__${g.clientTelephone || ''}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.success} />
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
                      <MaterialCommunityIcons name="check" size={10} color={colors.success} />
                      <Text style={[s.badgeText, { color: colors.success, marginLeft: 3 }]}>{g.nbRegles} réglé{g.nbRegles > 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.groupTotal, g.enRetard && { color: colors.danger }, g.totalRestant === 0 && { color: colors.success }]}>
                  {g.totalRestant > 0 ? money(g.totalRestant) : '✓ Réglé'}
                </Text>
                {g.totalRestant > 0 && (
                  <TouchableOpacity style={s.groupeBtn} onPress={() => openGroupe(g)}>
                    <MaterialCommunityIcons name="account-group" size={13} color={colors.primary} />
                    <Text style={s.groupeBtnText}>Groupé</Text>
                  </TouchableOpacity>
                )}
                <MaterialCommunityIcons
                  name={g.expanded ? 'chevron-up' : 'chevron-down'}
                  size={20} color={colors.textSecondary} style={{ marginTop: 4 }}
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
                        <Text style={[s.creditDate, { color: colors.success }]}>
                          <MaterialCommunityIcons name="check-circle-outline" size={11} /> {dateStr(credit.dateReglement)}
                        </Text>
                      )
                    ) : (
                      credit.dateEcheance && (
                        <Text style={[s.creditDate, credit.enRetard && { color: colors.danger }]}>
                          <MaterialCommunityIcons name="calendar-outline" size={11} /> {dateStr(credit.dateEcheance)}
                        </Text>
                      )
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[s.creditMontant, credit.estReglee && { color: colors.success }, credit.enRetard && { color: colors.danger }]}>
                      {credit.estReglee ? money(credit.montantTotal) : money(credit.montantRestant)}
                    </Text>
                    <View style={[
                      s.statusBadge,
                      credit.estReglee ? s.statusBadgeRegle : credit.enRetard ? s.statusBadgeRetard : null
                    ]}>
                      <Text style={[s.statusText, credit.estReglee && { color: colors.success }, credit.enRetard && { color: colors.danger }]}>
                        {credit.estReglee ? '✓ Réglé' : credit.enRetard ? '⚠ Retard' : 'En cours'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Réglé par */}
                {credit.regleParNom && (
                  <Text style={s.regleParText}>
                    <MaterialCommunityIcons name="account-check-outline" size={12} color={colors.textSecondary} /> Réglé par{' '}
                    <Text style={{ fontWeight: '600', color: colors.text }}>{credit.regleParNom}</Text>
                  </Text>
                )}
                {credit.vendeurNom && (
                  <Text style={s.vendeurText}>
                    <MaterialCommunityIcons name="store-outline" size={12} color={colors.textSecondary} /> Vente par{' '}
                    <Text style={{ fontWeight: '500' }}>{credit.vendeurNom}</Text>
                  </Text>
                )}

                {/* Barre de progression (seulement si pas réglé) */}
                {!credit.estReglee && (
                  <View style={s.progressWrap}>
                    <View style={s.progressBg}>
                      <View style={[
                        s.progressFill,
                        credit.enRetard && { backgroundColor: colors.danger },
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
                    <MaterialCommunityIcons name="eye-outline" size={14} color={colors.primary} />
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
                        } catch { Alert.alert(tr('erreur', lang), 'Impossible de générer le reçu'); }
                      }}
                    >
                      <MaterialCommunityIcons name="receipt" size={14} color={colors.success} />
                      <Text style={s.recuBtnText}>Recu PDF</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        ListFooterComponent={
          filtered.length > 0 ? (
            <View style={s.paginationRow}>
              <TouchableOpacity
                style={[s.pageBtn, pageActuelle === 1 && s.pageBtnDisabled]}
                onPress={() => setPageActuelle(p => Math.max(1, p - 1))}
                disabled={pageActuelle === 1}
              >
                <MaterialCommunityIcons name="chevron-left" size={18} color={pageActuelle === 1 ? colors.border : colors.primary} />
                <Text style={[s.pageBtnText, pageActuelle === 1 && { color: colors.border }]}>Précédent</Text>
              </TouchableOpacity>
              <Text style={s.pageInfo}>Page {pageActuelle}/{totalPages}</Text>
              <TouchableOpacity
                style={[s.pageBtn, pageActuelle === totalPages && s.pageBtnDisabled]}
                onPress={() => setPageActuelle(p => Math.min(totalPages, p + 1))}
                disabled={pageActuelle === totalPages}
              >
                <Text style={[s.pageBtnText, pageActuelle === totalPages && { color: colors.border }]}>Suivant</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={pageActuelle === totalPages ? colors.border : colors.primary} />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

        </>
      )}

      {activeTab === 'groupes' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {/* ── Filtres paiements groupés ── */}
          {!paiementsGroupesLoading && paiementsGroupes.length > 0 && (
            <View style={s.groupeFiltresBox}>
              {/* Recherche client */}
              <View style={s.groupeSearchWrap}>
                <MaterialCommunityIcons name="magnify" size={16} color={colors.warning} />
                <TextInput
                  style={s.groupeSearchInput}
                  value={rechercheGroupe}
                  onChangeText={setRechercheGroupe}
                  placeholder="Rechercher un client..."
                  placeholderTextColor={colors.placeholder}
                />
                {rechercheGroupe.length > 0 && (
                  <TouchableOpacity onPress={() => setRechercheGroupe('')}>
                    <MaterialCommunityIcons name="close-circle" size={15} color={colors.placeholder} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filtre dates */}
              <View style={s.groupeDateRow}>
                <View style={s.groupeDateWrap}>
                  <MaterialCommunityIcons name="calendar-start" size={13} color={colors.warning} />
                  <TextInput
                    style={s.groupeDateInput}
                    value={dateDebutGroupe}
                    onChangeText={setDateDebutGroupe}
                    placeholder="Du (AAAA-MM-JJ)"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                <Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>→</Text>
                <View style={s.groupeDateWrap}>
                  <MaterialCommunityIcons name="calendar-end" size={13} color={colors.warning} />
                  <TextInput
                    style={s.groupeDateInput}
                    value={dateFinGroupe}
                    onChangeText={setDateFinGroupe}
                    placeholder="Au (AAAA-MM-JJ)"
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
                {(dateDebutGroupe || dateFinGroupe) && (
                  <TouchableOpacity onPress={() => { setDateDebutGroupe(''); setDateFinGroupe(''); }} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Chips clients groupes */}
              {clientsGroupesUniques.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, gap: 6 }}>
                  <TouchableOpacity
                    style={[s.clientChip, !clientGroupeSelectionne && s.groupeChipActive]}
                    onPress={() => setClientGroupeSelectionne('')}
                  >
                    <Text style={[s.clientChipText, !clientGroupeSelectionne && s.groupeChipTextActive]}>Tous</Text>
                  </TouchableOpacity>
                  {clientsGroupesUniques.map(nom => (
                    <TouchableOpacity
                      key={nom}
                      style={[s.clientChip, clientGroupeSelectionne === nom && s.groupeChipActive]}
                      onPress={() => setClientGroupeSelectionne(prev => prev === nom ? '' : nom)}
                    >
                      <Text style={[s.clientChipText, clientGroupeSelectionne === nom && s.groupeChipTextActive]} numberOfLines={1}>
                        {nom}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Bouton effacer + compteur */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: colors.warning, fontSize: 12, fontWeight: '600' }}>
                  {paiementsGroupesFiltres.length} session{paiementsGroupesFiltres.length !== 1 ? 's' : ''}
                </Text>
                {(rechercheGroupe || dateDebutGroupe || dateFinGroupe || clientGroupeSelectionne) && (
                  <TouchableOpacity
                    onPress={() => { setRechercheGroupe(''); setDateDebutGroupe(''); setDateFinGroupe(''); setClientGroupeSelectionne(''); }}
                    style={s.groupeClearBtn}
                  >
                    <MaterialCommunityIcons name="filter-remove-outline" size={14} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>Effacer filtres</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {paiementsGroupesLoading && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <ActivityIndicator color={colors.warning} />
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Chargement…</Text>
            </View>
          )}
          {!paiementsGroupesLoading && paiementsGroupes.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <MaterialCommunityIcons name="cash-multiple" size={48} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 16 }}>Aucun paiement groupé</Text>
            </View>
          )}
          {!paiementsGroupesLoading && paiementsGroupes.length > 0 && paiementsGroupesFiltres.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <MaterialCommunityIcons name="filter-off-outline" size={40} color={colors.border} />
              <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 14 }}>Aucun résultat pour ces filtres</Text>
            </View>
          )}
          {!paiementsGroupesLoading && paiementsGroupesFiltres.map((pg: PaiementGroupe) => (
            <View key={pg.referenceGroupe} style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.warning, backgroundColor: colors.card }}>

              {/* Header session */}
              <TouchableOpacity
                style={{ backgroundColor: colors.warningBg, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => toggleGroupe(pg.referenceGroupe)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', fontSize: 15, color: colors.warning }}>{pg.clientNom}</Text>
                  <Text style={{ color: colors.warning, fontSize: 12, marginTop: 2 }}>
                    {pg.date ? new Date(pg.date).toLocaleDateString('fr-FR') : '—'}
                    {'  ·  Apporté : '}
                    {(pg.montantTotalApporte ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                  </Text>
                  <Text style={{ color: colors.warning, fontSize: 11, marginTop: 2 }}>
                    {pg.ventesImpliquees?.length || 0} crédit(s)
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={expandedGroupes.has(pg.referenceGroupe) ? 'chevron-down' : 'chevron-right'}
                  size={20} color={colors.warning} />
              </TouchableOpacity>

              {/* Détail des ventes (arbre) */}
              {expandedGroupes.has(pg.referenceGroupe) && (
                <View style={{ backgroundColor: colors.warningBg, paddingHorizontal: 16, paddingVertical: 8 }}>
                  {(pg.ventesImpliquees || []).map((v, idx) => (
                    <View key={v.venteCreditId} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: idx < (pg.ventesImpliquees.length - 1) ? 1 : 0, borderBottomColor: colors.warning }}>
                      {/* Connecteur arbre */}
                      <Text style={{ color: colors.warning, fontSize: 16, width: 20, marginTop: 2 }}>
                        {idx === pg.ventesImpliquees.length - 1 ? '└' : '├'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: colors.text, backgroundColor: colors.inputBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, alignSelf: 'flex-start' }}>
                          {v.numeroVente || `Crédit #${v.venteCreditId}`}
                        </Text>
                        <Text style={{ fontWeight: '700', fontSize: 14, color: colors.text, marginTop: 4 }}>
                          {(v.montantApplique ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                        </Text>
                        {v.resteARegler > 0 && (
                          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                            Reste : {v.resteARegler.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                          </Text>
                        )}
                      </View>
                      <View style={{ backgroundColor: v.statutCredit === 'REGLE' ? colors.successBg : colors.dangerBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: v.statutCredit === 'REGLE' ? colors.success : colors.danger, fontWeight: '700', fontSize: 11 }}>
                          {v.statutCredit === 'REGLE' ? 'Regle' : 'En cours'}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {/* Total */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.warning }}>
                    <Text style={{ color: colors.warning, fontSize: 12 }}>Total apporté</Text>
                    <Text style={{ fontWeight: '800', color: colors.warning, fontSize: 14 }}>
                      {(pg.montantTotalApporte ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
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
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
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
                      color={detailCredit.estReglee ? colors.success : detailCredit.enRetard ? colors.danger : colors.info}
                    />
                    <Text style={[s.statutText, detailCredit.estReglee && { color: colors.success }, detailCredit.enRetard && { color: colors.danger }, !detailCredit.estReglee && !detailCredit.enRetard && { color: colors.info }]}>
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
                          label === 'Reste dû' && { color: colors.danger, fontWeight: 'bold' },
                          label === 'Réglé par' && { fontWeight: '600' },
                        ]}>{val}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.sectionTitle}>Produits achetés</Text>
                  {renderLignes(detailVente, loadingDetail)}
                  <Text style={[s.sectionTitle, { marginTop: 16 }]}>Historique des versements</Text>
                  {renderVersementsModal()}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowDetail(false)}>
                <Text style={s.btnCancelText}>{tr('fermer', lang)}</Text>
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
                  <Text style={s.btnConfirmText}>{tr('payer_credit', lang)}</Text>
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
              <Text style={s.modalTitle}>{tr('credits', lang)} — {tr('payer_credit', lang)}</Text>
              <TouchableOpacity onPress={() => setShowSimple(false)}>
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
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
                        <Text style={[s.infoVal, label === 'Reste dû' && { color: colors.danger, fontWeight: 'bold' }]}>{val}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={s.sectionTitle}>Produits achetés</Text>
                  {renderLignes(simpleVente, loadingVente)}

                  <Text style={s.sectionTitle}>Règlement</Text>
                  <Text style={s.fieldLabel}>{tr('montant_payer', lang)}</Text>
                  <MontantInput
                    style={s.fieldInput}
                    value={simpleMontant}
                    onChangeValue={setSimpleMontant}
                    placeholder={`Max : ${money(selectedCredit.montantRestant)}`}
                  />
                  <Text style={s.fieldLabel}>Mode de paiement</Text>
                  {renderModeChips(simpleMode, setSimpleMode)}
                  {simpleMode !== 'ESPECES' && (
                    <>
                      <Text style={s.fieldLabel}>Référence</Text>
                      <TextInput style={s.fieldInput} value={simpleRef} onChangeText={setSimpleRef} placeholder="N° transaction..." placeholderTextColor={colors.placeholder} />
                    </>
                  )}
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowSimple(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, savingSimple && { opacity: 0.6 }]} onPress={saveSimple} disabled={savingSimple}>
                {savingSimple
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><MaterialCommunityIcons name="cash" size={15} color="#fff" /><Text style={s.btnConfirmText}>{tr('enregistrer', lang)}</Text></>
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
                <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
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
                      <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
                    ) : (
                      <MaterialCommunityIcons
                        name={selectedIds.has(c.venteId) ? 'checkbox-outline' : 'checkbox-blank-outline'}
                        size={20} color={selectedIds.has(c.venteId) ? colors.primary : colors.placeholder}
                      />
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={s.groupeItemNum}>{c.numeroVente}</Text>
                      {isRegle && c.dateReglement ? (
                        <Text style={[s.groupeItemDate, { color: colors.success }]}>Réglé le {dateStr(c.dateReglement)}</Text>
                      ) : c.dateEcheance ? (
                        <Text style={s.groupeItemDate}>Éch. {dateStr(c.dateEcheance)}</Text>
                      ) : null}
                    </View>
                    <Text style={[s.groupeItemMontant, isRegle && { color: colors.success }, c.enRetard && { color: colors.danger }]}>
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
              <MontantInput style={s.fieldInput} value={groupeMontant} onChangeValue={setGroupeMontant} />
              {groupeMontant < groupeTotal() && (
                <Text style={s.hint}>Montant partiel — distribué proportionnellement</Text>
              )}
              <Text style={s.fieldLabel}>Mode de paiement</Text>
              {renderModeChips(groupeMode, setGroupeMode)}
              {groupeMode !== 'ESPECES' && (
                <>
                  <Text style={s.fieldLabel}>Référence</Text>
                  <TextInput style={s.fieldInput} value={groupeRef} onChangeText={setGroupeRef} placeholder="N° transaction..." placeholderTextColor={colors.placeholder} />
                </>
              )}
            </ScrollView>
            <View style={s.modalFoot}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowGroupe(false)}>
                <Text style={s.btnCancelText}>{tr('annuler', lang)}</Text>
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
// STYLE (2026-08-16) : accent violet (#9c27b0) remplacé par le bleu app
// (#1a56db, même que Ionic credits.page.scss et le reste de Ges Boutique)
// — l'écran Crédits était le seul à sortir de l'identité visuelle bleu/blanc
// (voir skill design-premium), sur 32 usages (hero, onglets, avatars, badges,
// boutons, icônes).
const createStyles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Hero
  hero: { backgroundColor: colors.primary, flexDirection: 'row', padding: 14, alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, marginBottom: 2 },
  heroVal: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' },

  // Onglets statut
  statutTabs: { flexDirection: 'row', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  stab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stabActive: { borderBottomColor: colors.primary },
  stabText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  stabTextActive: { color: colors.primary },

  // Filtres
  filters: { flexDirection: 'row', padding: 10, gap: 8, alignItems: 'center', backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 12, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: colors.text },
  retardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.danger },
  retardBtnActive: { backgroundColor: colors.danger },
  retardBtnText: { fontSize: 12, color: colors.danger, fontWeight: '600' },

  // Filtre dates
  dateFilterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 },
  dateInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 8, height: 36, borderWidth: 1, borderColor: colors.border },
  dateInput: { flex: 1, marginLeft: 4, fontSize: 12, color: colors.text },
  dateSep: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  dateClearBtn: { padding: 4 },

  // Chips clients
  clientChipsWrap: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  clientChipsContent: { paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  clientChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg },
  clientChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  clientChipText: { fontSize: 12, color: colors.textSecondary, maxWidth: 100 },
  clientChipTextActive: { color: '#fff', fontWeight: '700' },

  // Compteur résultats
  resultCountRow: { paddingHorizontal: 14, paddingVertical: 5, backgroundColor: colors.background },
  resultCountText: { fontSize: 11, color: colors.textSecondary },

  // Pagination
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4, marginBottom: 8 },
  pageBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 2 },
  pageBtnDisabled: { borderColor: colors.border, backgroundColor: colors.inputBg },
  pageBtnText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  pageInfo: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  // Groupe client
  // (pas de shadowColor/Opacity ici : overflow:'hidden' + border radius suffit
  // au clip du contenu, et masquerait de toute façon l'ombre iOS)
  groupCard: { backgroundColor: colors.card, borderRadius: 18, marginBottom: 12, overflow: 'hidden', elevation: 3 },
  groupCardRetard: { borderLeftWidth: 3, borderLeftColor: colors.danger },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarRetard: { backgroundColor: colors.danger },
  avatarRegle: { backgroundColor: colors.success },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  clientNom: { fontWeight: 'bold', fontSize: 15, color: colors.text },
  clientPrenom: { fontWeight: '400', color: colors.textSecondary } as any,
  clientTel: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  badge: { backgroundColor: colors.infoBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeRetard: { backgroundColor: colors.danger, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  badgeRegle: { backgroundColor: colors.successBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: 'row', alignItems: 'center' },
  badgeText: { fontSize: 11, color: colors.primary },
  groupTotal: { fontWeight: 'bold', fontSize: 15, color: colors.primary },
  groupeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, backgroundColor: colors.infoBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  groupeBtnText: { fontSize: 11, color: colors.primary, fontWeight: '600' },

  // Crédit item
  creditItem: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12 },
  creditItemRegle: { backgroundColor: colors.successBg },
  creditTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  creditNum: { fontWeight: '600', color: colors.text, fontSize: 13 },
  creditDate: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  creditMontant: { fontWeight: 'bold', color: colors.primary, fontSize: 14 },
  statusBadge: { backgroundColor: colors.infoBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 3 },
  statusBadgeRetard: { backgroundColor: colors.dangerBg },
  statusBadgeRegle: { backgroundColor: colors.successBg },
  statusText: { fontSize: 11, color: colors.textSecondary },
  regleParText: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  vendeurText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Barre progression
  progressWrap: { marginTop: 6, marginBottom: 8 },
  progressBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  progressText: { fontSize: 10, color: colors.textSecondary },

  // Boutons crédit
  creditBtns: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  detailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 7 },
  detailBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  payBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 7 },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  recuBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.successBg, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  recuBtnText: { color: colors.success, fontSize: 12, fontWeight: '600' },

  // Statut badge modal
  statutBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10, marginBottom: 14 },
  statutRegle: { backgroundColor: colors.successBg },
  statutRetard: { backgroundColor: colors.dangerBg },
  statutEnCours: { backgroundColor: colors.infoBg },
  statutText: { fontWeight: '700', fontSize: 14 },

  // Empty state
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyStateText: { color: colors.textSecondary, fontSize: 15 },
  emptyText: { color: colors.textSecondary, textAlign: 'center', padding: 12, fontSize: 13 },

  // Modal commun
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  handle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontWeight: 'bold', fontSize: 16, color: colors.text, flex: 1, marginRight: 8 },
  modalBody: { padding: 16, maxHeight: 420 },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },

  // Info card
  infoCard: { backgroundColor: colors.inputBg, borderRadius: 14, padding: 12, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { color: colors.textSecondary, fontSize: 13 },
  infoVal: { color: colors.text, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },

  // Lignes produits
  sectionTitle: { fontWeight: 'bold', color: colors.primary, marginBottom: 8, marginTop: 4, fontSize: 13 },
  ligneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  ligneName: { flex: 1, color: colors.text, fontSize: 13 },
  ligneQty: { color: colors.textSecondary, fontSize: 12, marginHorizontal: 8 },
  lignePrice: { color: colors.primary, fontWeight: '600', fontSize: 13 },

  // Versements
  versRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: colors.border },
  versTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  versDate: { flex: 1, fontSize: 12, color: colors.textSecondary },
  versMontant: { fontWeight: '700', color: colors.success, fontSize: 13 },
  versMode: { fontSize: 11, backgroundColor: colors.inputBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, color: colors.textSecondary, marginLeft: 8 },
  versSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  versTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTopWidth: 2, borderTopColor: colors.border },
  versTotalLabel: { fontWeight: '700', color: colors.textSecondary, fontSize: 13 },
  versTotalVal: { fontWeight: '700', color: colors.success, fontSize: 13 },

  // Recherche versements
  versSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.inputBg, borderRadius: 10, paddingHorizontal: 10, height: 34, borderWidth: 1, borderColor: colors.border, marginBottom: 10, gap: 6 },
  versSearchInput: { flex: 1, fontSize: 13, color: colors.text },

  // Banner paiement groupé (en tête de la liste de versements)
  groupeBanner: { backgroundColor: colors.warningBg, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.warning },
  groupeBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupeBannerTitle: { fontWeight: 'bold', color: colors.warning, fontSize: 13 },
  groupeBannerSub: { color: colors.warning, fontSize: 12, marginTop: 4 },

  // Badge inline par versement
  versGroupeBadge: { alignSelf: 'flex-start', backgroundColor: colors.warningBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  versGroupeBadgeText: { color: colors.warning, fontSize: 10, fontWeight: '700' },

  // Paiements groupés dans modal détail
  groupeDetailCard: { borderWidth: 1, borderColor: colors.warning, borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  groupeDetailHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningBg, padding: 12 },
  groupeDetailRef: { fontWeight: '700', color: colors.warning, fontSize: 13, fontFamily: 'monospace' },
  groupeDetailDate: { color: colors.warning, fontSize: 11, marginTop: 3 },
  groupeDetailTotal: { fontWeight: '800', color: colors.warning, fontSize: 14 },
  groupeDetailBody: { backgroundColor: colors.warningBg, paddingHorizontal: 12, paddingVertical: 4 },
  groupeRefBadge: { backgroundColor: '#b45309', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  groupeRefBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Formulaire
  fieldLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, backgroundColor: colors.inputBg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { color: colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginTop: 6 },

  // Groupé (modal règlement groupé)
  groupeItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border },
  groupeItemSelected: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  groupeItemRegle: { opacity: 0.65, backgroundColor: colors.successBg, borderColor: colors.success },
  groupeItemNum: { fontWeight: '600', color: colors.text, fontSize: 13 },
  groupeItemDate: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  groupeItemMontant: { fontWeight: 'bold', color: colors.primary, fontSize: 14 },
  groupeTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.infoBg, borderRadius: 10, padding: 12, marginVertical: 10 },
  groupeTotalLabel: { color: colors.textSecondary, fontSize: 13 },
  groupeTotalVal: { fontWeight: 'bold', color: colors.primary, fontSize: 16 },

  // Filtres onglet paiements groupés
  groupeFiltresBox: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.warning, elevation: 1 },
  groupeSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningBg, borderRadius: 10, paddingHorizontal: 10, height: 38, borderWidth: 1, borderColor: colors.warning, marginBottom: 8, gap: 6 },
  groupeSearchInput: { flex: 1, fontSize: 13, color: colors.text },
  groupeDateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  groupeDateWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.warningBg, borderRadius: 10, paddingHorizontal: 8, height: 34, borderWidth: 1, borderColor: colors.warning },
  groupeDateInput: { flex: 1, marginLeft: 4, fontSize: 11, color: colors.text },
  groupeChipActive: { backgroundColor: '#d97706', borderColor: '#d97706' },
  groupeChipTextActive: { color: '#fff', fontWeight: '700' },
  groupeClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerBg },

  // Boutons footer modal
  btnCancel: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  btnCancelText: { color: colors.textSecondary, fontWeight: '600' },
  btnConfirm: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  btnConfirmText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  btnPdf: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#0f766e', borderRadius: 12 },
  btnPdfText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.warningBg, paddingHorizontal: 12, paddingVertical: 6 },
  offlineTxt: { color: colors.warning, fontSize: 12 },
});
