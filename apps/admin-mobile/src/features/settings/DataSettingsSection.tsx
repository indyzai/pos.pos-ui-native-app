import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Database, RefreshCw, Send, Trash2 } from 'lucide-react-native';
import { AppPressable } from '@indyzai/pos-ui-native';
import { showSnackbar } from '@indyzai/pos-ui-native/snackbar';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { clearLocalUiData } from '@indyzai/pos-database/maintenance';
import { createLocalFirstTableHook, useLocalDatabase } from '@indyzai/pos-database';
import type { CollectionName, LocalRecord, SyncStatus } from '@indyzai/pos-database';
import { waybillRepository } from '@indyzai/feature-orders/logistics/waybillRepository';
import type { WaybillJob } from '@indyzai/feature-orders/logistics/types';
import { createLogger } from '@indyzai/pos-utils';
import { billingApi } from '../billing/billingApi';

const logger = createLogger('Settings:data');

type OutboxPayload = {
    offlineId?: string;
    entityType?: string;
    operation?: string;
    status?: string;
    attemptCount?: number;
    attempts?: number;
    errorMessage?: string;
    createdAt?: number | string;
    table?: CollectionName;
    localId?: string;
};
type SyncStatePayload = { collection?: string; cursor?: string; lastSyncedAt?: number | string };
type SyncErrorPayload = {
    entityType?: string;
    operation?: string;
    errorMessage?: string;
    createdAt?: number | string;
};
const useOutboxTable = createLocalFirstTableHook<OutboxPayload>({ table: 'sync_outbox' });
const useSyncStateTable = createLocalFirstTableHook<SyncStatePayload>({ table: 'sync_state' });
const useSyncErrorTable = createLocalFirstTableHook<SyncErrorPayload>({ table: 'sync_errors' });
const useConflictTable = createLocalFirstTableHook<Record<string, unknown>>({ table: 'sync_conflicts' });

export function DataSettingsSection() {
    const { themeColors: c } = useAppTheme();
    const queryClient = useQueryClient();
    const { session } = useAuthSession();
    const local = useLocalDatabase();
    const outbox = useOutboxTable();
    const states = useSyncStateTable();
    const errors = useSyncErrorTable();
    const conflicts = useConflictTable();
    const [waybillJobs, setWaybillJobs] = useState<WaybillJob[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
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
        for (const record of outbox.data) result[record.syncStatus]++;
        for (const job of waybillJobs) {
            result[normalizeStatus(job.status)]++;
        }
        return result;
    }, [outbox.data, waybillJobs]);

    const loadWaybillJobs = async () => {
        if (!session || local.status !== 'ready') return;
        const scope = appStorageKeys.admin.billing(session.user.id, session.tenant.id);
        const logistics = await waybillRepository.read(scope);
        setWaybillJobs(logistics);
    };

    const refresh = async () => {
        setRefreshing(true);
        logger.info('Refreshing synchronization status');
        try {
            await Promise.all([
                outbox.reload(),
                states.reload(),
                errors.reload(),
                conflicts.reload(),
                loadWaybillJobs(),
            ]);
            setError('');
        } catch (reason) {
            const errorMessage =
                reason instanceof Error ? reason.message : 'Unable to read local synchronization data.';
            logger.error('Failed to read synchronization data', { error: errorMessage });
            setError(errorMessage);
        } finally {
            setRefreshing(false);
        }
    };

    const syncNow = async () => {
        if (syncing || local.status !== 'ready') return;
        setSyncing(true);
        try {
            await billingApi.sync();
            await refresh();
            showSnackbar('Sync complete', 'Pending outbox activity was sent to the server.');
        } catch (reason) {
            showSnackbar(
                'Sync deferred',
                reason instanceof Error ? reason.message : 'Unable to reach the server.',
            );
            await refresh();
        } finally {
            setSyncing(false);
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
                        logger.warn('Clearing local admin database', { unsyncedRecords: unsynced });
                        void clearLocalUiData(local.database)
                            .then(() => {
                                logger.info('Local admin database cleared successfully');
                                setWaybillJobs([]);
                                queryClient.removeQueries();
                                showSnackbar(
                                    'Database cleared',
                                    'Local POS and synchronization data were removed.',
                                );
                            })
                            .catch((reason) => {
                                const errorMessage = reason instanceof Error ? reason.message : 'Try again.';
                                logger.error('Failed to clear local admin database', { error: errorMessage });
                                showSnackbar('Could not clear database', errorMessage);
                            })
                            .finally(() => setClearing(false));
                    },
                },
            ],
        );
    };

    const retryOutbox = async (record: LocalRecord<OutboxPayload>) => {
        if (!local.database) return;
        const { errorMessage: _error, attempts: _attempts, attemptCount: _attemptCount, ...payload } = record.payload;
        await local.database.collection<LocalRecord<OutboxPayload>>('sync_outbox').put({
            ...record,
            payload: {
                ...payload,
                attempts: 0,
            },
            syncStatus: 'PENDING',
            updatedAt: Date.now(),
        });
        await refresh();
        void billingApi.sync().catch(() => undefined);
    };

    const clearAllOutbox = () => {
        if (!local.database) return;
        const pendingOrFailed = outbox.data.filter((record) =>
            ['PENDING', 'RUNNING', 'FAILED', 'CONFLICT'].includes(record.syncStatus),
        );
        if (!pendingOrFailed.length) return;
        const message = `Are you sure you want to clear ${pendingOrFailed.length} unsynced outbox item(s)?`;
        const runClear = async () => {
            for (const record of pendingOrFailed) {
                await deleteOutbox(record);
            }
            showSnackbar('Outbox cleared', `Cleared ${pendingOrFailed.length} item(s) from sync outbox.`);
        };
        if (Platform.OS === 'web') {
            if (globalThis.confirm?.(message)) {
                void runClear();
            }
        } else {
            Alert.alert('Clear sync outbox', message, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear all', style: 'destructive', onPress: () => void runClear() },
            ]);
        }
    };

    const deleteOutbox = async (record: LocalRecord<OutboxPayload>) => {
        if (!local.database) return;
        const jobId = record.payload.offlineId || record.remoteId || record.id;
        const dependencies = await local.database
            .collection('sync_dependencies')
            .list({ includeDeleted: true });
        if (record.payload.table && record.payload.localId) {
            const repository = local.database.collection(record.payload.table);
            const current = await repository.get(record.payload.localId);
            if (current) {
                if (!current.remoteId) await repository.remove(current.id);
                else await repository.put({ ...current, syncStatus: 'SYNCED', updatedAt: Date.now() });
            }
        }
        await Promise.all([
            local.database.collection('sync_outbox').remove(record.id),
            ...dependencies
                .filter((dependency) => {
                    const payload = dependency.payload as { jobId?: string; dependsOnJobId?: string };
                    return payload.jobId === jobId || payload.dependsOnJobId === jobId;
                })
                .map((dependency) => local.database!.collection('sync_dependencies').remove(dependency.id)),
        ]);
        await refresh();
    };

    const resolveConflict = async (record: LocalRecord) => {
        if (!local.database) return;
        const payload = record.payload as { jobId?: string; outboxId?: string; offlineId?: string };
        const targetId = payload.jobId || payload.outboxId || payload.offlineId;
        if (targetId) {
            const jobs = await local.database
                .collection<LocalRecord<OutboxPayload>>('sync_outbox')
                .list({ includeDeleted: true });
            const job = jobs.find(
                (candidate) =>
                    candidate.id === targetId ||
                    candidate.remoteId === targetId ||
                    candidate.payload.offlineId === targetId,
            );
            if (job) await retryOutbox(job);
        }
        await local.database.collection('sync_conflicts').remove(record.id);
        await refresh();
    };

    const recent = [...outbox.data]
        .filter((record) => showCompleted || (record.syncStatus !== 'SYNCED' && record.syncStatus !== 'API'))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 20);
    const waybillActivity = waybillJobs
        .map((job) => ({
            id: job.id,
            label: 'Create waybill',
            status: job.status,
            timestamp: job.createdAt,
            error: job.error,
        }))
        .slice(0, 20);
    const problems = [
        ...errors.data.map((record) => ({
            source: 'error' as const,
            record,
            id: record.id,
            label: record.payload.operation || record.payload.entityType || 'Sync error',
            status: 'FAILED',
            timestamp: record.payload.createdAt || record.updatedAt,
            error: record.payload.errorMessage,
        })),
        ...conflicts.data.map((record) => {
            const payload = record.payload as Record<string, unknown>;
            return {
                source: 'conflict' as const,
                record,
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
                    value={Platform.OS === 'web' ? 'indyz-pos-admin-local-v1' : 'indyz-pos-admin.db'}
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
                <View style={s.syncActions}>
                    <AppPressable
                        accessibilityLabel="Manually synchronize pending outbox activity"
                        disabled={syncing || local.status !== 'ready'}
                        onPress={() => void syncNow()}
                        style={[s.refreshButton, { backgroundColor: c.primary, opacity: syncing ? 0.55 : 1 }]}
                    >
                        <Send size={14} color="#fff" />
                        <Text style={[s.refreshText, { color: '#fff' }]}>
                            {syncing ? 'Syncing…' : 'Sync now'}
                        </Text>
                    </AppPressable>
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
            </View>
            <View style={s.summaryGrid}>
                <Summary label="Pending" value={counts.PENDING} color={c.primary} />
                <Summary label="Running" value={counts.RUNNING} color={c.primary} />
                <Summary label="Failed" value={counts.FAILED} color={c.error} />
                <Summary
                    label="Conflicts"
                    value={counts.CONFLICT + conflicts.data.length}
                    color={c.error}
                />
                <Summary label="Synced" value={counts.SYNCED} color={c.success} />
            </View>
            {Boolean(error || outbox.error || states.error || errors.error || conflicts.error) ? (
                <Text style={[s.error, { color: c.error }]}>
                    {error || outbox.error || states.error || errors.error || conflicts.error}
                </Text>
            ) : null}

            <View style={s.activityTitleRow}>
                <SectionHeader
                    icon={<Clock3 size={18} color={c.primary} />}
                    title="Recent outbox activity"
                    compact
                />
                <View style={s.syncActions}>
                    {outbox.data.some((r) => ['PENDING', 'RUNNING', 'FAILED', 'CONFLICT'].includes(r.syncStatus)) ? (
                        <AppPressable
                            accessibilityLabel="Clear all outbox items"
                            onPress={clearAllOutbox}
                            style={[
                                s.completedToggle,
                                {
                                    backgroundColor: c.errorSoft,
                                    borderColor: c.error,
                                    gap: 4,
                                },
                            ]}
                        >
                            <Trash2 size={13} color={c.error} />
                            <Text style={[s.completedToggleText, { color: c.error }]}>Clear all</Text>
                        </AppPressable>
                    ) : null}
                    <AppPressable
                        accessibilityLabel={
                            showCompleted
                                ? 'Hide completed synchronization objects'
                                : 'Show completed synchronization objects'
                        }
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: showCompleted }}
                        onPress={() => setShowCompleted((value) => !value)}
                        style={[
                            s.completedToggle,
                            {
                                backgroundColor: showCompleted ? c.background : c.surfaceMuted,
                                borderColor: showCompleted ? c.success : c.outlineMuted,
                            },
                        ]}
                    >
                        <CheckCircle2 size={14} color={showCompleted ? c.success : c.textSecondary} />
                        <Text
                            style={[
                                s.completedToggleText,
                                { color: showCompleted ? c.success : c.textSecondary },
                            ]}
                        >
                            Show completed
                        </Text>
                    </AppPressable>
                </View>
            </View>
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                {!recent.length ? (
                    <Empty text="No records in the new sync outbox." />
                ) : (
                    recent.map((record, index) => (
                        <SyncRow
                            key={record.id}
                            label={record.payload.operation || record.payload.entityType || 'Local mutation'}
                            id={record.payload.offlineId || record.remoteId || record.id}
                            status={
                                record.payload.attempts
                                    ? `${record.syncStatus} (${record.payload.attempts}/3)`
                                    : record.syncStatus
                            }
                            timestamp={record.updatedAt}
                            error={record.payload.errorMessage}
                            json={{
                                id: record.id,
                                syncStatus: record.syncStatus,
                                updatedAt: record.updatedAt,
                                payload: record.payload,
                            }}
                            onRetry={
                                ['FAILED', 'PENDING', 'CONFLICT'].includes(record.syncStatus) ||
                                (record.payload.attempts ?? 0) > 0
                                    ? () => retryOutbox(record)
                                    : undefined
                            }
                            onDelete={
                                ['PENDING', 'RUNNING', 'FAILED', 'CONFLICT'].includes(record.syncStatus)
                                    ? () => deleteOutbox(record)
                                    : undefined
                            }
                            last={index === recent.length - 1}
                        />
                    ))
                )}
            </View>

            <SectionHeader icon={<CheckCircle2 size={18} color={c.primary} />} title="Pull cursors" />
            <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                {!states.data.length ? (
                    <Empty text="No collection has completed a pull sync yet." />
                ) : (
                    states.data.map((record, index) => (
                        <Detail
                            key={record.id}
                            label={record.payload.collection || record.remoteId || 'Collection'}
                            value={formatTime(record.payload.lastSyncedAt || record.updatedAt)}
                            last={index === states.data.length - 1}
                        />
                    ))
                )}
            </View>

            {!!problems.length && (
                <>
                    <SectionHeader icon={<AlertCircle size={18} color={c.error} />} title="Sync problems" />
                    <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                        {problems.map((problem, index) => (
                            <SyncRow
                                key={problem.id}
                                {...problem}
                                onResolve={
                                    problem.source === 'conflict'
                                        ? () => resolveConflict(problem.record)
                                        : undefined
                                }
                                onDelete={() =>
                                    local.database
                                        ?.collection(
                                            problem.source === 'conflict' ? 'sync_conflicts' : 'sync_errors',
                                        )
                                        .remove(problem.record.id)
                                        .then(refresh)
                                }
                                last={index === problems.length - 1}
                            />
                        ))}
                    </View>
                </>
            )}

            {!!waybillActivity.length && (
                <>
                    <SectionHeader icon={<Clock3 size={18} color={c.primary} />} title="Waybill activity" />
                    <View style={[s.panel, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
                        {waybillActivity.map((job, index) => (
                            <SyncRow key={job.id} {...job} last={index === waybillActivity.length - 1} />
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
    json?: unknown;
    onRetry?: () => void | Promise<void>;
    onResolve?: () => void | Promise<void>;
    onDelete?: () => void | Promise<void>;
    last: boolean;
}) {
    const { themeColors: c } = useAppTheme();
    const [jsonOpen, setJsonOpen] = useState(false);
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
            {props.onRetry || props.onResolve || props.onDelete ? (
                <View style={s.rowActions}>
                    {props.onRetry ? (
                        <RowAction label="Retry" color={c.primary} onPress={props.onRetry} />
                    ) : null}
                    {props.onResolve ? (
                        <RowAction label="Resolve" color={c.success} onPress={props.onResolve} />
                    ) : null}
                    {props.onDelete ? (
                        <RowAction label="Delete" color={c.error} onPress={props.onDelete} />
                    ) : null}
                </View>
            ) : null}
            {props.json ? (
                <>
                    <AppPressable onPress={() => setJsonOpen((open) => !open)} style={s.jsonButton}>
                        <Text style={[s.jsonButtonText, { color: c.primary }]}>
                            {jsonOpen ? 'Hide JSON' : 'View JSON'}
                        </Text>
                    </AppPressable>
                    {jsonOpen ? (
                        <Text selectable style={[s.json, { color: c.text, backgroundColor: c.surfaceMuted }]}>
                            {JSON.stringify(props.json, null, 2)}
                        </Text>
                    ) : null}
                </>
            ) : null}
        </View>
    );
}

function RowAction({
    label,
    color,
    onPress,
}: {
    label: string;
    color: string;
    onPress: () => void | Promise<void>;
}) {
    return (
        <AppPressable onPress={() => void onPress()} style={[s.rowAction, { borderColor: color }]}>
            <Text style={[s.rowActionText, { color }]}>{label}</Text>
        </AppPressable>
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
    syncActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    activityTitleRow: {
        marginTop: 22,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    completedToggle: {
        minHeight: 34,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    completedToggleText: { fontSize: 11, fontWeight: '800' },
    syncRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
    syncTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    syncLabel: { flex: 1, fontSize: 12, fontWeight: '900' },
    syncStatus: { fontSize: 10, fontWeight: '900' },
    syncId: { marginTop: 3, fontSize: 10 },
    syncTime: { marginTop: 2, fontSize: 10 },
    rowActions: { marginTop: 9, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    rowAction: {
        minHeight: 30,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        justifyContent: 'center',
    },
    rowActionText: { fontSize: 10, fontWeight: '900' },
    jsonButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 3 },
    jsonButtonText: { fontSize: 11, fontWeight: '900' },
    json: { marginTop: 6, borderRadius: 10, padding: 10, fontSize: 10, lineHeight: 15 },
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
