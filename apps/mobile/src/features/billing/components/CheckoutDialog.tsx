import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Banknote, CreditCard, ScanLine, X } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { BillingPaymentMethod, CheckoutPayment, PaymentMethod } from '../types/billing';
import { buildUpiPaymentUri } from '../domain/upiPayment';
import { formatCurrency } from '../../../shared/utils/currency';

type Props = {
  visible: boolean;
  total: number;
  itemCount: number;
  initialMethod: PaymentMethod;
  paymentMethods: BillingPaymentMethod[];
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payment: CheckoutPayment) => void;
  currencyCode?: string;
};

export function CheckoutDialog({
  visible,
  total,
  itemCount,
  initialMethod,
  paymentMethods,
  submitting,
  onClose,
  onConfirm,
  currencyCode = 'INR',
}: Props) {
  const { themeColors: c } = useAppTheme();
  const money = (value: number) => formatCurrency(value, currencyCode);
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [cash, setCash] = useState('');
  const [reference, setReference] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [bankAccountId, setBankAccountId] = useState<number>();

  useEffect(() => {
    if (!visible) return;
    setMethod(initialMethod);
    setCash(initialMethod === 'CASH' ? total.toFixed(2) : '');
    setReference('');
    setCardLast4('');
    const selected = paymentMethods.find((item) => item.code === initialMethod);
    setBankAccountId(
      selected?.defaultBankAccountId ?? selected?.bankAccounts.find((item) => item.isDefault)?.id,
    );
  }, [initialMethod, paymentMethods, total, visible]);

  const selectedMethod = paymentMethods.find((item) => item.code === method);
  const selectedBankAccount = selectedMethod?.bankAccounts.find((item) => item.id === bankAccountId);
  const upiPaymentUri =
    method === 'UPI'
      ? buildUpiPaymentUri({
          upiId: selectedBankAccount?.upiId,
          payeeName: selectedBankAccount?.accountName,
          amount: total,
          currencyCode,
        })
      : undefined;

  const tendered = Number(cash) || 0;
  const changeDue = Math.max(0, tendered - total);
  const cashShort = method === 'CASH' && tendered < total;
  const cardInvalid = method === 'CARD' && cardLast4.length > 0 && cardLast4.length !== 4;
  const blocked = submitting || cashShort || cardInvalid;
  const paymentReference = useMemo(
    () =>
      method === 'CARD'
        ? [cardLast4 ? `CARD-${cardLast4}` : '', reference.trim()].filter(Boolean).join(' · ')
        : reference.trim(),
    [cardLast4, method, reference],
  );

  const confirm = () => {
    if (blocked) return;
    onConfirm({
      method,
      ...(method === 'CASH' ? { tenderedAmount: tendered, changeDue } : {}),
      ...(paymentReference ? { referenceNumber: paymentReference } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <AppPressable accessibilityLabel="Close checkout" style={s.backdrop} onPress={onClose} />
        <SafeAreaView
          edges={['bottom']}
          style={[s.sheet, { backgroundColor: c.surface, borderColor: c.outline }]}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.header, { borderBottomColor: c.outlineMuted }]}>
              <View>
                <Text style={[s.title, { color: c.text }]}>Checkout & payment</Text>
                <Text style={[s.subtitle, { color: c.textSecondary }]}>{itemCount} items to complete</Text>
              </View>
              <AppPressable
                accessibilityLabel="Close checkout"
                onPress={onClose}
                style={[s.close, { backgroundColor: c.surfaceMuted }]}
              >
                <X size={18} color={c.textSecondary} />
              </AppPressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
              <View style={[s.amountCard, { backgroundColor: c.primarySoft }]}>
                <Text style={[s.amountLabel, { color: c.textSecondary }]}>Amount due</Text>
                <Text style={[s.amount, { color: c.primary }]}>{money(total)}</Text>
              </View>
              <Text style={[s.sectionLabel, { color: c.textSecondary }]}>Payment method</Text>
              <View style={s.methods}>
                {paymentMethods.map(({ code, name }) => {
                  const selected = method === code;
                  const Icon = code === 'CASH' ? Banknote : code === 'CARD' ? CreditCard : ScanLine;
                  return (
                    <AppPressable
                      key={code}
                      onPress={() => {
                        setMethod(code);
                        const configured = paymentMethods.find((item) => item.code === code);
                        setBankAccountId(
                          configured?.defaultBankAccountId ??
                            configured?.bankAccounts.find((item) => item.isDefault)?.id,
                        );
                        if (code === 'CASH' && !cash) setCash(total.toFixed(2));
                      }}
                      style={[
                        s.method,
                        {
                          borderColor: selected ? c.primary : c.outline,
                          backgroundColor: selected ? c.primarySoft : c.background,
                        },
                      ]}
                    >
                      <Icon size={19} color={selected ? c.primary : c.textSecondary} />
                      <Text
                        numberOfLines={1}
                        style={[s.methodText, { color: selected ? c.primary : c.text }]}
                      >
                        {name}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
              {method === 'CASH' ? (
                <View>
                  <Text style={[s.inputLabel, { color: c.textSecondary }]}>Cash received</Text>
                  <TextInput
                    value={cash}
                    onChangeText={setCash}
                    keyboardType="decimal-pad"
                    placeholder={total.toFixed(2)}
                    placeholderTextColor={c.textSecondary}
                    style={[
                      s.input,
                      { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                    ]}
                  />
                  <View style={[s.changeRow, { backgroundColor: cashShort ? c.errorSoft : c.surfaceMuted }]}>
                    <Text style={[s.changeLabel, { color: cashShort ? c.error : c.textSecondary }]}>
                      {cashShort ? 'Amount still due' : 'Change due'}
                    </Text>
                    <Text style={[s.changeValue, { color: cashShort ? c.error : c.text }]}>
                      {money(cashShort ? total - tendered : changeDue)}
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  {method === 'CARD' && (
                    <>
                      <Text style={[s.inputLabel, { color: c.textSecondary }]}>Card last 4 digits</Text>
                      <TextInput
                        value={cardLast4}
                        onChangeText={(value) => setCardLast4(value.replace(/\D/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        placeholder="Optional"
                        placeholderTextColor={c.textSecondary}
                        style={[
                          s.input,
                          { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                        ]}
                      />
                    </>
                  )}
                  <Text style={[s.inputLabel, { color: c.textSecondary }]}>
                    {method === 'UPI' ? 'UPI reference / UTR' : 'Authorization / reference'}
                  </Text>
                  <TextInput
                    value={reference}
                    onChangeText={setReference}
                    placeholder="Optional"
                    autoCapitalize="characters"
                    placeholderTextColor={c.textSecondary}
                    style={[
                      s.input,
                      { color: c.text, backgroundColor: c.background, borderColor: c.outline },
                    ]}
                  />
                  {!!selectedMethod?.bankAccounts.filter((account) => account.isActive).length && (
                    <>
                      <Text style={[s.inputLabel, { color: c.textSecondary }]}>Deposit account</Text>
                      <View style={s.accounts}>
                        {selectedMethod.bankAccounts
                          .filter((account) => account.isActive)
                          .map((account) => (
                            <AppPressable
                              key={account.id}
                              onPress={() => setBankAccountId(account.id)}
                              style={[
                                s.account,
                                {
                                  borderColor: bankAccountId === account.id ? c.primary : c.outline,
                                  backgroundColor:
                                    bankAccountId === account.id ? c.primarySoft : c.background,
                                },
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  s.accountName,
                                  { color: bankAccountId === account.id ? c.primary : c.text },
                                ]}
                              >
                                {account.accountName}
                              </Text>
                              <Text numberOfLines={1} style={[s.accountMeta, { color: c.textSecondary }]}>
                                {account.upiId || account.bankName}
                              </Text>
                            </AppPressable>
                          ))}
                      </View>
                    </>
                  )}
                  {upiPaymentUri && (
                    <View style={[s.qrCard, { backgroundColor: c.surfaceMuted }]}>
                      <View style={s.qr}>
                        <QRCode value={upiPaymentUri} size={150} backgroundColor="#FFFFFF" color="#111111" />
                      </View>
                      <Text style={[s.qrTitle, { color: c.text }]}>Scan to pay {money(total)}</Text>
                      <Text style={[s.qrHint, { color: c.textSecondary }]}>
                        Payment goes to {selectedBankAccount?.upiId}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
            <View style={[s.footer, { borderTopColor: c.outlineMuted }]}>
              <AppPressable
                disabled={blocked}
                onPress={confirm}
                style={[s.confirm, { backgroundColor: c.primary, opacity: blocked ? 0.5 : 1 }]}
              >
                <Text style={s.confirmText}>
                  {submitting ? 'Saving sale…' : `Complete · ${money(total)}`}
                </Text>
              </AppPressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8, 12, 22, 0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1 },
  header: {
    minHeight: 68,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { marginTop: 2, fontSize: 11 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 18, gap: 14 },
  amountCard: { padding: 15, borderRadius: 16, alignItems: 'center' },
  amountLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  amount: { marginTop: 3, fontSize: 28, fontWeight: '900' },
  sectionLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  method: {
    minWidth: '30%',
    flexGrow: 1,
    height: 58,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  methodText: { fontSize: 11, fontWeight: '900' },
  accounts: { gap: 7, marginBottom: 12 },
  account: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  accountName: { fontSize: 12, fontWeight: '800' },
  accountMeta: { fontSize: 10, marginTop: 2 },
  qrCard: { borderRadius: 15, padding: 13, alignItems: 'center', marginBottom: 12 },
  qr: { padding: 5, borderRadius: 9, backgroundColor: '#FFFFFF' },
  qrTitle: { marginTop: 9, fontSize: 12, fontWeight: '900' },
  qrHint: { marginTop: 3, fontSize: 9 },
  inputLabel: { marginBottom: 6, fontSize: 11, fontWeight: '800' },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    fontSize: 15,
    marginBottom: 12,
  },
  changeRow: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  changeLabel: { fontSize: 12, fontWeight: '800' },
  changeValue: { fontSize: 16, fontWeight: '900' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
  confirm: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
