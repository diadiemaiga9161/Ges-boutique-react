import React, { useState, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, Card, ActivityIndicator } from 'react-native-paper';
import api from '../services/api.service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function AssistantIAScreen() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: 'Bonjour ! Je suis votre assistant IA. Comment puis-je vous aider à gérer votre boutique ?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const envoyer = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/assistant/chat', { message: text });
      const reply = res.data?.response || res.data?.message || 'Je suis désolé, je n\'ai pas pu répondre.';
      setMessages(prev => [...prev, { id: Date.now().toString() + '_a', role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString() + '_err', role: 'assistant', content: 'Connexion impossible. Vérifiez votre connexion internet.' }]);
    }
    setLoading(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
            <Text style={[styles.bubbleText, item.role === 'user' && { color: '#fff' }]}>{item.content}</Text>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
      />
      {loading && <ActivityIndicator style={{ margin: 8 }} />}
      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Posez votre question..."
          style={styles.input}
          mode="outlined"
          onSubmitEditing={envoyer}
        />
        <IconButton icon="send" mode="contained" onPress={envoyer} disabled={!input.trim() || loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 8 },
  bubbleUser: { backgroundColor: '#1a56db', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: '#fff', alignSelf: 'flex-start', borderBottomLeftRadius: 4, elevation: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  input: { flex: 1, marginRight: 4 },
});
