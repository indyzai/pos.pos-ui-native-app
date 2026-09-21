import { configureAuthUi, LoginScreen, SignupScreen } from '@indyzai/pos-auth/ui';
import { PosLogo } from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAppTheme } from '@indyzai/pos-ui-native';

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
