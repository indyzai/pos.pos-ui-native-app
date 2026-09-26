import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Building2, Store, X } from 'lucide-react-native';
import { AppPressable } from '../AppPressable';
import { AppDropdown } from '../components/AppDropdown';
import { useAppTheme } from '../theme/ThemeProvider';

export type BusinessContextOption = { id: string; name: string };
export type BranchContextOption = BusinessContextOption & { counters: BusinessContextOption[] };

export function BusinessContextDialog({
  visible,
  businessId,
  businesses,
  branches,
  loading = false,
  onBusinessChange,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  businessId?: string;
  businesses: BusinessContextOption[];
  branches: BranchContextOption[];
  loading?: boolean;
  onBusinessChange: (id: string) => void | Promise<void>;
  onConfirm: (branch: BranchContextOption, counter: BusinessContextOption) => void;
  onClose: () => void;
}) {
  const { themeColors: c } = useAppTheme();
  const [selectedBusiness, setSelectedBusiness] = useState<string | null>(businessId ?? null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedCounter, setSelectedCounter] = useState<string | null>(null);
  const branch = branches.find((item) => item.id === selectedBranch);
  const counter = branch?.counters.find((item) => item.id === selectedCounter);
  const counterOptions = useMemo(() => branch?.counters ?? [], [branch]);

  useEffect(() => {
    if (!visible) return;
    setSelectedBusiness(businessId ?? businesses[0]?.id ?? null);
    setSelectedBranch(branches[0]?.id ?? null);
    setSelectedCounter(branches[0]?.counters[0]?.id ?? null);
  }, [businessId, businesses, branches, visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.card, { backgroundColor: c.surface, borderColor: c.outline }]}>
          <View style={s.heading}>
            <View style={[s.icon, { backgroundColor: c.primarySoft }]}><Building2 size={20} color={c.primary} /></View>
            <View style={s.headingCopy}>
              <Text style={[s.title, { color: c.text }]}>Choose workspace</Text>
              <Text style={[s.subtitle, { color: c.textSecondary }]}>Select your business, branch, and counter.</Text>
            </View>
            <AppPressable accessibilityLabel="Close workspace selector" onPress={onClose} style={s.close}><X size={19} color={c.textSecondary} /></AppPressable>
          </View>
          <AppDropdown label="Business" value={selectedBusiness} options={businesses.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => {
            if (!value || value === selectedBusiness) return;
            setSelectedBusiness(value); setSelectedBranch(null); setSelectedCounter(null); void onBusinessChange(value);
          }} />
          <AppDropdown label="Branch" value={selectedBranch} loading={loading} options={branches.map((item) => ({ value: item.id, label: item.name }))} emptyLabel="No branches available" onChange={(value) => {
            setSelectedBranch(value); const next = branches.find((item) => item.id === value); setSelectedCounter(next?.counters[0]?.id ?? null);
          }} />
          <AppDropdown label="Counter" value={selectedCounter} loading={loading} disabled={!branch} options={counterOptions.map((item) => ({ value: item.id, label: item.name }))} emptyLabel="No counters available" onChange={setSelectedCounter} />
          <View style={[s.note, { backgroundColor: c.surfaceMuted }]}><Store size={15} color={c.textSecondary} /><Text style={[s.noteText, { color: c.textSecondary }]}>A closed counter will ask for its opening balance next.</Text></View>
          <View style={s.actions}>
            <AppPressable onPress={onClose} style={[s.button, { borderColor: c.outline }]}><Text style={[s.buttonText, { color: c.text }]}>Cancel</Text></AppPressable>
            <AppPressable disabled={loading || !branch || !counter} onPress={() => branch && counter && onConfirm(branch, counter)} style={[s.button, { backgroundColor: c.primary, opacity: loading || !branch || !counter ? 0.55 : 1 }]}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[s.buttonText, { color: '#fff' }]}>Continue</Text>}
            </AppPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3, 7, 18, 0.52)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: { width: '100%', maxWidth: 460, overflow: 'visible', borderWidth: 1, borderRadius: 22, padding: 20, elevation: 24, zIndex: 2, boxShadow: '0px 16px 42px rgba(0,0,0,0.24)' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 }, icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, headingCopy: { flex: 1 }, title: { fontSize: 18, fontWeight: '900' }, subtitle: { fontSize: 12, marginTop: 2 }, close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  note: { minHeight: 40, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 }, noteText: { flex: 1, fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }, button: { minWidth: 104, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, buttonText: { fontSize: 13, fontWeight: '800' },
});
