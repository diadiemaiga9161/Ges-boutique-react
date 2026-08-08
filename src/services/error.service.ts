import { Alert } from 'react-native';

export function getErrorMessage(err: any): string {
  const code = err?.response?.data?.code;
  const status = err?.response?.status;

  if (!err?.response && err?.message?.includes('Network')) {
    return 'Pas de connexion internet — vos données locales restent disponibles';
  }

  const messages: Record<string, string> = {
    'WRONG_PASSWORD': 'Mot de passe incorrect',
    'USER_NOT_FOUND': "Ce compte n'existe pas",
    'INSUFFICIENT_STOCK': 'Stock insuffisant',
    'OPTIMISTIC_LOCK_CONFLICT': 'Le stock a été modifié simultanément — veuillez réessayer',
    'UNAUTHORIZED': 'Session expirée — veuillez vous reconnecter',
    'BOUTIQUE_NOT_FOUND': 'Boutique introuvable',
    'PRODUIT_NOT_FOUND': 'Produit introuvable',
    'VALIDATION_ERROR': err?.response?.data?.message || 'Données invalides',
    'CREDIT_ALREADY_SETTLED': 'Ce crédit est déjà réglé',
  };

  if (code && messages[code]) return messages[code];
  if (err?.response?.data?.message) return err.response.data.message;
  if (status === 401) return 'Session expirée — veuillez vous reconnecter';
  if (status === 403) return 'Accès refusé';
  if (status === 404) return 'Ressource introuvable';
  if (status >= 500) return 'Erreur serveur — veuillez réessayer dans quelques instants';
  return 'Une erreur est survenue — veuillez réessayer';
}

export function showError(err: any, title = 'Erreur'): void {
  Alert.alert(title, getErrorMessage(err), [{ text: 'OK' }]);
}

export function showSuccess(message: string, title = 'Succès'): void {
  Alert.alert(title, message, [{ text: 'OK' }]);
}
