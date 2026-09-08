import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigationProvider } from '../../providers/BottomNavigationProvider';
import { useAppTheme } from '../../providers/ThemeProvider';
import { BottomNavigation } from '../navigation/BottomNavigation';
import { AppHeader } from './AppHeader';

export function ModulePlaceholder({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <BottomNavigationProvider>
      <ModuleContent title={title} icon={Icon} />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}

function ModuleContent({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  const { themeColors: c } = useAppTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <AppHeader />
      <View style={styles.content}>
        <View style={[styles.icon, { backgroundColor: c.primarySoft }]}>
          <Icon size={32} color={c.primary} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <Text style={[styles.description, { color: c.textSecondary }]}>
          This module is ready for implementation.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, paddingBottom: 90 },
  icon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, fontSize: 24, fontWeight: '900' },
  description: { marginTop: 8, fontSize: 14, textAlign: 'center' },
});
