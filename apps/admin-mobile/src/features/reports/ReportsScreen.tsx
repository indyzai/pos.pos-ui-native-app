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
import { useBottomNavigation } from '../../shared/providers/BottomNavigationProvider';
import { useAppHeader } from '../../shared/providers/AppHeaderProvider';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
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
    const { setCenterItem } = useBottomNavigation();
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
    useEffect(() => {
        setCenterItem({
            label: data.refreshing ? 'Refreshing' : 'Refresh',
            icon: RotateCcw,
            onPress: () => void featureRefreshRef.current(),
        });
        return () => setCenterItem(null);
    }, [data.refreshing, setCenterItem]);
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
                    <View style={s.headingGroup}>
                        <View style={[s.headingIcon, { backgroundColor: c.primarySoft }]}>
                            <ChartNoAxesColumnIncreasing size={21} color={c.primary} strokeWidth={2.4} />
                        </View>
                        <View style={s.headingCopy}>
                            <Text style={[s.eyebrow, { color: c.primary }]}>BUSINESS INTELLIGENCE</Text>
                            <Text style={[s.title, { color: c.text }]}>Reports & analytics</Text>
                            <Text style={[s.subtitle, { color: c.textSecondary }]}>
                                Sales performance for {session?.tenant.name}
                            </Text>
                        </View>
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
                                {value}D
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
                <Section
                    title="Revenue trend"
                    note={period === 90 ? 'LATEST 30 DAYS' : `DAILY · ${period} DAYS`}
                    c={c}
                >
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
                    <Section title="Payment mix" note="BY REVENUE" c={c} style={s.splitItem}>
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
                    <Section title="Top products" note="BY REVENUE" c={c} style={s.splitItem}>
                        {metrics.products.length ? (
                            metrics.products.map((item, index) => (
                                <RankRow
                                    key={item.name}
                                    rank={index + 1}
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
                <Section title="Recent sales" note={`${metrics.orderCount} ORDERS`} c={c}>
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
            <View style={[s.metricAccent, { backgroundColor: c.primary }]} />
            <View style={[s.metricIcon, { backgroundColor: c.primarySoft }]}>
                <Icon size={18} color={c.primary} strokeWidth={2.4} />
            </View>
            <Text style={[s.metricValue, { color: c.text }]}>{value}</Text>
            <Text style={[s.metricLabel, { color: c.textSecondary }]}>{label}</Text>
        </View>
    );
}
function Section({ title, note, c, children, style }: any) {
    return (
        <View style={[s.section, style, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
            <View style={s.sectionHead}>
                <Text style={[s.sectionTitle, { color: c.text }]}>{title}</Text>
                {!!note && <Text style={[s.sectionNote, { color: c.textSecondary }]}>{note}</Text>}
            </View>
            {children}
        </View>
    );
}
function RankRow({ label, detail, rank, c }: any) {
    return (
        <View style={[s.row, { borderBottomColor: c.outlineMuted }]}>
            {!!rank && (
                <View style={[s.rank, { backgroundColor: c.surfaceMuted }]}>
                    <Text style={[s.rankText, { color: c.primary }]}>{rank}</Text>
                </View>
            )}
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
    content: { width: '100%', maxWidth: 1280, alignSelf: 'center', padding: 24, gap: 18 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    headingGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 13 },
    headingIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    headingCopy: { flex: 1 },
    eyebrow: { fontSize: 9, letterSpacing: 1.4, fontWeight: '900', marginBottom: 2 },
    title: { fontSize: 25, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 },
    subtitle: { marginTop: 3, fontSize: 13 },
    periods: { alignSelf: 'flex-start', flexDirection: 'row', gap: 3, borderRadius: 10, padding: 3 },
    period: {
        minHeight: 38,
        borderRadius: 7,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    error: { fontWeight: '700' },
    metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metric: { minWidth: 150, borderWidth: 1, borderRadius: 11, padding: 16, gap: 5, overflow: 'hidden' },
    metricAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
    metricIcon: {
        width: 32,
        height: 32,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
    },
    metricLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.55, textTransform: 'uppercase' },
    metricValue: { fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.4 },
    section: { borderWidth: 1, borderRadius: 11, padding: 18 },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 15,
    },
    sectionTitle: { fontSize: 15, fontWeight: '900' },
    sectionNote: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
    chart: { height: 190, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
    barColumn: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
    barTrack: { width: '72%', flex: 1, borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 3 },
    axis: { height: 22, paddingTop: 5, fontSize: 8 },
    split: { flexDirection: 'row', gap: 16 },
    splitStack: { flexDirection: 'column' },
    splitItem: { flex: 1 },
    row: {
        minHeight: 48,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    rank: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    rankText: { fontSize: 11, fontWeight: '900' },
    rowLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
    rowDetail: { maxWidth: '58%', fontSize: 12, textAlign: 'right' },
    empty: { paddingVertical: 22, textAlign: 'center', fontSize: 12 },
});
