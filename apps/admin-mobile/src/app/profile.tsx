import { useRouter } from 'expo-router';
import { ProfileScreen } from '@indyzai/pos-auth/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { authApi } from '../auth/authApi';

export default function ProfileRoute() {
  const router = useRouter();
  const { refreshSession } = useAuthSession();
  return (
    <ProfileScreen
      loadProfile={() => Promise.all([authApi.getStoredUser(), authApi.getSelectedTenant()])}
      onCreateOrganization={async (input) => {
        await authApi.createOrganization(input);
        await refreshSession();
      }}
      onBack={() => router.back()}
    />
  );
}
