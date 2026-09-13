import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Database, RefreshCw, Trash2 } from 'lucide-react-native';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { clearLocalUiData } from '@indyzai/pos-database/maintenance';
import { useLocalCollection, useLocalDatabase } from '@indyzai/pos-database';
import type { LocalRecord, SyncStatus } from '@indyzai/pos-database';
import { listSyncJobs, type SyncJob } from '../../sync/syncJobRepository';
import { waybillRepository } from '../logistics/waybillRepository';
import type { WaybillJob } from '../logistics/types';

type OutboxPayload = {
    offlineId?: string;
    entityType?: string;
    operation?: string;
    status?: string;
    attemptCount?: number;
    errorMessage?: string;
    createdAt?: number | string;
};
type SyncStatePayload = { collection?: string; cursor?: string; lastSyncedAt?: number | string };
type SyncErrorPayload = {
    entityType?: string;
    operation?: string;
    errorMessage?: string;
    createdAt?: number | string;
};

export function DataSettingsSection() {
    const { themeColors: c } = useAppTheme();
    const queryClient = useQueryClient();
    const { session } = useAuthSession();
    const local = useLocalDatabase();
    const outbox = useLocalCollection<LocalRecord<OutboxPayload>>('sync_outbox', { includeDeleted: true });
    const states = useLocalCollection<LocalRecord<SyncStatePayload>>('sync_state', { includeDeleted: true });
    const errors = useLocalCollection<LocalRecord<SyncErrorPayload>>('sync_errors', {
        includeDeleted: true,
        limit: 20,
    });
    const conflicts = useLocalCollection('sync_conflicts', { includeDeleted: true, limit: 20 });
    const [legacyJobs, setLegacyJobs] = useState<SyncJob[]>([]);
    const [waybillJobs, setWaybillJobs] = useState<WaybillJob[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [error, setError] = useState('');

    const counts = useMemo(() => {
        const result: Record<SyncStatus, number> = {
            API: 0,
            PENDING: 0,
            RUNNING: 0,
            FAILED: 0,
            CONFLICT: 0,
            SYNCED: 0,
        };
        for (const record of outbox.records) result[record.syncStatus]++;
        for (const job of legacyJobs) {
            const status = normalizeStatus(job.status);
            result[status]++;
        }
        for (const job of waybillJobs) {
            result[normalizeStatus(job.status)]++;
        }
        return result;
    }, [legacyJobs, outbox.records, waybillJobs]);

    const loadCompatibilityJobs = async () => {
        if (!session || local.status !== 'ready') return;
        const scope = appStorageKeys.admin.billing(session.user.id, session.tenant.id);
        const [jobs, logistics] = await Promise.all([listSyncJobs(scope), waybillRepository.read(scope)]);
        setLegacyJobs(jobs);
        setWaybillJobs(logistics);
    };

    const refresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                outbox.reload(),
                states.reload(),
                errors.reload(),
                conflicts.reload(),
                loadCompatibilityJobs(),
            ]);
            setError('');
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to read local synchronization data.');
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, [session?.tenant.id, session?.user.id, local.status]);

    const confirmClear = () => {
        const unsynced = counts.PENDING + counts.RUNNING + counts.FAILED + counts.CONFLICT;
        showSnackbar(
            'Clear local POS database?',
            `${unsynced ? `${unsynced} unsynced record${unsynced === 1 ? '' : 's'} will be permanently removed. ` : ''}Cached POS data will be removed without signing out or deleting server data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear database',
                    style: 'destructive',
                    onPress: () => {
                        setClearing(true);
                        void clearLocalUiData(local.database)
                            .then(() => {
                                setLegacyJobs([]);
                                setWaybillJobs([]);
                                queryClient.removeQueries();
                                showSnackbar(
                                    'Database cleared',
                                    'Local POS and synchronization data were removed.',
                                );
                            })
                            .catch((reason) =>
                                showSnackbar(
                                    'Could not clear database',
                                    reason instanceof Error ? reason.message : 'Try again.',
                                ),
                            )
                            .finally(() => setClearing(false));
                    },
                },
            ],
        );
    };

    const recent = [...outbox.records].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
    const compatibility = [
        ...legacyJobs.map((job) => ({
            id: job.id,
            label: job.operation === 'CREATE_PRODUCT' ? 'Add item' : 'Update stock',
            status: job.status,
            timestamp: job.updatedAt,
            error: job.errorMessage,
        })),
        ...waybillJobs.map((job) => ({
            id: job.id,
            label: 'Create waybill',
            status: job.status,
            timestamp: job.createdAt,
            error: job.error,
        })),
    ].slice(0, 20);
    const problems = [
        ...errors.records.map((record) => ({
            id: record.id,
            label: record.payload.operation || record.payload.entityType || 'Sync error',
            status: 'FAILED',
            timestamp: record.payload.createdAt || record.updatedAt,
            error: record.payload.errorMessage,
        })),
        ...conflicts.records.map((record) => {
            const payload = record.payload as Record<string, unknown>;
            return {
                id: record.id,
                label: String(payload.entityType || payload.operation || 'Data conflict'),
                status: 'CONFLICT',
                timestamp: record.updatedAt,
                error: payload.errorMessage ? String(payload.errorMessage) : undefined,
            };
        }),
    ]
        .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
        .slice(0, 20);

    return (
        <View style={s.container}>
            <SectionHeader icon={<Database size={18} color={c.primary} />} title="Local database" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                <Detail
                    label="Status"
                    value={local.status}
                    valueColor={local.status === 'ready' ? c.success : c.error}
                />
                <Detail
                    label="Database"
                    value={Platform.OS === 'web' ? 'indyz-pos-local-v1' : 'indyz-pos.db'}
                />
                <Detail
                    label="Adapter"
                    value={local.database?.kind === 'indexeddb' ? 'IndexedDB / Dexie' : 'SQLite / Drizzle'}
                />
                <Detail label="Role" value={local.scope?.role ?? 'Unavailable'} />
                <Detail label="Tenant" value={local.scope?.tenantId ?? 'Unavailable'} selectable />
                <Detail label="Stores" value={local.scope?.storeIds.join(', ') || 'None selected'} last />
            </View>

            <View style={s.titleRow}>
                <SectionHeader
                    icon={<RefreshCw size={18} color={c.primary} />}
                    title="Synchronization"
                    compact
                />
                <AppPressable
                    accessibilityLabel="Refresh local synchronization status"
                    disabled={refreshing || local.status !== 'ready'}
                    onPress={() => void refresh()}
                    style={[
                        s.refreshButton,
                        { backgroundColor: c.primarySoft, opacity: refreshing ? 0.55 : 1 },
                    ]}
                >
                    <RefreshCw size={14} color={c.primary} />
                    <Text style={[s.refreshText, { color: c.primary }]}>
                        {refreshing ? 'Reading…' : 'Refresh'}
                    </Text>
                </AppPressable>
            </View>
            <View style={s.summaryGrid}>
                <Summary label="Pending" value={counts.PENDING} color={c.primary} />
                <Summary label="Running" value={counts.RUNNING} color={c.primary} />
                <Summary label="Failed" value={counts.FAILED} color={c.error} />
                <Summary
                    label="Conflicts"
                    value={counts.CONFLICT + conflicts.records.length}
                    color={c.error}
                />
                <Summary label="Synced" value={counts.SYNCED} color={c.success} />
            </View>
            {Boolean(error || outbox.error || states.error || errors.error || conflicts.error) ? (
                <Text style={[s.error, { color: c.error }]}>
                    {error || outbox.error || states.error || errors.error || conflicts.error}
                </Text>
            ) : null}

            <SectionHeader icon={<Clock3 size={18} color={c.primary} />} title="Recent outbox activity" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                {!recent.length ? (
                    <Empty text="No records in the new sync outbox." />
                ) : (
                    recent.map((record, index) => (
                        <SyncRow
                            key={record.id}
                            label={record.payload.operation || record.payload.entityType || 'Local mutation'}
                            id={record.payload.offlineId || record.remoteId || record.id}
                            status={record.syncStatus}
                            timestamp={record.updatedAt}
                            error={record.payload.errorMessage}
                            last={index === recent.length - 1}
                        />
                    ))
                )}
            </View>

            <SectionHeader icon={<CheckCircle2 size={18} color={c.primary} />} title="Pull cursors" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                {!states.records.length ? (
                    <Empty text="No collection has completed a pull sync yet." />
                ) : (
                    states.records.map((record, index) => (
                        <Detail
                            key={record.id}
                            label={record.payload.collection || record.remoteId || 'Collection'}
                            value={formatTime(record.payload.lastSyncedAt || record.updatedAt)}
                            last={index === states.records.length - 1}
                        />
                    ))
                )}
            </View>

            {!!problems.length && (
                <>
                    <SectionHeader icon={<AlertCircle size={18} color={c.error} />} title="Sync problems" />
                    <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                        {problems.map((problem, index) => (
                            <SyncRow key={problem.id} {...problem} last={index === problems.length - 1} />
                        ))}
                    </View>
                </>
            )}

            {!!compatibility.length && (
                <>
                    <SectionHeader
                        icon={<Clock3 size={18} color={c.primary} />}
                        title="Compatibility queue"
                    />
                    <Text style={[s.hint, { color: c.textSecondary }]}>
                        {'Jobs created by features not yet moved to sync_outbox.'}
                    </Text>
                    <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                        {compatibility.map((job, index) => (
                            <SyncRow key={job.id} {...job} last={index === compatibility.length - 1} />
                        ))}
                    </View>
                </>
            )}

            <SectionHeader icon={<AlertCircle size={18} color={c.error} />} title="Maintenance" />
            <View style={[s.danger, { backgroundColor: c.errorSoft, borderColor: c.error }]}>
                <View style={s.dangerCopy}>
                    <Text style={[s.dangerTitle, { color: c.text }]}>Clear local POS database</Text>
                    <Text style={[s.dangerHint, { color: c.textSecondary }]}>
                        {'Removes cached and unsynced local data from this device.'}
                    </Text>
                </View>
                <AppPressable
                    accessibilityLabel="Clear all local POS database data"
                    disabled={clearing || local.status !== 'ready' || !local.database}
                    onPress={confirmClear}
                    style={[s.clearButton, { borderColor: c.error, opacity: clearing ? 0.55 : 1 }]}
                >
                    <Trash2 size={15} color={c.error} />
                    <Text style={[s.clearText, { color: c.error }]}>{clearing ? 'Clearing…' : 'Clear'}</Text>
                </AppPressable>
            </View>
        </View>
    );
}

function SyncRow(props: {
    label: string;
    id: string;
    status: string;
    timestamp: number | string;
    error?: string;
    last: boolean;
}) {
    const { themeColors: c } = useAppTheme();
    const color =
        props.status === 'FAILED' || props.status === 'CONFLICT'
            ? c.error
            : props.status === 'COMPLETED' || props.status === 'SYNCED'
              ? c.success
              : c.primary;
    return (
        <View style={[s.syncRow, !props.last && { borderBottomColor: c.outlineMuted }]}>
            <View style={s.syncTop}>
                <Text style={[s.syncLabel, { color: c.text }]}>{props.label}</Text>
                <Text style={[s.syncStatus, { color }]}>{props.status}</Text>
            </View>
            <Text selectable numberOfLines={1} style={[s.syncId, { color: c.textSecondary }]}>
                {props.id}
            </Text>
            <Text style={[s.syncTime, { color: c.textSecondary }]}>{formatTime(props.timestamp)}</Text>
            {props.error ? <Text style={[s.error, { color: c.error }]}>{props.error}</Text> : null}
        </View>
    );
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[s.summary, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
            <Text style={[s.summaryValue, { color }]}>{value}</Text>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>{label}</Text>
        </View>
    );
}

function SectionHeader({
    icon,
    title,
    compact = false,
}: {
    icon: React.ReactNode;
    title: string;
    compact?: boolean;
}) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[s.sectionTitle, compact && s.sectionTitleCompact]}>
            {icon}
            <Text style={[s.sectionTitleText, { color: c.text }]}>{title}</Text>
        </View>
    );
}

function Detail({
    label,
    value,
    valueColor,
    selectable,
    last,
}: {
    label: string;
    value: string;
    valueColor?: string;
    selectable?: boolean;
    last?: boolean;
}) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[s.detail, !last && { borderBottomColor: c.outlineMuted }]}>
            <Text style={[s.detailLabel, { color: c.textSecondary }]}>{label}</Text>
            <Text
                selectable={selectable}
                numberOfLines={2}
                style={[s.detailValue, { color: valueColor || c.text }]}
            >
                {value}
            </Text>
        </View>
    );
}

function Empty({ text }: { text: string }) {
    const { themeColors: c } = useAppTheme();
    return <Text style={[s.empty, { color: c.textSecondary }]}>{text}</Text>;
}

function formatTime(value?: number | string) {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function normalizeStatus(value: string): SyncStatus {
    const status = value.toUpperCase();
    if (status === 'COMPLETED' || status === 'SYNCED') return 'SYNCED';
    if (status === 'RUNNING') return 'RUNNING';
    if (status === 'FAILED') return 'FAILED';
    if (status === 'CONFLICT') return 'CONFLICT';
    return 'PENDING';
}

const s = StyleSheet.create({
    container: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: 2, paddingBottom: 32 },
    sectionTitle: { marginTop: 22, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    sectionTitleCompact: { marginTop: 0, marginBottom: 0, flex: 1 },
    sectionTitleText: { fontSize: 14, fontWeight: '900' },
    titleRow: {
        marginTop: 22,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    panel: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, overflow: 'hidden' },
    detail: {
        minHeight: 50,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
    },
    detailLabel: { flexShrink: 0, fontSize: 12, fontWeight: '700' },
    detailValue: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '800' },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 2 },
    summary: { minWidth: 108, flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 14 },
    summaryValue: { fontSize: 20, fontWeight: '900' },
    summaryLabel: { marginTop: 2, fontSize: 11, fontWeight: '700' },
    refreshButton: {
        height: 34,
        borderRadius: 10,
        paddingHorizontal: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    refreshText: { fontSize: 11, fontWeight: '900' },
    syncRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
    syncTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    syncLabel: { flex: 1, fontSize: 12, fontWeight: '900' },
    syncStatus: { fontSize: 10, fontWeight: '900' },
    syncId: { marginTop: 3, fontSize: 10 },
    syncTime: { marginTop: 2, fontSize: 10 },
    empty: { paddingVertical: 22, textAlign: 'center', fontSize: 12 },
    error: { marginTop: 10, fontSize: 11, lineHeight: 16 },
    hint: { marginBottom: 10, fontSize: 11, lineHeight: 16 },
    dangerHint: { fontSize: 11, lineHeight: 16 },
    danger: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    dangerCopy: { flex: 1 },
    dangerTitle: { fontSize: 12, fontWeight: '900', marginBottom: 5 },
    clearButton: {
        height: 36,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    clearText: { fontSize: 11, fontWeight: '900' },
});
