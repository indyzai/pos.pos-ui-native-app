import { useState } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../shared/components/ui/AppPressable';
import { showSnackbar } from '../shared/providers/SnackbarProvider';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { authApi } from '../features/auth/authApi';
import { useAuthSession } from '../features/auth/AuthSessionContext';

export default function DeviceSetup() {
    const router = useRouter();
    const { themeColors: c } = useAppTheme();
    const { refreshSession } = useAuthSession();
    const [pin, setPin] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async () => {
        if (pin !== confirm) return showSnackbar('Device PIN', 'PIN entries do not match.');
        setBusy(true);
        try {
            await authApi.registerDevice(pin);
            await refreshSession();
            router.replace('/billing');
        } catch (error) {
            showSnackbar(
                'Device access',
                error instanceof Error ? error.message : 'Unable to register this device.',
            );
        } finally {
            setBusy(false);
        }
    };
    if (Platform.OS === 'web') return <Redirect href="/login" />;
    return (
        <SafeAreaView
            style={[s.screen, { backgroundColor: c.background }]}
            edges={['left', 'right', 'bottom']}
        >
            <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
                <Text style={[s.title, { color: c.text }]}>Secure this device</Text>
                <Text style={[s.copy, { color: c.textSecondary }]}>
                    Create a 4–8 digit PIN. Future access uses Face ID, fingerprint, or your device passcode.
                </Text>
                <TextInput
                    value={pin}
                    onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    secureTextEntry
                    maxLength={8}
                    placeholder="Device PIN"
                    placeholderTextColor={c.textSecondary}
                    style={[s.input, { color: c.text, borderColor: c.outline }]}
                />
                <TextInput
                    value={confirm}
                    onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 8))}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    secureTextEntry
                    maxLength={8}
                    placeholder="Confirm PIN"
                    placeholderTextColor={c.textSecondary}
                    style={[s.input, { color: c.text, borderColor: c.outline }]}
                />
                <AppPressable disabled={busy} onPress={() => void submit()} style={s.button}>
                    <Text style={s.buttonText}>{busy ? 'Setting up…' : 'Enable device access'}</Text>
                </AppPressable>
            </View>
        </SafeAreaView>
    );
}
const s = StyleSheet.create({
    screen: { flex: 1, justifyContent: 'center', padding: 20 },
    card: { borderWidth: 1, borderRadius: 18, padding: 22 },
    title: { fontSize: 21, fontWeight: '900' },
    copy: { fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 22 },
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
});
