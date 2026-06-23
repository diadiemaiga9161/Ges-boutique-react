export interface User {
  id: number;
  nom: string;
  email?: string;
  telephone?: string;
  username?: string;
  role: 'ADMIN' | 'VENDEUR';
  token: string;
  boutiqueId?: number;
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
