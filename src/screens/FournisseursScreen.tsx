import React, { useEffect, useState, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, Alert, RefreshControl,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { sauvegarderCache, lireCache, executerOuMettreEnFile } from '../services/offline.service';
import {
  Text, Card, FAB, Searchbar, ActivityIndicator, Modal, Portal,
  TextInput, Button,
} from 'react-native-paper';
import * as Print from 'expo-print';
import {
  getFournisseurs, createFournisseur,
  getHistoriqueAchatsFournisseur, getHistoriquePaiementsFournisseur,
  getSituationFournisseur, creerAchatFournisseur, payerFournisseur,
  getProduits, annulerAchatFournisseur,
  getAvancesFournisseur, creerAvanceFournisseur,
  getComptes, getAchatsNonPayesFournisseur,
} from '../services/api.service';
import { buildRecuPaiementFournisseurHtml } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useMontantInput } from '../components/MontantInput';

const MODES_PAIEMENT = ['ESPECES', 'BANQUE'];
const STATUT_COLOR: Record<string, string> = {
  PAYE: '#16a34a', EN_COURS: '#d97706', IMPAYE: '#dc2626', ANNULE: '#6b7280',
};

function money(v: number) { return (v || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA'; }
function fdate(d?: string) { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR'); }

// Ligne d'achat envoyée au backend — nouveauPrixAchat est optionnel : il n'est
// inclus que si le CUMP a été recalculé ET confirmé par l'utilisateur.
interface LigneAchatFournisseur {
  produitId: number;
  quantite: number;
  prixAchatUnitaire: number;
  prixVente: number;
  nouveauPrixAchat?: number;
}

// Coût moyen pondéré : (stock actuel × ancien prix d'achat + qté entrée × prix d'achat entrée) / (stock actuel + qté entrée)
// Si le stock actuel est à 0 (ou le diviseur nul), on retombe simplement sur le prix d'achat de l'entrée.
function calculerCump(stockActuel: number, ancienPrixAchat: number, quantiteEntree: number, prixAchatEntree: number): number {
  if (!stockActuel || stockActuel <= 0) return prixAchatEntree;
  const diviseur = stockActuel + quantiteEntree;
  if (!diviseur) return prixAchatEntree;
  return (stockActuel * ancienPrixAchat + quantiteEntree * prixAchatEntree) / diviseur;
}

// Popup de confirmation avant d'appliquer le nouveau prix d'achat issu du CUMP.
// Alert.alert n'est pas basé sur une Promise nativement — on le wrap pour pouvoir
// faire un await dans le flux de soumission du formulaire d'achat.
function confirmerRecalculCump(
  produitNom: string,
  stockActuel: number,
  ancienPrixAchat: number,
  quantiteEntree: number,
  prixAchatEntree: number,
  nouveauPrix: number,
): Promise<boolean> {
  return new Promise(resolve => {
    const message =
      `${produitNom}\n\n` +
      `Prix d'achat saisi (${money(prixAchatEntree)}) différent du prix d'achat actuel (${money(ancienPrixAchat)}).\n\n` +
      `Stock actuel : ${stockActuel} × ${money(ancienPrixAchat)} = ${money(stockActuel * ancienPrixAchat)}\n` +
      `Entrée : ${quantiteEntree} × ${money(prixAchatEntree)} = ${money(quantiteEntree * prixAchatEntree)}\n\n` +
      `CUMP = (${stockActuel} × ${ancienPrixAchat} + ${quantiteEntree} × ${prixAchatEntree}) / (${stockActuel} + ${quantiteEntree})\n\n` +
      `Nouveau prix d'achat proposé : ${money(nouveauPrix)}\n\n` +
      `Appliquer ce nouveau prix d'achat au produit ?`;

    Alert.alert(
      'Recalcul du prix d\'achat',
      message,
      [
        { text: 'Ne pas modifier', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Appliquer', onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

type PeriodePreset = 'jour' | 'semaine' | 'mois' | 'personnalise' | 'tout';

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}

function buildFicheFournisseurHtml(fournisseur: any, achats: any[], paiements: any[], situation: any) {
  const achatsActifs = achats.filter(a => a.statut !== 'ANNULE');
  const achatsHtml = achatsActifs.map(a => {
    const lignesStr = (a.lignes || []).map((l: any) => `${l.produit?.nom || '?'} ×${l.quantite}`).join(', ');
    const statColor = a.statut === 'PAYE' ? '#16a34a' : '#d97706';
    return `<tr>
      <td>${a.dateAchat ? new Date(a.dateAchat).toLocaleDateString('fr-FR') : '—'}</td>
      <td style="font-size:11px;color:#475569">${lignesStr || '—'}</td>
      <td style="text-align:right">${(a.montantTotal || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
      <td style="text-align:right;color:#16a34a">${(a.montantPaye || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
      <td><span style="background:${statColor}22;color:${statColor};padding:2px 8px;border-radius:10px;font-size:10px">${a.statut}</span></td>
    </tr>`;
  }).join('');

  const paiementsHtml = paiements.map(p => `<tr>
    <td>${p.datePaiement ? new Date(p.datePaiement).toLocaleDateString('fr-FR') : '—'}</td>
    <td>${p.modePaiement || '—'}</td>
    <td style="text-align:right;font-weight:700;color:#16a34a">${(p.montant || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</td>
    <td>${p.reference || '—'}</td>
  </tr>`).join('');

  const solde = situation?.solde ?? situation?.resteAPayer ?? 0;
  const totalAchats = situation?.totalAchats ?? situation?.totalAchat ?? 0;
  const totalPaye = situation?.totalPaye ?? situation?.montantPaye ?? 0;
  const qrData = encodeURIComponent(`FICHE FOURNISSEUR\nNom: ${fournisseur.nom}\nTotal achats: ${totalAchats} FCFA\nTotal payé: ${totalPaye} FCFA\nSolde dû: ${solde} FCFA`);

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche Fournisseur — ${fournisseur.nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:20px;font-size:12px}
.sheet{background:#fff;max-width:800px;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(8,22,72,.1)}
.hdr{background:linear-gradient(135deg,#081648,#1a56db);color:#fff;padding:24px 28px;display:flex;justify-content:space-between;align-items:center}
.hdr-title{font-size:22px;font-weight:900}.hdr-sub{font-size:12px;opacity:.7;margin-top:4px}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-bottom:1px solid #e5e7eb}
.kpi{padding:16px 20px;text-align:center;border-right:1px solid #e5e7eb}
.kpi:last-child{border-right:none}
.kpi-val{font-size:20px;font-weight:900;color:#1a56db}.kpi-lbl{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:1px}
.section{padding:20px 24px}.section-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #1a56db}
table{width:100%;border-collapse:collapse}
th{background:#f8fafc;padding:8px 10px;text-align:left;font-size:11px;color:#64748b;border-bottom:2px solid #e5e7eb}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:11px}
tr:nth-child(even){background:#fafafa}
.ftr{background:#f8fafc;text-align:center;padding:14px;font-size:10px;color:#94a3b8;border-top:1px solid #e5e7eb}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div>
      <div class="hdr-title">${fournisseur.nom}${fournisseur.code ? ` (${fournisseur.code})` : ''}</div>
      <div class="hdr-sub">Fiche fournisseur · ${new Date().toLocaleDateString('fr-FR')}</div>
      ${fournisseur.telephone ? `<div class="hdr-sub">Tel: ${fournisseur.telephone}</div>` : ''}
    </div>
    <div style="text-align:center">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrData}" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" onerror="this.style.display='none'">
    </div>
  </div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${totalAchats.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</div><div class="kpi-lbl">Total achats</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#16a34a">${totalPaye.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</div><div class="kpi-lbl">Total payé</div></div>
    <div class="kpi"><div class="kpi-val" style="color:#dc2626">${solde.toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA</div><div class="kpi-lbl">Solde dû</div></div>
  </div>
  <div class="section">
    <div class="section-title">Historique des achats</div>
    <table><thead><tr><th>Date</th><th>Produits</th><th>Total</th><th>Payé</th><th>Statut</th></tr></thead>
    <tbody>${achatsHtml || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">Aucun achat</td></tr>'}</tbody></table>
  </div>
  <div class="section">
    <div class="section-title">Paiements effectués</div>
    <table><thead><tr><th>Date</th><th>Mode</th><th>Montant</th><th>Référence</th></tr></thead>
    <tbody>${paiementsHtml || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">Aucun paiement</td></tr>'}</tbody></table>
  </div>
  <div class="ftr">Ges Boutique · Document généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
</body></html>`;
}

export default function FournisseursScreen() {
  const { lang } = useLang();

  const [mode, setMode] = useState<'list' | 'detail'>('list');
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [tab, setTab] = useState<'achats' | 'paiements' | 'situation' | 'avances'>('achats');
  const [achats, setAchats] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [situation, setSituation] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedAchat, setExpandedAchat] = useState<number | null>(null);
  const [achatsNonPayes, setAchatsNonPayes] = useState<any[]>([]);

  // Filtre période (achats / paiements / situation)
  const [periodePreset, setPeriodePreset] = useState<PeriodePreset>('tout');
  const [filtreDateDebut, setFiltreDateDebut] = useState('');
  const [filtreDateFin, setFiltreDateFin] = useState('');

  // Avances
  const [avances, setAvances] = useState<any[]>([]);
  const [soldeAvance, setSoldeAvance] = useState(0);
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [avanceForm, setAvanceForm] = useState({ montant: 0, motif: '', sourceFinancement: 'CAISSE', compteId: undefined as number | undefined });
  const montantAvanceInput = useMontantInput(avanceForm.montant, v => setAvanceForm(f => ({ ...f, montant: v })));
  const [comptes, setComptes] = useState<any[]>([]);

  const [showFournModal, setShowFournModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [showPaiementModal, setShowPaiementModal] = useState(false);

  const [fournForm, setFournForm] = useState({ nom: '', code: '', telephone: '', email: '', adresse: '' });
  const [achatForm, setAchatForm] = useState({ produitId: 0, produitNom: '', quantite: '1', prixAchatUnitaire: 0, prixVente: 0, montantPaye: 0, commentaire: '' });
  const prixAchatInput = useMontantInput(achatForm.prixAchatUnitaire, v => setAchatForm(f => ({ ...f, prixAchatUnitaire: v })));
  const prixVenteAchatInput = useMontantInput(achatForm.prixVente, v => setAchatForm(f => ({ ...f, prixVente: v })));
  const montantPayeInput = useMontantInput(achatForm.montantPaye, v => setAchatForm(f => ({ ...f, montantPaye: v })));
  const [paiForm, setPaiForm] = useState({ montant: 0, modePaiement: 'ESPECES', reference: '', observation: '', compteId: undefined as number | undefined });
  const montantPaiementInput = useMontantInput(paiForm.montant, v => setPaiForm(f => ({ ...f, montant: v })));
  const [produits, setProduits] = useState<any[]>([]);
  const [showProduitPicker, setShowProduitPicker] = useState(false);

  const charger = async () => {
    try {
      const res = await getFournisseurs();
      const data = res.data?.data || res.data || [];
      setFournisseurs(data); setFiltered(data);
      sauvegarderCache('fournisseurs', data).catch(() => {});
      setFromCache(false);
    } catch {
      const cached = await lireCache<any>('fournisseurs');
      if (cached.length > 0) { setFournisseurs(cached); setFiltered(cached); setFromCache(true); }
      else setFromCache(false);
    }
    setLoading(false); setRefreshing(false);
  };

  useEffect(() => {
    charger();
    getComptes().then(r => setComptes(r.data?.data || r.data || [])).catch(() => {});
  }, []);
  useEffect(() => {
    if (!search) { setFiltered(fournisseurs); return; }
    setFiltered(fournisseurs.filter((f: any) =>
      f.nom?.toLowerCase().includes(search.toLowerCase()) ||
      f.code?.toLowerCase().includes(search.toLowerCase()),
    ));
  }, [search, fournisseurs]);

  const chargerDetail = async (id: number, dateDebut?: string, dateFin?: string) => {
    setLoadingDetail(true);
    try {
      const [ra, rp, rs, rv, rnp] = await Promise.all([
        getHistoriqueAchatsFournisseur(id, dateDebut, dateFin),
        getHistoriquePaiementsFournisseur(id, dateDebut, dateFin),
        getSituationFournisseur(id, dateDebut, dateFin),
        getAvancesFournisseur(id),
        getAchatsNonPayesFournisseur(id).catch(() => ({ data: { achats: [] } })),
      ]);
      setAchats(ra.data?.achats || []);
      setPaiements(rp.data?.paiements || []);
      setSituation(rs.data?.data || rs.data);
      const avancesData: any[] = rv.data?.avances || rv.data || [];
      setAvances(avancesData);
      setSoldeAvance(avancesData.reduce((s: number, a: any) => s + (a.montant || 0), 0));
      setAchatsNonPayes(rnp.data?.achats || []);
    } catch {}
    setLoadingDetail(false);
  };

  // Calcule les bornes de dates pour un préréglage de période donné
  const calculerPeriode = (preset: PeriodePreset): { dateDebut?: string; dateFin?: string } => {
    const now = new Date();
    if (preset === 'jour') {
      const d = toLocalDate(now);
      return { dateDebut: d, dateFin: d };
    }
    if (preset === 'semaine') {
      const debut = new Date(now);
      debut.setDate(now.getDate() - 6);
      return { dateDebut: toLocalDate(debut), dateFin: toLocalDate(now) };
    }
    if (preset === 'mois') {
      const debut = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateDebut: toLocalDate(debut), dateFin: toLocalDate(now) };
    }
    if (preset === 'personnalise') {
      return { dateDebut: filtreDateDebut || undefined, dateFin: filtreDateFin || undefined };
    }
    return {}; // 'tout' — pas de filtre, historique complet
  };

  // Change le préréglage et recharge aussitôt (sauf 'personnalise' qui attend la saisie + validation)
  const appliquerPeriode = (preset: PeriodePreset) => {
    setPeriodePreset(preset);
    if (preset === 'personnalise') return;
    if (!selected) return;
    const { dateDebut, dateFin } = calculerPeriode(preset);
    chargerDetail(selected.id, dateDebut, dateFin);
  };

  // Valide et applique une période personnalisée saisie manuellement
  const appliquerPeriodePersonnalisee = () => {
    if (!filtreDateDebut || !filtreDateFin) {
      Alert.alert(tr('erreur', lang), 'Renseignez les deux dates (AAAA-MM-JJ)');
      return;
    }
    if (!selected) return;
    chargerDetail(selected.id, filtreDateDebut, filtreDateFin);
  };

  // Recharge le détail du fournisseur sélectionné en conservant le préréglage de période actif
  const rechargerDetailCourant = () => {
    if (!selected) return;
    const { dateDebut, dateFin } = calculerPeriode(periodePreset);
    chargerDetail(selected.id, dateDebut, dateFin);
  };

  const selectionner = (f: any) => {
    setSelected(f); setTab('achats'); setMode('detail');
    setPeriodePreset('tout'); setFiltreDateDebut(''); setFiltreDateFin('');
    chargerDetail(f.id);
  };

  const retourListe = () => {
    setMode('list'); setSelected(null);
    setAchats([]); setPaiements([]); setSituation(null);
    setAvances([]); setSoldeAvance(0); setAchatsNonPayes([]);
    setPeriodePreset('tout'); setFiltreDateDebut(''); setFiltreDateFin('');
  };

  const ajouterFournisseur = async () => {
    if (!fournForm.nom || !fournForm.code) { Alert.alert(tr('erreur', lang), 'Nom et code obligatoires'); return; }
    try {
      const payload = { ...fournForm };
      const res = await executerOuMettreEnFile('fournisseur_create', payload, () => createFournisseur(payload));
      setShowFournModal(false);
      setFournForm({ nom: '', code: '', telephone: '', email: '', adresse: '' });
      if (res.offline) {
        const tempItem = { ...payload, id: Date.now() };
        setFournisseurs(prev => [...prev, tempItem]);
        setFiltered(prev => [...prev, tempItem]);
        Alert.alert('Sauvegardé', 'Fournisseur sauvegardé hors ligne — sync au retour connexion');
      } else {
        charger();
      }
    } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'ajouter le fournisseur'); }
  };

  const ouvrirAchat = async () => {
    try {
      const res = await getProduits();
      const data = res.data?.data || res.data?.produits || res.data || [];
      setProduits(data);
    } catch {}
    setAchatForm({ produitId: 0, produitNom: '', quantite: '1', prixAchatUnitaire: 0, prixVente: 0, montantPaye: 0, commentaire: '' });
    setShowProduitPicker(false);
    setShowAchatModal(true);
  };

  const enregistrerAchat = async () => {
    if (!achatForm.produitId) { Alert.alert(tr('erreur', lang), 'Sélectionnez un produit'); return; }
    if (!achatForm.quantite || !achatForm.prixAchatUnitaire) { Alert.alert(tr('erreur', lang), 'Quantité et prix obligatoires'); return; }
    try {
      const quantite = parseFloat(achatForm.quantite);
      const prixAchatUnitaire = achatForm.prixAchatUnitaire;

      const ligne: LigneAchatFournisseur = {
        produitId: achatForm.produitId,
        quantite,
        prixAchatUnitaire,
        prixVente: achatForm.prixVente || 0,
      };

      // Le produit sélectionné dans ce formulaire provient toujours du catalogue existant
      // (pas de création de produit à la volée ici) — on peut donc comparer directement
      // le prix d'achat saisi avec le prix d'achat actuellement enregistré.
      const produitExistant = produits.find((p: any) => p.id === achatForm.produitId);
      if (
        produitExistant
        && produitExistant.prixAchat != null
        && !isNaN(prixAchatUnitaire)
        && prixAchatUnitaire !== Number(produitExistant.prixAchat)
      ) {
        const stockActuel = Number(produitExistant.quantite) || 0;
        const ancienPrixAchat = Number(produitExistant.prixAchat) || 0;
        const nouveauPrixAchat = Math.round(calculerCump(stockActuel, ancienPrixAchat, quantite, prixAchatUnitaire));
        const confirme = await confirmerRecalculCump(
          produitExistant.nom, stockActuel, ancienPrixAchat, quantite, prixAchatUnitaire, nouveauPrixAchat,
        );
        if (confirme) {
          ligne.nouveauPrixAchat = nouveauPrixAchat;
        }
      }

      const payload = {
        fournisseurId: selected.id,
        lignes: [ligne],
        montantPaye: achatForm.montantPaye || 0,
        commentaire: achatForm.commentaire,
      };
      const res = await executerOuMettreEnFile('achat_fournisseur', payload, () => creerAchatFournisseur(payload));
      setShowAchatModal(false);
      if (res.offline) {
        Alert.alert('Sauvegardé', 'Achat sauvegardé hors ligne — sync au retour connexion');
      } else {
        rechargerDetailCourant();
      }
    } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer l\'achat'); }
  };

  const enregistrerPaiement = async () => {
    if (!paiForm.montant) { Alert.alert(tr('erreur', lang), 'Montant obligatoire'); return; }
    if (paiForm.modePaiement === 'BANQUE' && !paiForm.compteId) {
      Alert.alert(tr('erreur', lang), 'Choisissez un compte bancaire'); return;
    }
    try {
      const payload = {
        fournisseurId: selected.id,
        montant: paiForm.montant,
        modePaiement: paiForm.modePaiement,
        reference: paiForm.reference,
        observation: paiForm.observation,
        compteId: paiForm.modePaiement === 'BANQUE' ? paiForm.compteId : undefined,
      };
      const res = await executerOuMettreEnFile('paiement_fournisseur', payload, () => payerFournisseur(payload));
      setShowPaiementModal(false);
      if (res.offline) {
        Alert.alert('Sauvegardé', 'Paiement sauvegardé hors ligne — sync au retour connexion');
      } else {
        rechargerDetailCourant();
      }
    } catch { Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer le paiement'); }
  };

  const confirmerAnnulerAchat = (achat: any) => {
    Alert.alert(
      tr('annuler', lang) + ' ?',
      `${tr('achat', lang)} du ${fdate(achat.dateAchat)} — ${money(achat.montantTotal)}\nCette action est irréversible.`,
      [
        { text: tr('fermer', lang), style: 'cancel' },
        {
          text: tr('annuler', lang),
          style: 'destructive',
          onPress: async () => {
            try {
              await annulerAchatFournisseur(achat.id);
              rechargerDetailCourant();
            } catch {
              Alert.alert(tr('erreur', lang), 'Impossible d\'annuler cet achat');
            }
          },
        },
      ],
    );
  };

  const enregistrerAvance = async () => {
    if (!avanceForm.montant || avanceForm.montant <= 0) {
      Alert.alert(tr('erreur', lang), 'Montant invalide'); return;
    }
    if (avanceForm.sourceFinancement === 'BANQUE' && !avanceForm.compteId) {
      Alert.alert(tr('erreur', lang), 'Choisissez un compte bancaire'); return;
    }
    try {
      await creerAvanceFournisseur({
        fournisseurId: selected.id,
        montant: avanceForm.montant,
        motif: avanceForm.motif,
        sourceFinancement: avanceForm.sourceFinancement as 'CAISSE' | 'BANQUE',
        compteId: avanceForm.sourceFinancement === 'BANQUE' ? avanceForm.compteId : undefined,
      });
      setShowAvanceModal(false);
      setAvanceForm({ montant: 0, motif: '', sourceFinancement: 'CAISSE', compteId: undefined });
      rechargerDetailCourant();
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible d\'enregistrer l\'avance');
    }
  };

  const genererFichePdf = async () => {
    try {
      const html = buildFicheFournisseurHtml(selected, achats, paiements, situation);
      await Print.printAsync({ html });
    } catch {
      Alert.alert(tr('erreur', lang), 'Impossible de générer la fiche PDF');
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" />;

  // ──── VUE DÉTAIL FOURNISSEUR ────
  if (mode === 'detail' && selected) {
    const achatsActifs = achats.filter(a => a.statut !== 'ANNULE');
    const achatsAnnules = achats.filter(a => a.statut === 'ANNULE');

    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={retourListe} style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailNom}>{selected.nom}</Text>
            {selected.code ? <Text style={styles.detailCode}>{selected.code}</Text> : null}
          </View>
          <TouchableOpacity onPress={genererFichePdf} style={styles.ficheBtn}>
            <Text style={styles.ficheBtnText}>Fiche PDF</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {(['achats', 'paiements', 'situation', 'avances'] as const).map(t => (
            <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'achats' ? tr('achat', lang) : t === 'paiements' ? 'Paiements' : t === 'situation' ? 'Situation' : 'Avances'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Filtre période (achats / paiements / situation) ── */}
        {tab !== 'avances' && (
          <View style={styles.periodBar}>
            <View style={styles.periodRow}>
              {([
                ['tout', 'Tout'],
                ['jour', 'Jour'],
                ['semaine', 'Semaine'],
                ['mois', 'Mois'],
                ['personnalise', 'Personnalisé'],
              ] as [PeriodePreset, string][]).map(([p, label]) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodBtn, periodePreset === p && styles.periodBtnActive]}
                  onPress={() => appliquerPeriode(p)}
                >
                  <Text style={[styles.periodBtnText, periodePreset === p && styles.periodBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {periodePreset === 'personnalise' && (
              <View style={styles.customDateRow}>
                <TextInput
                  mode="outlined"
                  dense
                  value={filtreDateDebut}
                  onChangeText={setFiltreDateDebut}
                  placeholder="Du (AAAA-MM-JJ)"
                  style={styles.dateInput}
                />
                <TextInput
                  mode="outlined"
                  dense
                  value={filtreDateFin}
                  onChangeText={setFiltreDateFin}
                  placeholder="Au (AAAA-MM-JJ)"
                  style={styles.dateInput}
                />
                <TouchableOpacity style={styles.applyBtn} onPress={appliquerPeriodePersonnalisee}>
                  <Text style={styles.applyBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {loadingDetail ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 80 }}>
            {/* ── ACHATS ── */}
            {tab === 'achats' && (
              achats.length === 0
                ? <Text style={styles.empty}>Aucun achat trouvé</Text>
                : (
                  <>
                    {/* Achats actifs */}
                    {achatsActifs.map((a: any) => (
                      <Card key={a.id} style={styles.card}>
                        <TouchableOpacity onPress={() => setExpandedAchat(expandedAchat === a.id ? null : a.id)}>
                          <Card.Content>
                            <View style={styles.row}>
                              <Text style={styles.achatDate}>{fdate(a.dateAchat)}</Text>
                              <Text style={[styles.statutBadge, { backgroundColor: STATUT_COLOR[a.statut] || '#6b7280' }]}>
                                {a.statut}
                              </Text>
                            </View>
                            <View style={[styles.row, { marginTop: 6 }]}>
                              <Text style={styles.moneyLabel}>Total</Text>
                              <Text style={styles.moneyVal}>{money(a.montantTotal)}</Text>
                            </View>
                            <View style={styles.row}>
                              <Text style={styles.moneyLabel}>Payé</Text>
                              <Text style={[styles.moneyVal, { color: '#16a34a' }]}>{money(a.montantPaye)}</Text>
                            </View>
                            {a.montantRestant > 0 && (
                              <View style={styles.row}>
                                <Text style={styles.moneyLabel}>Restant</Text>
                                <Text style={[styles.moneyVal, { color: '#dc2626' }]}>{money(a.montantRestant)}</Text>
                              </View>
                            )}
                            {a.commentaire ? <Text style={styles.sub}>{a.commentaire}</Text> : null}
                            {a.lignes?.length > 0 && (
                              <Text style={styles.expandHint}>{expandedAchat === a.id ? 'Masquer lignes' : `${a.lignes.length} produit(s) — appuyer pour voir`}</Text>
                            )}
                            <TouchableOpacity
                              style={styles.annulerBtn}
                              onPress={() => confirmerAnnulerAchat(a)}
                            >
                              <Text style={styles.annulerBtnText}>Annuler</Text>
                            </TouchableOpacity>
                          </Card.Content>
                        </TouchableOpacity>
                        {expandedAchat === a.id && a.lignes?.length > 0 && (
                          <Card.Content style={styles.lignes}>
                            {a.lignes.map((l: any, i: number) => (
                              <View key={i} style={styles.ligneRow}>
                                <Text style={styles.ligneProduit} numberOfLines={1}>{l.produit?.nom || '—'}</Text>
                                <Text style={styles.ligneQty}>{l.quantite} × {money(l.prixAchatUnitaire)}</Text>
                                <Text style={styles.ligneSous}>{money(l.sousTotal)}</Text>
                              </View>
                            ))}
                          </Card.Content>
                        )}
                      </Card>
                    ))}

                    {/* Achats annulés */}
                    {achatsAnnules.length > 0 && (
                      <>
                        <View style={styles.separateurAnnules}>
                          <View style={styles.separateurLine} />
                          <Text style={styles.separateurLabel}>Achats annulés ({achatsAnnules.length})</Text>
                          <View style={styles.separateurLine} />
                        </View>
                        {achatsAnnules.map((a: any) => (
                          <Card key={a.id} style={styles.cardAnnule}>
                            <Card.Content>
                              <View style={styles.row}>
                                <Text style={[styles.achatDate, styles.textAnnule]}>{fdate(a.dateAchat)}</Text>
                                <Text style={[styles.statutBadge, { backgroundColor: '#6b7280' }]}>
                                  ANNULE
                                </Text>
                              </View>
                              <View style={[styles.row, { marginTop: 6 }]}>
                                <Text style={[styles.moneyLabel, styles.textAnnule]}>Total</Text>
                                <Text style={[styles.moneyVal, styles.textAnnule, styles.textBarre]}>{money(a.montantTotal)}</Text>
                              </View>
                              {a.commentaire ? <Text style={[styles.sub, styles.textAnnule]}>{a.commentaire}</Text> : null}
                            </Card.Content>
                          </Card>
                        ))}
                      </>
                    )}
                  </>
                )
            )}

            {/* ── PAIEMENTS ── */}
            {tab === 'paiements' && (
              paiements.length === 0
                ? <Text style={styles.empty}>Aucun paiement trouvé</Text>
                : paiements.map((p: any, i: number) => (
                  <Card key={p.id ?? i} style={styles.card}>
                    <Card.Content>
                      <View style={styles.row}>
                        <Text style={styles.achatDate}>{fdate(p.datePaiement)}</Text>
                        <Text style={styles.modeBadge}>{p.modePaiement}</Text>
                      </View>
                      <Text style={[styles.moneyVal, { fontSize: 18, marginTop: 4 }]}>{money(p.montant)}</Text>
                      {p.reference ? <Text style={styles.sub}>Réf : {p.reference}</Text> : null}
                      {p.observation ? <Text style={styles.sub}>{p.observation}</Text> : null}
                      <TouchableOpacity
                        style={styles.recuBtn}
                        onPress={async () => {
                          try {
                            const html = buildRecuPaiementFournisseurHtml(p, selected, { nom: selected?.nom || 'Ges Boutique', telephone: selected?.telephone });
                            await Print.printAsync({ html });
                          } catch { Alert.alert(tr('erreur', lang), 'Impossible de générer le reçu'); }
                        }}
                      >
                        <Text style={styles.recuBtnText}>Recu PDF</Text>
                      </TouchableOpacity>
                    </Card.Content>
                  </Card>
                ))
            )}

            {/* ── SITUATION ── */}
            {tab === 'situation' && situation && (
              <Card style={styles.card}>
                <Card.Content>
                  <Text style={styles.sitTitle}>Situation financière</Text>
                  <View style={styles.sitRow}>
                    <Text style={styles.sitLabel}>Total achats</Text>
                    <Text style={styles.sitVal}>{money(situation.totalAchats ?? situation.totalAchat ?? 0)}</Text>
                  </View>
                  <View style={styles.sitRow}>
                    <Text style={styles.sitLabel}>Total payé</Text>
                    <Text style={[styles.sitVal, { color: '#16a34a' }]}>{money(situation.totalPaye ?? situation.montantPaye ?? 0)}</Text>
                  </View>
                  <View style={[styles.sitRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 8 }]}>
                    <Text style={[styles.sitLabel, { fontWeight: 'bold' }]}>Solde dû</Text>
                    <Text style={[styles.sitVal, { color: '#dc2626', fontWeight: 'bold', fontSize: 18 }]}>
                      {money(situation.solde ?? situation.resteAPayer ?? 0)}
                    </Text>
                  </View>
                  {situation.nombreAchats != null && (
                    <Text style={[styles.sub, { marginTop: 8 }]}>{situation.nombreAchats} achat(s) enregistré(s)</Text>
                  )}
                </Card.Content>
              </Card>
            )}
            {tab === 'situation' && !situation && (
              <Text style={styles.empty}>Situation non disponible</Text>
            )}

            {/* ── ACHATS NON PAYÉS ── */}
            {tab === 'situation' && (
              <>
                <Text style={[styles.sitTitle, { marginTop: 16, marginBottom: 8 }]}>
                  Achats non soldés {achatsNonPayes.length > 0 ? `(${achatsNonPayes.length})` : ''}
                </Text>
                {achatsNonPayes.length === 0 ? (
                  <Text style={styles.empty}>Aucun achat non soldé</Text>
                ) : (
                  achatsNonPayes.map((a: any) => (
                    <Card key={a.id} style={styles.card}>
                      <Card.Content>
                        <View style={styles.row}>
                          <Text style={styles.achatDate}>{fdate(a.dateAchat)}</Text>
                          <Text style={[styles.statutBadge, { backgroundColor: STATUT_COLOR[a.statut] || '#d97706' }]}>
                            {a.statut}
                          </Text>
                        </View>
                        <View style={[styles.row, { marginTop: 6 }]}>
                          <Text style={styles.moneyLabel}>Total</Text>
                          <Text style={styles.moneyVal}>{money(a.montantTotal)}</Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.moneyLabel}>Payé</Text>
                          <Text style={[styles.moneyVal, { color: '#16a34a' }]}>{money(a.montantPaye)}</Text>
                        </View>
                        <View style={styles.row}>
                          <Text style={styles.moneyLabel}>Restant</Text>
                          <Text style={[styles.moneyVal, { color: '#dc2626' }]}>{money(a.montantRestant)}</Text>
                        </View>
                        {a.commentaire ? <Text style={styles.sub}>{a.commentaire}</Text> : null}
                        <TouchableOpacity
                          style={styles.payerBtn}
                          onPress={() => {
                            setPaiForm({
                              montant: a.montantRestant || 0,
                              modePaiement: 'ESPECES',
                              reference: '',
                              observation: `Règlement achat du ${fdate(a.dateAchat)}`,
                              compteId: undefined,
                            });
                            setShowPaiementModal(true);
                          }}
                        >
                          <Text style={styles.payerBtnText}>Payer</Text>
                        </TouchableOpacity>
                      </Card.Content>
                    </Card>
                  ))
                )}
              </>
            )}

            {/* ── AVANCES ── */}
            {tab === 'avances' && (
              <>
                <Card style={[styles.card, { backgroundColor: '#eff6ff', marginBottom: 12 }]}>
                  <Card.Content>
                    <Text style={styles.sitLabel}>Solde total des avances</Text>
                    <Text style={[styles.moneyVal, { fontSize: 20, color: '#1a56db', marginTop: 4 }]}>
                      {money(soldeAvance)}
                    </Text>
                  </Card.Content>
                </Card>

                {avances.length === 0 ? (
                  <Text style={styles.empty}>Aucune avance enregistree</Text>
                ) : (
                  avances.map((a: any, i: number) => (
                    <Card key={a.id ?? i} style={styles.card}>
                      <Card.Content>
                        <View style={styles.row}>
                          <Text style={styles.achatDate}>
                            {a.dateAvance ? new Date(a.dateAvance).toLocaleDateString('fr-FR') : '—'}
                          </Text>
                          <Text style={[styles.moneyVal, { color: '#1a56db' }]}>{money(a.montant)}</Text>
                        </View>
                        {a.motif ? <Text style={[styles.sub, { marginTop: 4 }]}>{a.motif}</Text> : null}
                      </Card.Content>
                    </Card>
                  ))
                )}
              </>
            )}
          </ScrollView>
        )}

        {tab === 'achats' && (
          <FAB icon="cart-plus" style={[styles.fab, { backgroundColor: '#1a56db' }]} onPress={ouvrirAchat} />
        )}
        {tab === 'paiements' && (
          <FAB icon="cash" style={[styles.fab, { backgroundColor: '#16a34a' }]} onPress={() => {
            setPaiForm({ montant: 0, modePaiement: 'ESPECES', reference: '', observation: '', compteId: undefined });
            setShowPaiementModal(true);
          }} />
        )}
        {tab === 'avances' && (
          <FAB icon="plus" style={[styles.fab, { backgroundColor: '#1a56db' }]} onPress={() => {
            setAvanceForm({ montant: 0, motif: '', sourceFinancement: 'CAISSE', compteId: undefined });
            setShowAvanceModal(true);
          }} />
        )}

        {/* Modal Achat */}
        <Portal>
          <Modal visible={showAchatModal} onDismiss={() => setShowAchatModal(false)} contentContainerStyle={styles.modal}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('ajouter', lang)} {tr('achat', lang).toLowerCase()}</Text>

              <TouchableOpacity style={styles.picker} onPress={() => setShowProduitPicker(v => !v)}>
                <Text style={achatForm.produitNom ? styles.pickerVal : styles.pickerPh}>
                  {achatForm.produitNom || 'Sélectionner un produit *'}
                </Text>
                <Text style={{ color: '#94a3b8' }}>{showProduitPicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showProduitPicker && (
                <View style={styles.pickerList}>
                  {produits.map((p: any) => (
                    <TouchableOpacity key={p.id} style={styles.pickerItem} onPress={() => {
                      setAchatForm({ ...achatForm, produitId: p.id, produitNom: p.nom, prixAchatUnitaire: p.prixAchat || 0, prixVente: p.prixVente || 0 });
                      setShowProduitPicker(false);
                    }}>
                      <Text style={[styles.pickerItemText, achatForm.produitId === p.id && { color: '#1a56db', fontWeight: 'bold' }]}>
                        {p.nom}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TextInput label="Quantité *" value={achatForm.quantite} onChangeText={t => setAchatForm({ ...achatForm, quantite: t })} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Prix achat unitaire *" value={prixAchatInput.texte} onChangeText={prixAchatInput.onChangeText} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Prix vente" value={prixVenteAchatInput.texte} onChangeText={prixVenteAchatInput.onChangeText} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Montant payé" value={montantPayeInput.texte} onChangeText={montantPayeInput.onChangeText} mode="outlined" keyboardType="numeric" style={styles.input} />
              <TextInput label="Commentaire" value={achatForm.commentaire} onChangeText={t => setAchatForm({ ...achatForm, commentaire: t })} mode="outlined" style={styles.input} />
              <Button mode="contained" onPress={enregistrerAchat} style={{ marginTop: 4 }}>{tr('enregistrer', lang)}</Button>
            </ScrollView>
          </Modal>
        </Portal>

        {/* Modal Paiement */}
        <Portal>
          <Modal visible={showPaiementModal} onDismiss={() => setShowPaiementModal(false)} contentContainerStyle={styles.modal}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('ajouter', lang)} paiement</Text>
            <TextInput label="Montant *" value={montantPaiementInput.texte} onChangeText={montantPaiementInput.onChangeText} mode="outlined" keyboardType="numeric" style={styles.input} />
            <Text style={styles.sectionLabel}>Mode de paiement</Text>
            <View style={{ flexDirection: 'row', marginBottom: 12, gap: 6 }}>
              {MODES_PAIEMENT.map(m => (
                <TouchableOpacity key={m} style={[styles.modeBtn, paiForm.modePaiement === m && styles.modeBtnActive]}
                  onPress={() => setPaiForm({ ...paiForm, modePaiement: m, compteId: undefined })}>
                  <Text style={[styles.modeBtnText, paiForm.modePaiement === m && { color: '#fff' }]}>
                    {m === 'ESPECES' ? 'Espèces' : 'Banque'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {paiForm.modePaiement === 'BANQUE' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.sectionLabel}>Compte bancaire *</Text>
                {comptes.map(c => (
                  <TouchableOpacity key={c.id}
                    style={[styles.modeBtn, { marginBottom: 4, flex: 0 }, paiForm.compteId === c.id && styles.modeBtnActive]}
                    onPress={() => setPaiForm({ ...paiForm, compteId: c.id })}>
                    <Text style={[styles.modeBtnText, paiForm.compteId === c.id && { color: '#fff' }]}>
                      {c.nomBanque} — {(c.soldeActuel || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput label="Reference" value={paiForm.reference} onChangeText={t => setPaiForm({ ...paiForm, reference: t })} mode="outlined" style={styles.input} />
            <TextInput label="Observation" value={paiForm.observation} onChangeText={t => setPaiForm({ ...paiForm, observation: t })} mode="outlined" style={styles.input} />
            <Button mode="contained" onPress={enregistrerPaiement} style={{ marginTop: 4, backgroundColor: '#16a34a' }}>{tr('enregistrer', lang)}</Button>
          </Modal>
        </Portal>

        {/* Modal Avance */}
        <Portal>
          <Modal visible={showAvanceModal} onDismiss={() => setShowAvanceModal(false)} contentContainerStyle={styles.modal}>
            <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('ajouter', lang)} avance</Text>
            <TextInput
              label="Montant *"
              value={montantAvanceInput.texte}
              onChangeText={montantAvanceInput.onChangeText}
              mode="outlined"
              keyboardType="numeric"
              style={styles.input}
            />
            <Text style={styles.sectionLabel}>Source</Text>
            <View style={{ flexDirection: 'row', marginBottom: 12, gap: 6 }}>
              {['CAISSE', 'BANQUE'].map(m => (
                <TouchableOpacity key={m} style={[styles.modeBtn, avanceForm.sourceFinancement === m && styles.modeBtnActive]}
                  onPress={() => setAvanceForm({ ...avanceForm, sourceFinancement: m, compteId: undefined })}>
                  <Text style={[styles.modeBtnText, avanceForm.sourceFinancement === m && { color: '#fff' }]}>
                    {m === 'CAISSE' ? 'Caisse' : 'Banque'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {avanceForm.sourceFinancement === 'BANQUE' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.sectionLabel}>Compte bancaire *</Text>
                {comptes.map(c => (
                  <TouchableOpacity key={c.id}
                    style={[styles.modeBtn, { marginBottom: 4, flex: 0 }, avanceForm.compteId === c.id && styles.modeBtnActive]}
                    onPress={() => setAvanceForm({ ...avanceForm, compteId: c.id })}>
                    <Text style={[styles.modeBtnText, avanceForm.compteId === c.id && { color: '#fff' }]}>
                      {c.nomBanque} — {(c.soldeActuel || 0).toLocaleString('de-DE', { maximumFractionDigits: 0 })} FCFA
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TextInput
              label="Motif"
              value={avanceForm.motif}
              onChangeText={t => setAvanceForm({ ...avanceForm, motif: t })}
              mode="outlined"
              style={styles.input}
            />
            <Button mode="contained" onPress={enregistrerAvance} style={{ marginTop: 4, backgroundColor: '#1a56db' }}>
              {tr('enregistrer', lang)}
            </Button>
          </Modal>
        </Portal>
      </View>
    );
  }

  // ──── VUE LISTE ────
  return (
    <View style={styles.container}>
      <Searchbar placeholder={tr('recherche_fournisseur', lang)} value={search} onChangeText={setSearch} style={styles.search} />
      <FlatList
        data={filtered}
        keyExtractor={f => String(f.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); charger(); }} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 80 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => selectionner(item)}>
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.row}>
                  <View style={styles.initiale}>
                    <Text style={styles.initialeText}>{(item.nom || '?')[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium">{item.nom}</Text>
                    {item.code && <Text style={styles.sub}>{item.code}</Text>}
                    {item.telephone && <Text style={styles.sub}>{item.telephone}</Text>}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card.Content>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{tr('aucun_resultat', lang)}</Text>}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => setShowFournModal(true)} />
      <Portal>
        <Modal visible={showFournModal} onDismiss={() => setShowFournModal(false)} contentContainerStyle={styles.modal}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>{tr('nouveau_fournisseur', lang)}</Text>
          <TextInput label={tr('nom_fournisseur', lang)} value={fournForm.nom} onChangeText={t => setFournForm({ ...fournForm, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Code *" value={fournForm.code} onChangeText={t => setFournForm({ ...fournForm, code: t })} mode="outlined" style={styles.input} placeholder="ex: FOUR-001" />
          <TextInput label={tr('telephone', lang)} value={fournForm.telephone} onChangeText={t => setFournForm({ ...fournForm, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />
          <TextInput label={tr('email', lang)} value={fournForm.email} onChangeText={t => setFournForm({ ...fournForm, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" />
          <TextInput label={tr('adresse', lang)} value={fournForm.adresse} onChangeText={t => setFournForm({ ...fournForm, adresse: t })} mode="outlined" style={styles.input} />
          <Button mode="contained" onPress={ajouterFournisseur}>{tr('enregistrer', lang)}</Button>
        </Modal>
      </Portal>
    </View>
  );
}

// STYLE (2026-08-16) : bleu #1e88e5 (Material blue, différent du reste de
// l'app) uniformisé sur #1a56db, le bleu Ges Boutique utilisé partout
// ailleurs — 15 occurrences (en-tête détail, onglets, boutons, badges).
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  search: { margin: 12 },
  card: { marginBottom: 10, borderRadius: 16 },
  cardAnnule: { marginBottom: 10, borderRadius: 16, backgroundColor: '#f3f4f6', opacity: 0.75 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sub: { color: '#666', fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 40, color: '#999' },
  fab: { position: 'absolute', bottom: 20, right: 20 },
  modal: { backgroundColor: '#fff', margin: 20, borderRadius: 20, padding: 20, maxHeight: '85%' },
  input: { marginBottom: 12 },
  initiale: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a56db', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initialeText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  chevron: { color: '#94a3b8', fontSize: 22, fontWeight: 'bold' },
  // Detail
  detailHeader: { backgroundColor: '#1a56db', flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 18 },
  backBtn: { padding: 6, marginRight: 8 },
  backArrow: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  detailNom: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  detailCode: { color: '#bbdefb', fontSize: 13 },
  ficheBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: 8, marginLeft: 8 },
  ficheBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: '#1a56db' },
  tabLabel: { color: '#6b7280', fontSize: 13, fontWeight: '500' },
  tabLabelActive: { color: '#1a56db', fontWeight: 'bold' },

  // Filtre période
  periodBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 8, paddingHorizontal: 8 },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  periodBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f4f8', borderWidth: 1, borderColor: '#dde3ed' },
  periodBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  periodBtnText: { fontSize: 12, color: '#666', fontWeight: '600' },
  periodBtnTextActive: { color: '#fff' },
  customDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dateInput: { flex: 1, backgroundColor: '#fff', height: 40 },
  applyBtn: { backgroundColor: '#1a56db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  applyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  // Achats non payés
  payerBtn: { backgroundColor: '#ecfdf5', borderRadius: 6, padding: 6, alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: '#a7f3d0' },
  payerBtnText: { color: '#16a34a', fontSize: 12, fontWeight: '600' },
  // Achats
  achatDate: { color: '#475569', fontSize: 13, fontWeight: '500' },
  statutBadge: { color: '#fff', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  modeBadge: { backgroundColor: '#eff6ff', color: '#1e40af', fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  moneyLabel: { color: '#6b7280', fontSize: 13 },
  moneyVal: { fontWeight: 'bold', fontSize: 14, color: '#1e293b' },
  expandHint: { color: '#94a3b8', fontSize: 11, marginTop: 6 },
  lignes: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 },
  ligneRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  ligneProduit: { color: '#334155', fontSize: 13, fontWeight: '500' },
  ligneQty: { color: '#64748b', fontSize: 12 },
  ligneSous: { color: '#1a56db', fontSize: 13, fontWeight: 'bold', textAlign: 'right' },
  annulerBtn: { backgroundColor: '#fef2f2', borderRadius: 6, padding: 6, alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: '#fecaca' },
  annulerBtnText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },
  // Achats annulés
  separateurAnnules: { flexDirection: 'row', alignItems: 'center', marginVertical: 14 },
  separateurLine: { flex: 1, height: 1, backgroundColor: '#d1d5db' },
  separateurLabel: { color: '#9ca3af', fontSize: 12, marginHorizontal: 10, fontWeight: '500' },
  textAnnule: { color: '#9ca3af' },
  textBarre: { textDecorationLine: 'line-through' },
  // Situation
  sitTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 14, color: '#1e293b' },
  sitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sitLabel: { color: '#475569', fontSize: 14 },
  sitVal: { fontWeight: '600', fontSize: 14, color: '#1e293b' },
  // Produit picker
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#94a3b8', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 14, marginBottom: 8, backgroundColor: '#fff' },
  pickerVal: { color: '#1e293b', fontSize: 14 },
  pickerPh: { color: '#94a3b8', fontSize: 14 },
  pickerList: { backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0', maxHeight: 180 },
  pickerItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  pickerItemText: { color: '#334155', fontSize: 13 },
  sectionLabel: { color: '#475569', fontSize: 13, marginBottom: 6 },
  modeBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  modeBtnActive: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  modeBtnText: { color: '#374151', fontSize: 11, fontWeight: '500' },
  recuBtn: { backgroundColor: '#eff6ff', borderRadius: 6, padding: 6, alignSelf: 'flex-start', marginTop: 8 },
  recuBtnText: { color: '#1a56db', fontSize: 12, fontWeight: '600' },
});
