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
 * Calcule le facteur total entre un niveau et l'unité de base (le niveau
 * feuille, sans enfant) — c'est-à-dire combien d'unités de base représente
 * 1 unité de CE niveau (ex: 1 Carton = 12 Paquets x 6 Pièces = 72 Pièces).
 * C'est exactement ce que le backend attend dans LigneVenteRequest.niveauFacteur
 * ("facteur pour déduction stock", cf. LigneVente.java) et ce que fait déjà
 * Ionic (cart.page.ts, calculerFacteurTotal) via sa propre récursion enfants.
 *
 * BUG FIX (2026-08-16) : la version précédente remontait la chaîne parentId
 * (vers la racine) en multipliant le facteur DE CHAQUE NIVEAU TRAVERSÉ, y
 * compris celui du niveau de départ lui-même — l'inverse de ce qu'il fallait
 * (descendre vers les enfants). Résultat vérifié faux dans les 3 cas (Pièce
 * vendue → 72 au lieu de 1 ; Paquet → 12 au lieu de 6 ; Carton → 1 au lieu
 * de 72), donc une mauvaise quantité de stock déduite côté serveur à chaque
 * vente utilisant un niveau d'emballage.
 */
export function calculerFacteurTotal(niveaux: ProduitNiveau[], niveauIdOuOrdre: number, parId = true): number {
  if (parId) {
    const map = new Map<number, ProduitNiveau>(niveaux.filter(n => n.id !== undefined).map(n => [n.id!, n]));
    const facteurVersBase = (n: ProduitNiveau): number => {
      const enfant = niveaux.find(c => c.parentId === n.id);
      if (!enfant) return 1;
      return enfant.facteur * facteurVersBase(enfant);
    };
    const depart = map.get(niveauIdOuOrdre);
    return depart ? facteurVersBase(depart) : 1;
  }
  // Fallback mode ordre (compatibilité ancienne API) — chemin legacy non
  // exercé en pratique (l'API renvoie toujours un id), laissé inchangé.
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
