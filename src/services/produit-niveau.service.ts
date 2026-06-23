import api from './api.service';

export interface ProduitNiveau {
  id?: number;
  produitId?: number;
  nom: string;
  ordre: number;
  facteur: number;
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

export function calculerFacteurTotal(niveaux: ProduitNiveau[], ordreNiveau: number): number {
  const sorted = [...niveaux].sort((a, b) => a.ordre - b.ordre);
  const maxOrdre = Math.max(...sorted.map(n => n.ordre));
  let total = 1;
  for (const n of sorted) {
    if (n.ordre >= ordreNiveau && n.ordre < maxOrdre) {
      total *= n.facteur;
    }
  }
  return total;
}
