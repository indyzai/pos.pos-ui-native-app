import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe2,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { showSnackbar } from '../../shared/providers/SnackbarProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { authApi, type DeviceRegistrationDetails } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { development, env } from '../../config/env';
import { getRuntimeApiUrls, setApiEnvironment, type ApiEnvironment } from '../../config/runtimeEnvironment';

export function DeviceSettingsSection({
  registerSave,
}: {
  registerSave?: (handler: (() => Promise<void>) | null) => void;
}) {
  const { themeColors: c } = useAppTheme();
  const { session } = useAuthSession();
  const [details, setDetails] = useState<DeviceRegistrationDetails>();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [authorizingPin, setAuthorizingPin] = useState(false);
  const [apiEnvironment, setApiEnvironmentState] = useState<ApiEnvironment>('local');
  const [apiUrls, setApiUrls] = useState({ posApiUrl: env.posApiUrl, authApiUrl: env.authApiUrl });
  const [switchingEnvironment, setSwitchingEnvironment] = useState(false);

  useEffect(() => {
    void authApi.getDeviceRegistrationDetails().then(setDetails);
    if (development) {
      void getRuntimeApiUrls().then(({ environment, posApiUrl, authApiUrl }) => {
        setApiEnvironmentState(environment);
        setApiUrls({ posApiUrl, authApiUrl });
      });
    }
  }, []);

  const toggleApiEnvironment = async (useProduction: boolean) => {
    const environment: ApiEnvironment = useProduction ? 'production' : 'local';
    setSwitchingEnvironment(true);
    try {
      await setApiEnvironment(environment);
      const { posApiUrl, authApiUrl } = await getRuntimeApiUrls();
      setApiEnvironmentState(environment);
      setApiUrls({ posApiUrl, authApiUrl });
    } catch (error) {
      showSnackbar('Could not change API environment', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSwitchingEnvironment(false);
    }
  };

  const save = useCallback(async () => {
    if (busy) return;
    if (!pin) return showSnackbar('Device PIN', 'Enter a new PIN before saving.');
    if (pin !== confirm) return showSnackbar('Device PIN', 'PIN entries do not match.');
    setBusy(true);
    try {
      await authApi.registerDevice(pin);
      setDetails(await authApi.getDeviceRegistrationDetails());
      setPin('');
      setConfirm('');
      showSnackbar('PIN changed', 'Your device PIN has been updated.');
    } catch (error) {
      showSnackbar('PIN change failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [busy, confirm, pin]);

  useEffect(() => {
    registerSave?.(Platform.OS === 'web' || !pinOpen ? null : save);
    return () => registerSave?.(null);
  }, [pinOpen, registerSave, save]);

  const togglePin = async () => {
    if (pinOpen) {
      setPinOpen(false);
      setPin('');
      setConfirm('');
      return;
    }
    setAuthorizingPin(true);
    try {
      await authApi.verifyDeviceAccess();
      setPinOpen(true);
    } catch (error) {
      showSnackbar('Authentication required', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setAuthorizingPin(false);
    }
  };

  return (
    <View style={s.container}>
      <SectionTitle icon={ShieldCheck} title="Device registration" />
      <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
        <Detail
          label="Registration"
          value={
            Platform.OS === 'web'
              ? 'Not available on web'
              : details?.registered
                ? 'Registered'
                : 'Not registered'
          }
          valueColor={details?.registered ? c.success : c.textSecondary}
        />
        <Detail label="Registration ID" value={details?.deviceId || 'Not assigned'} selectable />
        <Detail label="Device identifier" value={details?.deviceIdentifier || 'Unavailable'} selectable />
        <Detail label="Business" value={session?.tenant.name || 'Not selected'} />
        <Detail label="Business ID" value={session?.tenant.id || 'Unavailable'} selectable last />
      </View>

      {Platform.OS !== 'web' && (
        <View style={[s.pinSection, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
          <AppPressable
            accessibilityLabel={
              pinOpen ? 'Collapse device PIN settings' : 'Authenticate to change device PIN'
            }
            disabled={authorizingPin}
            onPress={() => void togglePin()}
            style={s.pinHeader}
          >
            <View style={[s.pinIcon, { backgroundColor: c.surfaceMuted }]}>
              <KeyRound size={17} color={c.primary} />
            </View>
            <View style={s.pinHeaderCopy}>
              <Text style={[s.pinTitle, { color: c.text }]}>Change device PIN</Text>
              <Text style={[s.pinSubtitle, { color: c.textSecondary }]}>
                {authorizingPin ? 'Authenticating…' : 'Device authentication required'}
              </Text>
            </View>
            {pinOpen ? (
              <ChevronUp size={18} color={c.textSecondary} />
            ) : (
              <ChevronDown size={18} color={c.textSecondary} />
            )}
          </AppPressable>
          {pinOpen && (
            <View style={[s.pinBody, { borderTopColor: c.outlineMuted }]}>
              <TextInput
                value={pin}
                onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="New 4–8 digit PIN"
                placeholderTextColor={c.textSecondary}
                style={[s.input, { color: c.text, backgroundColor: c.surface, borderColor: c.outline }]}
              />
              <TextInput
                value={confirm}
                onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 8))}
                keyboardType="number-pad"
                secureTextEntry
                placeholder="Confirm new PIN"
                placeholderTextColor={c.textSecondary}
                style={[s.input, { color: c.text, backgroundColor: c.surface, borderColor: c.outline }]}
              />
              <Text style={[s.note, { color: c.textSecondary }]}>
                Use the center Save button or the button below to update the PIN.
              </Text>
              <AppPressable
                disabled={busy || !pin}
                onPress={() => void save()}
                style={[
                  s.button,
                  {
                    backgroundColor: c.primarySoft,
                    borderColor: c.primary,
                    opacity: busy || !pin ? 0.55 : 1,
                  },
                ]}
              >
                <Text style={[s.buttonText, { color: c.primary }]}>{busy ? 'Updating…' : 'Update PIN'}</Text>
              </AppPressable>
            </View>
          )}
        </View>
      )}

      <SectionTitle icon={Cpu} title="Device and application" />
      <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
        <Detail label="Device name" value={details?.deviceName || 'Loading…'} />
        <Detail
          label="Platform"
          value={details ? `${details.platform} ${details.platformVersion}` : 'Loading…'}
        />
        <Detail label="Application ID" value={details?.applicationId || 'Loading…'} selectable />
        <Detail label="App version" value={details?.applicationVersion || 'Loading…'} />
        <Detail label="Build" value={details?.buildVersion || 'Loading…'} />
        <Detail label="Runtime" value={details?.executionEnvironment || 'Loading…'} last />
      </View>

      <SectionTitle icon={Globe2} title="API configuration" />
      <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
        {development && (
          <View style={[s.environmentRow, { borderBottomColor: c.outlineMuted }]}>
            <View style={s.environmentCopy}>
              <Text style={[s.environmentTitle, { color: c.text }]}>Use production APIs</Text>
              <Text style={[s.environmentHint, { color: c.textSecondary }]}>
                Development only · saved on this device
              </Text>
            </View>
            <Switch
              accessibilityLabel="Use production API URLs"
              disabled={switchingEnvironment}
              value={apiEnvironment === 'production'}
              onValueChange={(value) => void toggleApiEnvironment(value)}
              trackColor={{ false: c.outline, true: c.primarySoft }}
              thumbColor={apiEnvironment === 'production' ? c.primary : c.textSecondary}
            />
          </View>
        )}
        <Detail label="POS API URL" value={apiUrls.posApiUrl} selectable />
        <Detail label="Authentication URL" value={apiUrls.authApiUrl} selectable last />
      </View>
    </View>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  const { themeColors: c } = useAppTheme();
  return (
    <View style={s.sectionTitle}>
      <Icon size={17} color={c.primary} />
      <Text style={[s.sectionTitleText, { color: c.text }]}>{title}</Text>
    </View>
  );
}

function Detail({
  label,
  value,
  last = false,
  valueColor,
  selectable = false,
}: {
  label: string;
  value: string;
  last?: boolean;
  valueColor?: string;
  selectable?: boolean;
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <View
      style={[
        s.detail,
        !last && { borderBottomColor: c.outlineMuted, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Text style={[s.detailLabel, { color: c.textSecondary }]}>{label}</Text>
      <Text
        selectable={selectable}
        numberOfLines={selectable ? 2 : 1}
        style={[s.detailValue, { color: valueColor || c.text }]}
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: 8, paddingBottom: 24 },
  sectionTitle: { marginTop: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitleText: { fontSize: 14, fontWeight: '900' },
  panel: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14 },
  environmentRow: {
    minHeight: 58,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  environmentCopy: { flex: 1 },
  environmentTitle: { fontSize: 12, fontWeight: '800' },
  environmentHint: { marginTop: 2, fontSize: 10 },
  pinSection: { marginTop: 10, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  pinHeader: { minHeight: 58, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  pinHeaderCopy: { flex: 1 },
  pinTitle: { fontSize: 13, fontWeight: '900' },
  pinSubtitle: { marginTop: 2, fontSize: 10 },
  pinBody: { borderTopWidth: StyleSheet.hairlineWidth, padding: 13 },
  detail: {
    minHeight: 47,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  detailLabel: { flexShrink: 0, fontSize: 12, fontWeight: '700' },
  detailValue: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '800' },
  note: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    fontSize: 15,
    marginBottom: 10,
  },
  button: { height: 44, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 13, fontWeight: '900' },
  jobsHeader: {
    minHeight: 58,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  jobsTitle: { fontSize: 12, fontWeight: '900' },
  jobsCount: { marginTop: 2, fontSize: 10 },
  refreshButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refreshText: { fontSize: 11, fontWeight: '900' },
  jobsError: { paddingBottom: 10, fontSize: 11 },
  emptyJobs: { paddingVertical: 14, textAlign: 'center', fontSize: 11 },
  jobRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  jobBody: { flex: 1 },
  jobTopLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  jobAction: { fontSize: 12, fontWeight: '800' },
  jobStatus: { fontSize: 10, fontWeight: '900' },
  jobId: { marginTop: 3, fontSize: 10 },
  jobTime: { marginTop: 3, fontSize: 10 },
  jobError: { marginTop: 4, fontSize: 10 },
  dangerZone: {
    minHeight: 68,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dangerCopy: { flex: 1 },
  dangerTitle: { fontSize: 12, fontWeight: '900' },
  dangerText: { marginTop: 2, fontSize: 10, lineHeight: 14 },
  clearButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearButtonText: { fontSize: 11, fontWeight: '900' },
});
