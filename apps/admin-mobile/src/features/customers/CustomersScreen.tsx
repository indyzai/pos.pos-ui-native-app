import { teamApi } from '../team/teamApi';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { usePermissions } from '@indyzai/pos-auth/permissions';
import { CustomersScreen as SharedCustomersScreen } from '@indyzai/feature-customers/screen';
import type { PartyType } from '@indyzai/feature-customers';
import { customersApi } from './customersApi';
export function CustomersScreen({ initialType }: { initialType?: PartyType }) {
  const { can } = usePermissions('admin');
  const auth = useAuthSession();
  return (
    <SharedCustomersScreen
      api={customersApi}
      organizationDomain={auth.session?.organization?.domain}
      refreshStaff={can('users.manage') ? teamApi.refresh : undefined}
      initialType={initialType}
      staffLogin={
        can('users.manage') ? { domain: auth.session?.organization?.domain, allowManager: true } : undefined
      }
    />
  );
}
