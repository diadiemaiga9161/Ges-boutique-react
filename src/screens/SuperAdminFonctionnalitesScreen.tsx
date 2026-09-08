import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Button, ActivityIndicator, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getBoutique, modifierFonctionnalitesBoutique,
  getFonctionnalitesAvancees, definirFonctionnaliteAvancee,
} from '../services/api.service';
import { useColors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';

interface FonctionnaliteAvancee { cle: string; libelle: string; actif: boolean }

const ICONES: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  DEPOT_GARDE: 'lock-outline',
  DETTES_ANCIENNES: 'file-document-outline',
  COMPTES_BANCAIRES: 'bank-outline',
  PROMOTIONS: 'tag-outline',
  MOBILE_MONEY: 'cellphone',
  BONUS_FOURNISSEURS: 'gift-outline',
  OBJECTIFS_FOURNISSEUR: 'trophy-outline',
  OBJECTIFS_VENDEUR: 'cash-multiple',
  RAPPORTS: 'chart-line',
  IA: 'robot-outline',
  RESULTAT_NET: 'calculator-variant-outline',
  PROGRAMME_FIDELITE: 'star-circle-outline',
  VENTE_GROS_DETAIL: 'scale-balance',
};

const DESCRIPTIONS: Record<string, string> = {
  DEPOT_GARDE: "Bloque les nouveaux dépôts — les clients gardent l'accès à leur historique et récupèrent toujours leur argent.",
  DETTES_ANCIENNES: 'Bloque la création de nouvelles dettes — règlement et consultation restent ouverts.',
  COMPTES_BANCAIRES: 'Gestion des comptes bancaires de la boutique.',
  PROMOTIONS: 'Création et envoi de promotions aux clients.',
  MOBILE_MONEY: 'Statistiques Orange Money / Moov Money.',
  BONUS_FOURNISSEURS: 'Suivi des bonus accordés par les fournisseurs.',
  OBJECTIFS_FOURNISSEUR: 'Objectifs et bonus liés aux fournisseurs.',
  OBJECTIFS_VENDEUR: 'Primes des vendeurs selon leurs objectifs.',
  RAPPORTS: 'Page de rapports et statistiques analytiques.',
  IA: 'Assistant et recommandations intelligentes.',
  RESULTAT_NET: 'Calcul du résultat net (bénéfice/perte).',
  PROGRAMME_FIDELITE: "Points de fidélité gagnés automatiquement à chaque vente, utilisables comme réduction (réglages des taux dans Boutique > Paramètres boutique).",
  VENTE_GROS_DETAIL: "Vente en gros/détail simplifiée : unités de vente (Carton, Cartouche...) sur un produit, sans stock séparé (réglages dans la fiche de chaque produit).",
};

// Écran réservé au super admin (flag superAdmin sur le compte, pas un rôle séparé —
// voir DrawerContent.tsx/MenuScreen.tsx pour le contrôle d'affichage du lien, et
// AuthGuard côté Ionic avec data: { superAdminOnly: true }). La garde ci-dessous
// bloque même un ADMIN classique qui accéderait directement à l'écran (deep link,
// etc.) — le serveur revérifie de toute façon systématiquement le privilège sur
// chaque endpoint concerné.
export default function SuperAdminFonctionnalitesScreen() {
  const colors = useColors();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  // Cast local en `any` : le champ `superAdmin` n'est pas déclaré dans l'interface
  // `User` (src/types/index.ts) — même pattern que SauvegardesScreen.tsx/DrawerContent.tsx.
  const isSuperAdmin = isAdmin && (user as any)?.superAdmin === true;
  const [featureTransfertsActif, setFeatureTransfertsActif] = useState(true);
  const [featureVitrineActif, setFeatureVitrineActif] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fonctionnalités avancées — système séparé, chaque bascule s'enregistre
  // immédiatement (pas de bouton "Enregistrer" groupé).
  const [fonctionnalitesAvancees, setFonctionnalitesAvancees] = useState<FonctionnaliteAvancee[]>([]);
  const [loadingAvancees, setLoadingAvancees] = useState(true);
  const [clesEnCours, setClesEnCours] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Attend la résolution de useAuth() puis bloque tout chargement de données
    // si l'utilisateur n'est pas super admin (voir garde de rendu plus bas).
    if (authLoading) return;
    if (!isSuperAdmin) { setLoading(false); setLoadingAvancees(false); return; }

    getBoutique()
      .then(res => {
        const data = res.data?.boutique || res.data?.data || res.data;
        setFeatureTransfertsActif(data?.featureTransfertsActif !== false);
        setFeatureVitrineActif(data?.featureVitrineActif !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    getFonctionnalitesAvancees()
      .then(res => setFonctionnalitesAvancees(res.data?.fonctionnalites || []))
      .catch(() => {})
      .finally(() => setLoadingAvancees(false));
  }, [authLoading, isSuperAdmin]);

  const enregistrer = async () => {
    setSaving(true);
    try {
      await modifierFonctionnalitesBoutique({ featureTransfertsActif, featureVitrineActif });
      Alert.alert('OK', 'Fonctionnalités mises à jour');
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.error || 'Impossible de mettre à jour les fonctionnalités');
    }
    setSaving(false);
  };

  const basculerFonctionnaliteAvancee = async (f: FonctionnaliteAvancee) => {
    const nouvelEtat = !f.actif;
    setClesEnCours(prev => new Set(prev).add(f.cle));
    try {
      const res = await definirFonctionnaliteAvancee(f.cle, nouvelEtat);
      setFonctionnalitesAvancees(res.data?.fonctionnalites || []);
    } catch (e: any) {
      Alert.alert('Erreur', e.response?.data?.error || 'Impossible de mettre à jour cette fonctionnalité');
    }
    setClesEnCours(prev => { const s = new Set(prev); s.delete(f.cle); return s; });
  };

  if (authLoading) {
    return <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />;
  }

  // Même comportement que l'AuthGuard Ionic (data: { superAdminOnly: true }) qui
  // redirige un ADMIN classique hors de cette page — bloque même un accès direct
  // à l'écran (ex: deep link) et pas seulement le lien du menu.
  if (!isSuperAdmin) {
    return (
      <View style={[st.center, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="shield-lock-outline" size={56} color={colors.danger} />
        <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>
          Accès réservé au super administrateur.
        </Text>
      </View>
    );
  }

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />;
  }

  return (
    <ScrollView style={[st.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16 }}>
      <Text style={[st.intro, { color: colors.textSecondary }]}>
        Active ou désactive certaines fonctionnalités pour cette boutique. Les administrateurs et
        vendeurs ne voient plus ces fonctionnalités une fois désactivées, et ne peuvent pas
        modifier ce réglage eux-mêmes.
      </Text>

      <View style={[st.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.primary} />
        <Text style={[st.rowLabel, { color: colors.text }]}>Transferts inter-boutiques</Text>
        <Switch value={featureTransfertsActif} onValueChange={setFeatureTransfertsActif} color={colors.primary} />
      </View>

      <View style={[st.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="storefront-outline" size={20} color={colors.primary} />
        <Text style={[st.rowLabel, { color: colors.text }]}>Vitrine en ligne (commandes clients)</Text>
        <Switch value={featureVitrineActif} onValueChange={setFeatureVitrineActif} color={colors.primary} />
      </View>

      <Button mode="contained" buttonColor={colors.primary} onPress={enregistrer} loading={saving} style={st.btn}>
        Enregistrer
      </Button>

      <Text style={[st.sectionTitle, { color: colors.text }]}>Fonctionnalités avancées</Text>
      <Text style={[st.intro, { color: colors.textSecondary }]}>
        Pour garder le contrôle sur une boutique (ex: en cas de non-paiement) : chaque bascule
        s'applique immédiatement, y compris sur le serveur — pas seulement dans le menu.
      </Text>

      {loadingAvancees ? (
        <ActivityIndicator style={{ marginTop: 16 }} size="small" color={colors.primary} />
      ) : (
        fonctionnalitesAvancees.map(f => (
          <View style={[st.row, { backgroundColor: colors.card, borderColor: colors.border }]} key={f.cle}>
            <MaterialCommunityIcons name={ICONES[f.cle] || 'toggle-switch-outline'} size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[st.rowLabel, { color: colors.text }]}>{f.libelle}</Text>
              {!!DESCRIPTIONS[f.cle] && <Text style={[st.rowSub, { color: colors.textSecondary }]}>{DESCRIPTIONS[f.cle]}</Text>}
            </View>
            <Switch
              value={f.actif}
              disabled={clesEnCours.has(f.cle)}
              onValueChange={() => basculerFonctionnaliteAvancee(f)}
              color={colors.primary}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  intro: { fontSize: 13, marginBottom: 16 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  rowLabel: { flex: 1, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  btn: { marginTop: 16, borderRadius: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 24, marginBottom: 8 },
});
