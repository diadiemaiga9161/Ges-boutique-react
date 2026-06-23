import api from './api.service';

export interface Promotion {
  id?: number;
  titre: string;
  typeReduction: 'POURCENTAGE' | 'MONTANT_FIXE';
  valeurReduction: number;
  active: boolean;
  globale?: boolean;
  produitIds?: number[];
}

export const getPromotions = () => api.get('/promotions');
export const getPromotionsActives = () => api.get('/promotions/actives');
export const createPromotion = (data: Promotion) => api.post('/promotions', data);
export const updatePromotion = (id: number, data: Partial<Promotion>) => api.put(`/promotions/${id}`, data);
export const deletePromotion = (id: number) => api.delete(`/promotions/${id}`);

export function calculerPrixPromo(prixOriginal: number, promo: Promotion): number {
  if (!promo?.active) return prixOriginal;
  if (promo.typeReduction === 'POURCENTAGE') {
    return prixOriginal * (1 - promo.valeurReduction / 100);
  }
  return Math.max(0, prixOriginal - promo.valeurReduction);
}

export async function getPromosPourProduit(produitId: number): Promise<Promotion[]> {
  try {
    const res = await api.get(`/promotions/produit/${produitId}`);
    return res.data?.data || res.data || [];
  } catch { return []; }
}
