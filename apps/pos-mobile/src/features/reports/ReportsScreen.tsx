import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  Banknote,
  ChartNoAxesColumnIncreasing,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react-native';
import { useAuthSession } from '@indyzai/pos-auth/session';
import {
  AppPressable,
  DataStateMessage,
  SectionMenu,
  formatCurrency,
  useAppHeader,
  useAppTheme,
  useBottomNavigation,
  useBottomNavigationClearance,
} from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { createLogger } from '@indyzai/pos-utils';
import { canPerformManagerActions } from '../../config/appAccess';
import { useOrders } from '../orders/useOrders';
import { buildReportMetrics, scopeReportOrders, type ReportPeriod } from './reportMetrics';

const logger = createLogger('PosReports');
const periods: ReportPeriod[] = [1, 7, 30];

export function ReportsScreen() {
  const { themeColors: c } = useAppTheme();
  const { width } = useWindowDimensions();
  const { session } = useAuthSession();
  const data = useOrders();
  const bottomClearance = useBottomNavigationClearance();
  const { setCenterItem } = useBottomNavigation();
  const { setFeatureLoading, setFeatureRefresh, setRefreshJob } = useAppHeader();
  const [period, setPeriod] = useState<ReportPeriod>(1);
  const controller = useRef<AbortController | undefined>(undefined);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const manager = canPerformManagerActions(session?.tenant.role, session?.user.role);
  const activeSession = session?.organization?.activeSession;
  const activeSessionId = activeSession?.id ? String(activeSession.id) : undefined;
  const scopedOrders = useMemo(
    () => scopeReportOrders(data.orders, manager, activeSessionId),
    [activeSessionId, data.orders, manager],
  );
  const metrics = useMemo(
    () =>
      buildReportMetrics(scopedOrders, data.refunds, period, new Date(), {
        timeZone:
          typeof session?.organization?.settings.timezone === 'string'
            ? session.organization.settings.timezone
            : undefined,
      }),
    [data.refunds, period, scopedOrders, session?.organization?.settings.timezone],
  );
  const currency = String(session?.organization?.settings.currency || 'INR');
  const money = (value: number) => formatCurrency(value, currency);
  const refresh = async () => {
    if (controller.current || !data.ready) return;
    const next = new AbortController();
    controller.current = next;
    setRefreshJob({
      id: `pos-reports-${Date.now()}`,
      text: 'Refreshing reports',
      cancel: () => next.abort(),
    });
    try {
      await data.refresh(next.signal);
      logger.info('Reports refreshed', { role: manager ? 'manager' : 'cashier', activeSessionId });
    } catch (error) {
      if (!next.signal.aborted)
        showSnackbar('Reports refresh failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      if (controller.current === next) {
        controller.current = undefined;
        setRefreshJob(undefined);
      }
    }
  };
  refreshRef.current = refresh;
  useEffect(() => {
    setFeatureRefresh(() => refreshRef.current());
    return () => setFeatureRefresh(undefined);
  }, [setFeatureRefresh]);
  useEffect(() => {
    if (data.loading || data.refreshing)
      setFeatureLoading({
        id: 'reports',
        title: 'Loading reports',
        message: 'Calculating from local sales data',
      });
    else setFeatureLoading(undefined);
    return () => setFeatureLoading(undefined);
  }, [data.loading, data.refreshing, setFeatureLoading]);
  useEffect(() => {
    setCenterItem({
      label: data.refreshing ? 'Refreshing' : 'Refresh',
      icon: RotateCcw,
      onPress: () => void refreshRef.current(),
    });
    return () => setCenterItem(null);
  }, [data.refreshing, setCenterItem]);
  useEffect(() => () => controller.current?.abort(), []);
  const columns = width >= 900 ? 4 : width >= 540 ? 2 : 1;

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <SectionMenu
        value={String(period)}
        groups={[
          {
            label: 'Report range',
            items: periods.map((value) => ({
              id: String(value),
              label: value === 1 ? 'Today' : `Last ${value} days`,
            })),
          },
        ]}
        onChange={(value) => setPeriod(Number(value) as ReportPeriod)}
        accessibilityLabel="reports"
      />
      <ScrollView
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={() => void refresh()} />}
        contentContainerStyle={[s.content, { paddingBottom: bottomClearance }]}
      >
        <View style={s.heading}>
          <View style={[s.headingIcon, { backgroundColor: c.primarySoft }]}>
            <ChartNoAxesColumnIncreasing size={21} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: c.primary }]}>
              {manager ? 'STORE OVERVIEW' : 'MY COUNTER SESSION'}
            </Text>
            <Text style={[s.title, { color: c.text }]}>Sales report</Text>
            <Text style={[s.subtitle, { color: c.textSecondary }]}>
              {manager
                ? `Performance for ${session?.tenant.name || 'your store'}`
                : activeSession
                  ? `${activeSession.counterName || 'Counter'} · Session ${activeSession.sessionNumber || activeSession.id}`
                  : 'Open a counter session to view your report'}
            </Text>
          </View>
        </View>
        <View style={[s.periods, { backgroundColor: c.surfaceMuted }]}>
          {periods.map((value) => (
            <AppPressable
              key={value}
              onPress={() => setPeriod(value)}
              style={[s.period, period === value && { backgroundColor: c.surface }]}
            >
              <Text
                style={{
                  color: period === value ? c.primary : c.textSecondary,
                  fontWeight: '900',
                }}
              >
                {value === 1 ? 'TODAY' : `${value}D`}
              </Text>
            </AppPressable>
          ))}
        </View>
        {!!data.error && (
          <DataStateMessage
            kind="error"
            title="Reports could not be updated"
            message={data.error}
            onRetry={() => void refresh()}
          />
        )}
        {!data.error && !data.loading && scopedOrders.length === 0 ? (
          <DataStateMessage
            kind="empty"
            title="No report data"
            message="There are no sales for the selected period and counter scope."
          />
        ) : null}
        <View style={s.metrics}>
          <Metric
            columns={columns}
            icon={Banknote}
            label="Net sales"
            value={money(metrics.netRevenue)}
            c={c}
          />
          <Metric
            columns={columns}
            icon={ShoppingBag}
            label="Orders"
            value={String(metrics.orderCount)}
            c={c}
          />
          <Metric
            columns={columns}
            icon={ReceiptText}
            label="Average order"
            value={money(metrics.averageOrder)}
            c={c}
          />
          <Metric
            columns={columns}
            icon={ChartNoAxesColumnIncreasing}
            label="Tax collected"
            value={money(metrics.taxTotal)}
            c={c}
          />
        </View>
        <View style={[s.split, width < 720 && s.stack]}>
          <Section title="Payment mix" c={c}>
            {metrics.payments.length ? (
              metrics.payments.map((item) => (
                <Row key={item.name} label={item.name} detail={money(item.amount)} c={c} />
              ))
            ) : (
              <Empty c={c} />
            )}
          </Section>
          <Section title="Top products" c={c}>
            {metrics.products.length ? (
              metrics.products.map((item, index) => (
                <Row
                  key={`${item.name}-${index}`}
                  label={`${index + 1}. ${item.name}`}
                  detail={`${item.quantity} · ${money(item.revenue)}`}
                  c={c}
                />
              ))
            ) : (
              <Empty c={c} />
            )}
          </Section>
        </View>
        <Section title="Recent sales" c={c}>
          {metrics.sales.slice(0, 8).map((order) => (
            <Row
              key={order.id}
              label={order.billId}
              detail={`${order.customerName || 'Walk-in'} · ${money(order.totalAmount)}`}
              c={c}
            />
          ))}
          {!metrics.sales.length && <Empty c={c} />}
        </Section>
      </ScrollView>
    </View>
  );
}

function Metric({ columns, icon: Icon, label, value, c }: any) {
  return (
    <View
      style={[
        s.metric,
        { width: `${100 / columns - 1}%`, backgroundColor: c.surface, borderColor: c.outlineMuted },
      ]}
    >
      <View style={[s.accent, { backgroundColor: c.primary }]} />
      <Icon size={19} color={c.primary} />
      <Text style={[s.metricValue, { color: c.text }]}>{value}</Text>
      <Text style={[s.metricLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}
function Section({ title, c, children }: any) {
  return (
    <View style={[s.section, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
      <Text style={[s.sectionTitle, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ label, detail, c }: any) {
  return (
    <View style={[s.row, { borderBottomColor: c.outlineMuted }]}>
      <Text numberOfLines={1} style={[s.rowLabel, { color: c.text }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[s.rowDetail, { color: c.textSecondary }]}>
        {detail}
      </Text>
    </View>
  );
}
function Empty({ c }: any) {
  return <Text style={[s.empty, { color: c.textSecondary }]}>No sales for this period.</Text>;
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 20, gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, letterSpacing: 1.3, fontWeight: '900' },
  title: { fontSize: 25, lineHeight: 29, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 13 },
  periods: { alignSelf: 'flex-start', flexDirection: 'row', borderRadius: 10, padding: 3, gap: 3 },
  period: {
    minHeight: 38,
    borderRadius: 7,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { minWidth: 150, borderWidth: 1, borderRadius: 11, padding: 16, gap: 6, overflow: 'hidden' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  metricValue: { fontSize: 22, lineHeight: 27, fontWeight: '900' },
  metricLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  split: { flexDirection: 'row', gap: 16 },
  stack: { flexDirection: 'column' },
  section: { flex: 1, borderWidth: 1, borderRadius: 11, padding: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '900', marginBottom: 10 },
  row: {
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
  rowDetail: { maxWidth: '58%', fontSize: 12, textAlign: 'right' },
  empty: { paddingVertical: 22, textAlign: 'center', fontSize: 12 },
});
