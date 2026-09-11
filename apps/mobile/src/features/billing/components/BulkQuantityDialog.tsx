import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { PackagePlus, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CartCustomization, Product } from '../types/billing';
import { resolveWholesaleTier, wholesaleTiers } from '../domain/wholesalePricing';
import { formatCurrency } from '../../../shared/utils/currency';

export function BulkQuantityDialog({
  product,
  onClose,
  onAdd,
  currencyCode = 'INR',
}: {
  product?: Product;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, customization?: CartCustomization) => void;
  currencyCode?: string;
}) {
  const { themeColors: c } = useAppTheme();
  const [quantity, setQuantity] = useState('');
  useEffect(() => {
    if (product) setQuantity('');
  }, [product]);
  const amount = Math.floor(Number(quantity));
  const valid = !!product && amount > 0 && amount <= product.stock;
  const tiers = product ? wholesaleTiers(product) : [];
  const selectedTier = product ? resolveWholesaleTier(product, amount) : undefined;
  return (
    <Modal transparent visible={!!product} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.dialog, { backgroundColor: c.surface, borderColor: c.outline }]}>
          <View style={s.header}>
            <View style={s.heading}>
              <PackagePlus size={20} color={c.primary} />
              <View style={s.copy}>
                <Text numberOfLines={1} style={[s.title, { color: c.text }]}>
                  {product?.name}
                </Text>
                <Text style={[s.meta, { color: c.textSecondary }]}>
                  {product?.stock || 0} available · {formatCurrency(product?.price || 0, currencyCode)}
                </Text>
              </View>
            </View>
            <AppPressable onPress={onClose} style={[s.close, { backgroundColor: c.surfaceMuted }]}>
              <X size={17} color={c.text} />
            </AppPressable>
          </View>
          <Text style={[s.label, { color: c.textSecondary }]}>Bulk quantity</Text>
          {tiers.length > 1 && (
            <View style={s.tiers}>
              {tiers.map((tier) => {
                const active = selectedTier?.minimumQuantity === tier.minimumQuantity;
                return (
                  <View
                    key={tier.minimumQuantity}
                    style={[
                      s.tier,
                      {
                        borderColor: active ? c.primary : c.outlineMuted,
                        backgroundColor: active ? c.primarySoft : c.surfaceMuted,
                      },
                    ]}
                  >
                    <Text style={[s.tierPrice, { color: active ? c.primary : c.text }]}>
                      {formatCurrency(tier.price, currencyCode)}
                    </Text>
                    <Text style={[s.tierQty, { color: c.textSecondary }]}>{tier.minimumQuantity}+</Text>
                  </View>
                );
              })}
            </View>
          )}
          <TextInput
            autoFocus
            value={quantity}
            onChangeText={(value) => setQuantity(value.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="Enter quantity"
            placeholderTextColor={c.textSecondary}
            style={[
              s.input,
              {
                color: c.text,
                backgroundColor: c.background,
                borderColor: valid || !quantity ? c.outline : c.error,
              },
            ]}
          />
          {quantity && !valid ? (
            <Text style={[s.error, { color: c.error }]}>Enter between 1 and {product?.stock || 0}.</Text>
          ) : null}
          <AppPressable
            disabled={!valid}
            onPress={() => {
              if (product && valid) {
                const tier = resolveWholesaleTier(product, amount);
                onAdd(product, amount, {
                  key: `wholesale:${tier.minimumQuantity}`,
                  label: `${amount} units · ${formatCurrency(tier.price, currencyCode)} each`,
                  priceAdjustment: tier.price - product.price,
                  metadata: { minimumQuantity: tier.minimumQuantity, unitPrice: tier.price },
                });
                onClose();
              }
            }}
            style={[s.add, { backgroundColor: c.primary, opacity: valid ? 1 : 0.45 }]}
          >
            <Text style={s.addText}>
              {valid
                ? `Add ${amount} · ${formatCurrency((selectedTier?.price || 0) * amount, currencyCode)}`
                : 'Add to order'}
            </Text>
          </AppPressable>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,12,22,.55)' },
  dialog: { width: '100%', maxWidth: 410, borderWidth: 1, borderRadius: 22, padding: 17 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  copy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 3, fontSize: 10 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '800', marginBottom: 6 },
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tier: { minWidth: 58, borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  tierPrice: { fontSize: 11, fontWeight: '900' },
  tierQty: { fontSize: 8, fontWeight: '700', marginTop: 1 },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 17,
    fontWeight: '800',
  },
  error: { fontSize: 10, marginTop: 5 },
  add: { height: 49, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  addText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
