import { useEffect, useMemo, useRef, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    AlertCircle,
    AlertTriangle,
    Boxes,
    CheckCircle2,
    Clock3,
    IndianRupee,
    Package,
    PackageX,
    Plus,
    Search,
    ScanLine,
    X,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { AppPressable, DataStateMessage } from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { InventoryCard } from './components/InventoryCard';
import { useInventory } from './hooks/useInventory';
import type { InventoryFilter, InventoryProduct } from './types';
import { useAppHeader } from '@indyzai/pos-ui-native';
import { useBottomNavigation } from '@indyzai/pos-ui-native';
import { AddInventoryItemModal } from './components/AddInventoryItemModal';
import { useBottomNavigationClearance } from '@indyzai/pos-ui-native';
import { createLogger } from '@indyzai/pos-utils';
import { BarcodeScannerModal } from '../billing/components/BarcodeScannerModal';
import { type AppSurface } from '@indyzai/pos-permissions';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { usePermissions } from '@indyzai/pos-auth/permissions';

const logger = createLogger('Inventory');

export function InventoryScreen({ surface = 'pos' }: { surface?: AppSurface }) {
    const { themeColors: c } = useAppTheme();
    const { width } = useWindowDimensions();
    const bottomClearance = useBottomNavigationClearance();
    const router = useRouter();
    const auth = useAuthSession();
    const { can } = usePermissions(surface);
    const canEditPrice = can('pricing.edit');
    const canEditInventory = can('inventory.edit');
    const data = useInventory();
    const { setFeatureLoading, setFeatureRefresh, setRefreshJob } = useAppHeader();
    const { setCenterItem } = useBottomNavigation();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [filter, setFilter] = useState<InventoryFilter>('all');
    const [addOpen, setAddOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
    const [scannerOpen, setScannerOpen] = useState(false);
    const refreshRef = useRef(data.refresh);
    const refreshController = useRef<AbortController | undefined>(undefined);
    refreshRef.current = data.refresh;
    useEffect(() => {
        setFeatureRefresh(() => refreshRef.current());
        return () => setFeatureRefresh(undefined);
    }, [setFeatureRefresh]);
    useEffect(() => {
        if (data.loading || data.refreshing)
            setFeatureLoading({
                id: 'inventory',
                title: 'Loading inventory',
                message: 'Updating local product data',
            });
        else setFeatureLoading(undefined);
        return () => setFeatureLoading(undefined);
    }, [data.loading, data.refreshing, setFeatureLoading]);
    useEffect(
        () => () => {
            refreshController.current?.abort();
            setRefreshJob(undefined);
        },
        [setRefreshJob],
    );
    useEffect(() => {
        setCenterItem(
            canEditInventory ? { label: 'Add item', icon: Plus, onPress: () => setAddOpen(true) } : null,
        );
        return () => setCenterItem(null);
    }, [setCenterItem, canEditInventory]);
    const categories = useMemo(
        () => ['All', ...new Set(data.products.map((item) => item.category))],
        [data.products],
    );
    const products = useMemo(
        () =>
            data.products.filter((product) => {
                const query = search.trim().toLowerCase();
                const matchesSearch =
                    !query ||
                    product.name.toLowerCase().includes(query) ||
                    product.barcode?.toLowerCase().includes(query);
                const matchesCategory = category === 'All' || product.category === category;
                const matchesStatus =
                    filter === 'all' ||
                    (filter === 'low' ? product.stock > 0 && product.stock < 30 : product.stock <= 0);
                return matchesSearch && matchesCategory && matchesStatus;
            }),
        [category, data.products, filter, search],
    );
    const summary = useMemo(
        () => ({
            total: data.products.length,
            low: data.products.filter((item) => item.stock > 0 && item.stock < 30).length,
            out: data.products.filter((item) => item.stock <= 0).length,
            value: data.products.reduce((sum, item) => sum + item.price * item.stock, 0),
        }),
        [data.products],
    );
    const refresh = async () => {
        if (refreshController.current) return;
        const controller = new AbortController();
        const jobId = `inventory-${Date.now().toString(36)}`;
        refreshController.current = controller;
        setRefreshJob({
            id: jobId,
            text: 'Refreshing inventory',
            cancel: () => controller.abort(),
        });
        logger.info('Refreshing inventory');
        try {
            await data.refresh(controller.signal);
            logger.info('Inventory refreshed successfully');
        } catch (error) {
            if (!controller.signal.aborted) {
                logger.error('Inventory refresh failed', {
                    error: error instanceof Error ? error.message : String(error),
                });
                showSnackbar(
                    'Inventory refresh failed',
                    error instanceof Error ? error.message : 'Try again.',
                );
            }
        } finally {
            if (refreshController.current === controller) {
                refreshController.current = undefined;
                setRefreshJob(undefined);
            }
        }
    };
    return (
        <View style={[styles.screen, { backgroundColor: c.background }]}>
            <ScrollView
                automaticallyAdjustKeyboardInsets
                keyboardDismissMode="interactive"
                refreshControl={
                    <RefreshControl
                        refreshing={data.refreshing}
                        onRefresh={() => void refresh()}
                        tintColor={c.primary}
                        colors={[c.primary]}
                        title={data.refreshing ? 'Refreshing inventory…' : 'Pull down to refresh'}
                        titleColor={c.textSecondary}
                    />
                }
                contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.heading}>
                    <View style={styles.headingCopy}>
                        <Text style={[styles.title, { color: c.text }]}>Inventory</Text>
                        <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                            Manage products and reconcile stock levels
                        </Text>
                    </View>
                    <AppPressable
                        onPress={() => router.push('/inventory-reconciliation')}
                        style={[styles.reconcileButton, { backgroundColor: c.primary }]}
                    >
                        <Boxes size={18} color="#fff" />
                        <Text style={styles.reconcileButtonText}>Reconcile stock</Text>
                    </AppPressable>
                </View>
                {data.error ? (
                    <DataStateMessage
                        kind="error"
                        title="Inventory could not be updated"
                        message={data.error}
                        onRetry={() => void refresh()}
                    />
                ) : null}
                {data.jobs[0] ? <SyncJobStatus job={data.jobs[0]} /> : null}
                <View style={styles.stats}>
                    <Stat icon={Package} label="Products" value={String(summary.total)} color={c.primary} />
                    <Stat
                        icon={AlertTriangle}
                        label="Low stock"
                        value={String(summary.low)}
                        color="#D97706"
                    />
                    <Stat icon={PackageX} label="Out of stock" value={String(summary.out)} color={c.error} />
                    <Stat
                        icon={IndianRupee}
                        label="Stock value"
                        value={`₹${formatValue(summary.value)}`}
                        color="#16A34A"
                    />
                </View>
                <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
                    <View style={styles.searchRow}>
                        <View
                            style={[styles.search, { backgroundColor: c.background, borderColor: c.outline }]}
                        >
                            <Search size={18} color={c.textSecondary} />
                            <TextInput
                                value={search}
                                onChangeText={setSearch}
                                placeholder="Search name or barcode"
                                placeholderTextColor={c.textSecondary}
                                style={[styles.searchInput, { color: c.text }]}
                            />
                            {search ? (
                                <AppPressable onPress={() => setSearch('')}>
                                    <X size={17} color={c.textSecondary} />
                                </AppPressable>
                            ) : null}
                        </View>
                        <AppPressable
                            accessibilityLabel="Scan inventory barcode"
                            onPress={() => setScannerOpen(true)}
                            style={[styles.scanButton, { backgroundColor: c.primary }]}
                        >
                            <ScanLine size={20} color="#fff" />
                            {width >= 620 ? <Text style={styles.scanText}>Scan</Text> : null}
                        </AppPressable>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chips}
                    >
                        {categories.map((item) => (
                            <Chip
                                key={item}
                                label={item}
                                active={category === item}
                                onPress={() => setCategory(item)}
                            />
                        ))}
                    </ScrollView>
                    <View style={styles.filters}>
                        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
                        <Chip label="Low stock" active={filter === 'low'} onPress={() => setFilter('low')} />
                        <Chip
                            label="Out of stock"
                            active={filter === 'out'}
                            onPress={() => setFilter('out')}
                        />
                    </View>
                </View>
                {products.length ? (
                    <View style={styles.grid}>
                        {products.map((product) => (
                            <View
                                key={product.id}
                                style={{ width: width >= 1050 ? '31.8%' : width >= 620 ? '48.5%' : '100%' }}
                            >
                                <InventoryCard
                                    product={product}
                                    onPress={() => {
                                        if (canEditInventory) setEditingProduct(product);
                                    }}
                                />
                            </View>
                        ))}
                    </View>
                ) : (
                    <DataStateMessage
                        kind="empty"
                        title="No inventory found"
                        message={
                            search || category !== 'All' || filter !== 'all'
                                ? 'Try changing the search or filters.'
                                : 'Add your first product or refresh the catalog.'
                        }
                    />
                )}
            </ScrollView>
            <BarcodeScannerModal
                visible={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScan={(value) => {
                    setSearch(value);
                    setScannerOpen(false);
                    const match = data.products.find((product) => product.barcode === value);
                    if (match && canEditInventory) setEditingProduct(match);
                    else if (!match)
                        showSnackbar('Barcode not found', 'No local inventory item matches this barcode.');
                }}
            />
            <AddInventoryItemModal
                visible={canEditInventory && (addOpen || !!editingProduct)}
                product={editingProduct}
                allowPriceEdit={canEditPrice}
                busy={data.creating}
                onClose={() => {
                    setAddOpen(false);
                    setEditingProduct(null);
                }}
                onSave={async (input) => {
                    if (!canEditInventory) return;
                    if (editingProduct) {
                        try {
                            await data.update({ ...input, productId: editingProduct.id });
                            setEditingProduct(null);
                            showSnackbar('Item updated', `${input.name} was updated successfully.`);
                        } catch (error) {
                            showSnackbar(
                                'Could not update item',
                                error instanceof Error ? error.message : 'Try again.',
                            );
                        }
                        return;
                    }
                    logger.info('Adding inventory item', {
                        name: input.name,
                        category: input.category,
                        price: input.price,
                        stock: input.stock,
                    });
                    try {
                        const job = await data.create(input);
                        logger.info('Inventory item added successfully', { jobId: job.id, name: input.name });
                        setAddOpen(false);
                        showSnackbar(
                            'Item added',
                            `${input.name} was added. Queue ${shortId(job.id)} completed.`,
                        );
                    } catch (error) {
                        logger.error('Failed to add inventory item', {
                            name: input.name,
                            error: error instanceof Error ? error.message : String(error),
                        });
                        showSnackbar(
                            'Could not add item',
                            error instanceof Error ? error.message : 'Try again.',
                        );
                    }
                }}
            />
        </View>
    );
}

function shortId(id: string) {
    return id.slice(0, 8).toUpperCase();
}

function SyncJobStatus({ job }: { job: ReturnType<typeof useInventory>['jobs'][number] }) {
    const { themeColors: c } = useAppTheme();
    const failed = job.status === 'FAILED';
    const complete = job.status === 'COMPLETED';
    const color = failed ? c.error : complete ? '#16A34A' : '#D97706';
    const Icon = failed ? AlertCircle : complete ? CheckCircle2 : Clock3;
    const operation =
        job.operation === 'CREATE_PRODUCT'
            ? 'Add item'
            : job.operation === 'UPDATE_PRODUCT'
              ? 'Edit item'
              : job.operation === 'SAVE_STOCK_DRAFT'
                ? 'Save reconciliation draft'
                : 'Update stock';
    return (
        <View style={[styles.job, { backgroundColor: `${color}12`, borderColor: `${color}45` }]}>
            <Icon size={18} color={color} />
            <View style={styles.jobCopy}>
                <Text style={[styles.jobTitle, { color }]}>
                    {operation} · {job.status.toLowerCase()}
                </Text>
                <Text style={[styles.jobId, { color: c.textSecondary }]}>Queue ID {job.id}</Text>
                {job.errorMessage ? (
                    <Text style={[styles.jobError, { color: c.error }]}>{job.errorMessage}</Text>
                ) : null}
            </View>
        </View>
    );
}

function Stat({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: typeof Package;
    label: string;
    value: string;
    color: string;
}) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[styles.stat, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
            <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
                <Icon size={19} color={color} />
            </View>
            <View>
                <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
            </View>
        </View>
    );
}
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    const { themeColors: c } = useAppTheme();
    return (
        <AppPressable
            onPress={onPress}
            style={[styles.chip, { backgroundColor: active ? c.primary : c.surfaceMuted }]}
        >
            <Text style={[styles.chipText, { color: active ? '#fff' : c.textSecondary }]}>{label}</Text>
        </AppPressable>
    );
}
function formatValue(value: number) {
    return value >= 100000
        ? `${(value / 100000).toFixed(1)}L`
        : value >= 1000
          ? `${(value / 1000).toFixed(1)}K`
          : value.toFixed(0);
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    content: { padding: 18 },
    heading: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 18,
    },
    headingCopy: { flex: 1 },
    reconcileButton: {
        minHeight: 42,
        borderRadius: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    reconcileButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    title: { fontSize: 25, fontWeight: '900' },
    subtitle: { marginTop: 4, fontSize: 13 },
    error: { marginBottom: 12, fontSize: 12, fontWeight: '700' },
    job: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 11,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 9,
    },
    jobCopy: { flex: 1 },
    jobTitle: { fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
    jobId: { marginTop: 2, fontSize: 10, fontWeight: '700' },
    jobError: { marginTop: 4, fontSize: 11 },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
    stat: {
        minWidth: 145,
        flex: 1,
        borderWidth: 1,
        borderRadius: 16,
        padding: 13,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontSize: 17, fontWeight: '900' },
    statLabel: { marginTop: 2, fontSize: 10, fontWeight: '700' },
    toolbar: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 11, marginBottom: 14 },
    search: {
        flex: 1,
        height: 46,
        borderWidth: 1,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        gap: 9,
    },
    searchInput: { flex: 1, fontSize: 14 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    scanButton: {
        minWidth: 46,
        height: 46,
        borderRadius: 14,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    scanText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    chips: { gap: 8 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        minHeight: 34,
        paddingHorizontal: 13,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipText: { fontSize: 11, fontWeight: '800' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    empty: { alignItems: 'center', paddingVertical: 70 },
    emptyTitle: { marginTop: 13, fontSize: 17, fontWeight: '900' },
    emptyText: { marginTop: 5, fontSize: 12 },
});
