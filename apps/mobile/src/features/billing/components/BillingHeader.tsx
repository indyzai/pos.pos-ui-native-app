import { StyleSheet, Text, View } from 'react-native';
import { radii } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CounterSession } from '../../sales/salesOutbox';

type BillingHeaderProps = {
  session: CounterSession | null | undefined;
  pendingSales: number;
  updated?: string;
  error?: string;
  syncing: boolean;
};

export function BillingHeader({ session, pendingSales, updated, error, syncing }: BillingHeaderProps) {
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
});
