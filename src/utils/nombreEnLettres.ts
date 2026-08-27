// Convertisseur nombre entier -> texte en toutes lettres françaises.
// Écrit spécifiquement pour ce projet React Native (aucune dépendance
// partagée avec le code Angular ou Ionic). Fonction pure, sans effet de
// bord, sans appel réseau — utilisée pour l'annonce vocale du montant total
// d'une vente (voir services/vocalConfirmation.service.ts).
//
// Règles orthographiques respectées :
// - "quatre-vingts" perd son "s" s'il est suivi d'un autre nombre
//   (81 = "quatre-vingt-un", 80 = "quatre-vingts").
// - "cent" prend un "s" uniquement s'il est multiplié par un nombre exact
//   ET n'est suivi d'aucun autre nombre (200 = "deux cents",
//   201 = "deux cent un", 750 = "sept cent cinquante").
//   "cent" reste invariable devant "mille"/"million"/"milliard"
//   (ex: 200 000 = "deux cent mille").
// - "mille" est invariable (jamais de "s").
// - "million"/"milliard" se comportent comme des noms comptables normaux :
//   ils prennent un "s" au pluriel, qu'ils soient suivis d'autre chose ou non.
// - "vingt et un", "trente et un", ... utilisent "et", ainsi que
//   "soixante et onze" (71) — mais jamais "quatre-vingt-un" ni
//   "quatre-vingt-onze".

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
];

const DIZAINES_SIMPLES: Record<number, string> = {
  2: 'vingt',
  3: 'trente',
  4: 'quarante',
  5: 'cinquante',
  6: 'soixante',
};

// Convertit un nombre de 0 à 99. `pluralisable` indique si ce groupe de deux
// chiffres constitue bien la toute fin du nombre complet (aucun autre mot ne
// suit) — seul cas où "quatre-vingts" garde son "s".
function convertirDizaine(n: number, pluralisable: boolean): string {
  if (n < 20) return UNITES[n];

  const unite = n % 10;

  if (n < 70) {
    const base = DIZAINES_SIMPLES[Math.floor(n / 10)];
    if (unite === 0) return base;
    if (unite === 1) return `${base} et un`;
    return `${base}-${UNITES[unite]}`;
  }

  if (n < 80) {
    // 70-79 : soixante-dix, soixante et onze, soixante-douze, ...
    const reste = n - 60; // 10..19
    if (reste === 11) return 'soixante et onze';
    return `soixante-${UNITES[reste]}`;
  }

  // 80-99 : quatre-vingt(s), quatre-vingt-un (jamais "et"), quatre-vingt-onze (jamais "et")
  const reste = n - 80; // 0..19
  if (reste === 0) return pluralisable ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${UNITES[reste]}`;
}

// Convertit un nombre de 1 à 999. `pluralisable` indique si ce groupe de
// trois chiffres constitue la toute fin du nombre complet (aucun "mille",
// "million" ou "milliard" ni aucun autre chiffre ne suit) — seul cas où
// "cent" peut prendre son "s".
function convertirTrois(n: number, pluralisable: boolean): string {
  const centaine = Math.floor(n / 100);
  const reste = n % 100;
  const mots: string[] = [];

  if (centaine > 0) {
    if (centaine > 1) mots.push(UNITES[centaine]);
    const centMot = centaine > 1 && reste === 0 && pluralisable ? 'cents' : 'cent';
    mots.push(centMot);
  }

  if (reste > 0) {
    mots.push(convertirDizaine(reste, pluralisable));
  }

  return mots.join(' ');
}

/**
 * Convertit un entier (montant en francs CFA, sans décimales) en toutes
 * lettres françaises. Ex: 15500 -> "quinze mille cinq cents".
 */
export function nombreEnLettres(valeur: number): string {
  if (!Number.isFinite(valeur)) return '';

  const negatif = valeur < 0;
  let reste = Math.trunc(Math.abs(valeur));

  if (reste === 0) return 'zéro';

  const milliards = Math.floor(reste / 1_000_000_000);
  reste %= 1_000_000_000;
  const millions = Math.floor(reste / 1_000_000);
  reste %= 1_000_000;
  const milliers = Math.floor(reste / 1_000);
  reste %= 1_000;
  const unites = reste;

  const groupes: string[] = [];

  if (milliards > 0) {
    groupes.push(milliards === 1 ? 'un milliard' : `${convertirTrois(milliards, false)} milliards`);
  }
  if (millions > 0) {
    groupes.push(millions === 1 ? 'un million' : `${convertirTrois(millions, false)} millions`);
  }
  if (milliers > 0) {
    groupes.push(milliers === 1 ? 'mille' : `${convertirTrois(milliers, false)} mille`);
  }
  if (unites > 0 || groupes.length === 0) {
    groupes.push(convertirTrois(unites, true));
  }

  return `${negatif ? 'moins ' : ''}${groupes.join(' ')}`;
}
