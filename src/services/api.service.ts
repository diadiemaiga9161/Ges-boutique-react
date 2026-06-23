import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_API_URL = 'https://fatmazahara.mg-consulting.site/api';

export const BOUTIQUES_CONFIG = [
  { id: 1, nom: 'Fatma Zahara',    url: 'https://fatmazahara.mg-consulting.site/api' },
  { id: 2, nom: 'Moh',             url: 'https://moh.mg-consulting.site/api' },
  { id: 3, nom: 'Magaouba Kabala', url: 'https://magaoubakabala.mg-consulting.site/api' },
  { id: 4, nom: 'Baran Djim',      url: 'https://barandjim.mg-consulting.site/api' },
  { id: 5, nom: 'Bou Bandjim',     url: 'https://boubandjim.mg-consulting.site/api' },
];

export function getApiUrlForPort(port: number): string {
  return BOUTIQUES_CONFIG[port - 1]?.url || DEFAULT_API_URL;
}

const api = axios.create({ baseURL: DEFAULT_API_URL, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const savedUrl = await AsyncStorage.getItem('api_url');
  if (savedUrl) config.baseURL = savedUrl;
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

// ─── Auth ──────────────────────────────────────────────────────────────────
export const login = (identifier: string, password: string) =>
  api.post('/auth/login', { identifier, password });
export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email });
export const resetPassword = (token: string, newPassword: string) =>
  api.post('/auth/reset-password', { token, newPassword });

// ─── Boutique ──────────────────────────────────────────────────────────────
export const getBoutique = () => api.get('/boutique');
export const updateBoutique = (data: any) => api.put('/boutique', data);
export const getBoutiques = () => api.get('/boutiques');
export const selectBoutique = (id: number) => api.post(`/boutiques/${id}/select`);

// ─── Produits ──────────────────────────────────────────────────────────────
export const getProduits = (params?: any) => api.get('/produits', { params });
export const getProduit = (id: number) => api.get(`/produits/${id}`);
export const createProduit = (data: any) => api.post('/produits', data);
export const updateProduit = (id: number, data: any) => api.put(`/produits/${id}`, data);
export const deleteProduit = (id: number) => api.delete(`/produits/${id}`);
export const uploadPhotoProduit = (id: number, form: FormData) =>
  api.post(`/produits/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });

// ─── Ventes ────────────────────────────────────────────────────────────────
export const getVentes = (params?: any) => api.get('/ventes', { params });
export const getVentesJour = (params?: any) => api.get('/ventes/jour', { params });
export const createVente = (data: any) => api.post('/ventes', data);
export const annulerVente = (id: number) => api.delete(`/ventes/${id}`);

// ─── Clients ───────────────────────────────────────────────────────────────
export const getClients = (params?: any) => api.get('/clients', { params });
export const createClient = (data: any) => api.post('/clients', data);
export const updateClient = (id: number, data: any) => api.put(`/clients/${id}`, data);
export const deleteClient = (id: number) => api.delete(`/clients/${id}`);

// ─── Fournisseurs ──────────────────────────────────────────────────────────
export const getFournisseurs = (params?: any) => api.get('/fournisseurs', { params });
export const createFournisseur = (data: any) => api.post('/fournisseurs', data);
export const updateFournisseur = (id: number, data: any) => api.put(`/fournisseurs/${id}`, data);
export const deleteFournisseur = (id: number) => api.delete(`/fournisseurs/${id}`);

// ─── Dépenses ──────────────────────────────────────────────────────────────
export const getDepenses = (params?: any) => api.get('/depenses', { params });
export const createDepense = (data: any) => api.post('/depenses', data);
export const updateDepense = (id: number, data: any) => api.put(`/depenses/${id}`, data);
export const deleteDepense = (id: number) => api.delete(`/depenses/${id}`);

// ─── Rapports ──────────────────────────────────────────────────────────────
export const getRapportJour = (params?: any) => api.get('/rapports/jour', { params });
export const getRapportSemaine = (params?: any) => api.get('/rapports/semaine', { params });
export const getRapportMois = (params?: any) => api.get('/rapports/mois', { params });

// ─── Notifications ─────────────────────────────────────────────────────────
export const getNotifications = () => api.get('/notifications');
export const marquerLue = (id: number) => api.patch(`/notifications/${id}/lue`);

// ─── Crédits ───────────────────────────────────────────────────────────────
export const getCredits = (params?: any) => api.get('/credits', { params });
export const createCredit = (data: any) => api.post('/credits', data);
export const payerCredit = (id: number, data: any) => api.post(`/credits/${id}/payer`, data);

// ─── Caisse ────────────────────────────────────────────────────────────────
export const getCaisse = (params?: any) => api.get('/caisse', { params });
export const ouvrirCaisse = (data: any) => api.post('/caisse/ouvrir', data);
export const fermerCaisse = (data: any) => api.post('/caisse/fermer', data);

// ─── Inventaire ────────────────────────────────────────────────────────────
export const getInventaire = () => api.get('/inventaire');
export const ajusterStock = (id: number, data: any) => api.patch(`/produits/${id}/stock`, data);

// ─── Transferts ────────────────────────────────────────────────────────────
export const getTransferts = (params?: any) => api.get('/transferts', { params });
export const createTransfert = (data: any) => api.post('/transferts', data);

// ─── Dépôts ────────────────────────────────────────────────────────────────
export const getDepots = (params?: any) => api.get('/depots', { params });
export const createDepot = (data: any) => api.post('/depots', data);

// ─── Profil ────────────────────────────────────────────────────────────────
export const getProfil = () => api.get('/auth/me');
export const updateProfil = (data: any) => api.put('/auth/me', data);
export const uploadPhotoProfil = (form: FormData) =>
  api.post('/auth/me/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });

// ─── Bonus fournisseurs ────────────────────────────────────────────────────
export const getBonusFournisseurs = (params?: any) => api.get('/bonus-fournisseurs', { params });
export const createBonusFournisseur = (data: any) => api.post('/bonus-fournisseurs', data);

// ─── Promotions ────────────────────────────────────────────────────────────
export const getPromotions = (params?: any) => api.get('/promotions', { params });
export const createPromotion = (data: any) => api.post('/promotions', data);
export const updatePromotion = (id: number, data: any) => api.put(`/promotions/${id}`, data);
export const deletePromotion = (id: number) => api.delete(`/promotions/${id}`);
