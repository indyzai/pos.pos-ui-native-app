import { configureAuthUi, LoginScreen, SignupScreen } from '@indyzai/pos-auth/ui';
import { PosLogo } from '../shared/components/branding/PosLogo';
import { showSnackbar } from '../shared/providers/SnackbarProvider';
import { useAppTheme } from '../shared/providers/ThemeProvider';

configureAuthUi({
    useTheme: useAppTheme,
    showSnackbar,
    Logo: PosLogo,
    loginTitle: 'IndyzAI POS Admin',
    loginSubtitle: 'Manage your organization, users, inventory, and operations.',
    signupTitle: 'Join IndyzAI POS Admin',
    signupSubtitle: 'Set up your organization administration in a few simple steps.',
});

export { LoginScreen, SignupScreen };
