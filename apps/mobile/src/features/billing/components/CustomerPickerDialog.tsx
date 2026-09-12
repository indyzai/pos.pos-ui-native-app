import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Search, UserRound, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { Customer } from '../types/billing';

export function CustomerPickerDialog({
  visible,
  customers,
  selected,
  onSelect,
  onCreate,
  onClose,
  embedded = false,
}: {
  visible: boolean;
  customers: Customer[];
  selected?: Customer;
  onSelect: (customer?: Customer) => void;
  onCreate: (input: { name: string; phone?: string }) => Promise<Customer>;
  onClose: () => void;
  embedded?: boolean;
}) {
  const { themeColors: c } = useAppTheme();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const visibleCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? customers.filter((item) =>
          [item.name, item.phone, item.email, item.gstin].some((value) =>
            value?.toLowerCase().includes(term),
          ),
        )
      : customers;
  }, [customers, search]);
  const choose = (customer?: Customer) => {
    onSelect(customer);
    onClose();
  };
  const create = async () => {
    const name = search.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      choose(await onCreate({ name }));
    } finally {
      setCreating(false);
    }
  };
  const panel = (
    <SafeAreaView
      edges={['bottom']}
      style={[s.sheet, embedded && s.embedded, { backgroundColor: c.surface }]}
    >
      {!embedded && (
        <View style={s.header}>
          <View>
            <Text style={[s.title, { color: c.text }]}>Select customer</Text>
            <Text style={[s.subtitle, { color: c.textSecondary }]}>Cached for offline billing</Text>
          </View>
          <AppPressable
            accessibilityLabel={embedded ? 'Back to cart' : 'Close customer selection'}
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
      <View style={[s.search, { backgroundColor: c.background, borderColor: c.outline }]}>
        <Search size={17} color={c.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Name, phone, email or GSTIN"
          placeholderTextColor={c.textSecondary}
          style={[s.input, { color: c.text }]}
        />
      </View>
      <AppPressable
        onPress={() => choose(undefined)}
        style={[
          s.row,
          { borderColor: c.outlineMuted, backgroundColor: !selected ? c.primarySoft : c.surface },
        ]}
      >
        <View style={[s.avatar, { backgroundColor: c.surfaceMuted }]}>
          <UserRound size={17} color={c.textSecondary} />
        </View>
        <View style={s.details}>
          <Text style={[s.name, { color: c.text }]}>Walk-in customer</Text>
          <Text style={[s.meta, { color: c.textSecondary }]}>No customer linked</Text>
        </View>
      </AppPressable>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.list}>
        {visibleCustomers.map((customer) => (
          <AppPressable
            key={customer.id}
            onPress={() => choose(customer)}
            style={[
              s.row,
              {
                borderColor: selected?.id === customer.id ? c.primary : c.outlineMuted,
                backgroundColor: selected?.id === customer.id ? c.primarySoft : c.surface,
              },
            ]}
          >
            <View style={[s.avatar, { backgroundColor: c.surfaceMuted }]}>
              <Text style={[s.initial, { color: c.primary }]}>{customer.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={s.details}>
              <Text style={[s.name, { color: c.text }]}>{customer.name}</Text>
              <Text numberOfLines={1} style={[s.meta, { color: c.textSecondary }]}>
                {[customer.phone, customer.email, customer.gstin].filter(Boolean).join(' · ') || 'Customer'}
              </Text>
            </View>
          </AppPressable>
        ))}
        {!visibleCustomers.length && (
          <Text style={[s.empty, { color: c.textSecondary }]}>No matching customers in local data.</Text>
        )}
        {!!search.trim() &&
          !customers.some((item) => item.name.toLowerCase() === search.trim().toLowerCase()) && (
            <AppPressable
              disabled={creating}
              onPress={() => void create()}
              style={[s.create, { backgroundColor: c.primary }]}
            >
              <Text style={s.createText}>{creating ? 'Creating…' : `Create “${search.trim()}”`}</Text>
            </AppPressable>
          )}
      </ScrollView>
    </SafeAreaView>
  );
  if (embedded) return visible ? panel : null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <AppPressable accessibilityLabel="Close customer selection" style={s.backdrop} onPress={onClose} />
        {panel}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,12,22,.5)' },
  sheet: {
    maxHeight: '82%',
    minHeight: '55%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
  },
  embedded: {
    flex: 1,
    maxHeight: '100%',
    minHeight: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { fontSize: 10, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  search: {
    height: 48,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  input: { flex: 1, fontSize: 14 },
  list: { paddingBottom: 20 },
  row: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 13,
    padding: 9,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 15, fontWeight: '900' },
  details: { flex: 1 },
  name: { fontSize: 13, fontWeight: '800' },
  meta: { fontSize: 10, marginTop: 3 },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 12 },
  create: { height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  createText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
