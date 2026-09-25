import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { AppPressable } from "@indyzai/pos-ui-native";
import { AppKeyboardSafeView } from "@indyzai/pos-ui-native";
import { showSnackbar } from "@indyzai/pos-ui-native/snackbar";
import { useAppTheme } from "@indyzai/pos-ui-native";
import type {
    InventoryProduct,
    StockReconciliationInput,
} from "@indyzai/feature-inventory/types";

export function ReconcileStockModal({
    product,
    busy,
    onClose,
    onSave,
    onSaveDraft,
    saveLabel = "Reconcile",
}: {
    product: InventoryProduct | null;
    busy: boolean;
    onClose: () => void;
    onSave: (input: StockReconciliationInput) => Promise<void>;
    saveLabel?: string;
    onSaveDraft?: (input: StockReconciliationInput) => Promise<void>;
}) {
    const { themeColors: c } = useAppTheme();
    const [quantity, setQuantity] = useState("");
    const [reference, setReference] = useState("");
    const [remarks, setRemarks] = useState("");
    useEffect(() => {
        setQuantity(product ? String(product.stock) : "");
        setReference("");
        setRemarks("");
    }, [product]);
    if (!product) return null;
    const value = () => {
        const countedQuantity = Number(quantity);
        if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
            showSnackbar(
                "Invalid stock",
                "Counted quantity must be zero or greater.",
            );
            return undefined;
        }
        return {
            productId: product.id,
            countedQuantity,
            reference: reference.trim(),
            remarks: remarks.trim(),
        };
    };
    return (
        <Modal
            transparent
            visible
            animationType="slide"
            onRequestClose={onClose}
        >
            <AppKeyboardSafeView style={styles.overlay}>
                <AppPressable
                    style={styles.backdrop}
                    onPress={busy ? undefined : onClose}
                />
                <View style={[styles.sheet, { backgroundColor: c.surface }]}>
                    <View style={styles.header}>
                        <View>
                            <Text style={[styles.title, { color: c.text }]}>
                                Reconcile stock
                            </Text>
                            <Text
                                style={[
                                    styles.subtitle,
                                    { color: c.textSecondary },
                                ]}
                            >
                                {product.name} · current {product.stock}
                            </Text>
                        </View>
                        <AppPressable
                            onPress={onClose}
                            disabled={busy}
                            style={[
                                styles.close,
                                { backgroundColor: c.surfaceMuted },
                            ]}
                        >
                            <X size={20} color={c.text} />
                        </AppPressable>
                    </View>
                    <Field
                        label="Counted quantity"
                        value={quantity}
                        onChangeText={setQuantity}
                        keyboardType="decimal-pad"
                    />
                    <Field
                        label="Reference (optional)"
                        value={reference}
                        onChangeText={setReference}
                    />
                    <Field
                        label="Remarks (optional)"
                        value={remarks}
                        onChangeText={setRemarks}
                        multiline
                    />
                    <View style={styles.actions}>
                        {onSaveDraft && (
                            <AppPressable
                                disabled={busy}
                                onPress={() => {
                                    const input = value();
                                    if (input) void onSaveDraft(input);
                                }}
                                style={[
                                    styles.draft,
                                    {
                                        borderColor: c.outline,
                                        opacity: busy ? 0.65 : 1,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.draftText,
                                        { color: c.text },
                                    ]}
                                >
                                    Save draft
                                </Text>
                            </AppPressable>
                        )}
                        <AppPressable
                            disabled={busy}
                            onPress={() => {
                                const input = value();
                                if (input) void onSave(input);
                            }}
                            style={[
                                styles.save,
                                {
                                    backgroundColor: c.primary,
                                    opacity: busy ? 0.65 : 1,
                                },
                            ]}
                        >
                            <Check size={18} color="#fff" />
                            <Text style={styles.saveText}>
                                {busy ? "Saving…" : saveLabel}
                            </Text>
                        </AppPressable>
                    </View>
                </View>
            </AppKeyboardSafeView>
        </Modal>
    );
}

function Field(
    props: React.ComponentProps<typeof TextInput> & { label: string },
) {
    const { themeColors: c } = useAppTheme();
    const { label, ...input } = props;
    return (
        <View style={styles.field}>
            <Text style={[styles.label, { color: c.textSecondary }]}>
                {label}
            </Text>
            <TextInput
                {...input}
                placeholderTextColor={c.textSecondary}
                style={[
                    styles.input,
                    input.multiline && styles.notes,
                    {
                        color: c.text,
                        borderColor: c.outline,
                        backgroundColor: c.background,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: "rgba(12,14,19,.4)",
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: 32,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    title: { fontSize: 21, fontWeight: "900" },
    subtitle: { fontSize: 12, marginTop: 4 },
    close: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    field: { marginBottom: 14 },
    label: {
        fontSize: 11,
        fontWeight: "800",
        marginBottom: 6,
        textTransform: "uppercase",
    },
    input: {
        minHeight: 46,
        borderWidth: 1,
        borderRadius: 13,
        paddingHorizontal: 13,
        fontSize: 14,
    },
    notes: { minHeight: 76, paddingTop: 12, textAlignVertical: "top" },
    actions: { flexDirection: "row", gap: 10 },
    draft: {
        flex: 1,
        height: 50,
        borderWidth: 1,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    draftText: { fontSize: 14, fontWeight: "900" },
    save: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    saveText: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
