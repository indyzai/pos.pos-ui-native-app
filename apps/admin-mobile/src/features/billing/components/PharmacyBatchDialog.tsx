import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CalendarDays, Check, X } from 'lucide-react-native';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { formatCurrency } from '../../../shared/utils/currency';
import { batchStatus, preferredProductBatch } from '../domain/productBatches';
import type { CartCustomization, Product, ProductBatch } from '../types/billing';

export function PharmacyBatchDialog({
    product,
    batches,
    currencyCode,
    onClose,
    onAdd,
}: {
    product?: Product;
    batches: ProductBatch[];
    currencyCode: string;
    onClose: () => void;
    onAdd: (product: Product, customization: CartCustomization) => void;
}) {
    const { themeColors: c } = useAppTheme();
    const [selectedId, setSelectedId] = useState('');
    useEffect(() => {
        setSelectedId(product ? preferredProductBatch(batches)?.id || '' : '');
    }, [batches, product]);
    if (!product) return null;
    const selected = batches.find((batch) => batch.id === selectedId);
    const confirm = () => {
        if (!selected) return;
        onAdd(
            {
                ...product,
                stock: selected.stock,
                price: selected.price ?? product.price,
                details: {
                    ...product.details,
                    batchNumber: selected.batchNumber,
                    expiryDate: selected.expiryDate,
                    manufacturer: selected.manufacturer,
                    schedule: selected.schedule,
                    prescriptionRequired:
                        selected.prescriptionRequired ?? product.details?.prescriptionRequired,
                },
            },
            {
                key: `batch:${selected.id}`,
                label: [`Batch ${selected.batchNumber}`, selected.expiryDate && `Exp ${selected.expiryDate}`]
                    .filter(Boolean)
                    .join(' · '),
                metadata: {
                    batchId: selected.id,
                    batchNumber: selected.batchNumber,
                    expiryDate: selected.expiryDate,
                },
            },
        );
        onClose();
    };
    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <View style={s.overlay}>
                <AppPressable style={s.backdrop} onPress={onClose} />
                <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.surface }]}>
                    <View style={s.header}>
                        <View style={s.heading}>
                            <Boxes size={20} color={c.primary} />
                            <View>
                                <Text style={[s.title, { color: c.text }]}>Select medicine batch</Text>
                                <Text style={[s.subtitle, { color: c.textSecondary }]}>{product.name}</Text>
                            </View>
                        </View>
                        <AppPressable onPress={onClose} style={s.close}>
                            <X size={19} color={c.textSecondary} />
                        </AppPressable>
                    </View>
                    <ScrollView contentContainerStyle={s.body}>
                        {batches.map((batch) => {
                            const status = batchStatus(batch);
                            const blocked = status.expired || batch.stock <= 0;
                            const active = selectedId === batch.id;
                            return (
                                <AppPressable
                                    key={batch.id}
                                    disabled={blocked}
                                    onPress={() => setSelectedId(batch.id)}
                                    style={[
                                        s.batch,
                                        {
                                            borderColor: active ? c.primary : c.outlineMuted,
                                            backgroundColor: active ? c.primarySoft : c.background,
                                            opacity: blocked ? 0.5 : 1,
                                        },
                                    ]}
                                >
                                    <View style={s.batchTop}>
                                        <Text style={[s.batchNumber, { color: c.text }]}>
                                            {batch.batchNumber}
                                        </Text>
                                        {active ? (
                                            <Check size={16} color={c.primary} />
                                        ) : status.expiringSoon || status.expired ? (
                                            <AlertTriangle size={16} color={c.error} />
                                        ) : null}
                                    </View>
                                    <View style={s.metaRow}>
                                        <CalendarDays
                                            size={12}
                                            color={
                                                status.expired || status.expiringSoon
                                                    ? c.error
                                                    : c.textSecondary
                                            }
                                        />
                                        <Text
                                            style={[
                                                s.meta,
                                                {
                                                    color:
                                                        status.expired || status.expiringSoon
                                                            ? c.error
                                                            : c.textSecondary,
                                                },
                                            ]}
                                        >
                                            {batch.expiryDate || 'Expiry not configured'} · {batch.stock}{' '}
                                            available
                                        </Text>
                                        <Text style={[s.price, { color: c.primary }]}>
                                            {formatCurrency(batch.price ?? product.price, currencyCode)}
                                        </Text>
                                    </View>
                                    {batch.manufacturer ? (
                                        <Text style={[s.meta, { color: c.textSecondary }]}>
                                            {batch.manufacturer}
                                            {batch.schedule ? ` · ${batch.schedule}` : ''}
                                        </Text>
                                    ) : null}
                                </AppPressable>
                            );
                        })}
                        {!batches.length ? (
                            <Text style={[s.empty, { color: c.textSecondary }]}>
                                No batch data is configured for this medicine.
                            </Text>
                        ) : null}
                    </ScrollView>
                    <AppPressable
                        disabled={!selected}
                        onPress={confirm}
                        style={[s.confirm, { backgroundColor: c.primary, opacity: selected ? 1 : 0.45 }]}
                    >
                        <Text style={s.confirmText}>Add selected batch</Text>
                    </AppPressable>
                </SafeAreaView>
            </View>
        </Modal>
    );
}
const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,15,25,.56)' },
    sheet: { maxHeight: '82%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    title: { fontSize: 16, fontWeight: '900' },
    subtitle: { fontSize: 11, marginTop: 2 },
    close: { padding: 8 },
    body: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
    batch: { borderWidth: 1, borderRadius: 13, padding: 12, gap: 6 },
    batchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    batchNumber: { fontSize: 13, fontWeight: '900' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    meta: { fontSize: 9, fontWeight: '700' },
    price: { marginLeft: 'auto', fontSize: 11, fontWeight: '900' },
    empty: { paddingVertical: 40, textAlign: 'center', fontSize: 11, fontWeight: '700' },
    confirm: { minHeight: 50, margin: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    confirmText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
