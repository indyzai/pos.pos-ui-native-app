import { useEffect, useMemo, useState } from 'react';
import { Minus, Package, Plus, Shield, Timer, UserRound, Wrench, X } from 'lucide-react-native';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { AppKeyboardSafeView } from '../../../shared/components/ui/AppKeyboardSafeView';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import type { CartCustomization, Product, ServiceUser } from '../types/billing';
import { formatCurrency } from '../../../shared/utils/currency';

type PartLine = { product: Product; quantity: number };

export function ServiceConfigurationDialog({
  product,
  products,
  technicians,
  onClose,
  onAdd,
  currencyCode = 'INR',
}: {
  product?: Product;
  products: Product[];
  technicians: ServiceUser[];
  onClose: () => void;
  onAdd: (product: Product, customization: CartCustomization, parts: PartLine[]) => void;
  currencyCode?: string;
}) {
  const { themeColors: c } = useAppTheme();
  const [technicianId, setTechnicianId] = useState('');
  const [duration, setDuration] = useState('60');
  const [warranty, setWarranty] = useState('0');
  const [partSearch, setPartSearch] = useState('');
  const [parts, setParts] = useState<PartLine[]>([]);
  useEffect(() => {
    if (!product) return;
    setTechnicianId(product.details?.serviceUserId || '');
    setDuration(String(product.details?.serviceDurationMinutes || 60));
    setWarranty(String(product.details?.warrantyMonths || 0));
    setPartSearch('');
    setParts([]);
  }, [product]);
  const availableParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter(
        (item) =>
          item.id !== product?.id &&
          !item.details?.serviceDurationMinutes &&
          (item.name.toLowerCase().includes(query) || item.sku?.toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [partSearch, product?.id, products]);
  if (!product) return null;
  const technician = technicians.find((item) => item.id === technicianId);
  const updatePart = (part: Product, change: number) =>
    setParts((current) => {
      const quantity = (current.find((item) => item.product.id === part.id)?.quantity || 0) + change;
      if (quantity <= 0) return current.filter((item) => item.product.id !== part.id);
      if (quantity > part.stock) return current;
      return current.some((item) => item.product.id === part.id)
        ? current.map((item) => (item.product.id === part.id ? { ...item, quantity } : item))
        : [...current, { product: part, quantity }];
    });
  const durationMinutes = Math.max(1, Number.parseInt(duration, 10) || 60);
  const warrantyMonths = Math.max(0, Number.parseInt(warranty, 10) || 0);
  const partsTotal = parts.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const confirm = () => {
    const key = [technicianId || 'unassigned', durationMinutes, warrantyMonths, Date.now()].join(':');
    onAdd(
      product,
      {
        key,
        label: [
          technician?.name,
          `${durationMinutes} min`,
          warrantyMonths ? `${warrantyMonths} mo warranty` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        notes: product.details?.serviceInstructions,
        metadata: {
          technicianId: technician?.id,
          technicianName: technician?.name,
          durationMinutes,
          warrantyMonths,
          parts: parts.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        },
      },
      parts,
    );
    onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <AppKeyboardSafeView style={s.overlay}>
        <AppPressable accessibilityLabel="Close service configuration" onPress={onClose} style={s.backdrop} />
        <SafeAreaView edges={['bottom']} style={[s.sheet, { backgroundColor: c.surface }]}>
          <View style={s.header}>
            <View style={s.heading}>
              <Wrench size={20} color={c.primary} />
              <View>
                <Text style={[s.title, { color: c.text }]}>Configure service</Text>
                <Text style={[s.subtitle, { color: c.textSecondary }]}>{product.name}</Text>
              </View>
            </View>
            <AppPressable accessibilityLabel="Close" onPress={onClose} style={s.iconButton}>
              <X size={19} color={c.textSecondary} />
            </AppPressable>
          </View>
          <ScrollView
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            contentContainerStyle={s.body}
            keyboardShouldPersistTaps="handled"
          >
            <FieldLabel icon={UserRound} label="Assign technician" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <Choice label="Unassigned" active={!technicianId} onPress={() => setTechnicianId('')} />
              {technicians
                .filter((item) => item.isActive !== false)
                .map((item) => (
                  <Choice
                    key={item.id}
                    label={`${item.name}${item.specialization ? ` · ${item.specialization}` : ''}`}
                    active={technicianId === item.id}
                    onPress={() => setTechnicianId(item.id)}
                  />
                ))}
            </ScrollView>
            <View style={s.twoColumns}>
              <View style={s.column}>
                <FieldLabel icon={Timer} label="Duration (min)" />
                <TextInput
                  keyboardType="number-pad"
                  value={duration}
                  onChangeText={setDuration}
                  style={[
                    s.input,
                    { color: c.text, backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted },
                  ]}
                />
              </View>
              <View style={s.column}>
                <FieldLabel icon={Shield} label="Warranty (months)" />
                <TextInput
                  keyboardType="number-pad"
                  value={warranty}
                  onChangeText={setWarranty}
                  style={[
                    s.input,
                    { color: c.text, backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted },
                  ]}
                />
              </View>
            </View>
            {product.details?.serviceInstructions ? (
              <Text style={[s.instructions, { color: c.textSecondary, backgroundColor: c.surfaceMuted }]}>
                {product.details.serviceInstructions}
              </Text>
            ) : null}
            <FieldLabel icon={Package} label="Parts used" />
            <TextInput
              value={partSearch}
              onChangeText={setPartSearch}
              placeholder="Search inventory parts"
              placeholderTextColor={c.textSecondary}
              style={[
                s.input,
                { color: c.text, backgroundColor: c.surfaceMuted, borderColor: c.outlineMuted },
              ]}
            />
            {availableParts.map((item) => (
              <AppPressable key={item.id} onPress={() => updatePart(item, 1)} style={s.searchResult}>
                <Text numberOfLines={1} style={[s.partName, { color: c.text }]}>
                  {item.name}
                </Text>
                <Text style={[s.partPrice, { color: c.primary }]}>
                  {formatCurrency(item.price, currencyCode)}
                </Text>
                <Plus size={16} color={c.primary} />
              </AppPressable>
            ))}
            {parts.map((item) => (
              <View key={item.product.id} style={[s.partRow, { borderColor: c.outlineMuted }]}>
                <Text numberOfLines={1} style={[s.partName, { color: c.text }]}>
                  {item.product.name}
                </Text>
                <AppPressable onPress={() => updatePart(item.product, -1)} style={s.qtyButton}>
                  <Minus size={14} color={c.text} />
                </AppPressable>
                <Text style={[s.quantity, { color: c.text }]}>{item.quantity}</Text>
                <AppPressable onPress={() => updatePart(item.product, 1)} style={s.qtyButton}>
                  <Plus size={14} color={c.text} />
                </AppPressable>
                <Text style={[s.partPrice, { color: c.text }]}>
                  {formatCurrency(item.product.price * item.quantity, currencyCode)}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={[s.footer, { borderTopColor: c.outlineMuted }]}>
            <View>
              <Text style={[s.totalLabel, { color: c.textSecondary }]}>Service total</Text>
              <Text style={[s.total, { color: c.text }]}>
                {formatCurrency(product.price + partsTotal, currencyCode)}
              </Text>
            </View>
            <AppPressable onPress={confirm} style={[s.confirm, { backgroundColor: c.primary }]}>
              <Text style={s.confirmText}>Add to cart</Text>
            </AppPressable>
          </View>
        </SafeAreaView>
      </AppKeyboardSafeView>
    </Modal>
  );
}

function FieldLabel({ icon: Icon, label }: { icon: typeof Timer; label: string }) {
  const { themeColors: c } = useAppTheme();
  return (
    <View style={s.labelRow}>
      <Icon size={13} color={c.textSecondary} />
      <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}
function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { themeColors: c } = useAppTheme();
  return (
    <AppPressable
      onPress={onPress}
      style={[
        s.choice,
        {
          backgroundColor: active ? c.primary : c.surfaceMuted,
          borderColor: active ? c.primary : c.outlineMuted,
        },
      ]}
    >
      <Text style={[s.choiceText, { color: active ? '#FFFFFF' : c.text }]}>{label}</Text>
    </AppPressable>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(10,15,25,0.56)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },
  iconButton: { padding: 8 },
  body: { paddingHorizontal: 16, paddingBottom: 18, gap: 9 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  label: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { gap: 7 },
  choice: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  choiceText: { fontSize: 10, fontWeight: '800' },
  twoColumns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 7 },
  input: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
    fontSize: 12,
    fontWeight: '700',
  },
  instructions: { borderRadius: 10, padding: 10, fontSize: 11, lineHeight: 16 },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  partRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  partName: { flex: 1, fontSize: 11, fontWeight: '700' },
  partPrice: { minWidth: 62, textAlign: 'right', fontSize: 11, fontWeight: '800' },
  qtyButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 18, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  totalLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  total: { fontSize: 17, fontWeight: '900', marginTop: 2 },
  confirm: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
});
