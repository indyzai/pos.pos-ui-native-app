import { StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '../../../components/layout/AppHeader';
import { colors, radii } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';

function Metric({ label, value, success }: { label: string; value: string; success?: boolean }) {
  const { isDark, themeColors } = useAppTheme();
  return (
    <View>
      <Text style={[s.metricLabel, isDark && s.darkMuted]}>{label}</Text>
      <Text style={[s.metricValue, { color: themeColors.text }, success && { color: themeColors.success }]}>
        {value}
      </Text>
    </View>
  );
}
export function BillingHeader({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { themeColors } = useAppTheme();
  return (
    <>
      <AppHeader onMenuToggle={onMenuToggle} />
      <View style={[s.metrics, { backgroundColor: themeColors.surface }]}>
        <Metric label="TODAY'S SALES" value="₹12,450" />
        <View style={[s.divider, { backgroundColor: themeColors.surfaceMuted }]} />
        <Metric label="ORDERS" value="38" />
        <View style={[s.divider, { backgroundColor: themeColors.surfaceMuted }]} />
        <Metric label="SYNC" value="Online" success />
      </View>
    </>
  );
}
const s = StyleSheet.create({
  metrics: {
    height: 61,
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 16,
    borderRadius: radii.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#303A7A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  metricLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: '#9399AA' },
  darkMuted: { color: '#A8ABB5' },
  metricValue: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  divider: { height: 28, width: 1, backgroundColor: colors.surfaceMuted },
});
