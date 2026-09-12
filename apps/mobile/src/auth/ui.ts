import { configureAuthUi, LoginScreen, SignupScreen } from '@indyzai/pos-auth/ui';
import { PosLogo } from '../shared/components/branding/PosLogo';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { useAppTheme } from '../shared/providers/ThemeProvider';

configureAuthUi({
  useTheme: useAppTheme,
  showSnackbar,
  Logo: PosLogo,
  loginTitle: 'Welcome to IndyzAI POS',
  loginSubtitle: 'Run your sales, inventory, and customers from one place.',
  signupTitle: 'Join IndyzAI POS',
  signupSubtitle: 'Set up your business and start selling in a few simple steps.',
});

export { LoginScreen, SignupScreen };
