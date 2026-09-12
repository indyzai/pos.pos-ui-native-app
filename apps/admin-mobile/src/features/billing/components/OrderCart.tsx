import { useMemo, useState, type ReactNode } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
    ArrowRight,
    ArrowLeft,
    Banknote,
    ChevronDown,
    ChevronUp,
    Clock3,
    CreditCard,
    Pause,
    ScanLine,
    Tag,
    UserRound,
    Wallet,
    Recycle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { colors, radii } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { SwipeableCartRow } from './SwipeableCartRow';
import { ProductIcon } from './productIcons';
import type {
    BillingPaymentMethod,
    BillingTaxRate,
    CartItem,
    Customer,
    PaymentMethod,
} from '../types/billing';
import { formatCurrency } from '../../../shared/utils/currency';

type Props = {
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    itemCount: number;
    payment: PaymentMethod;
    onPayment: (method: PaymentMethod) => void;
    paymentMethods: BillingPaymentMethod[];
    customer?: Customer;
    onSelectCustomer?: () => void;
    onChange: (id: string, amount: number) => void;
    onItemDiscount: (id: string, discount: number) => void;
    onItemTaxRate: (id: string, rate: number) => void;
    taxRates: BillingTaxRate[];
    orderDiscount: number;
    onOrderDiscount: (discount: number) => void;
    allowItemDiscounts?: boolean;
    allowOrderDiscounts?: boolean;
    heldOrderCount: number;
    onShowHeldOrders: () => void;
    onHold: () => void | Promise<void>;
    onPettyCash?: () => void;
    onClear: () => void;
    onCheckout: () => void;
    counterClosed?: boolean;
    onClose: () => void;
    currencyCode?: string;
    scrapValue?: number;
    onScrap?: () => void;
    innerContent?: ReactNode;
    innerTitle?: string;
    onInnerBack?: () => void;
};
export function OrderCart({
    items,
    subtotal,
    discount,
    tax,
    total,
    itemCount,
    payment,
    onPayment,
    paymentMethods,
    customer,
    onSelectCustomer,
    onChange,
    onItemDiscount,
    onItemTaxRate,
    taxRates,
    orderDiscount,
    onOrderDiscount,
    allowItemDiscounts = false,
    allowOrderDiscounts = false,
    heldOrderCount,
    onShowHeldOrders,
    onHold,
    onPettyCash,
    onClear,
    onCheckout,
    counterClosed = false,
    onClose,
    currencyCode = 'INR',
    scrapValue = 0,
    onScrap,
    innerContent,
    innerTitle,
    onInnerBack,
}: Props) {
    const { isDark, themeColors: c } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [expandedItem, setExpandedItem] = useState<string>();
    const money = (amount: number) => formatCurrency(amount, currencyCode);
    const headerPanResponder = useMemo(
        () =>
            PanResponder.create({
                onMoveShouldSetPanResponder: (_event, gesture) =>
                    gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx),
                onPanResponderRelease: (_event, gesture) => {
                    if (gesture.dy > 70 || gesture.vy > 1) onClose();
                },
            }),
        [onClose],
    );
    return (
        <View
            style={[
                s.cart,
                {
                    backgroundColor: c.surface,
                    boxShadow: isDark
                        ? '0px -5px 18px rgba(0, 0, 0, 0.32)'
                        : '0px -5px 14px rgba(33, 38, 75, 0.12)',
                },
            ]}
        >
            <View {...headerPanResponder.panHandlers} style={s.head}>
                <View style={s.headerTitleRow}>
                    {innerContent && onInnerBack ? (
                        <AppPressable
                            accessibilityLabel="Back to cart"
                            onPress={onInnerBack}
                            style={[s.headerBack, { backgroundColor: c.surfaceMuted }]}
                        >
                            <ArrowLeft size={17} color={c.textSecondary} />
                        </AppPressable>
                    ) : null}
                    <View>
                        <Text style={[s.title, { color: c.text }]}>
                            {innerContent ? innerTitle : 'Current order'}
                        </Text>
                        <Text style={[s.subtitle, { color: c.textSecondary }]}>
                            {itemCount
                                ? `${itemCount} item${itemCount > 1 ? 's' : ''} in cart`
                                : 'Add items to start a sale'}
                        </Text>
                    </View>
                </View>
                <View style={s.headActions}>
                    {!innerContent && (
                        <>
                            <AppPressable
                                accessibilityLabel={`Held orders, ${heldOrderCount}`}
                                onPress={onShowHeldOrders}
                                style={[s.headerAction, { backgroundColor: c.surfaceMuted }]}
                            >
                                <Clock3 size={15} color={c.textSecondary} />
                                {heldOrderCount > 0 && (
                                    <View style={[s.heldBadge, { backgroundColor: c.primary }]}>
                                        <Text style={s.heldBadgeText}>{heldOrderCount}</Text>
                                    </View>
                                )}
                            </AppPressable>
                            {onPettyCash ? (
                                <AppPressable
                                    accessibilityLabel="Record petty cash"
                                    onPress={onPettyCash}
                                    style={[s.headerAction, { backgroundColor: c.surfaceMuted }]}
                                >
                                    <Wallet size={15} color={c.textSecondary} />
                                </AppPressable>
                            ) : null}
                            <AppPressable
                                accessibilityLabel="Hold current order"
                                disabled={!items.length}
                                onPress={() => void onHold()}
                                style={[
                                    s.headerAction,
                                    { backgroundColor: c.surfaceMuted, opacity: items.length ? 1 : 0.4 },
                                ]}
                            >
                                <Pause size={15} color={c.textSecondary} />
                            </AppPressable>
                            <AppPressable disabled={!items.length} onPress={onClear}>
                                <Text
                                    style={[
                                        s.clear,
                                        { color: c.error },
                                        !items.length && { color: c.outline },
                                    ]}
                                >
                                    Clear
                                </Text>
                            </AppPressable>
                        </>
                    )}
                    <AppPressable
                        accessibilityLabel="Close cart"
                        onPress={onClose}
                        style={[s.close, { backgroundColor: c.surfaceMuted }]}
                    >
                        <Text style={[s.closeText, { color: c.textSecondary }]}>×</Text>
                    </AppPressable>
                </View>
            </View>
            {innerContent ? (
                <View style={s.innerContent}>{innerContent}</View>
            ) : (
                <>
                    {onSelectCustomer ? (
                        <AppPressable
                            onPress={onSelectCustomer}
                            style={[s.customer, { backgroundColor: c.surfaceMuted }]}
                        >
                            <UserRound size={15} color={c.primary} />
                            <View style={s.customerText}>
                                <Text numberOfLines={1} style={[s.customerName, { color: c.text }]}>
                                    {customer?.name || 'Walk-in customer'}
                                </Text>
                                <Text style={[s.customerHint, { color: c.textSecondary }]}>
                                    {customer
                                        ? customer.phone || customer.email || 'Customer selected'
                                        : 'Tap to select customer'}
                                </Text>
                            </View>
                            <Text style={[s.changeCustomer, { color: c.primary }]}>Change</Text>
                        </AppPressable>
                    ) : null}
                    {items.length ? (
                        <ScrollView
                            automaticallyAdjustKeyboardInsets
                            keyboardDismissMode="interactive"
                            keyboardShouldPersistTaps="handled"
                            style={[s.rows, { borderColor: c.outlineMuted }]}
                        >
                            {items.map((item) => {
                                const rowId = item.lineId || item.id;
                                return (
                                    <SwipeableCartRow
                                        key={rowId}
                                        onRemove={() => onChange(rowId, -item.quantity)}
                                    >
                                        <View
                                            style={[
                                                s.itemCard,
                                                { borderColor: c.outlineMuted, backgroundColor: c.surface },
                                            ]}
                                        >
                                            <View style={s.row}>
                                                <View
                                                    style={[
                                                        s.thumb,
                                                        {
                                                            backgroundColor: isDark
                                                                ? c.surfaceMuted
                                                                : c.primarySoft,
                                                        },
                                                    ]}
                                                >
                                                    <ProductIcon iconKey={item.details?.iconKey} size={17} />
                                                </View>
                                                <View style={s.product}>
                                                    <Text
                                                        numberOfLines={1}
                                                        style={[s.productName, { color: c.text }]}
                                                    >
                                                        {item.name}
                                                    </Text>
                                                    <Text
                                                        style={[s.productPrice, { color: c.textSecondary }]}
                                                    >
                                                        {money(item.price)}
                                                    </Text>
                                                    {item.customization?.label ? (
                                                        <Text
                                                            numberOfLines={2}
                                                            style={[s.customization, { color: c.primary }]}
                                                        >
                                                            {item.customization.label}
                                                        </Text>
                                                    ) : null}
                                                    {item.customization?.notes ? (
                                                        <Text
                                                            numberOfLines={2}
                                                            style={[s.itemNotes, { color: c.textSecondary }]}
                                                        >
                                                            {item.customization.notes}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                                <View style={s.qty}>
                                                    <AppPressable
                                                        onPress={() => onChange(rowId, -1)}
                                                        style={[
                                                            s.qtyButton,
                                                            { backgroundColor: c.surfaceMuted },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[s.qtySymbol, { color: c.textSecondary }]}
                                                        >
                                                            −
                                                        </Text>
                                                    </AppPressable>
                                                    <Text style={[s.qtyValue, { color: c.text }]}>
                                                        {item.quantity}
                                                    </Text>
                                                    <AppPressable
                                                        disabled={item.quantity >= item.stock}
                                                        onPress={() => onChange(rowId, 1)}
                                                        style={[
                                                            s.qtyButton,
                                                            {
                                                                backgroundColor: c.surfaceMuted,
                                                                opacity:
                                                                    item.quantity >= item.stock ? 0.4 : 1,
                                                            },
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[s.qtySymbol, { color: c.textSecondary }]}
                                                        >
                                                            +
                                                        </Text>
                                                    </AppPressable>
                                                </View>
                                                <Text style={[s.lineTotal, { color: c.text }]}>
                                                    {money(item.price * item.quantity - (item.discount || 0))}
                                                </Text>
                                                {(allowItemDiscounts || taxRates.length > 0) && (
                                                    <AppPressable
                                                        accessibilityLabel={`${expandedItem === rowId ? 'Hide' : 'Edit'} ${item.name} discount`}
                                                        onPress={() =>
                                                            setExpandedItem((value) =>
                                                                value === rowId ? undefined : rowId,
                                                            )
                                                        }
                                                        style={[
                                                            s.expand,
                                                            { backgroundColor: c.surfaceMuted },
                                                        ]}
                                                    >
                                                        {expandedItem === rowId ? (
                                                            <ChevronUp size={14} color={c.textSecondary} />
                                                        ) : (
                                                            <ChevronDown size={14} color={c.textSecondary} />
                                                        )}
                                                    </AppPressable>
                                                )}
                                            </View>
                                            {(allowItemDiscounts || taxRates.length > 0) &&
                                                expandedItem === rowId && (
                                                    <View
                                                        style={[
                                                            s.itemDetails,
                                                            { borderTopColor: c.outlineMuted },
                                                        ]}
                                                    >
                                                        {allowItemDiscounts && (
                                                            <>
                                                                <View style={s.discountLabel}>
                                                                    <Tag size={13} color={c.textSecondary} />
                                                                    <Text
                                                                        style={[
                                                                            s.discountText,
                                                                            { color: c.textSecondary },
                                                                        ]}
                                                                    >
                                                                        Item discount
                                                                    </Text>
                                                                </View>
                                                                <TextInput
                                                                    value={
                                                                        item.discount
                                                                            ? String(item.discount)
                                                                            : ''
                                                                    }
                                                                    onChangeText={(value) =>
                                                                        onItemDiscount(
                                                                            rowId,
                                                                            Number(value) || 0,
                                                                        )
                                                                    }
                                                                    keyboardType="decimal-pad"
                                                                    placeholder={formatCurrency(
                                                                        0,
                                                                        currencyCode,
                                                                        0,
                                                                    )}
                                                                    placeholderTextColor={c.textSecondary}
                                                                    style={[
                                                                        s.discountInput,
                                                                        {
                                                                            color: c.text,
                                                                            backgroundColor: c.background,
                                                                            borderColor: c.outline,
                                                                        },
                                                                    ]}
                                                                />
                                                            </>
                                                        )}
                                                        {!!taxRates.length && (
                                                            <View style={s.taxPicker}>
                                                                {taxRates.map((taxRate) => {
                                                                    const selected =
                                                                        Number(item.taxRate || 0) ===
                                                                        taxRate.percentage;
                                                                    return (
                                                                        <AppPressable
                                                                            key={taxRate.id}
                                                                            accessibilityLabel={`Set ${item.name} tax to ${taxRate.percentage}%`}
                                                                            onPress={() =>
                                                                                onItemTaxRate(
                                                                                    rowId,
                                                                                    taxRate.percentage,
                                                                                )
                                                                            }
                                                                            style={[
                                                                                s.taxOption,
                                                                                {
                                                                                    borderColor: selected
                                                                                        ? c.primary
                                                                                        : c.outline,
                                                                                    backgroundColor: selected
                                                                                        ? c.primarySoft
                                                                                        : c.background,
                                                                                },
                                                                            ]}
                                                                        >
                                                                            <Text
                                                                                style={[
                                                                                    s.taxOptionText,
                                                                                    {
                                                                                        color: selected
                                                                                            ? c.primary
                                                                                            : c.textSecondary,
                                                                                    },
                                                                                ]}
                                                                            >
                                                                                {taxRate.percentage}%
                                                                            </Text>
                                                                        </AppPressable>
                                                                    );
                                                                })}
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                        </View>
                                    </SwipeableCartRow>
                                );
                            })}
                        </ScrollView>
                    ) : (
                        <View style={[s.empty, { borderColor: c.outlineMuted }]}>
                            <Text>🛍</Text>
                            <Text style={[s.emptyText, { color: c.textSecondary }]}>Your cart is empty</Text>
                        </View>
                    )}
                    <View style={[s.checkoutFooter, { paddingBottom: insets.bottom }]}>
                        {allowOrderDiscounts && items.length > 0 && (
                            <View style={s.orderDiscount}>
                                <View style={s.discountLabel}>
                                    <Tag size={13} color={c.textSecondary} />
                                    <Text style={[s.discountText, { color: c.textSecondary }]}>
                                        Order discount
                                    </Text>
                                </View>
                                <TextInput
                                    value={orderDiscount ? String(orderDiscount) : ''}
                                    onChangeText={(value) => onOrderDiscount(Number(value) || 0)}
                                    keyboardType="decimal-pad"
                                    placeholder={formatCurrency(0, currencyCode, 0)}
                                    placeholderTextColor={c.textSecondary}
                                    style={[
                                        s.discountInput,
                                        {
                                            color: c.text,
                                            backgroundColor: c.background,
                                            borderColor: c.outline,
                                        },
                                    ]}
                                />
                            </View>
                        )}
                        <View style={s.summary}>
                            <Line label="Subtotal" value={money(subtotal)} />
                            {discount > 0 && <Line label="Discount" value={`-${money(discount)}`} />}
                            <Line label="Tax" value={money(tax)} />
                            {scrapValue > 0 && <Line label="Scrap credit" value={`-${money(scrapValue)}`} />}
                            <View style={[s.total, { borderColor: c.outlineMuted }]}>
                                <Text style={[s.totalLabel, { color: c.text }]}>Total</Text>
                                <Text style={[s.totalValue, { color: c.primary }]}>{money(total)}</Text>
                            </View>
                        </View>
                        {onScrap && (
                            <AppPressable
                                onPress={onScrap}
                                style={[s.scrap, { backgroundColor: c.surfaceMuted }]}
                            >
                                <Recycle size={15} color={c.primary} />
                                <Text style={[s.paymentText, { color: c.primary }]}>
                                    {scrapValue ? `Edit scrap · ${money(scrapValue)}` : 'Add customer scrap'}
                                </Text>
                            </AppPressable>
                        )}
                        <View style={s.paymentRow}>
                            {paymentMethods
                                .filter((method) => method.isQuickAccess)
                                .slice(0, 3)
                                .map((method) => {
                                    const Icon =
                                        method.code === 'CASH'
                                            ? Banknote
                                            : method.code === 'CARD'
                                              ? CreditCard
                                              : ScanLine;
                                    return (
                                        <AppPressable
                                            key={method.id}
                                            onPress={() => onPayment(method.code)}
                                            style={[
                                                s.payment,
                                                { borderColor: c.outline, backgroundColor: c.surface },
                                                payment === method.code && {
                                                    backgroundColor: c.surfaceAccent,
                                                    borderColor: c.primary,
                                                },
                                            ]}
                                        >
                                            <Icon
                                                size={14}
                                                color={payment === method.code ? c.primary : c.textSecondary}
                                                strokeWidth={2.2}
                                            />
                                            <Text
                                                style={[
                                                    s.paymentText,
                                                    { color: c.textSecondary },
                                                    payment === method.code && { color: c.primary },
                                                ]}
                                            >
                                                {method.name}
                                            </Text>
                                        </AppPressable>
                                    );
                                })}
                        </View>
                        <AppPressable
                            disabled={!items.length}
                            onPress={onCheckout}
                            style={[
                                s.charge,
                                { backgroundColor: items.length ? c.primarySoft : c.surfaceMuted },
                                items.length > 0 && { borderColor: c.primary },
                            ]}
                        >
                            <Text
                                style={[s.chargeText, { color: items.length ? c.primary : c.textSecondary }]}
                            >
                                {counterClosed
                                    ? 'Open counter to checkout'
                                    : items.length
                                      ? `Charge ${money(Math.max(0, total - scrapValue))}`
                                      : 'Add items to checkout'}
                            </Text>
                            <ArrowRight
                                size={21}
                                color={items.length ? c.primary : c.textSecondary}
                                strokeWidth={2.7}
                            />
                        </AppPressable>
                    </View>
                </>
            )}
        </View>
    );
}
function Line({ label, value }: { label: string; value: string }) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={s.summaryLine}>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>{label}</Text>
            <Text style={[s.summaryValue, { color: c.text }]}>{value}</Text>
        </View>
    );
}
const s = StyleSheet.create({
    cart: {
        flex: 1,
        paddingTop: 15,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.sheet,
        borderTopRightRadius: radii.sheet,
        elevation: 12,
    },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10 },
    headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    headerTitleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
    headerBack: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    innerContent: { flex: 1, minHeight: 0, overflow: 'hidden' },
    scrap: {
        minHeight: 38,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        marginBottom: 8,
    },
    taxPicker: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5 },
    taxOption: {
        minWidth: 42,
        height: 31,
        paddingHorizontal: 7,
        borderWidth: 1,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    taxOptionText: { fontSize: 10, fontWeight: '900' },
    customer: {
        minHeight: 48,
        borderRadius: 12,
        paddingHorizontal: 11,
        marginBottom: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    customerText: { flex: 1 },
    customerName: { fontSize: 11, fontWeight: '800' },
    customerHint: { fontSize: 9, marginTop: 2 },
    changeCustomer: { fontSize: 10, fontWeight: '900' },
    headerAction: {
        width: 28,
        height: 28,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heldBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 15,
        height: 15,
        borderRadius: 8,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heldBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
    title: { fontSize: 15, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: 10, color: '#9096A8', marginTop: 2 },
    clear: { fontSize: 11, fontWeight: '800', color: colors.error, padding: 6 },
    muted: { color: '#C6CAD5' },
    close: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceMuted,
    },
    closeText: { color: colors.textSecondary, fontSize: 21, lineHeight: 23 },
    rows: { flex: 1, borderTopWidth: 1, borderColor: colors.outlineMuted },
    itemCard: { borderBottomWidth: 1 },
    row: {
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 2,
    },
    thumb: {
        width: 30,
        height: 30,
        borderRadius: radii.small,
        alignItems: 'center',
        justifyContent: 'center',
    },
    product: { flex: 1, minWidth: 0 },
    productName: { fontSize: 11, fontWeight: '800', color: '#41455A' },
    productPrice: { fontSize: 10, color: '#858B9E', marginTop: 2 },
    customization: { marginTop: 2, fontSize: 8, fontWeight: '800' },
    itemNotes: { marginTop: 1, fontSize: 8, fontStyle: 'italic' },
    qty: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    qtyButton: {
        width: 21,
        height: 21,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F0F1F7',
    },
    qtySymbol: { fontSize: 15, lineHeight: 17, fontWeight: '700', color: '#555D76' },
    qtyValue: { fontSize: 11, fontWeight: '800', color: '#3C4055', minWidth: 12, textAlign: 'center' },
    lineTotal: { width: 48, textAlign: 'right', fontSize: 11, fontWeight: '900', color: '#31364D' },
    expand: { width: 23, height: 23, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    itemDetails: {
        minHeight: 46,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    discountLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    discountText: { fontSize: 11, fontWeight: '800' },
    discountInput: {
        width: 96,
        height: 34,
        borderWidth: 1,
        borderRadius: 9,
        paddingHorizontal: 9,
        textAlign: 'right',
        fontSize: 12,
        fontWeight: '800',
    },
    empty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: 1,
        borderColor: colors.outlineMuted,
    },
    emptyText: { fontSize: 11, fontWeight: '600', color: '#A0A5B4', marginTop: 2 },
    checkoutFooter: { marginTop: 'auto' },
    orderDiscount: {
        minHeight: 45,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
    },
    summary: { paddingTop: 8, gap: 4 },
    summaryLine: { flexDirection: 'row', justifyContent: 'space-between' },
    summaryLabel: { fontSize: 11, color: '#8D93A5' },
    summaryValue: { fontSize: 11, fontWeight: '700', color: '#555B70' },
    total: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderColor: colors.outlineMuted,
        marginTop: 5,
        paddingTop: 8,
    },
    totalLabel: { fontSize: 14, fontWeight: '900', color: colors.text },
    totalValue: { fontSize: 17, fontWeight: '900', color: colors.primary },
    paymentRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    payment: {
        flex: 1,
        height: 35,
        borderRadius: 9,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: '#E7E9F1',
        backgroundColor: '#FBFBFD',
    },
    paymentActive: { backgroundColor: colors.surfaceAccent, borderColor: '#636CD2' },
    paymentText: { fontSize: 10, fontWeight: '800', color: '#70778C' },
    paymentTextActive: { color: colors.primary },
    charge: {
        height: 49,
        borderRadius: radii.medium,
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.primary,
        marginVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0px 3px 7px rgba(48, 57, 146, 0.28)',
        elevation: 4,
    },
    chargeText: { fontSize: 14, fontWeight: '900', color: '#fff' },
});
