import { Animated, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useEffect, useRef } from "react";
import { useAppTheme } from "../theme/ThemeProvider";

export function GlobalDataLoaderView({
    title = "Loading data…",
    message = "Reading local data and checking for updates",
}: {
    title?: string;
    message?: string;
}) {
    const { themeColors: c } = useAppTheme();
    const { width: windowWidth } = useWindowDimensions();
    const progress = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(opacity, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
        }).start();

        const animation = Animated.loop(
            Animated.timing(progress, {
                toValue: 1,
                duration: 1100,
                useNativeDriver: true,
            }),
        );
        animation.start();
        return () => animation.stop();
    }, [opacity, progress]);

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                s.container,
                {
                    backgroundColor: c.surfaceMuted,
                    borderColor: c.outline,
                    opacity,
                },
            ]}
            accessibilityLiveRegion="polite"
        >
            <View style={[s.track, { backgroundColor: c.outlineMuted }]}>
                <Animated.View
                    style={[
                        s.progress,
                        {
                            backgroundColor: c.primary,
                            transform: [
                                {
                                    translateX: progress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-120, Math.max(windowWidth || 520, 520)],
                                    }),
                                },
                            ],
                        },
                    ]}
                />
            </View>
            <View style={s.banner}>
                <View style={s.copy}>
                    <Text
                        numberOfLines={1}
                        style={[s.title, { color: c.text }]}
                    >
                        {title}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[s.message, { color: c.textSecondary }]}
                    >
                        {message}
                    </Text>
                </View>
            </View>
        </Animated.View>
    );
}

const s = StyleSheet.create({
    container: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        elevation: 10,
        width: "100%",
        minHeight: 48,
        borderBottomWidth: 1,
        justifyContent: "center",
        boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.08)",
    },
    track: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 3,
        overflow: "hidden",
    },
    progress: { width: 120, height: 3, borderRadius: 2 },
    banner: {
        width: "100%",
        minHeight: 47,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 11,
    },
    copy: { minWidth: 0, maxWidth: 520, paddingVertical: 7 },
    title: { fontSize: 13, fontWeight: "900" },
    message: { marginTop: 2, fontSize: 11, fontWeight: "600" },
});
