import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, RotateCcw, X } from 'lucide-react-native';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { AppKeyboardSafeView } from '../../../shared/components/ui/AppKeyboardSafeView';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { formatCurrency } from '../../../shared/utils/currency';
import { refundableQuantity, type RefundSelection } from '../refundPolicy';
import type { RefundRecord, SalesOrder } from '../types';

export function RefundDialog({
  order,
  refunds,
  currencyCode,
  busy,
  onClose,
  onConfirm,
}: {
  order?: SalesOrder;
  refunds: RefundRecord[];
  currencyCode: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (selections: RefundSelection[], reason: string, method: string) => void;
}) {
  const { themeColors: c } = useAppTheme();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('CASH');
  useEffect(() => {
    if (order) {
      setQuantities({});
      setReason('');
      setMethod('CASH');
    }
  }, [order]);
  const selections = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    [quantities],
  );
  if (!order) return null;
  const change = (productId: string, delta: number) => {
    const maximum = refundableQuantity(order, productId, refunds);
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.min(maximum, (current[productId] || 0) + delta)),
    }));
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <AppKeyboardSafeView style={s.overlay}>
        <AppPressable style={s.backdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.surface }]}>
          <View style={s.header}>
            <View>
              <Text style={[s.title, { color: c.text }]}>Create refund</Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>{order.billId}</Text>
            </View>
            <AppPressable onPress={onClose} style={s.iconButton}>
              <X size={19} color={c.textSecondary} />
            </AppPressable>
          </View>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            contentContainerStyle={s.body}
          >
            {order.items.map((item) => {
              const available = refundableQuantity(order, item.productId, refunds);
              const quantity = quantities[item.productId] || 0;
              return (
                <View key={item.productId} style={[s.item, { borderColor: c.outlineMuted }]}>
                  <View style={s.itemCopy}>
                    <Text style={[s.itemName, { color: c.text }]}>{item.name}</Text>
                    <Text style={[s.itemMeta, { color: c.textSecondary }]}>
                      {available} refundable · {formatCurrency(item.unitPrice, currencyCode)}
                    </Text>
                  </View>
                  <AppPressable
                    disabled={!quantity}
                    onPress={() => change(item.productId, -1)}
                    style={[s.qtyButton, { backgroundColor: c.surfaceMuted }]}
                  >
                    <Minus size={14} color={c.text} />
                  </AppPressable>
                  <Text style={[s.quantity, { color: c.text }]}>{quantity}</Text>
                  <AppPressable
                    disabled={quantity >= available}
                    onPress={() => change(item.productId, 1)}
                    style={[s.qtyButton, { backgroundColor: c.surfaceMuted }]}
                  >
                    <Plus size={14} color={c.text} />
                  </AppPressable>
                </View>
              );
            })}
            <Text style={[s.label, { color: c.textSecondary }]}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for refund"
              placeholderTextColor={c.textSecondary}
              style={[s.input, { color: c.text, backgroundColor: c.background, borderColor: c.outline }]}
            />
            <Text style={[s.label, { color: c.textSecondary }]}>Refund method</Text>
            <View style={s.methods}>
              {['CASH', 'CARD', 'UPI', 'CREDIT'].map((value) => (
                <AppPressable
                  key={value}
                  onPress={() => setMethod(value)}
                  style={[s.method, { backgroundColor: method === value ? c.primary : c.surfaceMuted }]}
                >
                  <Text style={[s.methodText, { color: method === value ? '#FFFFFF' : c.text }]}>
                    {value}
                  </Text>
                </AppPressable>
              ))}
            </View>
          </ScrollView>
          <AppPressable
            disabled={!selections.length || busy}
            onPress={() => onConfirm(selections, reason, method)}
            style={[s.confirm, { backgroundColor: c.error, opacity: !selections.length || busy ? 0.5 : 1 }]}
          >
            <RotateCcw size={16} color="#FFFFFF" />
            <Text style={s.confirmText}>{busy ? 'Saving…' : 'Create refund'}</Text>
          </AppPressable>
        </SafeAreaView>
      </AppKeyboardSafeView>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,15,25,.56)' },
  sheet: { maxHeight: '86%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },
  iconButton: { padding: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 9 },
  item: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemCopy: { flex: 1 },
  itemName: { fontSize: 12, fontWeight: '800' },
  itemMeta: { fontSize: 9, marginTop: 3 },
  qtyButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quantity: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '900' },
  label: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginTop: 7 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, fontSize: 12 },
  methods: { flexDirection: 'row', gap: 6 },
  method: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  methodText: { fontSize: 9, fontWeight: '900' },
  confirm: {
    minHeight: 50,
    margin: 16,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
