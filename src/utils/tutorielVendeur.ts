import AsyncStorage from '@react-native-async-storage/async-storage';

// Feature "Tutoriel d'accueil vendeur" — purement local (AsyncStorage), aucun
// appel réseau. Une clé par utilisateur (userId) : tant qu'elle n'existe pas,
// le tutoriel n'a jamais été vu sur cet appareil pour ce compte.
export function tutorielVendeurKey(userId: number | string): string {
  return `tutoriel_vendeur_vu_${userId}`;
}

export async function aDejaVuTutorielVendeur(userId: number | string): Promise<boolean> {
  const v = await AsyncStorage.getItem(tutorielVendeurKey(userId));
  return v === 'true';
}

export async function marquerTutorielVendeurVu(userId: number | string): Promise<void> {
  await AsyncStorage.setItem(tutorielVendeurKey(userId), 'true');
}
