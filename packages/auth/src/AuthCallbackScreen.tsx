import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { createLogger } from '@indyzai/pos-core';

WebBrowser.maybeCompleteAuthSession();

export interface AuthCallbackScreenProps {
  code?: string | string[];
  state?: string | string[];
  error?: string;
  loggerScope?: string;
  onComplete: (code: string, state?: string) => Promise<void>;
  onSuccess: (needsDeviceSetup: boolean) => void;
}

export function AuthCallbackScreen({
  code: rawCode,
  state: rawState,
  error: rawError,
  loggerScope = 'Auth:callback',
  onComplete,
  onSuccess,
}: AuthCallbackScreenProps) {
  const logger = createLogger(loggerScope);
  const handled = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (handled.current) return;
    const code = first(rawCode);
    const state = first(rawState);
    logger.info('Callback route loaded', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      platform: Platform.OS,
    });
    if (!code) {
      if (rawError) setError(String(rawError));
      return;
    }
    handled.current = true;
    void (async () => {
      try {
        await onComplete(code, state);
        if (Platform.OS === 'web') {
          logger.info('Closing authentication popup');
          window.close();
          return;
        }
        onSuccess(false);
      } catch (reason) {
        logger.error('Callback failed', reason);
        setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.');
      }
    })();
  }, [rawCode, rawError, rawState, logger, onComplete, onSuccess]);

  return (
    <View style={styles.screen}>
      {!error && <ActivityIndicator color="#4F46E5" />}
      <Text style={[styles.message, Boolean(error) && styles.error]}>{error || 'Completing sign-in…'}</Text>
      {error ? <Text style={styles.help}>Return to sign in and try again.</Text> : null}
    </View>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  message: { color: '#334155', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  error: { color: '#DC2626', fontWeight: '800' },
  help: { color: '#64748B', fontSize: 12 },
});
