import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { showSnackbar } from '../../../shared/providers/SnackbarProvider';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CreateInventoryItemInput } from '../types';

export function AddInventoryItemModal({
  visible,
  busy,
  onClose,
  onSave,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (input: CreateInventoryItemInput) => Promise<void>;
}) {
  const { themeColors: c } = useAppTheme();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => {
    if (visible) {
      setName('');
      setPrice('');
      setStock('0');
      setBarcode('');
      setCategory('');
    }
  }, [visible]);
  const save = async () => {
    const numericPrice = Number(price);
    const numericStock = Number(stock);
    if (
      name.trim().length < 2 ||
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      !Number.isFinite(numericStock) ||
      numericStock < 0
    ) {
      showSnackbar('Invalid item', 'Enter a name, non-negative price, and non-negative stock quantity.');
      return;
    }
    await onSave({
      name: name.trim(),
      price: numericPrice,
      stock: numericStock,
      barcode: barcode.trim() || undefined,
      category: category.trim() || undefined,
    });
  };
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <AppPressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Add inventory item</Text>
            <AppPressable
              disabled={busy}
              onPress={onClose}
              style={[styles.close, { backgroundColor: c.surfaceMuted }]}
            >
              <X size={20} color={c.text} />
            </AppPressable>
          </View>
          <Field label="Product name" value={name} onChangeText={setName} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Selling price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </View>
            <View style={styles.flex}>
              <Field label="Opening stock" value={stock} onChangeText={setStock} keyboardType="decimal-pad" />
            </View>
          </View>
          <Field label="Category (optional)" value={category} onChangeText={setCategory} />
          <Field label="Barcode (optional)" value={barcode} onChangeText={setBarcode} />
          <AppPressable
            disabled={busy}
            onPress={() => void save()}
            style={[styles.save, { backgroundColor: c.primary, opacity: busy ? 0.65 : 1 }]}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.saveText}>{busy ? 'Adding…' : 'Add item'}</Text>
          </AppPressable>
        </View>
      </View>
    </Modal>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { themeColors: c } = useAppTheme();
  const { label, ...input } = props;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        {...input}
        placeholderTextColor={c.textSecondary}
        style={[styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.outline }]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,14,19,.4)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 21, fontWeight: '900' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  field: { marginBottom: 13 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
  input: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14 },
  save: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
