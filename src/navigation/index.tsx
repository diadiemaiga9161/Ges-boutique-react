import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { enableScreens } from 'react-native-screens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

enableScreens();

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
import FactureDesignScreen from '../screens/FactureDesignScreen';
import ResourcesScreen from '../screens/ResourcesScreen';
import PromotionsScreen from '../screens/PromotionsScreen';
import CommandesScreen from '../screens/CommandesScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const AuthStack = createStackNavigator();

const HEADER = {
  headerStyle: { backgroundColor: '#081648' },
  headerTintColor: '#fff' as const,
  headerTitleStyle: { fontWeight: 'bold' as const, fontSize: 17 },
};

function MainTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1a56db',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { height: 62, paddingBottom: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#e0e0e0' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        ...HEADER,
      }}
    >
      <Tab.Screen name="Produits" component={ProduitsScreen}
        options={{ title: 'Produits', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="package-variant" color={color} size={size} /> }} />
      <Tab.Screen name="Vente" component={VenteScreen}
        options={{ title: 'Vente', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cart-outline" color={color} size={size} /> }} />
      <Tab.Screen name="Caisse" component={CaisseScreen}
        options={{ title: 'Caisse', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cash-register" color={color} size={size} /> }} />
      <Tab.Screen name="Rapports" component={RapportsScreen}
        options={{ title: 'Rapports', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-bar" color={color} size={size} /> }} />
      <Tab.Screen name="Menu" options={{ title: 'Menu', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="menu" color={color} size={size} /> }}>
        {(props: any) => <MenuScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function MainStack({ onLogout }: { onLogout: () => void }) {
  return (
    <Stack.Navigator screenOptions={HEADER}>
      <Stack.Screen name="Tabs" options={{ headerShown: false }}>
        {() => <MainTabs onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Historique"       component={HistoriqueVentesScreen}   options={{ title: 'Historique ventes' }} />
      <Stack.Screen name="Clients"          component={ClientsScreen}            options={{ title: 'Clients' }} />
      <Stack.Screen name="Inventaire"       component={InventaireScreen}         options={{ title: 'Inventaire' }} />
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
      <Stack.Screen name="Commandes"        component={CommandesScreen}           options={{ title: 'Commandes' }} />
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

export default function AppNavigation({ onLogout }: { onLogout: () => void }) {
  return (
    <NavigationContainer>
      <MainStack onLogout={onLogout} />
    </NavigationContainer>
  );
}
