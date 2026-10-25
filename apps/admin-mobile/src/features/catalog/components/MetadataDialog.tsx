import { translateUI } from '@indyzai/pos-ui-native/i18n';
import { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, View, StyleSheet } from 'react-native';
import { AppPressable, useAppTheme, showSnackbar } from '@indyzai/pos-ui-native';
import { categoryTypes, type MetadataKind } from '@indyzai/feature-catalog/metadataApi';
import { metadataApi } from '../metadataApi';
export function MetadataDialog({ kind, onClose }: { kind: MetadataKind; onClose: () => void }) {
  const { themeColors: c } = useAppTheme();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState(kind === 'categories' ? 'INVENTORY' : '');
  const [description, setDescription] = useState('');
  const [percentage, setPercentage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const label = kind === 'units' ? 'unit' : kind === 'categories' ? 'category' : 'tax rate';
  const field = (label: string, value: string, onChange: (value: string) => void, numeric = false) => (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!busy}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        style={[s.input, { color: c.text, borderColor: c.outline }]}
      />
    </View>
  );
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await metadataApi.create(kind, {
        name,
        code,
        type,
        description,
        percentage: percentage.trim() ? Number(percentage) : undefined,
      });
      showSnackbar(
        `${label[0].toUpperCase()}${label.slice(1)} saved`,
        'Saved on this device. Sync will run when connected.',
      );
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={s.overlay}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={s.container}
        >
          <View style={[s.dialog, { backgroundColor: c.surface }]}>
            <Text style={{ color: c.text, fontSize: 22, fontWeight: '800' }}>
              {translateUI('Add')}
              {label}
            </Text>
            {field('Name', name, setName)}
            {kind === 'units' && (
              <>
                {field('Code / abbreviation', code, setCode)}
                {field('Unit type (optional)', type, setType)}
              </>
            )}
            {kind === 'categories' && (
              <>
                <Text style={{ color: c.text }}>Category type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categoryTypes.map((option) => (
                    <AppPressable
                      key={option}
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityState={{ selected: type === option }}
                      onPress={() => setType(option)}
                      style={[s.button, { backgroundColor: type === option ? c.primary : c.surfaceMuted }]}
                    >
                      <Text style={{ color: type === option ? '#fff' : c.text }}>{option}</Text>
                    </AppPressable>
                  ))}
                </View>
                {field('Description (optional)', description, setDescription)}
              </>
            )}
            {kind === 'tax_rates' && field('Tax percentage', percentage, setPercentage, true)}
            {error ? (
              <Text accessibilityRole="alert" style={{ color: c.text }}>
                {error}
              </Text>
            ) : null}
            <Text style={{ color: c.textSecondary }}>
              Available immediately offline. Pending entries stay on this device until synchronization
              succeeds.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <AppPressable disabled={busy} onPress={onClose} style={s.button}>
                <Text style={{ color: c.text }}>{translateUI('Cancel')}</Text>
              </AppPressable>
              <AppPressable
                disabled={busy}
                onPress={() => void save()}
                style={[s.button, { backgroundColor: c.primary }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? 'Saving…' : 'Save locally'}</Text>
              </AppPressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 520, padding: 20, borderRadius: 20, gap: 16 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  button: { minHeight: 44, padding: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
