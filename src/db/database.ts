import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

const isWeb = Platform.OS === 'web';

export async function initDatabase(): Promise<void> {
  if (isWeb) return;
  db = await SQLite.openDatabaseAsync('ges_boutique.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ventes_pending (
      local_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS produits_cache (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS clients_cache (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS produits_pending (
      local_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS produits_updates_pending (
      local_id TEXT PRIMARY KEY,
      produit_id INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS depenses_pending (
      local_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS clients_pending (
      local_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS commandes_pending (
      local_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS operations_pending (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      last_error TEXT,
      notified_failure INTEGER DEFAULT 0
    );
  `);
  // Migration douce pour les installations existantes créées avant l'ajout
  // de la colonne notified_failure (SQLite ne supporte pas "ADD COLUMN IF
  // NOT EXISTS" sur toutes les versions embarquées par expo-sqlite).
  try {
    await db.execAsync('ALTER TABLE operations_pending ADD COLUMN notified_failure INTEGER DEFAULT 0;');
  } catch { /* colonne déjà existante : ignorer */ }
}

export async function saveVentePending(localId: string, vente: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO ventes_pending (local_id, data) VALUES (?, ?)',
    [localId, JSON.stringify(vente)]
  );
}

export async function getVentesPending(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ local_id: string; data: string }>(
    'SELECT * FROM ventes_pending WHERE synced = 0 ORDER BY created_at ASC'
  );
  return rows.map(r => ({ localId: r.local_id, ...JSON.parse(r.data) }));
}

export async function marquerVenteSynced(localId: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE ventes_pending SET synced = 1 WHERE local_id = ?', [localId]);
}

export async function cacheProduits(produits: any[]): Promise<void> {
  if (isWeb) return;
  await db.runAsync('DELETE FROM produits_cache', []);
  for (const p of produits) {
    await db.runAsync(
      'INSERT OR REPLACE INTO produits_cache (id, data) VALUES (?, ?)',
      [p.id, JSON.stringify(p)]
    );
  }
}

export async function getProduitsCache(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM produits_cache');
  return rows.map(r => JSON.parse(r.data));
}

export async function cacheClients(clients: any[]): Promise<void> {
  if (isWeb) return;
  await db.runAsync('DELETE FROM clients_cache', []);
  for (const c of clients) {
    await db.runAsync(
      'INSERT OR REPLACE INTO clients_cache (id, data) VALUES (?, ?)',
      [c.id, JSON.stringify(c)]
    );
  }
}

export async function getClientsCache(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ data: string }>('SELECT data FROM clients_cache');
  return rows.map(r => JSON.parse(r.data));
}

export function countVentesPending(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  return db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM ventes_pending WHERE synced = 0')
    .then(r => r?.count || 0);
}

// ─── Produits offline ────────────────────────────────────────────────────────

export async function saveProduitPending(localId: string, data: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO produits_pending (local_id, data) VALUES (?, ?)',
    [localId, JSON.stringify(data)]
  );
}

export async function getProduitsPending(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ local_id: string; data: string }>(
    'SELECT * FROM produits_pending WHERE synced = 0 ORDER BY created_at ASC'
  );
  return rows.map(r => ({ localId: r.local_id, ...JSON.parse(r.data) }));
}

export async function marquerProduitPendingSynced(localId: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE produits_pending SET synced = 1 WHERE local_id = ?', [localId]);
}

export async function saveProduitUpdatePending(localId: string, produitId: number, data: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO produits_updates_pending (local_id, produit_id, data) VALUES (?, ?, ?)',
    [localId, produitId, JSON.stringify(data)]
  );
}

export async function getProduitsUpdatesPending(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ local_id: string; produit_id: number; data: string }>(
    'SELECT * FROM produits_updates_pending WHERE synced = 0 ORDER BY created_at ASC'
  );
  return rows.map(r => ({ localId: r.local_id, produitId: r.produit_id, ...JSON.parse(r.data) }));
}

export async function marquerProduitUpdateSynced(localId: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE produits_updates_pending SET synced = 1 WHERE local_id = ?', [localId]);
}

export async function countProduitsPending(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  const r1 = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM produits_pending WHERE synced = 0');
  const r2 = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM produits_updates_pending WHERE synced = 0');
  return (r1?.count || 0) + (r2?.count || 0);
}

// ─── Dépenses offline ────────────────────────────────────────────────────────

export async function saveDepensePending(localId: string, data: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync('INSERT OR REPLACE INTO depenses_pending (local_id, data) VALUES (?, ?)', [localId, JSON.stringify(data)]);
}

export async function getDepensesPending(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ local_id: string; data: string }>('SELECT * FROM depenses_pending WHERE synced = 0 ORDER BY created_at ASC');
  return rows.map(r => ({ localId: r.local_id, ...JSON.parse(r.data) }));
}

export async function marquerDepenseSynced(localId: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE depenses_pending SET synced = 1 WHERE local_id = ?', [localId]);
}

export async function countDepensesPending(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  const r = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM depenses_pending WHERE synced = 0');
  return r?.count || 0;
}

// ─── Clients offline ─────────────────────────────────────────────────────────

export async function saveClientPending(localId: string, data: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync('INSERT OR REPLACE INTO clients_pending (local_id, data) VALUES (?, ?)', [localId, JSON.stringify(data)]);
}

export async function getClientsPending(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ local_id: string; data: string }>('SELECT * FROM clients_pending WHERE synced = 0 ORDER BY created_at ASC');
  return rows.map(r => ({ localId: r.local_id, ...JSON.parse(r.data) }));
}

export async function marquerClientPendingSynced(localId: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE clients_pending SET synced = 1 WHERE local_id = ?', [localId]);
}

export async function countClientsPending(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  const r = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM clients_pending WHERE synced = 0');
  return r?.count || 0;
}

// ─── Commandes offline ───────────────────────────────────────────────────────

export async function saveCommandePending(localId: string, data: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync('INSERT OR REPLACE INTO commandes_pending (local_id, data) VALUES (?, ?)', [localId, JSON.stringify(data)]);
}

export async function getCommandesPending(): Promise<any[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ local_id: string; data: string }>('SELECT * FROM commandes_pending WHERE synced = 0 ORDER BY created_at ASC');
  return rows.map(r => ({ localId: r.local_id, ...JSON.parse(r.data) }));
}

export async function marquerCommandePendingSynced(localId: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE commandes_pending SET synced = 1 WHERE local_id = ?', [localId]);
}

export async function countCommandesPending(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  const r = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM commandes_pending WHERE synced = 0');
  return r?.count || 0;
}

// ─── File d'attente générique (toutes opérations) ────────────────────────────

export async function saveOperation(id: string, type: string, payload: any): Promise<void> {
  if (isWeb) return;
  await db.runAsync(
    'INSERT OR REPLACE INTO operations_pending (id, type, payload) VALUES (?, ?, ?)',
    [id, type, JSON.stringify(payload)]
  );
}

export async function getOperationsPending(): Promise<{ id: string; type: string; payload: any; attempts: number; lastError?: string | null; notifiedFailure: boolean }[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ id: string; type: string; payload: string; attempts: number; last_error: string | null; notified_failure: number }>(
    'SELECT id, type, payload, attempts, last_error, notified_failure FROM operations_pending WHERE synced = 0 ORDER BY created_at ASC'
  );
  return rows.map(r => ({
    id: r.id,
    type: r.type,
    payload: JSON.parse(r.payload),
    attempts: r.attempts,
    lastError: r.last_error,
    notifiedFailure: r.notified_failure === 1,
  }));
}

export async function markOperationSynced(id: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE operations_pending SET synced = 1 WHERE id = ?', [id]);
}

export async function incrementOperationAttempts(id: string, error: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync(
    'UPDATE operations_pending SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    [error, id]
  );
}

export async function marquerOperationEchecNotifie(id: string): Promise<void> {
  if (isWeb) return;
  await db.runAsync('UPDATE operations_pending SET notified_failure = 1 WHERE id = ?', [id]);
}

export async function countOperationsPending(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  const r = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM operations_pending WHERE synced = 0');
  return r?.count || 0;
}

// Opérations abandonnées définitivement après 5 tentatives (jamais
// synchronisées) — permet d'afficher/consulter ce qui est resté bloqué,
// conformément à la règle "jamais d'échec silencieux".
export async function getOperationsEchecDefinitif(): Promise<{ id: string; type: string; attempts: number; lastError?: string | null }[]> {
  if (isWeb) return [];
  const rows = await db.getAllAsync<{ id: string; type: string; attempts: number; last_error: string | null }>(
    'SELECT id, type, attempts, last_error FROM operations_pending WHERE synced = 0 AND attempts >= 5 ORDER BY created_at ASC'
  );
  return rows.map(r => ({ id: r.id, type: r.type, attempts: r.attempts, lastError: r.last_error }));
}

export async function countOperationsEchecDefinitif(): Promise<number> {
  if (isWeb) return Promise.resolve(0);
  const r = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM operations_pending WHERE synced = 0 AND attempts >= 5'
  );
  return r?.count || 0;
}
