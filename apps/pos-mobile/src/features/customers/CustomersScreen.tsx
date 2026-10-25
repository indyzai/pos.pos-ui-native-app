import { teamApi } from '../team/teamApi';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { usePermissions } from '@indyzai/pos-auth/permissions';
import { CustomersScreen as SharedCustomersScreen } from '@indyzai/feature-customers/screen';
import type { PartyType } from '@indyzai/feature-customers';
import { customersApi } from './customersApi';
export function CustomersScreen({
  initialType,
  onlyType,
}: {
  initialType?: PartyType;
  onlyType?: PartyType;
}) {
  const { can } = usePermissions('pos');
  const auth = useAuthSession();
  return (
    <SharedCustomersScreen
      api={customersApi}
      manageAccounts={can('manager.actions') || can('organization.manage')}
      currency={String(auth.session?.organization?.settings.currency || 'INR')}
      organizationDomain={auth.session?.organization?.domain}
      refreshStaff={can('manager.actions') ? teamApi.refresh : undefined}
      initialType={onlyType || initialType}
      onlyType={onlyType}
      staffLogin={
        can('manager.actions')
          ? { domain: auth.session?.organization?.domain, allowManager: false }
          : undefined
      }
    />
  );
}
