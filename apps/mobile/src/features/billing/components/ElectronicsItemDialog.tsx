import { useEffect, useState } from 'react';
import { Barcode, ShieldCheck, Smartphone, X } from 'lucide-react-native';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { AppKeyboardSafeView } from '../../../shared/components/ui/AppKeyboardSafeView';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CartCustomization, Product } from '../types/billing';

export function ElectronicsItemDialog({
  product,
  onClose,
  onAdd,
}: {
  product?: Product;
  onClose: () => void;
  onAdd: (product: Product, customization: CartCustomization) => void;
}) {
  const { themeColors: c } = useAppTheme();
  const [serial, setSerial] = useState('');
  const [warranty, setWarranty] = useState('0');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!product) return;
    setSerial(product.details?.serialNumber || '');
    setWarranty(String(product.details?.warrantyMonths || 0));
    setError('');
  }, [product]);
  if (!product) return null;
  const confirm = () => {
    const serialNumber = serial.trim();
    if (product.details?.serialRequired && !serialNumber) {
      setError('Serial number or IMEI is required for this product.');
      return;
    }
    const warrantyMonths = Math.max(0, Number.parseInt(warranty, 10) || 0);
    onAdd(product, {
      key: `device:${serialNumber || 'untracked'}:${Date.now()}`,
      label: [serialNumber && `Serial ${serialNumber}`, warrantyMonths && `${warrantyMonths} mo warranty`]
        .filter(Boolean)
        .join(' · '),
      metadata: { serialNumber: serialNumber || undefined, warrantyMonths },
    });
    onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <AppKeyboardSafeView style={s.overlay}>
        <AppPressable accessibilityLabel="Close device details" onPress={onClose} style={s.backdrop} />
        <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.surface }]}>
          <View style={s.header}>
            <View style={s.heading}>
              <Smartphone size={21} color={c.primary} />
              <View>
                <Text style={[s.title, { color: c.text }]}>Device details</Text>
                <Text style={[s.subtitle, { color: c.textSecondary }]}>{product.name}</Text>
              </View>
            </View>
            <AppPressable accessibilityLabel="Close" onPress={onClose} style={s.iconButton}>
              <X size={19} color={c.textSecondary} />
            </AppPressable>
          </View>
          <View style={s.body}>
            <View style={s.labelRow}>
              <Barcode size={14} color={c.textSecondary} />
              <Text style={[s.label, { color: c.textSecondary }]}>Serial number / IMEI</Text>
            </View>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={product.details?.serialRequired ? 'Required' : 'Optional'}
              placeholderTextColor={c.textSecondary}
              value={serial}
              onChangeText={(value) => {
                setSerial(value);
                setError('');
              }}
              style={[
                s.input,
                {
                  color: c.text,
                  backgroundColor: c.surfaceMuted,
                  borderColor: error ? c.error : c.outlineMuted,
                },
              ]}
            />
            {error ? <Text style={[s.error, { color: c.error }]}>{error}</Text> : null}
            <View style={s.labelRow}>
              <ShieldCheck size={14} color={c.textSecondary} />
              <Text style={[s.label, { color: c.textSecondary }]}>Warranty months</Text>
            </View>
            <TextInput
              keyboardType="number-pad"
              value={warranty}
              onChangeText={setWarranty}
              style={[
                s.input,
                { color: c.text, backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted },
              ]}
            />
            <AppPressable onPress={confirm} style={[s.confirm, { backgroundColor: c.primary }]}>
              <Text style={s.confirmText}>Add device to cart</Text>
            </AppPressable>
          </View>
        </SafeAreaView>
      </AppKeyboardSafeView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,15,25,0.56)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },
  iconButton: { padding: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 18, gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  label: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  error: { fontSize: 10, fontWeight: '700' },
  confirm: { minHeight: 48, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  confirmText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
