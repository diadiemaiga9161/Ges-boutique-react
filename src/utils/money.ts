import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getDevise(): Promise<string> {
  const raw = await AsyncStorage.getItem('boutique_info');
  if (raw) {
    const info = JSON.parse(raw);
    return info.devise || 'FCFA';
  }
  return 'FCFA';
}

export function formatMoney(value: number, devise = 'FCFA'): string {
  return `${(value || 0).toLocaleString('fr-FR')} ${devise}`;
}
