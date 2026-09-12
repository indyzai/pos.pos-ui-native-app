import { Modal, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, Printer, Share2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { BillingOrderContext, CartItem, CheckoutPayment, Customer } from '../types/billing';
import type { BillingTotals } from '../domain/billingTotals';
import { formatCurrency } from '../../../shared/utils/currency';

export type ReceiptData = {
    id: string;
    businessName: string;
    branchName: string;
    counterName: string;
    createdAt: string;
    items: CartItem[];
    totals: BillingTotals;
    payment: CheckoutPayment;
    customer?: Customer;
    orderContext?: BillingOrderContext;
    currencyCode?: string;
};

export function ReceiptDialog({
    receipt,
    printing = false,
    onPrint,
    onClose,
}: {
    receipt?: ReceiptData;
    printing?: boolean;
    onPrint?: () => void;
    onClose: () => void;
}) {
    const { themeColors: c } = useAppTheme();
    if (!receipt) return null;
    const money = (value: number) => formatCurrency(value, receipt.currencyCode);
    const share = () =>
        Share.share({
            message: [
                receipt.businessName,
                `Receipt ${receipt.id}`,
                ...(receipt.customer ? [`Customer ${receipt.customer.name}`] : []),
                ...(receipt.orderContext?.orderMode
                    ? [
                          `Order ${orderModeLabel(receipt.orderContext.orderMode)}${receipt.orderContext.tableName ? ` · ${receipt.orderContext.tableName}` : ''}`,
                      ]
                    : []),
                ...(receipt.orderContext?.doctorName ? [`Doctor ${receipt.orderContext.doctorName}`] : []),
                ...(receipt.orderContext?.prescriptionReference
                    ? [`Prescription ${receipt.orderContext.prescriptionReference}`]
                    : []),
                ...receipt.items.map(
                    (item) => `${item.name} × ${item.quantity}  ${money(item.price * item.quantity)}`,
                ),
                `Total ${money(receipt.totals.total)}`,
                `Paid by ${receipt.payment.method}`,
            ].join('\n'),
        });
    return (
        <Modal visible transparent animationType="slide" onRequestClose={onClose}>
            <View style={s.overlay}>
                <View style={s.backdrop} />
                <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.surface }]}>
                    <View style={s.success}>
                        <CheckCircle2 size={38} color={c.success} />
                        <Text style={[s.title, { color: c.text }]}>Sale saved</Text>
                        <Text style={[s.receiptId, { color: c.textSecondary }]}>Receipt {receipt.id}</Text>
                    </View>
                    <ScrollView contentContainerStyle={s.body}>
                        <View
                            style={[
                                s.receipt,
                                { backgroundColor: c.background, borderColor: c.outlineMuted },
                            ]}
                        >
                            <Text style={[s.business, { color: c.text }]}>{receipt.businessName}</Text>
                            <Text style={[s.meta, { color: c.textSecondary }]}>
                                {receipt.branchName} · {receipt.counterName}
                            </Text>
                            {receipt.customer && (
                                <Text style={[s.meta, { color: c.textSecondary }]}>
                                    Customer · {receipt.customer.name}
                                </Text>
                            )}
                            {receipt.orderContext?.orderMode && (
                                <Text style={[s.meta, { color: c.textSecondary }]}>
                                    {orderModeLabel(receipt.orderContext.orderMode)}
                                    {receipt.orderContext.tableName
                                        ? ` · ${receipt.orderContext.tableName}`
                                        : ''}
                                </Text>
                            )}
                            {receipt.orderContext?.doctorName && (
                                <Text style={[s.meta, { color: c.textSecondary }]}>
                                    Doctor · {receipt.orderContext.doctorName}
                                </Text>
                            )}
                            {receipt.orderContext?.prescriptionReference && (
                                <Text style={[s.meta, { color: c.textSecondary }]}>
                                    Prescription · {receipt.orderContext.prescriptionReference}
                                </Text>
                            )}
                            <Text style={[s.meta, { color: c.textSecondary }]}>
                                {new Date(receipt.createdAt).toLocaleString()}
                            </Text>
                            <View style={[s.divider, { backgroundColor: c.outlineMuted }]} />
                            {receipt.items.map((item) => (
                                <View key={item.lineId || item.id} style={s.line}>
                                    <Text numberOfLines={1} style={[s.lineName, { color: c.text }]}>
                                        {item.name} × {item.quantity}
                                    </Text>
                                    <Text style={[s.lineValue, { color: c.text }]}>
                                        {money(item.price * item.quantity)}
                                    </Text>
                                </View>
                            ))}
                            <View style={[s.divider, { backgroundColor: c.outlineMuted }]} />
                            <ReceiptLine label="Subtotal" value={money(receipt.totals.subtotal)} />
                            {receipt.totals.discount > 0 && (
                                <ReceiptLine label="Discount" value={`-${money(receipt.totals.discount)}`} />
                            )}
                            <ReceiptLine label="Tax" value={money(receipt.totals.tax)} />
                            {receipt.totals.rounding !== 0 && (
                                <ReceiptLine label="Rounding" value={money(receipt.totals.rounding)} />
                            )}
                            <View style={[s.totalLine, { borderTopColor: c.outlineMuted }]}>
                                <Text style={[s.totalLabel, { color: c.text }]}>Total</Text>
                                <Text style={[s.totalValue, { color: c.primary }]}>
                                    {money(receipt.totals.total)}
                                </Text>
                            </View>
                            {receipt.payment.scrap && (
                                <ReceiptLine
                                    label="Scrap exchange"
                                    value={`-${money(receipt.payment.scrap.total)}`}
                                />
                            )}
                            <ReceiptLine
                                label="Payment"
                                value={
                                    receipt.payment.scrap
                                        ? `SCRAP + ${receipt.payment.method}`
                                        : receipt.payment.method
                                }
                            />
                            {receipt.payment.changeDue ? (
                                <ReceiptLine label="Change" value={money(receipt.payment.changeDue)} />
                            ) : null}
                            {receipt.payment.referenceNumber ? (
                                <ReceiptLine label="Reference" value={receipt.payment.referenceNumber} />
                            ) : null}
                        </View>
                    </ScrollView>
                    <View style={s.actions}>
                        {onPrint && (
                            <AppPressable
                                disabled={printing}
                                onPress={onPrint}
                                style={[
                                    s.secondary,
                                    {
                                        borderColor: c.outline,
                                        backgroundColor: c.background,
                                        opacity: printing ? 0.55 : 1,
                                    },
                                ]}
                            >
                                <Printer size={17} color={c.text} />
                                <Text style={[s.actionText, { color: c.text }]}>
                                    {printing ? 'Queuing…' : 'Print'}
                                </Text>
                            </AppPressable>
                        )}
                        <AppPressable
                            onPress={() => void share()}
                            style={[s.secondary, { borderColor: c.outline, backgroundColor: c.background }]}
                        >
                            <Share2 size={17} color={c.text} />
                            <Text style={[s.actionText, { color: c.text }]}>Share</Text>
                        </AppPressable>
                        <AppPressable onPress={onClose} style={[s.done, { backgroundColor: c.primary }]}>
                            <X size={17} color="#FFFFFF" />
                            <Text style={[s.actionText, { color: '#FFFFFF' }]}>Done</Text>
                        </AppPressable>
                    </View>
                </SafeAreaView>
            </View>
        </Modal>
    );
}

function orderModeLabel(value: NonNullable<BillingOrderContext['orderMode']>) {
    return value === 'DINE_IN' ? 'Dine in' : value === 'TAKEAWAY' ? 'Takeaway' : 'Delivery';
}

function ReceiptLine({ label, value }: { label: string; value: string }) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={s.line}>
            <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text>
            <Text selectable style={[s.lineValue, { color: c.text }]}>
                {value}
            </Text>
        </View>
    );
}

const s = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 12, 22, 0.5)' },
    sheet: { maxHeight: '90%', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 20 },
    success: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14 },
    title: { marginTop: 8, fontSize: 19, fontWeight: '900' },
    receiptId: { marginTop: 2, fontSize: 11 },
    body: { paddingHorizontal: 18 },
    receipt: { borderWidth: 1, borderRadius: 16, padding: 16 },
    business: { textAlign: 'center', fontSize: 16, fontWeight: '900' },
    meta: { marginTop: 3, textAlign: 'center', fontSize: 10 },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
    line: {
        minHeight: 25,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    lineName: { flex: 1, fontSize: 11, fontWeight: '700' },
    label: { flex: 1, fontSize: 11 },
    lineValue: { maxWidth: '55%', textAlign: 'right', fontSize: 11, fontWeight: '800' },
    totalLine: {
        marginTop: 6,
        paddingTop: 10,
        borderTopWidth: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    totalLabel: { fontSize: 15, fontWeight: '900' },
    totalValue: { fontSize: 18, fontWeight: '900' },
    actions: { flexDirection: 'row', gap: 10, padding: 18 },
    secondary: {
        flex: 1,
        height: 48,
        borderWidth: 1,
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    done: {
        flex: 1,
        height: 48,
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    actionText: { fontSize: 13, fontWeight: '900' },
});
