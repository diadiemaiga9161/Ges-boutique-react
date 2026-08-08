import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../theme/colors';

interface Props {
  quantite: number;
  seuilAlerte?: number;
  label?: boolean;
}

export function StockBadge({ quantite, seuilAlerte = 5 }: Props) {
  const colors = useColors();
  const cle: 'ok' | 'bas' | 'rupture' =
    quantite <= 0 ? 'rupture' : quantite <= seuilAlerte ? 'bas' : 'ok';
  const c = cle === 'ok'
    ? { bg: colors.successBg, text: colors.success }
    : cle === 'bas'
    ? { bg: colors.warningBg, text: colors.warning }
    : { bg: colors.dangerBg, text: colors.danger };
  const texte =
    quantite <= 0 ? 'Rupture' :
    quantite <= seuilAlerte ? `${quantite} — Bas` :
    `${quantite}`;

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.texte, { color: c.text }]}>{texte}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  texte: { fontSize: 11, fontWeight: '600' },
});
