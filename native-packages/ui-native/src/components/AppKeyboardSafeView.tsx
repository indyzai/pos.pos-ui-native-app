import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

export function AppKeyboardSafeView({ style, ...props }: ComponentProps<typeof KeyboardAvoidingView>) {
  return (
    <KeyboardAvoidingView
      {...props}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
      style={[s.root, style]}
    />
  );
}

const s = StyleSheet.create({ root: { flex: 1 } });
