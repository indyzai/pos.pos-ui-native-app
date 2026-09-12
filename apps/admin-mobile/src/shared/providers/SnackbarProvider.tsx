import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '../components/ui/AppPressable';
import { useAppTheme } from './ThemeProvider';

export type SnackbarAction = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

type SnackbarMessage = {
    id: number;
    title: string;
    message?: string;
    actions?: SnackbarAction[];
};

let listener: ((message: SnackbarMessage) => void) | undefined;
let nextId = 1;

export function showSnackbar(title: string, message?: string, actions?: SnackbarAction[]) {
    listener?.({ id: nextId++, title, message, actions });
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
    const { themeColors: c } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [notification, setNotification] = useState<SnackbarMessage>();
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        listener = (message) => {
            if (timer.current) clearTimeout(timer.current);
            setNotification(message);
            if (!message.actions?.length) {
                timer.current = setTimeout(() => setNotification(undefined), 4200);
            }
        };
        return () => {
            listener = undefined;
            if (timer.current) clearTimeout(timer.current);
        };
    }, []);

    const dismiss = () => {
        if (timer.current) clearTimeout(timer.current);
        setNotification(undefined);
    };
    const destructive = notification?.actions?.some((action) => action.style === 'destructive');
    const success = /added|changed|cleared|completed|created|recorded|reconciled|saved|updated/i.test(
        notification?.title || '',
    );
    const Icon = destructive ? AlertCircle : success ? CheckCircle2 : Info;
    const accent = destructive ? c.error : success ? c.success : c.primary;

    return (
        <View style={s.root}>
            {children}
            {notification ? (
                <View
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    style={[
                        s.snackbar,
                        {
                            bottom: Math.max(14, insets.bottom + 10),
                            backgroundColor: c.surface,
                            borderColor: c.outline,
                            boxShadow: '0px 8px 24px rgba(8, 12, 22, 0.24)',
                        },
                    ]}
                >
                    <Icon size={20} color={accent} />
                    <View style={s.copy}>
                        <Text style={[s.title, { color: c.text }]}>{notification.title}</Text>
                        {notification.message ? (
                            <Text style={[s.message, { color: c.textSecondary }]}>
                                {notification.message}
                            </Text>
                        ) : null}
                        {notification.actions?.length ? (
                            <View style={s.actions}>
                                {notification.actions.map((action, index) => (
                                    <AppPressable
                                        key={`${action.text}:${index}`}
                                        onPress={() => {
                                            dismiss();
                                            action.onPress?.();
                                        }}
                                        style={[
                                            s.action,
                                            {
                                                backgroundColor:
                                                    action.style === 'destructive'
                                                        ? c.errorSoft
                                                        : action.style === 'cancel'
                                                          ? c.surfaceMuted
                                                          : c.primarySoft,
                                            },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                s.actionText,
                                                {
                                                    color:
                                                        action.style === 'destructive' ? c.error : c.primary,
                                                },
                                            ]}
                                        >
                                            {action.text}
                                        </Text>
                                    </AppPressable>
                                ))}
                            </View>
                        ) : null}
                    </View>
                    <AppPressable
                        accessibilityLabel="Dismiss notification"
                        onPress={dismiss}
                        style={s.dismiss}
                    >
                        <X size={17} color={c.textSecondary} />
                    </AppPressable>
                </View>
            ) : null}
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1 },
    snackbar: {
        position: 'absolute',
        left: 14,
        right: 14,
        maxWidth: 620,
        alignSelf: 'center',
        zIndex: 10000,
        elevation: 24,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
    },
    copy: { flex: 1, minWidth: 0 },
    title: { fontSize: 13, fontWeight: '900' },
    message: { marginTop: 3, fontSize: 11, lineHeight: 16 },
    actions: { marginTop: 11, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    action: { minHeight: 34, borderRadius: 9, paddingHorizontal: 11, justifyContent: 'center' },
    actionText: { fontSize: 11, fontWeight: '900' },
    dismiss: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
