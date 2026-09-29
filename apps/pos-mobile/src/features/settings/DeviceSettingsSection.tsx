import { DeviceSettingsSection as SharedDeviceSettingsSection } from '@indyzai/feature-organization/device-settings';
import { authApi } from '../../auth/authApi';
import {
  canSwitchApiEnvironment,
  getRuntimeApiUrls,
  setApiEnvironment,
} from '../../config/runtimeEnvironment';

export function DeviceSettingsSection({
  registerSave,
}: {
  registerSave?: (handler: (() => Promise<void>) | null) => void;
}) {
  return (
    <SharedDeviceSettingsSection
      registerSave={registerSave}
      authApi={authApi}
      canSwitchApiEnvironment={canSwitchApiEnvironment}
      getRuntimeApiUrls={getRuntimeApiUrls}
      setApiEnvironment={setApiEnvironment}
    />
  );
}
