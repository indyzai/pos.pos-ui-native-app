import { useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../../constants/theme';

export function SwipeableCartRow({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const removed = useRef(false);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dx < -6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          removed.current = false;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_event, gesture) => translateX.setValue(Math.max(-120, Math.min(0, gesture.dx))),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -54 || gesture.vx < -0.55) {
            removed.current = true;
            Animated.timing(translateX, { toValue: -120, duration: 140, useNativeDriver: true }).start(
              ({ finished }) => {
                if (finished) onRemove();
              },
            );
            return;
          }
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          if (!removed.current) Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [onRemove, translateX],
  );

  return (
    <View style={s.container}>
      <View style={s.removeAction}>
        <Text style={s.removeText}>Remove</Text>
      </View>
      <Animated.View {...panResponder.panHandlers} style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: colors.error },
  removeAction: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 16,
  },
  removeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
});
