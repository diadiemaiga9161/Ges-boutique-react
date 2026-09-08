import api from './api.service';

// ─── Unités de vente (CleFonctionnalite.VENTE_GROS_DETAIL) ─────────────────
// Système simple et INDÉPENDANT de l'ancien ProduitNiveau
// (produit-niveau.service.ts, ne pas toucher) : le produit garde UN SEUL
// stock (Produit.quantite). Une "unité de vente" n'est qu'un raccourci de
// saisie (nom + facteur de conversion vers l'unité de base + prix) — la
// vente déduit directement quantite × facteur sur ce stock unique, sans
// cascade ni stock séparé, et sans jamais envoyer de niveauId (voir
// VenteScreen.valider() : niveauId reste undefined pour ces lignes).
export interface UniteVente {
  id: number;
  nom: string;
  // Facteur total déjà résolu par le serveur vers l'unité de base du produit
  // (ex: 1 Carton = 72 Pièces) — c'est ce que le backend attend tel quel dans
  // LigneVenteRequest.niveauFacteur pour cette ligne.
  facteurBase: number;
  prixVente: number;
  prixAchat: number;
  ordre?: number;
}

// Corps envoyé à la création/modification — jamais de facteur total calculé
// côté client : uniteReferenceId + facteurRelatif seulement (le serveur fait
// le calcul). uniteReferenceId omis = facteur relatif à l'unité de base du
// produit elle-même.
export interface UniteVenteInput {
  nom: string;
  prixVente: number;
  prixAchat: number;
  ordre?: number;
  uniteReferenceId?: number;
  facteurRelatif: number;
}

export const getUnitesVente = async (produitId: number): Promise<UniteVente[]> => {
  const res = await api.get(`/produits/${produitId}/unites-vente`);
  return res.data?.unites || [];
};

export const creerUniteVente = (produitId: number, data: UniteVenteInput) =>
  api.post(`/produits/${produitId}/unites-vente`, data);

export const modifierUniteVente = (id: number, data: UniteVenteInput) =>
  api.put(`/produits/unites-vente/${id}`, data);

export const supprimerUniteVente = (id: number) =>
  api.delete(`/produits/unites-vente/${id}`);
