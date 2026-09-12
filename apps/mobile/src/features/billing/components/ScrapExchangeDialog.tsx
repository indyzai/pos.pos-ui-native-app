import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowLeft, Plus, Recycle, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { formatCurrency } from '../../../shared/utils/currency';
import { createScrapExchange } from '../domain/scrapExchange';
import type { Product, ScrapExchange } from '../types/billing';

type Row = { product: Product; quantity: string; rate: string };
type Props = {
  visible: boolean;
  products: Product[];
  value?: ScrapExchange;
  currencyCode: string;
  onChange: (value?: ScrapExchange) => void;
  onClose: () => void;
  embedded?: boolean;
};

export function ScrapExchangeDialog({
  visible,
  products,
  value,
  currencyCode,
  onChange,
  onClose,
  embedded = false,
}: Props) {
  const { themeColors: c } = useAppTheme();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!visible) return;
    setRows(
      value?.items.map((item) => ({
        product: products.find((product) => product.id === item.productId) || {
          id: item.productId,
          name: item.productName,
          category: 'Scrap',
          price: item.unitPrice,
          stock: 0,
          emoji: '♻️',
          color: c.surfaceMuted,
        },
        quantity: String(item.quantity),
        rate: String(item.unitPrice),
      })) || [],
    );
  }, [c.surfaceMuted, products, value, visible]);
  const total = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.rate) || 0), 0);
  const add = (product: Product) =>
    setRows((current) => [
      ...current,
      {
        product,
        quantity: '1',
        rate: String(product.price || 0),
      },
    ]);
  const update = (index: number, next: Partial<Row>) =>
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...next } : row)));
  const panel = (
    <View style={[s.sheet, embedded && s.embedded, { backgroundColor: c.surface }]}>
      {!embedded && (
        <View style={s.header}>
          <View style={s.titleRow}>
            <Recycle size={20} color={c.primary} />
            <Text style={[s.title, { color: c.text }]}>Customer scrap exchange</Text>
          </View>
          <AppPressable
            accessibilityLabel={embedded ? 'Back to cart' : 'Close scrap exchange'}
            onPress={onClose}
          >
            {embedded ? <ArrowLeft color={c.textSecondary} /> : <X color={c.textSecondary} />}
          </AppPressable>
        </View>
      )}
      <Text style={[s.help, { color: c.textSecondary }]}>
        Record items received from the customer. Their value is settled against this bill.
      </Text>
      <ScrollView contentContainerStyle={s.content}>
        {rows.map((row, index) => (
          <View key={`${row.product.id}:${index}`} style={[s.row, { borderColor: c.outlineMuted }]}>
            <View style={s.name}>
              <Text style={[s.product, { color: c.text }]}>{row.product.name}</Text>
              <Text style={[s.caption, { color: c.textSecondary }]}>Quantity × rate</Text>
            </View>
            <TextInput
              value={row.quantity}
              onChangeText={(quantity) => update(index, { quantity })}
              keyboardType="decimal-pad"
              style={[s.input, { color: c.text, borderColor: c.outline }]}
            />
            <TextInput
              value={row.rate}
              onChangeText={(rate) => update(index, { rate })}
              keyboardType="decimal-pad"
              style={[s.input, s.rate, { color: c.text, borderColor: c.outline }]}
            />
            <AppPressable
              accessibilityLabel={`Remove ${row.product.name}`}
              onPress={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
            >
              <Trash2 size={18} color={c.error} />
            </AppPressable>
          </View>
        ))}
        <Text style={[s.section, { color: c.textSecondary }]}>Available scrap products</Text>
        {products.map((product) => (
          <AppPressable
            key={product.id}
            onPress={() => add(product)}
            style={[s.option, { backgroundColor: c.surfaceMuted }]}
          >
            <Text style={[s.product, { color: c.text }]}>{product.name}</Text>
            <Plus size={18} color={c.primary} />
          </AppPressable>
        ))}
        {!products.length && (
          <Text style={[s.empty, { color: c.textSecondary }]}>
            Create products in a SCRAP category before accepting an exchange.
          </Text>
        )}
      </ScrollView>
      <View style={[s.footer, { borderTopColor: c.outlineMuted }]}>
        <View>
          <Text style={[s.caption, { color: c.textSecondary }]}>Scrap credit</Text>
          <Text style={[s.total, { color: c.primary }]}>{formatCurrency(total, currencyCode)}</Text>
        </View>
        {value && (
          <AppPressable
            onPress={() => {
              onChange(undefined);
              onClose();
            }}
            style={s.remove}
          >
            <Text style={{ color: c.error }}>Remove</Text>
          </AppPressable>
        )}
        <AppPressable
          disabled={!rows.length}
          onPress={() => {
            try {
              onChange(
                createScrapExchange(
                  rows.map((row) => ({
                    product: row.product,
                    quantity: Number(row.quantity),
                    unitPrice: Number(row.rate),
                  })),
                ),
              );
              onClose();
            } catch {
              /* invalid rows stay editable */
            }
          }}
          style={[s.done, { backgroundColor: rows.length ? c.primary : c.surfaceMuted }]}
        >
          <Text style={s.doneText}>Apply exchange</Text>
        </AppPressable>
      </View>
    </View>
  );
  if (embedded) return visible ? panel : null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={s.overlay}>{panel}</SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.55)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  embedded: { flex: 1, maxHeight: '100%', borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 18, fontWeight: '900' },
  help: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  content: { paddingVertical: 14, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 13, padding: 10 },
  name: { flex: 1 },
  product: { fontSize: 13, fontWeight: '800' },
  caption: { fontSize: 10, marginTop: 2 },
  input: {
    width: 52,
    height: 38,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  rate: { width: 70 },
  section: { marginTop: 8, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  option: {
    minHeight: 44,
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empty: { textAlign: 'center', paddingVertical: 18, fontSize: 12 },
  footer: { borderTopWidth: 1, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  total: { fontSize: 17, fontWeight: '900' },
  remove: { padding: 10, marginLeft: 'auto' },
  done: { minHeight: 44, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  doneText: { color: '#fff', fontWeight: '900' },
});
