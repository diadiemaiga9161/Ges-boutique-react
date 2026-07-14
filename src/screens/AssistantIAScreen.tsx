import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/*
 * Assistant IA temporairement désactivé — bientôt disponible.
 * Le code complet est conservé ci-dessous en commentaire.
 */

export default function AssistantIAScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <MaterialCommunityIcons name="robot-outline" size={72} color="#93c5fd" />
        <Text style={styles.title}>Assistant IA</Text>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="clock-outline" size={14} color="#1e40af" />
          <Text style={styles.badgeTxt}>Bientôt disponible</Text>
        </View>
        <Text style={styles.sub}>
          L'assistant intelligent pour votre boutique arrive très prochainement.{'\n'}
          Il vous aidera à analyser vos ventes, gérer vos stocks et répondre à toutes vos questions.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#081648', alignItems: 'center', justifyContent: 'center', padding: 32 },
  hero: { alignItems: 'center', gap: 16 },
  title: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginTop: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#dbeafe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  badgeTxt: { color: '#1e40af', fontWeight: '700', fontSize: 13 },
  sub: { color: '#93c5fd', fontSize: 14, textAlign: 'center', lineHeight: 22, marginTop: 8 },
});

/*
// ── CODE COMPLET DE L'ASSISTANT (désactivé temporairement) ──────────────────
//
// import React, { useState, useRef } from 'react';
// import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
// import { Text, TextInput, IconButton, Card, ActivityIndicator } from 'react-native-paper';
// import api from '../services/api.service';
// import { useLang } from '../i18n/LangContext';
// import { tr } from '../i18n';
//
// interface Message {
//   id: string;
//   role: 'user' | 'assistant';
//   content: string;
// }
//
// export default function AssistantIAScreen() {
//   ... (code original conservé ici)
// }
*/
