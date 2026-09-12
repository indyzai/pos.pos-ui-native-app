import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { Building2, CircleUserRound, Globe2, Store } from 'lucide-react-native';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { useAuthSession } from '../auth/AuthSessionContext';

export function GeneralSettingsSection() {
    const { themeColors: c } = useAppTheme();
    const { session, user } = useAuthSession();
    const organization = session?.organization;
    const settings = organization?.settings ?? {};
    const branch = organization?.branches.find((item) => item.counters.length) ?? organization?.branches[0];
    const counter = branch?.counters[0];
    const role = session?.tenant.role || user?.role || 'Team member';

    return (
        <View style={s.container}>
            <SectionTitle icon={Building2} title="Business" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                <Detail
                    label="Business name"
                    value={organization?.name || session?.tenant.name || 'Not configured'}
                />
                <Detail
                    label="Business ID"
                    value={organization?.id || session?.tenant.id || 'Unavailable'}
                    copyable
                />
                <Detail label="Business type" value={display(settings.businessType)} />
                <Detail label="Currency" value={display(settings.currency, 'INR')} />
                <Detail label="Timezone" value={display(settings.timezone, 'Asia/Kolkata')} />
                <Detail label="Language" value={display(settings.language, 'en')} last />
            </View>

            <SectionTitle icon={Store} title="Current workspace" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                <Detail label="Branch" value={branch?.name || 'No branch configured'} />
                <Detail label="Counter" value={counter?.name || 'No counter configured'} />
                <Detail
                    label="Counter session"
                    value={organization?.activeSession ? 'Open' : 'Closed'}
                    valueColor={organization?.activeSession ? c.success : c.error}
                    last
                />
            </View>

            <SectionTitle icon={CircleUserRound} title="Signed-in account" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                <Detail
                    label="Name"
                    value={[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Not provided'}
                />
                <Detail label="Email" value={user?.email || 'Unavailable'} />
                <Detail label="Role" value={role} last />
            </View>

            <SectionTitle icon={Globe2} title="Application" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                <Detail label="Application" value={Constants.expoConfig?.name || 'IndyzAI POS'} />
                <Detail label="Version" value={Constants.expoConfig?.version || 'Development'} last />
            </View>
        </View>
    );
}

function display(value: unknown, fallback = 'Not configured') {
    return typeof value === 'string' && value.trim() ? value : fallback;
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Building2; title: string }) {
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
    copyable = false,
}: {
    label: string;
    value: string;
    last?: boolean;
    valueColor?: string;
    copyable?: boolean;
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
                selectable={copyable}
                numberOfLines={copyable ? 2 : 1}
                style={[s.detailValue, { color: valueColor || c.text }]}
            >
                {value}
            </Text>
        </View>
    );
}

const s = StyleSheet.create({
    container: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: 8 },
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
});
