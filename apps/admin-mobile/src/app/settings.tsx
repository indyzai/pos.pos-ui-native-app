import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, Save, X } from 'lucide-react-native';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../shared/components/ui/AppPressable';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { ComingSoonSettings } from '../features/settings/ComingSoonSettings';
import { BillingSettingsSection } from '../features/settings/BillingSettingsSection';
import { DeviceSettingsSection } from '../features/settings/DeviceSettingsSection';
import { GeneralSettingsSection } from '../features/settings/GeneralSettingsSection';
import { DataSettingsSection } from '../features/settings/DataSettingsSection';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider, useBottomNavigation } from '../shared/providers/BottomNavigationProvider';
import { useBottomNavigationClearance } from '../shared/hooks/useBottomNavigationClearance';

type SectionId =
    | 'general'
    | 'appearance'
    | 'billing'
    | 'devices'
    | 'users'
    | 'notifications'
    | 'integrations'
    | 'features'
    | 'data';
type SettingsTab = { id: SectionId; label: string };

const tabSections: ReadonlyArray<{ label: string; tabs: readonly SettingsTab[] }> = [
    {
        label: 'General',
        tabs: [
            { id: 'general', label: 'Business info' },
            { id: 'appearance', label: 'Appearance' },
        ],
    },
    {
        label: 'Operations',
        tabs: [
            { id: 'billing', label: 'Billing & invoices' },
            { id: 'devices', label: 'Devices & printers' },
            { id: 'notifications', label: 'Alerts & reminders' },
        ],
    },
    {
        label: 'Management',
        tabs: [
            { id: 'users', label: 'Users & access' },
            { id: 'integrations', label: 'Integrations' },
        ],
    },
    {
        label: 'Development',
        tabs: [
            { id: 'features', label: 'Feature toggles' },
            { id: 'data', label: 'Data & sync' },
        ],
    },
] as const;
const tabs = tabSections.flatMap((group) => group.tabs);

export default function SettingsRoute() {
    return (
        <BottomNavigationProvider>
            <SettingsContent />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}

function SettingsContent() {
    const { themeColors: c } = useAppTheme();
    const bottomClearance = useBottomNavigationClearance();
    const { setCenterItem } = useBottomNavigation();
    const [section, setSection] = useState<SectionId>('general');
    const [tabsOpen, setTabsOpen] = useState(false);
    const [tabsTop, setTabsTop] = useState(75);
    const tabsButtonRef = useRef<View>(null);
    const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);
    const registerSave = useCallback((handler: (() => Promise<void>) | null) => {
        saveHandlerRef.current = handler;
    }, []);
    const openTabs = () => {
        tabsButtonRef.current?.measureInWindow((_x, y, _width, buttonHeight) => {
            setTabsTop(y + buttonHeight + 4);
            setTabsOpen(true);
        });
    };
    const toggleTabs = () => (tabsOpen ? setTabsOpen(false) : openTabs());

    useEffect(() => {
        setCenterItem({
            label: 'Save',
            icon: Save,
            onPress: () => {
                if (saveHandlerRef.current) void saveHandlerRef.current();
                else showSnackbar('Settings', 'There are no editable changes in this section.');
            },
        });
        return () => setCenterItem(null);
    }, [setCenterItem, section]);

    const activeLabel = tabs.find((tab) => tab.id === section)?.label || 'Settings';
    return (
        <SafeAreaView
            style={[s.screen, { backgroundColor: c.background }]}
            edges={['left', 'right', 'bottom']}
        >
            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    automaticallyAdjustKeyboardInsets
                    keyboardDismissMode="interactive"
                    contentContainerStyle={[s.scroll, { paddingBottom: bottomClearance }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
                        <View style={s.titleRow}>
                            <Text style={[s.title, { color: c.text }]}>Settings</Text>
                        </View>
                        {section === 'general' ? <GeneralSettingsSection /> : null}
                        {section === 'devices' ? <DeviceSettingsSection registerSave={registerSave} /> : null}
                        {section === 'features' ? (
                            <BillingSettingsSection registerSave={registerSave} />
                        ) : null}
                        {section === 'data' ? <DataSettingsSection /> : null}
                        {!['general', 'devices', 'features', 'data'].includes(section) ? (
                            <ComingSoonSettings title={activeLabel} />
                        ) : null}
                    </View>
                </ScrollView>
                <View ref={tabsButtonRef} collapsable={false} style={s.tabsButtonAnchor}>
                    <AppPressable
                        accessibilityLabel={
                            tabsOpen ? 'Close settings navigation' : 'Open settings navigation'
                        }
                        onPress={toggleTabs}
                        style={[s.tabsButton, { backgroundColor: c.primary }]}
                    >
                        {tabsOpen ? <X size={19} color="#fff" /> : <ChevronLeft size={20} color="#fff" />}
                    </AppPressable>
                </View>
                {tabsOpen ? (
                    <Modal transparent visible animationType="fade" onRequestClose={() => setTabsOpen(false)}>
                        <View style={s.tabsOverlay}>
                            <Pressable
                                accessibilityLabel="Close settings navigation"
                                style={StyleSheet.absoluteFill}
                                onPress={() => setTabsOpen(false)}
                            />
                            <View
                                style={[
                                    s.tabs,
                                    { top: tabsTop, backgroundColor: c.surface, borderColor: c.outline },
                                ]}
                            >
                                <ScrollView
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={s.tabsContent}
                                >
                                    {tabSections.map((group) => (
                                        <View key={group.label} style={s.tabSection}>
                                            <Text style={[s.tabSectionLabel, { color: c.textSecondary }]}>
                                                {group.label}
                                            </Text>
                                            {group.tabs.map((tab) => (
                                                <AppPressable
                                                    key={tab.id}
                                                    onPress={() => {
                                                        setSection(tab.id);
                                                        setTabsOpen(false);
                                                    }}
                                                    style={[
                                                        s.tab,
                                                        section === tab.id && {
                                                            backgroundColor: c.primarySoft,
                                                        },
                                                    ]}
                                                >
                                                    <Text style={[s.tabText, { color: c.text }]}>
                                                        {tab.label}
                                                    </Text>
                                                </AppPressable>
                                            ))}
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                ) : null}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    screen: { flex: 1 },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, padding: 0 },
    card: {
        flexGrow: 1,
        borderWidth: 0,
        borderRadius: 0,
        paddingTop: 20,
        paddingHorizontal: 16,
        paddingBottom: 28,
    },
    title: { fontSize: 21, fontWeight: '900' },
    titleRow: {
        marginBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    tabsButtonAnchor: { position: 'absolute', right: 0, top: 30, zIndex: 5 },
    tabsButton: {
        width: 36,
        height: 44,
        borderTopLeftRadius: 22,
        borderBottomLeftRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabs: {
        position: 'absolute',
        right: 0,
        width: 190,
        maxHeight: '78%',
        borderWidth: 1,
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    tabsContent: { padding: 8 },
    tabSection: { marginBottom: 5 },
    tabSectionLabel: {
        paddingHorizontal: 12,
        paddingTop: 7,
        paddingBottom: 4,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    tabsOverlay: { flex: 1 },
    tab: {
        height: 38,
        paddingHorizontal: 12,
        borderRadius: 9,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    tabText: { fontSize: 13, fontWeight: '800' },
});
