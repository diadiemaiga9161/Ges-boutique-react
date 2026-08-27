import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getDevise(): Promise<string> {
  const raw = await AsyncStorage.getItem('boutique_info');
  if (raw) {
    const info = JSON.parse(raw);
    return info.devise || 'FCFA';
  }
  return 'FCFA';
}

// Séparateur de milliers "." (ex: 39.500 FCFA) — aligné sur Ionic
// (caisse.service.ts formatPrice) pour que les montants s'affichent à
// l'identique sur les 3 plateformes, pas "39 500" (espace) d'un côté et
// "39.500" (point) de l'autre pour la même somme.
export function formatMoney(value: number, devise = 'FCFA'): string {
  const n = Math.round(value || 0);
  const formatted = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${n < 0 ? '-' : ''}${formatted} ${devise}`;
}
