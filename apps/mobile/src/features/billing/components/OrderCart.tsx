import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../../../components/ui/AppPressable';
import { colors, radii } from '../../../constants/theme';
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
  onClose,
}: Props) {
  return (
    <View style={s.cart}>
      <View style={s.head}>
        <View>
          <Text style={s.title}>Current order</Text>
          <Text style={s.subtitle}>
            {itemCount ? `${itemCount} item${itemCount > 1 ? 's' : ''} in cart` : 'Add items to start a sale'}
          </Text>
        </View>
        <View style={s.headActions}>
          <AppPressable disabled={!items.length} onPress={onClear}>
            <Text style={[s.clear, !items.length && s.muted]}>Clear</Text>
          </AppPressable>
          <AppPressable accessibilityLabel="Close cart" onPress={onClose} style={s.close}>
            <Text style={s.closeText}>×</Text>
          </AppPressable>
        </View>
      </View>
      {items.length ? (
        <ScrollView style={s.rows}>
          {items.map((item) => (
            <View key={item.id} style={s.row}>
              <View style={[s.thumb, { backgroundColor: item.color }]}>
                <Text>{item.emoji}</Text>
              </View>
              <View style={s.product}>
                <Text numberOfLines={1} style={s.productName}>
                  {item.name}
                </Text>
                <Text style={s.productPrice}>{money(item.price)}</Text>
              </View>
              <View style={s.qty}>
                <AppPressable onPress={() => onChange(item.id, -1)} style={s.qtyButton}>
                  <Text style={s.qtySymbol}>−</Text>
                </AppPressable>
                <Text style={s.qtyValue}>{item.quantity}</Text>
                <AppPressable onPress={() => onChange(item.id, 1)} style={s.qtyButton}>
                  <Text style={s.qtySymbol}>+</Text>
                </AppPressable>
              </View>
              <Text style={s.lineTotal}>{money(item.price * item.quantity)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={s.empty}>
          <Text>🛍</Text>
          <Text style={s.emptyText}>Your cart is empty</Text>
        </View>
      )}
      <View style={s.summary}>
        <Line label="Subtotal" value={money(subtotal)} />
        <Line label="GST (5%)" value={money(tax)} />
        <View style={s.total}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{money(total)}</Text>
        </View>
      </View>
      <View style={s.paymentRow}>
        {(
          [
            ['₹', 'Cash'],
            ['◈', 'UPI'],
            ['▣', 'Card'],
          ] as const
        ).map(([icon, method]) => (
          <AppPressable
            key={method}
            onPress={() => onPayment(method)}
            style={[s.payment, payment === method && s.paymentActive]}
          >
            <Text style={[s.paymentIcon, payment === method && s.paymentTextActive]}>{icon}</Text>
            <Text style={[s.paymentText, payment === method && s.paymentTextActive]}>{method}</Text>
          </AppPressable>
        ))}
      </View>
      <AppPressable onPress={onCheckout} style={[s.charge, !items.length && s.chargeOff]}>
        <Text style={s.chargeText}>{items.length ? `Charge ${money(total)}` : 'Add items to checkout'}</Text>
        <Text style={s.arrow}>→</Text>
      </AppPressable>
    </View>
  );
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.summaryLine}>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
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
    shadowColor: '#21264B',
    shadowOpacity: 0.12,
    shadowRadius: 14,
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
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderColor: colors.outlineMuted,
  },
  emptyText: { fontSize: 11, fontWeight: '600', color: '#A0A5B4', marginTop: 2 },
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
  paymentIcon: { fontSize: 12, fontWeight: '900', color: '#8990A4' },
  paymentText: { fontSize: 10, fontWeight: '800', color: '#70778C' },
  paymentTextActive: { color: colors.primary },
  charge: {
    height: 49,
    borderRadius: radii.medium,
    backgroundColor: colors.primary,
    marginVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#303992',
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 4,
  },
  chargeOff: { backgroundColor: '#AEB3D8' },
  chargeText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  arrow: { fontSize: 23, color: '#fff' },
});
