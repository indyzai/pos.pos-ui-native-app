import { useRef, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppPressable } from '../AppPressable';
import { useAppTheme } from '../theme/ThemeProvider';

export type SectionMenuItem<T extends string> = { id: T; label: string };
export type SectionMenuGroup<T extends string> = { label: string; items: readonly SectionMenuItem<T>[] };

export function SectionMenu<T extends string>({ value, groups, onChange, accessibilityLabel = 'section' }: {
  value: T; groups: readonly SectionMenuGroup<T>[]; onChange: (value: T) => void; accessibilityLabel?: string;
}) {
  const { themeColors: c } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(75);
  const anchor = useRef<View>(null);
  const show = () => anchor.current?.measureInWindow((_x, y, _width, height) => { setTop(y + height + 4); setOpen(true); });
  return <>
    <View ref={anchor} collapsable={false} style={s.anchor}>
      <AppPressable accessibilityLabel={`${open ? 'Close' : 'Open'} ${accessibilityLabel} navigation`} onPress={() => open ? setOpen(false) : show()} style={[s.button, { backgroundColor: c.primary }]}>
        {open ? <X size={19} color="#fff" /> : <ChevronLeft size={20} color="#fff" />}
      </AppPressable>
    </View>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={s.overlay}>
        <Pressable accessibilityLabel={`Close ${accessibilityLabel} navigation`} style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View style={[s.menu, { top, backgroundColor: c.surface, borderColor: c.outline }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
            {groups.map((group) => <View key={group.label} style={s.group}>
              <Text style={[s.groupLabel, { color: c.textSecondary }]}>{group.label}</Text>
              {group.items.map((item) => <AppPressable key={item.id} onPress={() => { onChange(item.id); setOpen(false); }} style={[s.item, value === item.id && { backgroundColor: c.primarySoft }]}>
                <Text style={[s.itemText, { color: value === item.id ? c.primary : c.text }]}>{item.label}</Text>
              </AppPressable>)}
            </View>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  anchor: { position: 'absolute', right: 0, top: 30, zIndex: 5 }, button: { width: 36, height: 44, borderTopLeftRadius: 22, borderBottomLeftRadius: 22, alignItems: 'center', justifyContent: 'center' }, overlay: { flex: 1 },
  menu: { position: 'absolute', right: 0, width: 210, maxHeight: '78%', borderWidth: 1, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, elevation: 18, boxShadow: '0px 10px 28px rgba(0,0,0,0.18)' }, content: { padding: 8 }, group: { marginBottom: 5 },
  groupLabel: { paddingHorizontal: 12, paddingTop: 7, paddingBottom: 4, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' }, item: { minHeight: 38, paddingHorizontal: 12, borderRadius: 9, alignItems: 'flex-start', justifyContent: 'center' }, itemText: { fontSize: 12, fontWeight: '800' },
});
