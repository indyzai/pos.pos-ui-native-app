import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export function GlobalDataLoaderView({ title = 'Loading data…', message = 'Reading local data and checking for updates' }: { title?: string; message?: string }) {
  const { themeColors: c } = useAppTheme();
  return <View pointerEvents="none" style={[s.container, { backgroundColor: c.surfaceMuted, borderColor: c.outline }]} accessibilityLiveRegion="polite">
    <View
      style={s.banner}
    >
      <ActivityIndicator size="small" color={c.primary} />
      <View style={s.copy}>
        <Text numberOfLines={1} style={[s.title, { color: c.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[s.message, { color: c.textSecondary }]}>{message}</Text>
      </View>
    </View>
  </View>;
}

const s = StyleSheet.create({
  container: { width: '100%', minHeight: 48, borderBottomWidth: 1, justifyContent: 'center' },
  banner: { width: '100%', minHeight: 47, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  copy: { minWidth: 0, maxWidth: 520, paddingVertical: 7 },
  title: { fontSize: 13, fontWeight: '900' },
  message: { marginTop: 2, fontSize: 11, fontWeight: '600' },
});
