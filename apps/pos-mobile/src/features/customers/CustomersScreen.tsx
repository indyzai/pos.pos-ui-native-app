import { TeamScreen } from '@indyzai/feature-organization/team-screen';
import { usePermissions } from '@indyzai/pos-auth/permissions';
import { teamApi } from '../team/teamApi';
import { CustomersScreen as SharedCustomersScreen } from '@indyzai/feature-customers/screen';
import { customersApi } from './customersApi';

export function CustomersScreen() {
  const { can } = usePermissions('pos');
  return (
    <SharedCustomersScreen
      api={customersApi}
      staffScreen={can('manager.actions') ? <TeamScreen api={teamApi} surface="pos" /> : undefined}
    />
  );
}
