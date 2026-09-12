import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Banknote, Calculator, ChevronDown, ChevronUp, LockKeyhole, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { AppKeyboardSafeView } from '../../../shared/components/ui/AppKeyboardSafeView';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CounterSession } from '../../sales/salesOutbox';
import { counterSessionApi } from '../counterSessionApi';
import { loadDenominationCounts, saveDenominationCounts } from '../denominationStorage';
import type { CurrencyDenomination, DenominationCounts } from '../types';

type Props = {
    visible: boolean;
    token?: string;
    tenantId?: string;
    session?: CounterSession | null;
    currencyCode: string;
    onClose: () => void;
    onClosed: () => Promise<void>;
};

export function CounterSessionSummaryDialog(props: Props) {
    const { themeColors: c } = useAppTheme();
    const [closingCash, setClosingCash] = useState('');
    const [remarks, setRemarks] = useState('');
    const [closing, setClosing] = useState(false);
    const [calculatorOpen, setCalculatorOpen] = useState(false);
    const [denominations, setDenominations] = useState<CurrencyDenomination[]>([]);
    const [counts, setCounts] = useState<DenominationCounts>({});
    const [denominationsLoading, setDenominationsLoading] = useState(false);
    const [denominationError, setDenominationError] = useState('');
    const summary = props.session?.salesSummary;
    const expectedCash = useMemo(
        () =>
            props.session?.expectedBalance ??
            Number(props.session?.openingBalance || 0) +
                Number(summary?.cash || 0) +
                Number(summary?.miscIncome || 0) -
                Number(summary?.scrap || 0) -
                Number(summary?.miscExpense || 0),
        [props.session?.expectedBalance, props.session?.openingBalance, summary],
    );

    useEffect(() => {
        if (!props.visible) return;
        setClosingCash('');
        setRemarks('');
        setCalculatorOpen(false);
        if (!props.token || !props.tenantId || !props.session?.counterId) return;
        let active = true;
        setDenominationsLoading(true);
        setDenominationError('');
        void Promise.all([
            counterSessionApi.getDenominations(props.token, props.tenantId, props.currencyCode),
            loadDenominationCounts(props.tenantId, props.session.counterId, props.currencyCode, 'closing'),
        ])
            .then(([loaded, savedCounts]) => {
                if (!active) return;
                setDenominations(loaded);
                setCounts(savedCounts);
                const savedTotal = loaded.reduce(
                    (total, item) => total + item.value * (Number(savedCounts[item.id]) || 0),
                    0,
                );
                if (savedTotal) setClosingCash(String(savedTotal));
                if (!loaded.length)
                    setDenominationError(`No denominations are configured for ${props.currencyCode}.`);
            })
            .catch((error) => {
                if (!active) return;
                setDenominations([]);
                setDenominationError(
                    error instanceof Error ? error.message : 'Could not load denominations.',
                );
            })
            .finally(() => {
                if (active) setDenominationsLoading(false);
            });
        return () => {
            active = false;
        };
    }, [
        props.currencyCode,
        props.session?.counterId,
        props.session?.id,
        props.tenantId,
        props.token,
        props.visible,
    ]);

    const updateCount = (item: CurrencyDenomination, value: string) => {
        const sanitized = value.replace(/[^0-9]/g, '');
        setCounts((current) => {
            const next = { ...current, [item.id]: sanitized };
            const total = denominations.reduce(
                (sum, denomination) => sum + denomination.value * (Number(next[denomination.id]) || 0),
                0,
            );
            setClosingCash(String(total));
            if (props.tenantId && props.session?.counterId) {
                void saveDenominationCounts(
                    props.tenantId,
                    props.session.counterId,
                    props.currencyCode,
                    next,
                    'closing',
                );
            }
            return next;
        });
    };

    const closeSession = async () => {
        const amount = Number(closingCash);
        if (!props.token || !props.tenantId || !props.session) return;
        if (!Number.isFinite(amount) || amount < 0 || closingCash.trim() === '') {
            showSnackbar('Closing cash', 'Enter the counted cash before closing this session.');
            return;
        }
        setClosing(true);
        try {
            await saveDenominationCounts(
                props.tenantId,
                props.session.counterId,
                props.currencyCode,
                counts,
                'closing',
            );
            await counterSessionApi.close(
                props.token,
                props.tenantId,
                props.session.id,
                amount,
                remarks.trim(),
            );
            props.onClose();
            await props.onClosed();
        } catch (error) {
            showSnackbar('Could not close counter', error instanceof Error ? error.message : 'Try again.');
        } finally {
            setClosing(false);
        }
    };

    const difference = closingCash.trim() ? Number(closingCash) - expectedCash : undefined;
    return (
        <Modal transparent visible={props.visible} animationType="fade" onRequestClose={props.onClose}>
            <AppKeyboardSafeView style={s.overlay}>
                <Pressable style={s.backdrop} onPress={closing ? undefined : props.onClose} />
                <View style={[s.dialog, { backgroundColor: c.surface, borderColor: c.outline }]}>
                    <View style={s.header}>
                        <View style={s.titleRow}>
                            <View style={[s.icon, { backgroundColor: c.primarySoft }]}>
                                <Banknote size={20} color={c.primary} />
                            </View>
                            <View style={s.titleCopy}>
                                <Text style={[s.title, { color: c.text }]}>
                                    {props.session?.counterName || 'Counter'}
                                </Text>
                                <Text numberOfLines={1} style={[s.subtitle, { color: c.textSecondary }]}>
                                    {props.session?.branchName || 'Branch'}
                                    {props.session?.sessionNumber ? ` · ${props.session.sessionNumber}` : ''}
                                </Text>
                            </View>
                        </View>
                        <AppPressable
                            disabled={closing}
                            onPress={props.onClose}
                            style={[s.close, { backgroundColor: c.surfaceMuted }]}
                        >
                            <X size={18} color={c.text} />
                        </AppPressable>
                    </View>

                    <ScrollView
                        automaticallyAdjustKeyboardInsets
                        keyboardDismissMode="interactive"
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={s.summaryGrid}>
                            <Summary
                                label="Opening cash"
                                value={money(props.session?.openingBalance || 0, props.currencyCode)}
                            />
                            <Summary
                                label="Cash sales"
                                value={money(summary?.cash || 0, props.currencyCode)}
                            />
                            <Summary
                                label="Card / UPI"
                                value={money(
                                    Number(summary?.card || 0) + Number(summary?.upi || 0),
                                    props.currencyCode,
                                )}
                            />
                            <Summary
                                label="Total sales"
                                value={money(summary?.totalSales || 0, props.currencyCode)}
                            />
                        </View>
                        <View style={[s.expected, { backgroundColor: c.surfaceMuted }]}>
                            <Text style={[s.expectedLabel, { color: c.textSecondary }]}>Expected cash</Text>
                            <Text style={[s.expectedValue, { color: c.text }]}>
                                {money(expectedCash, props.currencyCode)}
                            </Text>
                        </View>

                        <Text style={[s.label, { color: c.textSecondary }]}>Counted closing cash</Text>
                        <TextInput
                            value={closingCash}
                            onChangeText={setClosingCash}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={c.textSecondary}
                            style={[
                                s.input,
                                { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                            ]}
                        />
                        <AppPressable
                            accessibilityLabel={
                                calculatorOpen
                                    ? 'Hide closing cash denominations'
                                    : 'Count closing cash denominations'
                            }
                            onPress={() => setCalculatorOpen((value) => !value)}
                            style={[s.denominationToggle, { backgroundColor: c.surfaceMuted }]}
                        >
                            <Calculator size={16} color={c.primary} />
                            <Text style={[s.denominationToggleText, { color: c.text }]}>
                                Count denominations
                            </Text>
                            <Text numberOfLines={1} style={[s.denominationTotal, { color: c.primary }]}>
                                {money(Number(closingCash) || 0, props.currencyCode)}
                            </Text>
                            {calculatorOpen ? (
                                <ChevronUp size={17} color={c.primary} />
                            ) : (
                                <ChevronDown size={17} color={c.textSecondary} />
                            )}
                        </AppPressable>
                        {calculatorOpen && (
                            <View style={[s.denominationPanel, { borderColor: c.outlineMuted }]}>
                                {denominationsLoading ? (
                                    <ActivityIndicator color={c.primary} />
                                ) : denominationError ? (
                                    <Text style={[s.emptyText, { color: c.textSecondary }]}>
                                        {denominationError}
                                    </Text>
                                ) : (
                                    denominations.map((item) => (
                                        <View key={item.id} style={s.denominationRow}>
                                            <Text style={[s.denomination, { color: c.text }]}>
                                                {item.label}
                                            </Text>
                                            <Text style={{ color: c.textSecondary }}>×</Text>
                                            <TextInput
                                                value={counts[item.id] ?? ''}
                                                onChangeText={(value) => updateCount(item, value)}
                                                keyboardType="number-pad"
                                                placeholder="0"
                                                placeholderTextColor={c.textSecondary}
                                                style={[
                                                    s.countInput,
                                                    {
                                                        color: c.text,
                                                        backgroundColor: c.background,
                                                        borderColor: c.outline,
                                                    },
                                                ]}
                                            />
                                            <Text style={[s.lineTotal, { color: c.textSecondary }]}>
                                                {money(
                                                    item.value * (Number(counts[item.id]) || 0),
                                                    props.currencyCode,
                                                )}
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        )}
                        {difference !== undefined && Number.isFinite(difference) && (
                            <Text style={[s.difference, { color: difference === 0 ? c.success : c.error }]}>
                                {difference === 0
                                    ? 'Cash matches'
                                    : `${difference > 0 ? 'Over' : 'Short'} ${money(Math.abs(difference), props.currencyCode)}`}
                            </Text>
                        )}
                        <Text style={[s.label, { color: c.textSecondary }]}>Closing note (optional)</Text>
                        <TextInput
                            value={remarks}
                            onChangeText={setRemarks}
                            placeholder="Add a handover note"
                            placeholderTextColor={c.textSecondary}
                            multiline
                            style={[
                                s.input,
                                s.note,
                                { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                            ]}
                        />
                        <AppPressable
                            disabled={closing}
                            onPress={() => void closeSession()}
                            style={[s.closeSession, { backgroundColor: c.error }]}
                        >
                            {closing ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <LockKeyhole size={17} color="#fff" />
                            )}
                            <Text style={s.closeSessionText}>{closing ? 'Closing…' : 'Close session'}</Text>
                        </AppPressable>
                    </ScrollView>
                </View>
            </AppKeyboardSafeView>
        </Modal>
    );
}

function Summary({ label, value }: { label: string; value: string }) {
    const { themeColors: c } = useAppTheme();
    return (
        <View style={[s.summary, { backgroundColor: c.background, borderColor: c.outlineMuted }]}>
            <Text style={[s.summaryLabel, { color: c.textSecondary }]}>{label}</Text>
            <Text numberOfLines={1} style={[s.summaryValue, { color: c.text }]}>
                {value}
            </Text>
        </View>
    );
}

function money(value: number, currencyCode: string) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
    }).format(value);
}

const s = StyleSheet.create({
    overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,14,19,.48)' },
    dialog: { width: '100%', maxWidth: 460, maxHeight: '90%', borderWidth: 1, borderRadius: 22, padding: 18 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    titleRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    titleCopy: { flex: 1, minWidth: 0 },
    title: { fontSize: 17, fontWeight: '900' },
    subtitle: { marginTop: 2, fontSize: 11 },
    close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    summary: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 10 },
    summaryLabel: { fontSize: 10, fontWeight: '700' },
    summaryValue: { marginTop: 4, fontSize: 14, fontWeight: '900' },
    expected: {
        marginVertical: 12,
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    expectedLabel: { fontSize: 12, fontWeight: '800' },
    expectedValue: { fontSize: 14, fontWeight: '900' },
    label: { marginBottom: 6, marginTop: 8, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
    denominationToggle: {
        minHeight: 42,
        marginTop: 8,
        paddingHorizontal: 11,
        borderRadius: 11,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    denominationToggleText: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '800' },
    denominationTotal: { maxWidth: 105, flexShrink: 1, fontSize: 11, fontWeight: '900' },
    denominationPanel: { marginTop: 8, padding: 10, borderWidth: 1, borderRadius: 12, gap: 7 },
    denominationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    denomination: { width: 76, fontSize: 12, fontWeight: '900' },
    countInput: {
        width: 64,
        height: 34,
        paddingHorizontal: 7,
        borderWidth: 1,
        borderRadius: 8,
        textAlign: 'center',
        fontSize: 12,
    },
    lineTotal: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '700' },
    emptyText: { padding: 12, textAlign: 'center', fontSize: 12, fontWeight: '700' },
    note: { height: 68, paddingTop: 11, textAlignVertical: 'top' },
    difference: { marginTop: 6, fontSize: 11, fontWeight: '900', textAlign: 'right' },
    closeSession: {
        height: 48,
        marginTop: 16,
        borderRadius: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    closeSessionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
