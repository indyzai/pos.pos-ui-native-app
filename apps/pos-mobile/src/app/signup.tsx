import { AppSignupRoute } from '@indyzai/pos-auth/routes';
import { authApi } from '../auth/authApi';

export default function SignupRoute() {
  return <AppSignupRoute authApi={authApi} homePath="/billing" appName="pos" />;
}
