import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getBoutique, updateBoutique, getPermissionsVendeur, definirPermissionVendeur,
  getParametresFidelite, definirParametresFidelite,
} from '../services/api.service';
import { executerOuMettreEnFile } from '../services/offline.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { useColors } from '../theme/colors';

export default function BoutiqueSettingsScreen() {
  const { lang } = useLang();
  const colors = useColors();
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conditionnement, setConditionnement] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  // Permissions vendeur (système générique, séparé des fonctionnalités avancées) —
  // accordable par n'importe quel admin (pas besoin de super admin) pour donner au
  // vendeur un accès en lecture seule à certaines pages (ex: Inventaire).
  const [inventaireLectureActive, setInventaireLectureActive] = useState(false);
  // Fidélité (CleFonctionnalite.PROGRAMME_FIDELITE) — masquée si désactivée par
  // le super admin, exactement comme les autres fonctionnalités avancées (cache
  // 'fonctionnalites_avancees_desactivees', voir LoginScreen.tsx). Réglable par
  // n'importe quel admin normal (PUT /fidelite/parametres, pas besoin de super
  // admin) — contrairement à l'écran SuperAdminFonctionnalitesScreen qui, lui,
  // se contente d'activer/désactiver la fonctionnalité elle-même.
  const [fideliteActif, setFideliteActif] = useState(false);
  const [fideliteForm, setFideliteForm] = useState({ montantParPoint: '', pointValeur: '' });
  const [savingFidelite, setSavingFidelite] = useState(false);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem('boutique_info');
      if (stored) { setForm(JSON.parse(stored)); setFromCache(true); }
      const cond = await AsyncStorage.getItem('feat_conditionnement');
      setConditionnement(cond === 'true');
      try {
        const res = await getBoutique();
        const data = res.data?.boutique || res.data?.data || res.data;
        if (data) { setForm(data); setFromCache(false); await AsyncStorage.setItem('boutique_info', JSON.stringify(data)); }
      } catch { }
      try {
        const pRes = await getPermissionsVendeur();
        const permissions = pRes.data?.permissions || [];
        const p = permissions.find((x: any) => x.cle === 'INVENTAIRE_LECTURE');
        setInventaireLectureActive(!!p?.actif);
      } catch { }
      const raw = await AsyncStorage.getItem('fonctionnalites_avancees_desactivees');
      let desactivees: string[] = [];
      if (raw) { try { desactivees = JSON.parse(raw); } catch { /* ignore */ } }
      const actif = !desactivees.includes('PROGRAMME_FIDELITE');
      setFideliteActif(actif);
      if (actif) {
        try {
          const fRes = await getParametresFidelite();
          setFideliteForm({
            montantParPoint: fRes.data?.montantParPoint != null ? String(fRes.data.montantParPoint) : '',
            pointValeur: fRes.data?.pointValeur != null ? String(fRes.data.pointValeur) : '',
          });
        } catch { /* hors ligne ou fonctionnalité indisponible — champs vides */ }
      }
      setLoading(false);
    };
    load();
  }, []);

  const sauvegarder = async () => {
    setSaving(true);
    // Ecrit toujours localement d'abord, puis empile pour synchro si hors ligne
    // (skill offline-first) — sinon un admin qui modifie les infos boutique
    // sans réseau perdait purement et simplement sa saisie.
    await AsyncStorage.setItem('boutique_info', JSON.stringify(form));
    const { offline } = await executerOuMettreEnFile('boutique_update', form, () => updateBoutique(form));
    setFromCache(offline);
    Alert.alert(
      offline ? tr('hors_ligne', lang) : tr('succes', lang),
      offline ? 'Enregistré localement — sera synchronisé au retour du réseau.' : 'Paramètres enregistrés'
    );
    setSaving(false);
  };

  const toggleConditionnement = async (v: boolean) => {
    setConditionnement(v);
    await AsyncStorage.setItem('feat_conditionnement', String(v));
  };

  const toggleInventaireLecture = async (v: boolean) => {
    setInventaireLectureActive(v);
    try {
      await definirPermissionVendeur('INVENTAIRE_LECTURE', v);
      Alert.alert(
        tr('succes', lang),
        v ? 'Le vendeur peut désormais consulter l\'inventaire (lecture seule).' : "L'accès du vendeur à l'inventaire a été retiré."
      );
    } catch {
      setInventaireLectureActive(!v);
      Alert.alert(tr('erreur', lang), "Impossible de modifier cette permission — vérifiez votre connexion.");
    }
  };

  const enregistrerFidelite = async () => {
    const montantParPoint = Number(fideliteForm.montantParPoint);
    const pointValeur = Number(fideliteForm.pointValeur);
    if (!montantParPoint || montantParPoint <= 0 || !pointValeur || pointValeur <= 0) {
      Alert.alert(tr('erreur', lang), tr('fidelite_parametres_invalide', lang));
      return;
    }
    setSavingFidelite(true);
    try {
      await definirParametresFidelite({ montantParPoint, pointValeur });
      Alert.alert(tr('succes', lang), tr('fidelite_parametres_succes', lang));
    } catch (e: any) {
      Alert.alert(tr('erreur', lang), e.response?.data?.message || tr('fidelite_parametres_erreur', lang));
    }
    setSavingFidelite(false);
  };

  // Comme reset() sur Ionic : purement local, aucun appel réseau — remet le
  // formulaire aux valeurs par défaut de l'app (pas un reset serveur).
  const DEFAULT_BOUTIQUE = { nom: 'Ma Boutique', devise: 'FCFA' };
  const reinitialiser = () => {
    Alert.alert('Réinitialiser les paramètres ?', 'Le formulaire reviendra aux valeurs par défaut (non enregistré tant que vous n\'appuyez pas sur Enregistrer).', [
      { text: tr('annuler', lang), style: 'cancel' },
      { text: 'Réinitialiser', style: 'destructive', onPress: () => setForm(DEFAULT_BOUTIQUE) },
    ]);
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ padding: 16 }}>
      <Text variant="titleMedium" style={[styles.section, { color: colors.primary }]}>{tr('infos_boutique', lang)}</Text>
      <TextInput label={tr('nom_boutique', lang) + ' *'} value={form.nom || ''} onChangeText={t => setForm({ ...form, nom: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('telephone', lang)} value={form.telephone || ''} onChangeText={t => setForm({ ...form, telephone: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label={tr('telephone', lang) + ' 2 (rapport)'} value={form.telephone2 || ''} onChangeText={t => setForm({ ...form, telephone2: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label={tr('telephone', lang) + ' 3 (rapport)'} value={form.telephone3 || ''} onChangeText={t => setForm({ ...form, telephone3: t })} mode="outlined" keyboardType="phone-pad" style={styles.input} />
      <TextInput label={tr('email', lang)} value={form.email || ''} onChangeText={t => setForm({ ...form, email: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('adresse', lang)} value={form.adresse || ''} onChangeText={t => setForm({ ...form, adresse: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('ville', lang)} value={form.ville || ''} onChangeText={t => setForm({ ...form, ville: t })} mode="outlined" style={styles.input} />
      <TextInput label="Pays" value={form.pays || ''} onChangeText={t => setForm({ ...form, pays: t })} mode="outlined" style={styles.input} />
      <TextInput label={tr('devise', lang)} value={form.devise || 'FCFA'} onChangeText={t => setForm({ ...form, devise: t })} mode="outlined" style={styles.input} />

      <Text variant="titleMedium" style={[styles.section, { color: colors.primary }]}>Informations légales</Text>
      <TextInput label="Numéro RC (Registre du commerce)" value={form.numeroRc || ''} onChangeText={t => setForm({ ...form, numeroRc: t })} mode="outlined" style={styles.input} />
      <TextInput label="Numéro IFU (Identifiant fiscal)" value={form.numeroIfu || ''} onChangeText={t => setForm({ ...form, numeroIfu: t })} mode="outlined" style={styles.input} />
      <TextInput label="Description" value={form.description || ''} onChangeText={t => setForm({ ...form, description: t })} mode="outlined" multiline numberOfLines={3} style={styles.input} />

      <Text variant="titleMedium" style={[styles.section, { color: colors.primary }]}>Fonctionnalités</Text>
      <View style={[styles.switchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.text }}>Gestion par conditionnement</Text>
        <Switch value={conditionnement} onValueChange={toggleConditionnement} color={colors.primary} />
      </View>

      <Text variant="titleMedium" style={[styles.section, { color: colors.primary }]}>Permissions vendeur</Text>
      <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>Donner au vendeur un accès en lecture seule à certaines pages</Text>
      <View style={[styles.switchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.text }}>Le vendeur peut consulter l'inventaire</Text>
        <Switch value={inventaireLectureActive} onValueChange={toggleInventaireLecture} color={colors.primary} />
      </View>

      <Button mode="contained" buttonColor={colors.primary} onPress={sauvegarder} loading={saving} style={styles.btn}>
        {tr('enregistrer', lang)}
      </Button>
      <Button mode="outlined" onPress={reinitialiser} style={[styles.btn, { borderColor: colors.border }]} textColor={colors.textSecondary}>
        Réinitialiser
      </Button>

      {fideliteActif && (
        <>
          <Text variant="titleMedium" style={[styles.section, { color: colors.primary }]}>{tr('fidelite_parametres_titre', lang)}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>{tr('fidelite_parametres_sous_titre', lang)}</Text>
          <TextInput
            label={tr('fidelite_montant_par_point_label', lang)}
            value={fideliteForm.montantParPoint}
            onChangeText={t => setFideliteForm(f => ({ ...f, montantParPoint: t.replace(/[^0-9.]/g, '') }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <TextInput
            label={tr('fidelite_valeur_point_label', lang)}
            value={fideliteForm.pointValeur}
            onChangeText={t => setFideliteForm(f => ({ ...f, pointValeur: t.replace(/[^0-9.]/g, '') }))}
            mode="outlined"
            keyboardType="numeric"
            style={styles.input}
          />
          <Button mode="contained" buttonColor={colors.primary} onPress={enregistrerFidelite} loading={savingFidelite} style={styles.btn}>
            {tr('enregistrer', lang)}
          </Button>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  offlineBanner: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#f97316', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  offlineBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  section: { fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  input: { marginBottom: 12 },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, padding: 16, borderRadius: 16, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  btn: { marginTop: 8, borderRadius: 12 },
});
