import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { Text, Card, Button, RadioButton, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

type Template = 'CLASSIQUE' | 'MODERNE' | 'MINIMALISTE';

const TEMPLATES: { value: Template; label: string; desc: string }[] = [
  { value: 'CLASSIQUE', label: 'Classique', desc: 'Style traditionnel avec tableau détaillé' },
  { value: 'MODERNE', label: 'Moderne', desc: 'Design épuré avec couleurs et logo' },
  { value: 'MINIMALISTE', label: 'Minimaliste', desc: 'Simple et rapide à lire' },
];

export default function FactureDesignScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const [template, setTemplate] = useState<Template>('CLASSIQUE');

  React.useEffect(() => {
    AsyncStorage.getItem('facture_template').then(t => { if (t) setTemplate(t as Template); });
  }, []);

  const sauvegarder = async () => {
    await AsyncStorage.setItem('facture_template', template);
  };

  const apercu = (t: Template) => {
    if (t === 'CLASSIQUE') return [
      '┌─────────────────────┐',
      '│   FACTURE #001       │',
      '│ Date: 21/06/2026     │',
      '├─────────────────────┤',
      '│ Produit  Qté  Total  │',
      '│ Sucre    2    1000   │',
      '│ Riz      1    500    │',
      '├─────────────────────┤',
      '│ TOTAL:   1500 FCFA   │',
      '└─────────────────────┘',
    ].join('\n');
    if (t === 'MODERNE') return [
      '══════════════════════',
      '    GES BOUTIQUE      ',
      '══════════════════════',
      '  Facture #001        ',
      '  21/06/2026          ',
      '──────────────────────',
      '  Sucre x2    1 000   ',
      '  Riz   x1      500   ',
      '──────────────────────',
      '  TOTAL     1 500 FCFA',
      '══════════════════════',
    ].join('\n');
    return [
      'Facture #001 — 21/06/2026',
      '',
      'Sucre ×2 ............. 1 000',
      'Riz   ×1 ............... 500',
      '',
      'Total ............. 1 500 F',
    ].join('\n');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.primary }]}>{tr('modele_facture', lang)}</Text>
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        Ce choix ne change que l'aperçu affiché ici dans l'app — le document PDF envoyé au client garde son propre format d'impression.
      </Text>

      {TEMPLATES.map(t => (
        <Card
          key={t.value}
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
            template === t.value && { borderColor: colors.primary, borderWidth: 2 },
          ]}
          onPress={() => setTemplate(t.value)}
        >
          <Card.Content>
            <View style={styles.row}>
              <RadioButton
                value={t.value}
                status={template === t.value ? 'checked' : 'unchecked'}
                onPress={() => setTemplate(t.value)}
                color={colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ color: template === t.value ? colors.primary : colors.text, fontWeight: template === t.value ? 'bold' : 'normal' }}>
                  {tr(t.value.toLowerCase(), lang)}
                </Text>
                <Text style={[styles.desc, { color: colors.textSecondary }]}>{t.desc}</Text>
              </View>
            </View>
            {template === t.value && (
              <View style={[styles.apercu, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[styles.apercuText, { color: colors.text }]}>{apercu(t.value)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      ))}

      <Button mode="contained" onPress={sauvegarder} style={styles.btn} buttonColor={colors.primary}>
        {tr('sauvegarder', lang)}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 4 },
  helper: { fontSize: 12, marginBottom: 14 },
  card: { marginBottom: 12, borderRadius: 16, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  desc: { fontSize: 12, marginTop: 2 },
  apercu: { padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1 },
  apercuText: { fontFamily: 'monospace', fontSize: 12 },
  btn: { marginTop: 8, borderRadius: 12 },
});
