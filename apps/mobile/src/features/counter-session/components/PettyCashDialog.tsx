import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, Wallet, X } from 'lucide-react-native';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';

type Input = { type: 'INCOME' | 'EXPENSE'; amount: number; description?: string };

export function PettyCashDialog({
  visible,
  busy,
  onClose,
  onSave,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (input: Input) => Promise<void>;
}) {
  const { themeColors: c } = useAppTheme();
  const [type, setType] = useState<Input['type']>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  useEffect(() => {
    if (visible) {
      setType('EXPENSE');
      setAmount('');
      setDescription('');
    }
  }, [visible]);
  const value = Number(amount);
  const invalid = !Number.isFinite(value) || value <= 0;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={busy ? undefined : onClose} />
        <View style={[s.dialog, { backgroundColor: c.surface, borderColor: c.outline }]}>
          <View style={s.header}>
            <View style={s.heading}>
              <Wallet size={20} color={c.primary} />
              <View>
                <Text style={[s.title, { color: c.text }]}>Petty cash</Text>
                <Text style={[s.subtitle, { color: c.textSecondary }]}>
                  Record cash against this counter session
                </Text>
              </View>
            </View>
            <AppPressable
              disabled={busy}
              onPress={onClose}
              style={[s.close, { backgroundColor: c.surfaceMuted }]}
            >
              <X size={17} color={c.text} />
            </AppPressable>
          </View>
          <View style={[s.types, { backgroundColor: c.surfaceMuted }]}>
            <TypeButton
              label="Expense out"
              icon={ArrowUpRight}
              active={type === 'EXPENSE'}
              color={c.error}
              onPress={() => setType('EXPENSE')}
            />
            <TypeButton
              label="Income in"
              icon={ArrowDownLeft}
              active={type === 'INCOME'}
              color={c.success}
              onPress={() => setType('INCOME')}
            />
          </View>
          <Text style={[s.label, { color: c.textSecondary }]}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={c.textSecondary}
            style={[s.input, { color: c.text, backgroundColor: c.background, borderColor: c.outline }]}
          />
          <Text style={[s.label, { color: c.textSecondary }]}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Reason or category"
            placeholderTextColor={c.textSecondary}
            multiline
            style={[
              s.input,
              s.notes,
              { color: c.text, backgroundColor: c.background, borderColor: c.outline },
            ]}
          />
          <AppPressable
            disabled={invalid || busy}
            onPress={() => void onSave({ type, amount: value, description: description.trim() || undefined })}
            style={[
              s.save,
              {
                backgroundColor: type === 'EXPENSE' ? c.error : c.success,
                opacity: invalid || busy ? 0.45 : 1,
              },
            ]}
          >
            <Text style={s.saveText}>
              {busy ? 'Recording…' : `Record ${type === 'EXPENSE' ? 'expense' : 'income'}`}
            </Text>
          </AppPressable>
        </View>
      </View>
    </Modal>
  );
}

function TypeButton({
  label,
  icon: Icon,
  active,
  color,
  onPress,
}: {
  label: string;
  icon: typeof Wallet;
  active: boolean;
  color: string;
  onPress: () => void;
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <AppPressable onPress={onPress} style={[s.type, { backgroundColor: active ? c.surface : 'transparent' }]}>
      <Icon size={16} color={active ? color : c.textSecondary} />
      <Text style={[s.typeText, { color: active ? color : c.textSecondary }]}>{label}</Text>
    </AppPressable>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,12,22,.55)' },
  dialog: { width: '100%', maxWidth: 430, borderWidth: 1, borderRadius: 22, padding: 17 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 17, fontWeight: '900' },
  subtitle: { fontSize: 10, marginTop: 2 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  types: { flexDirection: 'row', padding: 4, borderRadius: 13, marginBottom: 15 },
  type: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  typeText: { fontSize: 11, fontWeight: '900' },
  label: { fontSize: 10, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 47, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginBottom: 13 },
  notes: { minHeight: 72, paddingTop: 11, textAlignVertical: 'top' },
  save: { height: 49, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
