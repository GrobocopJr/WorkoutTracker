import { useColorScheme } from 'react-native';
import { useThemeStore } from './store/themeStore';

export const light = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  subtext: '#374151',
  muted: '#6B7280',
  placeholder: '#9CA3AF',
  border: '#D1D5DB',
  borderLight: '#E5E7EB',
  divider: '#F3F4F6',
  accent: '#2563EB',
  accentFaded: '#EFF6FF',
  accentFadedText: '#2563EB',
  inputBg: '#FFFFFF',
  tabBar: '#FFFFFF',
  success: '#16A34A',
  successFaded: '#F0FDF4',
  danger: '#EF4444',
};

export const dark = {
  bg: '#0F172A',
  card: '#1E293B',
  text: '#F1F5F9',
  subtext: '#CBD5E1',
  muted: '#94A3B8',
  placeholder: '#475569',
  border: '#334155',
  borderLight: '#334155',
  divider: '#0F172A',
  accent: '#3B82F6',
  accentFaded: '#1E3A5F',
  accentFadedText: '#93C5FD',
  inputBg: '#0F172A',
  tabBar: '#1E293B',
  success: '#22C55E',
  successFaded: '#052E16',
  danger: '#F87171',
};

export type Colors = typeof light;

export function useIsDark(): boolean {
  const override = useThemeStore((s) => s.theme);
  const system = useColorScheme();
  return override === 'dark' || (override === 'system' && system === 'dark');
}

export function useColors(): Colors {
  return useIsDark() ? dark : light;
}
