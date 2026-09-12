import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react-native';

export type CenterNavigationItem = { label: string; icon: LucideIcon; badge?: number; onPress: () => void };
type NavigationContextValue = {
    centerItem: CenterNavigationItem | null;
    setCenterItem: (item: CenterNavigationItem | null) => void;
};
const NavigationContext = createContext<NavigationContextValue | null>(null);

export function BottomNavigationProvider({ children }: { children: ReactNode }) {
    const [centerItem, setCenterItem] = useState<CenterNavigationItem | null>(null);
    const value = useMemo(() => ({ centerItem, setCenterItem }), [centerItem]);
    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useBottomNavigation() {
    const context = useContext(NavigationContext);
    if (!context) throw new Error('useBottomNavigation must be used within BottomNavigationProvider');
    return context;
}
