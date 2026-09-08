import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { showToast } from '../services/toast.service';
import { useColors } from '../theme/colors';

// Les 8 langues gérées par le dictionnaire i18n RN (src/i18n/index.ts) — liste
// différente de celle d'Ionic (qui a es/ha au lieu de ff/sw), conservée telle
// quelle : changer la liste sans retraduire laisserait des clés manquantes.
const LANGUES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'wo', label: 'Wolof', flag: '🇸🇳' },
  { code: 'bm', label: 'Bambara', flag: '🇲🇱' },
  { code: 'ff', label: 'Fula', flag: '🌍' },
  { code: 'sw', label: 'Kiswahili', flag: '🇰🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

export default function LangueScreen() {
  const { lang, setLang } = useLang();
  const colors = useColors();

  // Comme sur Ionic (langue.page.ts → selectLanguage) : on change la langue,
  // on affiche une confirmation, et on RESTE sur l'écran (pas de retour auto)
  // pour laisser l'utilisateur comparer/changer d'avis.
  const choisir = async (code: string, label: string, flag: string) => {
    if (code === lang) return;
    await setLang(code);
    showToast(`${flag} ${label}`, 'success');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🌍</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{tr('choisir_langue', lang)}</Text>
        <Text style={[styles.heroSub, { color: colors.textSecondary }]}>{tr('selectionner_langue', lang)}</Text>
      </View>

      <FlatList
        data={LANGUES}
        keyExtractor={l => l.code}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          const active = item.code === lang;
          return (
            <TouchableOpacity
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
                active && { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
              ]}
              onPress={() => choisir(item.code, item.label, item.flag)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardFlag}>{item.flag}</Text>
              <Text style={[styles.cardName, { color: colors.text }, active && { color: colors.primary, fontWeight: 'bold' }]}>{item.label}</Text>
              {active && (
                <View style={styles.cardCheck}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  hero: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  heroIcon: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 18, fontWeight: 'bold' },
  heroSub: { fontSize: 13, marginTop: 4 },

  grid: { paddingHorizontal: 12, paddingBottom: 20 },
  gridRow: { gap: 12 },
  card: {
    flex: 1, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', paddingVertical: 22, marginBottom: 12, position: 'relative',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardFlag: { fontSize: 32, marginBottom: 8 },
  cardName: { fontSize: 14, fontWeight: '600' },
  cardCheck: { position: 'absolute', top: 8, right: 8 },
});
