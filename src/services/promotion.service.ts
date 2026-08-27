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
    // BUG FIX (2026-08-16) : arrondi manquant — Ionic (promotion.service.ts
    // calculerPrixPromo) arrondit, ici non, ce qui pouvait afficher des FCFA
    // à virgule (ex: 897.5 FCFA) sur une devise sans décimales.
    return Math.round(prixOriginal * (1 - promo.valeurReduction / 100));
  }
  return Math.max(0, prixOriginal - promo.valeurReduction);
}

export async function getPromosPourProduit(produitId: number): Promise<Promotion[]> {
  try {
    const res = await api.get(`/promotions/produit/${produitId}`);
    // Le backend renvoie { success, promotions: [...] }, pas { data: [...] } —
    // cf. correctif du meme bug dans PromotionsScreen.tsx.
    return res.data?.promotions || res.data?.data || [];
  } catch { return []; }
}
