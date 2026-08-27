import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { showToast } from '../services/toast.service';

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

  // Comme sur Ionic (langue.page.ts → selectLanguage) : on change la langue,
  // on affiche une confirmation, et on RESTE sur l'écran (pas de retour auto)
  // pour laisser l'utilisateur comparer/changer d'avis.
  const choisir = async (code: string, label: string, flag: string) => {
    if (code === lang) return;
    await setLang(code);
    showToast(`${flag} ${label}`, 'success');
  };

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🌍</Text>
        <Text style={styles.heroTitle}>{tr('choisir_langue', lang)}</Text>
        <Text style={styles.heroSub}>{tr('selectionner_langue', lang)}</Text>
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
              style={[styles.card, active && styles.cardActive]}
              onPress={() => choisir(item.code, item.label, item.flag)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardFlag}>{item.flag}</Text>
              <Text style={[styles.cardName, active && styles.cardNameActive]}>{item.label}</Text>
              {active && (
                <View style={styles.cardCheck}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#16a34a" />
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
  container: { flex: 1, backgroundColor: '#f0f4f8' },

  hero: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  heroIcon: { fontSize: 40, marginBottom: 8 },
  heroTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  heroSub: { fontSize: 13, color: '#64748b', marginTop: 4 },

  grid: { paddingHorizontal: 12, paddingBottom: 20 },
  gridRow: { gap: 12 },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1.5, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center', paddingVertical: 22, marginBottom: 12, position: 'relative',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  cardActive: { borderColor: '#1a56db', backgroundColor: '#eff6ff' },
  cardFlag: { fontSize: 32, marginBottom: 8 },
  cardName: { fontSize: 14, fontWeight: '600', color: '#334155' },
  cardNameActive: { color: '#1a56db', fontWeight: 'bold' },
  cardCheck: { position: 'absolute', top: 8, right: 8 },
});
