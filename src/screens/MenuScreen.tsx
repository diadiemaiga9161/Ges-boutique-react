import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, List, Divider, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const getMenuItems = (lang: string) => [
  { icon: 'home-outline', label: 'Accueil', screen: 'Home' },
  { icon: 'history', label: tr('historique_ventes', lang), screen: 'Historique' },
  { icon: 'file-document-edit-outline', label: tr('commandes', lang), screen: 'Commandes' },
  { icon: 'account-group', label: tr('clients', lang), screen: 'Clients' },
  { icon: 'warehouse', label: tr('stock_inventaire', lang), screen: 'Inventaire' },
  { icon: 'arrow-up-circle-outline', label: 'Sorties stock', screen: 'Sorties' },
  { icon: 'cash-minus', label: tr('depenses', lang), screen: 'Depenses' },
  { icon: 'credit-card-clock', label: tr('credits', lang), screen: 'Credits' },
  { icon: 'truck', label: tr('fournisseurs', lang), screen: 'Fournisseurs' },
  { icon: 'bank-transfer', label: tr('depots_garde', lang), screen: 'Depots' },
  { icon: 'trending-up', label: tr('benefices_titre', lang), screen: 'Benefices' },
  { icon: 'calculator', label: tr('resultat_net', lang), screen: 'ResultatNet' },
  { icon: 'swap-horizontal', label: tr('transferts', lang), screen: 'Transferts' },
  { icon: 'cellphone-wireless', label: tr('mobile_money', lang), screen: 'MobileMoney' },
  { icon: 'receipt', label: tr('factures', lang), screen: 'Factures' },
  { icon: 'gift', label: tr('bonus_fournisseurs', lang), screen: 'BonusFournisseurs' },
  { icon: 'bell', label: 'Notifications', screen: 'Notifications' },
  { icon: 'translate', label: 'Langue', screen: 'Langue' },
  { icon: 'tag-multiple', label: 'Promotions', screen: 'Promotions' },
  { icon: 'robot', label: 'Assistant IA', screen: 'AssistantIA' },
  { icon: 'receipt-text-edit', label: tr('modele_facture', lang), screen: 'FactureDesign' },
  { icon: 'swap-horizontal-bold', label: tr('config_transferts', lang), screen: 'ConfigTransferts' },
  { icon: 'account-hard-hat', label: 'Employés', screen: 'Employes' },
  { icon: 'currency-usd-off', label: 'Dettes anciennes', screen: 'DettesAnciennes' },
  { icon: 'bank', label: 'Comptes bancaires', screen: 'Comptes' },
  { icon: 'target', label: 'Objectifs fournisseurs', screen: 'ObjectifsFournisseur' },
  { icon: 'account-tie', label: 'Vendeurs', screen: 'Vendeurs' },
  { icon: 'cash-remove', label: 'Annulation paiements', screen: 'AnnulationPaiements' },
  { icon: 'help-circle', label: tr('aide_ressources', lang), screen: 'Resources' },
  { icon: 'store-settings', label: tr('parametres_boutique', lang), screen: 'BoutiqueSettings' },
  { icon: 'account', label: tr('mon_profil', lang), screen: 'Profil' },
];

export default function MenuScreen({ navigation, onLogout }: any) {
  const [user, setUser] = React.useState<any>(null);
  const [boutique, setBoutique] = React.useState<any>({});
  const { lang } = useLang();

  React.useEffect(() => {
    AsyncStorage.getItem('user').then(raw => raw && setUser(JSON.parse(raw)));
    AsyncStorage.getItem('boutique_info').then(raw => raw && setBoutique(JSON.parse(raw)));
  }, []);

  const logout = () => {
    Alert.alert(tr('deconnexion', lang), tr('deconnexion_confirm', lang), [
      { text: tr('annuler', lang) },
      { text: tr('oui', lang), onPress: async () => {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('token');
        onLogout?.();
      }},
    ]);
  };

  const menuItems = getMenuItems(lang);

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
        {menuItems.map((item, i) => (
          <React.Fragment key={item.screen}>
            <List.Item
              title={item.label}
              left={props => <List.Icon {...props} icon={item.icon} />}
              right={props => <List.Icon {...props} icon="chevron-right" />}
              onPress={() => navigation.navigate(item.screen)}
              style={styles.item}
            />
            {i < menuItems.length - 1 && <Divider />}
          </React.Fragment>
        ))}

        <Divider style={{ marginTop: 8 }} />
        <List.Item
          title={tr('deconnexion', lang)}
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
