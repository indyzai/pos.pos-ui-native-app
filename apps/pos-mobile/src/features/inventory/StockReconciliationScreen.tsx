import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, usePathname } from 'expo-router';
import { Check, ClipboardList, Save, ScanLine, Search, X } from 'lucide-react-native';
import {
  AppPressable,
  useAppTheme,
  useBottomNavigationClearance,
  useBackgroundRefresh,
} from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAuthSession } from '@indyzai/pos-auth/session';
import {
  createLocalFirstTableHook,
  createScopeKey,
  getActiveDatabase,
  type LocalRecord,
  useLocalDatabase,
} from '@indyzai/pos-database';
import { hasEntitlement } from '@indyzai/pos-permissions';
import type { Product } from '@indyzai/feature-billing/types/billing';
import type { StockReconciliationReport } from '@indyzai/feature-inventory/types';
import { inventoryApi } from './inventoryApi';
import { BarcodeScannerModal } from '@indyzai/pos-scanner-native/modal';

const useProducts = createLocalFirstTableHook<Product>({ table: 'products', entityType: 'PRODUCT' });
const useReconciliations = createLocalFirstTableHook<StockReconciliationReport>({
  table: 'stock_counts',
  entityType: 'STOCK_RECONCILIATION',
  query: { includeDeleted: true },
});

export function StockReconciliationScreen() {
  const pathname = usePathname();
  const { themeColors: c } = useAppTheme();
  const auth = useAuthSession();
  const bottomClearance = useBottomNavigationClearance();
  const params = useLocalSearchParams<{ productId?: string }>();
  const products = useProducts();
  const reconciliations = useReconciliations();
  const local = useLocalDatabase();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [sharedWithCashiers, setSharedWithCashiers] = useState(false);
  const canManage = hasEntitlement(
    'manager.actions',
    auth.session?.tenant.role,
    auth.session?.user.role,
    'pos',
  );
  const allowed = hasEntitlement(
    'inventory.reconcile',
    auth.session?.tenant.role,
    auth.session?.user.role,
    'pos',
  );

  useEffect(() => {
    if (!params.productId || counts[params.productId] !== undefined) return;
    const product = products.data.find((record) => record.payload.id === params.productId)?.payload;
    if (product) setCounts((current) => ({ ...current, [product.id]: String(product.stock) }));
  }, [counts, params.productId, products.data]);

  const selected = useMemo(
    () =>
      products.data.flatMap((record) => {
        const value = counts[record.payload.id];
        if (value === undefined || value === '') return [];
        const countedQuantity = Number(value);
        return Number.isFinite(countedQuantity) && countedQuantity >= 0
          ? [{ record, product: record.payload, countedQuantity }]
          : [];
      }),
    [counts, products.data],
  );
  const addedProducts = useMemo(
    () => products.data.map((record) => record.payload).filter((product) => counts[product.id] !== undefined),
    [counts, products.data],
  );
  const hasInvalidCounts = selected.length !== addedProducts.length;
  const visibleDrafts = useMemo(
    () =>
      reconciliations.data.filter(
        ({ payload }) =>
          payload.status === 'DRAFT' &&
          (canManage || payload.ownedByCurrentUser === true || payload.sharedWithCashiers === true),
      ),
    [canManage, reconciliations.data],
  );
  const completedReports = useMemo(
    () => reconciliations.data.filter(({ payload }) => payload.status === 'COMPLETED'),
    [reconciliations.data],
  );
  const suggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return products.data
      .filter(({ payload }) => {
        if (counts[payload.id] !== undefined) return false;
        return (
          payload.name.toLowerCase().includes(query) ||
          payload.barcode?.toLowerCase().includes(query) ||
          payload.sku?.toLowerCase().includes(query)
        );
      })
      .slice(0, 8);
  }, [counts, products.data, search]);
  const addProduct = (product: Product) => {
    setCounts((current) => ({ ...current, [product.id]: String(product.stock) }));
    setSearch('');
  };
  const removeProduct = (productId: string) =>
    setCounts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });

  const refreshDrafts = useCallback(
    async (signal?: AbortSignal) => {
      const db = local.database;
      if (!db || !auth.session) return;
      try {
        const drafts = await inventoryApi.loadReconciliationDrafts(signal);
        if (signal?.aborted || getActiveDatabase() !== db) return;
        const scope = createScopeKey(db.scope);
        const existing = await db
          .collection<LocalRecord<StockReconciliationReport>>('stock_counts')
          .list({ includeDeleted: true });
        const remoteIds = new Set(drafts.map((draft) => String(draft.id)));
        await db.collection<LocalRecord<StockReconciliationReport>>('stock_counts').putMany(
          drafts
            .filter(
              (draft) =>
                !existing.some(
                  (record) =>
                    record.remoteId === String(draft.id) &&
                    ['PENDING', 'RUNNING', 'FAILED', 'CONFLICT'].includes(record.syncStatus),
                ),
            )
            .map((draft) => {
              const current = existing.find((record) => record.remoteId === String(draft.id));
              const lines = draft.items.map((item) => {
                const product = products.data.find(
                  (record) => String(record.payload.id) === String(item.productId),
                )?.payload;
                const previousQuantity = Number(product?.stock ?? item.countedQuantity);
                const countedQuantity = Number(item.countedQuantity);
                const lossQuantity = Math.max(0, previousQuantity - countedQuantity);
                return {
                  productId: String(item.productId),
                  productName: product?.name ?? `Product ${item.productId}`,
                  previousQuantity,
                  countedQuantity,
                  variance: countedQuantity - previousQuantity,
                  lossQuantity,
                  lossValue: lossQuantity * Number(product?.price ?? 0),
                };
              });
              const payload: StockReconciliationReport = {
                id: current?.id ?? `stock-count-server-${draft.id}`,
                lines,
                reference: draft.reference,
                remarks: draft.remarks,
                status: 'DRAFT',
                totalLossQuantity: lines.reduce((sum, line) => sum + line.lossQuantity, 0),
                totalLossValue: lines.reduce((sum, line) => sum + line.lossValue, 0),
                createdAt: draft.createdAt,
                updatedAt: draft.updatedAt ?? draft.createdAt,
                sharedWithCashiers: draft.sharedWithCashiers,
                createdBy: String(draft.createdBy),
                ownedByCurrentUser: draft.ownedByCurrentUser,
              };
              return {
                ...current,
                id: payload.id,
                scope,
                tenantId: db.scope.tenantId,
                storeId: current?.storeId ?? db.scope.storeIds[0] ?? null,
                remoteId: String(draft.id),
                payload,
                serverVersion: current?.serverVersion ?? 0,
                syncStatus: 'API' as const,
                updatedAt: Date.parse(payload.updatedAt) || Date.now(),
                deletedAt: null,
              };
            }),
        );
        await Promise.all(
          existing
            .filter(
              (record) =>
                record.payload.status === 'DRAFT' &&
                record.syncStatus === 'API' &&
                record.remoteId &&
                !remoteIds.has(record.remoteId),
            )
            .map((record) =>
              db.collection<LocalRecord<StockReconciliationReport>>('stock_counts').remove(record.id),
            ),
        );
        await reconciliations.reload();
      } catch {
        // Keep the last authorized local draft list available while offline.
      }
    },
    [auth.session, local.database, products.data, reconciliations],
  );

  useBackgroundRefresh(
    pathname === '/inventory-reconciliation' && auth.session && local.status === 'ready'
      ? `reconciliations:${auth.session.tenant.id}:${auth.session.user.id}`
      : undefined,
    refreshDrafts,
  );
  useBackgroundRefresh(
    pathname === '/inventory-reconciliation' && local.database && local.status === 'ready'
      ? `reconciliation-products:${createScopeKey(local.database.scope)}`
      : undefined,
    (signal) => inventoryApi.refresh(signal),
  );

  const buildReport = (status: StockReconciliationReport['status']): StockReconciliationReport => {
    const now = new Date().toISOString();
    const lines = selected.map(({ product, countedQuantity }) => {
      const lossQuantity = Math.max(0, product.stock - countedQuantity);
      return {
        productId: product.id,
        productName: product.name,
        previousQuantity: product.stock,
        countedQuantity,
        variance: countedQuantity - product.stock,
        lossQuantity,
        lossValue: lossQuantity * product.price,
      };
    });
    const existing = reconciliations.data.find((record) => record.id === editingId)?.payload;
    return {
      id: editingId ?? `stock-count-${Date.now()}`,
      lines,
      reference: reference.trim() || undefined,
      remarks: remarks.trim() || undefined,
      status,
      totalLossQuantity: lines.reduce((sum, line) => sum + line.lossQuantity, 0),
      totalLossValue: lines.reduce((sum, line) => sum + line.lossValue, 0),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      sharedWithCashiers: canManage ? sharedWithCashiers : (existing?.sharedWithCashiers ?? false),
      createdBy: existing?.createdBy ?? String(auth.session?.user.id ?? ''),
      ownedByCurrentUser: existing?.ownedByCurrentUser ?? true,
      ...(status === 'COMPLETED' ? { completedAt: now } : {}),
    };
  };

  const saveDraft = async () => {
    if (!selected.length) return;
    if (hasInvalidCounts)
      return showSnackbar('Invalid count', 'Enter a valid count for every added product.');
    setSaving(true);
    try {
      const report = buildReport('DRAFT');
      // Drafts are local records only; submitting later creates the outbox mutation.
      const db = local.database;
      if (!db) throw new Error('Local database is not ready.');
      const current = editingId
        ? await db.collection<LocalRecord<StockReconciliationReport>>('stock_counts').get(editingId)
        : undefined;
      const apiJob = await inventoryApi.saveReconciliationDraft({
        items: report.lines.map((line) => ({
          productId: line.productId,
          countedQuantity: line.countedQuantity,
        })),
        draftId: current?.remoteId ?? undefined,
        reference: report.reference,
        remarks: report.remarks,
        sharedWithCashiers: report.sharedWithCashiers,
      });
      await db.collection<LocalRecord<StockReconciliationReport>>('stock_counts').put({
        ...current,
        id: current?.id ?? report.id,
        scope: current?.scope ?? createScopeKey(db.scope),
        tenantId: current?.tenantId ?? db.scope.tenantId,
        storeId: current?.storeId ?? db.scope.storeIds[0] ?? null,
        remoteId: apiJob.entityId ?? current?.remoteId ?? null,
        payload: report,
        serverVersion: current?.serverVersion ?? 0,
        syncStatus: 'API',
        updatedAt: Date.now(),
        deletedAt: null,
      });
      await reconciliations.reload();
      setEditingId(report.id);
      showSnackbar('Draft saved', `${report.lines.length} product counts saved locally.`);
    } catch (error) {
      showSnackbar('Could not save draft', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!selected.length) return showSnackbar('Select products', 'Enter a count for at least one product.');
    if (hasInvalidCounts)
      return showSnackbar('Invalid count', 'Enter a valid count for every added product.');
    setSaving(true);
    try {
      const report = buildReport('COMPLETED');
      const current = editingId
        ? await local.database
            ?.collection<LocalRecord<StockReconciliationReport>>('stock_counts')
            .get(editingId)
        : undefined;
      const queued = await reconciliations.createMutation({
        payload: report,
        operation: editingId ? 'UPDATE' : 'CREATE',
        localId: report.id,
        idempotencyKey: `stock-reconciliation:${report.id}`,
      });
      const apiJob = await inventoryApi.reconcileReport({
        items: report.lines.map((line) => ({
          productId: line.productId,
          countedQuantity: line.countedQuantity,
        })),
        draftId: current?.remoteId ?? undefined,
        reference: report.reference,
        remarks: report.remarks,
        sharedWithCashiers: report.sharedWithCashiers,
      });
      await reconciliations.resolveMutation({
        jobId: queued.job.payload.offlineId,
        serverId: apiJob.entityId || apiJob.id,
        payload: report,
      });
      const db = local.database;
      if (!db) throw new Error('Local database is not ready.');
      await db.collection<LocalRecord<Product>>('products').putMany(
        selected.map(({ record, countedQuantity }) => ({
          ...record,
          payload: { ...record.payload, stock: countedQuantity },
          updatedAt: Date.now(),
        })),
      );
      await products.reload();
      setCounts({});
      setEditingId(undefined);
      setReference('');
      setRemarks('');
      setSharedWithCashiers(false);
      showSnackbar('Reconciliation submitted', `${report.lines.length} product stocks were updated.`);
    } catch (error) {
      showSnackbar('Submission failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const edit = (record: LocalRecord<StockReconciliationReport>) => {
    const report = record.payload;
    setEditingId(record.id);
    setCounts(Object.fromEntries(report.lines.map((line) => [line.productId, String(line.countedQuantity)])));
    setReference(report.reference ?? '');
    setRemarks(report.remarks ?? '');
    setSharedWithCashiers(report.sharedWithCashiers === true);
  };

  if (!allowed) return <Redirect href="/billing" />;
  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentContainerStyle={[s.content, { paddingBottom: bottomClearance + 24 }]}
    >
      <View style={s.header}>
        <View style={s.headerCopy}>
          <Text style={[s.title, { color: c.text }]}>Stock reconciliation</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>
            Count multiple products and submit one report
          </Text>
        </View>
      </View>
      <View style={[s.panel, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
        <TextInput
          value={reference}
          onChangeText={setReference}
          placeholder="Reference (optional)"
          placeholderTextColor={c.textSecondary}
          style={[s.field, { color: c.text, borderColor: c.outline }]}
        />
        {canManage ? (
          <AppPressable
            onPress={() => setSharedWithCashiers((value) => !value)}
            style={[s.shareControl, { borderColor: c.outline }]}
          >
            <View
              style={[s.shareIndicator, { backgroundColor: sharedWithCashiers ? c.primary : c.outlineMuted }]}
            />
            <Text style={{ color: c.text, fontWeight: '800' }}>
              {sharedWithCashiers ? 'Shared with cashiers' : 'Only managers can see this draft'}
            </Text>
          </AppPressable>
        ) : null}
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Remarks (optional)"
          placeholderTextColor={c.textSecondary}
          style={[s.field, { color: c.text, borderColor: c.outline }]}
        />
        <View style={s.searchRow}>
          <View style={[s.searchBox, { borderColor: c.outline, backgroundColor: c.background }]}>
            <Search size={18} color={c.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, SKU, or barcode"
              placeholderTextColor={c.textSecondary}
              style={[s.searchInput, { color: c.text }]}
            />
            {search ? (
              <AppPressable accessibilityLabel="Clear product search" onPress={() => setSearch('')}>
                <X size={17} color={c.textSecondary} />
              </AppPressable>
            ) : null}
          </View>
          <AppPressable
            accessibilityLabel="Scan product barcode"
            onPress={() => setScannerOpen(true)}
            style={[s.scanButton, { backgroundColor: c.primary }]}
          >
            <ScanLine size={20} color="#fff" />
          </AppPressable>
        </View>
        {suggestions.map(({ payload: product }) => (
          <AppPressable
            key={product.id}
            onPress={() => addProduct(product)}
            style={[s.suggestion, { borderColor: c.outlineMuted }]}
          >
            <View style={s.productCopy}>
              <Text style={[s.productName, { color: c.text }]}>{product.name}</Text>
              <Text style={[s.productStock, { color: c.textSecondary }]}>System stock {product.stock}</Text>
            </View>
            <Text style={{ color: c.primary, fontWeight: '800' }}>Add</Text>
          </AppPressable>
        ))}
        {products.loading ? (
          <Text style={[s.loading, { color: c.textSecondary }]}>Loading local inventory…</Text>
        ) : null}
        {!products.loading && !addedProducts.length ? (
          <Text style={[s.emptySelection, { color: c.textSecondary }]}>
            Search or scan to add products to this count.
          </Text>
        ) : null}
        {addedProducts.map((product) => (
          <View key={product.id} style={[s.productRow, { borderBottomColor: c.outlineMuted }]}>
            <View style={s.productCopy}>
              <Text style={[s.productName, { color: c.text }]}>{product.name}</Text>
              <Text style={[s.productStock, { color: c.textSecondary }]}>System stock {product.stock}</Text>
            </View>
            <TextInput
              value={counts[product.id] ?? ''}
              onChangeText={(value) => setCounts((current) => ({ ...current, [product.id]: value }))}
              placeholder="Count"
              placeholderTextColor={c.textSecondary}
              keyboardType="decimal-pad"
              style={[s.count, { color: c.text, borderColor: c.outline, backgroundColor: c.background }]}
            />
            <AppPressable
              accessibilityLabel={`Remove ${product.name}`}
              onPress={() => removeProduct(product.id)}
            >
              <X size={18} color={c.textSecondary} />
            </AppPressable>
          </View>
        ))}
        <View style={s.actions}>
          <AppPressable
            disabled={saving || !selected.length || hasInvalidCounts}
            onPress={() => void saveDraft()}
            style={[s.secondary, { borderColor: c.primary, opacity: selected.length ? 1 : 0.5 }]}
          >
            <Save size={17} color={c.primary} />
            <Text style={[s.actionText, { color: c.primary }]}>Save draft</Text>
          </AppPressable>
          <AppPressable
            disabled={saving || !selected.length || hasInvalidCounts}
            onPress={() => void submit()}
            style={[s.primary, { backgroundColor: c.primary, opacity: selected.length ? 1 : 0.5 }]}
          >
            <Check size={17} color="#fff" />
            <Text style={[s.actionText, { color: '#fff' }]}>{saving ? 'Saving…' : 'Submit report'}</Text>
          </AppPressable>
        </View>
      </View>
      <View style={s.history}>
        <View style={s.historyHeading}>
          <ClipboardList size={17} color={c.primary} />
          <Text style={[s.historyTitle, { color: c.text }]}>Saved drafts</Text>
        </View>
        {!visibleDrafts.length ? (
          <Text style={[s.emptySelection, { color: c.textSecondary }]}>No saved drafts available.</Text>
        ) : null}
        {visibleDrafts.map((record) => {
          const report = record.payload;
          if (!report.lines) return null;
          return (
            <View
              key={record.id}
              style={[s.historyRow, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}
            >
              <View style={s.productCopy}>
                <Text style={[s.productName, { color: c.text }]}>{report.reference || report.id}</Text>
                <Text style={[s.productStock, { color: c.textSecondary }]}>
                  {report.lines.length} products · {report.status.toLowerCase()} · Loss ₹
                  {report.totalLossValue.toFixed(2)}
                </Text>
              </View>
              <AppPressable onPress={() => edit(record)} style={[s.edit, { borderColor: c.primary }]}>
                <Text style={[s.editText, { color: c.primary }]}>Open</Text>
              </AppPressable>
            </View>
          );
        })}
      </View>
      {completedReports.length ? (
        <View style={s.history}>
          <View style={s.historyHeading}>
            <ClipboardList size={17} color={c.primary} />
            <Text style={[s.historyTitle, { color: c.text }]}>Completed history</Text>
          </View>
          {completedReports.map((record) => (
            <View
              key={record.id}
              style={[s.historyRow, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}
            >
              <View style={s.productCopy}>
                <Text style={[s.productName, { color: c.text }]}>
                  {record.payload.reference || record.payload.id}
                </Text>
                <Text style={[s.productStock, { color: c.textSecondary }]}>
                  {record.payload.lines.length} products · Loss ₹{record.payload.totalLossValue.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(value) => {
          setScannerOpen(false);
          const normalized = value.trim().toLowerCase();
          const product = products.data.find(
            ({ payload }) =>
              payload.barcode?.toLowerCase() === normalized || payload.sku?.toLowerCase() === normalized,
          )?.payload;
          if (product) addProduct(product);
          else {
            setSearch(value);
            showSnackbar('Product not found', 'No local inventory item matches this barcode.');
          }
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerCopy: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 12 },
  panel: { borderWidth: 1, borderRadius: 18, padding: 14 },
  field: { height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 },
  shareControl: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  shareIndicator: { width: 10, height: 10, borderRadius: 5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchBox: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1 },
  scanButton: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  suggestion: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptySelection: { paddingVertical: 20, textAlign: 'center', fontSize: 12 },
  loading: { paddingVertical: 18, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  productRow: {
    minHeight: 62,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productCopy: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '900' },
  productStock: { marginTop: 3, fontSize: 11 },
  count: { width: 92, height: 40, borderWidth: 1, borderRadius: 11, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  secondary: {
    flex: 1,
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionText: { fontSize: 12, fontWeight: '900' },
  history: { marginTop: 22, gap: 8 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  historyTitle: { fontSize: 16, fontWeight: '900' },
  historyRow: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  edit: { minHeight: 32, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, justifyContent: 'center' },
  editText: { fontSize: 11, fontWeight: '900' },
});
