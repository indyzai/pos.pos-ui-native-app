export const colors = {
  background: '#F9FAFF',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F7',
  surfaceAccent: '#D7E2FF',
  primary: '#1B6EF3',
  primarySoft: '#D7E2FF',
  text: '#1A1C1E',
  textSecondary: '#43474F',
  outline: '#C3C6CF',
  outlineMuted: '#E5E9F0',
  success: '#0F7B3D',
  error: '#BA1A1A',
  errorSoft: '#FFDAD6',
} as const;
export type ThemeColors = Record<keyof typeof colors, string>;
export const darkColors: ThemeColors = {
  background: '#0F1217',
  surface: '#1A202B',
  surfaceMuted: '#222B39',
  surfaceAccent: '#263B5D',
  primary: '#78AEFF',
  primarySoft: '#173A68',
  text: '#F3F5F9',
  textSecondary: '#AAB4C5',
  outline: '#3A4658',
  outlineMuted: '#293344',
  success: '#72DA91',
  error: '#FF918A',
  errorSoft: '#4A2428',
};
export const radii = { small: 8, medium: 12, large: 16, sheet: 22 } as const;
