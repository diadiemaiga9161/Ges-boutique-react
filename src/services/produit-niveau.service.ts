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
