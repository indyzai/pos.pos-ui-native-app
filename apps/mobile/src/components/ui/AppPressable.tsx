import { Pressable, type PressableProps } from 'react-native';

/** Shared press state layer, following the reference app's touch-feedback pattern. */
export function AppPressable({ style, ...props }: PressableProps) {
  return (
    <Pressable
      {...props}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && { opacity: 0.78 },
      ]}
    />
  );
}
