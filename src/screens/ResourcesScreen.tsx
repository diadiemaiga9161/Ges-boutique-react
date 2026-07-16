import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Linking,
} from 'react-native';

const DARK = '#081648';
const BLUE = '#1a56db';

const FEATURES = [
  { icon: '🛒', title: 'Ventes & Caisse',         desc: 'Encaissement rapide, Orange Money, Wave et autres modes de paiement.' },
  { icon: '📦', title: 'Gestion de stock',         desc: 'Inventaire temps réel, alertes rupture, niveaux de conditionnement.' },
  { icon: '👥', title: 'Clients & Crédits',        desc: 'Suivi des crédits clients, historique et relances automatiques.' },
  { icon: '📊', title: 'Rapports & Analytics',     desc: 'CA journalier, mensuel, graphiques de performance.' },
  { icon: '🤖', title: 'IA Boutique',              desc: 'Recommandations intelligentes, prévisions de stock, segmentation.' },
  { icon: '🔄', title: 'Transferts inter-boutiques', desc: 'Gestion multi-boutiques et transferts de stock entre points de vente.' },
  { icon: '📋', title: 'Commandes',                desc: 'Gestion des commandes clients et suivi des livraisons.' },
  { icon: '💼', title: 'Fournisseurs',             desc: 'Gestion des achats, dettes fournisseurs et historique.' },
];

const CONTACTS = [
  { icon: '💬', label: 'WhatsApp',         value: '+223 79 99 99 99',          url: 'https://wa.me/22379999999' },
  { icon: '✉️', label: 'Email',            value: 'contact@mg-consulting.site', url: 'mailto:contact@mg-consulting.site' },
  { icon: '🌐', label: 'Amadou Maiga CEO', value: 'diadiemaiga9161.github.io',  url: 'https://diadiemaiga9161.github.io/Portfolio-Maiga-/' },
];

const ABOUT_ROWS = [
  { label: 'Version',        value: '1.0.0' },
  { label: 'Plateforme',     value: 'React Native / Expo' },
  { label: 'Développé par',  value: 'Maïga Consulting' },
  { label: 'Fondateur & CEO', value: 'Amadou Maiga' },
  { label: 'Vision',         value: 'Digitaliser la gestion des boutiques en Afrique avec des outils simples, puissants et accessibles offline' },
  { label: 'Secteur',        value: 'FinTech / Commerce' },
  { label: 'Technologie',    value: 'Angular, Ionic, React Native, Flutter, Spring Boot' },
  { label: 'Contact',        value: 'contact@mg-consulting.site' },
  { label: 'Copyright',      value: '© 2024-2026 Maïga Consulting. Tous droits réservés.' },
];

export default function ResourcesScreen() {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >

      {/* ═══════════════ HERO ═══════════════ */}
      <View style={styles.hero}>
        {/* Bulles décoratives */}
        <View style={[styles.deco, styles.deco1]} />
        <View style={[styles.deco, styles.deco2]} />
        <View style={[styles.deco, styles.deco3]} />

        {/* Logo */}
        <View style={styles.logoBox}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImg} />
        </View>

        {/* Titre */}
        <Text style={styles.heroTitle}>Ges Lafia</Text>
        <Text style={styles.heroSub}>Gestion de boutique intelligente</Text>

        {/* Badge version */}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>v1.0</Text>
        </View>

        <Text style={styles.heroDev}>Développé par MG Consulting · Maïga Consulting</Text>
      </View>

      {/* ═══════════════ FONCTIONNALITÉS ═══════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nos fonctionnalités</Text>
        <View style={styles.grid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ═══════════════ CONTACTS ═══════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Nous contacter</Text>
        <View style={styles.card}>
          {CONTACTS.map((c, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.contactRow, i < CONTACTS.length - 1 && styles.contactRowBorder]}
              onPress={() => Linking.openURL(c.url)}
              activeOpacity={0.7}
            >
              <View style={styles.contactLeft}>
                <Text style={styles.contactIcon}>{c.icon}</Text>
                <View>
                  <Text style={styles.contactLabel}>{c.label}</Text>
                  <Text style={styles.contactValue}>{c.value}</Text>
                </View>
              </View>
              <Text style={styles.contactChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ═══════════════ À PROPOS ═══════════════ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>À propos de l'app</Text>
        <View style={styles.card}>
          {ABOUT_ROWS.map((r, i) => (
            <View
              key={i}
              style={[styles.aboutRow, i < ABOUT_ROWS.length - 1 && styles.aboutRowBorder]}
            >
              <Text style={styles.aboutLabel}>{r.label}</Text>
              <Text style={styles.aboutValue}>{r.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <Text style={styles.footer}>Ges Lafia · Gestion boutique made in Africa 🌍</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f0f4f8' },
  scroll: { paddingBottom: 40 },

  /* ── Hero ── */
  hero: {
    backgroundColor: DARK,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  deco:  { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.05)' },
  deco1: { width: 300, height: 300, top: -120, right: -90 },
  deco2: { width: 180, height: 180, top: 20,   left: -70 },
  deco3: { width: 100, height: 100, bottom: 30, right: 30, opacity: 0.07 },

  logoBox: {
    width: 96, height: 96, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
  },
  logoImg:   { width: 72, height: 72, borderRadius: 16 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
  heroSub:   { color: 'rgba(255,255,255,0.70)', fontSize: 14, marginBottom: 14, textAlign: 'center' },

  badge: {
    backgroundColor: BLUE, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  heroDev: { color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center' },

  /* ── Sections ── */
  section:      { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: DARK,
    marginBottom: 14, letterSpacing: 0.3,
  },

  /* ── Grille fonctionnalités ── */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: DARK,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  featureIcon:  { fontSize: 28, marginBottom: 8 },
  featureTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', marginBottom: 6, lineHeight: 18 },
  featureDesc:  { fontSize: 11, color: '#64748b', lineHeight: 16 },

  /* ── Card générique ── */
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: DARK,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },

  /* ── Contacts ── */
  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 16,
  },
  contactRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  contactLeft:   { flexDirection: 'row', alignItems: 'center', gap: 14 },
  contactIcon:   { fontSize: 24, marginRight: 14 },
  contactLabel:  { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginBottom: 2, letterSpacing: 0.2 },
  contactValue:  { fontSize: 14, color: BLUE, fontWeight: '700' },
  contactChevron: { fontSize: 22, color: '#cbd5e1', fontWeight: '300' },

  /* ── À propos ── */
  aboutRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 15,
  },
  aboutRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  aboutLabel:     { fontSize: 13, color: '#64748b', fontWeight: '500' },
  aboutValue:     { fontSize: 13, color: '#0f172a', fontWeight: '700', maxWidth: '58%', textAlign: 'right' },

  /* ── Footer ── */
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 32,
    marginBottom: 8,
    letterSpacing: 0.3,
    paddingHorizontal: 16,
  },
});
