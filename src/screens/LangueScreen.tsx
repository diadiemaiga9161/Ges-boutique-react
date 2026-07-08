import React from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, List, Divider } from 'react-native-paper';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const LANGUES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'wo', label: 'Wolof', flag: '🌍' },
  { code: 'bm', label: 'Bambara', flag: '🌍' },
  { code: 'ff', label: 'Fula', flag: '🌍' },
  { code: 'sw', label: 'Kiswahili', flag: '🌍' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

export default function LangueScreen({ navigation }: any) {
  const { lang, setLang } = useLang();

  const choisir = async (code: string) => {
    await setLang(code);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.headerTitle}>{tr('choisir_langue', lang)}</Text>
        <Text style={styles.headerSub}>{tr('selectionner_langue', lang)}</Text>
      </View>
      <FlatList
        data={LANGUES}
        keyExtractor={l => l.code}
        contentContainerStyle={{ padding: 12 }}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={({ item }) => (
          <List.Item
            title={`${item.flag}  ${item.label}`}
            titleStyle={[styles.langLabel, item.code === lang && styles.langActive]}
            right={() => item.code === lang ? <List.Icon icon="check-circle" color="#1a56db" /> : null}
            style={[styles.item, item.code === lang && styles.itemActive]}
            onPress={() => choisir(item.code)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a56db', padding: 24, alignItems: 'center' },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 13 },
  item: { backgroundColor: '#fff', paddingVertical: 4 },
  itemActive: { backgroundColor: '#e3f2fd' },
  langLabel: { fontSize: 16 },
  langActive: { color: '#1a56db', fontWeight: 'bold' },
});
