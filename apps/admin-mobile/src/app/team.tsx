import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { TeamScreen } from '@indyzai/feature-organization/team-screen';
import { teamApi } from '../features/team/teamApi';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';

export default function TeamRoute() {
  return (
    <BottomNavigationProvider>
      <TeamScreen api={teamApi} surface="admin" />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
