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
  background: '#111318',
  surface: '#1B1E24',
  surfaceMuted: '#22252B',
  surfaceAccent: '#00458B',
  primary: '#AAC7FF',
  primarySoft: '#00458B',
  text: '#E3E2E6',
  textSecondary: '#C3C6CF',
  outline: '#43474E',
  outlineMuted: '#2D3037',
  success: '#7CDC94',
  error: '#FFB4AB',
  errorSoft: '#93000A',
};
export const radii = { small: 8, medium: 12, large: 16, sheet: 22 } as const;
