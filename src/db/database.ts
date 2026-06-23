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
  `);
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
