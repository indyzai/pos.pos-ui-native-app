import { StyleSheet, Text, View } from 'react-native';
import { MapPin, ShoppingBag, UtensilsCrossed } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';

export type RestaurantOrderMode = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
const options = [
    { value: 'DINE_IN' as const, label: 'Dine in', icon: UtensilsCrossed },
    { value: 'TAKEAWAY' as const, label: 'Takeaway', icon: ShoppingBag },
    { value: 'DELIVERY' as const, label: 'Delivery', icon: MapPin },
];
export function RestaurantOrderModeSelector({
    value,
    onChange,
}: {
    value: RestaurantOrderMode;
    onChange: (value: RestaurantOrderMode) => void;
}) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[s.wrap, { backgroundColor: c.background }]}>
            {options.map(({ value: option, label, icon: Icon }) => {
                const active = value === option;
                return (
                    <AppPressable
                        key={option}
                        onPress={() => onChange(option)}
                        style={[s.option, { backgroundColor: active ? c.primary : c.surfaceMuted }]}
                    >
                        <Icon size={15} color={active ? '#FFFFFF' : c.textSecondary} />
                        <Text style={[s.text, { color: active ? '#FFFFFF' : c.textSecondary }]}>{label}</Text>
                    </AppPressable>
                );
            })}
        </View>
    );
}
const s = StyleSheet.create({
    wrap: { flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingTop: 8 },
    option: {
        flex: 1,
        height: 39,
        borderRadius: 11,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    text: { fontSize: 10, fontWeight: '900' },
});
