import { useThemeMode } from './ThemeContext';

export const lightColors = {
  background: '#f0f4f8',
  surface: '#ffffff',
  card: '#ffffff',
  inputBg: '#f8fafc',
  overlay: 'rgba(0,0,0,0.5)',
  primary: '#1a56db',
  primaryDark: '#0e3a8c',
  text: '#0f172a',
  textSecondary: '#64748b',
  placeholder: '#94a3b8',
  border: '#e2e8f0',
  success: '#065f46',
  successBg: '#d1fae5',
  danger: '#991b1b',
  dangerBg: '#fee2e2',
  warning: '#92400e',
  warningBg: '#fef3c7',
  info: '#0284c7',
  infoBg: '#e0f2fe',
  hero: '#081648',
  heroBg: '#1a56db',
};

export const darkColors: typeof lightColors = {
  background: '#111827',
  surface: '#1f2937',
  card: '#1f2937',
  inputBg: '#111827',
  overlay: 'rgba(0,0,0,0.7)',
  primary: '#3b82f6',
  primaryDark: '#1d4ed8',
  text: '#f9fafb',
  textSecondary: '#9ca3af',
  placeholder: '#6b7280',
  border: '#374151',
  success: '#34d399',
  successBg: '#064e3b',
  danger: '#f87171',
  dangerBg: '#7f1d1d',
  warning: '#fbbf24',
  warningBg: '#78350f',
  info: '#38bdf8',
  infoBg: '#0c4a6e',
  hero: '#0f172a',
  heroBg: '#1e40af',
};

/**
 * Retourne la palette de couleurs active (light/dark/auto), pilotée par
 * ThemeContext (préférence manuelle persistée + suivi système en mode 'auto').
 */
export function useColors() {
  const { scheme } = useThemeMode();
  return scheme === 'dark' ? darkColors : lightColors;
}
