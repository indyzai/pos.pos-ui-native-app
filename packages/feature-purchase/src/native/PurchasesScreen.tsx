import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "expo-router";
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { randomUUID } from "expo-crypto";
import type * as ImagePickerType from "expo-image-picker";
import {
    Camera,
    Check,
    Plus,
    RefreshCw,
    Sparkles,
    SplitSquareHorizontal,
    Upload,
    X,
} from "lucide-react-native";
import {
    AppPressable,
    DataStateMessage,
    useAppHeader,
    useAppTheme,
    useBottomNavigation,
    useBackgroundRefresh,
} from "@indyzai/pos-ui-native";
import { showSnackbar } from "@indyzai/pos-ui-native/snackbar";
import { useAuthSession } from "@indyzai/pos-auth/session";
import { type AppSurface } from "@indyzai/pos-permissions";
import { usePermissions } from "@indyzai/pos-auth/permissions";
import {
    createLocalFirstTableHook,
    createScopeKey,
    useLocalDatabase,
} from "@indyzai/pos-database";
import type { Product } from "@indyzai/feature-billing/types/billing";
import {
    allocatePurchaseSplits,
    type PurchaseItemSplit,
} from "@indyzai/feature-purchase/domain";
import type {
    Purchase,
    PurchaseLine as Line,
    createPurchasesApi,
} from "@indyzai/feature-purchase/purchasesApi";

const useProducts = createLocalFirstTableHook<Product>({ table: "products" });
const usePurchases = createLocalFirstTableHook<Purchase>({
    table: "purchase_orders",
    entityType: "PURCHASE",
});

export function PurchasesScreen({
    surface = "pos",
    api,
    refreshProducts,
}: {
    surface?: AppSurface;
    api: ReturnType<typeof createPurchasesApi>;
    refreshProducts?: (signal?: AbortSignal) => Promise<unknown>;
}) {
    const pathname = usePathname();
    const { themeColors: c } = useAppTheme();
    const { width, height } = useWindowDimensions();
    const { setCenterItem } = useBottomNavigation();
    const auth = useAuthSession();
    const { setFeatureLoading } = useAppHeader();
    const local = useLocalDatabase();
    const products = useProducts();
    const purchases = usePurchases();
    const [open, setOpen] = useState(false);
    const [supplier, setSupplier] = useState("");
    const [invoice, setInvoice] = useState("");
    const [lines, setLines] = useState<Line[]>([]);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [analyzing, setAnalyzing] = useState(false);
    const [editingId, setEditingId] = useState<string>();
    const saving = useRef(false);
    const [newProductName, setNewProductName] = useState("");
    const [newProductPrice, setNewProductPrice] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState("");
    const bottomNavigationHidden = width >= 700 && width > height;
    const { can } = usePermissions(surface);
    const canEdit = can("purchases.edit");
    const total = useMemo(
        () =>
            lines.reduce(
                (sum, line) =>
                    sum +
                    line.quantity *
                        line.purchasePrice *
                        (1 + line.taxRate / 100),
                0,
            ),
        [lines],
    );
    const refreshPurchases = useCallback(async () => {
        if (!auth.session || !local.database || refreshing) return;
        setRefreshing(true);
        setRefreshError("");
        try {
            await api.refresh();
            await purchases.reload();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Showing local data.";
            setRefreshError(message);
            showSnackbar("Could not refresh purchases", message);
        } finally {
            setRefreshing(false);
        }
    }, [api, auth.session, local.database, purchases, refreshing]);
    useEffect(() => {
        if (refreshing || purchases.loading)
            setFeatureLoading({
                id: "purchases",
                title: "Loading purchases",
                message: "Updating local purchase history",
            });
        else setFeatureLoading(undefined);
        return () => setFeatureLoading(undefined);
    }, [purchases.loading, refreshing, setFeatureLoading]);
    useBackgroundRefresh(
        pathname === "/purchases" &&
            auth.session &&
            local.status === "ready" &&
            local.database
            ? `purchases:${createScopeKey(local.database.scope)}`
            : undefined,
        (signal) => api.refresh(signal),
    );
    useBackgroundRefresh(
        pathname === "/purchases" &&
            open &&
            refreshProducts &&
            local.database &&
            local.status === "ready"
            ? `purchase-products:${createScopeKey(local.database.scope)}`
            : undefined,
        (signal) => refreshProducts ? refreshProducts(signal) : Promise.resolve(),
    );
    useEffect(() => {
        if (!bottomNavigationHidden)
            setCenterItem({
                label: "New PO",
                icon: Plus,
                onPress: () => setOpen(true),
            });
        else setCenterItem(null);
        return () => setCenterItem(null);
    }, [bottomNavigationHidden, setCenterItem]);

    const addProduct = (product: Product) => {
        setLines((current) =>
            current.some((line) => line.productId === product.id)
                ? current
                : [
                      ...current,
                      {
                          productId: product.id,
                          productName: product.name,
                          quantity: 1,
                          purchasePrice: product.price,
                          taxRate: product.taxRate ?? 0,
                          unit: "pcs",
                      },
                  ],
        );
        setNewProductName("");
        setNewProductPrice("");
    };
    const productSuggestions = useMemo(() => {
        const query = newProductName.trim().toLowerCase();
        if (!query) return [];
        return products.data
            .filter(
                ({ payload }) =>
                    !lines.some((line) => line.productId === payload.id) &&
                    (payload.name.toLowerCase().includes(query) ||
                        !!payload.sku?.toLowerCase().includes(query) ||
                        !!payload.barcode?.toLowerCase().includes(query)),
            )
            .slice(0, 8);
    }, [lines, newProductName, products.data]);
    const updateLine = (index: number, values: Partial<Line>) =>
        setLines((current) =>
            current.map((line, i) =>
                i === index ? { ...line, ...values } : line,
            ),
        );
    const addNewProduct = () => {
        const name = newProductName.trim();
        const price = Number(newProductPrice);
        if (!name || !Number.isFinite(price) || price < 0)
            return showSnackbar(
                "Invalid product",
                "Enter a product name and valid purchase price.",
            );
        setLines((current) => [
            ...current,
            {
                productName: name,
                quantity: 1,
                purchasePrice: price,
                taxRate: 0,
                unit: "pcs",
            },
        ]);
        setNewProductName("");
        setNewProductPrice("");
    };
    const split = (index: number) => {
        const line = lines[index];
        try {
            const first = Math.floor(line.quantity / 2);
            updateLine(index, {
                splits: allocatePurchaseSplits(
                    line.quantity,
                    line.quantity * line.purchasePrice,
                    [
                        {
                            targetProductName: `${line.productName} A`,
                            quantity: first,
                            unit: line.unit || "pcs",
                        },
                        {
                            targetProductName: `${line.productName} B`,
                            quantity: line.quantity - first,
                            unit: line.unit || "pcs",
                        },
                    ],
                ),
            });
            showSnackbar(
                "Item split added",
                "Edit the generated split products before completing the purchase.",
            );
        } catch (error) {
            showSnackbar(
                "Cannot split item",
                error instanceof Error ? error.message : "Check quantity.",
            );
        }
    };
    const analyze = async () => {
        if (!auth.session || !photos.length) return;
        setAnalyzing(true);
        try {
            const extracted = await api.analyzeImages(
                photos,
                products.data.map((row) => row.payload),
            );
            setLines(extracted);
            setCameraOpen(false);
            setOpen(true);
        } catch (error) {
            showSnackbar(
                "AI bill import failed",
                error instanceof Error ? error.message : "Try again.",
            );
        } finally {
            setAnalyzing(false);
        }
    };
    const save = async (status: Purchase["status"]) => {
        if (saving.current) return;
        if (!supplier.trim())
            return showSnackbar("Supplier required", "Enter a supplier name.");
        if (!lines.length)
            return showSnackbar(
                "Add items",
                "Select at least one purchase item.",
            );
        const payload: Purchase = {
            id: editingId ?? `purchase-${randomUUID()}`,
            invoiceNumber: invoice.trim() || undefined,
            supplierName: supplier.trim() || undefined,
            status,
            items: lines,
            total,
            createdAt:
                purchases.data.find((row) => row.id === editingId)?.payload
                    .createdAt || new Date().toISOString(),
            scannedImages: photos.length,
        };
        saving.current = true;
        try {
            await purchases.createMutation({
                payload,
                operation: editingId ? "UPDATE" : "CREATE",
                localId: editingId ?? payload.id,
            });
        } catch (error) {
            showSnackbar(
                "Could not save purchase",
                error instanceof Error
                    ? error.message
                    : "Local storage is unavailable.",
            );
            return;
        } finally {
            saving.current = false;
        }
        setOpen(false);
        setLines([]);
        setPhotos([]);
        setInvoice("");
        setSupplier("");
        setEditingId(undefined);
        showSnackbar(
            status === "DRAFT" ? "Purchase draft saved" : "Purchase queued",
            `${lines.length} items saved locally.`,
        );
    };
    return (
        <View style={[s.screen, { backgroundColor: c.background }]}>
            <ScrollView contentContainerStyle={s.content}>
                <View style={s.heading}>
                    <View>
                        <Text style={[s.title, { color: c.text }]}>
                            Purchases
                        </Text>
                        <Text style={{ color: c.textSecondary }}>
                            Supplier purchases and stock intake
                        </Text>
                    </View>
                    <View style={s.headingActions}>
                        <AppPressable
                            accessibilityLabel="Refresh purchases"
                            disabled={refreshing}
                            onPress={() => void refreshPurchases()}
                            style={[
                                s.iconButton,
                                { backgroundColor: c.surfaceMuted },
                            ]}
                        >
                            <RefreshCw size={18} color={c.text} />
                        </AppPressable>
                        <AppPressable
                            onPress={() => setCameraOpen(true)}
                            style={[s.outline, { borderColor: c.primary }]}
                        >
                            <Sparkles size={17} color={c.primary} />
                            <Text
                                style={{ color: c.primary, fontWeight: "800" }}
                            >
                                AI bills
                            </Text>
                        </AppPressable>
                        {bottomNavigationHidden ? (
                            <AppPressable
                                onPress={() => setOpen(true)}
                                style={[
                                    s.button,
                                    { backgroundColor: c.primary },
                                ]}
                            >
                                <Plus size={17} color="#fff" />
                                <Text style={s.white}>New purchase</Text>
                            </AppPressable>
                        ) : null}
                    </View>
                </View>
                {refreshError ? (
                    <DataStateMessage
                        kind="error"
                        title="Purchases could not be updated"
                        message={refreshError}
                        onRetry={() => void refreshPurchases()}
                    />
                ) : null}
                {!refreshError &&
                !refreshing &&
                !purchases.loading &&
                !purchases.data.length ? (
                    <DataStateMessage
                        kind="empty"
                        title="No purchases yet"
                        message="Create a purchase or import supplier bill images with AI."
                    />
                ) : null}
                {purchases.data.map(({ id, payload }) => (
                    <AppPressable
                        key={payload.id}
                        disabled={!canEdit || payload.status !== "DRAFT"}
                        onPress={() => {
                            setEditingId(id);
                            setSupplier(payload.supplierName ?? "");
                            setInvoice(payload.invoiceNumber ?? "");
                            setLines(payload.items);
                            setOpen(true);
                        }}
                        style={[
                            s.card,
                            {
                                backgroundColor: c.surface,
                                borderColor: c.outlineMuted,
                            },
                        ]}
                    >
                        <View>
                            <Text style={[s.cardTitle, { color: c.text }]}>
                                {payload.invoiceNumber || payload.id}
                            </Text>
                            <Text style={{ color: c.textSecondary }}>
                                {payload.supplierName || "No supplier"} ·{" "}
                                {payload.items.length} items
                            </Text>
                        </View>
                        <Text style={[s.cardTitle, { color: c.text }]}>
                            ₹{payload.total.toFixed(2)}
                        </Text>
                        {canEdit && payload.status === "DRAFT" ? (
                            <Text style={{ color: c.primary }}>Editable</Text>
                        ) : null}
                    </AppPressable>
                ))}
            </ScrollView>
            <Modal
                visible={open}
                animationType="slide"
                onRequestClose={() => setOpen(false)}
            >
                <ScrollView
                    style={{ backgroundColor: c.background }}
                    contentContainerStyle={s.form}
                >
                    <View style={s.heading}>
                        <Text style={[s.title, { color: c.text }]}>
                            Create purchase
                        </Text>
                        <AppPressable onPress={() => setOpen(false)}>
                            <X color={c.text} />
                        </AppPressable>
                    </View>
                    <TextInput
                        placeholder="Supplier"
                        value={supplier}
                        onChangeText={setSupplier}
                        style={[
                            s.input,
                            { color: c.text, borderColor: c.outline },
                        ]}
                    />
                    <TextInput
                        placeholder="Invoice number"
                        value={invoice}
                        onChangeText={setInvoice}
                        style={[
                            s.input,
                            { color: c.text, borderColor: c.outline },
                        ]}
                    />
                    <Text style={[s.section, { color: c.text }]}>
                        Add products
                    </Text>
                    <View
                        style={[
                            s.inlineProduct,
                            { borderColor: c.outlineMuted },
                        ]}
                    >
                        <View style={s.inlineProductFields}>
                            <TextInput
                                placeholder="Search or enter a new product"
                                placeholderTextColor={c.textSecondary}
                                value={newProductName}
                                onChangeText={setNewProductName}
                                style={[
                                    s.input,
                                    s.inlineName,
                                    { color: c.text, borderColor: c.outline },
                                ]}
                            />
                            <TextInput
                                placeholder="Cost"
                                placeholderTextColor={c.textSecondary}
                                value={newProductPrice}
                                onChangeText={setNewProductPrice}
                                keyboardType="decimal-pad"
                                style={[
                                    s.input,
                                    s.inlineCost,
                                    { color: c.text, borderColor: c.outline },
                                ]}
                            />
                        </View>
                        {productSuggestions.map(({ payload }) => (
                            <AppPressable
                                key={payload.id}
                                onPress={() => addProduct(payload)}
                                style={[
                                    s.productSuggestion,
                                    { borderColor: c.outlineMuted },
                                ]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text
                                        style={{
                                            color: c.text,
                                            fontWeight: "800",
                                        }}
                                    >
                                        {payload.name}
                                    </Text>
                                    <Text
                                        style={{
                                            color: c.textSecondary,
                                            fontSize: 11,
                                        }}
                                    >
                                        {payload.sku ||
                                            payload.barcode ||
                                            "Existing product"}{" "}
                                        · ₹{payload.price}
                                    </Text>
                                </View>
                                <Text
                                    style={{
                                        color: c.primary,
                                        fontWeight: "800",
                                    }}
                                >
                                    Select
                                </Text>
                            </AppPressable>
                        ))}
                        <AppPressable
                            onPress={addNewProduct}
                            style={[s.button, { backgroundColor: c.primary }]}
                        >
                            <Plus size={17} color="#fff" />
                            <Text style={s.white}>
                                Create “{newProductName.trim() || "new product"}
                                ”
                            </Text>
                        </AppPressable>
                    </View>
                    {lines.map((line, index) => (
                        <View
                            key={`${line.productId}-${index}`}
                            style={[s.line, { borderColor: c.outlineMuted }]}
                        >
                            <Text style={[s.cardTitle, { color: c.text }]}>
                                {line.productName}
                            </Text>
                            <View style={s.lineFields}>
                                <TextInput
                                    value={String(line.quantity)}
                                    onChangeText={(v) =>
                                        updateLine(index, {
                                            quantity: Number(v) || 0,
                                        })
                                    }
                                    keyboardType="decimal-pad"
                                    style={[
                                        s.smallInput,
                                        {
                                            color: c.text,
                                            borderColor: c.outline,
                                        },
                                    ]}
                                />
                                <TextInput
                                    value={String(line.purchasePrice)}
                                    onChangeText={(v) =>
                                        updateLine(index, {
                                            purchasePrice: Number(v) || 0,
                                        })
                                    }
                                    keyboardType="decimal-pad"
                                    style={[
                                        s.smallInput,
                                        {
                                            color: c.text,
                                            borderColor: c.outline,
                                        },
                                    ]}
                                />
                                <AppPressable onPress={() => split(index)}>
                                    <SplitSquareHorizontal color={c.primary} />
                                </AppPressable>
                            </View>
                            {line.splits?.map((item, i) => (
                                <Text
                                    key={i}
                                    style={{ color: c.textSecondary }}
                                >
                                    {item.targetProductName}: {item.quantity} ·
                                    ₹{item.allocatedCost}
                                </Text>
                            ))}
                        </View>
                    ))}
                    <Text style={[s.total, { color: c.text }]}>
                        Total ₹{total.toFixed(2)}
                    </Text>
                    <View style={s.headingActions}>
                        <AppPressable
                            onPress={() => void save("DRAFT")}
                            style={[s.outline, { borderColor: c.primary }]}
                        >
                            <Text style={{ color: c.primary }}>Save draft</Text>
                        </AppPressable>
                        <AppPressable
                            onPress={() => void save("COMPLETED")}
                            style={[s.button, { backgroundColor: c.primary }]}
                        >
                            <Check color="#fff" />
                            <Text style={s.white}>Complete</Text>
                        </AppPressable>
                    </View>
                </ScrollView>
            </Modal>
            <BillCamera
                visible={cameraOpen}
                photos={photos}
                setPhotos={setPhotos}
                analyzing={analyzing}
                onAnalyze={() => void analyze()}
                onClose={() => setCameraOpen(false)}
            />
        </View>
    );
}

function BillCamera({
    visible,
    photos,
    setPhotos,
    analyzing,
    onAnalyze,
    onClose,
}: {
    visible: boolean;
    photos: string[];
    setPhotos: (value: string[]) => void;
    analyzing: boolean;
    onAnalyze: () => void;
    onClose: () => void;
}) {
    const [permission, requestPermission] = useCameraPermissions();
    const ref = useRef<CameraView>(null);
    const capture = async () => {
        const photo = await ref.current?.takePictureAsync({
            base64: true,
            quality: 0.7,
        });
        if (photo?.base64)
            setPhotos([...photos, `data:image/jpeg;base64,${photo.base64}`]);
    };
    const uploadImages = async () => {
        try {
            const ImagePicker: typeof ImagePickerType = require("expo-image-picker");
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsMultipleSelection: true,
                selectionLimit: Math.max(1, 10 - photos.length),
                base64: true,
                quality: 0.7,
            });
            if (result.canceled) return;
            const images = result.assets.map((asset) => {
                if (!asset.base64)
                    throw new Error("Unable to read the selected bill image.");
                return `data:image/jpeg;base64,${asset.base64}`;
            });
            setPhotos([...photos, ...images].slice(0, 10));
        } catch (error) {
            showSnackbar(
                "Could not add images",
                error instanceof Error
                    ? error.message
                    : "Try taking a photo instead.",
            );
        }
    };
    return (
        <Modal visible={visible} animationType="slide">
            <View style={s.camera}>
                {permission?.granted ? (
                    <CameraView
                        ref={ref}
                        style={StyleSheet.absoluteFill}
                        facing="back"
                    />
                ) : (
                    <AppPressable
                        onPress={() => void requestPermission()}
                        style={s.center}
                    >
                        <Camera color="#fff" />
                        <Text style={s.white}>Allow camera</Text>
                    </AppPressable>
                )}
                <View style={s.cameraActions}>
                    <AppPressable onPress={onClose} style={s.cameraButton}>
                        <X color="#fff" />
                    </AppPressable>
                    <AppPressable
                        onPress={() => void capture()}
                        style={s.capture}
                    >
                        <Camera color="#fff" />
                    </AppPressable>
                    <AppPressable
                        disabled={analyzing || photos.length >= 10}
                        onPress={() => void uploadImages()}
                        style={s.cameraButton}
                    >
                        <Upload color="#fff" size={19} />
                    </AppPressable>
                    <AppPressable
                        disabled={!photos.length || analyzing}
                        onPress={onAnalyze}
                        style={s.cameraButton}
                    >
                        <Text style={s.white}>
                            {analyzing ? "…" : String(photos.length)}
                        </Text>
                        <Sparkles color="#fff" size={16} />
                    </AppPressable>
                </View>
            </View>
        </Modal>
    );
}
const s = StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 18, gap: 10 },
    heading: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    headingActions: { flexDirection: "row", gap: 8, alignItems: "center" },
    title: { fontSize: 24, fontWeight: "900" },
    loading: {
        paddingVertical: 10,
        textAlign: "center",
        fontSize: 12,
        fontWeight: "700",
    },
    iconButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    button: {
        minHeight: 42,
        paddingHorizontal: 14,
        borderRadius: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    outline: {
        minHeight: 42,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    white: { color: "#fff", fontWeight: "800" },
    card: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 13,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
    },
    cardTitle: { fontWeight: "900" },
    form: { padding: 20, gap: 12 },
    input: {
        height: 46,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    section: { fontWeight: "900", marginTop: 8 },
    product: { padding: 10, borderWidth: 1, borderRadius: 10, marginRight: 8 },
    productSuggestion: {
        minHeight: 50,
        paddingHorizontal: 11,
        borderWidth: 1,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    inlineProduct: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
    inlineProductFields: { flexDirection: "row", gap: 8 },
    inlineName: { flex: 1 },
    inlineCost: { width: 100 },
    line: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
    lineFields: { flexDirection: "row", alignItems: "center", gap: 8 },
    smallInput: {
        width: 90,
        height: 40,
        borderWidth: 1,
        borderRadius: 9,
        paddingHorizontal: 8,
    },
    total: { fontSize: 18, fontWeight: "900", textAlign: "right" },
    camera: { flex: 1, backgroundColor: "#101526" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    cameraActions: {
        position: "absolute",
        left: 20,
        right: 20,
        bottom: 40,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    cameraButton: {
        minWidth: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: "rgba(0,0,0,.55)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 3,
    },
    capture: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: "#526DF5",
        alignItems: "center",
        justifyContent: "center",
    },
});
