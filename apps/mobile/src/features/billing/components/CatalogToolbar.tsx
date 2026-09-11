import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BarChart3, Plus, ScanBarcode, Search, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { colors, radii } from '../../../config/theme';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';

type Props = {
  categories: string[];
  search: string;
  category: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onScan: () => void;
  scanEnabled?: boolean;
  onAddProduct: () => void;
  statsVisible: boolean;
  onToggleStats: () => void;
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
  return (
    <View style={[s.toolbar, { backgroundColor: c.background }]}>
      <View style={s.searchRow}>
        <View style={[s.search, { backgroundColor: c.surface, borderColor: c.outline }]}>
          <Search size={19} color={c.primary} strokeWidth={2.4} />
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder={searchPlaceholder}
            placeholderTextColor={c.textSecondary}
            style={[s.searchInput, { color: c.text }]}
          />
          {search.length > 0 && (
            <AppPressable
              accessibilityLabel="Clear product search"
              onPress={() => onSearch('')}
              style={[s.clearButton, { backgroundColor: c.surfaceMuted }]}
            >
              <X size={15} color={c.textSecondary} strokeWidth={2.5} />
            </AppPressable>
          )}
        </View>
        {scanEnabled && (
          <AppPressable
            accessibilityLabel="Scan barcode or QR code"
            onPress={onScan}
            style={[s.scanButton, { backgroundColor: c.primarySoft }]}
          >
            <ScanBarcode size={22} color={c.primary} strokeWidth={2.25} />
          </AppPressable>
        )}
        <AppPressable
          accessibilityLabel="Add a new product"
          onPress={onAddProduct}
          style={[s.scanButton, { backgroundColor: c.primarySoft }]}
        >
          <Plus size={22} color={c.primary} strokeWidth={2.5} />
        </AppPressable>
        <AppPressable
          accessibilityLabel={statsVisible ? 'Hide session statistics' : 'Show session statistics'}
          onPress={onToggleStats}
          style={[s.scanButton, { backgroundColor: statsVisible ? c.primary : c.primarySoft }]}
        >
          <BarChart3 size={21} color={statsVisible ? '#FFFFFF' : c.primary} strokeWidth={2.4} />
        </AppPressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.categoryScroll}
        contentContainerStyle={s.tabs}
      >
        {categories.map((item) => (
          <AppPressable
            key={item}
            onPress={() => onCategory(item)}
            style={[
              s.tab,
              { backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted },
              category === item && { backgroundColor: c.primarySoft, borderColor: c.primary },
            ]}
          >
            <Text style={[s.tabText, { color: c.textSecondary }, category === item && { color: c.primary }]}>
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
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  search: {
    flex: 1,
    height: 45,
    paddingHorizontal: 13,
    borderRadius: radii.medium,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 14, color: colors.text, marginLeft: 9 },
  clearButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  scanButton: {
    height: 45,
    width: 45,
    borderRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  categoryScroll: { height: 64 },
  tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  tab: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#E9ECF5',
  },
  tabSelected: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: '#677087' },
  tabTextSelected: { color: '#FFFFFF' },
});
