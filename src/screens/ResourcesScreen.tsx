import React from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import { Text, Card, List, Divider } from 'react-native-paper';

const RESOURCES = [
  {
    titre: 'Guide d\'utilisation',
    items: [
      { icon: 'book-open-variant', label: 'Comment faire une vente', url: '' },
      { icon: 'package-variant', label: 'Gérer les produits', url: '' },
      { icon: 'chart-bar', label: 'Comprendre les rapports', url: '' },
      { icon: 'account-group', label: 'Gestion des clients', url: '' },
    ]
  },
  {
    titre: 'Support',
    items: [
      { icon: 'whatsapp', label: 'Contacter le support WhatsApp', url: 'https://wa.me/22300000000' },
      { icon: 'email', label: 'Envoyer un email', url: 'mailto:support@gesboutique.com' },
    ]
  },
];

export default function ResourcesScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>Ressources & Aide</Text>
        <Text style={styles.headerSub}>Guides et support pour Ges Boutique</Text>
      </View>

      {RESOURCES.map((section, si) => (
        <Card key={si} style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{section.titre}</Text>
            {section.items.map((item, ii) => (
              <React.Fragment key={ii}>
                <List.Item
                  title={item.label}
                  left={props => <List.Icon {...props} icon={item.icon} color="#1a56db" />}
                  right={props => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => item.url ? Linking.openURL(item.url) : null}
                />
                {ii < section.items.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>
      ))}

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>À propos</Text>
          <List.Item title="Version" description="1.0.0" left={props => <List.Icon {...props} icon="information" />} />
          <Divider />
          <List.Item title="Développé par" description="MG Consulting" left={props => <List.Icon {...props} icon="code-tags" />} />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#1a56db', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 13 },
  card: { borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontWeight: 'bold', color: '#1a56db', marginBottom: 8 },
});
