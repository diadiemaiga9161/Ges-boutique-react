import api from './api.service';

// ─── Journal d'audit — GET /api/journal-audit ──────────────────────────────
// Contrat backend CONFIRMÉ (Spring Boot) : pagination + filtres optionnels
// (page, size, dateDebut, dateFin ISO, utilisateurId), réponse enveloppée
// {success, journaux[], page, size, totalElements, totalPages}, tri par
// dateAction décroissant côté serveur. Accès réservé ADMIN côté backend
// (403 pour un vendeur) — le lien est donc aussi masqué côté front pour eux
// (voir DrawerContent.tsx / MenuScreen.tsx / JournalAuditScreen.tsx).

// Les 8 valeurs possibles de l'enum backend TypeActionAudit — liste FERMÉE et
// définitive. SUPPRESSION_TRANSFERT est gérée par sécurité même si elle ne
// devrait jamais apparaître en pratique côté backend actuel.
export type TypeActionAudit =
  | 'SUPPRESSION_VENTE'
  | 'MODIFICATION_PRIX_PRODUIT'
  | 'ANNULATION_TRANSFERT'
  | 'SUPPRESSION_TRANSFERT'
  | 'SUPPRESSION_CLIENT'
  | 'SUPPRESSION_FOURNISSEUR'
  | 'MODIFICATION_ROLE_UTILISATEUR'
  | 'SUPPRESSION_CREDIT';

// Libellés FR à afficher — IDENTIQUES sur les 3 plateformes (Angular/Ionic/RN),
// ne pas reformuler. Si le backend renvoie un code non reconnu (nouvelle
// valeur d'enum ajoutée plus tard, etc.), on retombe sur le code brut plutôt
// que de planter — voir libelleActionAudit() ci-dessous.
const LIBELLES_ACTION_AUDIT: Record<string, string> = {
  SUPPRESSION_VENTE: "Suppression d'une vente",
  MODIFICATION_PRIX_PRODUIT: "Modification du prix d'un produit",
  ANNULATION_TRANSFERT: "Annulation d'un transfert",
  SUPPRESSION_TRANSFERT: "Suppression d'un transfert",
  SUPPRESSION_CLIENT: "Suppression d'un client",
  SUPPRESSION_FOURNISSEUR: "Suppression d'un fournisseur",
  MODIFICATION_ROLE_UTILISATEUR: "Modification du rôle d'un utilisateur",
  SUPPRESSION_CREDIT: "Suppression d'un crédit/dette",
};

export function libelleActionAudit(action: string): string {
  return LIBELLES_ACTION_AUDIT[action] || action;
}

export interface JournalAuditEntree {
  id: number;
  utilisateurId: number;
  utilisateurNom: string;
  action: TypeActionAudit | string;
  details?: string;
  dateAction: string;
}

export interface JournalAuditReponse {
  success: boolean;
  journaux: JournalAuditEntree[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface JournalAuditParams {
  page?: number;
  size?: number;
  dateDebut?: string;
  dateFin?: string;
  utilisateurId?: number;
}

export const getJournalAudit = (params?: JournalAuditParams) =>
  api.get<JournalAuditReponse>('/journal-audit', { params });
