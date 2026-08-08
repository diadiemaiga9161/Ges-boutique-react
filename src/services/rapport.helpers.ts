// Port direct de la logique de calcul client-side de rapport.service.ts (Ionic).
// Les rapports jour/semaine/mois/personnalisé sont calculés ici à partir des
// ventes brutes (/ventes/periode), PAS via des endpoints backend dédiés — voir
// la note dans api.service.ts (getRapportJour/Semaine/Mois n'existent pas côté
// serveur). Garder ces fonctions synchronisées avec rapport.service.ts si la
// logique métier change côté Ionic.

export interface VenteRapport {
  montantTotal?: number;
  montantRemiseTotal?: number;
  modePaiement?: string;
  dateVente?: string;
  produits?: { produitNom?: string; quantite?: number; sousTotal?: number }[];
  lignes?: { produitNom?: string; quantite?: number; sousTotal?: number }[];
}

export interface TopProduit {
  nom: string;
  quantite: number;
  chiffreAffaire: number;
}

export interface ModePaiementStat {
  mode: string;
  montant: number;
  pourcentage: number;
}

export function formaterDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function totalVentes(ventes: VenteRapport[]): number {
  return ventes.reduce((sum, v) => sum + Number(v.montantTotal || 0), 0);
}

export function totalRemises(ventes: VenteRapport[]): number {
  return ventes.reduce((sum, v) => sum + Number(v.montantRemiseTotal || 0), 0);
}

export function calculerTopProduits(ventes: VenteRapport[]): TopProduit[] {
  const map = new Map<string, { quantite: number; chiffreAffaire: number }>();
  for (const vente of ventes) {
    const lignes = vente.produits || vente.lignes || [];
    for (const ligne of lignes) {
      const key = ligne.produitNom || 'Produit';
      const current = map.get(key) || { quantite: 0, chiffreAffaire: 0 };
      current.quantite += Number(ligne.quantite || 0);
      current.chiffreAffaire += Number(ligne.sousTotal || 0);
      map.set(key, current);
    }
  }
  return Array.from(map.entries())
    .map(([nom, data]) => ({ nom, ...data }))
    .sort((a, b) => b.quantite - a.quantite);
}

export function calcModePaiementStats(ventes: VenteRapport[]): ModePaiementStat[] {
  const total = totalVentes(ventes);
  const map = new Map<string, number>();
  ventes.forEach(v => {
    const mode = v.modePaiement || 'ESPECES';
    map.set(mode, (map.get(mode) || 0) + Number(v.montantTotal || 0));
  });
  return Array.from(map.entries()).map(([mode, montant]) => ({
    mode, montant, pourcentage: total > 0 ? (montant / total) * 100 : 0,
  }));
}

export const MODE_PAIEMENT_LABELS: Record<string, string> = {
  ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
  WAVE_MONEY: 'Wave', CARTE_BANCAIRE: 'Carte bancaire', VIREMENT: 'Virement',
};

export function getModePaiementLabel(mode: string): string {
  return MODE_PAIEMENT_LABELS[mode] || mode;
}

export const MODE_PAIEMENT_ICONS: Record<string, string> = {
  ESPECES: 'cash', ORANGE_MONEY: 'cellphone', MOOV_MONEY: 'cellphone',
  WAVE_MONEY: 'cellphone', CARTE_BANCAIRE: 'credit-card-outline', VIREMENT: 'bank-transfer',
};

export interface RapportCalcule {
  titre: string;
  dateDebut: string;
  dateFin: string;
  chiffreAffaireTotal: number;
  nombreVentes: number;
  montantRemisesTotal: number;
  topProduits: TopProduit[];
  modePaiementStats: ModePaiementStat[];
}

/** Calcule un rapport (CA, ventes, remises, top produits, modes paiement) sur
 *  une période — utilisé pour jour / semaine / mois / personnalisé, comme
 *  genererRapportJournalier/Hebdomadaire/Mensuel/Periodique côté Ionic. */
export function calculerRapport(ventes: VenteRapport[], titre: string, dateDebut: string, dateFin: string): RapportCalcule {
  return {
    titre,
    dateDebut,
    dateFin,
    chiffreAffaireTotal: totalVentes(ventes),
    nombreVentes: ventes.length,
    montantRemisesTotal: totalRemises(ventes),
    topProduits: calculerTopProduits(ventes).slice(0, 8),
    modePaiementStats: calcModePaiementStats(ventes),
  };
}
