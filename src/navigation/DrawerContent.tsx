import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/colors';
import { getNotifications } from '../services/api.service';

/**
 * Menu latéral (tiroir) — réplique la disposition du menu latéral Ionic
 * (app.component.html) : même regroupement par sections, mêmes icônes
 * (Ionicons, la bibliothèque qu'Ionic utilise en interne) et mêmes règles
 * de visibilité ADMIN.
 */

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  navigate: () => void;
  danger?: boolean;
  badge?: number;
}

interface Props {
  navigation: any;
  isAdmin: boolean;
  user: any;
  boutiqueNom?: string;
  onLogout: () => void;
  onChangeBoutique: () => void;
}

export default function DrawerContent({ navigation, isAdmin, user, boutiqueNom, onLogout, onChangeBoutique }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [notifCount, setNotifCount] = useState(0);
  // Fonctionnalité désactivable par le super admin (Boutique > Paramètres) —
  // masque la section ; le vrai blocage est fait côté serveur. Lu depuis le
  // cache local (mis à jour par BoutiqueSettingsScreen/getBoutique) plutôt que
  // par un appel réseau dédié, pour rester rapide à l'ouverture du tiroir.
  const [featureTransfertsActif, setFeatureTransfertsActif] = useState(true);

  // Fonctionnalités avancées (système séparé) — clés désactivées, mises en cache au
  // login (voir LoginScreen.tsx) pour rester rapide à l'ouverture du tiroir.
  const [fonctionnalitesDesactivees, setFonctionnalitesDesactivees] = useState<Set<string>>(new Set());

  // Permissions vendeur (système générique, séparé des fonctionnalités avancées
  // ci-dessus) — clés ACTIVES accordées par un admin normal au vendeur (ex:
  // INVENTAIRE_LECTURE), mises en cache au login (voir LoginScreen.tsx).
  const [permissionsVendeurActives, setPermissionsVendeurActives] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem('boutique_info').then(raw => {
      if (!raw) return;
      try {
        const info = JSON.parse(raw);
        setFeatureTransfertsActif(info.featureTransfertsActif !== false);
      } catch { /* ignore */ }
    });
    AsyncStorage.getItem('fonctionnalites_avancees_desactivees').then(raw => {
      if (!raw) return;
      try { setFonctionnalitesDesactivees(new Set(JSON.parse(raw))); } catch { /* ignore */ }
    });
    AsyncStorage.getItem('permissions_vendeur_actives').then(raw => {
      if (!raw) return;
      try { setPermissionsVendeurActives(new Set(JSON.parse(raw))); } catch { /* ignore */ }
    });
  }, []);

  // Compte des notifications non lues, comme la cloche du menu Ionic (notifService.count$).
  const chargerNotifCount = () => {
    if (!isAdmin) return;
    getNotifications()
      .then(res => {
        const data = res.data?.data || res.data;
        const liste = Array.isArray(data) ? data : [];
        // BUG FIX (parité Ionic) : le backend renvoie le champ booléen "lu"
        // (entité Notification.java), pas "lue" — le filtre ne matchait
        // jamais et le badge comptait toujours TOUTES les notifications.
        setNotifCount(liste.filter((n: any) => !n.lu).length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    chargerNotifCount();
    const unsub = navigation.addListener?.('drawerOpen', chargerNotifCount);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Navigue vers un écran hébergé par la barre d'onglets (Caisse/Ventes/Produits/
  // Inventaire/Rapports) — il faut passer par le navigateur d'onglets imbriqué.
  const goTab = (screen: string) => () => {
    navigation.closeDrawer();
    navigation.navigate('MainTabs', { screen });
  };

  // Navigue vers un écran de la pile principale (en dehors des onglets et du
  // tiroir) — le nom remonte automatiquement jusqu'au bon navigateur parent.
  const go = (screen: string) => () => {
    navigation.closeDrawer();
    navigation.navigate(screen);
  };

  const commonItems: MenuItem[] = [
    { icon: 'home-outline', label: 'Dashboard', navigate: go('Home') },
    { icon: 'receipt-outline', label: 'Ventes', navigate: goTab('Ventes') },
    { icon: 'cart-outline', label: 'Nouvelle vente', navigate: go('Vente') },
    { icon: 'people-outline', label: 'Clients', navigate: go('Clients') },
    { icon: 'time-outline', label: 'Crédits', navigate: go('Credits') },
    // Inventaire : visible pour l'admin, ou pour le vendeur si un admin lui a
    // accordé la permission INVENTAIRE_LECTURE (accès lecture seule côté serveur).
    ...((isAdmin || permissionsVendeurActives.has('INVENTAIRE_LECTURE')) ? [{ icon: 'clipboard-outline' as const, label: 'Inventaire', navigate: goTab('Inventaire') }] : []),
    ...(isAdmin ? [{ icon: 'arrow-down-circle-outline' as const, label: 'Sorties Stock', navigate: go('Sorties') }] : []),
  ];

  // Fonctionnalités avancées (système séparé) — masque les entrées désactivées par le
  // super admin ; le vrai blocage est fait côté serveur (voir @RequireFeature).
  const actif = (cle: string) => !fonctionnalitesDesactivees.has(cle);

  const financeItems: MenuItem[] = [
    { icon: 'document-text-outline', label: 'Factures', navigate: go('Factures') },
    ...(actif('COMPTES_BANCAIRES') ? [{ icon: 'card-outline' as const, label: 'Comptes bancaires', navigate: go('Comptes') }] : []),
    ...(actif('DETTES_ANCIENNES') ? [{ icon: 'alert-circle-outline' as const, label: 'Dettes', navigate: go('DettesAnciennes') }] : []),
  ];

  const rhItems: MenuItem[] = [
    { icon: 'person-add-outline', label: 'Employés', navigate: go('Employes') },
    { icon: 'wallet-outline', label: 'Paiements employé', navigate: go('PaiementsEmploye') },
  ];

  // Flag superAdmin sur le compte (pas un rôle séparé — voir Utilisateur.java côté
  // backend) : le serveur revérifie systématiquement le privilège sur
  // PUT /api/boutique/fonctionnalites, ceci ne contrôle que l'affichage du lien.
  const isSuperAdmin = isAdmin && user?.superAdmin === true;

  const boutiqueItems: MenuItem[] = [
    { icon: 'business-outline', label: 'Fournisseurs', navigate: go('Fournisseurs') },
    ...(actif('DEPOT_GARDE') ? [{ icon: 'lock-closed-outline' as const, label: 'Coffre / Dépôts garde', navigate: go('Depots') }] : []),
    ...(actif('OBJECTIFS_FOURNISSEUR') ? [{ icon: 'trophy-outline' as const, label: 'Objectifs fournisseurs', navigate: go('ObjectifsFournisseur') }] : []),
    ...(actif('OBJECTIFS_VENDEUR') ? [{ icon: 'cash-outline' as const, label: 'Primes vendeurs', navigate: go('ObjectifsVendeur') }] : []),
    { icon: 'people-circle-outline', label: 'Vendeurs', navigate: go('Vendeurs') },
    { icon: 'storefront-outline', label: 'Boutique', navigate: go('BoutiqueSettings') },
    { icon: 'color-palette-outline', label: 'Modèle de facture', navigate: go('FactureDesign') },
    { icon: 'language-outline', label: 'Langue', navigate: go('Langue') },
    ...(isSuperAdmin ? [{ icon: 'shield-checkmark-outline' as const, label: 'Fonctionnalités (super admin)', navigate: go('SuperAdminFonctionnalites') }] : []),
  ];

  const transfertItems: MenuItem[] = [
    { icon: 'swap-horizontal-outline', label: 'Transferts', navigate: go('Transferts') },
    { icon: 'settings-outline', label: 'Config. partenaires', navigate: go('ConfigTransferts') },
  ];

  const analyseItems: MenuItem[] = [
    ...(actif('RAPPORTS') ? [{ icon: 'stats-chart-outline' as const, label: 'Rapports', navigate: goTab('Rapports') }] : []),
    ...(actif('IA') ? [{ icon: 'sparkles-outline' as const, label: 'IA Boutique', navigate: go('IA') }] : []),
    // Assistant IA (chat) : écran déjà construit mais resté orphelin après le
    // remplacement de l'ancien MenuScreen par ce tiroir — aucun lien n'y menait
    // plus nulle part. Même clé de fonctionnalité que "IA Boutique" ci-dessus.
    ...(actif('IA') ? [{ icon: 'chatbubble-ellipses-outline' as const, label: 'Assistant IA (chat)', navigate: go('AssistantIA') }] : []),
    { icon: 'trending-up-outline', label: 'Bénéfices', navigate: go('Benefices') },
    ...(actif('BONUS_FOURNISSEURS') ? [{ icon: 'gift-outline' as const, label: 'Bonus fournisseurs', navigate: go('BonusFournisseurs') }] : []),
    { icon: 'trending-down-outline', label: 'Dépenses', navigate: go('Depenses') },
    ...(actif('PROMOTIONS') ? [{ icon: 'pricetag-outline' as const, label: 'Promotions', navigate: go('Promotions') }] : []),
    ...(actif('RESULTAT_NET') ? [{ icon: 'analytics-outline' as const, label: 'Résultat net', navigate: go('ResultatNet') }] : []),
    { icon: 'bar-chart-outline', label: 'Historique vendeur', navigate: go('HistoriqueVendeur') },
    { icon: 'close-circle-outline', label: 'Annulation paiements', navigate: go('AnnulationPaiements'), danger: true },
    { icon: 'settings-outline', label: 'Paramètres', navigate: go('Parametres') },
    { icon: 'download-outline', label: 'Export de données', navigate: go('ExportDonnees') },
    { icon: 'shield-checkmark-outline', label: "Journal d'audit", navigate: go('JournalAudit') },
    { icon: 'cloud-upload-outline', label: 'Sauvegardes', navigate: go('Sauvegardes') },
    { icon: 'notifications-outline', label: 'Notifications', navigate: go('Notifications'), badge: notifCount },
  ];

  const renderSection = (title: string, items: MenuItem[]) => (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>
      {items.map(item => (
        <TouchableOpacity key={item.label} style={styles.item} onPress={item.navigate}>
          <Ionicons name={item.icon} size={20} color={item.danger ? '#dc2626' : colors.textSecondary} style={{ width: 26 }} />
          <Text style={[styles.itemLabel, { color: item.danger ? '#dc2626' : colors.text }]}>{item.label}</Text>
          {!!item.badge && (
            <View style={styles.itemBadge}>
              <Text style={styles.itemBadgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.brandRow}>
          <Image source={require('../../assets/icon.png')} style={styles.brandLogo} />
          <View>
            <Text style={styles.brandName}>Ges Lafia</Text>
            <Text style={styles.brandSub}>Maïga Consulting</Text>
          </View>
        </View>
        <View style={styles.logoRow}>
          <View style={styles.avatar}>
            {user?.photo
              ? <Image source={{ uri: user.photo }} style={styles.avatarImg} />
              : <Text style={styles.avatarText}>{(user?.nomComplet || user?.username || 'U')[0]?.toUpperCase()}</Text>
            }
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.appName}>{user?.nomComplet || user?.username || 'Utilisateur'}</Text>
            <Text style={styles.appSub}>{boutiqueNom || ''}</Text>
            <Text style={styles.roleText}>{user?.role === 'ADMIN' ? 'Administrateur' : 'Vendeur'}</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity style={styles.bell} onPress={go('Notifications')}>
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              {notifCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{notifCount > 99 ? '99+' : notifCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {renderSection('PLUS', commonItems)}

        {isAdmin && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {renderSection('FINANCES', financeItems)}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {renderSection('RESSOURCES HUMAINES', rhItems)}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {renderSection('PARAMÈTRES BOUTIQUE', boutiqueItems)}
            {featureTransfertsActif && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                {renderSection('TRANSFERTS', transfertItems)}
              </>
            )}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {renderSection('ANALYSES', analyseItems)}
          </>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {renderSection('', [
          { icon: 'person-circle-outline', label: 'Mon profil', navigate: go('Profil') },
          { icon: 'information-circle-outline', label: 'Aide & Ressources', navigate: go('Resources') },
          { icon: 'swap-horizontal-outline', label: 'Changer de boutique', navigate: () => { navigation.closeDrawer(); onChangeBoutique(); } },
        ])}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.whatsapp} onPress={() => Linking.openURL('https://wa.me/22353417919')}>
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          <Text style={styles.whatsappText}>Contact WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => { navigation.closeDrawer(); onLogout(); }}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#081648', paddingHorizontal: 16, paddingBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  brandLogo: { width: 30, height: 30, borderRadius: 6, marginRight: 8 },
  brandName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  brandSub: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  appName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  appSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  roleText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },
  bell: { padding: 4 },
  bellBadge: { position: 'absolute', top: -2, right: -4, backgroundColor: '#dc2626', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginTop: 14, marginBottom: 4, marginLeft: 16 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16 },
  itemLabel: { fontSize: 14, marginLeft: 4, flex: 1 },
  itemBadge: { backgroundColor: '#dc2626', borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  itemBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  divider: { height: 1, marginVertical: 4, marginHorizontal: 16 },
  footer: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16 },
  whatsapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: '#e9fbf0', borderRadius: 10, marginBottom: 8 },
  whatsappText: { color: '#25D366', fontWeight: '600', marginLeft: 8, fontSize: 13 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  logoutText: { color: '#dc2626', fontWeight: '600', marginLeft: 8, fontSize: 14 },
});
