import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { ReportsScreen } from '../features/reports/ReportsScreen';

export default function ReportsRoute() {
    return (
        <BottomNavigationProvider>
            <ReportsScreen />
            <BottomNavigation />
        </BottomNavigationProvider>
    );
}
