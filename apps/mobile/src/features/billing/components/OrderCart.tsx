import { useMemo } from 'react';
import { PanResponder, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, Banknote, CreditCard, ScanLine } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { colors, radii } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { SwipeableCartRow } from './SwipeableCartRow';
import type { CartItem, PaymentMethod } from '../types/billing';

type Props = {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
  payment: PaymentMethod;
  onPayment: (method: PaymentMethod) => void;
  onChange: (id: string, amount: number) => void;
  onClear: () => void;
  onCheckout: () => void;
  counterClosed?: boolean;
  onClose: () => void;
};
const money = (amount: number) => `₹${amount.toFixed(2)}`;
export function OrderCart({
  items,
  subtotal,
  tax,
  total,
  itemCount,
  payment,
  onPayment,
  onChange,
  onClear,
  onCheckout,
  counterClosed = false,
  onClose,
}: Props) {
  const { isDark, themeColors: c } = useAppTheme();
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
          boxShadow: isDark ? '0px -5px 18px rgba(0, 0, 0, 0.32)' : '0px -5px 14px rgba(33, 38, 75, 0.12)',
        },
      ]}
    >
      <View {...headerPanResponder.panHandlers} style={s.head}>
        <View>
          <Text style={[s.title, { color: c.text }]}>Current order</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            {itemCount ? `${itemCount} item${itemCount > 1 ? 's' : ''} in cart` : 'Add items to start a sale'}
          </Text>
        </View>
        <View style={s.headActions}>
          <AppPressable disabled={!items.length} onPress={onClear}>
            <Text style={[s.clear, { color: c.error }, !items.length && { color: c.outline }]}>Clear</Text>
          </AppPressable>
          <AppPressable
            accessibilityLabel="Close cart"
            onPress={onClose}
            style={[s.close, { backgroundColor: c.surfaceMuted }]}
          >
            <Text style={[s.closeText, { color: c.textSecondary }]}>×</Text>
          </AppPressable>
        </View>
      </View>
      {items.length ? (
        <ScrollView style={[s.rows, { borderColor: c.outlineMuted }]}>
          {items.map((item) => (
            <SwipeableCartRow key={item.id} onRemove={() => onChange(item.id, -item.quantity)}>
              <View style={[s.row, { borderColor: c.outlineMuted, backgroundColor: c.surface }]}>
                <View style={[s.thumb, { backgroundColor: item.color }]}>
                  <Text>{item.emoji}</Text>
                </View>
                <View style={s.product}>
                  <Text numberOfLines={1} style={[s.productName, { color: c.text }]}>
                    {item.name}
                  </Text>
                  <Text style={[s.productPrice, { color: c.textSecondary }]}>{money(item.price)}</Text>
                </View>
                <View style={s.qty}>
                  <AppPressable
                    onPress={() => onChange(item.id, -1)}
                    style={[s.qtyButton, { backgroundColor: c.surfaceMuted }]}
                  >
                    <Text style={[s.qtySymbol, { color: c.textSecondary }]}>−</Text>
                  </AppPressable>
                  <Text style={[s.qtyValue, { color: c.text }]}>{item.quantity}</Text>
                  <AppPressable
                    onPress={() => onChange(item.id, 1)}
                    style={[s.qtyButton, { backgroundColor: c.surfaceMuted }]}
                  >
                    <Text style={[s.qtySymbol, { color: c.textSecondary }]}>+</Text>
                  </AppPressable>
                </View>
                <Text style={[s.lineTotal, { color: c.text }]}>{money(item.price * item.quantity)}</Text>
              </View>
            </SwipeableCartRow>
          ))}
        </ScrollView>
      ) : (
        <View style={[s.empty, { borderColor: c.outlineMuted }]}>
          <Text>🛍</Text>
          <Text style={[s.emptyText, { color: c.textSecondary }]}>Your cart is empty</Text>
        </View>
      )}
      <View style={s.checkoutFooter}>
        <View style={s.summary}>
          <Line label="Subtotal" value={money(subtotal)} />
          <Line label="Tax" value={money(tax)} />
          <View style={[s.total, { borderColor: c.outlineMuted }]}>
            <Text style={[s.totalLabel, { color: c.text }]}>Total</Text>
            <Text style={[s.totalValue, { color: c.primary }]}>{money(total)}</Text>
          </View>
        </View>
        <View style={s.paymentRow}>
          {(
            [
              [Banknote, 'Cash'],
              [ScanLine, 'UPI'],
              [CreditCard, 'Card'],
            ] as const
          ).map(([Icon, method]) => (
            <AppPressable
              key={method}
              onPress={() => onPayment(method)}
              style={[
                s.payment,
                { borderColor: c.outline, backgroundColor: c.surface },
                payment === method && { backgroundColor: c.surfaceAccent, borderColor: c.primary },
              ]}
            >
              <Icon size={14} color={payment === method ? c.primary : c.textSecondary} strokeWidth={2.2} />
              <Text
                style={[
                  s.paymentText,
                  { color: c.textSecondary },
                  payment === method && { color: c.primary },
                ]}
              >
                {method}
              </Text>
            </AppPressable>
          ))}
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
          <Text style={[s.chargeText, { color: items.length ? c.primary : c.textSecondary }]}>
            {counterClosed
              ? 'Open counter to checkout'
              : items.length
                ? `Charge ${money(total)}`
                : 'Add items to checkout'}
          </Text>
          <ArrowRight size={21} color={items.length ? c.primary : c.textSecondary} strokeWidth={2.7} />
        </AppPressable>
      </View>
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
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderColor: '#F3F4F8',
    backgroundColor: colors.surface,
  },
  thumb: { width: 30, height: 30, borderRadius: radii.small, alignItems: 'center', justifyContent: 'center' },
  product: { flex: 1, minWidth: 0 },
  productName: { fontSize: 11, fontWeight: '800', color: '#41455A' },
  productPrice: { fontSize: 10, color: '#858B9E', marginTop: 2 },
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderColor: colors.outlineMuted,
  },
  emptyText: { fontSize: 11, fontWeight: '600', color: '#A0A5B4', marginTop: 2 },
  checkoutFooter: { marginTop: 'auto' },
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
