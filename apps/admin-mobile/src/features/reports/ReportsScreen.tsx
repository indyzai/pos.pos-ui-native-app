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
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { useBottomNavigationClearance } from '../../shared/hooks/useBottomNavigationClearance';
import { useAppHeader } from '../../shared/providers/AppHeaderProvider';
import { showSnackbar } from '../../shared/providers/SnackbarProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { formatCurrency } from '../../shared/utils/currency';
import { useOrders } from '../orders/useOrders';
import { buildReportMetrics, type ReportPeriod } from './reportMetrics';

const periods: ReportPeriod[] = [7, 30, 90];

export function ReportsScreen() {
    const { themeColors: c } = useAppTheme();
    const { width } = useWindowDimensions();
    const { session } = useAuthSession();
    const data = useOrders();
    const bottomClearance = useBottomNavigationClearance();
    const { setFeatureRefresh, setRefreshJob } = useAppHeader();
    const [period, setPeriod] = useState<ReportPeriod>(30);
    const controller = useRef<AbortController | undefined>(undefined);
    const featureRefreshRef = useRef<() => Promise<void>>(async () => undefined);
    const currency = String(session?.organization?.settings.currency || 'INR');
    const metrics = useMemo(
        () => buildReportMetrics(data.orders, data.refunds, period),
        [data.orders, data.refunds, period],
    );
    const money = (value: number) => formatCurrency(value, currency);
    const refresh = async () => {
        if (controller.current) return;
        const next = new AbortController();
        controller.current = next;
        setRefreshJob({
            id: `reports-${Date.now()}`,
            text: 'Refreshing reports',
            cancel: () => next.abort(),
        });
        try {
            await data.refresh(next.signal);
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
    featureRefreshRef.current = refresh;
    useEffect(() => {
        setFeatureRefresh(() => featureRefreshRef.current());
        return () => setFeatureRefresh(undefined);
    }, [setFeatureRefresh]);
    useEffect(() => () => controller.current?.abort(), []);
    const chart = metrics.daily.slice(period === 90 ? -30 : 0);
    const maxRevenue = Math.max(...chart.map((day) => day.revenue), 1);
    const columns = width >= 1050 ? 4 : width >= 620 ? 2 : 1;

    return (
        <View style={[s.screen, { backgroundColor: c.background }]}>
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={data.refreshing} onRefresh={() => void refresh()} />
                }
                contentContainerStyle={[s.content, { paddingBottom: bottomClearance }]}
            >
                <View style={s.header}>
                    <View>
                        <Text style={[s.title, { color: c.text }]}>Reports & analytics</Text>
                        <Text style={[s.subtitle, { color: c.textSecondary }]}>
                            Sales performance for {session?.tenant.name}
                        </Text>
                    </View>
                    <AppPressable
                        onPress={() => void refresh()}
                        style={[s.refresh, { borderColor: c.outline }]}
                    >
                        <RotateCcw size={16} color={c.primary} />
                        <Text style={[s.refreshText, { color: c.primary }]}>Refresh</Text>
                    </AppPressable>
                </View>
                <View style={s.periods}>
                    {periods.map((value) => (
                        <AppPressable
                            key={value}
                            onPress={() => setPeriod(value)}
                            style={[
                                s.period,
                                { borderColor: c.outline },
                                period === value && { backgroundColor: c.primary },
                            ]}
                        >
                            <Text style={{ color: period === value ? '#fff' : c.text, fontWeight: '800' }}>
                                {value} days
                            </Text>
                        </AppPressable>
                    ))}
                </View>
                {!!data.error && <Text style={[s.error, { color: c.error }]}>{data.error}</Text>}
                <View style={s.metrics}>
                    <Metric
                        columns={columns}
                        icon={Banknote}
                        label="Net revenue"
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
                <Section title="Revenue trend" c={c}>
                    <View style={s.chart}>
                        {chart.map((day, index) => (
                            <View key={day.date} style={s.barColumn}>
                                <View style={[s.barTrack, { backgroundColor: c.surfaceMuted }]}>
                                    <View
                                        style={[
                                            s.bar,
                                            {
                                                backgroundColor: c.primary,
                                                height: `${Math.max(4, (day.revenue / maxRevenue) * 100)}%`,
                                            },
                                        ]}
                                    />
                                </View>
                                {(chart.length <= 14 || index % 5 === 0) && (
                                    <Text style={[s.axis, { color: c.textSecondary }]}>
                                        {day.date.slice(5)}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                </Section>
                <View style={[s.split, width < 760 && s.splitStack]}>
                    <Section title="Payment mix" c={c} style={s.splitItem}>
                        {metrics.payments.length ? (
                            metrics.payments.map((item) => (
                                <RankRow
                                    key={item.name}
                                    label={item.name}
                                    detail={money(item.amount)}
                                    c={c}
                                />
                            ))
                        ) : (
                            <Empty c={c} />
                        )}
                    </Section>
                    <Section title="Top products" c={c} style={s.splitItem}>
                        {metrics.products.length ? (
                            metrics.products.map((item) => (
                                <RankRow
                                    key={item.name}
                                    label={item.name}
                                    detail={`${item.quantity} sold · ${money(item.revenue)}`}
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
                        <RankRow
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
            <Icon size={20} color={c.primary} />
            <Text style={[s.metricLabel, { color: c.textSecondary }]}>{label}</Text>
            <Text style={[s.metricValue, { color: c.text }]}>{value}</Text>
        </View>
    );
}
function Section({ title, c, children, style }: any) {
    return (
        <View style={[s.section, style, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
            <Text style={[s.sectionTitle, { color: c.text }]}>{title}</Text>
            {children}
        </View>
    );
}
function RankRow({ label, detail, c }: any) {
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
    return <Text style={[s.empty, { color: c.textSecondary }]}>No data for this period.</Text>;
}

const s = StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 20, gap: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    title: { fontSize: 26, fontWeight: '900' },
    subtitle: { marginTop: 4, fontSize: 14 },
    refresh: {
        minHeight: 40,
        borderWidth: 1,
        borderRadius: 11,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    refreshText: { fontWeight: '800' },
    periods: { flexDirection: 'row', gap: 8 },
    period: {
        minHeight: 38,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    error: { fontWeight: '700' },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metric: { minWidth: 150, borderWidth: 1, borderRadius: 15, padding: 16, gap: 7 },
    metricLabel: { fontSize: 12, fontWeight: '700' },
    metricValue: { fontSize: 21, fontWeight: '900' },
    section: { borderWidth: 1, borderRadius: 16, padding: 17 },
    sectionTitle: { fontSize: 16, fontWeight: '900', marginBottom: 14 },
    chart: { height: 190, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    barTrack: { width: '80%', flex: 1, borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 5 },
    axis: { height: 22, paddingTop: 5, fontSize: 8 },
    split: { flexDirection: 'row', gap: 16 },
    splitStack: { flexDirection: 'column' },
    splitItem: { flex: 1 },
    row: {
        minHeight: 45,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    rowLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
    rowDetail: { maxWidth: '58%', fontSize: 12, textAlign: 'right' },
    empty: { paddingVertical: 22, textAlign: 'center', fontStyle: 'italic' },
});
