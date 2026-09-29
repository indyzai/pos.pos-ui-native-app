import { BillingSettingsSection as SharedBillingSettingsSection } from '@indyzai/feature-organization/billing-settings';
import { updateOrganizationFeatures } from '../organization/organizationApi';

export function BillingSettingsSection({
  registerSave,
}: {
  registerSave?: (handler: (() => Promise<void>) | null) => void;
}) {
  return (
    <SharedBillingSettingsSection
      registerSave={registerSave}
      updateOrganizationFeatures={updateOrganizationFeatures}
    />
  );
}
