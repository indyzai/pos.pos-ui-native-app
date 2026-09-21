import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, RefreshCw, Search, UserRound } from 'lucide-react-native';
import { AppPressable, showSnackbar, useAppTheme, useBottomNavigation } from '@indyzai/pos-ui-native';
import { createLocalFirstTableHook, payloadsFromRecords } from '@indyzai/pos-database';
import { customersApi, type LocalCustomer } from './customersApi';

const useCustomerTable = createLocalFirstTableHook<LocalCustomer>({
  table: 'customers',
  entityType: 'CUSTOMER',
});

export function CustomersScreen() {
  const { isDark, themeColors: c } = useAppTheme();
  const { setCenterItem } = useBottomNavigation();
  const { data: records, loading, error } = useCustomerTable();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCenterItem({ label: 'Add', icon: Plus, onPress: () => setModal(true) });
    return () => setCenterItem(null);
  }, [setCenterItem]);
  const customers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payloadsFromRecords(records).filter(
      (item) =>
        !term ||
        [item.name, item.phone, item.email, item.gstin].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [records, search]);

  const sync = async () => {
    setBusy(true);
    try {
      await customersApi.sync();
      showSnackbar('Customers updated');
    } catch (reason) {
      showSnackbar('Working offline', reason instanceof Error ? reason.message : 'Sync will retry later.');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!name.trim()) {
      showSnackbar('Customer name required', 'Enter a name to save this customer.');
      return;
    }
    setBusy(true);
    try {
      await customersApi.create({ name, phone: phone.trim() || undefined, email: email.trim() || undefined });
      setName('');
      setPhone('');
      setEmail('');
      setModal(false);
      showSnackbar('Customer saved', 'Saved locally and queued for synchronization.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.screen, { backgroundColor: c.background }]}>
      <View style={s.header}>
        <View>
          <Text style={[s.title, { color: c.text }]}>Customers</Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>{records.length} saved locally</Text>
        </View>
        <AppPressable
          accessibilityLabel="Sync customers"
          disabled={busy}
          onPress={sync}
          style={[s.sync, { backgroundColor: c.surface }]}
        >
          <RefreshCw size={20} color={c.primary} />
        </AppPressable>
      </View>
      <View style={[s.search, { backgroundColor: c.surface, borderColor: c.outline }]}>
        <Search size={18} color={c.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, email or GSTIN"
          placeholderTextColor={c.textSecondary}
          style={[s.input, { color: c.text }]}
        />
      </View>
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outline }]}>
            <View style={[s.avatar, { backgroundColor: c.primarySoft }]}>
              <UserRound size={20} color={c.primary} />
            </View>
            <View style={s.details}>
              <Text style={[s.name, { color: c.text }]}>{item.name}</Text>
              <Text style={[s.meta, { color: c.textSecondary }]}>
                {[item.phone, item.email, item.gstin].filter(Boolean).join(' · ') || 'No contact details'}
              </Text>
            </View>
            {item.pendingSync && <Text style={[s.pending, { color: c.primary }]}>PENDING</Text>}
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={s.emptyLoader}>
              <ActivityIndicator color={c.primary} />
              <Text style={{ color: c.textSecondary }}>Loading local customers…</Text>
            </View>
          ) : (
            <Text style={[s.empty, { color: c.textSecondary }]}>{error || 'No customers found.'}</Text>
          )
        }
      />
      <Modal transparent visible={modal} animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={s.overlay}>
          <AppPressable style={StyleSheet.absoluteFill} onPress={() => setModal(false)} />
          <View style={[s.dialog, { backgroundColor: c.surface }]}>
            <Text style={[s.dialogTitle, { color: c.text }]}>Add customer</Text>
            <CustomerField label="Name" value={name} onChange={setName} />
            <CustomerField label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" />
            <CustomerField label="Email" value={email} onChange={setEmail} keyboardType="email-address" />
            <View style={s.actions}>
              <AppPressable onPress={() => setModal(false)} style={s.action}>
                <Text style={{ color: c.textSecondary }}>Cancel</Text>
              </AppPressable>
              <AppPressable disabled={busy} onPress={save} style={[s.action, { backgroundColor: c.primary }]}>
                <Text style={{ color: isDark ? c.background : c.surface, fontWeight: '800' }}>
                  Save locally
                </Text>
              </AppPressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CustomerField({
  label,
  value,
  onChange,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      placeholder={label}
      placeholderTextColor={c.textSecondary}
      style={[s.field, { color: c.text, borderColor: c.outline }]}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 18, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '900' },
  subtitle: { fontSize: 13, marginTop: 3 },
  sync: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  search: {
    height: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  list: { paddingVertical: 14, gap: 10 },
  card: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1 },
  name: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 5 },
  pending: { fontSize: 10, fontWeight: '900' },
  empty: { textAlign: 'center', marginTop: 48 },
  emptyLoader: { marginTop: 48, alignItems: 'center', gap: 10 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: { width: '100%', maxWidth: 440, borderRadius: 22, padding: 20, gap: 12 },
  dialogTitle: { fontSize: 21, fontWeight: '900', marginBottom: 4 },
  field: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  action: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
