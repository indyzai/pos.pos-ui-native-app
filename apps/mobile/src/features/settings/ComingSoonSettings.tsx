import { StyleSheet, Text, View } from 'react-native';
import { Construction } from 'lucide-react-native';
import { useAppTheme } from '../../shared/providers/ThemeProvider';

export function ComingSoonSettings({ title }: { title: string }) {
  const { themeColors: c } = useAppTheme();
  return (
    <View style={[s.root, { backgroundColor: c.surfaceMuted }]}>
      <Construction size={28} color={c.primary} />
      <Text style={[s.title, { color: c.text }]}>{title}</Text>
      <Text style={[s.copy, { color: c.textSecondary }]}>This settings section is coming soon.</Text>
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    minHeight: 180,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginTop: 14,
  },
  title: { fontSize: 17, fontWeight: '900', marginTop: 10 },
  copy: { fontSize: 13, marginTop: 5 },
});
