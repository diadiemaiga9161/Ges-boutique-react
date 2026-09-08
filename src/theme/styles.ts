/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         GES LAFIA — Design System RN (≡ Ionic)          ║
 * ║   Miroir exact de global.scss + variables.scss Ionic     ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * Toutes les valeurs ici correspondent 1-pour-1 aux variables
 * CSS et classes SCSS du projet Ionic (ges-boutique-mobile).
 */
import { StyleSheet } from 'react-native';

// ══════════════════════════════════════════════════
//  PALETTE (≡ variables.scss :root)
// ══════════════════════════════════════════════════
export const GL = {
  // Blues
  blue900: '#081648',
  blue800: '#0d2b85',
  blue700: '#1447c0',
  blue600: '#1a56db',
  blue500: '#2563eb',
  blue400: '#3b72f6',
  blue100: '#dbeafe',
  blue50:  '#eff6ff',

  // Greens
  green600: '#059669',
  green500: '#0e9f6e',
  green100: '#d1fae5',
  green50:  '#ecfdf5',

  // Oranges
  orange600: '#d97706',
  orange500: '#f59e0b',
  orange100: '#fde68a',
  orange50:  '#fffbeb',

  // Reds
  red600: '#dc2626',
  red500: '#ef4444',
  red100: '#fee2e2',
  red50:  '#fef2f2',

  // Purples
  purple500: '#a855f7',
  purple700: '#6d28d9',

  // Teals
  teal500: '#14b8a6',
  teal700: '#0f766e',

  // Navies
  navy700: '#1e40af',
  navy800: '#1e3a8a',

  // Slates
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
  slate400: '#94a3b8',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  slate50:  '#f8fafc',

  // Backgrounds
  bg:    '#f0f4f8',
  white: '#ffffff',
};

// ══════════════════════════════════════════════════
//  HERO CARD (≡ .hero-card — bannière gradient bleu)
// ══════════════════════════════════════════════════
export const heroCard = StyleSheet.create({
  container: {
    background: undefined, // gradient géré inline via LinearGradient ou backgroundColor
    backgroundColor: GL.blue900,
    color: GL.white,
    padding: 18,
    paddingTop: 20,
    paddingBottom: 22,
    position: 'relative',
    overflow: 'hidden',
  },
  deco1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -70,
    right: -50,
  },
  deco2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -30,
    left: -20,
  },
  icon:  { fontSize: 32, opacity: 0.8 },
  label: { fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3, color: GL.white },
  value: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 30, color: GL.white },
  sub:   { fontSize: 12, opacity: 0.65, marginTop: 5, color: GL.white },
});

// ══════════════════════════════════════════════════
//  COLOR CARDS (≡ .color-card .cc-*)
// ══════════════════════════════════════════════════
export const colorCard = StyleSheet.create({
  base: {
    borderRadius: 16,
    padding: 14,
    flex: 1,
    flexDirection: 'column',
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  label: { fontSize: 10, opacity: 0.8, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700', color: GL.white },
  value: { fontSize: 17, fontWeight: '800', margin: 0, letterSpacing: -0.3, color: GL.white },
  sub:   { fontSize: 11, opacity: 0.65, marginTop: 2, color: GL.white },

  // Couleurs (≡ .cc-blue, .cc-green, .cc-orange, .cc-red, .cc-purple, .cc-teal, .cc-navy)
  blue:   { backgroundColor: GL.blue600 },   // gradient simulé: from #1a56db to #081648
  green:  { backgroundColor: GL.green500 },  // gradient simulé: from #0e9f6e to #065f46
  orange: { backgroundColor: GL.orange500 }, // gradient simulé: from #f59e0b to #b45309
  red:    { backgroundColor: GL.red600 },    // gradient simulé: from #ef4444 to #991b1b
  purple: { backgroundColor: GL.purple500 }, // gradient simulé: from #a855f7 to #6d28d9
  teal:   { backgroundColor: GL.teal500 },   // gradient simulé: from #14b8a6 to #0f766e
  navy:   { backgroundColor: GL.navy700 },   // gradient simulé: from #1e40af to #1e3a8a
});

// ══════════════════════════════════════════════════
//  MOBILE CARD (≡ .mobile-card — carte blanche)
// ══════════════════════════════════════════════════
export const mobileCard = StyleSheet.create({
  base: {
    backgroundColor: GL.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: GL.blue900,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8eef8',
    marginBottom: 10,
  },
  annulee: {
    opacity: 0.55,
    backgroundColor: GL.slate50,
  },
  creditRetard: {
    borderLeftWidth: 3,
    borderLeftColor: GL.red600,
  },
});

// ══════════════════════════════════════════════════
//  METRIC CARD (≡ .metric-card — stat blanche)
// ══════════════════════════════════════════════════
export const metricCard = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  base: {
    backgroundColor: GL.white,
    borderRadius: 14,
    padding: 14,
    shadowColor: GL.blue900,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8eef8',
    flex: 1,
    minWidth: '45%',
  },
  label: {
    fontSize: 10,
    color: GL.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontWeight: '700',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    color: GL.slate900,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 11,
    color: GL.slate400,
    marginTop: 3,
  },
});

// ══════════════════════════════════════════════════
//  KPI TILE (≡ .kpi-tile — Ionic home.page.scss)
//  Tuile blanche avec bordure top colorée
// ══════════════════════════════════════════════════
export const kpiTile = StyleSheet.create({
  base: {
    backgroundColor: GL.white,
    borderRadius: 16,
    padding: 12,
    paddingHorizontal: 10,
    shadowColor: GL.blue900,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8eef8',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  blue:   { borderTopColor: GL.blue600 },
  orange: { borderTopColor: GL.orange500 },
  red:    { borderTopColor: GL.red600 },
  green:  { borderTopColor: GL.green500 },
  purple: { borderTopColor: GL.purple500 },

  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapBlue:   { backgroundColor: GL.blue50 },
  iconWrapOrange: { backgroundColor: GL.orange50 },
  iconWrapRed:    { backgroundColor: GL.red50 },
  iconWrapGreen:  { backgroundColor: GL.green50 },
  iconWrapPurple: { backgroundColor: '#f5f3ff' },

  label: {
    fontSize: 10,
    color: GL.slate400,
    margin: 0,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    color: GL.slate900,
    margin: 0,
    letterSpacing: -0.2,
  },
});

// ══════════════════════════════════════════════════
//  QUICK TILE (≡ .quick-tile — Ionic home.page.scss)
// ══════════════════════════════════════════════════
export const quickTile = StyleSheet.create({
  base: {
    backgroundColor: GL.white,
    borderWidth: 1,
    borderColor: '#e8eef8',
    borderRadius: 16,
    padding: 14,
    paddingHorizontal: 12,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 5,
    shadowColor: GL.blue900,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 1,
    width: '47%',
    position: 'relative',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: GL.blue50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: GL.slate900,
    lineHeight: 17,
  },
  sub: {
    fontSize: 11,
    color: GL.slate400,
    lineHeight: 14,
  },
  arrow: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
});

// ══════════════════════════════════════════════════
//  SECTION LABEL (≡ .section-label)
// ══════════════════════════════════════════════════
export const sectionLabel = StyleSheet.create({
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: GL.slate400,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
  },
});

// ══════════════════════════════════════════════════
//  FILTER ZONE (≡ .filter-zone / .fz-*)
// ══════════════════════════════════════════════════
export const filterZone = StyleSheet.create({
  container: {
    backgroundColor: GL.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: GL.blue900,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8eef8',
    marginBottom: 12,
    gap: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GL.slate100,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    color: GL.slate900,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: GL.blue50,
    borderWidth: 1.5,
    borderColor: GL.blue100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
  },
  chipActive: {
    backgroundColor: GL.blue600,
    borderColor: GL.blue600,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: GL.blue600,
  },
  chipTextActive: {
    color: GL.white,
  },
  chipWarn: {
    backgroundColor: GL.orange50,
    borderColor: GL.orange100,
  },
  chipWarnText: {
    color: GL.orange600,
  },
  chipGreen: {
    backgroundColor: GL.green50,
    borderColor: GL.green100,
  },
  chipGreenText: {
    color: GL.green600,
  },
});

// ══════════════════════════════════════════════════
//  BADGE (≡ ion-badge)
// ══════════════════════════════════════════════════
export const badge = StyleSheet.create({
  base: {
    borderRadius: 8,
    fontWeight: '700',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    letterSpacing: 0.3,
  },
  blue:   { backgroundColor: GL.blue600 },
  green:  { backgroundColor: GL.green500 },
  orange: { backgroundColor: GL.orange500 },
  red:    { backgroundColor: GL.red600 },
  light:  { backgroundColor: GL.slate100 },
  baseText: { color: GL.white, fontWeight: '700', fontSize: 11 },
  lightText: { color: GL.slate700 },
});

// ══════════════════════════════════════════════════
//  FORM PANEL (≡ .form-panel)
// ══════════════════════════════════════════════════
export const formPanel = StyleSheet.create({
  base: {
    backgroundColor: GL.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: GL.blue900,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8eef8',
    marginBottom: 12,
  },
});

// ══════════════════════════════════════════════════
//  INPUT STYLES (≡ ion-item / ion-input)
// ══════════════════════════════════════════════════
export const inputStyles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: GL.slate700,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GL.slate50,
    borderWidth: 1.5,
    borderColor: GL.slate200,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginBottom: 6,
    minHeight: 48,
  },
  wrapFocus: {
    borderColor: GL.blue600,
    backgroundColor: GL.blue50,
    shadowColor: GL.blue600,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 2,
  },
  field: {
    flex: 1,
    height: 44,
    color: GL.slate900,
    fontSize: 15,
    fontWeight: '500',
  },
});

// ══════════════════════════════════════════════════
//  BUTTON (≡ ion-button expand="block")
// ══════════════════════════════════════════════════
export const btnStyles = StyleSheet.create({
  primary: {
    backgroundColor: GL.blue600,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: GL.blue600,
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 22,
    elevation: 6,
    marginTop: 4,
  },
  primaryText: {
    color: GL.white,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  danger: {
    backgroundColor: GL.red600,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    elevation: 4,
  },
  dangerText: {
    color: GL.white,
    fontSize: 16,
    fontWeight: '800',
  },
  outline: {
    borderWidth: 2,
    borderColor: GL.blue600,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  outlineText: {
    color: GL.blue600,
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: { opacity: 0.65 },
});

// ══════════════════════════════════════════════════
//  PAGE LAYOUT (≡ .page-pad .stack)
// ══════════════════════════════════════════════════
export const pageLayout = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GL.bg,
  },
  pad: {
    padding: 16,
  },
  stack: {
    gap: 12,
  },
  colorCardsRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    paddingBottom: 0,
  },
});
