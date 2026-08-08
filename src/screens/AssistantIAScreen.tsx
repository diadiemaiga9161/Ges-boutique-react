import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getQuestionsPredefiniesIA, envoyerQuestionIA } from '../services/api.service';

const BLUE = '#1a56db';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  texte: string;
  heure: string;
}

interface QuestionPredefinie {
  id: string;
  label: string;
  icone: string;
}

const QUESTIONS_TEXTE: Record<string, string> = {
  ventes_jour: "J'ai vendu combien aujourd'hui ?",
  comptant_credit: 'Quelle est la différence entre mes ventes comptant et crédit ce mois ?',
  mobile_money: 'Quel est le total de mes paiements Orange Money et Moov Money ?',
  credits_dus: 'Quels clients ont encore des dettes non réglées ?',
  stock_faible: 'Quels produits sont en alerte de stock ?',
  conseils: 'Donne-moi des conseils pour améliorer ma gestion de boutique.',
  augmenter_benefices: 'Fais-moi des propositions concrètes pour augmenter mes bénéfices.',
  produits_rentables: 'Quels sont mes produits les plus rentables ce mois-ci ?',
  bilan_semaine: 'Quel est mon bilan pour cette semaine ?',
  bilan_mois: 'Quel est mon bilan pour ce mois ?',
  sorties_stock: 'Combien de sorties de stock ce mois-ci ?',
  ventes_annulees: 'Combien de ventes annulées ce mois-ci ?',
  stock_produits: "Montre-moi l'état de mon stock de produits.",
  rapport_complet: 'Fais-moi un rapport complet de ma boutique.',
  comment_ca_marche: 'Comment fonctionne Ges Boutique ?',
  ventes_vendeur: 'Qui a fait les ventes ?',
};

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  'cart-outline': 'cart-outline',
  'stats-chart-outline': 'stats-chart-outline',
  'phone-portrait-outline': 'phone-portrait-outline',
  'people-outline': 'people-outline',
  'warning-outline': 'warning-outline',
  'bulb-outline': 'bulb-outline',
  'rocket-outline': 'rocket-outline',
  'ribbon-outline': 'ribbon-outline',
  'calendar-outline': 'calendar-outline',
  'trending-up-outline': 'trending-up-outline',
  'arrow-up-circle-outline': 'arrow-up-circle-outline',
  'close-circle-outline': 'close-circle-outline',
  'cube-outline': 'cube-outline',
  'document-text-outline': 'document-text-outline',
  'help-circle-outline': 'help-circle-outline',
  'person-outline': 'person-outline',
};

function heureActuelle(): string {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function AssistantIAScreen() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      texte:
        "Bonjour ! Je suis votre assistant de gestion. Posez-moi une question sur votre boutique ou choisissez parmi les suggestions ci-dessous. 😊",
      heure: heureActuelle(),
    },
  ]);
  const [questions, setQuestions] = useState<QuestionPredefinie[]>([]);
  const [texteLibre, setTexteLibre] = useState('');
  const [loading, setLoading] = useState(false);
  const [afficherQuestions, setAfficherQuestions] = useState(true);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    getQuestionsPredefiniesIA()
      .then(res => setQuestions(res.data || []))
      .catch(() => setQuestions([]));
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const envoyerQuestion = (question: string) => {
    if (!question.trim()) return;
    setAfficherQuestions(false);
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', texte: question, heure: heureActuelle() }]);
    setLoading(true);
    scrollToBottom();

    envoyerQuestionIA(question)
      .then(res => {
        setMessages(prev => [
          ...prev,
          { id: `a-${Date.now()}`, role: 'assistant', texte: res.data?.reponse || '...', heure: heureActuelle() },
        ]);
      })
      .catch(() => {
        setMessages(prev => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            texte: "Désolé, une erreur s'est produite. Vérifie ta connexion et réessaie.",
            heure: heureActuelle(),
          },
        ]);
      })
      .finally(() => {
        setLoading(false);
        scrollToBottom();
      });
  };

  const poserQuestionPredefinies = (id: string) => {
    envoyerQuestion(QUESTIONS_TEXTE[id] || id);
  };

  const envoyerTexteLibre = () => {
    const q = texteLibre.trim();
    if (!q) return;
    setTexteLibre('');
    envoyerQuestion(q);
  };

  const nouvelleConversation = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        texte: "Nouvelle conversation. Que puis-je faire pour vous aujourd'hui ? 😊",
        heure: heureActuelle(),
      },
    ]);
    setAfficherQuestions(true);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.headerBtn} onPress={nouvelleConversation} accessibilityLabel="Nouvelle conversation">
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        style={styles.list}
        contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                {item.texte}
              </Text>
            </View>
            <Text style={styles.heure}>{item.heure}</Text>
          </View>
        )}
        ListFooterComponent={
          loading ? (
            <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
              <View style={[styles.bubble, styles.bubbleAssistant, styles.bubbleTyping]}>
                <ActivityIndicator size="small" color={BLUE} />
              </View>
            </View>
          ) : null
        }
      />

      {afficherQuestions && !loading && questions.length > 0 && (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.suggestionsLabel}>Suggestions</Text>
          <View style={styles.chipsWrap}>
            {questions.map(q => (
              <TouchableOpacity key={q.id} style={styles.chip} onPress={() => poserQuestionPredefinies(q.id)}>
                <Ionicons name={ICON_MAP[q.icone] || 'help-circle-outline'} size={14} color={BLUE} />
                <Text style={styles.chipText}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={texteLibre}
          onChangeText={setTexteLibre}
          placeholder="Posez votre question..."
          placeholderTextColor="#94a3b8"
          onSubmitEditing={envoyerTexteLibre}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!texteLibre.trim() || loading) && styles.sendBtnDisabled]}
          onPress={envoyerTexteLibre}
          disabled={!texteLibre.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  list: { flex: 1 },
  bubbleRow: { marginBottom: 12, maxWidth: '82%' },
  bubbleRowUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowAssistant: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: BLUE, borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  bubbleTyping: { paddingVertical: 12, paddingHorizontal: 18 },
  bubbleTextUser: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTextAssistant: { color: '#0f172a', fontSize: 14, lineHeight: 20 },
  heure: { fontSize: 10, color: '#94a3b8', marginTop: 3, paddingHorizontal: 4 },
  suggestionsWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  suggestionsLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: '600' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: BLUE,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 4,
  },
  chipText: { fontSize: 12.5, color: BLUE, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#0f172a',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
