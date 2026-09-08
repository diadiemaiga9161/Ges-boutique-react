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
  createObjectifVendeur, updateObjectifVendeur, deleteObjectifVendeur,
  createVendeur, updateVendeur, toggleStatutVendeur,
  updateBoutique, annulerVente, modifierLignesVente, effectuerRetourVente,
} from './api.service';
import {
  getVentesPending, marquerVenteSynced, saveVentePending, countVentesPending, incrementVenteAttempts,
  saveProduitPending, getProduitsPending, marquerProduitPendingSynced, incrementProduitAttempts,
  saveProduitUpdatePending, getProduitsUpdatesPending, marquerProduitUpdateSynced, incrementProduitUpdateAttempts,
  countProduitsPending,
  saveDepensePending, getDepensesPending, marquerDepenseSynced, incrementDepenseAttempts,
  saveClientPending, getClientsPending, marquerClientPendingSynced, incrementClientAttempts,
  saveCommandePending, getCommandesPending, marquerCommandePendingSynced, incrementCommandeAttempts,
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
  objectif_vendeur_create: 'Création prime vendeur', objectif_vendeur_update: 'Modification prime vendeur',
  objectif_vendeur_delete: 'Suppression prime vendeur',
  vendeur_create: 'Création vendeur', vendeur_update: 'Modification vendeur', vendeur_toggle: 'Statut vendeur',
  boutique_update: 'Paramètres boutique',
  transfert_partenaire_create: 'Création boutique partenaire', transfert_partenaire_update: 'Modification boutique partenaire',
  vente_annuler: 'Annulation vente', vente_modifier: 'Modification vente', vente_retour: 'Retour articles vente',
};

function libelleOperation(type: string): string {
  return LABELS_OPERATION[type] || type;
}

let syncInProgress = false;
// Garde globale distincte de syncInProgress (propre à syncVentesPending) —
// protège tout le cycle demarrerAutoSync (ventes+produits+depenses+clients+
// commandes+operations) contre deux événements NetInfo rapprochés qui
// lanceraient deux synchronisations en parallèle.
let autoSyncInProgress = false;

export function genererLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Extrait le code d'erreur structuré du backend UNIQUEMENT si status===409
// ET errorCode==='OPTIMISTIC_LOCK_CONFLICT' — jamais pour un autre 409 (ex.
// DATA_INTEGRITY_VIOLATION), qui doit continuer à suivre le comportement
// générique. Retourne undefined pour toute autre erreur (réseau, 400, etc.).
function extraireConflitStock(e: any): string | undefined {
  return e?.response?.status === 409 && e?.response?.data?.errorCode === 'OPTIMISTIC_LOCK_CONFLICT'
    ? e.response.data.errorCode
    : undefined;
}

// ─── Ventes ─────────────────────────────────────────────────────────────────

export async function enregistrerVente(vente: any): Promise<{ success: boolean; offline: boolean; error?: string; venteId?: number }> {
  // Généré une seule fois, avant le tout premier envoi, et réutilisé pour la
  // mise en file / tous les rejeux — c'est ce même identifiant qui est envoyé
  // en X-Client-Request-ID, y compris sur cette première tentative : si elle
  // aboutit côté serveur mais que la réponse se perd, le rejeu ultérieur avec
  // ce même identifiant sera reconnu comme un doublon par le backend au lieu
  // de recréer la vente.
  const clientRequestId = genererLocalId();
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    await saveVentePending(clientRequestId, vente);
    return { success: true, offline: true };
  }
  try {
    // venteId extrait de la réponse ({success, message, vente:{id,...}} — voir
    // VenteController.creerVente) uniquement pour permettre au débit des points
    // fidélité (POST /fidelite/clients/{id}/utiliser) de rattacher le mouvement
    // à cette vente — ne change rien au comportement existant des autres
    // appelants, qui ignorent déjà ce champ optionnel.
    const res = await createVente(vente, clientRequestId);
    const venteCree = res.data?.vente || res.data?.data || res.data;
    return { success: true, offline: false, venteId: venteCree?.id };
  } catch (e: any) {
    // Pas de statut HTTP exploitable = le serveur n'a jamais répondu (coupure, timeout) :
    // à ne jamais confondre avec une vraie erreur métier (stock, validation...), sous
    // peine de perdre le message d'erreur réel ou, à l'inverse, de mettre en file une
    // vente invalide qui échouera indéfiniment à la synchronisation.
    if (!e?.response?.status) {
      await saveVentePending(clientRequestId, vente);
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
      if (vente.attempts >= 5) continue;
      try {
        const { localId, attempts, lastError, errorCode, ...data } = vente;
        await createVente(data, localId);
        await marquerVenteSynced(localId);
        synced++;
      } catch (e) {
        // Comportement inchangé : un conflit de stock est simplement
        // enregistré (error_code), le plafond de 5 tentatives existant
        // reste la seule limite — un rejeu de vente est un delta auto-
        // protégé (StockInsuffisantException si besoin), pas dangereux.
        await incrementVenteAttempts(vente.localId, String(e), extraireConflitStock(e));
      }
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

  // Sync nouvelles créations — comportement inchangé : une création n'a pas
  // de risque d'écrasement (il n'existe pas encore de ligne à corrompre), un
  // conflit de stock est simplement enregistré, le plafond de 5 reste seul.
  const pendingCreate = await getProduitsPending();
  for (const p of pendingCreate) {
    if (p.attempts >= 5) continue;
    try {
      const { localId, attempts, lastError, errorCode, ...data } = p;
      await createProduit(data);
      await marquerProduitPendingSynced(localId);
      synced++;
    } catch (e) {
      await incrementProduitAttempts(p.localId, String(e), extraireConflitStock(e));
    }
  }

  // Sync modifications — la requête transporte une quantité ABSOLUE
  // (ProduitServiceImpl.modifierProduit écrase produit.quantite sans
  // condition) : rejouer une modification restée périmée après un conflit
  // écraserait silencieusement un stock modifié entre-temps. En cas de
  // OPTIMISTIC_LOCK_CONFLICT, on bloque donc immédiatement (attempts=5) au
  // lieu de laisser le mécanisme de retry normal la rejouer.
  const pendingUpdate = await getProduitsUpdatesPending();
  for (const p of pendingUpdate) {
    if (p.attempts >= 5) continue;
    try {
      const { localId, produitId, attempts, lastError, errorCode, ...data } = p;
      await updateProduit(produitId, data);
      await marquerProduitUpdateSynced(localId);
      synced++;
    } catch (e) {
      const conflitStock = extraireConflitStock(e);
      await incrementProduitUpdateAttempts(p.localId, String(e), conflitStock, !!conflitStock);
    }
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
    if (d.attempts >= 5) continue;
    try {
      const { localId, attempts, lastError, errorCode, ...data } = d;
      await createDepense(data);
      await marquerDepenseSynced(localId);
      synced++;
    } catch (e) {
      await incrementDepenseAttempts(d.localId, String(e), extraireConflitStock(e));
    }
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
    if (c.attempts >= 5) continue;
    try {
      const { localId, attempts, lastError, errorCode, ...data } = c;
      await createClient(data);
      await marquerClientPendingSynced(localId);
      synced++;
    } catch (e) {
      await incrementClientAttempts(c.localId, String(e), extraireConflitStock(e));
    }
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
    if (c.attempts >= 5) continue;
    try {
      const { localId, attempts, lastError, errorCode, ...data } = c;
      await createCommande(data);
      await marquerCommandePendingSynced(localId);
      synced++;
    } catch (e) {
      await incrementCommandeAttempts(c.localId, String(e), extraireConflitStock(e));
    }
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
    case 'commande_valider': await validerCommande(payload.id, payload.body); break;
    case 'commande_annuler': await annulerCommande(payload.id, payload.utilisateurId); break;
    // Employés
    case 'employe_create': await createEmploye(payload); break;
    case 'employe_update': await updateEmploye(payload.id, payload.data); break;
    case 'employe_toggle': await toggleStatutEmploye(payload.id, payload.actif); break;
    case 'employe_delete': await deleteEmploye(payload.id); break;
    case 'paiement_employe': await createPaiementEmploye(payload); break;
    // Dettes anciennes
    case 'dette_create': await createDetteAncienne(payload); break;
    case 'dette_delete': await deleteDetteAncienne(payload.id); break;
    case 'dette_reglement': await ajouterReglementDetteAncienne(payload); break;
    // Comptes bancaires
    case 'compte_create': await createCompte(payload); break;
    case 'compte_update': await api.put(`/comptes/${payload.id}`, payload.data); break;
    case 'compte_delete': await deleteCompte(payload.id); break;
    case 'compte_versement': await versementCompte(payload); break;
    case 'compte_retrait': await retraitCompte(payload); break;
    // Objectifs fournisseurs
    case 'objectif_create': await createObjectifFournisseur(payload); break;
    case 'objectif_delete': await deleteObjectifFournisseur(payload.id); break;
    // Objectifs vendeurs (primes hebdomadaires)
    case 'objectif_vendeur_create': await createObjectifVendeur(payload); break;
    case 'objectif_vendeur_update': await updateObjectifVendeur(payload.id, payload.data); break;
    case 'objectif_vendeur_delete': await deleteObjectifVendeur(payload.id); break;
    // Vendeurs
    case 'vendeur_create': await createVendeur(payload); break;
    case 'vendeur_update': await updateVendeur(payload.id, payload.data); break;
    case 'vendeur_toggle': await toggleStatutVendeur(payload.id, payload.actif); break;
    // Boutique
    case 'boutique_update': await updateBoutique(payload); break;
    // Boutiques partenaires (transferts)
    case 'transfert_partenaire_create': await api.post('/transferts/partenaires', payload); break;
    case 'transfert_partenaire_update': await api.put(`/transferts/partenaires/${payload.id}`, payload.data); break;
    // Modification / annulation / retour sur une vente déjà synchronisée.
    // Risque de conflit assumé (skill offline-first) : le serveur reste
    // l'arbitre final au rejeu ; en cas d'échec, l'opération n'est jamais
    // perdue silencieusement (voir syncOperationsPending / attempts).
    case 'vente_annuler': await annulerVente(payload.venteId, payload.motif, payload.estCredit, payload.utilisateurId); break;
    case 'vente_modifier': await modifierLignesVente(payload.venteId, payload.data); break;
    case 'vente_retour': await effectuerRetourVente(payload); break;
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
      const conflitStock = extraireConflitStock(e);
      // Un ajustement de stock transporte une quantité ABSOLUE (voir
      // ajusterStock côté backend, qui recalcule un delta contre l'état
      // courant à chaque tentative) : rejouer un ajustement resté périmé
      // après un conflit de verrouillage optimiste écraserait silencieusement
      // un stock modifié entre-temps. On bloque donc immédiatement (passage
      // direct à 5 tentatives, comme un abandon normal — la notification
      // existante à l'utilisateur se déclenche naturellement au prochain
      // cycle via le mécanisme déjà en place ci-dessus) au lieu de laisser
      // les 5 tentatives normales rejouer la même donnée dangereuse. Tous
      // les autres types (dont les autres opérations de stock — entrée,
      // sortie, retour, achat — qui appliquent un delta auto-protégé et
      // sûr à rejouer) suivent le plafond normal, inchangé.
      const bloquerImmediatement = op.type === 'mouvement_ajustement' && !!conflitStock;
      await incrementOperationAttempts(op.id, String(e), conflitStock, bloquerImmediatement);
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
// Filet de secours hors-ligne (affiche la dernière liste connue si l'API ne
// répond pas) — jamais la file de synchro (ventes/produits/etc. en attente,
// stockée à part en SQLite, jamais touchée ici). Sans limite d'âge, une valeur
// mise en cache avant une mise à jour de l'appli pouvait rester affichée
// indéfiniment après (RN n'a pas d'équivalent au popup "nouvelle version" web
// d'Angular/Ionic pour la déclencher) — 1h aligné sur le maxAge déjà utilisé
// pour /api/produits côté service worker Angular.
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

export async function sauvegarderCache(key: string, data: any): Promise<void> {
  try { await AsyncStorage.setItem(`cache_${key}`, JSON.stringify({ data, savedAt: Date.now() })); } catch {}
}

export async function lireCache<T>(key: string): Promise<T[]> {
  try {
    const s = await AsyncStorage.getItem(`cache_${key}`);
    if (!s) return [];
    const parsed = JSON.parse(s);
    // Anciennes entrées (avant ce correctif) : tableau brut sans savedAt —
    // traitées comme périmées plutôt que de planter sur un format inattendu.
    if (!parsed || typeof parsed !== 'object' || !('savedAt' in parsed)) return [];
    if (Date.now() - parsed.savedAt > CACHE_MAX_AGE_MS) return [];
    return parsed.data ?? [];
  } catch { return []; }
}

// ─── Auto-sync au retour de connexion ───────────────────────────────────────

export function demarrerAutoSync(onSync?: (n: number) => void): () => void {
  const unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      // Synchronisation déjà en cours (événement NetInfo rapproché) : on
      // ignore proprement ce second déclenchement plutôt que de lancer un
      // cycle de sync en parallèle.
      if (autoSyncInProgress) return;
      autoSyncInProgress = true;
      try {
        const nVentes = await syncVentesPending();
        const nProduits = await syncProduitsPending();
        const nDepenses = await syncDepensesPending();
        const nClients = await syncClientsPending();
        const nCommandes = await syncCommandesPending();
        const nOperations = await syncOperationsPending();
        const total = nVentes + nProduits + nDepenses + nClients + nCommandes + nOperations;
        if (total > 0 && onSync) onSync(total);
      } finally {
        autoSyncInProgress = false;
      }
    }
  });
  return unsubscribe;
}
