import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useBottomNavigation } from '../../contexts/BottomNavigationContext';
import { TabletNavigationPane } from '../../components/navigation/TabletNavigationPane';
import { AppPressable } from '../../components/ui/AppPressable';
import { CatalogToolbar } from './components/CatalogToolbar';
import { OrderCart } from './components/OrderCart';
import { ProductCatalog } from './components/ProductCatalog';
import { products } from './data/products';
import { useBillingCart } from './hooks/useBillingCart';
import type { PaymentMethod } from './types/billing';

export function BillingScreen() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [cartOpen, setCartOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 700;
  const isWide = isTablet && width > height;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const { setCenterItem } = useBottomNavigation();
  const cart = useBillingCart();
  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.name.toLowerCase().includes(search.toLowerCase()) &&
          (category === 'All' || category === 'Quick picks'
            ? category !== 'Quick picks' || product.quick
            : product.category === category),
      ),
    [category, search],
  );
  const checkout = () => {
    if (!cart.items.length) return;
    Alert.alert('Payment complete', `₹${cart.total.toFixed(2)} received by ${payment}.`, [
      { text: 'New sale', onPress: cart.clearCart },
    ]);
  };
  useEffect(() => {
    setCenterItem({
      label: 'Cart',
      icon: '🛒',
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
    <View style={s.root}>
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
          <BillingHeader onMenuToggle={isWide ? () => setSidebarCollapsed((value) => !value) : undefined} />
          <CatalogToolbar
            search={search}
            category={category}
            onSearch={setSearch}
            onCategory={setCategory}
            onScan={() => Alert.alert('Scanner', 'Barcode and QR scanning will open here.')}
          />
          <ProductCatalog category={category} products={visibleProducts} onAdd={cart.addItem} />
        </ScrollView>
        {isWide && cartOpen && (
          <View style={s.rightCart}>
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
              onCheckout={() => {
                checkout();
                setCartOpen(false);
              }}
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
            style={[s.sheet, isTablet && s.tabletSheet, { transform: [{ translateY: sheetTranslateY }] }]}
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
              onCheckout={() => {
                checkout();
                setCartOpen(false);
              }}
              onClose={closeCart}
            />
          </Animated.View>
        </View>
      </Modal>
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
