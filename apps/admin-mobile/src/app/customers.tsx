import { TeamScreen } from '@indyzai/feature-organization/team-screen';
import { usePermissions } from '@indyzai/pos-auth/permissions';
import { teamApi } from '../features/team/teamApi';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { CustomersScreen } from '@indyzai/feature-customers/screen';
import { customersApi } from '../features/customers/customersApi';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';

export default function CustomersRoute() {
  const { can } = usePermissions('admin');
  return (
    <BottomNavigationProvider>
      <CustomersScreen
        api={customersApi}
        staffScreen={can('users.manage') ? <TeamScreen api={teamApi} surface="admin" /> : undefined}
      />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
