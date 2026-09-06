import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../../../constants/theme';

function Metric({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <View>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, success && s.success]}>{value}</Text>
    </View>
  );
}
export function BillingHeader() {
  return (
    <>
      <View style={s.header}>
        <View style={s.brand}>
          <View style={s.logo}>
            <Text style={s.logoText}>i</Text>
          </View>
          <View>
            <Text style={s.store}>Indyz Mart</Text>
            <Text style={s.counter}>
              Counter 01 <Text style={s.online}>●</Text> Open
            </Text>
          </View>
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>SK</Text>
        </View>
      </View>
      <View style={s.metrics}>
        <Metric label="TODAY'S SALES" value="₹12,450" />
        <View style={s.divider} />
        <Metric label="ORDERS" value="38" />
        <View style={s.divider} />
        <Metric label="SYNC" value="Online" success />
      </View>
    </>
  );
}
const s = StyleSheet.create({
  header: {
    height: 76,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: colors.outline,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  logoText: { fontSize: 24, fontWeight: '900', fontStyle: 'italic', color: '#fff' },
  store: { fontSize: 16, fontWeight: '800', color: colors.text },
  counter: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  online: { color: colors.success },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  avatarText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  metrics: {
    height: 61,
    margin: 16,
    marginBottom: 0,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
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
  metricValue: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 3 },
  success: { color: colors.success, fontSize: 12 },
  divider: { height: 28, width: 1, backgroundColor: colors.surfaceMuted },
});
