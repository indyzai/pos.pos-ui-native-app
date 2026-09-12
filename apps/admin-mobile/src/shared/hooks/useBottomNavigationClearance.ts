import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BOTTOM_NAVIGATION_HEIGHT = 66;

export function useBottomNavigationClearance(extraSpace = 20): number {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const navigationVisible = !(width >= 700 && width > height);

    return navigationVisible ? BOTTOM_NAVIGATION_HEIGHT + insets.bottom + extraSpace : extraSpace;
}
