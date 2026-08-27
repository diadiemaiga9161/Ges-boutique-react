// Confirmation vocale du montant total après validation d'une vente.
//
// Scope strictement limité au flux de vente/caisse (voir VenteScreen.tsx).
// - 100% offline : utilise uniquement expo-speech (moteur TTS natif du
//   device), aucun service payant, aucun appel réseau.
// - Fonctionnalité optionnelle, activée par défaut (clé AsyncStorage absente
//   => considérée comme activée), réglable depuis "Mon profil".
// - "Fire and forget" : ne doit jamais bloquer ni faire échouer la
//   validation de vente. Toute erreur (TTS indisponible, plateforme non
//   supportée, etc.) est avalée silencieusement, jamais remontée à l'UI.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { nombreEnLettres } from '../utils/nombreEnLettres';

export const CONFIRMATION_VOCALE_KEY = 'feat_confirmation_vocale_montant';

// Absence de clé (première installation / anciens utilisateurs) = activé,
// conformément à la demande du client (activé par défaut).
export async function isConfirmationVocaleActivee(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(CONFIRMATION_VOCALE_KEY);
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}

export async function setConfirmationVocaleActivee(active: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CONFIRMATION_VOCALE_KEY, String(active));
  } catch {
    // Pas de blocage UI si l'écriture échoue — le réglage sera juste relu au défaut la prochaine fois.
  }
}

// Annonce à voix haute le montant total d'une vente qui vient d'être validée
// avec succès. Ne doit jamais lever d'exception : appelée en "fire and
// forget" juste après le popup de succès, sans attendre sa résolution.
export async function annoncerMontantVente(montant: number): Promise<void> {
  try {
    const active = await isConfirmationVocaleActivee();
    if (!active) return;
    if (!Number.isFinite(montant)) return;

    const texte = `Total : ${nombreEnLettres(Math.round(montant))} francs`;
    Speech.speak(texte, { language: 'fr-FR' });
  } catch {
    // Aucune coupure de la vente si la voix échoue ou n'est pas disponible.
  }
}
