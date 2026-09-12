import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { AppDropdown } from '../../../shared/components/ui/AppDropdown';
import { AppKeyboardSafeView } from '../../../shared/components/ui/AppKeyboardSafeView';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { AppPaperProvider } from '../../../shared/providers/AppPaperProvider';
import { ProductIcon, productIconOptions, type ProductIconKey } from '../../billing/components/productIcons';
import { inventoryApi } from '../inventoryApi';
import type { CreateInventoryItemInput, ProductReferenceData } from '../types';

export function AddInventoryItemModal({
    visible,
    busy,
    quickAdd = false,
    embedded = false,
    onClose,
    onSave,
}: {
    visible: boolean;
    busy: boolean;
    quickAdd?: boolean;
    embedded?: boolean;
    onClose: () => void;
    onSave: (input: CreateInventoryItemInput) => Promise<void>;
}) {
    const { themeColors: c } = useAppTheme();
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [costPrice, setCostPrice] = useState('');
    const [stock, setStock] = useState('0');
    const [minStock, setMinStock] = useState('0');
    const [barcode, setBarcode] = useState('');
    const [skuCode, setSkuCode] = useState('');
    const [notes, setNotes] = useState('');
    const [categoryId, setCategoryId] = useState<number>();
    const [unitId, setUnitId] = useState<number>();
    const [taxId, setTaxId] = useState<number>();
    const [iconKey, setIconKey] = useState<ProductIconKey>('package');
    const [references, setReferences] = useState<ProductReferenceData>({
        categories: [],
        units: [],
        taxes: [],
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setName('');
        setPrice('');
        setCostPrice('');
        setStock('0');
        setMinStock('0');
        setBarcode('');
        setSkuCode('');
        setNotes('');
        setCategoryId(undefined);
        setUnitId(undefined);
        setTaxId(undefined);
        setIconKey('package');
        let active = true;
        setLoading(true);
        void inventoryApi.loadProductReferences().then(
            (value) => {
                if (!active) return;
                setReferences(value);
                setCategoryId(value.categories[0]?.id);
                setUnitId(value.units[0]?.id);
                setLoading(false);
            },
            (error) => {
                if (!active) return;
                setLoading(false);
                showSnackbar(
                    'Could not load product fields',
                    error instanceof Error ? error.message : 'Try again.',
                );
            },
        );
        return () => {
            active = false;
        };
    }, [visible]);

    const save = async () => {
        const selling = Number(price),
            opening = Number(stock);
        const cost = costPrice.trim() ? Number(costPrice) : undefined;
        const minimum = minStock.trim() ? Number(minStock) : undefined;
        if (
            name.trim().length < 2 ||
            !Number.isFinite(selling) ||
            selling < 0 ||
            !Number.isFinite(opening) ||
            opening < 0 ||
            !categoryId ||
            (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) ||
            (minimum !== undefined && (!Number.isFinite(minimum) || minimum < 0))
        ) {
            showSnackbar('Invalid item', 'Enter valid prices and stock quantities, then select a category.');
            return;
        }
        await onSave({
            name: name.trim(),
            price: selling,
            costPrice: cost,
            stock: opening,
            minStock: minimum,
            barcode: barcode.trim() || undefined,
            skuCode: skuCode.trim() || undefined,
            notes: notes.trim() || undefined,
            categoryId,
            unitId,
            taxId,
            iconKey,
            status: quickAdd ? 'INCOMPLETE' : 'ACTIVE',
        });
    };

    const content = (
        <AppPaperProvider>
            <AppKeyboardSafeView style={[s.overlay, embedded && s.embeddedOverlay]}>
                {!embedded ? <AppPressable style={s.backdrop} onPress={busy ? undefined : onClose} /> : null}
                <View style={[s.sheet, embedded && s.embeddedSheet, { backgroundColor: c.surface }]}>
                    {!embedded ? (
                        <View style={s.header}>
                            <View style={s.heading}>
                                <Text style={[s.title, { color: c.text }]}>
                                    {quickAdd ? 'Quick add product' : 'Add inventory item'}
                                </Text>
                                {quickAdd ? (
                                    <Text style={[s.subtitle, { color: c.textSecondary }]}>
                                        Add the essentials now. Complete this product later from Inventory.
                                    </Text>
                                ) : null}
                            </View>
                            <AppPressable
                                disabled={busy}
                                onPress={onClose}
                                style={[s.close, { backgroundColor: c.surfaceMuted }]}
                            >
                                <X size={20} color={c.text} />
                            </AppPressable>
                        </View>
                    ) : null}
                    <ScrollView
                        automaticallyAdjustKeyboardInsets
                        keyboardDismissMode="interactive"
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={s.form}
                    >
                        <Field label="Product name" value={name} onChangeText={setName} />
                        <View style={s.row}>
                            <View style={s.flex}>
                                <Field
                                    label="Selling price"
                                    value={price}
                                    onChangeText={setPrice}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                            {!quickAdd ? (
                                <View style={s.flex}>
                                    <Field
                                        label="Cost price"
                                        value={costPrice}
                                        onChangeText={setCostPrice}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            ) : null}
                        </View>
                        <View style={s.row}>
                            <View style={s.flex}>
                                <Field
                                    label="Opening stock"
                                    value={stock}
                                    onChangeText={setStock}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                            {!quickAdd ? (
                                <View style={s.flex}>
                                    <Field
                                        label="Minimum stock"
                                        value={minStock}
                                        onChangeText={setMinStock}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            ) : null}
                        </View>
                        <AppDropdown
                            label="Category"
                            value={categoryId}
                            options={references.categories.map((x) => ({ value: x.id, label: x.name }))}
                            loading={loading}
                            onChange={(value) => setCategoryId(value ?? undefined)}
                        />
                        {!quickAdd ? (
                            <View style={s.row}>
                                <View style={s.flex}>
                                    <AppDropdown
                                        label="Unit"
                                        value={unitId}
                                        options={references.units.map((x) => ({
                                            value: x.id,
                                            label: `${x.name} (${x.code})`,
                                        }))}
                                        loading={loading}
                                        onChange={(value) => setUnitId(value ?? undefined)}
                                    />
                                </View>
                                <View style={s.flex}>
                                    <AppDropdown
                                        label="Tax"
                                        value={taxId}
                                        options={references.taxes.map((x) => ({
                                            value: x.id,
                                            label: `${x.name} · ${x.percentage}%`,
                                        }))}
                                        loading={loading}
                                        placeholder="No tax"
                                        allowEmpty
                                        onChange={(value) => setTaxId(value ?? undefined)}
                                    />
                                </View>
                            </View>
                        ) : null}
                        {!quickAdd ? (
                            <>
                                <Text style={[s.label, { color: c.textSecondary }]}>Product icon</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={s.icons}
                                >
                                    {productIconOptions.map(([key, option]) => (
                                        <AppPressable
                                            key={key}
                                            onPress={() => setIconKey(key)}
                                            style={[
                                                s.icon,
                                                {
                                                    backgroundColor:
                                                        iconKey === key ? c.primarySoft : c.background,
                                                    borderColor: iconKey === key ? c.primary : c.outline,
                                                },
                                            ]}
                                        >
                                            <ProductIcon iconKey={key} size={23} />
                                            <Text
                                                style={[
                                                    s.iconLabel,
                                                    { color: iconKey === key ? c.primary : c.textSecondary },
                                                ]}
                                            >
                                                {option.label}
                                            </Text>
                                        </AppPressable>
                                    ))}
                                </ScrollView>
                                <View style={s.row}>
                                    <View style={s.flex}>
                                        <Field
                                            label="SKU (optional)"
                                            value={skuCode}
                                            onChangeText={setSkuCode}
                                        />
                                    </View>
                                    <View style={s.flex}>
                                        <Field
                                            label="Barcode (optional)"
                                            value={barcode}
                                            onChangeText={setBarcode}
                                        />
                                    </View>
                                </View>
                                <Field
                                    label="Notes (optional)"
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                    inputStyle={s.notes}
                                />
                            </>
                        ) : null}
                        <AppPressable
                            disabled={busy || loading}
                            onPress={() => void save()}
                            style={[
                                s.save,
                                { backgroundColor: c.primary, opacity: busy || loading ? 0.6 : 1 },
                            ]}
                        >
                            <Plus size={18} color="#fff" />
                            <Text style={s.saveText}>
                                {busy ? 'Adding…' : quickAdd ? 'Quick add product' : 'Add item'}
                            </Text>
                        </AppPressable>
                    </ScrollView>
                </View>
            </AppKeyboardSafeView>
        </AppPaperProvider>
    );
    if (embedded) return visible ? content : null;
    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            {content}
        </Modal>
    );
}

function Field({
    label,
    inputStyle,
    ...input
}: React.ComponentProps<typeof TextInput> & { label: string; inputStyle?: object }) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={s.field}>
            <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text>
            <TextInput
                {...input}
                placeholderTextColor={c.textSecondary}
                style={[
                    s.input,
                    inputStyle,
                    { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                ]}
            />
        </View>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    embeddedOverlay: { justifyContent: 'flex-start' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,14,19,.4)' },
    sheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
    embeddedSheet: {
        flex: 1,
        maxHeight: '100%',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        paddingTop: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontSize: 21, fontWeight: '900' },
    heading: { flex: 1, paddingRight: 12 },
    subtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
    close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    form: { paddingBottom: 20 },
    row: { flexDirection: 'row', gap: 10 },
    flex: { flex: 1, minWidth: 0 },
    field: { marginBottom: 13 },
    label: { fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
    input: { minHeight: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14 },
    notes: { minHeight: 76, paddingTop: 11, textAlignVertical: 'top' },
    icons: { gap: 8, paddingBottom: 13 },
    icon: {
        width: 78,
        minHeight: 62,
        borderWidth: 1,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    iconLabel: { fontSize: 9, fontWeight: '800' },
    save: {
        height: 50,
        borderRadius: 14,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
