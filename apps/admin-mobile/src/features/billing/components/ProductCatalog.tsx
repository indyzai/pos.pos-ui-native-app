import { useState } from 'react';
import { AlertTriangle, PackageSearch, Pill, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { colors } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { useBottomNavigationClearance } from '../../../shared/hooks/useBottomNavigationClearance';
import type { Product } from '../types/billing';
import { pharmacyProductStatus } from '../domain/pharmacyProduct';
import { formatCurrency } from '../../../shared/utils/currency';
import { ProductIcon } from './productIcons';

type Props = {
    category: string;
    products: Product[];
    onAdd: (product: Product) => void;
    defaultTitle?: string;
    pharmacyMode?: boolean;
    currencyCode?: string;
};

export function ProductCatalog({
    category,
    products,
    onAdd,
    defaultTitle = 'Popular products',
    pharmacyMode = false,
    currencyCode = 'INR',
}: Props) {
    const { width } = useWindowDimensions();
    const { isDark, themeColors: c } = useAppTheme();
    const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
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
            <Text style={[s.title, { color: c.text }]}>{category === 'All' ? defaultTitle : category}</Text>
            <View style={[s.grid, { gap }]}>
                {products.map((product) => {
                    const pharmacyStatus = pharmacyProductStatus(product);
                    const disabled = product.stock <= 0 || (pharmacyMode && pharmacyStatus.expired);
                    return (
                        <AppPressable
                            key={product.id}
                            accessibilityLabel={
                                product.stock <= 0
                                    ? `${product.name} is out of stock`
                                    : pharmacyMode && pharmacyStatus.expired
                                      ? `${product.name} is expired`
                                      : `Add ${product.name} to cart`
                            }
                            disabled={disabled}
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
                                    opacity: disabled ? 0.55 : 1,
                                },
                            ]}
                        >
                            <LinearGradient
                                colors={isDark ? ['#2B374A', '#202938'] : [c.primarySoft, c.primarySoft]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[s.image, { height: isTablet ? 112 : 76 }]}
                            >
                                {product.imageUrl && !failedImages.has(product.id) ? (
                                    <Image
                                        source={{ uri: product.imageUrl }}
                                        resizeMode="contain"
                                        style={s.productImage}
                                        onError={() =>
                                            setFailedImages((current) => {
                                                const next = new Set(current);
                                                next.add(product.id);
                                                return next;
                                            })
                                        }
                                    />
                                ) : (
                                    <ProductIcon iconKey={product.details?.iconKey} size={36} />
                                )}
                                <AppPressable
                                    accessibilityLabel={`Add ${product.name} to cart`}
                                    disabled={disabled}
                                    onPress={() => onAdd(product)}
                                    style={[s.add, { backgroundColor: c.primary, borderColor: c.primary }]}
                                >
                                    <Plus size={18} color="#FFFFFF" strokeWidth={2.8} />
                                </AppPressable>
                            </LinearGradient>
                            <Text numberOfLines={1} style={[s.name, { color: c.text }]}>
                                {product.name}
                            </Text>
                            {product.sku ? (
                                <Text numberOfLines={1} style={[s.sku, { color: c.textSecondary }]}>
                                    SKU · {product.sku}
                                </Text>
                            ) : null}
                            {pharmacyMode && (product.details?.batchNumber || product.details?.expiryDate) ? (
                                <View style={s.pharmacyMeta}>
                                    <Pill size={10} color={c.textSecondary} />
                                    <Text numberOfLines={1} style={[s.metaText, { color: c.textSecondary }]}>
                                        {[
                                            product.details?.batchNumber &&
                                                `Batch ${product.details.batchNumber}`,
                                            product.details?.expiryDate,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                    {(pharmacyStatus.expired || pharmacyStatus.expiringSoon) && (
                                        <AlertTriangle size={10} color={c.error} />
                                    )}
                                </View>
                            ) : null}
                            {pharmacyMode && (product.details?.schedule || product.details?.scheduledDrug) ? (
                                <Text style={[s.schedule, { color: c.error, backgroundColor: c.errorSoft }]}>
                                    {product.details.schedule || 'Scheduled'}
                                </Text>
                            ) : null}
                            <View style={s.footer}>
                                <Text style={[s.price, { color: c.primary }]}>
                                    {formatCurrency(product.price, currencyCode)}
                                </Text>
                                <Text
                                    style={[
                                        s.stock,
                                        { color: c.textSecondary, backgroundColor: c.surfaceMuted },
                                        product.stock < 10 && {
                                            color: c.error,
                                            backgroundColor: c.errorSoft,
                                        },
                                    ]}
                                >
                                    {product.stock} left
                                </Text>
                            </View>
                        </AppPressable>
                    );
                })}
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
    productImage: { width: '76%', height: '76%' },
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
    sku: { fontSize: 8, fontWeight: '700', marginTop: 3 },
    pharmacyMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
    metaText: { flex: 1, fontSize: 8, fontWeight: '700' },
    schedule: {
        alignSelf: 'flex-start',
        fontSize: 8,
        fontWeight: '900',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 5,
        marginTop: 4,
    },
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
