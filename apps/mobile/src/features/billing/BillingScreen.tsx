import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react-native';
import {
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BillingHeader } from './components/BillingHeader';
import { useBottomNavigation } from '../../shared/providers/BottomNavigationProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { TabletNavigationPane } from '../../shared/components/navigation/TabletNavigationPane';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { CatalogToolbar } from './components/CatalogToolbar';
import { OrderCart } from './components/OrderCart';
import { ProductCatalog } from './components/ProductCatalog';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { billingApi } from './billingApi';
import { useBillingData } from './hooks/useBillingData';
import { useBillingCart } from './hooks/useBillingCart';
import type { PaymentMethod } from './types/billing';
import { useAppHeader } from '../../shared/providers/AppHeaderProvider';

export function BillingScreen() {
  const { themeColors } = useAppTheme();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [cartOpen, setCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 700;
  const isWide = isTablet && width > height;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const scanHandled = useRef(false);
  const { setCenterItem } = useBottomNavigation();
  const { setMenuToggle, setFeatureRefresh } = useAppHeader();
  const cart = useBillingCart();
  const billing = useBillingData();
  const products = billing.data?.cache.products || [];
  const refreshRef = useRef(billing.refresh);
  refreshRef.current = billing.refresh;
  const saving = useRef(false);
  useEffect(() => {
    setMenuToggle(isWide ? () => setSidebarCollapsed((value) => !value) : undefined);
    return () => setMenuToggle(undefined);
  }, [isWide, setMenuToggle]);
  useEffect(() => {
    setFeatureRefresh(() => refreshRef.current(), billing.busy);
    return () => setFeatureRefresh(undefined);
  }, [billing.busy, setFeatureRefresh]);
  useEffect(() => {
    cart.clearCart();
    setCategory('All');
  }, [billing.data?.key]);
  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) &&
          (category === 'All' || category === 'Quick picks'
            ? category !== 'Quick picks' || product.quick
            : product.category === category),
      ),
    [category, search, products],
  );
  const checkout = async () => {
    if (!cart.items.length || saving.current) return;
    saving.current = true;
    try {
      if (!billing.data) throw new Error('Load billing before checkout.');
      await billingApi.checkout(billing.data.key, cart.items, payment);
      cart.clearCart();
      setCartOpen(false);
      await billing.reload();
      Alert.alert(
        'Sale saved on this device',
        'Queued for server sync. This records payment only; it does not charge a card or UPI account.',
      );
    } catch (e) {
      Alert.alert('Sale not saved', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      saving.current = false;
    }
  };
  const handleScannedCode = (value: string) => {
    if (scanHandled.current) return;
    scanHandled.current = true;
    setScannerOpen(false);
    const product = products.find(
      (item) => item.barcode === value || item.id.toLowerCase() === value.toLowerCase(),
    );
    if (product) {
      cart.addItem(product);
      Alert.alert('Added to cart', product.name);
      return;
    }
    setSearch(value);
    Alert.alert('Code scanned', `No product matched “${value}”. Showing it in search.`);
  };
  useEffect(() => {
    setCenterItem({
      label: 'Cart',
      icon: ShoppingCart,
      badge: cart.itemCount,
      onPress: () => setCartOpen(true),
    });
    return () => setCenterItem(null);
  }, [cart.itemCount, setCenterItem]);
  const closeCart = () => {
    setCartOpen(false);
    sheetTranslateY.setValue(0);
  };
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => sheetTranslateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 1) {
            Animated.timing(sheetTranslateY, { toValue: 700, duration: 160, useNativeDriver: true }).start(
              closeCart,
            );
            return;
          }
          Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start(),
      }),
    [sheetTranslateY],
  );
  return (
    <View style={[s.root, { backgroundColor: themeColors.background }]}>
      <View style={s.workspace}>
        {isWide && (
          <TabletNavigationPane
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((value) => !value)}
          />
        )}
        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[1]}
          contentContainerStyle={s.content}
        >
          <BillingHeader
            session={billing.data?.cache.session}
            pendingSales={billing.data?.cache.queue.length || 0}
            updated={billing.data?.cache.updated}
            error={billing.error}
            syncing={billing.busy}
          />
          <CatalogToolbar
            categories={['All', ...new Set(products.map((p) => p.category))]}
            search={search}
            category={category}
            onSearch={setSearch}
            onCategory={setCategory}
            onScan={() => {
              scanHandled.current = false;
              setScannerOpen(true);
            }}
          />
          <ProductCatalog category={category} products={visibleProducts} onAdd={cart.addItem} />
        </ScrollView>
        {isWide && cartOpen && (
          <View style={[s.rightCart, { borderLeftColor: themeColors.outline }]}>
            <OrderCart
              items={cart.items}
              subtotal={cart.subtotal}
              tax={cart.tax}
              total={cart.total}
              itemCount={cart.itemCount}
              payment={payment}
              onPayment={setPayment}
              onChange={cart.changeQuantity}
              onClear={cart.clearCart}
              onCheckout={checkout}
              onClose={closeCart}
            />
          </View>
        )}
      </View>
      {isWide && !cartOpen && (
        <AppPressable onPress={() => setCartOpen(true)} style={s.wideCart}>
          <Text style={s.wideCartIcon}>🛒</Text>
          <Text style={s.wideCartText}>
            {cart.itemCount ? cart.itemCount + ' · ₹' + cart.total.toFixed(0) : 'Cart'}
          </Text>
        </AppPressable>
      )}
      <Modal transparent visible={!isWide && cartOpen} animationType="slide" onRequestClose={closeCart}>
        <View style={s.modal}>
          <Pressable style={s.backdrop} onPress={closeCart} />
          <Animated.View
            style={[
              s.sheet,
              { backgroundColor: themeColors.surface },
              isTablet && s.tabletSheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View {...sheetPanResponder.panHandlers} style={s.dragArea}>
              <View style={s.handle} />
            </View>
            <OrderCart
              items={cart.items}
              subtotal={cart.subtotal}
              tax={cart.tax}
              total={cart.total}
              itemCount={cart.itemCount}
              payment={payment}
              onPayment={setPayment}
              onChange={cart.changeQuantity}
              onClear={cart.clearCart}
              onCheckout={checkout}
              onClose={closeCart}
            />
          </Animated.View>
        </View>
      </Modal>
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScannedCode}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  workspace: { flex: 1, flexDirection: 'row' },
  rightCart: { width: 390, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#C3C6CF' },
  content: { flexGrow: 1 },
  wideCart: {
    position: 'absolute',
    right: 28,
    bottom: 28,
    height: 58,
    minWidth: 62,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1B6EF3',
    elevation: 8,
  },
  wideCartIcon: { fontSize: 20 },
  wideCartText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24, 29, 55, 0.34)' },
  sheet: { height: '75%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  tabletSheet: {
    width: '86%',
    maxWidth: 720,
    height: '68%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  dragArea: { height: 32, alignItems: 'center', justifyContent: 'center' },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CDD1DE',
    alignSelf: 'center',
  },
});
