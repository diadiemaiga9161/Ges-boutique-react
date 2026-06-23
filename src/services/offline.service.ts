import NetInfo from '@react-native-community/netinfo';
import { createVente, createProduit, updateProduit } from './api.service';
import {
  getVentesPending, marquerVenteSynced, saveVentePending, countVentesPending,
  saveProduitPending, getProduitsPending, marquerProduitPendingSynced,
  saveProduitUpdatePending, getProduitsUpdatesPending, marquerProduitUpdateSynced,
  countProduitsPending,
} from '../db/database';

let syncInProgress = false;

export function genererLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Ventes ─────────────────────────────────────────────────────────────────

export async function enregistrerVente(vente: any): Promise<{ success: boolean; offline: boolean }> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    try {
      await createVente(vente);
      return { success: true, offline: false };
    } catch {
      const localId = genererLocalId();
      await saveVentePending(localId, vente);
      return { success: true, offline: true };
    }
  } else {
    const localId = genererLocalId();
    await saveVentePending(localId, vente);
    return { success: true, offline: true };
  }
}

export async function syncVentesPending(): Promise<number> {
  if (syncInProgress) return 0;
  const state = await NetInfo.fetch();
  if (!state.isConnected) return 0;
  syncInProgress = true;
  let synced = 0;
  try {
    const pending = await getVentesPending();
    for (const vente of pending) {
      try {
        const { localId, ...data } = vente;
        await createVente(data);
        await marquerVenteSynced(localId);
        synced++;
      } catch { }
    }
  } finally {
    syncInProgress = false;
  }
  return synced;
}

export async function getNombreVentesPending(): Promise<number> {
  return countVentesPending();
}

// ─── Produits offline ────────────────────────────────────────────────────────

export async function creerProduitOffline(data: any): Promise<{ success: boolean; offline: boolean }> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    try {
      await createProduit(data);
      return { success: true, offline: false };
    } catch {
      const localId = genererLocalId();
      await saveProduitPending(localId, data);
      return { success: true, offline: true };
    }
  } else {
    const localId = genererLocalId();
    await saveProduitPending(localId, data);
    return { success: true, offline: true };
  }
}

export async function modifierProduitOffline(id: number, data: any): Promise<{ success: boolean; offline: boolean }> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    try {
      await updateProduit(id, data);
      return { success: true, offline: false };
    } catch {
      const localId = genererLocalId();
      await saveProduitUpdatePending(localId, id, data);
      return { success: true, offline: true };
    }
  } else {
    const localId = genererLocalId();
    await saveProduitUpdatePending(localId, id, data);
    return { success: true, offline: true };
  }
}

export async function syncProduitsPending(): Promise<number> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return 0;
  let synced = 0;

  // Sync nouvelles créations
  const pendingCreate = await getProduitsPending();
  for (const p of pendingCreate) {
    try {
      const { localId, ...data } = p;
      await createProduit(data);
      await marquerProduitPendingSynced(localId);
      synced++;
    } catch { }
  }

  // Sync modifications
  const pendingUpdate = await getProduitsUpdatesPending();
  for (const p of pendingUpdate) {
    try {
      const { localId, produitId, ...data } = p;
      await updateProduit(produitId, data);
      await marquerProduitUpdateSynced(localId);
      synced++;
    } catch { }
  }

  return synced;
}

export async function getNombreProduitsPending(): Promise<number> {
  return countProduitsPending();
}

// ─── Auto-sync au retour de connexion ───────────────────────────────────────

export function demarrerAutoSync(onSync?: (n: number) => void): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const nVentes = await syncVentesPending();
      const nProduits = await syncProduitsPending();
      const total = nVentes + nProduits;
      if (total > 0 && onSync) onSync(total);
    }
  });
  return unsubscribe;
}
