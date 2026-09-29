import { useRouter } from 'expo-router';
import { ProfileScreen } from '@indyzai/pos-auth/profile';
import { authApi } from '../auth/authApi';

export default function ProfileRoute() {
  const router = useRouter();
  return (
    <ProfileScreen
      loadProfile={() => Promise.all([authApi.getStoredUser(), authApi.getSelectedTenant()])}
      onBack={() => router.back()}
    />
  );
}
