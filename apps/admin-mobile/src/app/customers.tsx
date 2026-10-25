import { useLocalSearchParams } from 'expo-router';
import type { PartyType } from '@indyzai/feature-customers';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { CustomersScreen } from '../features/customers/CustomersScreen';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
export default function ContactsRoute() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = ['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'TECHNICIAN', 'SCRAP_VENDOR'].includes(
    params.type || '',
  )
    ? (params.type as PartyType)
    : undefined;
  return (
    <BottomNavigationProvider>
      <CustomersScreen initialType={initialType} onlyType={initialType} />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
