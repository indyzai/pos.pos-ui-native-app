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
import { EyeIcon } from './AuthIcons';
import type { RegistrationPayload } from './authApi';
import { Sparkles } from 'lucide-react-native';

type Props = { onSignUp: (payload: RegistrationPayload) => Promise<void>; onLogin: () => void };
type Details = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  business: string;
  type: string;
  industry: string;
  terms: boolean;
};
const steps = ['Account', 'Organization', 'Review'];

export function SignupScreen({ onSignUp, onLogin }: Props) {
  const { themeColors: c } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const wideLayout = width >= 768 && height >= 600 && width > height;
  const brandedMobileLayout = !wideLayout;
  const compactBrandedLayout = brandedMobileLayout && width > height;
  const compactLayout = width < 380 || height < 700;
  const sidePadding = Math.round(Math.min(Math.max(width * 0.055, 16), 48));
  const cardPadding = Math.round(Math.min(Math.max(width * 0.045, 20), 36));
  const cardWidth = wideLayout ? Math.min(width * 0.42, 580) : '100%';
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<Details>({
    name: '',
    email: '',
    password: '',
    confirm: '',
    business: '',
    type: '',
    industry: '',
    terms: false,
  });
  const set = (key: keyof Details, value: string | boolean) =>
    setDetails((current) => ({ ...current, [key]: value }));
  const validStep = () => {
    const message =
      step === 0
        ? !details.name ||
          !/^\S+@\S+\.\S+$/.test(details.email) ||
          details.password.length < 8 ||
          details.password !== details.confirm
          ? 'Enter a name, valid email, and matching password of at least 8 characters.'
          : ''
        : !details.business || !details.type || !details.industry || !details.terms
          ? 'Complete your organization details and accept the terms.'
          : '';
    if (message) Alert.alert('Check your details', message);
    return !message;
  };
  const proceed = async () => {
    if (step !== 2) {
      if (validStep()) setStep((value) => value + 1);
      return;
    }
    setLoading(true);
    try {
      await onSignUp({
        fullName: details.name.trim(),
        email: details.email.trim(),
        password: details.password,
        companyName: details.business.trim(),
        domainName: details.business.trim(),
        organizationType: details.type.trim(),
        industry: details.industry.trim(),
      });
    } catch (error) {
      Alert.alert('Account creation failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <View style={[s.screen, !wideLayout && s.singleColumn, { backgroundColor: c.background }]}>
      <AuthBranding
        title="Join Indyz POS"
        subtitle="Set up your business and start selling in a few simple steps."
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
          <View style={s.stepper}>
            {steps.map((label, index) => (
              <View style={s.step} key={label}>
                <View style={[s.circle, { backgroundColor: index <= step ? '#4F46E5' : c.surfaceMuted }]}>
                  <Text style={[s.circleText, { color: index <= step ? '#fff' : c.textSecondary }]}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={[s.stepLabel, { color: index === step ? c.text : c.textSecondary }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
          {step === 0 && (
            <>
              <Title
                c={c}
                heading="Create your account"
                body="Let’s start with your basic information."
                size={width}
              />
              <Field c={c} label="Full name" value={details.name} onChangeText={(v) => set('name', v)} />
              <Field
                c={c}
                label="Email address"
                value={details.email}
                placeholder="you@example.com"
                onChangeText={(v) => set('email', v)}
              />
              <View style={s.passwordHead}>
                <Text style={[s.label, { color: c.text }]}>Password</Text>
              </View>
              <PasswordInput
                c={c}
                value={details.password}
                onChangeText={(v) => set('password', v)}
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <Text style={[s.label, { color: c.text }]}>Confirm password</Text>
              <PasswordInput
                c={c}
                value={details.confirm}
                onChangeText={(v) => set('confirm', v)}
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <Text style={[s.hint, { color: c.textSecondary }]}>
                Use at least 8 characters for a secure password.
              </Text>
            </>
          )}
          {step === 1 && (
            <>
              <Title
                c={c}
                heading="Organization details"
                body="Tell us about the business you’ll manage."
                size={width}
              />
              <Field
                c={c}
                label="Organization name"
                value={details.business}
                onChangeText={(v) => set('business', v)}
              />
              <Field
                c={c}
                label="Organization type"
                value={details.type}
                placeholder="e.g. Small business"
                onChangeText={(v) => set('type', v)}
              />
              <Field
                c={c}
                label="Industry"
                value={details.industry}
                placeholder="e.g. Retail"
                onChangeText={(v) => set('industry', v)}
              />
              <View style={s.terms}>
                <Switch
                  value={details.terms}
                  onValueChange={(v) => set('terms', v)}
                  trackColor={{ true: '#8B5CF6' }}
                />
                <Text style={[s.termsText, { color: c.textSecondary }]}>
                  I agree to the <Text style={s.link}>Terms & Conditions</Text>
                </Text>
              </View>
            </>
          )}
          {step === 2 && (
            <>
              <Title
                c={c}
                heading="Review & confirm"
                body="Please review before creating your account."
                size={width}
              />
              <Summary
                c={c}
                title="User information"
                edit={() => setStep(0)}
                rows={['Name|' + details.name, 'Email|' + details.email, 'Password|••••••••']}
              />
              <Summary
                c={c}
                title="Organization details"
                edit={() => setStep(1)}
                rows={['Name|' + details.business, 'Type|' + details.type, 'Industry|' + details.industry]}
              />
            </>
          )}
          <View style={[s.actions, width < 340 && s.stackedActions]}>
            {step > 0 && (
              <AppPressable
                onPress={() => setStep((value) => value - 1)}
                style={[s.back, { borderColor: c.outline }]}
              >
                <Text style={[s.backText, { color: c.text }]}>Back</Text>
              </AppPressable>
            )}
            <AppPressable
              disabled={loading}
              onPress={() => void proceed()}
              style={[s.primary, loading && s.disabled]}
            >
              <Text style={s.primaryText}>
                {loading ? 'Creating account…' : step === 2 ? 'Create account' : 'Continue'}
              </Text>
            </AppPressable>
          </View>
          {step === 0 && (
            <Text style={[s.footer, { color: c.textSecondary }]}>
              Already have an account?{' '}
              <Text style={s.link} onPress={onLogin}>
                Sign in
              </Text>
            </Text>
          )}
        </View>
        <View style={[s.formNote, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
          <Sparkles size={15} color="#6677E8" strokeWidth={2.4} />
          <Text style={[s.formNoteText, { color: c.text }]}>Build a smarter business with Indyz POS</Text>
        </View>
      </ScrollView>
    </View>
  );
}
function Title({
  c,
  heading,
  body,
  size,
}: {
  c: ReturnType<typeof useAppTheme>['themeColors'];
  heading: string;
  body: string;
  size: number;
}) {
  return (
    <>
      <Text style={[s.title, { color: c.text, fontSize: Math.min(Math.max(size * 0.06, 23), 31) }]}>
        {heading}
      </Text>
      <Text style={[s.subtitle, { color: c.textSecondary }]}>{body}</Text>
    </>
  );
}
function Field({
  c,
  label,
  ...props
}: {
  c: ReturnType<typeof useAppTheme>['themeColors'];
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={[s.label, { color: c.text }]}>{label}</Text>
      <TextInput
        {...props}
        autoCapitalize="none"
        placeholderTextColor={c.textSecondary}
        style={[s.input, { color: c.text, borderColor: c.outline }]}
      />
    </View>
  );
}
function PasswordInput({
  c,
  value,
  onChangeText,
  show,
  onToggle,
}: {
  c: ReturnType<typeof useAppTheme>['themeColors'];
  value: string;
  onChangeText: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[s.passwordInput, { borderColor: c.outline }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        style={[s.passwordText, { color: c.text }]}
      />
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={show ? 'Hide password' : 'Show password'}
        hitSlop={10}
        onPress={onToggle}
        style={s.eyeButton}
      >
        <EyeIcon hidden={!show} />
      </AppPressable>
    </View>
  );
}
function Summary({
  c,
  title,
  edit,
  rows,
}: {
  c: ReturnType<typeof useAppTheme>['themeColors'];
  title: string;
  edit: () => void;
  rows: string[];
}) {
  return (
    <View style={[s.summary, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
      <View style={s.summaryHead}>
        <Text style={[s.summaryTitle, { color: c.text }]}>{title}</Text>
        <Text style={s.link} onPress={edit}>
          Edit
        </Text>
      </View>
      {rows.map((row) => {
        const [label, value] = row.split('|');
        return (
          <View style={s.row} key={label}>
            <Text style={[s.rowLabel, { color: c.textSecondary }]}>{label}</Text>
            <Text style={[s.rowValue, { color: c.text }]}>{value}</Text>
          </View>
        );
      })}
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
    maxWidth: 470,
    alignSelf: 'center',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 5,
  },
  compactCard: { padding: 20, borderRadius: 14 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  step: { alignItems: 'center', flex: 1 },
  circle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  circleText: { fontWeight: '800', fontSize: 13 },
  stepLabel: { marginTop: 6, fontSize: 11, fontWeight: '600' },
  title: { textAlign: 'center', fontSize: 24, fontWeight: '800' },
  subtitle: { textAlign: 'center', fontSize: 14, marginTop: 7, marginBottom: 22 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, fontSize: 15 },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  passwordText: { flex: 1, height: '100%', paddingHorizontal: 13, fontSize: 15 },
  eyeButton: { height: '100%', width: 48, alignItems: 'center', justifyContent: 'center' },
  passwordHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  hint: { fontSize: 12, marginTop: 7 },
  link: { color: '#4F46E5', fontWeight: '700', fontSize: 13 },
  terms: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3 },
  termsText: { flex: 1, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28 },
  stackedActions: { flexDirection: 'column-reverse' },
  primary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.62 },
  back: {
    minHeight: 50,
    paddingHorizontal: 22,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { fontSize: 15, fontWeight: '700' },
  footer: { fontSize: 13, textAlign: 'center', marginTop: 22 },
  summary: { borderWidth: 1, borderRadius: 12, padding: 15, marginTop: 12 },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryTitle: { fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', marginTop: 6 },
  rowLabel: { width: 84, fontSize: 13 },
  rowValue: { flex: 1, fontSize: 13, fontWeight: '600' },
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
