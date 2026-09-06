import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/constants/theme';
import { BillingScreen } from './src/features/billing/BillingScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app} edges={['top']}>
        <StatusBar style="dark" />
        <BillingScreen />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ app: { flex: 1, backgroundColor: colors.background } });
