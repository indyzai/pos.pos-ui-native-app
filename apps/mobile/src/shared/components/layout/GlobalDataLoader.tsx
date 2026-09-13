import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useLocalDatabase } from '@indyzai/pos-database/react';
import { useAppTheme } from '@indyzai/pos-ui';

export function GlobalDataLoader() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const local = useLocalDatabase();
  const { themeColors: c } = useAppTheme();
  const active = local.status === 'initializing' || fetching > 0 || mutating > 0;
  if (!active) return null;
  return (
    <View pointerEvents="none" style={s.overlay} accessibilityLiveRegion="polite">
      <View
        style={[s.pill, { backgroundColor: local.status === 'initializing' ? c.surface : c.surfaceMuted }]}
      >
        <ActivityIndicator size="small" color={c.primary} />
        <Text style={[s.label, { color: c.text }]}>Loading data…</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: { position: 'absolute', top: 10, left: 0, right: 0, zIndex: 1000, alignItems: 'center' },
  pill: {
    minHeight: 38,
    borderRadius: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    elevation: 5,
  },
  label: { fontSize: 12, fontWeight: '800' },
});
