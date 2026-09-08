import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Text, ActivityIndicator, Card } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api, {
  getClients, getProduits, getVentes, getVentesParPeriode,
  getFournisseurs, getDepenses, getPaiementsEmploye, getEmployes,
  getDettesAnciennes, getTransferts,
} from '../services/api.service';
import { imprimerDocumentPdfRN, DesignFacture } from '../services/invoice.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

/**
 * Écran "Export de données" (ADMIN uniquement) — permet d'exporter en PDF ou
 * Excel (.xlsx) un instantané de l'une des 8 catégories de données de la
 * boutique. Réutilise EXACTEMENT le moteur PDF déjà utilisé ailleurs
 * (imprimerDocumentPdfRN — voir DettesAnciennesScreen) et ajoute une
 * nouvelle capacité Excel (SheetJS + expo-file-system + expo-sharing).
 */

// ─── Catégories (liste FERMÉE) ────────────────────────────────────────────────
type CategorieExport =
  | 'CLIENTS' | 'PRODUITS' | 'VENTES' | 'FOURNISSEURS'
  | 'DEPENSES' | 'EMPLOYES' | 'CREDITS_DETTES' | 'TRANSFERTS';

type FormatExport = 'PDF' | 'EXCEL';

interface CategorieConfig {
  value: CategorieExport;
  label: string;
  icon: string;
  needsPeriode: boolean;
}

const CATEGORIES: CategorieConfig[] = [
  { value: 'CLIENTS', label: 'Clients', icon: 'account-group-outline', needsPeriode: false },
  { value: 'PRODUITS', label: 'Produits (stock)', icon: 'package-variant-closed', needsPeriode: false },
  { value: 'VENTES', label: 'Ventes', icon: 'receipt', needsPeriode: true },
  { value: 'FOURNISSEURS', label: 'Fournisseurs', icon: 'truck-outline', needsPeriode: false },
  { value: 'DEPENSES', label: 'Dépenses', icon: 'cash-minus', needsPeriode: true },
  { value: 'EMPLOYES', label: 'Employés', icon: 'account-hard-hat', needsPeriode: false },
  { value: 'CREDITS_DETTES', label: 'Crédits / Dettes', icon: 'credit-card-clock-outline', needsPeriode: true },
  { value: 'TRANSFERTS', label: 'Transferts', icon: 'swap-horizontal', needsPeriode: true },
];

interface DonneesExport {
  titre: string;
  sousTitre: string;
  colonnes: string[];
  lignes: string[][];
  totaux: string[];
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const money = (v: number) => (v ?? 0).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' FCFA';
const dateStr = (d?: string) => (d ? new Date(d).toLocaleDateString('fr-FR') : '—');

function periodeLabel(dateDebut: string, dateFin: string): string {
  return (dateDebut || dateFin) ? `Du ${dateDebut || '…'} au ${dateFin || '…'}` : 'Toute la période';
}

// Filtre client-side générique (mêmes règles que CreditsScreen.applyFilters) :
// si une borne est active et que la date de référence est absente/invalide,
// la ligne est exclue plutôt que de fausser silencieusement le résultat.
function dansPeriode(date: string | undefined, dateDebut: string, dateFin: string): boolean {
  if (!dateDebut && !dateFin) return true;
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  if (dateDebut) {
    const debut = new Date(dateDebut);
    if (!isNaN(debut.getTime()) && d < debut) return false;
  }
  if (dateFin) {
    const fin = new Date(dateFin);
    if (!isNaN(fin.getTime())) {
      fin.setHours(23, 59, 59, 999);
      if (d > fin) return false;
    }
  }
  return true;
}

// ─── Chargement des données par catégorie ────────────────────────────────────

async function chargerClients(): Promise<DonneesExport> {
  const res = await getClients();
  const raw: any[] = res.data?.clients || res.data?.data || (Array.isArray(res.data) ? res.data : []);
  const lignes = raw.map(c => [
    [c.prenom, c.nom].filter(Boolean).join(' ').trim() || c.nom || `Client #${c.id}`,
    c.numeroTelephone || c.telephone || '—',
    c.email || '—',
    c.adresse || '—',
    money(c.soldeCredit || 0),
  ]);
  const totalCredit = raw.reduce((s, c) => s + (c.soldeCredit || 0), 0);
  return {
    titre: 'Export — Clients',
    sousTitre: `${raw.length} client(s)`,
    colonnes: ['Nom complet', 'Téléphone', 'Email', 'Adresse', 'Solde crédit'],
    lignes,
    totaux: [`Nombre de clients : ${raw.length}`, `Total solde crédit : ${money(totalCredit)}`],
  };
}

async function chargerProduits(): Promise<DonneesExport> {
  const res = await getProduits();
  const raw: any[] = res.data?.data || res.data || [];
  // Statut (Périmé/Stock faible/OK) — même calcul client-side que
  // ProductService.normalize() côté Ionic (quantite<=seuilAlerte, datePeremption<aujourd'hui).
  const now = new Date();
  const statutProduit = (p: any): string => {
    const perime = p.datePeremption ? new Date(p.datePeremption) < now : false;
    if (perime) return 'Périmé';
    if (Number(p.quantite || 0) <= Number(p.seuilAlerte || 0)) return 'Stock faible';
    return 'OK';
  };
  const lignes = raw.map(p => [
    p.nom || '—',
    p.categorie?.nom || '—',
    p.fournisseur?.nom || '—',
    money(p.prixAchat || 0),
    money(p.prixVente || 0),
    String(p.quantite ?? 0),
    p.seuilAlerte != null ? String(p.seuilAlerte) : '—',
    statutProduit(p),
  ]);
  const valeurStockAchat = raw.reduce((s, p) => s + (p.quantite || 0) * (p.prixAchat || 0), 0);
  const valeurStockVente = raw.reduce((s, p) => s + (p.quantite || 0) * (p.prixVente || 0), 0);
  return {
    titre: 'Export — Produits',
    sousTitre: `${raw.length} produit(s)`,
    colonnes: ['Produit', 'Catégorie', 'Fournisseur', 'Prix achat', 'Prix vente', 'Stock', 'Seuil alerte', 'Statut'],
    lignes,
    totaux: [
      `Nombre de produits : ${raw.length}`,
      `Valeur du stock (prix achat) : ${money(valeurStockAchat)}`,
      `Valeur du stock (prix vente) : ${money(valeurStockVente)}`,
    ],
  };
}

async function chargerVentes(dateDebut: string, dateFin: string): Promise<DonneesExport> {
  // inclureAnnulees:true UNIQUEMENT ici — l'export doit refléter l'intégralité
  // de l'historique (y compris les ventes annulées), contrairement aux autres
  // écrans (HistoriqueVentesScreen, RapportsScreen, HomeScreen…) qui continuent
  // d'appeler ces mêmes fonctions sans ce paramètre (comportement inchangé).
  const res = (dateDebut && dateFin)
    ? await getVentesParPeriode(dateDebut, dateFin, true)
    : await getVentes({ inclureAnnulees: true });
  const raw: any[] = res.data?.data || res.data || [];
  const lignes = raw.map(v => [
    v.numeroVente || `#${v.id}`,
    dateStr(v.dateVente),
    v.clientNom || 'Client anonyme',
    v.vendeurNom || '—',
    (v.modePaiement || 'ESPECES').replace('_', ' '),
    v.estCredit ? 'Crédit' : 'Comptant',
    money(v.montantTotal || 0),
    (v.annulee || v.statut === 'ANNULEE') ? 'Oui' : 'Non',
  ]);
  const total = raw.reduce((s, v) => s + (v.montantTotal || 0), 0);
  return {
    titre: 'Export — Ventes',
    sousTitre: `${periodeLabel(dateDebut, dateFin)} — ${raw.length} vente(s)`,
    colonnes: ['N° vente', 'Date', 'Client', 'Vendeur', 'Mode paiement', 'Type', 'Montant total', 'Annulée'],
    lignes,
    totaux: [`Nombre de ventes : ${raw.length}`, `Chiffre d'affaires total : ${money(total)}`],
  };
}

async function chargerFournisseurs(): Promise<DonneesExport> {
  const res = await getFournisseurs();
  const raw: any[] = res.data?.data || res.data || [];
  // Colonnes Solde/Statut alignées sur export-donnees.page.ts::exportFournisseurs()
  // — mêmes champs `solde`/`actif` déjà renvoyés par GET /fournisseurs (voir
  // FournisseursScreen.tsx qui les utilise aussi directement sur la liste).
  const lignes = raw.map(f => [
    f.nom || '—', f.code || '—', f.telephone || '—', f.email || '—', f.adresse || '—',
    money(f.solde || 0),
    f.actif === false ? 'Inactif' : 'Actif',
  ]);
  return {
    titre: 'Export — Fournisseurs',
    sousTitre: `${raw.length} fournisseur(s)`,
    colonnes: ['Nom', 'Code', 'Téléphone', 'Email', 'Adresse', 'Solde', 'Statut'],
    lignes,
    totaux: [`Nombre de fournisseurs : ${raw.length}`],
  };
}

async function chargerDepenses(dateDebut: string, dateFin: string): Promise<DonneesExport> {
  const [resD, resP] = await Promise.all([
    getDepenses(),
    getPaiementsEmploye().catch(() => ({ data: [] })),
  ]);
  const liste: any[] = resD.data?.depenses || resD.data?.data || [];
  // Les salaires payés apparaissent comme des dépenses "source externe", même
  // logique de fusion que DepensesScreen.charger() (pas de double moteur).
  const salaires: any[] = (Array.isArray(resP.data) ? resP.data : [])
    .filter((p: any) => p.statut === 'PAYE')
    .map((p: any) => ({
      nom: p.employeNomComplet,
      motif: p.employePoste || 'Salaire',
      date: (p.datePaiement || '').split('T')[0],
      montant: p.montant,
      typeDepense: 'Salaire',
    }));
  let toutes = [...liste, ...salaires];
  if (dateDebut) toutes = toutes.filter(d => d.date && d.date >= dateDebut);
  if (dateFin) toutes = toutes.filter(d => d.date && d.date <= dateFin);
  const lignes = toutes.map(d => [dateStr(d.date), d.nom || '—', d.typeDepense || '—', d.motif || '—', money(d.montant || 0)]);
  const total = toutes.reduce((s, d) => s + (d.montant || 0), 0);
  return {
    titre: 'Export — Dépenses',
    sousTitre: `${periodeLabel(dateDebut, dateFin)} — ${toutes.length} dépense(s)`,
    colonnes: ['Date', 'Nom', 'Type', 'Motif', 'Montant'],
    lignes,
    totaux: [`Nombre de dépenses : ${toutes.length}`, `Total dépenses : ${money(total)}`],
  };
}

async function chargerEmployes(): Promise<DonneesExport> {
  const res = await getEmployes();
  const raw: any[] = res.data?.data || res.data || [];
  // Convention identique à EmployesScreen.tsx (et depense.page.ts côté Ionic) :
  // seul un statut explicitement 'INACTIF' est considéré inactif — un statut
  // manquant/inconnu compte comme actif, pas l'inverse.
  const lignes = raw.map(e => [
    `${e.prenom || ''} ${e.nom || ''}`.trim() || '—',
    e.poste || '—',
    e.telephone || '—',
    money(e.salaireMensuel || 0),
    e.statut === 'INACTIF' ? 'Inactif' : 'Actif',
  ]);
  const masseSalariale = raw.filter(e => e.statut !== 'INACTIF').reduce((s, e) => s + (e.salaireMensuel || 0), 0);
  return {
    titre: 'Export — Employés',
    sousTitre: `${raw.length} employé(s)`,
    colonnes: ['Nom complet', 'Poste', 'Téléphone', 'Salaire mensuel', 'Statut'],
    lignes,
    totaux: [`Nombre d'employés : ${raw.length}`, `Masse salariale mensuelle (actifs) : ${money(masseSalariale)}`],
  };
}

// Combine les deux notions d'argent dû par un client déjà présentes dans
// l'appli (CreditsScreen = ventes à crédit, DettesAnciennesScreen = dettes
// libres) — la catégorie fermée "Crédits/Dettes" couvre les deux à la fois.
async function chargerCreditsDettes(dateDebut: string, dateFin: string): Promise<DonneesExport> {
  const [resNonRegles, resRegles, resDettes] = await Promise.all([
    api.get('/caisse/credits/non-regles').catch(() => ({ data: [] })),
    api.get('/caisse/credits/regles').catch(() => ({ data: [] })),
    getDettesAnciennes().catch(() => ({ data: [] })),
  ]);
  const nonRegles: any[] = (resNonRegles.data?.data || resNonRegles.data?.credits || resNonRegles.data || [])
    .map((c: any) => ({ ...c, estReglee: false }));
  const regles: any[] = (resRegles.data?.data || resRegles.data?.credits || resRegles.data || [])
    .map((c: any) => ({ ...c, estReglee: true }));
  const credits = [...nonRegles, ...regles]
    .filter(c => dansPeriode(c.dateOperation || c.dateEcheance || c.dateReglement, dateDebut, dateFin));

  const dettesRaw: any[] = resDettes.data?.dettes || resDettes.data?.data || (Array.isArray(resDettes.data) ? resDettes.data : []);
  const dettes = dettesRaw.filter((d: any) => dansPeriode(d.dateCredit, dateDebut, dateFin));

  const lignes: string[][] = [];
  let totalRestant = 0;
  credits.forEach((c: any) => {
    const client = `${c.clientPrenom || ''} ${c.clientNom || ''}`.trim() || 'Client divers';
    lignes.push([
      'Crédit vente', client, dateStr(c.dateOperation || c.dateEcheance),
      money(c.montantTotal || 0), money(c.montantVerse || 0), money(c.montantRestant || 0),
      c.estReglee ? 'Réglé' : 'En cours',
    ]);
    if (!c.estReglee) totalRestant += c.montantRestant || 0;
  });
  dettes.forEach((d: any) => {
    const client = `${d.clientPrenom || ''} ${d.clientNom || ''}`.trim() || `Client #${d.clientId}`;
    lignes.push([
      'Dette ancienne', client, dateStr(d.dateCredit),
      money(d.montantInitial || 0), money(d.montantPaye || 0), money(d.montantRestant || 0),
      d.estReglee ? 'Réglée' : 'Non réglée',
    ]);
    if (!d.estReglee) totalRestant += d.montantRestant || 0;
  });

  return {
    titre: 'Export — Crédits / Dettes',
    sousTitre: `${periodeLabel(dateDebut, dateFin)} — ${lignes.length} ligne(s)`,
    colonnes: ['Type', 'Client', 'Date', 'Montant total', 'Montant réglé', 'Reste dû', 'Statut'],
    lignes,
    totaux: [`Nombre de lignes : ${lignes.length}`, `Total restant dû (non réglé) : ${money(totalRestant)}`],
  };
}

async function chargerTransferts(dateDebut: string, dateFin: string): Promise<DonneesExport> {
  const res = await getTransferts();
  const raw: any[] = res.data?.data || res.data || [];
  // Champ réel de l'entité backend (TransfertStock.java) : `dateCreation`, PAS
  // `dateTransfert` (qui n'existe pas côté serveur et ferait exclure toutes les
  // lignes dès qu'un filtre de période est actif) — même champ que
  // export-donnees.page.ts::chargerObservable() côté Ionic.
  const filtres = raw.filter((t: any) => dansPeriode(t.dateCreation, dateDebut, dateFin));
  const lignes = filtres.map((t: any) => [
    t.numeroTransfert || '—',
    t.dateCreation ? dateStr(t.dateCreation) : '—',
    t.boutiqueSourceNom || t.boutiqueSrcNom || '—',
    t.boutiqueDestNom || '—',
    (t.statut || '—').replace(/_/g, ' '),
    (t.typePaiement || '—').replace(/_/g, ' '),
    t.creePar || '—',
  ]);
  return {
    titre: 'Export — Transferts',
    sousTitre: `${periodeLabel(dateDebut, dateFin)} — ${filtres.length} transfert(s)`,
    colonnes: ['N°', 'Date', 'De', 'Vers', 'Statut', 'Type paiement', 'Créé par'],
    lignes,
    totaux: [`Nombre de transferts : ${filtres.length}`],
  };
}

async function chargerDonnees(categorie: CategorieExport, dateDebut: string, dateFin: string): Promise<DonneesExport> {
  switch (categorie) {
    case 'CLIENTS': return chargerClients();
    case 'PRODUITS': return chargerProduits();
    case 'VENTES': return chargerVentes(dateDebut, dateFin);
    case 'FOURNISSEURS': return chargerFournisseurs();
    case 'DEPENSES': return chargerDepenses(dateDebut, dateFin);
    case 'EMPLOYES': return chargerEmployes();
    case 'CREDITS_DETTES': return chargerCreditsDettes(dateDebut, dateFin);
    case 'TRANSFERTS': return chargerTransferts(dateDebut, dateFin);
    default: throw new Error('Catégorie inconnue');
  }
}

// ─── Export Excel (SheetJS + expo-file-system nouvelle API File/Paths) ───────
// L'API "legacy" (writeAsStringAsync/EncodingType) est dépréciée en SDK 56 —
// le point d'entrée principal du module n'exporte plus que File/Directory/Paths
// (voir expo-file-system/build/index.d.ts), donc on écrit ici avec cette
// nouvelle API, seule non dépréciée.
async function exporterExcel(donnees: DonneesExport): Promise<void> {
  const aoa: (string | number)[][] = [donnees.colonnes, ...donnees.lignes];
  if (donnees.totaux.length) {
    aoa.push([]);
    donnees.totaux.forEach(t => aoa.push([t]));
  }
  const feuille = XLSX.utils.aoa_to_sheet(aoa);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, 'Export');
  const base64 = XLSX.write(classeur, { type: 'base64', bookType: 'xlsx' }) as string;

  const nomFichier = `${donnees.titre.replace(/[^a-zA-Z0-9]+/g, '_')}.xlsx`;
  const fichier = new File(Paths.cache, nomFichier);
  fichier.create({ overwrite: true });
  fichier.write(base64, { encoding: 'base64' });

  const dispo = await Sharing.isAvailableAsync();
  if (!dispo) {
    Alert.alert('Partage indisponible', "Le partage de fichiers n'est pas disponible sur cet appareil.");
    return;
  }
  await Sharing.shareAsync(fichier.uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: donnees.titre,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ExportDonneesScreen() {
  const { lang } = useLang();
  const colors = useColors();

  // Contrôle d'accès ADMIN — mécanisme IDENTIQUE à ParametresScreen (lecture
  // du rôle stocké dans AsyncStorage 'user', pas de nouveau système).
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [categorie, setCategorie] = useState<CategorieExport>('CLIENTS');
  const [format, setFormat] = useState<FormatExport>('PDF');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [exporting, setExporting] = useState(false);
  // Aperçu à l'écran des données chargées (colonnes/lignes déjà calculées par
  // chargerDonnees) — affiché après chaque lancement d'export, avant/pendant
  // la génération du fichier, pour que l'utilisateur voie ce qui a été exporté
  // (contrairement à Angular où le clic déclenche un téléchargement direct).
  const [apercu, setApercu] = useState<DonneesExport | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('user');
        const user = raw ? JSON.parse(raw) : {};
        setIsAdmin(user?.role === 'ADMIN' || user?.role === 'ROLE_ADMIN');
      } finally {
        setCheckingAuth(false);
      }
    })();
  }, []);

  const categorieActive = CATEGORIES.find(c => c.value === categorie) || CATEGORIES[0];

  const lancerExport = async () => {
    setExporting(true);
    try {
      const donnees = await chargerDonnees(categorie, dateDebut.trim(), dateFin.trim());
      setApercu(donnees);
      if (donnees.lignes.length === 0) {
        Alert.alert('Aucune donnée', 'Aucune donnée à exporter avec cette sélection.');
        setExporting(false);
        return;
      }
      if (format === 'PDF') {
        const tpl = await AsyncStorage.getItem('facture_template');
        const design: DesignFacture = tpl === 'moderne' ? 2 : tpl === 'minimaliste' ? 3 : 1;
        await imprimerDocumentPdfRN({
          titre: donnees.titre,
          sousTitre: donnees.sousTitre,
          colonnes: donnees.colonnes,
          lignes: donnees.lignes,
          totaux: donnees.totaux,
          paysage: true,
        }, design);
      } else {
        await exporterExcel(donnees);
      }
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || "Impossible de générer l'export");
    }
    setExporting(false);
  };

  if (checkingAuth) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;
  }

  if (!isAdmin) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="lock-outline" size={56} color={colors.danger} />
        <Text style={[s.accesRefuseTxt, { color: colors.textSecondary }]}>
          Accès réservé aux administrateurs.
        </Text>
      </View>
    );
  }

  // ── En-tête (formulaire de sélection) — placé en ListHeaderComponent pour
  // que l'aperçu (FlatList) reste l'unique liste défilante de l'écran (pas de
  // VirtualizedList imbriquée dans un ScrollView).
  const renderHeader = () => (
    <View>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <View style={[s.hero, { backgroundColor: colors.hero }]}>
        <MaterialCommunityIcons name="database-export-outline" size={26} color="#fff" />
        <Text style={s.heroTitle}>Export de données</Text>
        <Text style={s.heroSub}>Choisissez une catégorie, un format, puis exportez</Text>
      </View>

      {/* ── Catégorie ────────────────────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Catégorie</Text>
        <View style={s.chipsGrid}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.value}
              style={[
                s.catChip,
                { borderColor: colors.border, backgroundColor: colors.inputBg },
                categorie === cat.value && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setCategorie(cat.value)}
            >
              <MaterialCommunityIcons
                name={cat.icon as any}
                size={16}
                color={categorie === cat.value ? '#fff' : colors.primary}
              />
              <Text style={[s.catChipText, { color: colors.text }, categorie === cat.value && { color: '#fff', fontWeight: '600' }]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Plage de dates (uniquement Ventes / Dépenses / Crédits-Dettes / Transferts) ── */}
      {categorieActive.needsPeriode && (
        <View style={s.section}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Plage de dates (optionnelle)</Text>
          <View style={s.periodeRow}>
            <TextInput
              style={[s.periodeInput, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              value={dateDebut}
              onChangeText={setDateDebut}
              placeholder="Début AAAA-MM-JJ"
              placeholderTextColor={colors.placeholder}
            />
            <Text style={{ color: colors.textSecondary }}>→</Text>
            <TextInput
              style={[s.periodeInput, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
              value={dateFin}
              onChangeText={setDateFin}
              placeholder="Fin AAAA-MM-JJ"
              placeholderTextColor={colors.placeholder}
            />
            {(dateDebut || dateFin) ? (
              <TouchableOpacity onPress={() => { setDateDebut(''); setDateFin(''); }}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.placeholder} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}

      {/* ── Format ───────────────────────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>Format</Text>
        <View style={s.chips}>
          <TouchableOpacity
            style={[
              s.formatChip,
              { borderColor: colors.border, backgroundColor: colors.inputBg },
              format === 'PDF' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFormat('PDF')}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={20} color={format === 'PDF' ? '#fff' : colors.danger} />
            <Text style={[s.formatChipText, { color: colors.text }, format === 'PDF' && { color: '#fff' }]}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              s.formatChip,
              { borderColor: colors.border, backgroundColor: colors.inputBg },
              format === 'EXCEL' && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFormat('EXCEL')}
          >
            <MaterialCommunityIcons name="file-excel-box" size={20} color={format === 'EXCEL' ? '#fff' : colors.success} />
            <Text style={[s.formatChipText, { color: colors.text }, format === 'EXCEL' && { color: '#fff' }]}>Excel</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Bouton exporter ──────────────────────────────────────────────────── */}
      <View style={s.section}>
        <TouchableOpacity
          style={[s.btnExporter, { backgroundColor: colors.primary }, exporting && { opacity: 0.6 }]}
          onPress={lancerExport}
          disabled={exporting}
        >
          {exporting
            ? <ActivityIndicator size="small" color="#fff" />
            : <MaterialCommunityIcons name="tray-arrow-down" size={18} color="#fff" />
          }
          <Text style={s.btnExporterText}>{exporting ? 'Génération...' : 'Exporter'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Aperçu — titre + sous-titre (les lignes sont rendues par la FlatList) ── */}
      {apercu && (
        <View style={[s.section, { paddingBottom: 8 }]}>
          <Text style={[s.sectionLabel, { color: colors.textSecondary }]}>
            Aperçu ({apercu.lignes.length} ligne{apercu.lignes.length > 1 ? 's' : ''})
          </Text>
          <Text style={[s.apercuSousTitre, { color: colors.textSecondary }]}>{apercu.sousTitre}</Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (!apercu || apercu.lignes.length === 0) return null;
    return (
      <View style={[s.section, { paddingTop: 4 }]}>
        {apercu.totaux.map((t, i) => (
          <Text key={i} style={[s.apercuTotal, { color: colors.text }]}>{t}</Text>
        ))}
      </View>
    );
  };

  const renderEmpty = () => {
    // Rien à afficher tant que l'utilisateur n'a pas encore lancé d'export
    // (état initial de l'écran) — l'espace réservé aux résultats ne doit
    // apparaître qu'après un premier chargement de données.
    if (!apercu) return null;
    return (
      <View style={[s.section, s.apercuVide]}>
        <MaterialCommunityIcons name="database-off-outline" size={40} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Aucune donnée à afficher.</Text>
      </View>
    );
  };

  return (
    <FlatList
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 32 }}
      data={apercu?.lignes || []}
      keyExtractor={(_, index) => `apercu-ligne-${index}`}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      ListEmptyComponent={renderEmpty}
      renderItem={({ item }) => (
        <Card style={[s.apercuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Card.Content style={{ paddingVertical: 8 }}>
            {item.map((valeur, i) => (
              <Text key={i} style={s.apercuLigne} numberOfLines={2}>
                <Text style={[s.apercuColonne, { color: colors.textSecondary }]}>
                  {(apercu?.colonnes[i] || '')}{' : '}
                </Text>
                <Text style={{ color: colors.text }}>{valeur}</Text>
              </Text>
            ))}
          </Card.Content>
        </Card>
      )}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  accesRefuseTxt: { fontSize: 15, textAlign: 'center' },

  hero: { backgroundColor: '#081648', padding: 20, gap: 4 },
  heroTitle: { color: '#fff', fontWeight: 'bold', fontSize: 18, marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  section: { padding: 16, paddingBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  catChipActive: { backgroundColor: '#081648', borderColor: '#081648' },
  catChipText: { fontSize: 13, color: '#333' },
  catChipTextActive: { color: '#fff', fontWeight: '600' },

  periodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  periodeInput: {
    flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#333', backgroundColor: '#fafafa',
  },

  chips: { flexDirection: 'row', gap: 10 },
  formatChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fafafa',
  },
  formatChipActive: { backgroundColor: '#081648', borderColor: '#081648' },
  formatChipText: { fontSize: 14, fontWeight: '600', color: '#333' },
  formatChipTextActive: { color: '#fff' },

  btnExporter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#081648', borderRadius: 12, paddingVertical: 14,
  },
  btnExporterText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // ── Aperçu (Correctif 1) ──────────────────────────────────────────────────
  apercuSousTitre: { fontSize: 12, marginTop: -4 },
  apercuCard: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1 },
  apercuLigne: { fontSize: 13, marginBottom: 2 },
  apercuColonne: { fontWeight: '600' },
  apercuTotal: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  apercuVide: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 24 },
});
