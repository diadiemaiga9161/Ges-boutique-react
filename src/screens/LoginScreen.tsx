import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { login } from '../services/api.service';
import { useLang } from '../i18n/LangContext';
import { tr } from '../i18n';

const LANGUAGES = [
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'ar', flag: '🇸🇦', name: 'العربية' },
  { code: 'wo', flag: '🌍', name: 'Wolof' },
  { code: 'bm', flag: '🌍', name: 'Bambara' },
  { code: 'ff', flag: '🌍', name: 'Fula' },
  { code: 'sw', flag: '🌍', name: 'Kiswahili' },
  { code: 'pt', flag: '🇵🇹', name: 'Português' },
];

export default function LoginScreen({ onLogin }: any) {
  const navigation = useNavigation<any>();
  const { lang, setLang } = useLang();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPwd, setShowPwd]       = useState(false);
  const [showLang, setShowLang]     = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const selectLang = async (l: typeof LANGUAGES[0]) => {
    await setLang(l.code);
    setShowLang(false);
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert(tr('erreur', lang), tr('remplir_champs', lang));
      return;
    }
    setLoading(true);
    try {
      const res  = await login(identifier, password);
      const data = res.data?.data || res.data;
      // Le backend renvoie { token, username, role, nomComplet, ... } à la racine
      const user = { ...data };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('token', data.token);
      onLogin(user);
    } catch (e: any) {
      let msg: string;
      if (e.response) {
        // Le serveur a répondu avec une erreur HTTP
        msg = e.response.data?.message
           || e.response.data?.error
           || `Erreur ${e.response.status}`;
      } else if (e.request) {
        // Requête envoyée mais pas de réponse (hors ligne / serveur éteint)
        msg = tr('serveur_inaccessible', lang);
      } else {
        msg = e.message || tr('identifiants_incorrects', lang);
      }
      Alert.alert(tr('connexion_echouee', lang), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    // Fix clavier Android : behavior="height" au lieu de undefined
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? 0 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══ HERO ══ */}
        <View style={s.hero}>
          <View style={[s.deco, s.deco1]} />
          <View style={[s.deco, s.deco2]} />
          <View style={[s.deco, s.deco3]} />

          {/* Sélecteur de langue — utilise le contexte global */}
          <View style={s.langWrap}>
            <TouchableOpacity style={s.langBtn} onPress={() => setShowLang(!showLang)}>
              <Text style={s.langFlag}>{currentLang.flag}</Text>
              <Text style={s.langCode}>{currentLang.code.toUpperCase()}</Text>
              <Text style={s.langChevron}>▾</Text>
            </TouchableOpacity>
            {showLang && (
              <View style={s.langDropdown}>
                {LANGUAGES.map(l => (
                  <TouchableOpacity
                    key={l.code}
                    style={[s.langOption, l.code === lang && s.langActive]}
                    onPress={() => selectLang(l)}
                  >
                    <Text style={s.langOptFlag}>{l.flag}</Text>
                    <Text style={[s.langOptName, l.code === lang && s.langOptNameActive]}>{l.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Logo + nom */}
          <View style={s.heroBody}>
            <View style={s.logoBox}>
              <Image source={require('../../assets/icon.png')} style={s.logoImg} />
            </View>
            <Text style={s.appName}>Ges Lafia</Text>
            <Text style={s.tagline}>Maïga Consulting · Gestion de boutique</Text>
          </View>

          {/* Vague */}
          <Svg viewBox="0 0 375 60" style={s.wave} preserveAspectRatio="none">
            <Path d="M0,20 C60,50 120,0 200,25 C270,48 330,5 375,25 L375,60 L0,60 Z" fill="#f0f4f8" />
          </Svg>
        </View>

        {/* ══ FORMULAIRE ══ */}
        <View style={s.formZone}>
          <View style={s.card}>
            <Text style={s.cardTitle}>{tr('connexion', lang)}</Text>
            <Text style={s.cardSub}>{tr('sub_connexion', lang)}</Text>

            <View style={s.inputGroup}>
              <Text style={s.label}>👤  {tr('identifiant', lang)}</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={tr('placeholder_id', lang)}
                  placeholderTextColor="#cbd5e1"
                  autoCapitalize="none"
                  keyboardType="default"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>🔒  {tr('mot_de_passe', lang)}</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={tr('placeholder_pwd', lang)}
                  placeholderTextColor="#cbd5e1"
                  secureTextEntry={!showPwd}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => {
                    if (Platform.OS === 'android') {
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                    }
                  }}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
                  <Text style={{ fontSize: 18 }}>{showPwd ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lien mot de passe oublié — visible, AVANT le bouton connexion */}
            <TouchableOpacity style={s.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={s.forgotText}>{tr('mdp_oublie', lang)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, loading && s.btnDis]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{tr('se_connecter', lang)}</Text>
              }
            </TouchableOpacity>

            <Text style={s.version}>Ges Lafia · v1.0 · Maïga Consulting</Text>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const DARK = '#081648';
const BLUE = '#1a56db';

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { flexGrow: 1 },

  hero:  { backgroundColor: DARK, position: 'relative', overflow: 'hidden' },
  deco:  { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  deco1: { width: 280, height: 280, top: -100, right: -80 },
  deco2: { width: 160, height: 160, top: 30, left: -60 },
  deco3: { width: 90, height: 90, bottom: 40, right: 40, opacity: 0.07 },

  langWrap:    { position: 'absolute', top: 48, right: 16, zIndex: 100 },
  langBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  langFlag:    { fontSize: 16 },
  langCode:    { color: '#fff', fontSize: 12, fontWeight: '700', marginHorizontal: 4 },
  langChevron: { color: '#fff', fontSize: 10 },
  langDropdown: { position: 'absolute', top: 38, right: 0, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', minWidth: 170, elevation: 16, shadowColor: '#000', shadowOpacity: 0.18, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, overflow: 'hidden' },
  langOption:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  langActive:       { backgroundColor: '#eff6ff' },
  langOptFlag:      { fontSize: 18, marginRight: 10 },
  langOptName:      { fontSize: 14, color: '#1e293b' },
  langOptNameActive: { fontWeight: '700', color: BLUE },

  heroBody: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 28 },
  logoBox:  { width: 90, height: 90, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  logoImg:  { width: 68, height: 68, borderRadius: 14 },
  appName:  { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 6, letterSpacing: 0.5 },
  tagline:  { color: 'rgba(255,255,255,0.60)', fontSize: 13, letterSpacing: 0.3 },
  wave:     { width: '100%', height: 56, marginBottom: -2 },

  formZone: { backgroundColor: '#f0f4f8', flex: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  card:     { backgroundColor: '#fff', borderRadius: 22, padding: 24, borderWidth: 1, borderColor: '#e8eef8', shadowColor: DARK, shadowOpacity: 0.10, shadowOffset: { width: 0, height: 4 }, shadowRadius: 24, elevation: 4 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardSub:   { fontSize: 13, color: '#94a3b8', marginBottom: 22 },

  inputGroup: { marginBottom: 16 },
  label:      { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6, letterSpacing: 0.2 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 2 },
  input:      { flex: 1, height: 44, color: '#0f172a', fontSize: 15, fontWeight: '500' },
  eyeBtn:     { padding: 8 },

  btn:     { backgroundColor: BLUE, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 4, marginBottom: 8, shadowColor: BLUE, shadowOpacity: 0.38, shadowOffset: { width: 0, height: 6 }, shadowRadius: 22, elevation: 6 },
  btnDis:  { opacity: 0.65 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  forgotRow:  { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 4, marginBottom: 12 },
  forgotText: { fontSize: 13, color: BLUE, fontWeight: '600', textDecorationLine: 'underline' },
  version: { textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 16, letterSpacing: 0.3 },
});
