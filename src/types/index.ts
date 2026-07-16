export interface User {
  id: number;
  username: string;
  role: 'ADMIN' | 'VENDEUR';
  nomComplet: string;
  email?: string;
  telephone?: string;
  token: string;
  boutiqueId?: number;
  photo?: string;
}

export interface BoutiqueInfo {
  id?: number;
  nom: string;
  adresse?: string;
  telephone?: string;
  telephone2?: string;
  telephone3?: string;
  email?: string;
  logoUrl?: string;
  devise?: string;
  ville?: string;
  pays?: string;
}

export interface Produit {
  id: number;
  nom: string;
  description?: string;
  prixAchat: number;
  prixVente: number;
  quantite: number;
  seuilAlerte?: number;
  categorie?: string;
  imageUrl?: string;
  codeBarres?: string;
}

export interface LigneVenteRequest {
  produitId: number;
  produitNom?: string;
  quantite: number;
  prixUnitaire: number;
  remisePourcentage?: number;
  prixAchat?: number;
  niveauId?: number;    // ID du ProduitNiveau vendu (cascade stock)
  niveauNom?: string;
  niveauFacteur?: number;
}

export interface Vente {
  id?: number;
  clientId?: number;
  clientNom?: string;
  lignes: LigneVenteRequest[];
  modePaiement: string;
  montantRecu?: number;
  estCredit?: boolean;
  notes?: string;
  dateVente?: string;
  montantTotal?: number;
  syncPending?: boolean;
  localId?: string;
}

export interface Client {
  id: number;
  nom: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  soldeCredit?: number;
}

export interface Depense {
  id?: number;
  description: string;
  montant: number;
  categorie?: string;
  date?: string;
}

export interface RootStackParamList {
  Login: undefined;
  Main: undefined;
}

export interface MainTabParamList {
  Produits: undefined;
  Vente: undefined;
  Rapports: undefined;
  Menu: undefined;
}

// ─── IA ───────────────────────────────────────────────────────────────────────

export interface RecommandationIA {
  id: string;
  type: string;
  priorite: string; // CRITIQUE, HAUTE, MOYENNE, BASSE
  titre: string;
  description: string;
  actionLabel: string;
  donnees: any;
  scoreConfiance: number; // 0-100
}

export interface AlerteIA {
  type: string;
  message: string;
  severity: string; // CRITIQUE, HAUTE, BASSE
}

export interface AnalyseIAResult {
  scoreGlobal: number;
  tendanceCA: string; // FORTE_HAUSSE, HAUSSE, STABLE, BAISSE, FORTE_BAISSE
  tauxCroissanceMensuel: number;
  previsionCA7Jours: number;
  previsionCA30Jours: number;
  caHier: number;
  caCetteSemaine: number;
  caCeMois: number;
  recommandations: RecommandationIA[];
  alertes: AlerteIA[];
  segmentsClients: { [key: string]: number };
  previsionCA30JoursDetail: { date: string; prevision: number }[];
  precisionModele: number;
}

export interface ProfilIA {
  typeBoutique: string; // ALIMENTATION, TEXTILE, ELECTRONIQUE, PHARMACIE, MIXTE, AUTRE
  joursApprovisionnement: string[]; // ex: ['LUNDI', 'MERCREDI']
  objectifStockJours: number; // 7, 14, 21, 30, 45, 60
  margeObjectif: number; // 10, 15, 20, 25, 30, 40, 50 (%)
  delaiReglementCredit: number; // 7, 15, 30, 45, 60 (jours)
}
