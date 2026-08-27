import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** État réseau partagé par toute l'app — une seule source de vérité pour le
 *  point de statut du header (vert = connecté, orange = hors ligne), au lieu
 *  d'un bandeau "Mode hors ligne" dupliqué sur chaque écran. */
export function useNetworkStatus(): boolean {
  // Optimiste par défaut (true) : évite un flash orange au montage avant la
  // première réponse de NetInfo.
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    NetInfo.fetch().then(state => setIsOnline(state.isConnected !== false));
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  return isOnline;
}
