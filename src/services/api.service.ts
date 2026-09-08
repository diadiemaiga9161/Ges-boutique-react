import axios from 'axios';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { showToast } from './toast.service';

// ─── Stockage sécurisé du token JWT ────────────────────────────────────────
// Le token est désormais stocké dans expo-secure-store (Keychain iOS /
// Keystore Android) plutôt qu'en clair dans AsyncStorage. Migration
// transparente : si aucun token n'est trouvé dans SecureStore mais qu'un
// ancien token existe encore dans AsyncStorage (installation précédente),
// on le récupère, on l'écrit dans SecureStore, puis on le supprime
// d'AsyncStorage — l'utilisateur n'est jamais déconnecté par la migration.
const SECURE_TOKEN_KEY = 'token';

export async function getStoredToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
    if (secureToken) return secureToken;
  } catch (e) {
    console.warn('SecureStore indisponible (lecture token) :', e);
  }
  // Migration depuis l'ancien emplacement AsyncStorage (versions < migration)
  try {
    const legacyToken = await AsyncStorage.getItem('token');
    if (legacyToken) {
      await SecureStore.setItemAsync(SECURE_TOKEN_KEY, legacyToken).catch(() => {});
      await AsyncStorage.removeItem('token').catch(() => {});
      return legacyToken;
    }
  } catch { /* ignore */ }
  return null;
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
  } catch (e) {
    console.warn('SecureStore indisponible (écriture token) :', e);
  }
  // Nettoyage de l'ancien emplacement au cas où il resterait un token en clair
  AsyncStorage.removeItem('token').catch(() => {});
}

export async function removeStoredToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY); } catch { /* ignore */ }
  AsyncStorage.removeItem('token').catch(() => {});
}

export const DEFAULT_API_URL = 'https://fatmazahara.mg-consulting.site/api';

export const BOUTIQUES_CONFIG = [
  { id: 1, nom: 'Fatma Zahara',    url: 'https://fatmazahara.mg-consulting.site/api' },
  { id: 2, nom: 'Moh',             url: 'https://moh.mg-consulting.site/api' },
  { id: 3, nom: 'Magaouba Kabala', url: 'https://magaoubakabala.mg-consulting.site/api' },
  { id: 4, nom: 'Baran Djim',      url: 'https://barandjim.mg-consulting.site/api' },
  { id: 5, nom: 'Bou Bandjim',     url: 'https://boubandjim.mg-consulting.site/api' },
  // Entrées de test local (dev) — pointent vers le backend Spring Boot lancé en local
  // sur le PC de dev. À retirer avant une build de production.
  // Téléphone séparé sur le même Wi-Fi que le PC : "localhost" désignerait le téléphone
  // lui-même, il faut l'IP réseau du PC.
  { id: 6, nom: '🧪 Local (tunnel, sans wifi)', url: 'https://theories-waterproof-demonstrate-joint.trycloudflare.com/api' },
  // Test via le navigateur du PC lui-même (comme "ionic serve" + Chrome en local) :
  // ouvrir http://localhost:8081 dans Chrome sur le PC, choisir cette boutique.
  // Port 8480 = celui du profil "boutique-local" (application-boutique-local.properties),
  // le jar autonome dédié aux tests sur ce PC. Pas 8080 (= profil par défaut / boutique 1).
  { id: 7, nom: '🧪 Local (navigateur PC)', url: 'http://localhost:8480/api' },
  // Émulateur Android sur le même PC que le backend : 10.0.2.2 est l'alias fixe que
  // l'émulateur utilise pour désigner "localhost du PC hôte" (localhost tout court,
  // dans l'émulateur, désigne l'émulateur lui-même, pas le PC — cf. entrée 6/7 plus haut).
  { id: 8, nom: '🧪 Local (émulateur Android)', url: 'http://10.0.2.2:8480/api' },
];

export function getApiUrlForPort(port: number): string {
  return BOUTIQUES_CONFIG[port - 1]?.url || DEFAULT_API_URL;
}

// ─── Cache en mémoire (peuplé au démarrage via initApiSession) ────────────
let _baseUrl: string = DEFAULT_API_URL;
let _token: string | null = null;

export function setApiUrl(url: string): void {
  _baseUrl = url;
}

// URL racine du backend (sans le suffixe /api) — utile pour construire des
// liens directs vers des endpoints publics servant des fichiers (QR code,
// PDF...) plutôt que de passer par axios, comme /api/clients/{id}/qrcode.
export function getBackendRootUrl(): string {
  return _baseUrl.replace(/\/api\/?$/, '');
}

export function setAuthToken(token: string | null): void {
  _token = token;
}

export function clearAuthToken(): void {
  _token = null;
}

export async function initApiSession(): Promise<void> {
  const urlEntry = await AsyncStorage.getItem('api_url');
  if (urlEntry) _baseUrl = urlEntry;
  const token = await getStoredToken();
  if (token) _token = token;
}

// ─── Callback déconnexion automatique (401) ───────────────────────────────
let _onAuthError: (() => void) | null = null;
export function setOnAuthError(cb: () => void) {
  _onAuthError = cb;
}

const api = axios.create({
  baseURL: DEFAULT_API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Intercepteur requête : injecte l'URL boutique + le token JWT (synchrone)
api.interceptors.request.use((config) => {
  config.baseURL = _baseUrl;
  if (_token) config.headers['Authorization'] = `Bearer ${_token}`;
  config.headers['Content-Type'] = 'application/json';
  return config;
});

// Signale "mise à jour en cours" au plus une fois toutes les 10s — évite d'empiler
// plusieurs toasts identiques quand plusieurs écrans échouent en même temps pendant
// le court redémarrage du serveur (dépôt d'une nouvelle version côté backend).
let _dernierToastServeurIndisponible = 0;

// Même principe pour "fonctionnalité désactivée" — un écran peut déclencher plusieurs
// requêtes vers le même contrôleur désactivé (ex: chargement initial).
let _dernierAlertFonctionnaliteDesactivee = 0;

// Intercepteur réponse : déconnexion automatique sur 401 + message clair pendant
// un redémarrage serveur (pas un vrai bug ni une absence de réseau côté téléphone).
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearAuthToken();
      await AsyncStorage.removeItem('user');
      await removeStoredToken();
      if (_onAuthError) _onAuthError();
    } else if (error.response?.status === 403 && error.response?.data?.errorCode === 'FEATURE_DISABLED') {
      const maintenant = Date.now();
      if (maintenant - _dernierAlertFonctionnaliteDesactivee > 10000) {
        _dernierAlertFonctionnaliteDesactivee = maintenant;
        // Le message détaillé arrive dans "message" (GlobalExceptionHandler) pour la
        // plupart des contrôleurs, mais dans "error" pour ceux qui ont leur propre
        // gestionnaire local (ex: DetteAncienneController) — on vérifie les deux.
        const detail = error.response?.data?.message || error.response?.data?.error;
        Alert.alert(
          'Fonctionnalité désactivée',
          detail || "Cette fonctionnalité est désactivée par le super admin de la boutique. Pour plus d'informations, contactez Maiga Consulting."
        );
      }
    } else if (!error.response) {
      // Pas de réponse HTTP du tout : soit le téléphone n'a pas de réseau (déjà géré
      // par l'offline-first ailleurs, cf. offline.service.ts), soit le réseau est bon
      // mais LE SERVEUR de cette boutique ne répond pas — cas typique d'un
      // redémarrage après déploiement (10-20s). On ne distingue les deux cas qu'en
      // vérifiant la connectivité réelle du téléphone (NetInfo).
      const maintenant = Date.now();
      if (maintenant - _dernierToastServeurIndisponible > 10000) {
        const etat = await NetInfo.fetch().catch(() => null);
        if (etat?.isConnected) {
          _dernierToastServeurIndisponible = maintenant;
          showToast('Mise à jour en cours, veuillez patienter quelques instants...', 'warning');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ──────────────────────────────────────────────────────────────────
export const login = (username: string, password: string) =>
  api.post('/auth/login', { username, password });
export const forgotPassword = (email: string) =>
  api.post('/auth/mot-de-passe-oublie', { email });
// Vérifie la validité du token AVANT d'afficher le formulaire de nouveau mot de
// passe (même comportement que reset-password.page.ts côté Ionic) — évite de
// laisser l'utilisateur saisir un nouveau mot de passe pour un lien déjà expiré.
export const verifierTokenReset = (token: string) =>
  api.get('/auth/verifier-token-reset', { params: { token } });
export const resetPassword = (token: string, newPassword: string) =>
  api.post('/auth/reinitialiser-password', { token, nouveauPassword: newPassword });

// ─── Boutique ──────────────────────────────────────────────────────────────
export const getBoutique = () => api.get('/boutique');
export const updateBoutique = (data: any) => api.put('/boutique', data);
export const getBoutiques = () => api.get('/boutiques');
// Réservé au super admin (flag superAdmin sur le compte, pas un rôle séparé) — le
// serveur revérifie systématiquement le privilège (403 sinon).
export const modifierFonctionnalitesBoutique = (data: { featureTransfertsActif: boolean; featureVitrineActif: boolean }) =>
  api.put('/boutique/fonctionnalites', data);
// Fonctionnalités avancées (Dépôt garde, Dettes anciennes, Comptes bancaires...) —
// système séparé de /boutique/fonctionnalites ci-dessus. Lecture ouverte à tout le
// personnel (ADMIN/VENDEUR), écriture réservée au super admin (403 sinon côté serveur).
export const getFonctionnalitesAvancees = () => api.get('/boutique/fonctionnalites-avancees');
export const definirFonctionnaliteAvancee = (cle: string, actif: boolean) =>
  api.put(`/boutique/fonctionnalites-avancees/${cle}`, { actif });
// Permissions vendeur (système générique, séparé des fonctionnalités avancées
// ci-dessus) — permet à un ADMIN NORMAL (pas besoin de superAdmin) d'accorder
// au VENDEUR un accès en lecture seule à certaines pages (ex: Inventaire).
// Lecture ouverte à tout le personnel (ADMIN/VENDEUR), écriture réservée à
// hasRole('ADMIN') côté serveur (403 sinon).
export const getPermissionsVendeur = () => api.get('/boutique/permissions-vendeur');
export const definirPermissionVendeur = (cle: string, actif: boolean) =>
  api.put(`/boutique/permissions-vendeur/${cle}`, { actif });
export const selectBoutique = (id: number) => api.post(`/boutiques/${id}/select`);

// ─── Produits ──────────────────────────────────────────────────────────────
export const getProduits = (params?: any) => api.get('/produits', { params });
export const getProduit = (id: number) => api.get(`/produits/${id}`);
export const getCategories = () => api.get('/produits/categories');
export const createCategorie = (data: { nom: string; description?: string }) => api.post('/produits/categories', data);
export const updateCategorie = (id: number, data: { nom: string; description?: string }) => api.put(`/produits/categories/${id}`, data);
export const deleteCategorie = (id: number) => api.delete(`/produits/categories/${id}`);
export const getStatistiquesStock = () => api.get('/produits/statistiques');
export const createProduit = (data: any) => api.post('/produits', data);
export const updateProduit = (id: number, data: any) => api.put(`/produits/${id}`, data);
export const deleteProduit = (id: number) => api.delete(`/produits/${id}`);
export const uploadPhotoProduit = (id: number, form: FormData) =>
  api.post(`/produits/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });

// ─── Ventes ────────────────────────────────────────────────────────────────
export const getVentes = (params?: any) => api.get('/ventes', { params });
// BUG FIX : /ventes/jour n'existe pas côté backend (404 systématique) — le
// bon endpoint, identique à celui utilisé par Ionic, est /ventes/aujourdhui
// (VenteController.java:206).
export const getVentesJour = (params?: any) => api.get('/ventes/aujourdhui', { params });
// clientRequestId optionnel : transmis en en-tête (jamais dans le corps JSON)
// pour laisser le backend reconnaître un rejeu de la même vente (idempotence,
// voir VenteController.creerVente / creerVenteCredit — X-Client-Request-ID).
export const createVente = (data: any, clientRequestId?: string) =>
  api.post('/ventes', data, clientRequestId ? { headers: { 'X-Client-Request-ID': clientRequestId } } : undefined);
// estCredit détermine l'endpoint (comptant vs crédit, comme sur Ionic —
// VenteController.java:357 et :418) ; motif transmis en query param.
export const annulerVente = (id: number, motif?: string, estCredit?: boolean, utilisateurId?: number) =>
  api.post(`/ventes/${estCredit ? 'credits/' : ''}${id}/annuler`, {}, { params: { motif, utilisateurId } });
export const getVenteDetail = (id: number) => api.get(`/ventes/${id}`);
// inclureAnnulees optionnel (défaut backend = false, comportement inchangé
// pour tous les appels existants qui ne le passent pas) — voir
// ExportDonneesScreen.chargerVentes qui est le seul appelant à le forcer à
// true pour inclure les ventes annulées dans l'export.
export const getVentesParPeriode = (dateDebut: string, dateFin: string, inclureAnnulees?: boolean) =>
  api.get('/ventes/periode', { params: { dateDebut, dateFin, inclureAnnulees } });
export const modifierLignesVente = (venteId: number, data: {
  lignes: any[];
  utilisateurId?: number;
  motif?: string;
}) => api.put(`/ventes/${venteId}/modifier-lignes`, data);
export const effectuerRetourVente = (data: {
  venteId: number;
  motif?: string;
  utilisateurId?: number;
  lignes: { produitId: number; quantiteRetournee: number; prixUnitaire: number; ligneVenteId?: number }[];
}) => api.post('/retours-ventes', data);

// ─── Clients ───────────────────────────────────────────────────────────────
export const getClients = (params?: any) => api.get('/clients', { params });
export const createClient = (data: any) => api.post('/clients', data);
export const updateClient = (id: number, data: any) => api.put(`/clients/${id}`, data);
export const deleteClient = (id: number) => api.delete(`/clients/${id}`);

// ─── Fournisseurs ──────────────────────────────────────────────────────────
// BUG FIX (2026-08-13) : ces routes sont exposées côté backend sous
// ProduitController (@RequestMapping("/api/produits")), donc nichées sous
// /api/produits/fournisseurs — pas /api/fournisseurs. L'ancienne URL ne
// correspondait à aucune route réelle : Spring renvoyait la page Angular
// (fallback SPA) au lieu de JSON, et le HTML récupéré finissait assigné à
// `fournisseurs` côté écran, provoquant "undefined is not a function" au
// premier fournisseurs.map(...) rencontré (ProduitsScreen, Ventes...).
export const getFournisseurs = (params?: any) => api.get('/produits/fournisseurs', { params });
export const createFournisseur = (data: any) => api.post('/produits/fournisseurs', data);
export const updateFournisseur = (id: number, data: any) => api.put(`/produits/fournisseurs/${id}`, data);
export const deleteFournisseur = (id: number) => api.delete(`/produits/fournisseurs/${id}`);
export const getHistoriqueAchatsFournisseur = (id: number, dateDebut?: string, dateFin?: string) =>
  api.get(`/fournisseur-achats/achats/${id}`, { params: { dateDebut, dateFin } });
export const getHistoriquePaiementsFournisseur = (id: number, dateDebut?: string, dateFin?: string) =>
  api.get(`/fournisseur-achats/paiements/${id}`, { params: { dateDebut, dateFin } });
export const getSituationFournisseur = (id: number, dateDebut?: string, dateFin?: string) =>
  api.get(`/fournisseur-achats/situation/${id}`, { params: { dateDebut, dateFin } });
export const getAchatsNonPayesFournisseur = (id: number) => api.get(`/fournisseur-achats/achats-non-payes/${id}`);
export const creerAchatFournisseur = (data: any) => api.post('/fournisseur-achats/achat', data);
export const payerFournisseur = (data: any) => api.post('/fournisseur-achats/paiement', data);
export const annulerAchatFournisseur = (id: number, utilisateurId?: number) =>
  api.post(`/fournisseur-achats/achat/${id}/annuler`, {}, { params: utilisateurId ? { utilisateurId } : undefined });

// ─── Dépenses ──────────────────────────────────────────────────────────────
export const getDepenses = (params?: any) => api.get('/depenses', { params });
export const createDepense = (data: any) => api.post('/depenses', data);
export const updateDepense = (id: number, data: any) => api.put(`/depenses/${id}`, data);
export const deleteDepense = (id: number) => api.delete(`/depenses/${id}`);
// Filtre par plage de dates — GET /depenses/periode?debut=...&fin=..., même
// endpoint que depense.service.ts::getParPeriode() côté Ionic.
export const getDepensesParPeriode = (debut: string, fin: string) =>
  api.get('/depenses/periode', { params: { debut, fin } });

// ─── Rapports ──────────────────────────────────────────────────────────────
// NOTE : /rapports/jour, /rapports/semaine, /rapports/mois n'existent PAS côté
// backend (aucun controller ne les expose — vérifié dans RapportAnalytiqueController,
// seul /rapports/ca-30-jours, /top-produits, /ventes-par-heure, /ventes-par-vendeur,
// /marges y sont). Les rapports jour/semaine/mois/personnalisé sont donc calculés
// côté client à partir de /ventes/periode, exactement comme rapport.service.ts sur
// Ionic (genererRapportJournalier/Hebdomadaire/Mensuel/Periodique) — voir
// rapport.helpers.ts. Ces 3 exports sont conservés (cassés) uniquement parce que
// ResultatNetScreen/BeneficesScreen/HistoriqueVentesScreen les appellent encore.
export const getRapportJour = (params?: any) => api.get('/rapports/jour', { params });
export const getRapportSemaine = (params?: any) => api.get('/rapports/semaine', { params });
export const getRapportMois = (params?: any) => api.get('/rapports/mois', { params });
export const getSituationCredits = () => api.get('/caisse/credits/situation');

// ─── Bénéfices ─────────────────────────────────────────────────────────────
// Ceux-ci EXISTENT réellement côté backend (BeneficeController, ADMIN only),
// contrairement à /rapports/jour|semaine|mois ci-dessus.
export const getBeneficeJournalier = (date?: string) => api.get('/benefices/journalier', { params: { date } });
export const getBeneficeHebdomadaire = () => api.get('/benefices/hebdomadaire');
export const getBeneficeMensuel = (mois?: number, annee?: number) => api.get('/benefices/mensuel', { params: { mois, annee } });
export const getBeneficeAnnuel = (annee?: number) => api.get('/benefices/annuel', { params: { annee } });

// ─── Résultat net (bénéfices + bonus fournisseurs - dépenses/paiements employé) ─
export const getResultatJournalier = (date?: string) => api.get('/resultat-net/journalier', { params: { date } });
export const getResultatMensuel = (mois?: number, annee?: number) => api.get('/resultat-net/mensuel', { params: { mois, annee } });
export const getResultatAnnuel = (annee?: number) => api.get('/resultat-net/annuel', { params: { annee } });

// GET /ventes/statistiques/chiffre-affaire — vrai endpoint utilisé par le modal
// "Statistiques" de sales.page.ts sur Ionic (PAS /rapports/jour|semaine|mois).
export const getStatistiquesChiffreAffaire = () => api.get('/ventes/statistiques/chiffre-affaire');

// ─── Factures pro forma (entité distincte des ventes — /api/caisse/factures) ─
export const getFactures = () => api.get('/caisse/factures');
export const getFacturesParStatut = (statut: string) => api.get(`/caisse/factures/statut/${statut}`);
export const creerFactureProforma = (data: any) => api.post('/caisse/factures', data);
// Modification/suppression — parité avec resources.page.ts (Ionic, saveFacture en
// mode édition + action 'delete-facture'), seule interface Ionic qui les propose
// réellement (le lien menu "Factures" pointe vers /resources/factures, pas /tabs/factures).
export const modifierFacture = (id: number, data: any) => api.put(`/caisse/factures/${id}`, data);
export const supprimerFacture = (id: number) => api.delete(`/caisse/factures/${id}`);
export const changerStatutFacture = (id: number, statut: string) =>
  api.put(`/caisse/factures/${id}/statut`, null, { params: { statut } });

// ─── Dépôts garde — vue groupée par client + retrait global (cloturerDepot
//     existe déjà plus haut, écran ne l'appelait juste pas) ──────────────────
export const getGroupesClientDepot = () => api.get('/depots-garde/groupes-client');
export const retraitGlobalDepot = (data: { numero: string; montant?: number; observation?: string }) =>
  api.post('/depots-garde/retrait-global', data);

// ─── Notifications ─────────────────────────────────────────────────────────
// BUG FIX (parité Ionic) : marquerLue appelait PATCH /notifications/{id}/lue,
// route inexistante côté backend (NotificationController n'expose que
// PUT /lu/{id} et PUT /lire/{id}) — la vraie route utilisée par Ionic est
// PUT /notifications/lu/{id}, échouait silencieusement en RN (catch vide).
export const getNotifications = () => api.get('/notifications');
export const marquerLue = (id: number) => api.put(`/notifications/lu/${id}`, {});
export const marquerToutesLues = () => api.put('/notifications/tout-lire', {});

// ─── Mobile Money (Orange/Moov) — vrais endpoints backend dédiés, PAS un
// filtre client-side sur /ventes (ancien comportement RN, en plus avec des
// modes WAVE/MTN_MONEY que le backend ne gère même pas) ──────────────────────
export const getMobileMoneyOperations = (type: string, periode: string) =>
  api.get('/mobile-money/operations', { params: { type, periode } });
export const getMobileMoneyResume = () => api.get('/mobile-money/resume');

// ─── Crédits ───────────────────────────────────────────────────────────────
export const getCredits = (params?: any) => api.get('/credits', { params });
export const getCreditsNonRegles = () => api.get('/caisse/credits/non-regles');
export const createCredit = (data: any) => api.post('/credits', data);
export const payerCredit = (id: number, data: any) => api.post(`/credits/${id}/payer`, data);

// ─── Caisse ────────────────────────────────────────────────────────────────
export const getCaisse = (params?: any) => api.get('/caisse', { params });
export const getCaisseEtat = () => api.get('/caisse/etat');
export const ouvrirCaisse = (data: any) => api.post('/caisse/ouvrir', data);
export const fermerCaisse = (data: any) => api.post('/caisse/fermer', data);
export const getOperationsJour = () => api.get('/caisse/operations/aujourdhui');
export const getOperationsParPeriode = (dateDebut: string, dateFin: string) =>
  api.get('/caisse/operations/periode', { params: { dateDebut, dateFin } });
export const ajouterEntreeCaisse = (data: any) => api.post('/caisse/entree', data);
export const ajouterSortieCaisse = (data: any) => api.post('/caisse/sortie', data);
export const reglerCreditCaisse = (data: {
  venteCreditId: number;
  montantRegle: number;
  modePaiement?: string;
  referencePaiement?: string;
  utilisateurId?: number;
  motif?: string;
  referenceGroupe?: string;
}) => api.post('/caisse/credits/reglement', data);
export const getCreditsEnRetard = () => api.get('/caisse/credits/retard');
export const getStatsCaisseJour = () => api.get('/caisse/statistiques/aujourdhui');
export const getStatsCaisseParPeriode = (dateDebut: string, dateFin: string) =>
  api.get('/caisse/statistiques/periode', { params: { dateDebut, dateFin } });
export const getHistoriqueReglementsCredit = (venteId: number) => api.get(`/caisse/credits/${venteId}/reglements`);
export const getCreditsRegles = () => api.get('/caisse/credits/regles');
export const getPaiementsGroupes = () => api.get('/caisse/paiements-groupes');
export const transfererVersBanque = (data: {
  compteId: number;
  montant: number;
  motif: string;
  utilisateurId?: number;
  reference?: string;
}) => api.post('/caisse/transfert-banque', data);

// ─── Inventaire ────────────────────────────────────────────────────────────
export const getInventaire = () => api.get('/inventaire');
export const ajusterStock = (id: number, data: any) => api.patch(`/produits/${id}/stock`, data);

// ─── Transferts ────────────────────────────────────────────────────────────
export const getTransferts = (params?: any) => api.get('/transferts', { params });
export const createTransfert = (data: any) => api.post('/transferts', data);

// ─── Dépôts garde ──────────────────────────────────────────────────────────
export const getDepots = (params?: any) => api.get('/depots-garde', { params });
export const createDepot = (data: any) => api.post('/depots-garde', data);
export const getDepotClients = () => api.get('/depot-clients');
export const effectuerRetraitDepot = (id: number, data: any) => api.post(`/depots-garde/${id}/retrait`, data);
export const cloturerDepot = (id: number) => api.patch(`/depots-garde/${id}/cloturer`, {});

// ─── Profil ────────────────────────────────────────────────────────────────
// PUT /auth/profil (AuthController.modifierMonProfil) — pas /auth/me (GET only,
// pas de verbe PUT côté backend). Le mot de passe est optionnel : une chaîne
// vide/absente est ignorée côté serveur (pas de vérification de l'ancien mot de
// passe — même contrat que profile.page.ts côté Ionic, un seul champ "nouveau
// mot de passe").
export const getProfil = () => api.get('/auth/me');
export const updateProfil = (data: any) => api.put('/auth/profil', data);
// PATCH /utilisateurs/me/photo (UtilisateurController.mettreAJourPhoto) — attend
// un JSON { photo: base64 }, pas un multipart/form-data vers /auth/me/photo qui
// n'existe pas côté backend.
export const uploadPhotoProfil = (photoBase64: string) =>
  api.patch('/utilisateurs/me/photo', { photo: photoBase64 });

// ─── Bonus fournisseurs ────────────────────────────────────────────────────
export const getBonusFournisseurs = (params?: any) => api.get('/bonus-fournisseurs', { params });
export const createBonusFournisseur = (data: any) => api.post('/bonus-fournisseurs', data);

// ─── Promotions ────────────────────────────────────────────────────────────
export const getPromotions = (params?: any) => api.get('/promotions', { params });
export const createPromotion = (data: any) => api.post('/promotions', data);
export const updatePromotion = (id: number, data: any) => api.put(`/promotions/${id}`, data);
export const deletePromotion = (id: number) => api.delete(`/promotions/${id}`);
export const preparerWhatsAppPromotion = (id: number) => api.get(`/promotions/${id}/whatsapp`);

// ─── Commandes ─────────────────────────────────────────────────────────────
export const getCommandes = () => api.get('/commandes');
export const createCommande = (data: any) => api.post('/commandes', data);
export const updateCommande = (id: number, data: any) => api.put(`/commandes/${id}`, data);
export const validerCommande = (id: number, body?: { fraisLivraison?: number; chauffeurNom?: string; chauffeurTelephone?: string }) =>
  api.post(`/commandes/${id}/valider`, body || {});
export const deleteCommande = (id: number) => api.delete(`/commandes/${id}`);
export const annulerCommande = (id: number, utilisateurId?: number) => api.post(`/commandes/${id}/annuler`, { utilisateurId });
export const payerCreditCommande = (id: number, montant: number) => api.patch(`/commandes/${id}/payer-credit`, { montant });
export const payerCreditsGroupesCommandes = (ids: number[], montantTotal: number) => api.post('/commandes/payer-credits-groupes', { ids, montantTotal });
// Commandes vitrine (en ligne) pas encore traitées — pour le popup "en attente" à l'ouverture de l'app.
export const getCommandesVitrineEnAttente = () => api.get('/commandes/vitrine-en-attente');

// ─── Dépenses par type ─────────────────────────────────────────────────────
export const getDepensesParType = (params?: { debut?: string; fin?: string }) =>
  api.get('/depenses/par-type', { params });

// ─── Paiements employés ────────────────────────────────────────────────────
export const getPaiementsEmploye = () => api.get('/paiements-employe');

// ─── Mouvements de stock ───────────────────────────────────────────────────
// GET /inventaire/mouvements ne prend AUCUN paramètre côté backend (dateDebut/
// dateFin étaient silencieusement ignorés) — pour filtrer par date il faut
// GET /inventaire/historique?debut=...&fin=... (LocalDateTime ISO, obligatoires
// tous les deux), exactement comme obtenirMouvementsParDate() sur Ionic.
export const getMouvements = () => api.get('/inventaire/mouvements');
export const getMouvementsParDate = (debut: string, fin: string) =>
  api.get('/inventaire/historique', { params: { debut, fin } });
export const ajouterMouvement = (data: any) => {
  const { typeMouvement, quantite, ...rest } = data;
  if (typeMouvement === 'ENTREE') return api.post('/inventaire/entree', { quantite, ...rest });
  if (typeMouvement === 'SORTIE') return api.post('/inventaire/sortie', { quantite, ...rest });
  // AJUSTEMENT : le backend attend nouvelleQuantite
  return api.post('/inventaire/ajustement', { nouvelleQuantite: quantite, ...rest });
};
export const getSorties = (params?: { typeSortie?: string; produitId?: number; dateDebut?: string; dateFin?: string }) =>
  api.get('/inventaire/sorties', { params });

// ─── Avances fournisseurs ──────────────────────────────────────────────────
// BUG FIX (2026-09-03) : ces routes pointaient vers /fournisseur-achats/avance(s),
// qui n'existent pas côté backend (aucun mapping dans FournisseurAchatController) —
// tout appel renvoyait 404 (create) ou tombait silencieusement dans le .catch (liste
// toujours vide). Le module "Avances" est en réalité exposé par
// AvanceFournisseurController sous /api/avances-fournisseurs. L'historique renvoie
// { fournisseurId, soldeDisponible, historique, totalDepose, totalUtilise }.
export const getAvancesFournisseur = (id: number) =>
  api.get(`/avances-fournisseurs/historique/${id}`).catch(() => ({ data: { historique: [], soldeDisponible: 0 } }));
export const getSoldeAvanceFournisseur = (id: number) =>
  api.get(`/avances-fournisseurs/solde/${id}`);
export const creerAvanceFournisseur = (data: any) => api.post('/avances-fournisseurs', data);

// ─── Clients — historique ──────────────────────────────────────────────────
export const getClientVentes = (clientId: number) =>
  api.get('/ventes', { params: { clientId } });
export const getCreditsClient = (clientNom: string) =>
  api.get('/caisse/credits/non-regles', { params: { clientNom } });

// ─── Clients — relevé / situation client (JSON paginé) ──────────────────────
// Contrat backend : GET /api/clients/{id}/releve?page=&size=&dateDebut=&dateFin=&type=
// dateDebut/dateFin au format AAAA-MM-JJ (LocalDate). type = 'VENTE' | 'VERSEMENT' | undefined (tout).
export const getReleveClient = (
  clientId: number,
  params?: { page?: number; size?: number; dateDebut?: string; dateFin?: string; type?: string },
) => api.get(`/clients/${clientId}/releve`, { params });

// ─── Types Dépenses ────────────────────────────────────────────────────────
export const getTypesDepense = () => api.get('/types-depense');
export const createTypeDepense = (nom: string) => api.post('/types-depense', { nom });
export const updateTypeDepense = (id: number, nom: string) => api.put(`/types-depense/${id}`, { nom });
export const deleteTypeDepense = (id: number) => api.delete(`/types-depense/${id}`);

// ─── Employés ──────────────────────────────────────────────────────────────
export const getEmployes = (params?: any) => api.get('/employes', { params });
export const createEmploye = (data: any) => api.post('/employes', data);
export const updateEmploye = (id: number, data: any) => api.put(`/employes/${id}`, data);
export const deleteEmploye = (id: number) => api.delete(`/employes/${id}`);
export const toggleStatutEmploye = (id: number, actif: boolean) => api.patch(`/employes/${id}/${actif ? 'activer' : 'desactiver'}`);
export const getPaiementsEmployeById = (id: number) => api.get(`/employes/${id}/paiements`);
export const createPaiementEmploye = (data: any) => api.post('/paiements-employe', data);

// ─── Dettes anciennes ──────────────────────────────────────────────────────
export const getDettesAnciennes = (params?: any) => api.get('/dettes-anciennes', { params });
export const createDetteAncienne = (data: any) => api.post('/dettes-anciennes', data);
export const updateDetteAncienne = (id: number, data: any) => api.put(`/dettes-anciennes/${id}`, data);
export const deleteDetteAncienne = (id: number) => api.delete(`/dettes-anciennes/${id}`);
export const getReglementsDetteAncienne = (id: number) => api.get(`/dettes-anciennes/${id}/reglements`);
export const ajouterReglementDetteAncienne = (data: any) => api.post('/dettes-anciennes/reglement', data);
export const getStatsDettesAnciennes = () => api.get('/dettes-anciennes/statistiques').catch(() => ({ data: {} }));

// ─── Comptes bancaires ──────────────────────────────────────────────────────
export const getComptes = () => api.get('/comptes');
export const createCompte = (data: any) => api.post('/comptes', data);
export const updateCompte = (id: number, data: any) => api.put(`/comptes/${id}`, data);
export const deleteCompte = (id: number) => api.delete(`/comptes/${id}`);
export const getOperationsCompte = (id: number) => api.get(`/comptes/${id}/operations`);
export const versementCompte = (data: any) => api.post('/comptes/operation', data);
export const retraitCompte = (data: any) => api.post('/comptes/operation', data);
// Transfert caisse -> banque (CaisseController.transfererVersBanque) — débite la
// caisse (pas le compte) et crédite le compte bancaire choisi. Même endpoint que
// transfererCaisseVersBanque() côté Ionic (compte.service.ts).
export const transfererCaisseVersBanque = (data: { compteId: number; montant: number; motif?: string; utilisateurId?: number; reference?: string }) =>
  api.post('/caisse/transferer-vers-banque', data);

// ─── Objectifs fournisseurs ─────────────────────────────────────────────────
export const getObjectifsFournisseur = () => api.get('/objectifs-fournisseur');
export const createObjectifFournisseur = (data: any) => api.post('/objectifs-fournisseur', data);
export const updateObjectifFournisseur = (id: number, data: any) => api.put(`/objectifs-fournisseur/${id}`, data);
export const deleteObjectifFournisseur = (id: number) => api.delete(`/objectifs-fournisseur/${id}`);
export const getAvancementObjectif = (id: number) => api.get(`/objectifs-fournisseur/${id}/avancement`).catch(() => ({ data: null }));

// ─── Vendeurs / Utilisateurs ────────────────────────────────────────────────
export const getVendeurs = () => api.get('/users');
export const createVendeur = (data: any) => api.post('/utilisateurs', data);
export const updateVendeur = (id: number, data: any) => api.put(`/utilisateurs/${id}`, data);
export const toggleStatutVendeur = (id: number, actif: boolean) => api.patch(`/users/${id}/statut`, { actif });
export const resetPasswordVendeur = (id: number, newPassword: string) => api.post(`/users/${id}/reset-password`, { newPassword });

// ─── Statistiques ventes ────────────────────────────────────────────────────
export const getStatsVentes = (params?: { dateDebut?: string; dateFin?: string }) =>
  api.get('/ventes/statistiques', { params }).catch(() => ({ data: {} }));
export const getVentesParType = (params?: any) =>
  api.get('/ventes/par-type', { params }).catch(() => ({ data: [] }));

// ─── Avances clients ────────────────────────────────────────────────────────
// Endpoint réel du backend : GET /api/avances/solde?clientNom=...&clientTelephone=...
// (l'ancien getSoldeAvanceClient(clientId) appelait /clients/avances/solde, une route
// qui n'existe pas côté backend — toujours retombée sur le .catch() silencieusement).
export const getSoldeAvanceClient = (clientNom: string, clientTelephone?: string) =>
  api.get('/avances/solde', { params: { clientNom, clientTelephone } }).catch(() => ({ data: { soldeDisponible: 0 } }));
export const createAvanceClient = (data: {
  clientNom: string;
  clientTelephone?: string;
  montant: number;
  motif?: string;
  utilisateurId?: number;
  modePaiement?: string;
  referencePaiement?: string;
}) => api.post('/avances', data);
// Endpoint réel : GET /api/avances/historique?clientNom=...&clientTelephone=... — l'ancien
// getAvancesClient(clientId) appelait /clients/avances/{id}, une route qui n'existe pas
// côté backend (ClientController n'a pas de sous-route /avances).
export const getHistoriqueAvanceClient = (clientNom: string, clientTelephone?: string) =>
  api.get('/avances/historique', { params: { clientNom, clientTelephone } });

// ─── Retours vente ──────────────────────────────────────────────────────────
export const retourVente = (id: number, data: any) => api.post(`/ventes/${id}/retour`, data);

// ─── Ventes annulées ────────────────────────────────────────────────────────
export const getVentesAnnulees = (boutiqueId: number) =>
  api.get(`/ventes/${boutiqueId}/annulees`);

// ─── Annulation paiements ────────────────────────────────────────────────────
export const getPaiementsFournisseur = (params?: { dateDebut?: string; dateFin?: string }) =>
  api.get('/fournisseur-achats/paiements', { params });

export const annulerPaiementFournisseur = (paiementId: number, utilisateurId: number) =>
  api.post(`/fournisseur-achats/paiement/${paiementId}/annuler`, null, {
    params: { utilisateurId: utilisateurId.toString() },
  });

export const getReglements = (params?: { dateDebut?: string; dateFin?: string }) =>
  api.get('/caisse/credits/reglements', { params });

export const annulerReglementCredit = (operationId: number, utilisateurId: number) =>
  api.post(`/caisse/credits/reglement/${operationId}/annuler`, null, {
    params: { utilisateurId: utilisateurId.toString() },
  });

// ─── Transferts avancés ────────────────────────────────────────────────────
export const getTransfertsEnvoyes = () => api.get('/transferts/envoyes');
export const getTransfertsRecus = () => api.get('/transferts/recus');
export const accepterTransfert = (id: number) => api.post(`/transferts/${id}/accepter`, {});
export const rejeterTransfert = (id: number, motif?: string) => api.post(`/transferts/${id}/rejeter`, { motif });

// ─── Analytique ────────────────────────────────────────────────────────────
export const getCA30Jours = () => api.get('/rapports/ca-30-jours');
export const getTopProduits = () => api.get('/rapports/top-produits');
export const getVentesParHeure = () => api.get('/rapports/ventes-par-heure');
export const getMarges = () => api.get('/rapports/marges');
export const getVentesParVendeur = (dateDebut?: string, dateFin?: string) =>
  api.get('/rapports/ventes-par-vendeur', { params: (dateDebut && dateFin) ? { dateDebut, dateFin } : {} });
export const getPrevisionStock = () => api.get('/previsions/stock');

// ─── Rapport complet (ventes + top produits + modes de paiement + crédits +
// clients) sur une période — endpoint unique qui regroupe tout, quelle que
// soit la période (jour/semaine/mois/année/personnalisé). Utilisé uniquement
// pour l'export PDF enrichi de RapportsScreen (voir invoice.service.ts,
// imprimerRapportCompletPdfRN) — PAS pour l'affichage à l'écran, qui reste
// calculé côté client via getVentesParPeriode + rapport.helpers.ts. ──────────
export const getRapportComplet = (dateDebut: string, dateFin: string) =>
  api.get('/rapports/complet', { params: { dateDebut, dateFin } });

// ─── IA (100% locale — pas d'API externe) ──────────────────────────────────
export const getProfilIA = () => api.get('/ia/profil');
export const sauvegarderProfilIA = (profil: any) => api.post('/ia/profil', profil);
export const analyserIA = () => api.get('/ia/analyse');
export const getRecommandationsIA = () => api.get('/ia/recommandations');
export const enregistrerFeedbackIA = (id: string, statut: 'SUIVIE' | 'IGNOREE') =>
  api.post(`/ia/feedback/${id}`, { statut });
export const getScoreSanteIA = () => api.get('/ia/sante');

// ─── Assistant IA — chat avec questions suggérées ──────────────────────────
export const getQuestionsPredefiniesIA = () => api.get('/ia/questions-predefinies');
export const envoyerQuestionIA = (question: string) => api.post('/ia/chat', { question });

// ─── Transferts — produits & paiements inter-boutiques ────────────────────
export const getProduitsBoutique = (partenaireId: number) =>
  api.get(`/transferts/partenaires/${partenaireId}/produits`).catch(() => ({ data: [] }));

export const getPaiementsTransfert = (transfertId: number) =>
  api.get(`/transferts/${transfertId}/paiements`).catch(() => ({ data: [] }));

export const ajouterPaiementTransfert = (transfertId: number, paiement: {
  montant: number;
  modePaiement: string;
  notes?: string;
}) => api.post(`/transferts/${transfertId}/paiements`, paiement);

// ─── Paramètres (réinitialisation / suppression données boutique — ADMIN) ──
export interface SelectionParametres {
  soldeCaisse?: boolean;
  historiqueOperationsCaisse?: boolean;
  creditsRegles?: boolean;
  historiqueVentesAnnulees?: boolean;
}
export const getStatutParametres = () => api.get('/parametres/statut');
export const reinitialiserParametres = (selection: SelectionParametres) =>
  api.post('/parametres/reinitialiser', selection);
export const supprimerParametres = (selection: SelectionParametres) =>
  api.delete('/parametres/supprimer', { data: selection });

// ─── Objectifs vendeurs (primes hebdomadaires — module séparé du paiement
// employé, ne déclenche aucun paiement automatique ni écriture stock) ───────
export const getObjectifsVendeur = () => api.get('/objectifs-vendeur');
export const getObjectifVendeur = (id: number) => api.get(`/objectifs-vendeur/${id}`);
export const getObjectifsVendeurParSemaine = (semaine: number, annee: number) =>
  api.get('/objectifs-vendeur/semaine', { params: { semaine, annee } });
export const getObjectifsVendeurParVendeur = (vendeurId: number) => api.get(`/objectifs-vendeur/vendeur/${vendeurId}`);
export const getObjectifsVendeurParAnnee = (annee: number) => api.get('/objectifs-vendeur/annee', { params: { annee } });
export const createObjectifVendeur = (data: any) => api.post('/objectifs-vendeur', data);
export const updateObjectifVendeur = (id: number, data: any) => api.put(`/objectifs-vendeur/${id}`, data);
export const validerObjectifVendeur = (id: number) => api.patch(`/objectifs-vendeur/${id}/valider`, {});
export const deleteObjectifVendeur = (id: number) => api.delete(`/objectifs-vendeur/${id}`);

// ─── Suggestions promo flash (produits proches de la péremption — ADMIN) ───
export const getProduitsProchePeremption = (jours: number = 7) =>
  api.get('/produits/proche-peremption', { params: { jours } });

// ─── Réconciliation caisse par vendeur (ADMIN) — rapport en lecture seule :
// pour chaque vendeur, ventes espèces/crédit du jour + règlements crédit
// encaissés en espèces + total à remettre en caisse. Réponse : { success,
// date, reconciliation: [...] } — la liste est dans la clé "reconciliation".
export const getReconciliationVendeurs = (date?: string) =>
  api.get('/caisse/reconciliation-vendeurs', { params: date ? { date } : undefined });

// ─── Sauvegarde automatique programmée (ADMIN) ─────────────────────────────
// GET /backup/liste (liste triée du plus récent au plus ancien côté backend)
// et POST /backup/declencher (mysqldump exécuté de façon SYNCHRONE côté
// serveur — peut prendre plusieurs secondes, d'où le timeout spécifique bien
// plus généreux que celui de l'instance globale (15s), pour cet appel
// précis uniquement). Le téléchargement du fichier (GET /backup/telecharger/
// {nomFichier}) ne passe pas par ces wrappers : voir backup.service.ts,
// qui utilise expo-file-system (headers Authorization joints manuellement,
// hors de l'intercepteur axios) pour écrire puis partager le fichier binaire.
export const getListeSauvegardes = () => api.get('/backup/liste');
export const declencherSauvegarde = () => api.post('/backup/declencher', {}, { timeout: 120000 });

// ─── Programme de fidélité (CleFonctionnalite.PROGRAMME_FIDELITE) ──────────
// Masqué/désactivé exactement comme Dépôt garde / Comptes bancaires — voir
// 'fonctionnalites_avancees_desactivees' en cache local (LoginScreen.tsx).
// L'utilisation de points pendant une vente applique la réduction via le
// mécanisme remiseGlobale/MONTANT_FIXE déjà existant (VenteScreen.valider),
// PUIS débite réellement le solde via .../utiliser une fois la vente créée —
// jamais l'inverse (voir FideliteController côté backend).
export const getParametresFidelite = () => api.get('/fidelite/parametres');
export const definirParametresFidelite = (data: { montantParPoint: number; pointValeur: number }) =>
  api.put('/fidelite/parametres', data);
export const getSoldeFideliteClient = (clientId: number) => api.get(`/fidelite/clients/${clientId}`);
export const getMouvementsFideliteClient = (clientId: number) => api.get(`/fidelite/clients/${clientId}/mouvements`);
export const utiliserPointsFidelite = (clientId: number, points: number, venteId: number) =>
  api.post(`/fidelite/clients/${clientId}/utiliser`, { points, venteId });
export const ajusterPointsFidelite = (clientId: number, delta: number, motif?: string) =>
  api.patch(`/fidelite/clients/${clientId}/ajuster`, { delta, motif });
export const restaurerSauvegarde = (nomFichier: string) => api.post(`/backup/restaurer/${encodeURIComponent(nomFichier)}`, {}, { timeout: 120000 });
