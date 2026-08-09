import api from './api.service';

export interface ProduitNiveau {
  id?: number;
  produitId?: number;
  nom: string;
  ordre?: number;       // gardé pour compatibilité, optionnel
  parentId?: number;    // null = niveau racine (plus grand emballage)
  facteur: number;      // combien de CE niveau dans 1 unité du parent
  prixAchat: number;
  prixVente: number;
  stock?: number; // stock propre de ce niveau (cascade auto si épuisé)
}

export const getNiveaux = async (produitId: number): Promise<ProduitNiveau[]> => {
  const res = await api.get(`/produits/${produitId}/niveaux`);
  return res.data?.niveaux || [];
};

/**
 * Niveaux + stock du produit "principal" pas encore décomposé (ex: cartons
 * fermés) en un seul appel. C'est le parent implicite du niveau racine
 * (parentId = null) — sans ça, disponibleNiveau() ne peut pas savoir qu'il
 * reste des cartons à ouvrir.
 */
export const getNiveauxEtPrincipal = async (produitId: number): Promise<{ niveaux: ProduitNiveau[]; quantitePrincipale: number }> => {
  const res = await api.get(`/produits/${produitId}/niveaux`);
  return { niveaux: res.data?.niveaux || [], quantitePrincipale: res.data?.quantitePrincipale ?? 0 };
};

export const decomposer = async (id: number): Promise<{ niveaux: ProduitNiveau[], produitQuantite: number, message: string }> => {
  const res = await api.post(`/produits/niveaux/${id}/decomposer`, {});
  return res.data;
};

export const creerNiveau = (produitId: number, data: Omit<ProduitNiveau, 'id' | 'produitId'>) =>
  api.post(`/produits/${produitId}/niveaux`, data);

export const modifierNiveau = (id: number, data: Partial<ProduitNiveau>) =>
  api.put(`/produits/niveaux/${id}`, data);

export const supprimerNiveau = (id: number) =>
  api.delete(`/produits/niveaux/${id}`);

export const ajusterStock = (id: number, stock: number) =>
  api.patch(`/produits/niveaux/${id}/stock`, { stock });

/**
 * Calcule le facteur total entre un niveau et la racine de la hiérarchie.
 * Utilise parentId si disponible, sinon fallback sur ordre pour compatibilité.
 */
export function calculerFacteurTotal(niveaux: ProduitNiveau[], niveauIdOuOrdre: number, parId = true): number {
  if (parId) {
    // Remonte la chaîne parentId jusqu'à la racine en multipliant les facteurs
    let total = 1;
    const map = new Map<number, ProduitNiveau>(niveaux.filter(n => n.id !== undefined).map(n => [n.id!, n]));
    let courant = map.get(niveauIdOuOrdre);
    while (courant) {
      total *= courant.facteur;
      courant = courant.parentId !== undefined && courant.parentId !== null
        ? map.get(courant.parentId)
        : undefined;
    }
    return total;
  }
  // Fallback mode ordre (compatibilité ancienne API)
  const sorted = [...niveaux].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const maxOrdre = Math.max(...sorted.map(n => n.ordre ?? 0));
  let total = 1;
  for (const n of sorted) {
    if ((n.ordre ?? 0) >= niveauIdOuOrdre && (n.ordre ?? 0) < maxOrdre) {
      total *= n.facteur;
    }
  }
  return total;
}

/**
 * Stock réellement disponible pour un niveau, en cascadant récursivement
 * depuis ses parents jusqu'à la racine (produit principal) — miroir exact de
 * calculerDisponibleNiveau() côté backend (VenteServiceImpl.java). Ne PAS se
 * limiter au parent direct : la vente peut décomposer plusieurs crans d'un
 * coup (ex: Pièce épuisée + Paquet épuisé → ouvre directement un Carton).
 */
export function disponibleNiveau(niveaux: ProduitNiveau[], niveauId: number, quantitePrincipale = 0): number {
  const map = new Map<number, ProduitNiveau>(niveaux.filter(n => n.id !== undefined).map(n => [n.id!, n]));
  const calc = (niveau: ProduitNiveau): number => {
    const direct = niveau.stock ?? 0;
    const facteur = niveau.facteur > 0 ? niveau.facteur : 1;
    if (niveau.parentId === undefined || niveau.parentId === null) {
      // Niveau racine : son parent implicite est le produit principal
      // (quantitePrincipale = stock pas encore décomposé, ex: cartons fermés).
      return direct + quantitePrincipale * facteur;
    }
    const parent = map.get(niveau.parentId);
    if (!parent) return direct;
    return direct + calc(parent) * facteur;
  };
  const target = map.get(niveauId);
  return target ? calc(target) : 0;
}
