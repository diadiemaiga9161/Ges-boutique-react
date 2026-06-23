import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Avatar, Card } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfilScreen() {
  const [user, setUser] = useState<any>({});
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', ancienMotDePasse: '', nouveauMotDePasse: '' });

  useEffect(() => {
    AsyncStorage.getItem('user').then(raw => {
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        setForm(f => ({ ...f, nom: u.nom || '', email: u.email || '', telephone: u.telephone || '' }));
      }
    });
  }, []);

  const initiales = (user.nom || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <Avatar.Text size={72} label={initiales} style={{ backgroundColor: '#fff' }} color="#1976D2" />
        <Text variant="headlineSmall" style={styles.name}>{user.nom}</Text>
        <Text style={styles.role}>{user.role === 'ADMIN' ? 'Administrateur' : 'Vendeur'}</Text>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Informations personnelles</Text>
          <TextInput label="Nom complet" value={form.nom} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
          <TextInput label="Email" value={form.email} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} keyboardType="email-address" />
          <TextInput label="Téléphone" value={form.telephone} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" style={styles.input} keyboardType="phone-pad" />
          <Button mode="contained" style={styles.btn} onPress={() => Alert.alert('Info', 'Fonctionnalité à venir')}>
            Enregistrer
          </Button>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>Changer le mot de passe</Text>
          <TextInput label="Ancien mot de passe" value={form.ancienMotDePasse} onChangeText={t => setForm({ ...form, ancienMotDePasse: t })} mode="outlined" secureTextEntry style={styles.input} />
          <TextInput label="Nouveau mot de passe" value={form.nouveauMotDePasse} onChangeText={t => setForm({ ...form, nouveauMotDePasse: t })} mode="outlined" secureTextEntry style={styles.input} />
          <Button mode="outlined" style={styles.btn} onPress={() => Alert.alert('Info', 'Fonctionnalité à venir')}>
            Changer le mot de passe
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#1976D2', padding: 32, alignItems: 'center', borderRadius: 16, marginBottom: 16 },
  name: { color: '#fff', fontWeight: 'bold', marginTop: 12 },
  role: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  card: { borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontWeight: 'bold', color: '#1976D2', marginBottom: 12 },
  input: { marginBottom: 12 },
  btn: { borderRadius: 8 },
});
