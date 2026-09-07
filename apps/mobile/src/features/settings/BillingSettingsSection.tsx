import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
export function BillingSettingsSection() {
  const { themeColors: c } = useAppTheme();
  return (
    <View>
      <Text style={[s.title, { color: c.textSecondary }]}>Billing settings</Text>
      <Text style={[s.note, { color: c.textSecondary }]}>
        Taxes, payment methods, invoices, and receipt settings are managed here.
      </Text>
      {[
        ['GST calculation', '5%'],
        ['Payment methods', 'Cash · UPI · Card'],
        ['Receipt settings', 'Coming soon'],
      ].map(([label, value]) => (
        <View key={label} style={[s.row, { borderColor: c.outlineMuted }]}>
          <Text style={[s.label, { color: c.text }]}>{label}</Text>
          <Text style={[s.value, { color: c.textSecondary }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', marginTop: 20 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 20 },
  row: {
    height: 44,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 14, fontWeight: '700' },
  value: { fontSize: 11, fontWeight: '700' },
});
