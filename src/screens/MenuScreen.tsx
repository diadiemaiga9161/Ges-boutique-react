import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, List, Divider, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MENU_ITEMS = [
  { icon: 'history', label: 'Historique des ventes', screen: 'Historique' },
  { icon: 'file-document-edit-outline', label: 'Commandes', screen: 'Commandes' },
  { icon: 'account-group', label: 'Clients', screen: 'Clients' },
  { icon: 'warehouse', label: 'Inventaire / Stock', screen: 'Inventaire' },
  { icon: 'cash-minus', label: 'Dépenses', screen: 'Depenses' },
  { icon: 'credit-card-clock', label: 'Crédits clients', screen: 'Credits' },
  { icon: 'truck', label: 'Fournisseurs', screen: 'Fournisseurs' },
  { icon: 'bank-transfer', label: 'Dépôts', screen: 'Depots' },
  { icon: 'trending-up', label: 'Bénéfices', screen: 'Benefices' },
  { icon: 'calculator', label: 'Résultat net', screen: 'ResultatNet' },
  { icon: 'swap-horizontal', label: 'Transferts', screen: 'Transferts' },
  { icon: 'cellphone-wireless', label: 'Mobile Money', screen: 'MobileMoney' },
  { icon: 'receipt', label: 'Factures', screen: 'Factures' },
  { icon: 'gift', label: 'Bonus fournisseurs', screen: 'BonusFournisseurs' },
  { icon: 'bell', label: 'Notifications', screen: 'Notifications' },
  { icon: 'translate', label: 'Langue', screen: 'Langue' },
  { icon: 'tag-multiple', label: 'Promotions', screen: 'Promotions' },
  { icon: 'robot', label: 'Assistant IA', screen: 'AssistantIA' },
  { icon: 'receipt-text-edit', label: 'Modèle de facture', screen: 'FactureDesign' },
  { icon: 'swap-horizontal-bold', label: 'Config. transferts', screen: 'ConfigTransferts' },
  { icon: 'help-circle', label: 'Aide & Ressources', screen: 'Resources' },
  { icon: 'store-settings', label: 'Paramètres boutique', screen: 'BoutiqueSettings' },
  { icon: 'account', label: 'Mon profil', screen: 'Profil' },
];

export default function MenuScreen({ navigation, onLogout }: any) {
  const [user, setUser] = React.useState<any>(null);
  const [boutique, setBoutique] = React.useState<any>({});

  React.useEffect(() => {
    AsyncStorage.getItem('user').then(raw => raw && setUser(JSON.parse(raw)));
    AsyncStorage.getItem('boutique_info').then(raw => raw && setBoutique(JSON.parse(raw)));
  }, []);

  const logout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler' },
      { text: 'Oui', onPress: async () => {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('token');
        onLogout?.();
      }},
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header profil */}
      <View style={styles.header}>
        <Avatar.Text size={56} label={(user?.nom?.[0] || 'U').toUpperCase()} />
        <View style={{ marginLeft: 16 }}>
          <Text variant="titleMedium" style={{ color: '#fff' }}>{user?.nom || 'Utilisateur'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{boutique.nom || ''}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{user?.role}</Text>
        </View>
      </View>

      {/* Navigation */}
      <View style={styles.list}>
        {MENU_ITEMS.map((item, i) => (
          <React.Fragment key={item.screen}>
            <List.Item
              title={item.label}
              left={props => <List.Icon {...props} icon={item.icon} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate(item.screen)}
              style={styles.item}
            />
            {i < MENU_ITEMS.length - 1 && <Divider />}
          </React.Fragment>
        ))}

        <Divider style={{ marginTop: 8 }} />
        <List.Item
          title="Déconnexion"
          titleStyle={{ color: '#f44336' }}
          left={props => <List.Icon {...props} icon="logout" color="#f44336" />}
          onPress={logout}
          style={styles.item}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  header: { backgroundColor: '#081648', padding: 24, flexDirection: 'row', alignItems: 'center' },
  list: { backgroundColor: '#fff', margin: 12, borderRadius: 12, elevation: 2 },
  item: { paddingVertical: 4 },
});
