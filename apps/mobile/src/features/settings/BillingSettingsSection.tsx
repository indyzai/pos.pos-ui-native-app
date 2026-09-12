import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { showSnackbar } from '../../shared/providers/SnackbarProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { useAuthSession } from '../auth/AuthSessionContext';
import { updateOrganizationFeatures } from '../organization/organizationApi';
import { featureToggleLabels, useFeatureToggles } from '../organization/useFeatureToggles';

export function BillingSettingsSection({
  registerSave,
}: {
  registerSave?: (handler: (() => Promise<void>) | null) => void;
}) {
  const { themeColors: c } = useAppTheme();
  const auth = useAuthSession();
  const { flags, entries } = useFeatureToggles();
  const [draft, setDraft] = useState(flags);
  const [busy, setBusy] = useState(false);
  const role = String(auth.session?.tenant.role || '').toLowerCase();
  const editable = ['admin', 'owner', 'superadmin'].includes(role);

  useEffect(() => setDraft(flags), [flags]);
  const save = useCallback(async () => {
    if (!auth.session || busy || !editable) return;
    setBusy(true);
    try {
      await updateOrganizationFeatures(auth.session.token, String(auth.session.tenant.id), draft);
      await auth.refreshSession();
      showSnackbar('Features updated', 'Billing now uses the saved feature configuration.');
    } catch (error) {
      showSnackbar('Could not update features', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  }, [auth, busy, draft, editable]);

  useEffect(() => {
    registerSave?.(editable ? save : null);
    return () => registerSave?.(null);
  }, [editable, registerSave, save]);

  return (
    <View>
      <Text style={[s.title, { color: c.textSecondary }]}>Feature toggles</Text>
      <Text style={[s.note, { color: c.textSecondary }]}>
        {editable
          ? 'Enable only the capabilities this business uses, then tap Save.'
          : 'Your role can view feature availability. An administrator can change it.'}
      </Text>
      {entries.map(([key]) => (
        <View key={key} style={[s.row, { borderColor: c.outlineMuted }]}>
          <View style={s.copy}>
            <Text style={[s.label, { color: c.text }]}>{featureToggleLabels[key] || humanize(key)}</Text>
            <Text style={[s.key, { color: c.textSecondary }]}>{key}</Text>
          </View>
          <Switch
            value={draft[key] === true}
            disabled={!editable || busy}
            onValueChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
            trackColor={{ false: c.outlineMuted, true: c.primarySoft }}
            thumbColor={draft[key] ? c.primary : c.textSecondary}
          />
        </View>
      ))}
    </View>
  );
}

function humanize(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase());
}

const s = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', marginTop: 20 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 12 },
  row: {
    minHeight: 58,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  copy: { flex: 1, paddingVertical: 8 },
  label: { fontSize: 14, fontWeight: '700' },
  key: { fontSize: 10, marginTop: 2 },
});
