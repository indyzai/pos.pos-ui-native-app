import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Armchair } from 'lucide-react-native';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import type { RestaurantTable } from './types';
export function RestaurantTableSelector({
  tables,
  selectedId,
  onSelect,
}: {
  tables: RestaurantTable[];
  selectedId?: string;
  onSelect: (table: RestaurantTable) => void;
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <View style={[s.wrap, { backgroundColor: c.background }]}>
      <Text style={[s.label, { color: c.textSecondary }]}>Select table for dine-in</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.list}>
        {tables.map((table) => {
          const active = table.id === selectedId;
          const unavailable = !['AVAILABLE', 'FREE'].includes(table.status.toUpperCase()) && !active;
          return (
            <AppPressable
              key={table.id}
              disabled={unavailable}
              onPress={() => onSelect(table)}
              style={[
                s.table,
                {
                  borderColor: active ? c.primary : c.outlineMuted,
                  backgroundColor: active ? c.primarySoft : c.surface,
                  opacity: unavailable ? 0.45 : 1,
                },
              ]}
            >
              <Armchair size={15} color={active ? c.primary : c.textSecondary} />
              <Text style={[s.name, { color: active ? c.primary : c.text }]}>{table.name}</Text>
              <Text style={[s.capacity, { color: c.textSecondary }]}>{table.capacity} seats</Text>
            </AppPressable>
          );
        })}
        {!tables.length && (
          <Text style={[s.empty, { color: c.textSecondary }]}>No tables available locally.</Text>
        )}
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { paddingTop: 8 },
  label: {
    paddingHorizontal: 16,
    marginBottom: 6,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  list: { paddingHorizontal: 16, gap: 7 },
  table: {
    minWidth: 104,
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  name: { fontSize: 10, fontWeight: '900' },
  capacity: { fontSize: 8 },
  empty: { paddingVertical: 14, fontSize: 11 },
});
