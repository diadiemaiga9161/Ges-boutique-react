// Impression de reçu (ticket de caisse) sur imprimante thermique Bluetooth
// (58/80mm), très répandue et bon marché en Afrique.
//
// IMPORTANT — Bluetooth CLASSIQUE (RFCOMM/SPP), PAS Bluetooth Low Energy (BLE) :
// la quasi-totalité des imprimantes thermiques bon marché utilisent le profil
// SPP du Bluetooth classique, pas le BLE. On utilise donc la librairie
// `react-native-bluetooth-classic` (kenjdavidson), qui encapsule
// BluetoothAdapter/BluetoothSocket côté Android (External Accessory côté iOS,
// non ciblé/non testé ici — voir README du projet).
//
// Bibliothèques écartées (recherche faite avant intégration, voir rapport) :
// - `react-native-thermal-receipt-printer` (et son fork `-image-qr`) : malgré
//   le nom, ne supporte QUE USB / BLE / réseau — PAS le Bluetooth classique.
// - `react-native-bluetooth-escpos-printer` : supporte bien le Bluetooth
//   classique mais n'a plus été publié depuis 2019 (abandonné).
// - `react-native-esc-pos-printer` : lié au SDK propriétaire Epson ePOS,
//   pensé pour les imprimantes de la marque Epson, pas pour les clones
//   génériques ESC/POS vendus en Afrique.
// `react-native-bluetooth-classic` est activement maintenue (plusieurs
// publications en 2025), autolinking RN standard, permissions Android déjà
// déclarées dans son propre AndroidManifest.xml (mergées automatiquement au
// build Gradle). Le formatage ESC/POS (texte, alignement, gras, coupe papier)
// est fait à la main ci-dessous : c'est un format simple et bien documenté,
// pas besoin d'une librairie de formatage supplémentaire (moins de dépendances
// à faire fonctionner sur du matériel qu'on ne peut pas tester).
//
// ⚠️ AUCUNE IMPRESSION RÉELLE N'A ÉTÉ TESTÉE SUR MATÉRIEL PHYSIQUE — voir le
// rapport de la tâche pour la liste complète de ce qui reste à vérifier par
// l'utilisateur final avec une vraie imprimante.
import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import statique : ne fait jamais planter le bundler/l'app même si le module
// natif n'est pas (encore) lié — seuls les appels réels vers le pont natif
// peuvent échouer, et ils sont systématiquement encapsulés dans des
// try/catch ci-dessous qui retombent sur ImpressionError('MODULE_INDISPONIBLE', ...).
import RNBluetoothClassic from 'react-native-bluetooth-classic';

// ─── Stockage local (mémorisation du dernier choix, comme demandé) ─────────
const CLE_ADRESSE = 'imprimante_bluetooth_adresse';
const CLE_NOM = 'imprimante_bluetooth_nom';
const CLE_LARGEUR = 'imprimante_largeur_papier'; // '32' (58mm) ou '48' (80mm)

export interface ImprimanteBluetooth {
  address: string;
  name: string;
}

export type LargeurPapier = 32 | 48;

export interface LigneTicket {
  nom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal?: number;
}

export interface TicketVente {
  boutiqueNom: string;
  boutiqueAdresse?: string;
  boutiqueTelephone?: string;
  numeroVente: string;
  date: Date;
  vendeurNom?: string;
  clientNom?: string;
  lignes: LigneTicket[];
  montantTotal: number;
  montantRemise?: number;
  modePaiement?: string;
}

export type CodeErreurImpression =
  | 'MODULE_INDISPONIBLE'
  | 'BLUETOOTH_INDISPONIBLE'
  | 'BLUETOOTH_DESACTIVE'
  | 'PERMISSION_REFUSEE'
  | 'AUCUNE_IMPRIMANTE_MEMORISEE'
  | 'AUCUNE_IMPRIMANTE_APPAIREE'
  | 'CONNEXION_ECHOUEE'
  | 'ECRITURE_ECHOUEE';

export class ImpressionError extends Error {
  code: CodeErreurImpression;
  constructor(code: CodeErreurImpression, message: string) {
    super(message);
    this.code = code;
  }
}

// ─── Permissions Android ────────────────────────────────────────────────────
// BLUETOOTH_CONNECT n'est requis (au runtime) qu'à partir d'Android 12
// (API 31) — voir AndroidManifest de react-native-bluetooth-classic qui
// déclare déjà ce runtime permission avec minSdkVersion="31".
async function demanderPermissionBluetooth(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const version = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
  if (!Number.isFinite(version) || version < 31) return true;
  try {
    const resultat = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: 'Autorisation Bluetooth',
        message: "Ges Boutique a besoin d'accéder au Bluetooth pour imprimer le reçu sur votre imprimante.",
        buttonPositive: 'Autoriser',
        buttonNegative: 'Refuser',
      }
    );
    return resultat === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function moduleNatifDisponible(): boolean {
  // Le paquet JS est toujours "require-able" (présent dans node_modules dès
  // qu'on a fait `npm install`), même si le module natif n'est pas encore
  // lié (build pas encore reconstruit) — dans ce cas les méthodes du module
  // lèvent une exception à l'appel, jamais à l'import. On ne peut donc pas
  // détecter l'indisponibilité ici de façon fiable : chaque appel natif est
  // encapsulé dans un try/catch plus bas qui retombe sur MODULE_INDISPONIBLE.
  return Platform.OS === 'android' && !!RNBluetoothClassic;
}

// ─── Sélection / mémorisation de l'imprimante ───────────────────────────────
export async function getImprimanteMemorisee(): Promise<ImprimanteBluetooth | null> {
  try {
    const address = await AsyncStorage.getItem(CLE_ADRESSE);
    const name = await AsyncStorage.getItem(CLE_NOM);
    if (!address) return null;
    return { address, name: name || address };
  } catch {
    return null;
  }
}

export async function memoriserImprimante(imp: ImprimanteBluetooth): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_ADRESSE, imp.address);
    await AsyncStorage.setItem(CLE_NOM, imp.name || imp.address);
  } catch {
    // Pas bloquant : au pire, l'utilisateur devra resélectionner l'imprimante
    // à la prochaine impression.
  }
}

export async function oublierImprimanteMemorisee(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([CLE_ADRESSE, CLE_NOM]);
  } catch { /* ignore */ }
}

export async function getLargeurPapier(): Promise<LargeurPapier> {
  try {
    const v = await AsyncStorage.getItem(CLE_LARGEUR);
    return v === '48' ? 48 : 32;
  } catch {
    return 32;
  }
}

export async function setLargeurPapier(largeur: LargeurPapier): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_LARGEUR, String(largeur));
  } catch { /* ignore */ }
}

// ─── Découverte des imprimantes déjà appairées ──────────────────────────────
// Ne gère PAS l'appairage initial (voir consigne) : l'utilisateur doit avoir
// déjà appairé son imprimante depuis les réglages Bluetooth du téléphone.
export async function listerImprimantesAppairees(): Promise<ImprimanteBluetooth[]> {
  if (!moduleNatifDisponible()) {
    throw new ImpressionError('MODULE_INDISPONIBLE', "Impression indisponible sur cette version de l'application (module Bluetooth non installé).");
  }
  let dispo = false;
  try {
    dispo = await RNBluetoothClassic.isBluetoothAvailable();
  } catch {
    throw new ImpressionError('MODULE_INDISPONIBLE', "Impression indisponible sur cette version de l'application.");
  }
  if (!dispo) {
    throw new ImpressionError('BLUETOOTH_INDISPONIBLE', "Cet appareil ne dispose pas de Bluetooth.");
  }
  const permissionOk = await demanderPermissionBluetooth();
  if (!permissionOk) {
    throw new ImpressionError('PERMISSION_REFUSEE', "Autorisation Bluetooth refusée.");
  }
  let actif = false;
  try {
    actif = await RNBluetoothClassic.isBluetoothEnabled();
  } catch {
    throw new ImpressionError('MODULE_INDISPONIBLE', "Impression indisponible sur cette version de l'application.");
  }
  if (!actif) {
    throw new ImpressionError('BLUETOOTH_DESACTIVE', "Le Bluetooth est désactivé. Activez-le puis réessayez.");
  }
  try {
    const appareils = await RNBluetoothClassic.getBondedDevices();
    const liste = (appareils || []).map((d: any) => ({ address: d.address, name: d.name || d.address }));
    if (liste.length === 0) {
      throw new ImpressionError('AUCUNE_IMPRIMANTE_APPAIREE', "Aucune imprimante Bluetooth appairée. Appairez d'abord votre imprimante dans les réglages Bluetooth du téléphone.");
    }
    return liste;
  } catch (e: any) {
    if (e instanceof ImpressionError) throw e;
    throw new ImpressionError('MODULE_INDISPONIBLE', "Impossible de lister les appareils Bluetooth appairés.");
  }
}

export function ouvrirReglagesBluetooth(): void {
  try {
    if (moduleNatifDisponible()) RNBluetoothClassic.openBluetoothSettings();
  } catch { /* ignore */ }
}

// ─── Connexion à une imprimante (réutilise la connexion existante si déjà
// connectée) ─────────────────────────────────────────────────────────────────
async function connecterImprimante(address: string): Promise<any> {
  let dejaConnecte = false;
  try {
    dejaConnecte = await RNBluetoothClassic.isDeviceConnected(address);
  } catch { /* on tentera une connexion normale ci-dessous */ }

  if (dejaConnecte) {
    try {
      return await RNBluetoothClassic.getConnectedDevice(address);
    } catch { /* on retente une connexion fraîche ci-dessous */ }
  }

  // Beaucoup de clones d'imprimantes ESC/POS bon marché n'acceptent que les
  // sockets RFCOMM "non sécurisés" (pas de couplage chiffré) — décision prise
  // sans pouvoir la tester sur du vrai matériel : on tente d'abord la
  // connexion par défaut (sécurisée), puis on retente en mode non sécurisé
  // avant d'abandonner. Voir rapport : NON VÉRIFIÉ sur imprimante physique.
  try {
    return await RNBluetoothClassic.connectToDevice(address);
  } catch {
    try {
      return await RNBluetoothClassic.connectToDevice(address, { secureSocket: false });
    } catch {
      throw new ImpressionError('CONNEXION_ECHOUEE', "Connexion à l'imprimante impossible. Vérifiez qu'elle est allumée, chargée et à proximité.");
    }
  }
}

// ─── Construction de la commande ESC/POS ────────────────────────────────────
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const DOUBLE_ON = GS + '!' + '\x11';
const DOUBLE_OFF = GS + '!' + '\x00';
const COUPE_PAPIER = GS + 'V' + '\x00';
const LF = '\n';

// Les imprimantes bon marché ont des supports de jeux de caractères (codepage)
// très variables et impossibles à deviner/tester ici : par sécurité, on retire
// les accents et on remplace tout caractère non-ASCII restant, pour éviter un
// ticket illisible (mojibake) plutôt que de parier sur une codepage précise.
// Autre raison technique : le séparateur de milliers de `toLocaleString`
// (espace insécable, hors ASCII) serait lui aussi transformé en "?" — d'où le
// formatage manuel du montant ci-dessous plutôt qu'un appel à toLocaleString.
function normaliserTexte(texte: string): string {
  return (texte || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x00-\x7E]/g, '?');
}

function formatMontantTicket(valeur: number): string {
  const entier = Math.round(valeur || 0);
  const avecEspaces = Math.abs(entier).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (entier < 0 ? '-' : '') + avecEspaces + ' F';
}

function decouperLignes(texte: string, largeur: number): string[] {
  const propre = normaliserTexte(texte).trim();
  if (!propre) return [''];
  const mots = propre.split(/\s+/);
  const lignes: string[] = [];
  let courante = '';
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length > largeur) {
      if (courante) lignes.push(courante);
      courante = mot.length > largeur ? mot.slice(0, largeur) : mot;
    } else {
      courante = essai;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

function ligneColonnes(gauche: string, droite: string, largeur: number): string {
  const g = normaliserTexte(gauche);
  const d = normaliserTexte(droite);
  const espaces = Math.max(1, largeur - g.length - d.length);
  if (g.length + 1 + d.length > largeur) {
    // Ne coupe jamais brutalement le montant : le libellé passe à la ligne.
    return g + LF + ' '.repeat(Math.max(0, largeur - d.length)) + d;
  }
  return g + ' '.repeat(espaces) + d;
}

const LABEL_MODE_PAIEMENT: Record<string, string> = {
  ESPECES: 'Especes', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
  WAVE_MONEY: 'Wave Money', CARTE_BANCAIRE: 'Carte bancaire', VIREMENT: 'Virement',
};

export function construireCommandeEscPos(ticket: TicketVente, largeur: LargeurPapier): string {
  const sep = '-'.repeat(largeur);
  const parts: string[] = [INIT];

  parts.push(ALIGN_CENTER + BOLD_ON + DOUBLE_ON);
  for (const l of decouperLignes(ticket.boutiqueNom || 'Ges Boutique', largeur)) parts.push(l + LF);
  parts.push(DOUBLE_OFF + BOLD_OFF);
  if (ticket.boutiqueAdresse) {
    for (const l of decouperLignes(ticket.boutiqueAdresse, largeur)) parts.push(l + LF);
  }
  if (ticket.boutiqueTelephone) parts.push(normaliserTexte(`Tel: ${ticket.boutiqueTelephone}`) + LF);

  parts.push(ALIGN_LEFT + sep + LF);
  parts.push(normaliserTexte(`Vente : ${ticket.numeroVente}`) + LF);
  parts.push(normaliserTexte(`Date  : ${ticket.date.toLocaleDateString('fr-FR')} ${ticket.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`) + LF);
  if (ticket.vendeurNom) parts.push(normaliserTexte(`Vendeur : ${ticket.vendeurNom}`) + LF);
  if (ticket.clientNom) parts.push(normaliserTexte(`Client : ${ticket.clientNom}`) + LF);
  parts.push(sep + LF);

  for (const ligne of ticket.lignes) {
    const sousTotal = ligne.sousTotal ?? ligne.quantite * ligne.prixUnitaire;
    for (const l of decouperLignes(ligne.nom, largeur)) parts.push(l + LF);
    parts.push(ligneColonnes(`  ${ligne.quantite} x ${formatMontantTicket(ligne.prixUnitaire)}`, formatMontantTicket(sousTotal), largeur) + LF);
  }
  parts.push(sep + LF);

  if (ticket.montantRemise && ticket.montantRemise > 0) {
    parts.push(ligneColonnes('Remise', '-' + formatMontantTicket(ticket.montantRemise), largeur) + LF);
  }
  parts.push(BOLD_ON + DOUBLE_ON);
  parts.push(ligneColonnes('TOTAL', formatMontantTicket(ticket.montantTotal), largeur) + LF);
  parts.push(DOUBLE_OFF + BOLD_OFF);

  if (ticket.modePaiement) {
    const label = LABEL_MODE_PAIEMENT[ticket.modePaiement] || ticket.modePaiement;
    parts.push(ligneColonnes('Paiement', normaliserTexte(label), largeur) + LF);
  }

  parts.push(LF + ALIGN_CENTER + 'Merci pour votre achat !' + LF);
  parts.push(LF + LF + LF);
  parts.push(COUPE_PAPIER);

  return parts.join('');
}

// ─── Impression ──────────────────────────────────────────────────────────────
// Tente d'imprimer sur l'imprimante fournie (ou mémorisée à défaut). Ne
// gère jamais l'appairage initial ni le choix d'imprimante ici : c'est à
// l'appelant (UI) d'ouvrir le sélecteur si `AUCUNE_IMPRIMANTE_MEMORISEE` est
// levée, puis de rappeler cette fonction avec l'imprimante choisie.
export async function imprimerTicket(ticket: TicketVente, imprimante?: ImprimanteBluetooth): Promise<void> {
  if (!moduleNatifDisponible()) {
    throw new ImpressionError('MODULE_INDISPONIBLE', "Impression indisponible sur cette version de l'application (module Bluetooth non installé).");
  }
  const cible = imprimante || await getImprimanteMemorisee();
  if (!cible) {
    throw new ImpressionError('AUCUNE_IMPRIMANTE_MEMORISEE', 'Aucune imprimante sélectionnée.');
  }

  const permissionOk = await demanderPermissionBluetooth();
  if (!permissionOk) {
    throw new ImpressionError('PERMISSION_REFUSEE', 'Autorisation Bluetooth refusée.');
  }

  const device = await connecterImprimante(cible.address);

  const largeur = await getLargeurPapier();
  const commande = construireCommandeEscPos(ticket, largeur);

  try {
    // Chaque caractère de `commande` correspond directement à un octet
    // 0-255 (voir normaliserTexte + commandes ESC/POS ci-dessus, toutes < 128)
    // — l'encodage 'latin1' transmet donc les octets tels quels, sans
    // réinterprétation UTF-8.
    const ok = await device.write(commande, 'latin1');
    if (!ok) throw new Error('write() a renvoyé false');
  } catch {
    throw new ImpressionError('ECRITURE_ECHOUEE', "Échec de l'envoi du reçu à l'imprimante.");
  }

  // On mémorise l'imprimante utilisée avec succès pour la prochaine fois.
  await memoriserImprimante(cible);
}
