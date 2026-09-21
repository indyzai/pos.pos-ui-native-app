import { configureAuthUi, LoginScreen, SignupScreen } from '@indyzai/pos-auth/ui';
import { AdminLogo } from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAppTheme } from '@indyzai/pos-ui-native';

configureAuthUi({
    useTheme: useAppTheme,
    showSnackbar,
    Logo: AdminLogo,
    loginTitle: 'IndyzAI POS Admin',
    loginSubtitle: 'Manage your organization, users, inventory, and operations.',
    signupTitle: 'Join IndyzAI POS Admin',
    signupSubtitle: 'Set up your organization administration in a few simple steps.',
});

export { LoginScreen, SignupScreen };
