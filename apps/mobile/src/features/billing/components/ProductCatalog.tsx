import { StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../../../components/ui/AppPressable';
import { colors } from '../../../constants/theme';
import type { Product } from '../types/billing';

type Props = { category: string; products: Product[]; onAdd: (product: Product) => void };

export function ProductCatalog({ category, products, onAdd }: Props) {
  return (
    <View style={s.catalog}>
      <Text style={s.title}>{category === 'All' ? 'Popular products' : category}</Text>
      <View style={s.grid}>
        {products.map((product) => (
          <AppPressable key={product.id} onPress={() => onAdd(product)} style={s.card}>
            <View style={[s.image, { backgroundColor: product.color }]}>
              <Text style={s.emoji}>{product.emoji}</Text>
              <AppPressable onPress={() => onAdd(product)} style={s.add}>
                <Text style={s.addText}>+</Text>
              </AppPressable>
            </View>
            <Text numberOfLines={1} style={s.name}>
              {product.name}
            </Text>
            <View style={s.footer}>
              <Text style={s.price}>₹{product.price.toFixed(2)}</Text>
              <Text style={[s.stock, product.stock < 10 && s.lowStock]}>{product.stock} left</Text>
            </View>
          </AppPressable>
        ))}
      </View>
      {!products.length && (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>⌕</Text>
          <Text style={s.emptyText}>No products found</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  catalog: { paddingHorizontal: 16, paddingBottom: 96, paddingTop: 8 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 9 },
  card: {
    width: '48.4%',
    padding: 8,
    borderRadius: 14,
    backgroundColor: colors.surface,
    shadowColor: '#303A7A',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  image: { height: 76, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 38 },
  add: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  addText: { fontSize: 19, lineHeight: 21, color: '#FFFFFF' },
  name: { fontSize: 12, fontWeight: '800', color: '#30344B', marginTop: 9 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  price: { fontSize: 13, fontWeight: '900', color: colors.primary },
  stock: {
    fontSize: 9,
    fontWeight: '700',
    color: '#798096',
    backgroundColor: '#F0F2F7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 7,
  },
  lowStock: { color: colors.error, backgroundColor: colors.errorSoft },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 42, color: '#B2B7C8' },
  emptyText: { fontSize: 13, fontWeight: '700', color: '#858BA0' },
});
