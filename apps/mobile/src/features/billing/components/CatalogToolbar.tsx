import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppPressable } from '../../../components/ui/AppPressable';
import { colors, radii } from '../../../constants/theme';
import { useAppTheme } from '../../../contexts/ThemeContext';
import { categories } from '../data/products';

type Props = {
  search: string;
  category: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onScan: () => void;
};

export function CatalogToolbar({ search, category, onSearch, onCategory, onScan }: Props) {
  const { themeColors: c } = useAppTheme();
  return (
    <View style={[s.toolbar, { backgroundColor: c.background }]}>
      <View style={s.searchRow}>
        <View style={[s.search, { backgroundColor: c.surface, borderColor: c.outline }]}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder="Search products"
            placeholderTextColor="#8990A4"
            style={[s.searchInput, { color: c.text }]}
          />
          {search.length > 0 && (
            <AppPressable
              accessibilityLabel="Clear product search"
              onPress={() => onSearch('')}
              style={[s.clearButton, { backgroundColor: c.surfaceMuted }]}
            >
              <Text style={[s.clearText, { color: c.textSecondary }]}>×</Text>
            </AppPressable>
          )}
        </View>
        <AppPressable
          accessibilityLabel="Scan barcode or QR code"
          onPress={onScan}
          style={[s.scanButton, { backgroundColor: c.primarySoft }]}
        >
          <Text style={[s.scanIcon, { color: c.primary }]}>▥</Text>
          <Text style={[s.scanText, { color: c.primary }]}>Scan</Text>
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
              { backgroundColor: c.surfaceMuted },
              category === item && { backgroundColor: c.primary },
            ]}
          >
            <Text style={[s.tabText, { color: c.textSecondary }, category === item && s.tabTextSelected]}>
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
  searchIcon: { fontSize: 25, lineHeight: 27, color: colors.primary, marginRight: 6 },
  searchInput: { flex: 1, height: '100%', fontSize: 13, color: colors.text },
  clearButton: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.surfaceMuted,
  },
  clearText: { color: colors.textSecondary, fontSize: 19, lineHeight: 21 },
  scanButton: {
    height: 45,
    minWidth: 54,
    paddingHorizontal: 9,
    borderRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  scanIcon: { color: colors.primary, fontSize: 18, lineHeight: 19, fontWeight: '900' },
  scanText: { color: colors.primary, fontSize: 9, fontWeight: '900', marginTop: 1 },
  categoryScroll: { height: 64 },
  tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  tab: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#E9ECF5',
  },
  tabSelected: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: '#677087' },
  tabTextSelected: { color: '#FFFFFF' },
});
