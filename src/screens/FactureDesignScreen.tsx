import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { Text, Card, Button, RadioButton, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Template = 'CLASSIQUE' | 'MODERNE' | 'MINIMALISTE';

const TEMPLATES: { value: Template; label: string; desc: string }[] = [
  { value: 'CLASSIQUE', label: 'Classique', desc: 'Style traditionnel avec tableau détaillé' },
  { value: 'MODERNE', label: 'Moderne', desc: 'Design épuré avec couleurs et logo' },
  { value: 'MINIMALISTE', label: 'Minimaliste', desc: 'Simple et rapide à lire' },
];

export default function FactureDesignScreen() {
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleMedium" style={styles.sectionTitle}>Choisir le modèle de facture</Text>

      {TEMPLATES.map(t => (
        <Card
          key={t.value}
          style={[styles.card, template === t.value && styles.cardActive]}
          onPress={() => setTemplate(t.value)}
        >
          <Card.Content>
            <View style={styles.row}>
              <RadioButton
                value={t.value}
                status={template === t.value ? 'checked' : 'unchecked'}
                onPress={() => setTemplate(t.value)}
              />
              <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={template === t.value ? styles.activeLabel : {}}>{t.label}</Text>
                <Text style={styles.desc}>{t.desc}</Text>
              </View>
            </View>
            {template === t.value && (
              <View style={styles.apercu}>
                <Text style={styles.apercuText}>{apercu(t.value)}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      ))}

      <Button mode="contained" onPress={sauvegarder} style={styles.btn}>
        Enregistrer le modèle
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  sectionTitle: { fontWeight: 'bold', color: '#1976D2', marginBottom: 12 },
  card: { marginBottom: 12, borderRadius: 12 },
  cardActive: { borderWidth: 2, borderColor: '#1976D2' },
  row: { flexDirection: 'row', alignItems: 'center' },
  activeLabel: { color: '#1976D2', fontWeight: 'bold' },
  desc: { color: '#666', fontSize: 12, marginTop: 2 },
  apercu: { backgroundColor: '#f8f8f8', padding: 12, borderRadius: 8, marginTop: 12 },
  apercuText: { fontFamily: 'monospace', fontSize: 12, color: '#333' },
  btn: { marginTop: 8, borderRadius: 8 },
});
