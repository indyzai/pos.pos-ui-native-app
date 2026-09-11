import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Banknote, CreditCard, IndianRupee, UploadCloud } from 'lucide-react-native';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CounterSession } from '../../sales/salesOutbox';

export function BillingSessionStats({
  session,
  pendingSales,
  currencyCode,
}: {
  session?: CounterSession | null;
  pendingSales: number;
  currencyCode: string;
}) {
  const { themeColors: c } = useAppTheme();
  const { width } = useWindowDimensions();
  const summary = session?.salesSummary;
  const stats = [
    { label: 'Session sales', value: money(summary?.totalSales || 0, currencyCode), icon: IndianRupee },
    { label: 'Cash', value: money(summary?.cash || 0, currencyCode), icon: Banknote },
    {
      label: 'Card / UPI',
      value: money(Number(summary?.card || 0) + Number(summary?.upi || 0), currencyCode),
      icon: CreditCard,
    },
    { label: 'Pending sync', value: String(pendingSales), icon: UploadCloud },
  ];
  return (
    <View style={[s.wrap, { backgroundColor: c.background }]}>
      {stats.map(({ label, value, icon: Icon }) => (
        <View
          key={label}
          style={[
            s.card,
            {
              width: width >= 900 ? '18.8%' : width >= 600 ? '31.5%' : '48%',
              backgroundColor: c.surface,
              borderColor: c.outlineMuted,
            },
          ]}
        >
          <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
            <Icon size={16} color={c.primary} />
          </View>
          <View style={s.copy}>
            <Text numberOfLines={1} style={[s.value, { color: c.text }]}>
              {value}
            </Text>
            <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function money(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currencyCode} ${value.toFixed(0)}`;
  }
}
const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    minHeight: 57,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { minWidth: 0, flex: 1 },
  value: { fontSize: 12, fontWeight: '900' },
  label: { marginTop: 2, fontSize: 8, fontWeight: '700' },
});
