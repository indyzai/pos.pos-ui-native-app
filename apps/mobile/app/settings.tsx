import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft } from 'lucide-react-native';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../src/components/ui/AppPressable';
import { useAppTheme } from '../src/contexts/ThemeContext';
import { authApi } from '../src/features/auth/authApi';
import { ComingSoonSettings } from '../src/features/settings/ComingSoonSettings';
import { BillingSettingsSection } from '../src/features/settings/BillingSettingsSection';
import { DeviceSettingsSection } from '../src/features/settings/DeviceSettingsSection';
import { BottomNavigation } from '../src/components/navigation/BottomNavigation';
import { BottomNavigationProvider, useBottomNavigation } from '../src/contexts/BottomNavigationContext';

export default function SettingsRoute() {
  return <BottomNavigationProvider><SettingsContent /><BottomNavigation /></BottomNavigationProvider>;
}
function SettingsContent() {
  const router = useRouter();
  const { themeColors: c } = useAppTheme();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState('devices');
  const [tabsOpen, setTabsOpen] = useState(false);
  const { setCenterItem } = useBottomNavigation();
  const change = async () => {
    if (pin !== confirm) return Alert.alert('Device PIN', 'PIN entries do not match.');
    setBusy(true);
    try {
      await authApi.changeDevicePin(pin);
      Alert.alert('PIN changed', 'Your device PIN has been updated.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('PIN change failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { setCenterItem({ label: 'Save', icon: '✓', onPress: () => void change() }); return () => setCenterItem(null); }, [section, pin, confirm]);
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.background }]}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
        <View style={s.titleRow}><AppPressable accessibilityLabel="Back" onPress={() => router.back()} style={[s.back, { backgroundColor: c.surfaceMuted }]}><ArrowLeft size={19} color={c.text} /></AppPressable><Text style={[s.title, { color: c.text }]}>Settings</Text><View style={s.back} /></View>
        <AppPressable accessibilityLabel="Open settings navigation" onPress={() => setTabsOpen((open) => !open)} style={[s.tabsButton, { backgroundColor: c.primary }]}><ChevronLeft size={20} color="#fff" style={{ transform: [{ rotate: tabsOpen ? '180deg' : '0deg' }] }} /></AppPressable>
        {tabsOpen && <View style={[s.tabs, { backgroundColor: c.surface, borderColor: c.outline }]}>{['General', 'Appearance', 'Billing', 'Devices', 'Users & access', 'Notifications', 'Integrations', 'Data'].map((tab) => <AppPressable key={tab} onPress={() => { setSection(tab.toLowerCase().replace(' & access', '')); setTabsOpen(false); }} style={[s.tab, { backgroundColor: section === tab.toLowerCase().replace(' & access', '') ? c.primarySoft : 'transparent' }]}><Text style={[s.tabText, { color: c.text }]}>{tab}</Text></AppPressable>)}</View>}
        {section === 'devices' && <DeviceSettingsSection />}
        {section === 'billing' && <BillingSettingsSection />}
        {!['devices', 'billing'].includes(section) && <ComingSoonSettings title={section === 'users' ? 'Users & access' : `${section[0].toUpperCase()}${section.slice(1)} settings`} />}
      </View>
    </ScrollView></KeyboardAvoidingView></SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, scroll: { flexGrow: 1, padding: 0 },
  card: { flex: 1, borderWidth: 0, borderRadius: 0, padding: 20 },
  title: { fontSize: 21, fontWeight: '900' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  copy: { fontSize: 16, fontWeight: '800', marginTop: 20 },
  tabsButton: { position: 'absolute', right: 0, top: 30, zIndex: 5, width: 36, height: 44, borderTopLeftRadius: 22, borderBottomLeftRadius: 22, alignItems: 'center', justifyContent: 'center' }, tabs: { position: 'absolute', right: 0, top: 75, zIndex: 5, width: 190, padding: 8, borderWidth: 1, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, gap: 3 }, tab: { height: 38, paddingHorizontal: 12, borderRadius: 9, alignItems: 'flex-start', justifyContent: 'center' }, tabText: { fontSize: 13, fontWeight: '800' },
  note: { fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 20 },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    marginTop: 6,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  moreTitle: { marginTop: 24, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  settingRow: { height: 44, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingText: { fontSize: 14, fontWeight: '700' }, comingSoon: { fontSize: 11, fontWeight: '700' },
});
