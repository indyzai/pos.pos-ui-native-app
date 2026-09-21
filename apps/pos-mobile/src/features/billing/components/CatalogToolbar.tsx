import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { BarChart3, Plus, ScanBarcode, Search, X } from 'lucide-react-native';
import { AppPressable } from '@indyzai/pos-ui-native';
import { colors, radii } from '@indyzai/pos-ui-native/tokens';
import { useAppTheme } from '@indyzai/pos-ui-native';

type Props = {
  categories: string[];
  search: string;
  category: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onScan: () => void;
  scanEnabled?: boolean;
  onAddProduct?: () => void;
  statsVisible: boolean;
  onToggleStats?: () => void;
  searchPlaceholder?: string;
};

export function CatalogToolbar({
  categories,
  search,
  category,
  onSearch,
  onCategory,
  onScan,
  scanEnabled = true,
  onAddProduct,
  statsVisible,
  onToggleStats,
  searchPlaceholder = 'Search products',
}: Props) {
  const { themeColors: c } = useAppTheme();
  const { width } = useWindowDimensions();
  const isPhone = width < 700;
  const iconSize = isPhone ? 18 : 21;

  return (
    <View style={[s.toolbar, isPhone && s.toolbarPhone, { backgroundColor: c.background }]}>
      <View style={[s.searchRow, isPhone && s.searchRowPhone]}>
        <View
          style={[s.search, isPhone && s.searchPhone, { backgroundColor: c.surface, borderColor: c.outline }]}
        >
          <Search size={isPhone ? 17 : 19} color={c.primary} strokeWidth={2.4} />
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={c.textSecondary}
            style={[s.searchInput, isPhone && s.searchInputPhone, { color: c.text }]}
          />
          {search.length > 0 && (
            <AppPressable
              accessibilityLabel="Clear product search"
              onPress={() => onSearch('')}
              style={[s.clearButton, isPhone && s.clearButtonPhone, { backgroundColor: c.surfaceMuted }]}
            >
              <X size={isPhone ? 13 : 15} color={c.textSecondary} strokeWidth={2.5} />
            </AppPressable>
          )}
        </View>

        {(scanEnabled || onAddProduct || onToggleStats) && (
          <View style={[s.actionGroup, isPhone && s.actionGroupPhone]}>
            {scanEnabled && (
              <AppPressable
                accessibilityLabel="Scan barcode or QR code"
                onPress={onScan}
                hitSlop={isPhone ? { top: 6, bottom: 6, left: 3, right: 3 } : undefined}
                style={[s.actionButton, isPhone && s.actionButtonPhone, { backgroundColor: c.primarySoft }]}
              >
                <ScanBarcode size={iconSize} color={c.primary} strokeWidth={2.25} />
              </AppPressable>
            )}
            {onAddProduct ? (
              <AppPressable
                accessibilityLabel="Add a new product"
                onPress={onAddProduct}
                hitSlop={isPhone ? { top: 6, bottom: 6, left: 3, right: 3 } : undefined}
                style={[s.actionButton, isPhone && s.actionButtonPhone, { backgroundColor: c.primarySoft }]}
              >
                <Plus size={isPhone ? 19 : 22} color={c.primary} strokeWidth={2.5} />
              </AppPressable>
            ) : null}
            {onToggleStats ? (
              <AppPressable
                accessibilityLabel={statsVisible ? 'Hide session statistics' : 'Show session statistics'}
                onPress={onToggleStats}
                hitSlop={isPhone ? { top: 6, bottom: 6, left: 3, right: 3 } : undefined}
                style={[
                  s.actionButton,
                  isPhone && s.actionButtonPhone,
                  { backgroundColor: statsVisible ? c.primary : c.primarySoft },
                ]}
              >
                <BarChart3 size={iconSize} color={statsVisible ? '#FFFFFF' : c.primary} strokeWidth={2.4} />
              </AppPressable>
            ) : null}
          </View>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[s.categoryScroll, isPhone && s.categoryScrollPhone]}
        contentContainerStyle={[s.tabs, isPhone && s.tabsPhone]}
      >
        {categories.map((item) => (
          <AppPressable
            key={item}
            onPress={() => onCategory(item)}
            style={[
              s.tab,
              isPhone && s.tabPhone,
              { backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted },
              category === item && { backgroundColor: c.primarySoft, borderColor: c.primary },
            ]}
          >
            <Text
              style={[
                s.tabText,
                isPhone && s.tabTextPhone,
                { color: c.textSecondary },
                category === item && { color: c.primary },
              ]}
            >
              {item}
            </Text>
          </AppPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { backgroundColor: colors.background, paddingTop: 16 },
  toolbarPhone: { paddingTop: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  searchRowPhone: { gap: 6, paddingHorizontal: 12 },
  search: {
    flex: 1,
    height: 44,
    paddingHorizontal: 13,
    borderRadius: radii.medium,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  searchPhone: {
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 14, color: colors.text, marginLeft: 9 },
  searchInputPhone: { fontSize: 13, marginLeft: 7 },
  clearButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  clearButtonPhone: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionGroupPhone: {
    gap: 6,
  },
  actionButton: {
    height: 44,
    width: 44,
    borderRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  actionButtonPhone: {
    height: 38,
    width: 38,
    borderRadius: 10,
  },
  categoryScroll: { height: 60 },
  categoryScrollPhone: { height: 48 },
  tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  tabsPhone: { paddingHorizontal: 12, gap: 6 },
  tab: {
    height: 38,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#E9ECF5',
  },
  tabPhone: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  tabSelected: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: '#677087' },
  tabTextPhone: { fontSize: 11, fontWeight: '600' },
  tabTextSelected: { color: '#FFFFFF' },
});
