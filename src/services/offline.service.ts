import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, {
  createVente, createProduit, updateProduit, createDepense, createClient, createCommande,
  createFournisseur, updateFournisseur, creerAchatFournisseur, payerFournisseur,
  ajouterMouvement, ouvrirCaisse, fermerCaisse, ajouterEntreeCaisse, ajouterSortieCaisse,
  reglerCreditCaisse, createDepot, effectuerRetraitDepot, createTransfert,
  createPromotion, updatePromotion, validerCommande, annulerCommande,
  payerCreditCommande, createBonusFournisseur,
  createEmploye, updateEmploye, deleteEmploye, toggleStatutEmploye, createPaiementEmploye,
  createDetteAncienne, deleteDetteAncienne, ajouterReglementDetteAncienne,
  createCompte, deleteCompte, versementCompte, retraitCompte,
  createObjectifFournisseur, deleteObjectifFournisseur,
  createVendeur, updateVendeur, toggleStatutVendeur,
} from './api.service';
import {
  getVentesPending, marquerVenteSynced, saveVentePending, countVentesPending,
  saveProduitPending, getProduitsPending, marquerProduitPendingSynced,
  saveProduitUpdatePending, getProduitsUpdatesPending, marquerProduitUpdateSynced,
  countProduitsPending,
  saveDepensePending, getDepensesPending, marquerDepenseSynced,
  saveClientPending, getClientsPending, marquerClientPendingSynced,
  saveCommandePending, getCommandesPending, marquerCommandePendingSynced,
  saveOperation, getOperationsPending, markOperationSynced, incrementOperationAttempts, countOperationsPending,
  marquerOperationEchecNotifie, getOperationsEchecDefinitif, countOperationsEchecDefinitif,
} from '../db/database';
import { showToast } from './toast.service';

// Libellés lisibles pour les types d'opérations de la file générique —
// utilisés dans les notifications d'échec définitif (point utilisateur).
const LABELS_OPERATION: Record<string, string> = {
  fournisseur_create: 'Création fournisseur', fournisseur_update: 'Modification fournisseur',
  achat_fournisseur: 'Achat fournisseur', paiement_fournisseur: 'Paiement fournisseur',
  bonus_fournisseur: 'Bonus fournisseur',
  mouvement_entree: 'Entrée stock', mouvement_sortie: 'Sortie stock', mouvement_ajustement: 'Ajustement stock',
  caisse_ouvrir: 'Ouverture caisse', caisse_fermer: 'Fermeture caisse',
  caisse_entree: 'Entrée caisse', caisse_sortie: 'Sortie caisse',
  credit_reglement: 'Règlement crédit', credit_commande_payer: 'Paiement crédit commande',
  depot_create: 'Dépôt garde', depot_retrait: 'Retrait dépôt garde',
  transfert_create: 'Transfert', promotion_create: 'Création promotion', promotion_update: 'Modification promotion',
  commande_valider: 'Validation commande', commande_annuler: 'Annulation commande',
  employe_create: 'Création employé', employe_update: 'Modification employé',
  employe_toggle: 'Statut employé', employe_delete: 'Suppression employé',
  paiement_employe: 'Paiement employé',
  dette_create: 'Dette ancienne', dette_delete: 'Suppression dette', dette_reglement: 'Règlement dette',
  compte_create: 'Création compte', compte_update: 'Modification compte', compte_delete: 'Suppression compte',
  compte_versement: 'Versement compte', compte_retrait: 'Retrait compte',
  objectif_create: 'Création objectif', objectif_delete: 'Suppression objectif',
  vendeur_create: 'Création vendeur', vendeur_update: 'Modification vendeur', vendeur_toggle: 'Statut vendeur',
};

function libelleOperation(type: string): string {
  return LABELS_OPERATION[type] || type;
}

let syncInProgress = false;

export function genererLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Ventes ─────────────────────────────────────────────────────────────────

export async function enregistrerVente(vente: any): Promise<{ success: boolean; offline: boolean; error?: string }> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    const localId = genererLocalId();
    await saveVentePending(localId, vente);
    return { success: true, offline: true };
  }
  try {
    await createVente(vente);
    return { success: true, offline: false };
  } catch (e: any) {
    // Pas de statut HTTP exploitable = le serveur n'a jamais répondu (coupure, timeout) :
    // à ne jamais confondre avec une vraie erreur métier (stock, validation...), sous
    // peine de perdre le message d'erreur réel ou, à l'inverse, de mettre en file une
    // vente invalide qui échouera indéfiniment à la synchronisation.
    if (!e?.response?.status) {
      const localId = genererLocalId();
      await saveVentePending(localId, vente);
      return { success: true, offline: true };
    }
    return { success: false, offline: false, error: e.response?.data?.message || "Erreur lors de l'enregistrement de la vente" };
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

// ─── Dépenses offline ────────────────────────────────────────────────────────

export async function creerDepenseOffline(data: any): Promise<{ success: boolean; offline: boolean }> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    try {
      await createDepense(data);
      return { success: true, offline: false };
    } catch {
      const localId = genererLocalId();
      await saveDepensePending(localId, data);
      return { success: true, offline: true };
    }
  } else {
    const localId = genererLocalId();
    await saveDepensePending(localId, data);
    return { success: true, offline: true };
  }
}

export async function syncDepensesPending(): Promise<number> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return 0;
  let synced = 0;
  const pending = await getDepensesPending();
  for (const d of pending) {
    try {
      const { localId, ...data } = d;
      await createDepense(data);
      await marquerDepenseSynced(localId);
      synced++;
    } catch { }
  }
  return synced;
}

// ─── Clients offline ─────────────────────────────────────────────────────────

export async function creerClientOffline(data: any): Promise<{ success: boolean; offline: boolean }> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    try {
      await createClient(data);
      return { success: true, offline: false };
    } catch {
      const localId = genererLocalId();
      await saveClientPending(localId, data);
      return { success: true, offline: true };
    }
  } else {
    const localId = genererLocalId();
    await saveClientPending(localId, data);
    return { success: true, offline: true };
  }
}

export async function syncClientsPending(): Promise<number> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return 0;
  let synced = 0;
  const pending = await getClientsPending();
  for (const c of pending) {
    try {
      const { localId, ...data } = c;
      await createClient(data);
      await marquerClientPendingSynced(localId);
      synced++;
    } catch { }
  }
  return synced;
}

// ─── Commandes offline ───────────────────────────────────────────────────────

export async function creerCommandeOffline(data: any): Promise<{ success: boolean; offline: boolean }> {
  const state = await NetInfo.fetch();
  if (state.isConnected) {
    try {
      await createCommande(data);
      return { success: true, offline: false };
    } catch {
      const localId = genererLocalId();
      await saveCommandePending(localId, data);
      return { success: true, offline: true };
    }
  } else {
    const localId = genererLocalId();
    await saveCommandePending(localId, data);
    return { success: true, offline: true };
  }
}

export async function syncCommandesPending(): Promise<number> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return 0;
  let synced = 0;
  const pending = await getCommandesPending();
  for (const c of pending) {
    try {
      const { localId, ...data } = c;
      await createCommande(data);
      await marquerCommandePendingSynced(localId);
      synced++;
    } catch { }
  }
  return synced;
}

// ─── File d'attente générique ────────────────────────────────────────────────

export async function mettreEnFile(type: string, payload: any): Promise<string> {
  const id = genererLocalId();
  await saveOperation(id, type, payload);
  return id;
}

export async function executerOuMettreEnFile<T>(
  type: string,
  payload: any,
  apiFn: () => Promise<T>
): Promise<{ success: boolean; offline: boolean; result?: T }> {
  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      const result = await apiFn();
      return { success: true, offline: false, result };
    } catch {
      await mettreEnFile(type, payload);
      return { success: true, offline: true };
    }
  } else {
    await mettreEnFile(type, payload);
    return { success: true, offline: true };
  }
}

async function executerOperation(type: string, payload: any): Promise<void> {
  switch (type) {
    // Fournisseurs
    case 'fournisseur_create': await createFournisseur(payload); break;
    case 'fournisseur_update': await updateFournisseur(payload.id, payload.data); break;
    case 'achat_fournisseur': await creerAchatFournisseur(payload); break;
    case 'paiement_fournisseur': await payerFournisseur(payload); break;
    case 'bonus_fournisseur': await createBonusFournisseur(payload); break;
    // Mouvements stock
    case 'mouvement_entree': await ajouterMouvement({ ...payload, typeMouvement: 'ENTREE' }); break;
    case 'mouvement_sortie': await ajouterMouvement({ ...payload, typeMouvement: 'SORTIE' }); break;
    case 'mouvement_ajustement': await ajouterMouvement({ ...payload, typeMouvement: 'AJUSTEMENT' }); break;
    // Caisse
    case 'caisse_ouvrir': await ouvrirCaisse(payload); break;
    case 'caisse_fermer': await fermerCaisse(payload); break;
    case 'caisse_entree': await ajouterEntreeCaisse(payload); break;
    case 'caisse_sortie': await ajouterSortieCaisse(payload); break;
    // Crédits
    case 'credit_reglement': await reglerCreditCaisse(payload); break;
    case 'credit_commande_payer': await payerCreditCommande(payload.id, payload.montant); break;
    // Dépôts garde
    case 'depot_create': await createDepot(payload); break;
    case 'depot_retrait': await effectuerRetraitDepot(payload.id, payload.data); break;
    // Transferts
    case 'transfert_create': await createTransfert(payload); break;
    // Promotions
    case 'promotion_create': await createPromotion(payload); break;
    case 'promotion_update': await updatePromotion(payload.id, payload.data); break;
    // Commandes
    case 'commande_valider': await validerCommande(payload.id); break;
    case 'commande_annuler': await annulerCommande(payload.id, payload.utilisateurId); break;
    // Employés
    case 'employe_create': await createEmploye(payload); break;
    case 'employe_update': await updateEmploye(payload.id, payload.data); break;
    case 'employe_toggle': await toggleStatutEmploye(payload.id, payload.actif); break;
    case 'employe_delete': await deleteEmploye(payload.id); break;
    case 'paiement_employe': await createPaiementEmploye(payload.employeId, payload.data); break;
    // Dettes anciennes
    case 'dette_create': await createDetteAncienne(payload); break;
    case 'dette_delete': await deleteDetteAncienne(payload.id); break;
    case 'dette_reglement': await ajouterReglementDetteAncienne(payload.detteId, payload.data); break;
    // Comptes bancaires
    case 'compte_create': await createCompte(payload); break;
    case 'compte_update': await api.put(`/comptes/${payload.id}`, payload.data); break;
    case 'compte_delete': await deleteCompte(payload.id); break;
    case 'compte_versement': await versementCompte(payload.id, payload.data); break;
    case 'compte_retrait': await retraitCompte(payload.id, payload.data); break;
    // Objectifs fournisseurs
    case 'objectif_create': await createObjectifFournisseur(payload); break;
    case 'objectif_delete': await deleteObjectifFournisseur(payload.id); break;
    // Vendeurs
    case 'vendeur_create': await createVendeur(payload); break;
    case 'vendeur_update': await updateVendeur(payload.id, payload.data); break;
    case 'vendeur_toggle': await toggleStatutVendeur(payload.id, payload.actif); break;
    default: throw new Error(`Type opération inconnu: ${type}`);
  }
}

export async function syncOperationsPending(): Promise<number> {
  const net = await NetInfo.fetch();
  if (!net.isConnected) return 0;
  let synced = 0;
  const pending = await getOperationsPending();
  const echecsAnnoncer: { type: string }[] = [];
  for (const op of pending) {
    if (op.attempts >= 5) {
      // Abandon après 5 tentatives — ne JAMAIS échouer silencieusement :
      // on notifie une seule fois l'utilisateur (skill offline-first).
      if (!op.notifiedFailure) {
        echecsAnnoncer.push({ type: op.type });
        await marquerOperationEchecNotifie(op.id);
      }
      continue;
    }
    try {
      await executerOperation(op.type, op.payload);
      await markOperationSynced(op.id);
      synced++;
    } catch (e) {
      await incrementOperationAttempts(op.id, String(e));
    }
  }
  if (echecsAnnoncer.length > 0) {
    const detail = echecsAnnoncer.map(e => libelleOperation(e.type)).join(', ');
    const msg = echecsAnnoncer.length === 1
      ? `Une opération n'a pas pu être synchronisée après plusieurs tentatives (${detail}). Elle reste enregistrée localement — contactez le support si besoin.`
      : `${echecsAnnoncer.length} opérations n'ont pas pu être synchronisées après plusieurs tentatives (${detail}). Elles restent enregistrées localement — contactez le support si besoin.`;
    showToast(msg, 'error');
  }
  return synced;
}

export async function getNombreOperationsPending(): Promise<number> {
  return countOperationsPending();
}

// ─── Opérations bloquées (échec définitif) ──────────────────────────────────
// Permet à un écran (ex: Home, Notifications) d'afficher ce qui n'a jamais
// pu être synchronisé — jamais de perte silencieuse.
export async function getNombreOperationsBloquees(): Promise<number> {
  return countOperationsEchecDefinitif();
}

export async function getOperationsBloquees(): Promise<{ id: string; type: string; libelle: string; attempts: number; lastError?: string | null }[]> {
  const rows = await getOperationsEchecDefinitif();
  return rows.map(r => ({ ...r, libelle: libelleOperation(r.type) }));
}

// ─── Cache générique AsyncStorage ───────────────────────────────────────────

export async function sauvegarderCache(key: string, data: any): Promise<void> {
  try { await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(data)); } catch {}
}

export async function lireCache<T>(key: string): Promise<T[]> {
  try {
    const s = await AsyncStorage.getItem(`cache_${key}`);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

// ─── Auto-sync au retour de connexion ───────────────────────────────────────

export function demarrerAutoSync(onSync?: (n: number) => void): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const nVentes = await syncVentesPending();
      const nProduits = await syncProduitsPending();
      const nDepenses = await syncDepensesPending();
      const nClients = await syncClientsPending();
      const nCommandes = await syncCommandesPending();
      const nOperations = await syncOperationsPending();
      const total = nVentes + nProduits + nDepenses + nClients + nCommandes + nOperations;
      if (total > 0 && onSync) onSync(total);
    }
  });
  return unsubscribe;
}
