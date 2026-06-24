import React, { useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, List, Divider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'wo', label: 'Wolof', flag: '🇸🇳' },
  { code: 'bm', label: 'Bambara', flag: '🇲🇱' },
  { code: 'ff', label: 'Fulfulde', flag: '🌍' },
  { code: 'ha', label: 'Haoussa', flag: '🌍' },
  { code: 'sw', label: 'Swahili', flag: '🌍' },
];

export default function LangueScreen({ navigation }: any) {
  const [langueActive, setLangueActive] = useState('fr');

  React.useEffect(() => {
    AsyncStorage.getItem('langue').then(l => { if (l) setLangueActive(l); });
  }, []);

  const choisirLangue = async (code: string) => {
    await AsyncStorage.setItem('langue', code);
    setLangueActive(code);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={styles.headerTitle}>Choisir la langue</Text>
        <Text style={styles.headerSub}>Sélectionnez votre langue préférée</Text>
      </View>
      <FlatList
        data={LANGUES}
        keyExtractor={l => l.code}
        contentContainerStyle={{ padding: 12 }}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={({ item }) => (
          <List.Item
            title={`${item.flag}  ${item.label}`}
            titleStyle={[styles.langLabel, item.code === langueActive && styles.langActive]}
            right={() => item.code === langueActive
              ? <List.Icon icon="check-circle" color="#1a56db" />
              : null
            }
            style={[styles.item, item.code === langueActive && styles.itemActive]}
            onPress={() => choisirLangue(item.code)}
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
