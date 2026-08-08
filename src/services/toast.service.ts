// Notification "toast" discrète, non bloquante, affichée au niveau racine de
// l'app (voir App.tsx) — reste visible même si l'écran d'origine est
// démonté juste après (ex : login réussi qui enchaîne sur la navigation).
//
// Pattern calqué sur le callback global déjà utilisé pour la déconnexion
// automatique 401 (setOnAuthError / _onAuthError dans api.service.ts).

export type ToastType = 'info' | 'warning' | 'error' | 'success';

export interface ToastPayload {
  message: string;
  type: ToastType;
}

type ToastListener = (payload: ToastPayload) => void;

let _listener: ToastListener | null = null;

export function setToastListener(cb: ToastListener | null): void {
  _listener = cb;
}

export function showToast(message: string, type: ToastType = 'info'): void {
  if (_listener) {
    _listener({ message, type });
  } else {
    // Aucun listener monté (ex: avant le premier rendu) — jamais d'échec silencieux
    console.warn(`[toast:${type}]`, message);
  }
}
