import { DataSettingsSection as SharedDataSettingsSection } from '@indyzai/feature-organization/data-settings';
import { triggerBillingOutboxWorker } from '../billing/billingOutboxWorker';

export function DataSettingsSection() {
  return <SharedDataSettingsSection surface="pos" syncOutbox={triggerBillingOutboxWorker} />;
}
