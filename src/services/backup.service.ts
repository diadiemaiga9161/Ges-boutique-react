import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getListeSauvegardes, declencherSauvegarde, restaurerSauvegarde, getBackendRootUrl, getStoredToken } from './api.service';

/**
 * Service "Sauvegarde automatique programmée" (ADMIN uniquement) — liste les
 * sauvegardes SQL déjà générées côté serveur (rotation automatique), permet
 * d'en déclencher une nouvelle à la demande (mysqldump exécuté de façon
 * SYNCHRONE côté serveur, peut prendre plusieurs secondes) et de
 * télécharger/partager un fichier existant.
 *
 * Réutilise EXACTEMENT le mécanisme déjà en place pour l'export de données
 * (voir ExportDonneesScreen.tsx / invoice.service.ts) : expo-file-system —
 * nouvelle API File/Paths (l'ancienne writeAsStringAsync/EncodingType est
 * dépréciée en SDK 56, cf. commentaire dans ExportDonneesScreen.exporterExcel)
 * — + expo-sharing pour proposer le partage du fichier une fois écrit.
 *
 * Contrairement à getListe()/declencher() (qui passent par l'instance axios
 * `api`, dont l'intercepteur injecte automatiquement le header Authorization),
 * telecharger() appelle directement File.downloadFileAsync : il faut donc
 * joindre le token JWT manuellement, l'endpoint n'étant PAS public (ADMIN,
 * Authorization Bearer requis).
 */

export interface BackupInfo {
  nomFichier: string;
  /** LocalDateTime ISO backend, sans suffixe Z (ex: "2026-08-27T03:00:00"). */
  dateCreation: string;
  tailleOctets: number;
}

export interface ListeSauvegardesResponse {
  success: boolean;
  sauvegardes: BackupInfo[];
  nombre: number;
}

export interface DeclencherSauvegardeSuccess {
  success: true;
  message: string;
  nomFichier: string;
  tailleOctets: number;
  dateCreation: string;
}

export interface DeclencherSauvegardeEchec {
  success: false;
  message: string;
}

export type DeclencherSauvegardeResponse = DeclencherSauvegardeSuccess | DeclencherSauvegardeEchec;

export interface TelechargerSauvegardeResultat {
  success: boolean;
  message?: string;
}

export interface RestaurerSauvegardeSuccess {
  success: true;
  message: string;
}

export interface RestaurerSauvegardeEchec {
  success: false;
  message: string;
}

export type RestaurerSauvegardeResponse = RestaurerSauvegardeSuccess | RestaurerSauvegardeEchec;

// ─── Liste des sauvegardes ──────────────────────────────────────────────────
// Le tri (plus récent → plus ancien) est garanti côté backend — aucun tri
// supplémentaire à faire ici. Peut lever une exception réseau normale
// (à catcher côté écran, comme les autres appels de l'appli).
export async function getListe(): Promise<ListeSauvegardesResponse> {
  const res = await getListeSauvegardes();
  return res.data;
}

// ─── Déclenchement d'une sauvegarde à la demande ───────────────────────────
// Le backend répond en HTTP 500 (pas 200) en cas d'échec de mysqldump — axios
// rejette alors la promesse. On normalise ici pour TOUJOURS renvoyer un objet
// typé { success, message, ... }, jamais une exception à catcher côté écran :
// l'appelant peut se contenter de tester `resultat.success`.
export async function declencher(): Promise<DeclencherSauvegardeResponse> {
  try {
    const res = await declencherSauvegarde();
    return res.data;
  } catch (e: any) {
    if (e?.response?.data && typeof e.response.data.success !== 'undefined') {
      return e.response.data as DeclencherSauvegardeEchec;
    }
    return {
      success: false,
      message: e?.message || 'Erreur réseau : impossible de contacter le serveur.',
    };
  }
}

// ─── Téléchargement + partage d'une sauvegarde existante ───────────────────
export async function telecharger(nomFichier: string): Promise<TelechargerSauvegardeResultat> {
  try {
    const token = await getStoredToken();
    const url = `${getBackendRootUrl()}/api/backup/telecharger/${encodeURIComponent(nomFichier)}`;
    const destination = new File(Paths.cache, nomFichier);

    const fichier = await File.downloadFileAsync(url, destination, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      idempotent: true,
    });

    const dispo = await Sharing.isAvailableAsync();
    if (!dispo) {
      return { success: false, message: "Le partage de fichiers n'est pas disponible sur cet appareil." };
    }
    await Sharing.shareAsync(fichier.uri, {
      mimeType: 'application/gzip',
      dialogTitle: nomFichier,
    });
    return { success: true };
  } catch (e: any) {
    // 404 (fichier disparu, ex: rotation) / 400 (nom invalide) remontent ici
    // sous forme de message contenant le code HTTP (voir File.downloadFileAsync).
    return { success: false, message: e?.message || 'Impossible de télécharger cette sauvegarde.' };
  }
}

// ─── Restauration depuis une sauvegarde existante (réservé au super admin) ─
// Le backend répond en HTTP 400 (pas 200) en cas d'échec — axios rejette alors
// la promesse. On normalise ici pour TOUJOURS renvoyer un objet typé
// { success, message }, jamais une exception à catcher côté écran.
export async function restaurer(nomFichier: string): Promise<RestaurerSauvegardeResponse> {
  try {
    const res = await restaurerSauvegarde(nomFichier);
    return res.data;
  } catch (e: any) {
    if (e?.response?.data && typeof e.response.data.success !== 'undefined') {
      return e.response.data as RestaurerSauvegardeEchec;
    }
    return {
      success: false,
      message: e?.message || 'Erreur réseau : impossible de contacter le serveur.',
    };
  }
}
