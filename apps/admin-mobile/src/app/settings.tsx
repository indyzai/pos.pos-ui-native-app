import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { SettingsPage } from '@indyzai/feature-organization/settings-page';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { printerConfigurationApi } from '../features/printing/printerConfigurationApi';
import { settingsApi } from '../features/settings/settingsApi';
import { DeviceSettingsSection } from '../features/settings/DeviceSettingsSection';
import { GeneralSettingsSection } from '../features/settings/GeneralSettingsSection';
import { DataSettingsSection } from '../features/settings/DataSettingsSection';

export default function SettingsRoute() {
  return (
    <BottomNavigationProvider>
      <SettingsPage
        surface="admin"
        settingsApi={settingsApi}
        printerConfigurationApi={printerConfigurationApi}
        DeviceSettingsSection={DeviceSettingsSection}
        GeneralSettingsSection={GeneralSettingsSection}
        DataSettingsSection={DataSettingsSection}
      />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
