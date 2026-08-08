import React from 'react';
import { TouchableOpacity, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation, DrawerActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { enableScreens } from 'react-native-screens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DrawerContent from './DrawerContent';

// Voir App.tsx : désactivé sur web, sinon les ScrollView des écrans ne
// défilent plus (react-native-screens force des conteneurs overflow:hidden
// pensés pour le rendu natif, sans équivalent utile sur web).
if (Platform.OS !== 'web') enableScreens();

import ProduitsScreen from '../screens/ProduitsScreen';
import VenteScreen from '../screens/VenteScreen';
import RapportsScreen from '../screens/RapportsScreen';
import MenuScreen from '../screens/MenuScreen';
import HistoriqueVentesScreen from '../screens/HistoriqueVentesScreen';
import ClientsScreen from '../screens/ClientsScreen';
import InventaireScreen from '../screens/InventaireScreen';
import DepensesScreen from '../screens/DepensesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CreditsScreen from '../screens/CreditsScreen';
import FournisseursScreen from '../screens/FournisseursScreen';
import BoutiqueSettingsScreen from '../screens/BoutiqueSettingsScreen';
import CaisseScreen from '../screens/CaisseScreen';
import BeneficesScreen from '../screens/BeneficesScreen';
import ProfilScreen from '../screens/ProfilScreen';
import TransfertsScreen from '../screens/TransfertsScreen';
import DepotsScreen from '../screens/DepotsScreen';
import MobileMoneyScreen from '../screens/MobileMoneyScreen';
import FacturesScreen from '../screens/FacturesScreen';
import ResultatNetScreen from '../screens/ResultatNetScreen';
import BonusFournisseursScreen from '../screens/BonusFournisseursScreen';
import LangueScreen from '../screens/LangueScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import BoutiqueSelectScreen from '../screens/BoutiqueSelectScreen';
import ConfigTransfertsScreen from '../screens/ConfigTransfertsScreen';
import AssistantIAScreen from '../screens/AssistantIAScreen';
import IAScreen from '../screens/IAScreen';
import FactureDesignScreen from '../screens/FactureDesignScreen';
import ResourcesScreen from '../screens/ResourcesScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import CommandesScreen from '../screens/CommandesScreen';
import EmployesScreen from '../screens/EmployesScreen';
import PaiementsEmployeScreen from '../screens/PaiementsEmployeScreen';
import DettesAnciennesScreen from '../screens/DettesAnciennesScreen';
import ComptesScreen from '../screens/ComptesScreen';
import ObjectifsFournisseurScreen from '../screens/ObjectifsFournisseurScreen';
import VendeursScreen from '../screens/VendeursScreen';
import HistoriqueVendeurScreen from '../screens/HistoriqueVendeurScreen';
import HomeScreen from '../screens/HomeScreen';
import AnnulationPaiementsScreen from '../screens/AnnulationPaiementsScreen';
import SortiesScreen from '../screens/SortiesScreen';
import ParametresScreen from '../screens/ParametresScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();
const AuthStack = createStackNavigator();

const HEADER = {
  headerStyle: { backgroundColor: '#081648' },
  headerTintColor: '#fff' as const,
  headerTitleStyle: { fontWeight: 'bold' as const, fontSize: 17 },
};

/** Bouton hamburger dans l'en-tête — ouvre le tiroir latéral (équivalent de
 *  l'icône ion-menu-button d'Ionic, placée en haut à gauche par convention). */
function DrawerMenuButton() {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity onPress={() => navigation.getParent()?.dispatch(DrawerActions.openDrawer())} style={{ marginLeft: 14 }}>
      <Ionicons name="menu" color="#fff" size={26} />
    </TouchableOpacity>
  );
}

// Disposition identique à Ionic (tabs.page.html) : Caisse et Rapports réservés
// à l'ADMIN (invisibles pour un vendeur), même ordre Caisse/Ventes/Produits/
// Inventaire/Rapports, mêmes icônes (Ionicons — la bibliothèque qu'Ionic
// utilise en interne pour ion-icon).
function MainTabs({ isAdmin }: { isAdmin: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a56db',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { height: 62 + insets.bottom, paddingBottom: insets.bottom + 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerLeft: () => <DrawerMenuButton />,
        ...HEADER,
      }}
    >
      {isAdmin && (
        <Tab.Screen name="Caisse" component={CaisseScreen}
          options={{ title: 'Caisse', tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" color={color} size={size} /> }} />
      )}
      <Tab.Screen name="Ventes" component={HistoriqueVentesScreen}
        options={{ title: 'Ventes', tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Produits" component={ProduitsScreen}
        options={{ title: 'Produits', tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Inventaire" component={InventaireScreen}
        options={{ title: 'Inventaire', tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" color={color} size={size} /> }} />
      {isAdmin && (
        <Tab.Screen name="Rapports" component={RapportsScreen}
          options={{ title: 'Rapports', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color} size={size} /> }} />
      )}
    </Tab.Navigator>
  );
}

/** Tiroir latéral enveloppant la barre d'onglets — réplique ion-menu
 *  (app.component.html) : accessible depuis n'importe quel onglet via le
 *  bouton hamburger, regroupe toutes les pages qui n'ont pas d'onglet dédié. */
function TabsWithDrawer({ onLogout, onChangeBoutique, isAdmin, user }: { onLogout: () => void; onChangeBoutique: () => void; isAdmin: boolean; user: any }) {
  const [boutiqueNom, setBoutiqueNom] = React.useState<string>('');
  React.useEffect(() => {
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (raw) { try { setBoutiqueNom(JSON.parse(raw)?.nom || ''); } catch {} }
    });
  }, []);
  return (
    <Drawer.Navigator
      screenOptions={{ headerShown: false, drawerStyle: { width: '82%' }, swipeEdgeWidth: 60 }}
      drawerContent={(props) => (
        <DrawerContent {...props} isAdmin={isAdmin} user={user} boutiqueNom={boutiqueNom} onLogout={onLogout} onChangeBoutique={onChangeBoutique} />
      )}
    >
      <Drawer.Screen name="MainTabs">
        {() => <MainTabs isAdmin={isAdmin} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}

function MainStack({ onLogout, onChangeBoutique, isAdmin, user }: { onLogout: () => void; onChangeBoutique: () => void; isAdmin: boolean; user: any }) {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="Tabs" options={{ headerShown: false }}>
        {() => <TabsWithDrawer onLogout={onLogout} onChangeBoutique={onChangeBoutique} isAdmin={isAdmin} user={user} />}
      </Stack.Screen>
      <Stack.Screen name="Menu" options={{ title: 'Menu' }}>
        {(props: any) => <MenuScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Historique"       component={HistoriqueVentesScreen}   options={{ title: 'Historique ventes' }} />
      <Stack.Screen name="Vente"            component={VenteScreen}              options={{ title: 'Nouvelle vente' }} />
      <Stack.Screen name="Home"             component={HomeScreen}               options={{ title: 'Accueil' }} />
      <Stack.Screen name="Clients"          component={ClientsScreen}            options={{ title: 'Clients' }} />
      <Stack.Screen name="Depenses"         component={DepensesScreen}           options={{ title: 'Dépenses' }} />
      <Stack.Screen name="Notifications"    component={NotificationsScreen}      options={{ title: 'Notifications' }} />
      <Stack.Screen name="Credits"          component={CreditsScreen}            options={{ title: 'Crédits clients' }} />
      <Stack.Screen name="Fournisseurs"     component={FournisseursScreen}       options={{ title: 'Fournisseurs' }} />
      <Stack.Screen name="BoutiqueSettings" component={BoutiqueSettingsScreen}   options={{ title: 'Paramètres boutique' }} />
      <Stack.Screen name="Benefices"        component={BeneficesScreen}          options={{ title: 'Bénéfices' }} />
      <Stack.Screen name="Profil"           component={ProfilScreen}             options={{ title: 'Mon profil' }} />
      <Stack.Screen name="Transferts"       component={TransfertsScreen}         options={{ title: 'Transferts' }} />
      <Stack.Screen name="Depots"           component={DepotsScreen}             options={{ title: 'Dépôts' }} />
      <Stack.Screen name="MobileMoney"      component={MobileMoneyScreen}        options={{ title: 'Mobile Money' }} />
      <Stack.Screen name="Factures"         component={FacturesScreen}           options={{ title: 'Factures' }} />
      <Stack.Screen name="ResultatNet"      component={ResultatNetScreen}        options={{ title: 'Résultat net' }} />
      <Stack.Screen name="BonusFournisseurs" component={BonusFournisseursScreen} options={{ title: 'Bonus fournisseurs' }} />
      <Stack.Screen name="Langue"           component={LangueScreen}             options={{ title: 'Langue' }} />
      <Stack.Screen name="ConfigTransferts" component={ConfigTransfertsScreen}   options={{ title: 'Config. transferts' }} />
      <Stack.Screen name="AssistantIA"      component={AssistantIAScreen}        options={{ title: 'Assistant IA' }} />
      <Stack.Screen name="FactureDesign"    component={FactureDesignScreen}      options={{ title: 'Modèle de facture' }} />
      <Stack.Screen name="Resources"        component={ResourcesScreen}          options={{ title: 'Aide & Ressources' }} />
      <Stack.Screen name="BoutiqueSelect"   options={{ title: 'Sélectionner boutique' }}>
        {() => <BoutiqueSelectScreen onSelect={() => {}} />}
      </Stack.Screen>
      <Stack.Screen name="Promotions"       component={PromotionsScreen}         options={{ title: 'Promotions' }} />
      <Stack.Screen name="Commandes"           component={CommandesScreen}             options={{ title: 'Commandes' }} />
      <Stack.Screen name="Employes"           component={EmployesScreen}              options={{ title: 'Employés' }} />
      <Stack.Screen name="PaiementsEmploye"   component={PaiementsEmployeScreen}      options={{ title: 'Paiements employé' }} />
      <Stack.Screen name="DettesAnciennes"    component={DettesAnciennesScreen}       options={{ title: 'Dettes anciennes' }} />
      <Stack.Screen name="Comptes"            component={ComptesScreen}               options={{ title: 'Comptes bancaires' }} />
      <Stack.Screen name="ObjectifsFournisseur" component={ObjectifsFournisseurScreen} options={{ title: 'Objectifs fournisseurs' }} />
      <Stack.Screen name="Vendeurs"           component={VendeursScreen}              options={{ title: 'Vendeurs' }} />
      <Stack.Screen name="HistoriqueVendeur"  component={HistoriqueVendeurScreen}     options={{ title: 'Historique vendeur' }} />
      <Stack.Screen name="AnnulationPaiements" component={AnnulationPaiementsScreen}  options={{ title: 'Annulation paiements' }} />
      <Stack.Screen name="Sorties"             component={SortiesScreen}              options={{ title: 'Sorties stock' }} />
      <Stack.Screen name="IA"                  component={IAScreen}                   options={{ title: 'IA Boutique' }} />
      <Stack.Screen name="Parametres"          component={ParametresScreen}           options={{ title: 'Paramètres' }} />
    </Stack.Navigator>
  );
}

export function AuthNavigation({ onLogin }: { onLogin: (user: any) => void }) {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login">
        {() => {
          const LoginScreen = require('../screens/LoginScreen').default;
          return <LoginScreen onLogin={onLogin} />;
        }}
      </AuthStack.Screen>
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen}
        options={{ headerShown: true, ...HEADER, title: 'Mot de passe oublié' }} />
      <AuthStack.Screen name="ResetPassword" component={ResetPasswordScreen}
        options={{ headerShown: true, ...HEADER, title: 'Réinitialiser' }} />
    </AuthStack.Navigator>
  );
}

export default function AppNavigation({ onLogout, onChangeBoutique, user }: { onLogout: () => void; onChangeBoutique: () => void; user?: any }) {
  const isAdmin = user?.role === 'ADMIN';
  return (
    <NavigationContainer>
      <MainStack onLogout={onLogout} onChangeBoutique={onChangeBoutique} isAdmin={isAdmin} user={user} />
    </NavigationContainer>
  );
}
