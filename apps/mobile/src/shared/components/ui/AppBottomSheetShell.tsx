import type { ReactNode } from 'react';
import { X } from 'lucide-react-native';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type PanResponderInstance,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../providers/ThemeProvider';
import { AppKeyboardSafeView } from './AppKeyboardSafeView';
import { AppPressable } from './AppPressable';

export function AppBottomSheetShell({
  visible,
  onClose,
  children,
  animatedStyle,
  dragHandlers,
  title,
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  animatedStyle?: StyleProp<Animated.WithAnimatedValue<ViewStyle>>;
  dragHandlers?: PanResponderInstance['panHandlers'];
  title?: string;
  subtitle?: string;
}) {
  const { themeColors: c } = useAppTheme();
  const { width } = useWindowDimensions();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <AppKeyboardSafeView style={s.modal}>
        <Pressable accessibilityLabel="Close panel" style={s.backdrop} onPress={onClose} />
        <Animated.View
          style={[s.sheet, { backgroundColor: c.surface }, width >= 700 && s.tabletSheet, animatedStyle]}
        >
          <View {...dragHandlers} style={s.dragArea}>
            <View style={[s.handle, { backgroundColor: c.outline }]} />
          </View>
          {title ? (
            <View style={[s.header, { borderBottomColor: c.outlineMuted }]}>
              <View style={s.headerCopy}>
                <Text style={[s.title, { color: c.text }]}>{title}</Text>
                {subtitle ? <Text style={[s.subtitle, { color: c.textSecondary }]}>{subtitle}</Text> : null}
              </View>
              <AppPressable
                accessibilityLabel={`Close ${title}`}
                onPress={onClose}
                style={[s.close, { backgroundColor: c.surfaceMuted }]}
              >
                <X size={19} color={c.textSecondary} />
              </AppPressable>
            </View>
          ) : null}
          {children}
        </Animated.View>
      </AppKeyboardSafeView>
    </Modal>
  );
}

const s = StyleSheet.create({
  modal: { justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11, 16, 24, 0.45)' },
  sheet: {
    height: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  tabletSheet: { width: 480, alignSelf: 'center' },
  dragArea: { height: 22, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 42, height: 4, borderRadius: 2 },
  header: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
