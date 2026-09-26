import {
    forwardRef,
    useState,
    type ComponentProps,
    type ComponentRef,
} from "react";
import {
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown } from "lucide-react-native";
import { useAppTheme } from "./theme/ThemeProvider";

export const SettingsToggle = forwardRef<
    ComponentRef<typeof Switch>,
    ComponentProps<typeof Switch> & { isDisabled?: boolean }
>(function SettingsToggle({ disabled, isDisabled, ...props }, ref) {
    return <Switch ref={ref} disabled={disabled || isDisabled} {...props} />;
});

export function SettingsSelect({
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly { label: string; value: string }[];
    disabled?: boolean;
    onChange: (value: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const { themeColors: c } = useAppTheme();
    const selectedOption = options.find((item) => item.value === value);
    const displayLabel = selectedOption?.label ?? (value || label);

    return (
        <View>
            <Pressable
                accessibilityLabel={label}
                accessibilityRole="combobox"
                disabled={disabled}
                onPress={() => setOpen(true)}
                style={{
                    borderWidth: 1,
                    borderColor: c.outlineMuted,
                    borderRadius: 12,
                    minHeight: 48,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    opacity: disabled ? 0.6 : 1,
                }}
            >
                <Text
                    numberOfLines={1}
                    style={{
                        flex: 1,
                        color: selectedOption || value ? c.text : c.textSecondary,
                        fontSize: 15,
                        paddingVertical: 12,
                    }}
                >
                    {displayLabel}
                </Text>
                <ChevronDown size={18} color={c.textSecondary} />
            </Pressable>
            <Modal
                transparent
                visible={open}
                animationType="slide"
                onRequestClose={() => setOpen(false)}
            >
                <View
                    style={{
                        flex: 1,
                        justifyContent: "flex-end",
                    }}
                    accessibilityViewIsModal
                >
                    <Pressable
                        accessibilityLabel="Close options"
                        onPress={() => setOpen(false)}
                        style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: "rgba(0,0,0,0.45)",
                        }}
                    />
                    <View
                        style={{
                            backgroundColor: c.surface,
                            borderTopLeftRadius: 20,
                            borderTopRightRadius: 20,
                            maxHeight: "75%",
                        }}
                    >
                        <SafeAreaView edges={["bottom"]} style={{ flexShrink: 1 }}>
                            <Text
                                style={{
                                    padding: 18,
                                    color: c.text,
                                    fontSize: 18,
                                    fontWeight: "700",
                                }}
                            >
                                {label}
                            </Text>
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                style={{ flexShrink: 1 }}
                            >
                                {options.map((item) => {
                                    const isSelected = value === item.value;
                                    return (
                                        <Pressable
                                            key={item.value}
                                            accessibilityRole="button"
                                            onPress={() => {
                                                onChange(item.value);
                                                setOpen(false);
                                            }}
                                            style={{
                                                padding: 18,
                                                backgroundColor: isSelected
                                                    ? c.primarySoft
                                                    : c.surface,
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    color: c.text,
                                                    fontSize: 16,
                                                    fontWeight: isSelected
                                                        ? "600"
                                                        : "400",
                                                }}
                                            >
                                                {item.label}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </SafeAreaView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
