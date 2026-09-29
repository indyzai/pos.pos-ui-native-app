import { DataSettingsSection as SharedDataSettingsSection } from '@indyzai/feature-organization/data-settings';
import { billingApi } from '../billing/billingApi';

export function DataSettingsSection() {
  return <SharedDataSettingsSection surface="admin" syncOutbox={() => billingApi.sync()} />;
}
