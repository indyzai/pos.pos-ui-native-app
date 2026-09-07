import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

// On web this posts the complete callback URL to the window that opened the
// OAuth popup. The caller's openAuthSessionAsync then receives the code.
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackRoute() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator color="#4F46E5" />
      <Text style={styles.message}>Completing sign-in…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#F8FAFC' },
  message: { color: '#334155', fontSize: 15, fontWeight: '600' },
});
