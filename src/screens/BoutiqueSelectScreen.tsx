import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BOUTIQUES_CONFIG } from '../services/api.service';

interface Props {
  onSelect: () => void;
}

export default function BoutiqueSelectScreen({ onSelect }: Props) {
  const choisir = async (b: typeof BOUTIQUES_CONFIG[0]) => {
    await AsyncStorage.setItem('api_url', b.url);
    await AsyncStorage.setItem('boutique_nom', b.nom);
    onSelect();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
        </View>
        <Text style={styles.title}>Ges Lafia</Text>
        <Text style={styles.sub}>Sélectionnez votre boutique</Text>
      </View>

      <FlatList
        data={BOUTIQUES_CONFIG}
        keyExtractor={b => String(b.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => choisir(item)} activeOpacity={0.85}>
            <View style={styles.cardLeft}>
              <View style={styles.cardIcon}>
                <Text style={styles.cardIconText}>{item.id}</Text>
              </View>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{item.nom}</Text>
              <Text style={styles.cardPort}>{item.url.replace('https://', '').replace('/api', '')}</Text>
            </View>
            <View style={styles.cardArrow}>
              <Text style={styles.arrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: {
    backgroundColor: '#081648',
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logoBox: {
    width: 90, height: 90, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
  },
  logoImg: { width: 68, height: 68, borderRadius: 14 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 6, letterSpacing: 0.5 },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  list: { padding: 20, paddingTop: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLeft: { marginRight: 14 },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E3F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconText: { color: '#1a56db', fontSize: 20, fontWeight: 'bold' },
  cardBody: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 3 },
  cardPort: { fontSize: 13, color: '#888' },
  cardArrow: { paddingLeft: 8 },
  arrow: { fontSize: 26, color: '#1a56db', fontWeight: 'bold' },
});
