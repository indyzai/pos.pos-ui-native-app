import { PackageSearch, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { colors } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { useBottomNavigationClearance } from '../../../shared/hooks/useBottomNavigationClearance';
import type { Product } from '../types/billing';

type Props = { category: string; products: Product[]; onAdd: (product: Product) => void };

export function ProductCatalog({ category, products, onAdd }: Props) {
  const { width } = useWindowDimensions();
  const { isDark, themeColors: c } = useAppTheme();
  const isTablet = width >= 700;
  const bottomClearance = useBottomNavigationClearance();
  const columns = width >= 1024 ? 5 : isTablet ? 4 : 2;
  const horizontalPadding = isTablet ? 28 : 16;
  const gap = isTablet ? 14 : 9;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columns - 1)) / columns;
  return (
    <View
      style={[
        s.catalog,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: bottomClearance,
          backgroundColor: c.background,
        },
      ]}
    >
      <Text style={[s.title, { color: c.text }]}>{category === 'All' ? 'Popular products' : category}</Text>
      <View style={[s.grid, { gap }]}>
        {products.map((product) => (
          <AppPressable
            key={product.id}
            onPress={() => onAdd(product)}
            style={[
              s.card,
              {
                width: cardWidth,
                backgroundColor: c.surface,
                borderColor: c.outlineMuted,
                boxShadow: isDark
                  ? '0px 3px 12px rgba(0, 0, 0, 0.24)'
                  : '0px 3px 10px rgba(48, 58, 122, 0.05)',
              },
            ]}
          >
            <LinearGradient
              colors={isDark ? ['#2B374A', '#202938'] : [product.color, product.color]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.image, { height: isTablet ? 112 : 76 }]}
            >
              <Text style={s.emoji}>{product.emoji}</Text>
              <AppPressable
                accessibilityLabel={`Add ${product.name} to cart`}
                onPress={() => onAdd(product)}
                style={[s.add, { backgroundColor: c.primarySoft, borderColor: c.primary }]}
              >
                <Plus size={18} color={c.primary} strokeWidth={2.8} />
              </AppPressable>
            </LinearGradient>
            <Text numberOfLines={1} style={[s.name, { color: c.text }]}>
              {product.name}
            </Text>
            <View style={s.footer}>
              <Text style={[s.price, { color: c.primary }]}>₹{product.price.toFixed(2)}</Text>
              <Text
                style={[
                  s.stock,
                  { color: c.textSecondary, backgroundColor: c.surfaceMuted },
                  product.stock < 10 && { color: c.error, backgroundColor: c.errorSoft },
                ]}
              >
                {product.stock} left
              </Text>
            </View>
          </AppPressable>
        ))}
      </View>
      {!products.length && (
        <View style={s.empty}>
          <PackageSearch size={42} color={c.textSecondary} strokeWidth={1.7} />
          <Text style={[s.emptyText, { color: c.textSecondary }]}>No products found</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  catalog: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  card: {
    padding: 8,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
  },
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
  emptyText: { fontSize: 13, fontWeight: '700', color: '#858BA0' },
});
