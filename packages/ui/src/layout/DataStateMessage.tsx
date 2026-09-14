import { AlertCircle, Inbox } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable } from "../AppPressable";
import { useAppTheme } from "../theme/ThemeProvider";

export function DataStateMessage({
    kind,
    title,
    message,
    onRetry,
}: {
    kind: "empty" | "error";
    title: string;
    message: string;
    onRetry?: () => void;
}) {
    const { themeColors: c } = useAppTheme();
    const color = kind === "error" ? c.error : c.textSecondary;
    const Icon = kind === "error" ? AlertCircle : Inbox;
    return (
        <View
            style={[
                s.root,
                { backgroundColor: c.surface, borderColor: c.outlineMuted },
            ]}
        >
            <Icon size={30} color={color} />
            <Text style={[s.title, { color: c.text }]}>{title}</Text>
            <Text style={[s.message, { color: c.textSecondary }]}>
                {message}
            </Text>
            {onRetry ? (
                <AppPressable
                    onPress={onRetry}
                    style={[s.retry, { borderColor: c.primary }]}
                >
                    <Text style={[s.retryText, { color: c.primary }]}>
                        Try again
                    </Text>
                </AppPressable>
            ) : null}
        </View>
    );
}

const s = StyleSheet.create({
    root: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 24,
        alignItems: "center",
        gap: 7,
    },
    title: { fontSize: 15, fontWeight: "900", textAlign: "center" },
    message: {
        maxWidth: 440,
        fontSize: 12,
        lineHeight: 18,
        textAlign: "center",
    },
    retry: {
        minHeight: 36,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        justifyContent: "center",
        marginTop: 4,
    },
    retryText: { fontSize: 12, fontWeight: "900" },
});
