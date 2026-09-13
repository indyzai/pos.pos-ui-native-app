import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react-native';
import {
  Animated,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useBottomNavigation } from '../../../shared/providers/BottomNavigationProvider';
import { useAppTheme } from '../../../shared/providers/ThemeProvider';
import { AppPressable } from '../../../shared/components/ui/AppPressable';
import { AppBottomSheetShell } from '../../../shared/components/ui/AppBottomSheetShell';
import { CatalogToolbar } from './CatalogToolbar';
import { OrderCart } from './OrderCart';
import { ProductCatalog } from './ProductCatalog';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { CheckoutDialog } from './CheckoutDialog';
import { ReceiptDialog, type ReceiptData } from './ReceiptDialog';
import { billingApi } from '../billingApi';
import { useBillingData } from '../hooks/useBillingData';
import { useBillingCart } from '../hooks/useBillingCart';
import type {
  BillingOrderContext,
  CheckoutPayment,
  Customer,
  HeldOrder,
  PaymentMethod,
  Product,
  ScrapExchange,
} from '../types/billing';
import { useAppHeader } from '../../../shared/providers/AppHeaderProvider';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { billingPolicy } from '../domain/billingTotals';
import { useHeldOrders } from '../hooks/useHeldOrders';
import { HeldOrdersDialog } from './HeldOrdersDialog';
import { CustomerPickerDialog } from './CustomerPickerDialog';
import { AddInventoryItemModal } from '../../inventory/components/AddInventoryItemModal';
import { inventoryApi } from '../../inventory/inventoryApi';
import { PettyCashDialog } from '../../counter-session/components/PettyCashDialog';
import { counterSessionApi } from '../../counter-session/counterSessionApi';
import { printingApi } from '../../printing/printingApi';
import { BillingSessionStats } from './BillingSessionStats';
import { BillingModeBadge } from './BillingModeBadge';
import { ScrapExchangeDialog } from './ScrapExchangeDialog';
import { canManageScrap } from '../../scrap/permissions';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';
import { canPerformManagerActions } from '../../../config/appAccess';
import { formatCurrency } from '../../../shared/utils/currency';
import type { BillingModeConfig } from '../domain/billingMode';

type CartPage = 'cart' | 'customer' | 'held-orders' | 'petty-cash' | 'scrap' | 'checkout';
const useNativeAnimationDriver = Platform.OS !== 'web';
const cartPageTitles: Record<CartPage, string> = {
  cart: 'Current order',
  customer: 'Select customer',
  'held-orders': 'Held orders',
  'petty-cash': 'Petty cash',
  scrap: 'Customer scrap exchange',
  checkout: 'Checkout & payment',
};

export type BaseBillingLayoutProps = {
  mode: BillingModeConfig;
  headerSlot?: React.ReactNode;
  dialogsSlot?: (helpers: {
    cart: ReturnType<typeof useBillingCart>;
    currencyCode: string;
    products: Product[];
    billing: ReturnType<typeof useBillingData>;
  }) => React.ReactNode;
  pharmacyMode?: boolean;
  onSelectProduct?: (
    product: Product,
    helpers: {
      cart: ReturnType<typeof useBillingCart>;
      addStandardProduct: (p: Product) => void;
      billing: ReturnType<typeof useBillingData>;
    },
  ) => void | boolean;
  onBeforeCheckout?: (helpers: { cart: ReturnType<typeof useBillingCart>; customer?: Customer }) => boolean;
  buildOrderContext?: (helpers: {
    cart: ReturnType<typeof useBillingCart>;
    customer?: Customer;
  }) => BillingOrderContext | undefined;
  onOrderResumed?: (order: HeldOrder) => void;
  onOrderCleared?: () => void;
};

export function BaseBillingLayout({
  mode,
  headerSlot,
  dialogsSlot,
  pharmacyMode,
  onSelectProduct,
  onBeforeCheckout,
  buildOrderContext,
  onOrderResumed,
  onOrderCleared,
}: BaseBillingLayoutProps) {
  const { themeColors } = useAppTheme();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [payment, setPayment] = useState<PaymentMethod>('CASH');
  const [customer, setCustomer] = useState<Customer>();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [pettyCashOpen, setPettyCashOpen] = useState(false);
  const [recordingPettyCash, setRecordingPettyCash] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
  const [scrapOpen, setScrapOpen] = useState(false);
  const [scrapProducts, setScrapProducts] = useState<Product[]>([]);
  const [loadingScrapProducts, setLoadingScrapProducts] = useState(false);
  const [scrapExchange, setScrapExchange] = useState<ScrapExchange>();
  const [cartOpen, setCartOpen] = useState(false);
  const [cartPage, setCartPage] = useState<CartPage>('cart');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData>();
  const [heldOrdersOpen, setHeldOrdersOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 700;
  const isWide = isTablet && width > height;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const cartContentTranslateX = useRef(new Animated.Value(0)).current;
  const cartContentAnimating = useRef(false);
  const scanHandled = useRef(false);
  const { setCenterItem } = useBottomNavigation();
  const { requestCounterDialog, setFeatureRefresh, setRefreshJob } = useAppHeader();
  const auth = useAuthSession();
  const managerAccess = canPerformManagerActions(auth.session?.tenant.role, auth.session?.user.role);
  const policy = useMemo(
    () => billingPolicy(auth.session?.organization?.settings),
    [auth.session?.organization?.settings],
  );
  const cart = useBillingCart(policy);
  const billing = useBillingData(mode.mode);
  const { isEnabled } = useFeatureToggles();
  const heldOrders = useHeldOrders(billing.data?.key);
  const counterRequired = isEnabled('requireOpenCounterForBilling');
  const billingAllowed = !counterRequired || !!auth.session?.organization?.activeSession;
  const products = billing.data?.cache.products || [];
  const customers = billing.data?.cache.customers || [];
  const paymentMethods = billing.data?.cache.paymentMethods || [];
  const taxRates = billing.data?.cache.taxRates || [];
  const currencyCode = String(auth.session?.organization?.settings.currency || 'INR');

  useEffect(() => {
    if (!paymentMethods.length || paymentMethods.some((method) => method.code === payment)) return;
    setPayment((paymentMethods.find((method) => method.isQuickAccess) || paymentMethods[0]).code);
  }, [payment, paymentMethods]);

  const refreshRef = useRef(billing.refresh);
  refreshRef.current = billing.refresh;
  const refreshController = useRef<AbortController | undefined>(undefined);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  useEffect(() => {
    setFeatureRefresh(() => refreshRef.current());
    return () => setFeatureRefresh(undefined);
  }, [setFeatureRefresh]);

  useEffect(
    () => () => {
      refreshController.current?.abort();
      setRefreshJob(undefined);
    },
    [setRefreshJob],
  );

  useEffect(() => {
    cart.clearCart();
    setCustomer(undefined);
    setCategory('All');
    setScrapExchange(undefined);
    setScrapProducts([]);
    onOrderCleared?.();
  }, [billing.data?.key]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const query = search.toLowerCase();
        const matchesSearch = [
          product.name,
          product.sku,
          product.barcode,
          product.details?.salt,
          product.details?.manufacturer,
          product.details?.batchNumber,
        ].some((value) => value?.toLowerCase().includes(query));
        const matchesCategory =
          category === 'All' || category === 'Quick picks'
            ? category !== 'Quick picks' || product.quick
            : product.category === category;
        return matchesSearch && matchesCategory;
      }),
    [category, search, products],
  );

  const closeCart = () => {
    cartContentTranslateX.stopAnimation();
    cartContentAnimating.current = false;
    setCartOpen(false);
    setCartPage('cart');
    sheetTranslateY.setValue(0);
    cartContentTranslateX.setValue(0);
  };

  const replaceCartPage = (page: CartPage) => {
    if (page === cartPage || cartContentAnimating.current) return;
    const direction = page === 'cart' ? -1 : 1;
    cartContentAnimating.current = true;
    Animated.timing(cartContentTranslateX, {
      toValue: -direction * width,
      duration: 150,
      useNativeDriver: useNativeAnimationDriver,
    }).start(() => {
      setCartPage(page);
      cartContentTranslateX.setValue(direction * width);
      requestAnimationFrame(() => {
        Animated.spring(cartContentTranslateX, {
          toValue: 0,
          damping: 22,
          stiffness: 240,
          mass: 0.75,
          useNativeDriver: useNativeAnimationDriver,
        }).start(() => {
          cartContentAnimating.current = false;
        });
      });
    });
  };

  const openCartPage = (page: CartPage, openWideDialog: () => void) => {
    if (isWide) {
      openWideDialog();
      return;
    }
    replaceCartPage(page);
  };

  const closeCartPage = (closeWideDialog: () => void) =>
    isWide ? closeWideDialog() : replaceCartPage('cart');

  const openQuickAdd = () => {
    setQuickAddOpen(true);
  };

  const openScrap = async () => {
    openCartPage('scrap', () => setScrapOpen(true));
    if (!scrapProducts.length && !loadingScrapProducts) {
      setLoadingScrapProducts(true);
      try {
        setScrapProducts(await billingApi.loadScrapProducts());
      } catch (error) {
        showSnackbar('Could not load scrap items', error instanceof Error ? error.message : 'Try again.');
      } finally {
        setLoadingScrapProducts(false);
      }
    }
  };

  const createQuickProduct = async (input: Parameters<typeof inventoryApi.create>[0]) => {
    setCreatingProduct(true);
    try {
      const job = await inventoryApi.create(input);
      await billing.reload();
      setQuickAddOpen(false);
      const refreshed = await billingApi.load();
      const created = refreshed.cache.products.find((item) => item.id === job.entityId);
      if (created) cart.addItem(created);
      showSnackbar('Product created', `${input.name} was added to this order as an incomplete product.`);
    } catch (error) {
      showSnackbar('Could not create product', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setCreatingProduct(false);
    }
  };

  const cartPagePanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          cartPage !== 'cart' && gesture.dx > 12 && gesture.dx > Math.abs(gesture.dy),
        onPanResponderMove: (_event, gesture) => cartContentTranslateX.setValue(Math.max(0, gesture.dx)),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx > width * 0.25 || gesture.vx > 0.7) {
            replaceCartPage('cart');
            return;
          }
          Animated.spring(cartContentTranslateX, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            useNativeDriver: useNativeAnimationDriver,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(cartContentTranslateX, {
            toValue: 0,
            damping: 22,
            stiffness: 240,
            useNativeDriver: useNativeAnimationDriver,
          }).start(),
      }),
    [cartContentTranslateX, cartPage, width],
  );

  const checkout = () => {
    if (!cart.items.length || submitting) return;
    if (!billingAllowed) {
      requestCounterDialog();
      return;
    }
    if (onBeforeCheckout && !onBeforeCheckout({ cart, customer })) {
      return;
    }
    openCartPage('checkout', () => setCheckoutOpen(true));
  };

  const getOrderContext = () => buildOrderContext?.({ cart, customer });

  const addStandardProduct = (product: Product) => {
    cart.addItem(product);
  };

  const handleProductSelect = (product: Product) => {
    if (onSelectProduct) {
      return onSelectProduct(product, { cart, addStandardProduct, billing });
    }
    addStandardProduct(product);
    return true;
  };

  const holdCurrentOrder = async () => {
    if (!cart.items.length) return;
    try {
      await heldOrders.hold(cart.items, cart.orderDiscount, customer, getOrderContext(), scrapExchange);
      cart.clearCart();
      setCustomer(undefined);
      setScrapExchange(undefined);
      onOrderCleared?.();
      if (!isWide) closeCart();
    } catch (error) {
      showSnackbar('Could not hold order', error instanceof Error ? error.message : 'Try again.');
    }
  };

  const completeCheckout = async (checkoutPayment: CheckoutPayment) => {
    if (!cart.items.length || submitting) return;
    setSubmitting(true);
    const items = [...cart.items];
    const totals = {
      subtotal: cart.subtotal,
      discount: cart.discount,
      tax: cart.tax,
      total: cart.total,
      rounding: cart.rounding,
    };
    const orderContext = getOrderContext();
    try {
      if (!billing.data) throw new Error('Load billing before checkout.');
      const sale = await billingApi.checkout(
        billing.data.key,
        items,
        { ...checkoutPayment, scrap: scrapExchange },
        policy,
        cart.orderDiscount,
        customer,
        orderContext,
      );
      cart.clearCart();
      setCustomer(undefined);
      setScrapExchange(undefined);
      setCartOpen(false);
      setCartPage('cart');
      setCheckoutOpen(false);
      onOrderCleared?.();
      const organization = auth.session?.organization;
      const activeSession = organization?.activeSession;
      setReceipt({
        id: sale.receiptNumber,
        businessName: organization?.name || auth.session?.tenant.name || 'IndyzAI POS',
        branchName: activeSession?.branchName || 'Branch',
        counterName: activeSession?.counterName || 'Counter',
        createdAt: new Date().toISOString(),
        items,
        totals,
        payment: { ...checkoutPayment, scrap: scrapExchange },
        currencyCode,
        customer,
        orderContext,
      });
      if (activeSession) {
        void printingApi
          .autoQueueReceipt(sale.receiptNumber, activeSession.counterId, activeSession.branchId)
          .catch(() => undefined);
      }
      await billing.reload();
    } catch (e) {
      showSnackbar('Sale not saved', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScannedCode = (value: string) => {
    if (scanHandled.current) return;
    scanHandled.current = true;
    setScannerOpen(false);
    const product = products.find(
      (item) =>
        item.barcode === value ||
        item.sku?.toLowerCase() === value.toLowerCase() ||
        item.id.toLowerCase() === value.toLowerCase(),
    );
    if (product) {
      const added = handleProductSelect(product);
      if (added) showSnackbar('Added to cart', product.name);
      return;
    }
    setSearch(value);
    showSnackbar('Code scanned', `No product matched “${value}”. Showing it in search.`);
  };

  const createCustomer = async (input: { name: string; phone?: string }) => {
    if (!billing.data) throw new Error('Billing is not ready.');
    try {
      const created = await billingApi.createCustomer(billing.data.key, input);
      await billing.reload();
      return created;
    } catch (error) {
      showSnackbar('Could not create customer', error instanceof Error ? error.message : 'Try again.');
      throw error;
    }
  };

  const savePettyCash = async (input: {
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    description?: string;
  }) => {
    const session = auth.session;
    const counter = session?.organization?.activeSession;
    if (!session || !counter) {
      closeCartPage(() => setPettyCashOpen(false));
      requestCounterDialog();
      return;
    }
    setRecordingPettyCash(true);
    try {
      await counterSessionApi.recordPettyCash(session.token, String(session.tenant.id), {
        ...input,
        counterSessionId: counter.id,
        branchId: counter.branchId,
      });
      closeCartPage(() => setPettyCashOpen(false));
      await auth.refreshSession();
      showSnackbar(
        'Cash entry recorded',
        `${input.type === 'EXPENSE' ? 'Expense' : 'Income'} of ${formatCurrency(input.amount, currencyCode)} recorded.`,
      );
    } catch (error) {
      showSnackbar('Could not record cash entry', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setRecordingPettyCash(false);
    }
  };

  const resumeHeldOrder = async (order: HeldOrder) => {
    try {
      if (cart.items.length)
        await heldOrders.hold(cart.items, cart.orderDiscount, customer, getOrderContext(), scrapExchange);
      cart.replaceCart(order.items, order.orderDiscount);
      setCustomer(order.customer);
      setScrapExchange(order.scrapExchange);
      onOrderResumed?.(order);
      await heldOrders.remove(order.id);
      closeCartPage(() => setHeldOrdersOpen(false));
      setCartOpen(true);
    } catch (error) {
      showSnackbar('Could not resume order', error instanceof Error ? error.message : 'Try again.');
    }
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

  const pullToRefresh = async () => {
    if (pullRefreshing) return;
    const controller = new AbortController();
    const jobId = `catalog-${Date.now().toString(36)}`;
    refreshController.current = controller;
    setPullRefreshing(true);
    setRefreshJob({
      id: jobId,
      text: 'Refreshing catalog',
      cancel: () => controller.abort(),
    });
    try {
      await billing.refresh(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) {
        showSnackbar('Billing refresh failed', error instanceof Error ? error.message : 'Try again.');
      }
    } finally {
      if (refreshController.current === controller) {
        refreshController.current = undefined;
        setPullRefreshing(false);
        setRefreshJob(undefined);
      }
    }
  };

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.dy > 10 && gesture.dy > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => sheetTranslateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 1) {
            Animated.timing(sheetTranslateY, {
              toValue: 700,
              duration: 160,
              useNativeDriver: useNativeAnimationDriver,
            }).start(closeCart);
            return;
          }
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: useNativeAnimationDriver,
          }).start();
        },
        onPanResponderTerminate: () =>
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: useNativeAnimationDriver,
          }).start(),
      }),
    [sheetTranslateY],
  );

  return (
    <View style={[s.root, { backgroundColor: themeColors.background }]}>
      <View style={s.workspace}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={[0]}
          contentContainerStyle={s.content}
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={() => void pullToRefresh()}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
              title={pullRefreshing ? 'Refreshing catalog…' : 'Pull down to refresh'}
              titleColor={themeColors.textSecondary}
            />
          }
        >
          <CatalogToolbar
            categories={[
              'All',
              ...(mode.showQuickPicks ? ['Quick picks'] : []),
              ...new Set(products.map((p) => p.category)),
            ]}
            search={search}
            category={category}
            onSearch={setSearch}
            onCategory={setCategory}
            onScan={() => {
              scanHandled.current = false;
              setScannerOpen(true);
            }}
            scanEnabled={isEnabled('enableBarcodeScanning') && mode.scanByDefault}
            onAddProduct={isEnabled('inventory') && managerAccess ? openQuickAdd : undefined}
            statsVisible={statsVisible}
            onToggleStats={
              isEnabled('advancedReporting') ? () => setStatsVisible((value) => !value) : undefined
            }
            searchPlaceholder={mode.searchPlaceholder}
          />
          <BillingModeBadge config={mode} />
          {headerSlot}
          {statsVisible && isEnabled('advancedReporting') && (
            <BillingSessionStats
              session={auth.session?.organization?.activeSession}
              pendingSales={billing.data?.cache.queue.length || 0}
              currencyCode={currencyCode}
            />
          )}
          <ProductCatalog
            category={category}
            products={visibleProducts}
            onAdd={handleProductSelect}
            defaultTitle={mode.catalogTitle}
            pharmacyMode={pharmacyMode}
            currencyCode={currencyCode}
          />
        </ScrollView>
        {isWide && cartOpen && (
          <View style={[s.rightCart, { borderLeftColor: themeColors.outline }]}>
            <OrderCart
              items={cart.items}
              subtotal={cart.subtotal}
              discount={cart.discount}
              tax={cart.tax}
              total={cart.total}
              itemCount={cart.itemCount}
              payment={payment}
              onPayment={setPayment}
              paymentMethods={paymentMethods}
              taxRates={taxRates}
              customer={customer}
              onSelectCustomer={
                isEnabled('customers')
                  ? () => openCartPage('customer', () => setCustomerPickerOpen(true))
                  : undefined
              }
              onChange={cart.changeQuantity}
              onItemDiscount={cart.setItemDiscount}
              onItemTaxRate={cart.setItemTaxRate}
              orderDiscount={cart.orderDiscount}
              onOrderDiscount={cart.setOrderDiscount}
              allowItemDiscounts={isEnabled('allowItemDiscounts')}
              allowOrderDiscounts={isEnabled('allowOrderDiscounts')}
              heldOrderCount={heldOrders.orders.length}
              onShowHeldOrders={() => openCartPage('held-orders', () => setHeldOrdersOpen(true))}
              onHold={holdCurrentOrder}
              onPettyCash={
                isEnabled('finance')
                  ? () =>
                      billingAllowed
                        ? openCartPage('petty-cash', () => setPettyCashOpen(true))
                        : requestCounterDialog()
                  : undefined
              }
              onClear={() => {
                cart.clearCart();
                setScrapExchange(undefined);
                onOrderCleared?.();
              }}
              onCheckout={checkout}
              counterClosed={!billingAllowed}
              onClose={closeCart}
              currencyCode={currencyCode}
              scrapValue={scrapExchange?.total}
              onScrap={
                isEnabled('scrap') && canManageScrap(auth.session?.tenant.role)
                  ? () => void openScrap()
                  : undefined
              }
            />
          </View>
        )}
      </View>
      {isWide && !cartOpen && (
        <AppPressable onPress={() => setCartOpen(true)} style={s.wideCart}>
          <Text style={s.wideCartIcon}>🛒</Text>
          <Text style={s.wideCartText}>
            {cart.itemCount ? `${cart.itemCount} · ${formatCurrency(cart.total, currencyCode, 0)}` : 'Cart'}
          </Text>
        </AppPressable>
      )}
      <AppBottomSheetShell
        visible={!isWide && cartOpen}
        onClose={() => (cartPage === 'cart' ? closeCart() : replaceCartPage('cart'))}
        dragHandlers={sheetPanResponder.panHandlers}
        animatedStyle={{ transform: [{ translateY: sheetTranslateY }] }}
      >
        <OrderCart
          items={cart.items}
          subtotal={cart.subtotal}
          discount={cart.discount}
          tax={cart.tax}
          total={cart.total}
          itemCount={cart.itemCount}
          payment={payment}
          onPayment={setPayment}
          paymentMethods={paymentMethods}
          taxRates={taxRates}
          customer={customer}
          onSelectCustomer={isEnabled('customers') ? () => replaceCartPage('customer') : undefined}
          onChange={cart.changeQuantity}
          onItemDiscount={cart.setItemDiscount}
          onItemTaxRate={cart.setItemTaxRate}
          orderDiscount={cart.orderDiscount}
          onOrderDiscount={cart.setOrderDiscount}
          allowItemDiscounts={isEnabled('allowItemDiscounts')}
          allowOrderDiscounts={isEnabled('allowOrderDiscounts')}
          heldOrderCount={heldOrders.orders.length}
          onShowHeldOrders={() => replaceCartPage('held-orders')}
          onHold={holdCurrentOrder}
          onPettyCash={
            isEnabled('finance')
              ? () => (billingAllowed ? replaceCartPage('petty-cash') : requestCounterDialog())
              : undefined
          }
          onClear={() => {
            cart.clearCart();
            setScrapExchange(undefined);
            onOrderCleared?.();
          }}
          onCheckout={checkout}
          counterClosed={!billingAllowed}
          onClose={closeCart}
          currencyCode={currencyCode}
          scrapValue={scrapExchange?.total}
          onScrap={
            isEnabled('scrap') && canManageScrap(auth.session?.tenant.role)
              ? () => void openScrap()
              : undefined
          }
          innerContent={
            cartPage === 'cart' ? undefined : (
              <Animated.View
                {...cartPagePanResponder.panHandlers}
                style={[s.cartInnerPage, { transform: [{ translateX: cartContentTranslateX }] }]}
              >
                <CustomerPickerDialog
                  embedded
                  visible={cartPage === 'customer'}
                  customers={customers}
                  selected={customer}
                  onSelect={setCustomer}
                  onCreate={createCustomer}
                  onClose={() => replaceCartPage('cart')}
                />
                <HeldOrdersDialog
                  embedded
                  visible={cartPage === 'held-orders'}
                  orders={heldOrders.orders}
                  currencyCode={currencyCode}
                  onClose={() => replaceCartPage('cart')}
                  onDelete={(id) => void heldOrders.remove(id)}
                  onResume={(order) => void resumeHeldOrder(order)}
                />
                <PettyCashDialog
                  embedded
                  visible={cartPage === 'petty-cash'}
                  busy={recordingPettyCash}
                  onClose={() => !recordingPettyCash && replaceCartPage('cart')}
                  onSave={savePettyCash}
                />
                <ScrapExchangeDialog
                  embedded
                  visible={cartPage === 'scrap'}
                  products={scrapProducts}
                  loading={loadingScrapProducts}
                  value={scrapExchange}
                  currencyCode={currencyCode}
                  onChange={setScrapExchange}
                  onClose={() => replaceCartPage('cart')}
                />
                <CheckoutDialog
                  embedded
                  visible={cartPage === 'checkout'}
                  total={Math.max(0, cart.total - (scrapExchange?.total || 0))}
                  itemCount={cart.itemCount}
                  initialMethod={payment}
                  paymentMethods={paymentMethods}
                  currencyCode={currencyCode}
                  submitting={submitting}
                  onClose={() => !submitting && replaceCartPage('cart')}
                  onConfirm={(checkoutPayment) => void completeCheckout(checkoutPayment)}
                />
              </Animated.View>
            )
          }
          innerTitle={cartPageTitles[cartPage]}
          onInnerBack={() => replaceCartPage('cart')}
        />
      </AppBottomSheetShell>
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScannedCode}
      />
      {dialogsSlot?.({ cart, currencyCode, products, billing })}
      <AppBottomSheetShell
        visible={quickAddOpen}
        onClose={() => !creatingProduct && setQuickAddOpen(false)}
        title="Quick add product"
        subtitle="Add the essentials now. Complete this product later from Inventory."
      >
        <AddInventoryItemModal
          embedded
          quickAdd
          visible={quickAddOpen}
          busy={creatingProduct}
          onClose={() => !creatingProduct && setQuickAddOpen(false)}
          onSave={createQuickProduct}
        />
      </AppBottomSheetShell>
      <PettyCashDialog
        visible={isWide && pettyCashOpen}
        busy={recordingPettyCash}
        onClose={() => !recordingPettyCash && setPettyCashOpen(false)}
        onSave={savePettyCash}
      />
      <CheckoutDialog
        visible={isWide && checkoutOpen}
        total={Math.max(0, cart.total - (scrapExchange?.total || 0))}
        itemCount={cart.itemCount}
        initialMethod={payment}
        paymentMethods={paymentMethods}
        currencyCode={currencyCode}
        submitting={submitting}
        onClose={() => !submitting && setCheckoutOpen(false)}
        onConfirm={(checkoutPayment) => void completeCheckout(checkoutPayment)}
      />
      <ScrapExchangeDialog
        visible={isWide && scrapOpen}
        products={scrapProducts}
        loading={loadingScrapProducts}
        value={scrapExchange}
        currencyCode={currencyCode}
        onChange={setScrapExchange}
        onClose={() => setScrapOpen(false)}
      />
      <ReceiptDialog
        receipt={receipt}
        printing={printingReceipt}
        onPrint={
          receipt && auth.session?.organization?.activeSession
            ? async () => {
                const session = auth.session!.organization!.activeSession!;
                setPrintingReceipt(true);
                try {
                  const job = await printingApi.queueReceipt(receipt.id, session.counterId, session.branchId);
                  showSnackbar(
                    job.status === 'COMPLETED' ? 'Print queued' : 'Print saved for retry',
                    `${job.printerName} · job ${job.serverId || job.id}${job.error ? `\n${job.error}` : ''}`,
                  );
                } catch (error) {
                  showSnackbar(
                    'Could not print receipt',
                    error instanceof Error ? error.message : 'Try again.',
                  );
                } finally {
                  setPrintingReceipt(false);
                }
              }
            : undefined
        }
        onClose={() => setReceipt(undefined)}
      />
      <CustomerPickerDialog
        visible={isWide && customerPickerOpen}
        customers={customers}
        selected={customer}
        onSelect={setCustomer}
        onCreate={createCustomer}
        onClose={() => setCustomerPickerOpen(false)}
      />
      <HeldOrdersDialog
        visible={isWide && heldOrdersOpen}
        orders={heldOrders.orders}
        currencyCode={currencyCode}
        onClose={() => setHeldOrdersOpen(false)}
        onDelete={(id) => void heldOrders.remove(id)}
        onResume={(order) => void resumeHeldOrder(order)}
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
  cartInnerPage: { flex: 1, minHeight: 0 },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CDD1DE',
    alignSelf: 'center',
  },
});
