import { AppLoginRoute } from '@indyzai/pos-auth/routes';
import { authApi } from '../auth/authApi';

export default function LoginRoute() {
  return <AppLoginRoute authApi={authApi} homePath="/reports" appName="admin" />;
}
