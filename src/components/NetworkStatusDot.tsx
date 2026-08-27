import React from 'react';
import { View } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/** Petit point de statut réseau dans le coin du header — remplace les
 *  bandeaux "Mode hors ligne" pleine largeur qui étaient dupliqués sur
 *  chaque écran. Vert = connecté, orange = hors ligne. Aucun texte, aucune
 *  carte : juste le signe, comme demandé. */
export default function NetworkStatusDot() {
  const isOnline = useNetworkStatus();
  return (
    <View
      accessible
      accessibilityLabel={isOnline ? 'Connecté' : 'Hors ligne'}
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 14,
        backgroundColor: isOnline ? '#22c55e' : '#f97316',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
      }}
    />
  );
}
