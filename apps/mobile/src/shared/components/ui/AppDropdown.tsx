import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown } from 'lucide-react-native';
import { Menu } from 'react-native-paper';
import { AppPressable } from './AppPressable';
import { useAppTheme } from '../../providers/ThemeProvider';

export type DropdownValue = string | number;
export type DropdownOption<T extends DropdownValue> = { value: T; label: string; disabled?: boolean };

export function AppDropdown<T extends DropdownValue>({
  label,
  value,
  options,
  placeholder = 'Select',
  loading = false,
  disabled = false,
  allowEmpty = false,
  emptyLabel,
  onChange,
}: {
  label?: string;
  value?: T | null;
  options: Array<DropdownOption<T>>;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onChange: (value: T | null) => void;
}) {
  const { themeColors: c } = useAppTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const noOptions = options.length === 0;
  const unavailable = disabled || loading || noOptions;
  const displayValue = loading
    ? 'Loading…'
    : selected?.label || (noOptions ? emptyLabel || 'No options available' : placeholder);

  const select = (nextValue: T | null) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <View style={s.field}>
      {label ? <Text style={[s.label, { color: c.textSecondary }]}>{label}</Text> : null}
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchorPosition="bottom"
        keyboardShouldPersistTaps="handled"
        contentStyle={[s.menu, { backgroundColor: c.surface, borderColor: c.outlineMuted }]}
        anchor={
          <AppPressable
            accessibilityRole="button"
            accessibilityLabel={label ? `${label}: ${displayValue}` : displayValue}
            accessibilityState={{ disabled: unavailable, expanded: open }}
            disabled={unavailable}
            onPress={() => setOpen(true)}
            style={[
              s.control,
              { backgroundColor: c.background, borderColor: open ? c.primary : c.outline },
              unavailable && s.disabled,
            ]}
          >
            {loading ? <ActivityIndicator size="small" color={c.primary} /> : null}
            <Text numberOfLines={1} style={[s.value, { color: selected ? c.text : c.textSecondary }]}>
              {displayValue}
            </Text>
            {!loading ? <ChevronDown size={17} color={open ? c.primary : c.textSecondary} /> : null}
          </AppPressable>
        }
      >
        {allowEmpty ? (
          <DropdownMenuOption label={placeholder} selected={value == null} onPress={() => select(null)} />
        ) : null}
        {options.map((option) => (
          <DropdownMenuOption
            key={String(option.value)}
            label={option.label}
            selected={option.value === value}
            disabled={option.disabled}
            onPress={() => select(option.value)}
          />
        ))}
      </Menu>
    </View>
  );
}

function DropdownMenuOption({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { themeColors: c } = useAppTheme();
  return (
    <AppPressable
      accessibilityRole="menuitem"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[s.option, selected && { backgroundColor: c.primarySoft }, disabled && s.disabled]}
    >
      <Text numberOfLines={2} style={[s.optionLabel, { color: selected ? c.primary : c.text }]}>
        {label}
      </Text>
      {selected ? <Check size={16} color={c.primary} strokeWidth={2.5} /> : null}
    </AppPressable>
  );
}

const s = StyleSheet.create({
  field: { marginBottom: 13 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase' },
  control: {
    height: 46,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: '600' },
  menu: {
    minWidth: 220,
    maxWidth: 360,
    maxHeight: 320,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 5,
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.55 },
});
