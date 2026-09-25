import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../theme/ThemeProvider";
import { AppPressable } from "../AppPressable";
import type { NavigationItemConfig, NavigationViewProps } from "./types";

export function TabletNavigationPane<Destination>({
    collapsed,
    items,
    isActive,
    onNavigate,
}: NavigationViewProps<Destination> & {
    collapsed: boolean;
    items: readonly NavigationItemConfig<Destination>[];
}) {
    const { themeColors: c } = useAppTheme();
    return (
        <View
            style={[
                s.pane,
                collapsed && s.collapsed,
                { backgroundColor: c.surface, borderRightColor: c.outline },
            ]}
        >
            {items.map(({ icon: Icon, label, href }) => {
                const active = isActive(href);
                return (
                    <AppPressable
                        key={label}
                        onPress={() => onNavigate(href)}
                        style={[
                            s.item,
                            collapsed && s.collapsedItem,
                            active && { backgroundColor: c.primarySoft },
                        ]}
                    >
                        <Icon
                            size={18}
                            color={active ? c.primary : c.textSecondary}
                            strokeWidth={2.2}
                        />
                        {!collapsed && (
                            <Text
                                style={[
                                    s.label,
                                    {
                                        color: active
                                            ? c.primary
                                            : c.textSecondary,
                                    },
                                ]}
                            >
                                {label}
                            </Text>
                        )}
                    </AppPressable>
                );
            })}
        </View>
    );
}
const s = StyleSheet.create({
    pane: {
        width: 184,
        borderRightWidth: StyleSheet.hairlineWidth,
        padding: 18,
        paddingTop: 16,
    },
    collapsed: { width: 72, paddingHorizontal: 10 },
    item: {
        height: 44,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        marginBottom: 6,
    },
    collapsedItem: { paddingHorizontal: 0, justifyContent: "center" },
    label: { fontSize: 13, fontWeight: "800" },
});
