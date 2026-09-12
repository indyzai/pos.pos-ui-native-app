import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Clock3, Play, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { HeldOrder } from '../types/billing';
import { formatCurrency } from '../../../shared/utils/currency';

const total = (order: HeldOrder) =>
  Math.max(
    0,
    order.items.reduce((sum, item) => sum + item.price * item.quantity - (item.discount || 0), 0) -
      order.orderDiscount,
  );

export function HeldOrdersDialog({
  visible,
  orders,
  onClose,
  onResume,
  onDelete,
  currencyCode = 'INR',
  embedded = false,
}: {
  visible: boolean;
  orders: HeldOrder[];
  onClose: () => void;
  onResume: (order: HeldOrder) => void;
  onDelete: (id: string) => void;
  currencyCode?: string;
  embedded?: boolean;
}) {
  const { themeColors: c } = useAppTheme();
  const panel = (
    <SafeAreaView
      edges={['bottom']}
      style={[s.sheet, embedded && s.embedded, { backgroundColor: c.surface }]}
    >
      {!embedded && (
        <View style={[s.header, { borderBottomColor: c.outlineMuted }]}>
          <View style={s.heading}>
            <Clock3 size={19} color={c.primary} />
            <Text style={[s.title, { color: c.text }]}>Held orders ({orders.length})</Text>
          </View>
          <AppPressable
            accessibilityLabel={embedded ? 'Back to cart' : 'Close held orders'}
            onPress={onClose}
            style={[s.close, { backgroundColor: c.surfaceMuted }]}
          >
            {embedded ? (
              <ArrowLeft size={18} color={c.textSecondary} />
            ) : (
              <X size={18} color={c.textSecondary} />
            )}
          </AppPressable>
        </View>
      )}
      <ScrollView contentContainerStyle={s.body}>
        {!orders.length && (
          <View style={s.empty}>
            <Clock3 size={34} color={c.outline} />
            <Text style={[s.emptyText, { color: c.textSecondary }]}>No held orders</Text>
          </View>
        )}
        {orders.map((order) => (
          <View
            key={order.id}
            style={[s.order, { borderColor: c.outlineMuted, backgroundColor: c.background }]}
          >
            <View style={s.orderCopy}>
              <Text style={[s.orderTitle, { color: c.text }]}>
                {order.items.reduce((sum, item) => sum + item.quantity, 0)} items ·{' '}
                {formatCurrency(Math.max(0, total(order) - (order.scrapExchange?.total || 0)), currencyCode)}
              </Text>
              <Text style={[s.orderMeta, { color: c.textSecondary }]}>
                {new Date(order.heldAt).toLocaleString()}
              </Text>
              <Text numberOfLines={1} style={[s.orderItems, { color: c.textSecondary }]}>
                {order.items.map((item) => `${item.name} ×${item.quantity}`).join(' · ')}
              </Text>
            </View>
            <View style={s.actions}>
              <AppPressable
                onPress={() => onDelete(order.id)}
                style={[s.iconButton, { backgroundColor: c.errorSoft }]}
              >
                <Trash2 size={16} color={c.error} />
              </AppPressable>
              <AppPressable
                onPress={() => onResume(order)}
                style={[s.resume, { backgroundColor: c.primary }]}
              >
                <Play size={15} color="#FFFFFF" />
                <Text style={s.resumeText}>Resume</Text>
              </AppPressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
  if (embedded) return visible ? panel : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <AppPressable style={s.backdrop} onPress={onClose} />
        {panel}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 12, 22, 0.5)' },
  sheet: { maxHeight: '75%', minHeight: 300, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  embedded: { flex: 1, maxHeight: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  header: {
    height: 64,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '900' },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 10 },
  empty: { minHeight: 190, alignItems: 'center', justifyContent: 'center' },
  emptyText: { marginTop: 8, fontSize: 12, fontWeight: '700' },
  order: {
    padding: 13,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderCopy: { flex: 1, minWidth: 0 },
  orderTitle: { fontSize: 13, fontWeight: '900' },
  orderMeta: { marginTop: 3, fontSize: 9 },
  orderItems: { marginTop: 5, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resume: {
    height: 34,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  resumeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
