import { create } from 'zustand';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
