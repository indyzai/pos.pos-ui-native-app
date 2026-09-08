import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { ArrowLeft, Building2, Mail, ShieldCheck } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../shared/components/ui/AppPressable';
import { useAppTheme } from '../shared/providers/ThemeProvider';
import { authApi, type AuthTenant, type AuthUser } from '../features/auth/authApi';

export default function ProfileRoute() {
  const router = useRouter();
  const { themeColors: c } = useAppTheme();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<AuthTenant | null>(null);
  useEffect(() => {
    void Promise.all([authApi.getStoredUser(), authApi.getSelectedTenant()]).then(
      ([storedUser, selectedTenant]) => {
        setUser(storedUser);
        setTenant(selectedTenant);
      },
    );
  }, []);
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const initials = useMemo(
    () =>
      name
        .split(/[\s@]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join(''),
    [name],
  );
  const role = tenant?.role ?? user?.tenants?.[0]?.role ?? user?.role ?? 'Team member';
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.background }]} edges={['left', 'right', 'bottom']}>
      <View style={[s.header, { borderColor: c.outline, backgroundColor: c.surface }]}>
        <AppPressable
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={[s.back, { backgroundColor: c.surfaceMuted }]}
        >
          <ArrowLeft size={20} color={c.text} />
        </AppPressable>
        <Text style={[s.headerTitle, { color: c.text }]}>My profile</Text>
        <View style={s.back} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}>
          <View style={[s.avatar, { backgroundColor: c.primarySoft }]}>
            <Text style={[s.avatarText, { color: c.primary }]}>{initials}</Text>
          </View>
          <Text style={[s.name, { color: c.text }]}>{name}</Text>
          <Text style={[s.role, { color: c.primary }]}>{role}</Text>
          <View style={[s.divider, { backgroundColor: c.outlineMuted }]} />
          <ProfileRow
            icon={<Mail size={19} color={c.primary} />}
            label="Email"
            value={user?.email || 'Not available'}
            color={c.text}
            muted={c.textSecondary}
          />
          <ProfileRow
            icon={<Building2 size={19} color={c.primary} />}
            label="Current business"
            value={tenant?.name || 'No business selected'}
            color={c.text}
            muted={c.textSecondary}
          />
          <ProfileRow
            icon={<ShieldCheck size={19} color={c.primary} />}
            label="Business role"
            value={role}
            color={c.text}
            muted={c.textSecondary}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
  color,
  muted,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
  muted: string;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowIcon}>{icon}</View>
      <View style={s.rowCopy}>
        <Text style={[s.rowLabel, { color: muted }]}>{label}</Text>
        <Text style={[s.rowValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    height: 68,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, flexGrow: 1 },
  card: { borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'center' },
  avatar: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontWeight: '900' },
  name: { marginTop: 14, fontSize: 21, fontWeight: '900' },
  role: { marginTop: 5, fontSize: 13, fontWeight: '800' },
  divider: { height: 1, alignSelf: 'stretch', marginVertical: 22 },
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  rowIcon: { width: 34, alignItems: 'center' },
  rowCopy: { flex: 1, marginLeft: 8 },
  rowLabel: { fontSize: 11, fontWeight: '700' },
  rowValue: { fontSize: 14, fontWeight: '800', marginTop: 3 },
});
