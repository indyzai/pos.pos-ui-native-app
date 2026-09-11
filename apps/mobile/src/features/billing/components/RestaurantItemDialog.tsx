import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Minus, Plus, UtensilsCrossed, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CartCustomization, Product } from '../types/billing';
import { formatCurrency } from '../../../shared/utils/currency';
import { restaurantModifiers, toggleRestaurantModifier } from '../domain/restaurantModifiers';

export function RestaurantItemDialog({
  product,
  onClose,
  onAdd,
  currencyCode = 'INR',
}: {
  product?: Product;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, customization: CartCustomization) => void;
  currencyCode?: string;
}) {
  const { themeColors: c } = useAppTheme();
  const [selected, setSelected] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const modifiers = useMemo(() => restaurantModifiers(product?.details), [product?.details]);
  useEffect(() => {
    if (product) {
      setSelected([]);
      setQuantity(1);
      setNotes('');
    }
  }, [product]);
  const chosen = useMemo(() => modifiers.filter((item) => selected.includes(item.id)), [selected]);
  const adjustment = chosen.reduce((sum, item) => sum + (item.price || 0), 0);
  const toggle = (id: string) => {
    const modifier = modifiers.find((item) => item.id === id);
    if (modifier) setSelected((current) => toggleRestaurantModifier(current, modifier, modifiers));
  };
  const customization: CartCustomization = {
    key: [...selected].sort().join(',') + `:${notes.trim().toLowerCase()}`,
    label: chosen.map((item) => item.label).join(', ') || undefined,
    priceAdjustment: adjustment,
    notes: notes.trim() || undefined,
    metadata: { modifiers: chosen.map(({ id, label, group, price }) => ({ id, label, group, price })) },
  };
  return (
    <Modal transparent visible={!!product} animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.surface }]}>
          <View style={s.header}>
            <View style={s.heading}>
              <UtensilsCrossed size={20} color={c.primary} />
              <View>
                <Text style={[s.title, { color: c.text }]}>{product?.name}</Text>
                <Text style={[s.meta, { color: c.textSecondary }]}>Customize menu item</Text>
              </View>
            </View>
            <AppPressable onPress={onClose} style={[s.close, { backgroundColor: c.surfaceMuted }]}>
              <X size={18} color={c.text} />
            </AppPressable>
          </View>
          <ScrollView contentContainerStyle={s.body}>
            {modifiers.length > 0 && <Text style={[s.label, { color: c.textSecondary }]}>Options</Text>}
            {modifiers.length > 0 && (
              <View style={s.options}>
                {modifiers.map((item) => {
                  const active = selected.includes(item.id);
                  return (
                    <AppPressable
                      key={item.id}
                      onPress={() => toggle(item.id)}
                      style={[
                        s.option,
                        {
                          backgroundColor: active ? c.primarySoft : c.background,
                          borderColor: active ? c.primary : c.outline,
                        },
                      ]}
                    >
                      <Text style={[s.optionText, { color: active ? c.primary : c.text }]}>
                        {item.label}
                        {item.price ? ` · +${formatCurrency(item.price, currencyCode)}` : ''}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
            )}
            <Text style={[s.label, { color: c.textSecondary }]}>Kitchen notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="No coriander, serve hot…"
              placeholderTextColor={c.textSecondary}
              style={[s.notes, { color: c.text, backgroundColor: c.background, borderColor: c.outline }]}
            />
            <View style={s.qty}>
              <AppPressable
                onPress={() => setQuantity((value) => Math.max(1, value - 1))}
                style={[s.qtyButton, { backgroundColor: c.surfaceMuted }]}
              >
                <Minus size={17} color={c.text} />
              </AppPressable>
              <Text style={[s.qtyValue, { color: c.text }]}>{quantity}</Text>
              <AppPressable
                onPress={() => setQuantity((value) => Math.min(product?.stock || 1, value + 1))}
                style={[s.qtyButton, { backgroundColor: c.surfaceMuted }]}
              >
                <Plus size={17} color={c.text} />
              </AppPressable>
            </View>
          </ScrollView>
          <AppPressable
            onPress={() => {
              if (product) {
                onAdd(product, quantity, customization);
                onClose();
              }
            }}
            style={[s.add, { backgroundColor: c.primary }]}
          >
            <Text style={s.addText}>
              Add {quantity} · {formatCurrency(((product?.price || 0) + adjustment) * quantity, currencyCode)}
            </Text>
          </AppPressable>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,12,22,.55)' },
  sheet: { maxHeight: '82%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 17 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { fontSize: 16, fontWeight: '900' },
  meta: { fontSize: 10, marginTop: 2 },
  close: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { paddingVertical: 16 },
  label: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 16 },
  option: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  optionText: { fontSize: 10, fontWeight: '800' },
  notes: { minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 11, textAlignVertical: 'top' },
  qty: { marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  qtyButton: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 17, fontWeight: '900' },
  add: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
