import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, CheckCircle2, Clock3, ReceiptText, RotateCcw, Search } from 'lucide-react-native';
import { AppPressable, DataStateMessage } from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { useBottomNavigation, useBottomNavigationClearance } from '@indyzai/pos-ui-native';
import { useAppHeader } from '@indyzai/pos-ui-native';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { formatCurrency } from '@indyzai/pos-ui-native/currency';
import { RefundDialog } from '@indyzai/feature-orders/native/RefundDialog';
import { useOrders } from './useOrders';
import type { SalesOrder } from '@indyzai/feature-orders/types';
import { refundableQuantity } from '@indyzai/feature-orders/refundPolicy';
import { canPerformManagerActions } from '../../config/appAccess';
import { createLogger } from '@indyzai/pos-utils';
import { ReceiptDialog, type ReceiptData } from '@indyzai/feature-billing/receipt-dialog';

const logger = createLogger('Orders');

export function OrdersScreen() {
  const { themeColors: c } = useAppTheme();
  const auth = useAuthSession();
  const managerAccess = canPerformManagerActions(auth.session?.tenant.role, auth.session?.user.role);
  const data = useOrders();
  const bottomClearance = useBottomNavigationClearance();
  const { setCenterItem } = useBottomNavigation();
  const { setFeatureLoading, setFeatureRefresh, setRefreshJob } = useAppHeader();
  const [tab, setTab] = useState<'orders' | 'refunds'>('orders');
  const [search, setSearch] = useState('');
  const [refundOrder, setRefundOrder] = useState<SalesOrder>();
  const [bill, setBill] = useState<ReceiptData>();
  const controller = useRef<AbortController | undefined>(undefined);
  const featureRefreshRef = useRef<() => Promise<void>>(async () => undefined);
  const currencyCode = String(auth.session?.organization?.settings.currency || 'INR');
  const refresh = async () => {
    if (controller.current) return;
    const next = new AbortController();
    controller.current = next;
    setRefreshJob({
      id: `orders-${Date.now()}`,
      text: 'Refreshing orders',
      cancel: () => next.abort(),
    });
    logger.info('Refreshing orders');
    try {
      await data.refresh(next.signal);
      logger.info('Orders refreshed successfully');
    } catch (error) {
      if (!next.signal.aborted) {
        logger.error('Orders refresh failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        showSnackbar('Orders refresh failed', error instanceof Error ? error.message : 'Try again.');
      }
    } finally {
      if (controller.current === next) {
        controller.current = undefined;
        setRefreshJob(undefined);
      }
    }
  };
  featureRefreshRef.current = refresh;
  useEffect(() => {
    setFeatureRefresh(() => featureRefreshRef.current());
    return () => setFeatureRefresh(undefined);
  }, [setFeatureRefresh]);
  useEffect(() => {
    if (data.loading || data.refreshing)
      setFeatureLoading({
        id: 'orders',
        title: 'Loading orders',
        message: 'Updating local sales and refunds',
      });
    else setFeatureLoading(undefined);
    return () => setFeatureLoading(undefined);
  }, [data.loading, data.refreshing, setFeatureLoading]);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    setCenterItem({
      label: data.refreshing ? 'Refreshing' : 'Refresh',
      icon: RotateCcw,
      onPress: () => void featureRefreshRef.current(),
    });
    return () => setCenterItem(null);
  }, [data.refreshing, setCenterItem]);
  const viewBill = (order: SalesOrder) => {
    const active = auth.session?.organization?.activeSession;
    setBill({
      id: order.billId,
      businessName: auth.session?.organization?.name || auth.session?.tenant.name || 'IndyzAI',
      branchName: active?.branchName || 'Branch',
      counterName: active?.counterName || 'Counter',
      createdAt: order.saleDate,
      items: order.items.map((item) => ({
        id: item.productId,
        name: item.name,
        category: '',
        price: item.unitPrice,
        stock: 0,
        emoji: '',
        color: '',
        quantity: item.quantity,
        discount: item.discountAmount,
      })),
      totals: {
        subtotal: order.subtotal,
        discount: order.discountAmount,
        tax: order.taxAmount,
        total: order.totalAmount,
        rounding: 0,
      },
      payment: {
        method: (order.paymentType?.code || order.paymentMethod || 'CASH') as never,
      },
      customer: order.customerName ? { id: '', name: order.customerName, type: 'CUSTOMER' } : undefined,
      currencyCode,
    });
  };
  const query = search.trim().toLowerCase();
  const orders = useMemo(
    () =>
      data.orders.filter(
        (item) =>
          !query ||
          item.billId.toLowerCase().includes(query) ||
          item.customerName?.toLowerCase().includes(query),
      ),
    [data.orders, query],
  );
  const refunds = useMemo(
    () =>
      data.refunds.filter(
        (item) =>
          !query ||
          item.creditNoteNumber.toLowerCase().includes(query) ||
          item.originalInvoiceNumber?.toLowerCase().includes(query),
      ),
    [data.refunds, query],
  );
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={() => void refresh()}
            tintColor={c.primary}
            colors={[c.primary]}
            title={data.refreshing ? 'Refreshing orders…' : 'Pull down to refresh'}
            titleColor={c.textSecondary}
          />
        }
        contentContainerStyle={[s.content, { paddingBottom: bottomClearance }]}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={[s.title, { color: c.text }]}>Orders</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>Sales history, receipts and refunds</Text>
        </View>
        {data.error ? (
          <DataStateMessage
            kind="error"
            title="Orders could not be updated"
            message={data.error}
            onRetry={() => void refresh()}
          />
        ) : null}
        <View style={[s.search, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
          <Search size={17} color={c.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search invoice or customer"
            placeholderTextColor={c.textSecondary}
            style={[s.searchInput, { color: c.text }]}
          />
        </View>
        <View style={s.tabs}>
          <Tab
            label={`Sales (${data.orders.length})`}
            active={tab === 'orders'}
            onPress={() => setTab('orders')}
          />
          {managerAccess ? (
            <Tab
              label={`Refunds (${data.refunds.length})`}
              active={tab === 'refunds'}
              onPress={() => setTab('refunds')}
            />
          ) : null}
        </View>
        {tab === 'orders'
          ? orders.map((order) => (
              <AppPressable
                key={order.id}
                accessibilityLabel={`View bill ${order.billId}`}
                onPress={() => viewBill(order)}
                style={[s.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}
              >
                <View style={s.cardTop}>
                  <View style={[s.cardIcon, { backgroundColor: c.primarySoft }]}>
                    <ReceiptText size={18} color={c.primary} />
                  </View>
                  <View style={s.cardCopy}>
                    <Text style={[s.cardTitle, { color: c.text }]}>{order.billId}</Text>
                    <Text style={[s.meta, { color: c.textSecondary }]}>
                      {order.customerName || 'Walk-in'} · {new Date(order.saleDate).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: c.primary }]}>
                    {formatCurrency(order.totalAmount, currencyCode)}
                  </Text>
                </View>
                <Text numberOfLines={2} style={[s.items, { color: c.textSecondary }]}>
                  {order.items.map((item) => `${item.name} ×${item.quantity}`).join(' · ')}
                </Text>
                <View style={s.cardBottom}>
                  <Status value={order.status} />
                  {managerAccess ? (
                    <AppPressable
                      disabled={
                        !order.items.some(
                          (item) => refundableQuantity(order, item.productId, data.refunds) > 0,
                        )
                      }
                      onPress={() => setRefundOrder(order)}
                      style={[
                        s.refund,
                        { backgroundColor: c.errorSoft },
                        !order.items.some(
                          (item) => refundableQuantity(order, item.productId, data.refunds) > 0,
                        ) && s.disabled,
                      ]}
                    >
                      <RotateCcw size={14} color={c.error} />
                      <Text style={[s.refundText, { color: c.error }]}>Refund</Text>
                    </AppPressable>
                  ) : null}
                </View>
              </AppPressable>
            ))
          : refunds.map((refund) => (
              <View
                key={refund.id}
                style={[s.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}
              >
                <View style={s.cardTop}>
                  <View style={[s.cardIcon, { backgroundColor: c.errorSoft }]}>
                    <RotateCcw size={18} color={c.error} />
                  </View>
                  <View style={s.cardCopy}>
                    <Text style={[s.cardTitle, { color: c.text }]}>{refund.creditNoteNumber}</Text>
                    <Text style={[s.meta, { color: c.textSecondary }]}>
                      Against {refund.originalInvoiceNumber || refund.originalSaleId} ·{' '}
                      {new Date(refund.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={[s.amount, { color: c.error }]}>
                    -{formatCurrency(refund.total, currencyCode)}
                  </Text>
                </View>
                <View style={s.cardBottom}>
                  <Status value={refund.status} />
                  {refund.syncError ? (
                    <Text numberOfLines={1} style={[s.syncError, { color: c.error }]}>
                      {refund.syncError}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
        {(tab === 'orders' ? !orders.length : !refunds.length) && (
          <DataStateMessage
            kind="empty"
            title={`No ${tab} found`}
            message={
              search ? 'Try changing the search text.' : `No ${tab} have been saved for this workspace yet.`
            }
          />
        )}
      </ScrollView>
      {managerAccess ? (
        <RefundDialog
          order={refundOrder}
          refunds={data.refunds}
          currencyCode={currencyCode}
          busy={data.refunding}
          onClose={() => setRefundOrder(undefined)}
          onConfirm={(selections, reason, method) => {
            logger.info('Creating refund for order', {
              billId: refundOrder?.billId,
              reason,
              method,
              itemCount: selections.length,
            });
            void data
              .createRefund({ order: refundOrder!, selections, reason, method })
              .then(() => {
                logger.info('Refund saved successfully', {
                  billId: refundOrder?.billId,
                });
                setRefundOrder(undefined);
                setTab('refunds');
                showSnackbar('Refund saved', 'The credit note is stored locally and will sync on refresh.');
              })
              .catch((error) => {
                logger.error('Refund creation failed', {
                  billId: refundOrder?.billId,
                  error: error instanceof Error ? error.message : String(error),
                });
                showSnackbar('Could not save refund', error instanceof Error ? error.message : 'Try again.');
              });
          }}
        />
      ) : null}
      <ReceiptDialog receipt={bill} onClose={() => setBill(undefined)} />
    </View>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { themeColors: c } = useAppTheme();
  return (
    <AppPressable onPress={onPress} style={[s.tab, { backgroundColor: active ? c.primary : c.surfaceMuted }]}>
      <Text style={[s.tabText, { color: active ? '#FFFFFF' : c.textSecondary }]}>{label}</Text>
    </AppPressable>
  );
}
function Status({ value }: { value: string }) {
  const { themeColors: c } = useAppTheme();
  const normalized = value.toUpperCase();
  const failed = normalized === 'FAILED';
  const pending = normalized.includes('PENDING');
  const color = failed ? c.error : pending ? '#D97706' : c.success;
  const Icon = failed ? AlertCircle : pending ? Clock3 : CheckCircle2;
  return (
    <View style={s.status}>
      <Icon size={13} color={color} />
      <Text style={[s.statusText, { color }]}>{value.replace(/_/g, ' ')}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 3 },
  error: { fontSize: 11, fontWeight: '700' },
  search: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, fontSize: 13 },
  tabs: { flexDirection: 'row', gap: 7 },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: { fontSize: 11, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 15, padding: 13, gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '900' },
  meta: { fontSize: 9, marginTop: 3 },
  amount: { fontSize: 13, fontWeight: '900' },
  items: { fontSize: 10, lineHeight: 15 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  refund: {
    minHeight: 34,
    borderRadius: 9,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  refundText: { fontSize: 9, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  syncError: { flex: 1, fontSize: 9, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 12, fontWeight: '800' },
});
