import { ExternalLink, ShoppingCart } from 'lucide-react-native';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { AppPressable } from '@indyzai/pos-ui-native';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { useAppTheme } from '@indyzai/pos-ui-native';
import { authApi } from '../auth/authApi';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useState } from 'react';
import { createLogger } from '@indyzai/pos-utils';

const logger = createLogger('Admin:billing');

const posWebUrl =
  process.env.EXPO_PUBLIC_POS_APP_URL ??
  (typeof __DEV__ !== 'undefined' && __DEV__ ? 'http://localhost:3511/billing' : 'https://pos.indyzai.com/');
async function openPosBilling(tenantId: string): Promise<void> {
  logger.info('Opening POS billing app handoff', { tenantId });
  const [handoff, authUiUrl] = await Promise.all([
    authApi.createAppHandoff(tenantId),
    authApi.getApplicationRedirectUrl('auth'),
  ]);
  const posDestination = new URL(
    Platform.OS === 'web' ? '/auth/handoff' : 'indyzai-pos://auth/handoff',
    posWebUrl,
  );
  posDestination.searchParams.set('tenantId', handoff.tenantId);
  const authDestination = new URL('/tauri/callback', authUiUrl);
  authDestination.searchParams.set('code', handoff.code);
  authDestination.searchParams.set('callback', posDestination.toString());
  logger.info('Opening auth handoff page', { authOrigin: authDestination.origin });
  await Linking.openURL(authDestination.toString());
}

export default function BillingRoute() {
  const { themeColors: c } = useAppTheme();
  const { session } = useAuthSession();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const switchToPos = async () => {
    if (!session || switching) return;
    setSwitching(true);
    setError('');
    try {
      await openPosBilling(String(session.tenant.id));
    } catch (reason) {
      const errorMessage = reason instanceof Error ? reason.message : 'Could not open the POS app.';
      logger.error('Failed to open POS billing', { error: errorMessage });
      setError(errorMessage);
      setSwitching(false);
    }
  };
  return (
    <BottomNavigationProvider>
      <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]} edges={['left', 'right']}>
        <View style={styles.content}>
          <View style={[styles.icon, { backgroundColor: c.primarySoft }]}>
            <ShoppingCart size={34} color={c.primary} strokeWidth={2} />
          </View>
          <Text style={[styles.title, { color: c.text }]}>Billing is available in the POS app</Text>
          <Text style={[styles.body, { color: c.textSecondary }]}>
            Switch to IndyzAI POS to create bills, manage the cart, take payments, and print receipts.
          </Text>
          <AppPressable
            accessibilityRole="link"
            accessibilityLabel="Open IndyzAI POS billing"
            disabled={!session || switching}
            onPress={() => void switchToPos()}
            style={[styles.button, { backgroundColor: c.primary }]}
          >
            {switching ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
            <Text style={styles.buttonText}>{switching ? 'Switching…' : 'Open POS app'}</Text>
            {!switching ? <ExternalLink size={18} color="#FFFFFF" strokeWidth={2.3} /> : null}
          </AppPressable>
          {!!error && <Text style={[styles.error, { color: c.error }]}>{error}</Text>}
        </View>
        <BottomNavigation />
      </SafeAreaView>
    </BottomNavigationProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 76,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: { maxWidth: 520, textAlign: 'center', fontSize: 25, lineHeight: 32, fontWeight: '900' },
  body: { maxWidth: 540, marginTop: 12, textAlign: 'center', fontSize: 15, lineHeight: 23 },
  button: {
    minHeight: 50,
    marginTop: 28,
    paddingHorizontal: 24,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  error: { maxWidth: 500, marginTop: 12, textAlign: 'center', fontSize: 13, fontWeight: '700' },
});
