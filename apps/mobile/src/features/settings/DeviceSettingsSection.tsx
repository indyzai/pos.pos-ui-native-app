import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Cpu, Database, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react-native';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { useLocalDatabase } from '../../db/DatabaseProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { authApi, type DeviceRegistrationDetails } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';

export function DeviceSettingsSection() {
  const { themeColors: c } = useAppTheme();
  const localDatabase = useLocalDatabase();
  const { session } = useAuthSession();
  const [details, setDetails] = useState<DeviceRegistrationDetails>();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void authApi.getDeviceRegistrationDetails().then(setDetails);
  }, []);

  const save = async () => {
    if (pin !== confirm) return Alert.alert('Device PIN', 'PIN entries do not match.');
    setBusy(true);
    try {
      await authApi.changeDevicePin(pin);
      setDetails(await authApi.getDeviceRegistrationDetails());
      setPin('');
      setConfirm('');
      Alert.alert('PIN changed', 'Your device PIN has been updated.');
    } catch (error) {
      Alert.alert('PIN change failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
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

      <SectionTitle icon={Database} title="Local UI database" />
      <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
        <Detail
          label="Status"
          value={localDatabase.status}
          valueColor={
            localDatabase.status === 'ready'
              ? c.success
              : localDatabase.status === 'error'
                ? c.error
                : c.primary
          }
        />
        <Detail label="Database type" value={Platform.OS === 'web' ? 'IndexedDB' : 'SQLite'} />
        <Detail
          label="Database name"
          value={Platform.OS === 'web' ? 'indyz-pos-web' : 'indyz-pos.db'}
          selectable
        />
        <Detail label="Data layer" value={Platform.OS === 'web' ? 'Native IndexedDB API' : 'Drizzle ORM'} />
        <Detail label="Driver" value={Platform.OS === 'web' ? 'Browser IndexedDB' : 'expo-sqlite'} />
        <Detail
          label="Storage scope"
          value={Platform.OS === 'web' ? 'Current browser profile' : 'Application sandbox'}
        />
        <Detail
          label="Database error"
          value={localDatabase.error || 'None'}
          valueColor={localDatabase.error ? c.error : undefined}
          last
        />
      </View>

      {Platform.OS !== 'web' && (
        <>
          <SectionTitle icon={KeyRound} title="Device access PIN" />
          <Text style={[s.note, { color: c.textSecondary }]}>
            Verify with Face ID, fingerprint, or the device passcode before changing this PIN.
          </Text>
          <TextInput
            value={pin}
            onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="New PIN"
            placeholderTextColor={c.textSecondary}
            style={[s.input, { color: c.text, backgroundColor: c.background, borderColor: c.outline }]}
          />
          <TextInput
            value={confirm}
            onChangeText={(value) => setConfirm(value.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            placeholder="Confirm new PIN"
            placeholderTextColor={c.textSecondary}
            style={[s.input, { color: c.text, backgroundColor: c.background, borderColor: c.outline }]}
          />
          <AppPressable
            disabled={busy || !pin}
            onPress={() => void save()}
            style={[s.button, { backgroundColor: c.primary, opacity: busy || !pin ? 0.55 : 1 }]}
          >
            <Text style={s.buttonText}>{busy ? 'Updating…' : 'Change device PIN'}</Text>
          </AppPressable>
        </>
      )}
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
  button: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
