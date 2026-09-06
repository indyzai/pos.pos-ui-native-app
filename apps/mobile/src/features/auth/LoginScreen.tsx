import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppPressable } from '../../components/ui/AppPressable';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AuthBranding } from './AuthBranding';
import { EyeIcon, GoogleIcon, MicrosoftIcon } from './AuthIcons';
import type { LoginCredentials } from './authApi';
import { ShieldCheck } from 'lucide-react-native';

export function LoginScreen({
  onLogin,
  onSignUp,
  onSocialLogin,
}: {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  onSignUp: () => void;
  onSocialLogin: (provider: 'google' | 'microsoft') => Promise<void>;
}) {
  const { themeColors: c } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wideLayout = width >= 768 && height >= 600 && width > height;
  const brandedMobileLayout = !wideLayout;
  const compactBrandedLayout = brandedMobileLayout && width > height;
  const compactLayout = width < 380 || height < 650;
  const sidePadding = Math.round(Math.min(Math.max(width * 0.055, 16), 48));
  const cardPadding = Math.round(Math.min(Math.max(width * 0.045, 20), 36));
  const cardWidth = wideLayout ? Math.min(width * 0.42, 560) : '100%';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    if (!email.trim() || !password)
      return Alert.alert('Sign in', 'Enter your email address and password to continue.');
    setLoading(true);
    try {
      await onLogin({ email: email.trim(), password });
    } catch (error) {
      Alert.alert('Sign in failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const socialLogin = async (provider: 'google' | 'microsoft') => {
    setLoading(true);
    try {
      await onSocialLogin(provider);
    } catch (error) {
      Alert.alert('Sign in failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={[s.screen, !wideLayout && s.singleColumn, { backgroundColor: c.background }]}>
      <AuthBranding
        title="Welcome to Indyz POS"
        subtitle="Run your sales, inventory, and customers from one place."
        fullScreen={brandedMobileLayout}
      />
      <ScrollView
        style={s.formScroll}
        contentContainerStyle={[
          s.formArea,
          { paddingHorizontal: sidePadding },
          compactLayout && s.compactFormArea,
          brandedMobileLayout && s.brandedFormArea,
          compactBrandedLayout && s.landscapeBrandedFormArea,
        ]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View
          style={[
            s.card,
            { maxWidth: cardWidth, padding: compactLayout ? 20 : cardPadding },
            compactLayout && s.compactCard,
            { backgroundColor: c.surface, borderColor: c.outlineMuted },
          ]}
        >
          <Text style={[s.title, { color: c.text, fontSize: Math.min(Math.max(width * 0.06, 24), 32) }]}>
            Welcome back
          </Text>
          <Text style={[s.subtitle, { color: c.textSecondary }]}>Please sign in to continue</Text>
          <Text style={[s.label, { color: c.text }]}>Email address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={c.textSecondary}
            style={[s.input, { color: c.text, borderColor: c.outline }]}
          />
          <View style={s.passwordHead}>
            <Text style={[s.label, { color: c.text }]}>Password</Text>
          </View>
          <View style={[s.passwordInput, { borderColor: c.outline }]}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              placeholder="Enter your password"
              placeholderTextColor={c.textSecondary}
              style={[s.passwordText, { color: c.text }]}
            />
            <AppPressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={10}
              onPress={() => setShowPassword(!showPassword)}
              style={s.eyeButton}
            >
              <EyeIcon hidden={!showPassword} />
            </AppPressable>
          </View>
          <View style={[s.options, compactLayout && s.compactOptions]}>
            <View style={s.remember}>
              <Switch value={rememberMe} onValueChange={setRememberMe} trackColor={{ true: '#8B5CF6' }} />
              <Text style={[s.rememberText, { color: c.textSecondary }]}>Remember me</Text>
            </View>
            <Text style={s.link}>Forgot password?</Text>
          </View>
          <AppPressable disabled={loading} onPress={submit} style={[s.primary, loading && s.disabled]}>
            <Text style={s.primaryText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
          </AppPressable>
          <View style={s.divider}>
            <View style={[s.line, { backgroundColor: c.outlineMuted }]} />
            <Text style={[s.dividerText, { color: c.textSecondary }]}>Or continue with</Text>
            <View style={[s.line, { backgroundColor: c.outlineMuted }]} />
          </View>
          <View style={[s.socials, width < 340 && s.stackedSocials]}>
            <AppPressable
              disabled={loading}
              onPress={() => void socialLogin('google')}
              style={[s.social, { borderColor: c.outline }, loading && s.disabled]}
            >
              <GoogleIcon />
              <Text style={[s.socialText, { color: c.text }]}>Google</Text>
            </AppPressable>
            <AppPressable
              disabled={loading}
              onPress={() => void socialLogin('microsoft')}
              style={[s.social, { borderColor: c.outline }, loading && s.disabled]}
            >
              <MicrosoftIcon />
              <Text style={[s.socialText, { color: c.text }]}>Microsoft</Text>
            </AppPressable>
          </View>
          <Text style={[s.footer, { color: c.textSecondary }]}>
            Don’t have an account?{' '}
            <Text style={s.link} onPress={onSignUp}>
              Sign up
            </Text>
          </Text>
        </View>
        <View style={[s.formNote, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
          <ShieldCheck size={15} color="#6677E8" strokeWidth={2.4} />
          <Text style={[s.formNoteText, { color: c.text }]}>Secure access for your Indyz POS workspace</Text>
        </View>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  singleColumn: { flexDirection: 'column' },
  formScroll: { flex: 1, zIndex: 1 },
  formArea: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  compactFormArea: { justifyContent: 'flex-start', padding: 16 },
  brandedFormArea: { justifyContent: 'flex-start', paddingTop: 184 },
  landscapeBrandedFormArea: { paddingTop: 124 },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 5,
  },
  compactCard: { padding: 20, borderRadius: 14 },
  title: { fontSize: 25, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  passwordInput: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passwordText: { flex: 1, height: '100%', paddingHorizontal: 14, fontSize: 15 },
  eyeButton: { height: '100%', width: 48, alignItems: 'center', justifyContent: 'center' },
  passwordHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: '#4F46E5', fontSize: 13, fontWeight: '700' },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 22,
  },
  compactOptions: { marginBottom: 16 },
  remember: { flexDirection: 'row', alignItems: 'center', marginLeft: -7 },
  rememberText: { fontSize: 13 },
  primary: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.62 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 25 },
  line: { height: 1, flex: 1 },
  dividerText: { fontSize: 12 },
  socials: { flexDirection: 'row', gap: 12 },
  stackedSocials: { flexDirection: 'column' },
  social: {
    height: 46,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  socialText: { fontSize: 14, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 13, marginTop: 26 },
  formNote: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 14,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  formNoteText: { fontSize: 11, fontWeight: '600' },
});
