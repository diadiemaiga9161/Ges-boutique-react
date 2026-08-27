import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';
import { marquerTutorielVendeurVu } from '../utils/tutorielVendeur';

// Feature "Tutoriel d'accueil vendeur" — 100% local (AsyncStorage), aucun
// appel réseau. Réutilise l'esprit visuel du wizard IAScreen (fond DARK,
// carte progression + boutons Précédent/Suivant), en overlay plein écran.
const DARK = '#081648';
const BLUE = '#1a56db';
const NB_ETAPES = 4;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Id de l'utilisateur connecté — sert de clé AsyncStorage pour ne plus jamais réafficher automatiquement. */
  userId?: number | string;
}

export default function TutorielVendeurModal({ visible, onClose, userId }: Props) {
  const { lang } = useLang();
  const [etape, setEtape] = useState(0);
  const [nomComplet, setNomComplet] = useState('');
  const [boutiqueNom, setBoutiqueNom] = useState('');

  // Recharge le contexte (nom utilisateur / boutique) à chaque ouverture —
  // purement pour l'affichage de l'étape "Bienvenue", aucun impact sur la
  // logique offline/synchro.
  useEffect(() => {
    if (!visible) return;
    setEtape(0);
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem('user');
        if (rawUser) setNomComplet(JSON.parse(rawUser)?.nomComplet || '');
      } catch {}
      try {
        const rawBoutique = await AsyncStorage.getItem('boutique_info');
        const nomInfo = rawBoutique ? JSON.parse(rawBoutique)?.nom : null;
        const nomSimple = await AsyncStorage.getItem('boutique_nom');
        setBoutiqueNom(nomInfo || nomSimple || '');
      } catch {}
    })();
  }, [visible]);

  const fermerEtMarquerVu = async () => {
    if (userId != null) {
      try { await marquerTutorielVendeurVu(userId); } catch {}
    }
    onClose();
  };

  const suivant = () => setEtape(e => Math.min(e + 1, NB_ETAPES - 1));
  const precedent = () => setEtape(e => Math.max(e - 1, 0));

  const estDerniereEtape = etape === NB_ETAPES - 1;
  const progressPct = Math.round(((etape + 1) / NB_ETAPES) * 100);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={fermerEtMarquerVu}>
      <View style={s.root}>
        {/* Croix de fermeture — équivalente à "Compris" : marque aussi comme vu */}
        <TouchableOpacity style={s.closeBtn} onPress={fermerEtMarquerVu} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialCommunityIcons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={s.header}>
          <MaterialCommunityIcons name="hand-wave-outline" size={36} color="#93c5fd" />
          <Text style={s.stepLabel}>{tr('tuto_vendeur_etape', lang)} {etape + 1}/{NB_ETAPES}</Text>
        </View>

        <View style={s.progressOuter}>
          <View style={[s.progressInner, { width: `${progressPct}%` as any }]} />
        </View>

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {etape === 0 && (
            <View style={s.stepBody}>
              <View style={s.iconWrap}>
                <MaterialCommunityIcons name="storefront-outline" size={48} color={BLUE} />
              </View>
              <Text style={s.title}>{tr('tuto_vendeur_titre_bienvenue', lang)}{nomComplet ? ` ${nomComplet}` : ''}</Text>
              {!!boutiqueNom && <Text style={s.boutiqueNom}>{boutiqueNom}</Text>}
              <View style={s.roleBadge}>
                <MaterialCommunityIcons name="account-outline" size={14} color={BLUE} />
                <Text style={s.roleBadgeTxt}>{tr('tuto_vendeur_role_vendeur', lang)}</Text>
              </View>
              <Text style={s.text}>{tr('tuto_vendeur_intro_texte', lang)}</Text>
            </View>
          )}

          {etape === 1 && (
            <View style={s.stepBody}>
              <View style={s.iconWrap}>
                <MaterialCommunityIcons name="cart-outline" size={48} color={BLUE} />
              </View>
              <Text style={s.title}>{tr('tuto_vendeur_titre_vente', lang)}</Text>
              <Text style={s.text}>{tr('tuto_vendeur_texte_vente', lang)}</Text>
            </View>
          )}

          {etape === 2 && (
            <View style={s.stepBody}>
              <View style={s.iconWrap}>
                <MaterialCommunityIcons name="hand-coin-outline" size={48} color={BLUE} />
              </View>
              <Text style={s.title}>{tr('tuto_vendeur_titre_credit', lang)}</Text>
              <Text style={s.text}>{tr('tuto_vendeur_texte_credit', lang)}</Text>
            </View>
          )}

          {etape === 3 && (
            <View style={s.stepBody}>
              <View style={s.iconWrap}>
                <MaterialCommunityIcons name="check-circle-outline" size={48} color="#10b981" />
              </View>
              <Text style={s.title}>{tr('tuto_vendeur_titre_fin', lang)}</Text>
              <Text style={s.text}>{tr('tuto_vendeur_texte_fin', lang)}</Text>
            </View>
          )}
        </ScrollView>

        <View style={s.footer}>
          {etape > 0 && (
            <TouchableOpacity style={s.btnPrecedent} onPress={precedent}>
              <Text style={s.btnPrecedentTxt}>{tr('tuto_vendeur_precedent', lang)}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.btnSuivant} onPress={estDerniereEtape ? fermerEtMarquerVu : suivant}>
            <Text style={s.btnSuivantTxt}>
              {estDerniereEtape ? tr('tuto_vendeur_bouton_fin', lang) : tr('tuto_vendeur_suivant', lang)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK },
  closeBtn: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 4 },
  header: { alignItems: 'center', paddingTop: 52, paddingBottom: 16, paddingHorizontal: 24 },
  stepLabel: { color: '#93c5fd', fontSize: 13, marginTop: 10, fontWeight: '600' },
  progressOuter: { height: 5, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 24, borderRadius: 3 },
  progressInner: { height: 5, backgroundColor: '#60a5fa', borderRadius: 3 },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  stepBody: { alignItems: 'center' },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 22,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  boutiqueNom: { color: 'rgba(255,255,255,0.65)', fontSize: 14, textAlign: 'center', marginBottom: 10 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    marginTop: 4, marginBottom: 18,
  },
  roleBadgeTxt: { color: '#93c5fd', fontSize: 12, fontWeight: '700' },
  text: { color: 'rgba(255,255,255,0.80)', fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12, padding: 24, paddingBottom: 48 },
  btnPrecedent: {
    flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  btnPrecedentTxt: { color: '#93c5fd', fontSize: 15, fontWeight: '600' },
  btnSuivant: {
    flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: BLUE,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSuivantTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
