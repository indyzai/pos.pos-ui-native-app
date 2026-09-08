import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { AlertTriangle, Boxes, IndianRupee, Package, PackageX, Plus, Search, X } from 'lucide-react-native';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { InventoryCard } from './components/InventoryCard';
import { ReconcileStockModal } from './components/ReconcileStockModal';
import { useInventory } from './hooks/useInventory';
import type { InventoryFilter, InventoryProduct } from './types';
import { useAppHeader } from '../../shared/providers/AppHeaderProvider';
import { useBottomNavigation } from '../../shared/providers/BottomNavigationProvider';
import { AddInventoryItemModal } from './components/AddInventoryItemModal';

export function InventoryScreen() {
  const { themeColors: c } = useAppTheme();
  const { width } = useWindowDimensions();
  const data = useInventory();
  const { setFeatureRefresh } = useAppHeader();
  const { setCenterItem } = useBottomNavigation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [selected, setSelected] = useState<InventoryProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const refreshRef = useRef(data.refresh);
  refreshRef.current = data.refresh;
  useEffect(() => {
    setFeatureRefresh(() => refreshRef.current(), data.refreshing);
    return () => setFeatureRefresh(undefined);
  }, [data.refreshing, setFeatureRefresh]);
  useEffect(() => {
    setCenterItem({ label: 'Add item', icon: Plus, onPress: () => setAddOpen(true) });
    return () => setCenterItem(null);
  }, [setCenterItem]);
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
    try {
      await data.refresh();
    } catch (error) {
      Alert.alert('Inventory refresh failed', error instanceof Error ? error.message : 'Try again.');
    }
  };
  return (
    <View style={[styles.screen, { backgroundColor: c.background }]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={() => void refresh()}
            tintColor={c.primary}
          />
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <View>
            <Text style={[styles.title, { color: c.text }]}>Inventory</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Manage products and reconcile stock levels
            </Text>
          </View>
        </View>
        {data.error ? <Text style={[styles.error, { color: c.error }]}>{data.error}</Text> : null}
        <View style={styles.stats}>
          <Stat icon={Package} label="Products" value={String(summary.total)} color={c.primary} />
          <Stat icon={AlertTriangle} label="Low stock" value={String(summary.low)} color="#D97706" />
          <Stat icon={PackageX} label="Out of stock" value={String(summary.out)} color={c.error} />
          <Stat
            icon={IndianRupee}
            label="Stock value"
            value={`₹${formatValue(summary.value)}`}
            color="#16A34A"
          />
        </View>
        <View style={[styles.toolbar, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
          <View style={[styles.search, { backgroundColor: c.background, borderColor: c.outline }]}>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {categories.map((item) => (
              <Chip key={item} label={item} active={category === item} onPress={() => setCategory(item)} />
            ))}
          </ScrollView>
          <View style={styles.filters}>
            <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
            <Chip label="Low stock" active={filter === 'low'} onPress={() => setFilter('low')} />
            <Chip label="Out of stock" active={filter === 'out'} onPress={() => setFilter('out')} />
          </View>
        </View>
        {products.length ? (
          <View style={styles.grid}>
            {products.map((product) => (
              <View
                key={product.id}
                style={{ width: width >= 1050 ? '31.8%' : width >= 620 ? '48.5%' : '100%' }}
              >
                <InventoryCard product={product} onPress={() => setSelected(product)} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <Boxes size={48} color={c.outline} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>No inventory found</Text>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>
              Try another search or refresh the product catalog.
            </Text>
          </View>
        )}
      </ScrollView>
      <ReconcileStockModal
        product={selected}
        busy={data.reconciling}
        onClose={() => setSelected(null)}
        onSave={async (input) => {
          try {
            await data.reconcile(input);
            setSelected(null);
            Alert.alert('Stock reconciled', 'The counted quantity was saved.');
          } catch (error) {
            Alert.alert('Reconciliation failed', error instanceof Error ? error.message : 'Try again.');
          }
        }}
      />
      <AddInventoryItemModal
        visible={addOpen}
        busy={data.creating}
        onClose={() => setAddOpen(false)}
        onSave={async (input) => {
          try {
            await data.create(input);
            setAddOpen(false);
            Alert.alert('Item added', `${input.name} was added to inventory.`);
          } catch (error) {
            Alert.alert('Could not add item', error instanceof Error ? error.message : 'Try again.');
          }
        }}
      />
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
  content: { padding: 18, paddingBottom: 100 },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  title: { fontSize: 25, fontWeight: '900' },
  subtitle: { marginTop: 4, fontSize: 13 },
  error: { marginBottom: 12, fontSize: 12, fontWeight: '700' },
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
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 9,
  },
  searchInput: { flex: 1, fontSize: 14 },
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
