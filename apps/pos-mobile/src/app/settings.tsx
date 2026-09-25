import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { Save } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SectionMenu, useBackgroundRefresh } from '@indyzai/pos-ui-native';
import { createScopeKey, useLocalDatabase } from '@indyzai/pos-database';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { SettingsSection } from '@indyzai/feature-organization/settings';
import { PrinterSettings } from '@indyzai/feature-printers/settings';
import { printerConfigurationApi } from '../features/printing/printerConfigurationApi';
import { settingsApi } from '../features/settings/settingsApi';
import { DeviceSettingsSection } from '../features/settings/DeviceSettingsSection';
import { GeneralSettingsSection } from '../features/settings/GeneralSettingsSection';
import { DataSettingsSection } from '../features/settings/DataSettingsSection';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider, useBottomNavigation } from '@indyzai/pos-ui-native';
import { useBottomNavigationClearance } from '@indyzai/pos-ui-native';

type SectionId =
    | 'general'
    | 'appearance'
    | 'billing'
    | 'devices'
    | 'printers'
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
            { id: 'printers', label: 'Printer configuration' },
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
    const params = useLocalSearchParams<{ section?: string }>();
    const pathname = usePathname();
    const local = useLocalDatabase();
    const { themeColors: c } = useAppTheme();
    const bottomClearance = useBottomNavigationClearance();
    const { setCenterItem } = useBottomNavigation();
    const initialSection = tabs.some((tab) => tab.id === params.section)
        ? (params.section as SectionId)
        : 'general';
    const [section, setSection] = useState<SectionId>(initialSection);
    const scope =
        local.database && local.status === 'ready' && pathname === '/settings'
            ? createScopeKey(local.database.scope)
            : undefined;
    useBackgroundRefresh(scope && section !== 'printers' ? `settings:${scope}` : undefined, (signal) =>
        settingsApi.refresh(signal),
    );
    useBackgroundRefresh(scope && section === 'printers' ? `printers:${scope}` : undefined, (signal) =>
        printerConfigurationApi.refresh(undefined, signal),
    );
    const saveHandlerRef = useRef<(() => Promise<void>) | null>(null);
    const registerSave = useCallback((handler: (() => Promise<void>) | null) => {
        saveHandlerRef.current = handler;
    }, []);

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
                        {section !== 'printers' ? (
                            <SettingsSection
                                section={section}
                                surface="pos"
                                registerSave={section === 'devices' ? undefined : registerSave}
                            />
                        ) : (
                            <PrinterSettings
                                api={printerConfigurationApi}
                                surface="pos"
                                registerSave={registerSave}
                            />
                        )}
                        {section === 'devices' ? <DeviceSettingsSection registerSave={registerSave} /> : null}
                        {section === 'data' ? <DataSettingsSection /> : null}
                    </View>
                </ScrollView>
                <SectionMenu
                    value={section}
                    groups={tabSections.map((group) => ({ label: group.label, items: group.tabs }))}
                    onChange={setSection}
                    accessibilityLabel="settings"
                />
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
