import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../shared/components/layout/AppHeader';
import { radii } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CounterSession } from '../../sales/salesOutbox';

type BillingHeaderProps = {
  onMenuToggle?: () => void;
  session: CounterSession | null | undefined;
  pendingSales: number;
  updated?: string;
  error?: string;
  syncing: boolean;
  onRefresh: () => void;
};

export function BillingHeader({
  onMenuToggle,
  session,
  pendingSales,
  updated,
  error,
  syncing,
  onRefresh,
}: BillingHeaderProps) {
  const { themeColors } = useAppTheme();
  const status = error
    ? error
    : syncing
      ? 'Syncing catalog and sales…'
      : session
        ? `Counter ${session.counterId} · Ready to bill`
        : 'No open counter session';
  const cacheLabel = updated
    ? `Catalog ${new Date(updated).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Not cached yet';
  return (
    <View style={[s.wrapper, { backgroundColor: themeColors.background }]}>
      <AppHeader onMenuToggle={onMenuToggle} />
      <View style={[s.statusBar, { backgroundColor: themeColors.surface, borderColor: themeColors.outline }]}>
        <View style={s.statusCopy}>
          <View style={s.statusTitle}>
            <View
              style={[
                s.statusDot,
                {
                  backgroundColor: error
                    ? themeColors.error
                    : session
                      ? themeColors.success
                      : themeColors.primary,
                },
              ]}
            />
            <Text numberOfLines={1} style={[s.statusText, { color: themeColors.text }]}>
              {status}
            </Text>
          </View>
          <Text numberOfLines={1} style={[s.statusMeta, { color: themeColors.textSecondary }]}>
            {pendingSales ? `${pendingSales} pending sale${pendingSales === 1 ? '' : 's'} · ` : ''}
            {cacheLabel}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh billing data"
          disabled={syncing}
          onPress={onRefresh}
          style={[s.refresh, { backgroundColor: themeColors.primary }, syncing && s.refreshDisabled]}
        >
          {syncing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={s.refreshText}>↻ Refresh</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrapper: { paddingBottom: 8 },
  statusBar: {
    minHeight: 58,
    marginHorizontal: 16,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.large,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusCopy: { flex: 1, minWidth: 0, gap: 3 },
  statusTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 13, fontWeight: '800' },
  statusMeta: { fontSize: 11, fontWeight: '600', marginLeft: 15 },
  refresh: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshDisabled: { opacity: 0.65 },
  refreshText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
