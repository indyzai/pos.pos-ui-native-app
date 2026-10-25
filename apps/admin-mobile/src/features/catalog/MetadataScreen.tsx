import { translateUI } from '@indyzai/pos-ui-native/i18n';
import { usePathname } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, RefreshCw } from 'lucide-react-native';
import { AppPressable, showSnackbar, useAppTheme, useBackgroundRefresh } from '@indyzai/pos-ui-native';
import { createOfflineTableHook, createScopeKey, useLocalDatabase } from '@indyzai/pos-database';
import { usePermissions } from '@indyzai/pos-auth/permissions';
import type { MetadataKind, MetadataRecord } from '@indyzai/feature-catalog/metadataApi';
import { metadataApi } from './metadataApi';
import { MetadataDialog } from './components/MetadataDialog';
const useUnits = createOfflineTableHook<MetadataRecord>({ table: 'units', entityType: 'UNIT' });
const useCategories = createOfflineTableHook<MetadataRecord>({ table: 'categories', entityType: 'CATEGORY' });
const useTaxes = createOfflineTableHook<MetadataRecord>({ table: 'tax_rates', entityType: 'TAX_RATE' });
const tabs: { kind: MetadataKind; label: string }[] = [
  { kind: 'units', label: 'Units' },
  { kind: 'categories', label: 'Categories' },
  { kind: 'tax_rates', label: 'Tax rates' },
];
export function MetadataScreen() {
  const { themeColors: c } = useAppTheme();
  const { can } = usePermissions('admin');
  const local = useLocalDatabase();
  const pathname = usePathname();
  const [kind, setKind] = useState<MetadataKind>('units');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const units = useUnits();
  const categories = useCategories();
  const taxes = useTaxes();
  const current = { units, categories, tax_rates: taxes }[kind];
  const allowed = can('organization.manage');
  useBackgroundRefresh(
    allowed && pathname === '/catalog-setup' && local.database && local.status === 'ready'
      ? `catalog-setup:${kind}:${createScopeKey(local.database.scope)}`
      : undefined,
    (signal) => metadataApi.refresh(kind, signal, local.database),
  );
  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      await metadataApi.refresh(kind, undefined, local.database);
      showSnackbar('Catalog setup updated');
    } catch (reason) {
      showSnackbar(
        'Working offline',
        reason instanceof Error ? reason.message : 'Saved entries remain available.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function retry(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      await metadataApi.retry(kind, id);
      showSnackbar('Sync queued again');
    } catch (reason) {
      showSnackbar('Could not retry', reason instanceof Error ? reason.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!allowed)
    return (
      <View style={[s.screen, { backgroundColor: c.background }]}>
        <Text style={{ color: c.text }}>Administrator access required.</Text>
      </View>
    );
  const term = search.trim().toLowerCase();
  const rows = current.data.filter((row) =>
    [row.payload.name, row.payload.code, row.payload.type].some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(term),
    ),
  );
  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: c.text }]}>{translateUI('Catalog setup')}</Text>
          <Text style={{ color: c.textSecondary }}>Units, categories and tax rates</Text>
        </View>
        <AppPressable
          accessibilityLabel="Refresh metadata"
          disabled={busy}
          onPress={() => void refresh()}
          style={s.action}
        >
          <RefreshCw color={c.primary} size={22} />
        </AppPressable>
        <AppPressable
          accessibilityLabel="Add metadata"
          disabled={local.status !== 'ready'}
          onPress={() => setDialog(true)}
          style={[s.action, { backgroundColor: c.primary }]}
        >
          <Plus color="#fff" size={22} />
        </AppPressable>
      </View>
      <View style={s.tabs}>
        {tabs.map((tab) => (
          <AppPressable
            key={tab.kind}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === tab.kind }}
            onPress={() => {
              setKind(tab.kind);
              setSearch('');
            }}
            style={[s.tab, { backgroundColor: tab.kind === kind ? c.primary : c.surface }]}
          >
            <Text style={{ color: tab.kind === kind ? '#fff' : c.text }}>{tab.label}</Text>
          </AppPressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Search metadata"
        value={search}
        onChangeText={setSearch}
        placeholder="Search name, code or type"
        placeholderTextColor={c.textSecondary}
        style={[s.search, { color: c.text, borderColor: c.outline }]}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ gap: 12, paddingVertical: 16 }}
        ListEmptyComponent={
          current.loading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <Text style={{ color: c.textSecondary }}>
              {current.error || 'No entries found. Tap + to add one.'}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outline }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 17 }}>{item.payload.name}</Text>
            <Text style={{ color: c.textSecondary }}>
              {kind === 'tax_rates'
                ? `${item.payload.percentage ?? item.payload.rate ?? 0}%`
                : [item.payload.code, item.payload.type, item.payload.description]
                    .filter(Boolean)
                    .join(' · ')}
            </Text>
            <Text style={{ color: c.textSecondary }}>
              {['API', 'SYNCED'].includes(item.syncStatus)
                ? 'Synced'
                : item.syncStatus === 'FAILED'
                  ? 'Sync failed — saved on device'
                  : 'Pending sync — saved on device'}
            </Text>
            {item.payload.syncError ? (
              <Text style={{ color: c.text }}>{String(item.payload.syncError)}</Text>
            ) : null}
            {item.syncStatus === 'FAILED' && (
              <AppPressable disabled={busy} onPress={() => void retry(item.id)} style={s.tab}>
                <Text style={{ color: c.primary }}>Retry sync</Text>
              </AppPressable>
            )}
          </View>
        )}
      />
      {dialog && <MetadataDialog kind={kind} onClose={() => setDialog(false)} />}
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, padding: 18, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '800' },
  action: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tab: { minHeight: 44, padding: 12, borderRadius: 12, justifyContent: 'center' },
  search: { minHeight: 48, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 14, gap: 8 },
});
