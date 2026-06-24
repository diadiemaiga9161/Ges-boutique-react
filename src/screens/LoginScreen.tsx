import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  ScrollView, Image,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login } from '../services/api.service';

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

export default function LoginScreen({ onLogin, navigation }: any) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [showPwd, setShowPwd]       = useState(false);
  const [lang, setLang]             = useState(LANGUAGES[0]);
  const [showLang, setShowLang]     = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('lang').then(code => {
      if (code) {
        const found = LANGUAGES.find(l => l.code === code);
        if (found) setLang(found);
      }
    });
  }, []);

  const selectLang = async (l: typeof LANGUAGES[0]) => {
    setLang(l);
    await AsyncStorage.setItem('lang', l.code);
    setShowLang(false);
  };

  const handleLogin = async () => {
    if (!identifier || !password) { Alert.alert('Erreur', 'Remplis tous les champs'); return; }
    setLoading(true);
    try {
      const res  = await login(identifier, password);
      const data = res.data?.data || res.data;
      const user = { ...data.utilisateur, token: data.token };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('token', data.token);
      onLogin(user);
    } catch (e: any) {
      Alert.alert('Connexion échouée', e.response?.data?.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ══ HERO ══ */}
        <View style={s.hero}>
          <View style={[s.deco, s.deco1]} />
          <View style={[s.deco, s.deco2]} />
          <View style={[s.deco, s.deco3]} />

          {/* Sélecteur de langue */}
          <View style={s.langWrap}>
            <TouchableOpacity style={s.langBtn} onPress={() => setShowLang(!showLang)}>
              <Text style={s.langFlag}>{lang.flag}</Text>
              <Text style={s.langCode}>{lang.code.toUpperCase()}</Text>
              <Text style={s.langChevron}>▾</Text>
            </TouchableOpacity>
            {showLang && (
              <View style={s.langDropdown}>
                {LANGUAGES.map(l => (
                  <TouchableOpacity
                    key={l.code}
                    style={[s.langOption, l.code === lang.code && s.langActive]}
                    onPress={() => selectLang(l)}
                  >
                    <Text style={s.langOptFlag}>{l.flag}</Text>
                    <Text style={[s.langOptName, l.code === lang.code && s.langOptNameActive]}>{l.name}</Text>
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

          {/* Vague de séparation */}
          <Svg viewBox="0 0 375 60" style={s.wave} preserveAspectRatio="none">
            <Path d="M0,20 C60,50 120,0 200,25 C270,48 330,5 375,25 L375,60 L0,60 Z" fill="#f0f4f8" />
          </Svg>
        </View>

        {/* ══ FORMULAIRE ══ */}
        <View style={s.formZone}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Connexion</Text>
            <Text style={s.cardSub}>Accédez à votre espace boutique</Text>

            <View style={s.inputGroup}>
              <Text style={s.label}>👤  Identifiant</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="Email, téléphone ou nom d'utilisateur"
                  placeholderTextColor="#cbd5e1"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>🔒  Mot de passe</Text>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Votre mot de passe"
                  placeholderTextColor="#cbd5e1"
                  secureTextEntry={!showPwd}
                />
                <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={s.eyeBtn}>
                  <Text>{showPwd ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[s.btn, loading && s.btnDis]} onPress={handleLogin} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>Se connecter</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation?.navigate('ForgotPassword')}>
              <Text style={s.forgot}>Mot de passe oublié ?</Text>
            </TouchableOpacity>

            <Text style={s.version}>Ges Lafia · v1.0 · Maïga Consulting</Text>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const DARK  = '#081648';
const BLUE  = '#1a56db';

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { flexGrow: 1 },

  // Hero
  hero:  { backgroundColor: DARK, position: 'relative', overflow: 'hidden' },
  deco:  { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  deco1: { width: 280, height: 280, top: -100, right: -80 },
  deco2: { width: 160, height: 160, top: 30, left: -60 },
  deco3: { width: 90,  height: 90,  bottom: 40, right: 40, opacity: 0.07 },

  // Langue
  langWrap:    { position: 'absolute', top: 48, right: 16, zIndex: 100 },
  langBtn:     {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  langFlag:    { fontSize: 16 },
  langCode:    { color: '#fff', fontSize: 12, fontWeight: '700', marginHorizontal: 4 },
  langChevron: { color: '#fff', fontSize: 10 },
  langDropdown: {
    position: 'absolute', top: 38, right: 0,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#e2e8f0',
    minWidth: 170, elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 16,
    overflow: 'hidden',
  },
  langOption:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  langActive:       { backgroundColor: '#eff6ff' },
  langOptFlag:      { fontSize: 18, marginRight: 10 },
  langOptName:      { fontSize: 14, color: '#1e293b' },
  langOptNameActive:{ fontWeight: '700', color: BLUE },

  // Hero body
  heroBody: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 28 },
  logoBox:  {
    width: 90, height: 90, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
  },
  logoImg:  { width: 68, height: 68, borderRadius: 14 },
  appName:  { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 6, letterSpacing: 0.5 },
  tagline:  { color: 'rgba(255,255,255,0.60)', fontSize: 13, letterSpacing: 0.3 },
  wave:     { width: '100%', height: 56, marginBottom: -2 },

  // Formulaire
  formZone: { backgroundColor: '#f0f4f8', flex: 1, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  card:     {
    backgroundColor: '#fff', borderRadius: 22, padding: 24,
    borderWidth: 1, borderColor: '#e8eef8',
    shadowColor: DARK, shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 24, elevation: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  cardSub:   { fontSize: 13, color: '#94a3b8', marginBottom: 22 },

  inputGroup: { marginBottom: 16 },
  label:      { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6, letterSpacing: 0.2 },
  inputWrap:  {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1.5,
    borderColor: '#e2e8f0', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 2,
  },
  input:   { flex: 1, height: 44, color: '#0f172a', fontSize: 15, fontWeight: '500' },
  eyeBtn:  { padding: 8 },

  btn:     {
    backgroundColor: BLUE, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 4, marginBottom: 8,
    shadowColor: BLUE, shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 22, elevation: 6,
  },
  btnDis:  { opacity: 0.65 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },

  forgot:  { textAlign: 'center', fontSize: 13, color: '#94a3b8', textDecorationLine: 'underline', marginVertical: 8 },
  version: { textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 16, letterSpacing: 0.3 },
});
