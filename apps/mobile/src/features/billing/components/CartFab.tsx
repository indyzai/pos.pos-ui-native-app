import { StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../../../components/ui/AppPressable';
import { colors, radii } from '../../../constants/theme';

type Props = { itemCount: number; total: number; onPress: () => void };

/** Floating cart entry point for phone-sized billing, mirroring the web POS CartFab. */
export function CartFab({ itemCount, total, onPress }: Props) {
  return (
    <AppPressable
      accessibilityLabel={itemCount ? 'Open cart: ' + itemCount + ' items' : 'Open cart'}
      onPress={onPress}
      style={s.fab}
    >
      <Text style={s.icon}>🛒</Text>
      {itemCount > 0 && (
        <Text style={s.total}>
          {itemCount} · ₹{total.toFixed(0)}
        </Text>
      )}
      {itemCount > 0 && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{itemCount}</Text>
        </View>
      )}
    </AppPressable>
  );
}

const s = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 18,
    zIndex: 10,
    height: 56,
    minWidth: 56,
    paddingHorizontal: 15,
    borderRadius: radii.large,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    shadowColor: '#303992',
    shadowOpacity: 0.32,
    shadowRadius: 9,
    elevation: 7,
  },
  icon: { fontSize: 20 },
  total: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
