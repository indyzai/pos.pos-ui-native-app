import { AlertTriangle, Barcode, PackageX } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { InventoryProduct } from '../types';

export function InventoryCard({ product, onPress }: { product: InventoryProduct; onPress: () => void }) {
  const { themeColors: c } = useAppTheme();
  const out = product.stock <= 0;
  const low = !out && product.stock < 30;
  const statusColor = out ? c.error : low ? '#D97706' : '#16A34A';
  return (
    <AppPressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}
    >
      <View style={[styles.accent, { backgroundColor: statusColor }]} />
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: product.color || c.primarySoft }]}>
          <Text style={styles.emoji}>{product.emoji || '📦'}</Text>
        </View>
        <View style={styles.details}>
          <Text numberOfLines={1} style={[styles.name, { color: c.text }]}>
            {product.name}
          </Text>
          <Text style={[styles.category, { color: c.textSecondary }]}>{product.category}</Text>
        </View>
        <Text style={[styles.price, { color: c.text }]}>₹{product.price.toFixed(2)}</Text>
      </View>
      <View style={[styles.footer, { borderTopColor: c.outlineMuted }]}>
        <View style={styles.meta}>
          {out ? (
            <PackageX size={15} color={statusColor} />
          ) : low ? (
            <AlertTriangle size={15} color={statusColor} />
          ) : null}
          <Text style={[styles.stock, { color: statusColor }]}>
            {out ? 'Out of stock' : `${product.stock} in stock`}
          </Text>
        </View>
        {product.barcode ? (
          <View style={styles.meta}>
            <Barcode size={14} color={c.textSecondary} />
            <Text style={[styles.barcode, { color: c.textSecondary }]}>{product.barcode}</Text>
          </View>
        ) : null}
      </View>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 250, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  accent: { height: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  avatar: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 23 },
  details: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800' },
  category: { marginTop: 4, fontSize: 12 },
  price: { fontSize: 14, fontWeight: '900' },
  footer: {
    minHeight: 42,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stock: { fontSize: 11, fontWeight: '800' },
  barcode: { maxWidth: 100, fontSize: 10 },
});
