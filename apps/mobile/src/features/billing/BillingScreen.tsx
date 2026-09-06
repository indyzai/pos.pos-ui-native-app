import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BillingHeader } from './components/BillingHeader';
import { CatalogToolbar } from './components/CatalogToolbar';
import { CartFab } from './components/CartFab';
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
  return (
    <View style={s.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={s.content}
      >
        <BillingHeader />
        <CatalogToolbar search={search} category={category} onSearch={setSearch} onCategory={setCategory} />
        <ProductCatalog category={category} products={visibleProducts} onAdd={cart.addItem} />
      </ScrollView>
      <CartFab itemCount={cart.itemCount} total={cart.total} onPress={() => setCartOpen(true)} />
      <Modal transparent visible={cartOpen} animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <View style={s.modal}>
          <Pressable style={s.backdrop} onPress={() => setCartOpen(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
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
              onClose={() => setCartOpen(false)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1 },
  modal: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(24, 29, 55, 0.34)' },
  sheet: { height: '75%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CDD1DE',
    alignSelf: 'center',
    marginTop: 10,
  },
});
