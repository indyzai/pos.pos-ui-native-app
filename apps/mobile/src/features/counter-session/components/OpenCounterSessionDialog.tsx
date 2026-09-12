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
import { Calculator, ChevronDown, ChevronUp, Play, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { AppKeyboardSafeView } from '../../../shared/components/ui/AppKeyboardSafeView';
import { showSnackbar } from '../../../shared/providers/SnackbarProvider';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { counterSessionApi } from '../counterSessionApi';
import { loadDenominationCounts, saveDenominationCounts } from '../denominationStorage';
import type { CurrencyDenomination, DenominationCounts } from '../types';

type Props = {
  visible: boolean;
  token?: string;
  tenantId?: string;
  branchName?: string;
  counterId?: string;
  counterName?: string;
  currencyCode: string;
  onClose: () => void;
  onOpened: () => Promise<void>;
};

export function OpenCounterSessionDialog(props: Props) {
  const { themeColors: c } = useAppTheme();
  const [openingBalance, setOpeningBalance] = useState('0');
  const [counts, setCounts] = useState<DenominationCounts>({});
  const [denominations, setDenominations] = useState<CurrencyDenomination[]>([]);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [denominationError, setDenominationError] = useState<string>();
  const [opening, setOpening] = useState(false);
  const total = useMemo(
    () => denominations.reduce((sum, item) => sum + item.value * (Number(counts[item.id]) || 0), 0),
    [counts, denominations],
  );

  useEffect(() => {
    if (!props.visible || !props.token || !props.tenantId || !props.counterId) return;
    let active = true;
    setLoading(true);
    setDenominationError(undefined);
    void Promise.all([
      counterSessionApi.getDenominations(props.token, props.tenantId, props.currencyCode),
      loadDenominationCounts(props.tenantId, props.counterId, props.currencyCode),
    ])
      .then(([loadedDenominations, loadedCounts]) => {
        if (!active) return;
        setDenominations(loadedDenominations);
        setCounts(loadedCounts);
        setOpeningBalance(
          String(
            loadedDenominations.reduce(
              (sum, item) => sum + item.value * (Number(loadedCounts[item.id]) || 0),
              0,
            ),
          ),
        );
        if (!loadedDenominations.length) {
          setDenominationError(`No denominations are configured for ${props.currencyCode}.`);
        }
      })
      .catch((error) => {
        if (!active) return;
        setDenominations([]);
        setDenominationError(
          error instanceof Error ? error.message : 'Could not load currency denominations.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [props.counterId, props.currencyCode, props.tenantId, props.token, props.visible]);

  const updateCount = (item: CurrencyDenomination, count: string) => {
    const sanitized = count.replace(/[^0-9]/g, '');
    setCounts((current) => {
      const next = { ...current, [item.id]: sanitized };
      const nextTotal = denominations.reduce(
        (sum, denomination) => sum + denomination.value * (Number(next[denomination.id]) || 0),
        0,
      );
      setOpeningBalance(String(nextTotal));
      if (props.tenantId && props.counterId) {
        void saveDenominationCounts(props.tenantId, props.counterId, props.currencyCode, next);
      }
      return next;
    });
  };

  const open = async () => {
    const balance = Number(openingBalance);
    if (!props.token || !props.tenantId || !props.counterId) {
      showSnackbar('Counter unavailable', 'Add a branch and counter before opening a session.');
      return;
    }
    if (!Number.isFinite(balance) || balance < 0) {
      showSnackbar('Opening cash', 'Enter a valid non-negative opening balance.');
      return;
    }
    setOpening(true);
    try {
      await counterSessionApi.open(props.token, props.tenantId, props.counterId, balance);
      await saveDenominationCounts(props.tenantId, props.counterId, props.currencyCode, counts);
      props.onClose();
      await props.onOpened();
    } catch (error) {
      showSnackbar('Could not open counter', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <Modal transparent visible={props.visible} animationType="fade" onRequestClose={props.onClose}>
      <AppKeyboardSafeView style={s.overlay}>
        <Pressable style={s.backdrop} onPress={opening ? undefined : props.onClose} />
        <View style={[s.dialog, { backgroundColor: c.surface, borderColor: c.outline }]}>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.header}>
              <View>
                <Text style={[s.title, { color: c.text }]}>Open counter session</Text>
                <Text style={[s.subtitle, { color: c.textSecondary }]}>
                  {props.branchName || 'Branch'} · {props.counterName || 'Counter'} · {props.currencyCode}
                </Text>
              </View>
              <AppPressable
                disabled={opening}
                onPress={props.onClose}
                style={[s.close, { backgroundColor: c.surfaceMuted }]}
              >
                <X size={18} color={c.text} />
              </AppPressable>
            </View>
            <Text style={[s.inputLabel, { color: c.textSecondary }]}>Opening cash amount</Text>
            <TextInput
              value={openingBalance}
              onChangeText={setOpeningBalance}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="0.00"
              placeholderTextColor={c.textSecondary}
              style={[
                s.balanceInput,
                { color: c.text, backgroundColor: c.background, borderColor: c.outline },
              ]}
            />
            <AppPressable
              onPress={() => setCalculatorOpen((value) => !value)}
              style={[s.toggle, { backgroundColor: c.surfaceMuted }]}
            >
              <Calculator size={16} color={c.primary} />
              <Text numberOfLines={1} style={[s.toggleText, { color: c.text }]}>
                Count denominations
              </Text>
              <Text numberOfLines={1} style={[s.total, { color: c.primary }]}>
                {formatMoney(total, props.currencyCode)}
              </Text>
              <View style={[s.collapseIcon, { backgroundColor: c.surface }]}>
                {calculatorOpen ? (
                  <ChevronUp size={17} color={c.primary} strokeWidth={2.5} />
                ) : (
                  <ChevronDown size={17} color={c.textSecondary} strokeWidth={2.5} />
                )}
              </View>
            </AppPressable>
            {calculatorOpen && (
              <View style={[s.panel, { borderColor: c.outlineMuted }]}>
                {loading ? (
                  <ActivityIndicator color={c.primary} />
                ) : denominationError ? (
                  <Text style={[s.emptyText, { color: c.textSecondary }]}>{denominationError}</Text>
                ) : (
                  denominations.map((item) => (
                    <View key={item.id} style={s.row}>
                      <Text style={[s.denomination, { color: c.text }]}>{item.label}</Text>
                      <Text style={{ color: c.textSecondary }}>×</Text>
                      <TextInput
                        value={counts[item.id] ?? ''}
                        onChangeText={(count) => updateCount(item, count)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={c.textSecondary}
                        style={[
                          s.count,
                          { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                        ]}
                      />
                      <Text style={[s.lineTotal, { color: c.textSecondary }]}>
                        {formatMoney(item.value * (Number(counts[item.id]) || 0), props.currencyCode)}
                      </Text>
                    </View>
                  ))
                )}
                {!loading && !denominationError && (
                  <AppPressable
                    accessibilityLabel="Collapse denomination calculator"
                    onPress={() => setCalculatorOpen(false)}
                    style={[s.collapseAction, { backgroundColor: c.surfaceMuted }]}
                  >
                    <ChevronUp size={16} color={c.primary} strokeWidth={2.5} />
                    <Text style={[s.collapseActionText, { color: c.primary }]}>Hide denominations</Text>
                  </AppPressable>
                )}
              </View>
            )}
            <AppPressable
              disabled={opening || !props.counterId}
              onPress={() => void open()}
              style={[s.open, { backgroundColor: c.primary, opacity: opening || !props.counterId ? 0.6 : 1 }]}
            >
              {opening ? <ActivityIndicator color="#fff" /> : <Play size={17} color="#fff" fill="#fff" />}
              <Text style={s.openText}>{opening ? 'Opening…' : 'Open counter'}</Text>
            </AppPressable>
          </ScrollView>
        </View>
      </AppKeyboardSafeView>
    </Modal>
  );
}

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(12,14,19,.42)' },
  dialog: { width: '100%', maxWidth: 420, maxHeight: '90%', borderWidth: 1, borderRadius: 22, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 4 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  balanceInput: { height: 48, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 16 },
  toggle: {
    minHeight: 44,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '800' },
  total: { maxWidth: 104, flexShrink: 1, fontSize: 12, fontWeight: '900' },
  collapseIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: { marginTop: 10, borderWidth: 1, borderRadius: 13, padding: 10, gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  denomination: { width: 76, fontSize: 12, fontWeight: '900' },
  count: {
    width: 68,
    height: 36,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 12,
  },
  lineTotal: { flex: 1, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  collapseAction: {
    height: 38,
    marginTop: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  collapseActionText: { fontSize: 12, fontWeight: '900' },
  emptyText: { padding: 14, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  open: {
    height: 48,
    borderRadius: 13,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
