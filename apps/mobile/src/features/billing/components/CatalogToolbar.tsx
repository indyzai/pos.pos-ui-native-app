import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppPressable } from '../../../components/ui/AppPressable';
import { colors, radii } from '../../../constants/theme';
import { categories } from '../data/products';

type Props = {
  search: string;
  category: string;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
};

export function CatalogToolbar({ search, category, onSearch, onCategory }: Props) {
  return (
    <View style={s.toolbar}>
      <View style={s.search}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          value={search}
          onChangeText={onSearch}
          placeholder="Search products or scan barcode"
          placeholderTextColor="#8990A4"
          style={s.searchInput}
        />
        <Text style={s.barcode}>|||</Text>
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
            style={[s.tab, category === item && s.tabSelected]}
          >
            <Text style={[s.tabText, category === item && s.tabTextSelected]}>{item}</Text>
          </AppPressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  toolbar: { backgroundColor: colors.background, paddingTop: 16 },
  search: {
    height: 45,
    marginHorizontal: 16,
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
  barcode: { fontWeight: '900', letterSpacing: -2, color: colors.textSecondary },
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
