import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, ClipboardList, Save } from 'lucide-react-native';
import { AppPressable, useAppTheme } from '@indyzai/pos-ui';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { useAuthSession } from '@indyzai/pos-auth/session';
import {
  createLocalFirstTableHook,
  createScopeKey,
  type LocalRecord,
  useLocalDatabase,
} from '@indyzai/pos-database';
import { hasEntitlement } from '@indyzai/pos-auth/access';
import type { Product } from '../billing/types/billing';
import type { StockReconciliationReport } from './types';
import { inventoryApi } from './inventoryApi';

const useProducts = createLocalFirstTableHook<Product>({ table: 'products', entityType: 'PRODUCT' });
const useReconciliations = createLocalFirstTableHook<StockReconciliationReport>({
  table: 'stock_counts',
  entityType: 'STOCK_RECONCILIATION',
  query: { includeDeleted: true },
});

export function StockReconciliationScreen() {
  const { themeColors: c } = useAppTheme();
  const auth = useAuthSession();
  const router = useRouter();
  const params = useLocalSearchParams<{ productId?: string }>();
  const products = useProducts();
  const reconciliations = useReconciliations();
  const local = useLocalDatabase();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    if (editingId || params.productId || Object.keys(counts).length || !products.data.length) return;
    setCounts(
      Object.fromEntries(products.data.map((record) => [record.payload.id, String(record.payload.stock)])),
    );
  }, [counts, editingId, params.productId, products.data]);

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
      ...(status === 'COMPLETED' ? { completedAt: now } : {}),
    };
  };

  const saveDraft = async () => {
    if (!selected.length) return;
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
  };

  if (!allowed) return <Redirect href="/billing" />;
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={s.content}>
      <View style={s.header}>
        <AppPressable
          onPress={() => router.back()}
          style={[s.iconButton, { backgroundColor: c.surfaceMuted }]}
        >
          <ArrowLeft size={20} color={c.text} />
        </AppPressable>
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
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          placeholder="Remarks (optional)"
          placeholderTextColor={c.textSecondary}
          style={[s.field, { color: c.text, borderColor: c.outline }]}
        />
        {products.loading ? (
          <Text style={[s.loading, { color: c.textSecondary }]}>Loading local inventory…</Text>
        ) : null}
        {products.data.map(({ payload: product }) => (
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
          </View>
        ))}
        <View style={s.actions}>
          <AppPressable
            disabled={saving || !selected.length}
            onPress={() => void saveDraft()}
            style={[s.secondary, { borderColor: c.primary, opacity: selected.length ? 1 : 0.5 }]}
          >
            <Save size={17} color={c.primary} />
            <Text style={[s.actionText, { color: c.primary }]}>Save draft</Text>
          </AppPressable>
          <AppPressable
            disabled={saving || !selected.length}
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
          <Text style={[s.historyTitle, { color: c.text }]}>Reconciliation history</Text>
        </View>
        {reconciliations.data.map((record) => {
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
                <Text style={[s.editText, { color: c.primary }]}>Edit</Text>
              </AppPressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', padding: 18, paddingBottom: 60 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 12 },
  panel: { borderWidth: 1, borderRadius: 18, padding: 14 },
  field: { height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 },
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
