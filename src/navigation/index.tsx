import React from 'react';
import { TouchableOpacity, Platform, View, Text, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, useNavigation, DrawerActions, createNavigationContainerRef } from '@react-navigation/native';

// Ref exportée pour naviguer depuis l'extérieur de l'arbre de navigation (ex: App.tsx,
// popup "commandes vitrine en attente" affiché au login — pas de <NavigationContainer>
// accessible depuis là autrement, il est créé ici, à l'intérieur de AppNavigation).
export const navigationRef = createNavigationContainerRef();
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import { enableScreens } from 'react-native-screens';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DrawerContent from './DrawerContent';
import NetworkStatusDot from '../components/NetworkStatusDot';

// Voir App.tsx : désactivé sur web, sinon les ScrollView des écrans ne
// défilent plus (react-native-screens force des conteneurs overflow:hidden
// pensés pour le rendu natif, sans équivalent utile sur web).
if (Platform.OS !== 'web') enableScreens();

import ProduitsScreen from '../screens/ProduitsScreen';
import VenteScreen from '../screens/VenteScreen';
import RapportsScreen from '../screens/RapportsScreen';
import HistoriqueVentesScreen from '../screens/HistoriqueVentesScreen';
import ClientsScreen from '../screens/ClientsScreen';
import InventaireScreen from '../screens/InventaireScreen';
import DepensesScreen from '../screens/DepensesScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import CreditsScreen from '../screens/CreditsScreen';
import FournisseursScreen from '../screens/FournisseursScreen';
import BoutiqueSettingsScreen from '../screens/BoutiqueSettingsScreen';
import SuperAdminFonctionnalitesScreen from '../screens/SuperAdminFonctionnalitesScreen';
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
import ObjectifsVendeurScreen from '../screens/ObjectifsVendeurScreen';
import VendeursScreen from '../screens/VendeursScreen';
import HistoriqueVendeurScreen from '../screens/HistoriqueVendeurScreen';
import HomeScreen from '../screens/HomeScreen';
import AnnulationPaiementsScreen from '../screens/AnnulationPaiementsScreen';
import SortiesScreen from '../screens/SortiesScreen';
import ParametresScreen from '../screens/ParametresScreen';
import ExportDonneesScreen from '../screens/ExportDonneesScreen';
import JournalAuditScreen from '../screens/JournalAuditScreen';
import SauvegardesScreen from '../screens/SauvegardesScreen';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator();
const AuthStack = createStackNavigator();

const HEADER = {
  headerStyle: { backgroundColor: '#081648' },
  headerTintColor: '#fff' as const,
  headerTitleStyle: { fontWeight: 'bold' as const, fontSize: 17 },
  // Point de statut réseau — vert/orange, sur TOUS les écrans (Stack + Tabs
  // héritent tous les deux de HEADER), plutôt qu'un bandeau par page.
  headerRight: () => <NetworkStatusDot />,
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

// Icône d'onglet "premium" (design-premium) : pastille bleu clair douce autour
// de l'icône active, comme les pastilles de statut de stock du reste de
// l'appli — remplace le simple changement de couleur plat d'avant.
function TabIcon({ name, focused, color, size, dark }: { name: any; focused: boolean; color: string; size: number; dark: boolean }) {
  return (
    <View
      style={{
        width: 34,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? (dark ? 'rgba(59,114,246,0.22)' : '#dbeafe') : 'transparent',
      }}
    >
      <Ionicons name={name} color={color} size={size} />
    </View>
  );
}

// Bouton central flottant "Vendre" — même intention que .tab-btn--fab côté
// Ionic (bouton "+" bleu qui dépasse au-dessus de la barre, raccourci direct
// vers une nouvelle vente). Rendu via tabBarButton pour un onglet factice
// (voir plus bas) : tabPress est intercepté pour naviguer sur l'écran Vente
// du Stack parent plutôt que d'activer un vrai onglet.
function TabFabButton({ onPress, style }: { onPress?: (e: any) => void; style?: any }) {
  // BUG FIX (espace vide à droite de la barre) : cet onglet factice ignorait le "style"
  // que la librairie calcule et applique aux 4 autres onglets (largeur de flex partagée
  // entre tous les items) — il imposait son propre flex:1 isolé, ce qui désynchronisait
  // sa largeur réelle de celle des autres et laissait un espace non réparti en bout de
  // barre. On fusionne maintenant le style reçu (comme les onglets par défaut) avec les
  // seuls ajustements propres au FAB (alignement/centrage).
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[style, { alignItems: 'center', justifyContent: 'flex-end' }]}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: '#1a56db',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -14,
          shadowColor: '#1a56db',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.4,
          shadowRadius: 10,
          elevation: 8,
        }}
      >
        <Ionicons name="add" color="#ffffff" size={28} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: '800', color: '#1a56db', marginTop: 4 }}>Vente</Text>
    </TouchableOpacity>
  );
}

// Disposition identique à Ionic (tabs.page.html) : Caisse et Rapports réservés
// à l'ADMIN (invisibles pour un vendeur), Produits ↔ Ventes échangés, bouton
// central "Vendre" ajouté au milieu — mêmes icônes (Ionicons — la
// bibliothèque qu'Ionic utilise en interne pour ion-icon).
//
// Style (design-premium) : coins arrondis + ombre légère au lieu du filet gris
// plat d'avant, palette bleu/blanc de la charte, et suivi automatique du mode
// sombre système (useColorScheme) — jamais de fond blanc figé la nuit.
function MainTabs({ isAdmin }: { isAdmin: boolean }) {
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const palette = {
    // BUG FIX (build natif Android cassé) : la version précédente utilisait expo-blur
    // (BlurView) pour un vrai effet verre dépoli — mais c'est un module NATIF, pas du JS. Il
    // faut reconstruire l'appli Android (expo run:android) pour le lier, et ce PC tombe sur un
    // bug d'environnement Windows connu (ninja/CMake en boucle infinie, indépendant de ce
    // projet — ça arrive même sur des modules déjà présents avant nos changements) qui empêche
    // ce rebuild natif pour l'instant. On revient donc à un fond translucide sans flou réel
    // (comme le filet de sécurité @supports côté Ionic) : moins spectaculaire, mais 100% JS,
    // donc ça marche immédiatement sans reconstruire l'appli. Opacité plus haute qu'avant
    // (0.68→0.94) car sans flou pour masquer le contenu qui défile derrière, un fond trop
    // transparent laisse le texte des écrans se voir à travers la barre.
    bg: dark ? 'rgba(15,23,42,0.94)' : 'rgba(255,255,255,0.94)',
    active: dark ? '#3b72f6' : '#1a56db',
    // BUG FIX (libellés inactifs illisibles) : les deux teintes étaient inversées par
    // rapport à ce qu'il fallait pour chaque fond — un gris clair sur fond quasi blanc
    // (mode clair) est presque invisible ; il faut la teinte la plus SOMBRE des deux sur
    // fond clair, et la plus CLAIRE sur fond sombre, pas l'inverse.
    inactive: dark ? '#94a3b8' : '#64748b',
  };
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: palette.active,
        tabBarInactiveTintColor: palette.inactive,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          backgroundColor: palette.bg,
          borderTopWidth: 0,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          shadowColor: '#081648',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: dark ? 0.35 : 0.08,
          shadowRadius: 12,
          elevation: 14,
        },
        // BUG FIX (barre à 5 vrais boutons depuis le retour de "Ventes" dans la barre visible) :
        // fontSize 11 + padding horizontal par défaut de la librairie faisaient déborder/couper
        // des libellés plus longs ("Inventaire", "Produits") et créaient un espacement inégal
        // entre les 5 items. paddingHorizontal:0 + police réduite = tout tient sans coupure.
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
        // flex:1 explicite (au lieu de compter sur la valeur par défaut de la librairie) :
        // garantit que les 5 onglets (dont le FAB, désormais aligné sur ce même style)
        // se partagent exactement et uniformément toute la largeur de la barre.
        tabBarItemStyle: { paddingTop: 2, paddingHorizontal: 0, flex: 1 },
        headerLeft: () => <DrawerMenuButton />,
        ...HEADER,
      }}
    >
      {isAdmin && (
        <Tab.Screen name="Caisse" component={CaisseScreen}
          options={{ title: 'Caisse', tabBarIcon: ({ color, size, focused }) => <TabIcon name="cash-outline" color={color} size={size} focused={focused} dark={dark} /> }} />
      )}
      <Tab.Screen name="Produits" component={ProduitsScreen}
        options={{ title: 'Produits', tabBarIcon: ({ color, size, focused }) => <TabIcon name="cube-outline" color={color} size={size} focused={focused} dark={dark} /> }} />
      <Tab.Screen name="VenteFAB" component={ProduitsScreen}
        options={{
          tabBarButton: (props) => <TabFabButton onPress={props.onPress} style={props.style} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent()?.navigate('Vente');
          },
        })}
      />
      {/* BUG CORRIGÉ : "Ventes" était caché de la barre (tabBarButton:null) alors que
          tabs.page.html (Ionic) l'affiche bien comme 4e bouton réel, juste après le FAB
          central, avec l'icône receipt-outline (voir ion-tab-button tab="sales"). Barre
          Ionic = Caisse, Produits, FAB Vente, Ventes, Inventaire — Rapports n'y figure
          pas du tout (uniquement dans ion-menu → section Analyses), donc reste caché ici
          à raison ; les deux restent des onglets enregistrés et accessibles depuis le
          tiroir latéral (DrawerContent), donc pas de lien cassé. */}
      <Tab.Screen name="Ventes" component={HistoriqueVentesScreen}
        options={{ title: 'Ventes', tabBarIcon: ({ color, size, focused }) => <TabIcon name="receipt-outline" color={color} size={size} focused={focused} dark={dark} /> }} />
      <Tab.Screen name="Inventaire" component={InventaireScreen}
        options={{ title: 'Inventaire', tabBarIcon: ({ color, size, focused }) => <TabIcon name="clipboard-outline" color={color} size={size} focused={focused} dark={dark} /> }} />
      {isAdmin && (
        <Tab.Screen name="Rapports" component={RapportsScreen}
          options={{ title: 'Rapports', tabBarButton: () => null }} />
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
      <Stack.Screen name="Vente"            component={VenteScreen}              options={{ title: 'Nouvelle vente' }} />
      <Stack.Screen name="Home"             component={HomeScreen}               options={{ title: 'Accueil' }} />
      <Stack.Screen name="Clients"          component={ClientsScreen}            options={{ title: 'Clients' }} />
      <Stack.Screen name="Depenses"         component={DepensesScreen}           options={{ title: 'Dépenses' }} />
      <Stack.Screen name="Notifications"    component={NotificationsScreen}      options={{ title: 'Notifications' }} />
      <Stack.Screen name="Credits"          component={CreditsScreen}            options={{ title: 'Crédits clients' }} />
      <Stack.Screen name="Fournisseurs"     component={FournisseursScreen}       options={{ title: 'Fournisseurs' }} />
      <Stack.Screen name="BoutiqueSettings" component={BoutiqueSettingsScreen}   options={{ title: 'Paramètres boutique' }} />
      <Stack.Screen name="SuperAdminFonctionnalites" component={SuperAdminFonctionnalitesScreen} options={{ title: 'Fonctionnalités (super admin)' }} />
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
      <Stack.Screen name="Promotions"       component={PromotionsScreen}         options={{ title: 'Promotions' }} />
      <Stack.Screen name="Commandes"           component={CommandesScreen}             options={{ title: 'Commandes' }} />
      <Stack.Screen name="Employes"           component={EmployesScreen}              options={{ title: 'Employés' }} />
      <Stack.Screen name="PaiementsEmploye"   component={PaiementsEmployeScreen}      options={{ title: 'Paiements employé' }} />
      <Stack.Screen name="DettesAnciennes"    component={DettesAnciennesScreen}       options={{ title: 'Dettes anciennes' }} />
      <Stack.Screen name="Comptes"            component={ComptesScreen}               options={{ title: 'Comptes bancaires' }} />
      <Stack.Screen name="ObjectifsFournisseur" component={ObjectifsFournisseurScreen} options={{ title: 'Objectifs fournisseurs' }} />
      <Stack.Screen name="ObjectifsVendeur" component={ObjectifsVendeurScreen} options={{ title: 'Primes vendeurs' }} />
      <Stack.Screen name="Vendeurs"           component={VendeursScreen}              options={{ title: 'Vendeurs' }} />
      <Stack.Screen name="HistoriqueVendeur"  component={HistoriqueVendeurScreen}     options={{ title: 'Historique vendeur' }} />
      <Stack.Screen name="AnnulationPaiements" component={AnnulationPaiementsScreen}  options={{ title: 'Annulation paiements' }} />
      <Stack.Screen name="Sorties"             component={SortiesScreen}              options={{ title: 'Sorties stock' }} />
      <Stack.Screen name="IA"                  component={IAScreen}                   options={{ title: 'IA Boutique' }} />
      <Stack.Screen name="Parametres"          component={ParametresScreen}           options={{ title: 'Paramètres' }} />
      <Stack.Screen name="ExportDonnees"       component={ExportDonneesScreen}         options={{ title: 'Export de données' }} />
      <Stack.Screen name="JournalAudit"        component={JournalAuditScreen}          options={{ title: "Journal d'audit" }} />
      <Stack.Screen name="Sauvegardes"         component={SauvegardesScreen}           options={{ title: 'Sauvegardes' }} />
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
    <NavigationContainer ref={navigationRef}>
      <MainStack onLogout={onLogout} onChangeBoutique={onChangeBoutique} isAdmin={isAdmin} user={user} />
    </NavigationContainer>
  );
}
