import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { useLocalDatabase } from '../../db/DatabaseProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { authApi, type DeviceRegistrationDetails } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { listSyncJobs, type SyncJob } from '../../sync/syncJobRepository';

export function DeviceSettingsSection({
  registerSave,
}: {
  registerSave?: (handler: (() => Promise<void>) | null) => void;
}) {
  const { themeColors: c } = useAppTheme();
  const localDatabase = useLocalDatabase();
  const { session } = useAuthSession();
  const [details, setDetails] = useState<DeviceRegistrationDetails>();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');

  const loadJobs = async () => {
    if (!session || localDatabase.status !== 'ready') return;
    setJobsLoading(true);
    try {
      const scope = `indyz.billing.v1:${session.user.id}:${session.tenant.id}`;
      setJobs(await listSyncJobs(scope));
      setJobsError('');
    } catch (error) {
      setJobsError(error instanceof Error ? error.message : 'Unable to read sync jobs.');
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    void authApi.getDeviceRegistrationDetails().then(setDetails);
  }, []);

  useEffect(() => {
    void loadJobs();
    // Reload when the active business or local database readiness changes.
  }, [session?.user.id, session?.tenant.id, localDatabase.status]);

  const save = useCallback(async () => {
    if (busy) return;
    if (!pin) return Alert.alert('Device PIN', 'Enter a new PIN before saving.');
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
  }, [busy, confirm, pin]);

  useEffect(() => {
    registerSave?.(Platform.OS === 'web' ? null : save);
    return () => registerSave?.(null);
  }, [registerSave, save]);

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
        />
        <View style={s.jobsHeader}>
          <View>
            <Text style={[s.jobsTitle, { color: c.text }]}>Sync jobs</Text>
            <Text style={[s.jobsCount, { color: c.textSecondary }]}>Last {jobs.length} local records</Text>
          </View>
          <AppPressable
            accessibilityLabel="Refresh sync job status"
            disabled={jobsLoading || localDatabase.status !== 'ready'}
            onPress={() => void loadJobs()}
            style={[s.refreshButton, { backgroundColor: c.surfaceMuted }]}
          >
            <RefreshCw size={15} color={c.primary} />
            <Text style={[s.refreshText, { color: c.primary }]}>{jobsLoading ? 'Reading…' : 'Refresh'}</Text>
          </AppPressable>
        </View>
        {jobsError ? <Text style={[s.jobsError, { color: c.error }]}>{jobsError}</Text> : null}
        {!jobsLoading && !jobs.length ? (
          <Text style={[s.emptyJobs, { color: c.textSecondary }]}>No item sync jobs stored yet.</Text>
        ) : null}
        {jobs.map((job, index) => (
          <SyncJobRow key={job.id} job={job} last={index === jobs.length - 1} />
        ))}
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

function SyncJobRow({ job, last }: { job: SyncJob; last: boolean }) {
  const { themeColors: c } = useAppTheme();
  const failed = job.status === 'FAILED';
  const completed = job.status === 'COMPLETED';
  const color = failed ? c.error : completed ? c.success : '#D97706';
  const Icon = failed ? AlertCircle : completed ? CheckCircle2 : Clock3;
  return (
    <View
      style={[s.jobRow, { borderTopColor: c.outlineMuted }, !last && { borderBottomColor: c.outlineMuted }]}
    >
      <Icon size={17} color={color} />
      <View style={s.jobBody}>
        <View style={s.jobTopLine}>
          <Text style={[s.jobAction, { color: c.text }]}>
            {job.operation === 'CREATE_PRODUCT' ? 'Add item' : 'Update stock'}
          </Text>
          <Text style={[s.jobStatus, { color }]}>{job.status}</Text>
        </View>
        <Text selectable style={[s.jobId, { color: c.textSecondary }]}>
          {job.id}
        </Text>
        <Text style={[s.jobTime, { color: c.textSecondary }]}>
          {new Date(job.updatedAt).toLocaleString()}
          {job.entityId ? ` · Server ID ${job.entityId}` : ''}
        </Text>
        {job.errorMessage ? <Text style={[s.jobError, { color: c.error }]}>{job.errorMessage}</Text> : null}
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
});
