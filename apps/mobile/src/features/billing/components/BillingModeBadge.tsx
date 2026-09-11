import { StyleSheet, Text, View } from 'react-native';
import { Building2, HeartPulse, PackageCheck, Store, UtensilsCrossed, Wrench } from 'lucide-react-native';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { BillingModeConfig } from '../domain/billingMode';

export function BillingModeBadge({ config }: { config: BillingModeConfig }) {
  const { themeColors: c } = useAppTheme();
  const Icon =
    config.mode === 'pharmacy'
      ? HeartPulse
      : config.mode === 'restaurant'
        ? UtensilsCrossed
        : config.mode === 'wholesale'
          ? PackageCheck
          : config.mode === 'service'
            ? Wrench
            : config.mode === 'electronics'
              ? Building2
              : Store;
  return (
    <View style={[s.badge, { backgroundColor: c.primarySoft, borderColor: c.outlineMuted }]}>
      <Icon size={13} color={c.primary} />
      <Text style={[s.text, { color: c.primary }]}>{config.label}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 28,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  text: { fontSize: 10, fontWeight: '900' },
});
