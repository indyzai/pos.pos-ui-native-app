import { useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart } from 'lucide-react-native';
import {
  Alert,
  Animated,
  InteractionManager,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useBottomNavigation } from '../../shared/providers/BottomNavigationProvider';
import { useAppTheme } from '../../shared/providers/ThemeProvider';
import { AppPressable } from '../../shared/components/ui/AppPressable';
import { CatalogToolbar } from './components/CatalogToolbar';
import { OrderCart } from './components/OrderCart';
import { ProductCatalog } from './components/ProductCatalog';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { CheckoutDialog } from './components/CheckoutDialog';
import { ReceiptDialog, type ReceiptData } from './components/ReceiptDialog';
import { billingApi } from './billingApi';
import { useBillingData } from './hooks/useBillingData';
import { useBillingCart } from './hooks/useBillingCart';
import type { CheckoutPayment, Customer, PaymentMethod, Product } from './types/billing';
import { useAppHeader } from '../../shared/providers/AppHeaderProvider';
import { useAuthSession } from '../auth/AuthSessionContext';
import { requiresOpenCounter } from '../organization/organizationApi';
import { billingPolicy } from './domain/billingTotals';
import { useHeldOrders } from './hooks/useHeldOrders';
import { HeldOrdersDialog } from './components/HeldOrdersDialog';
import { CustomerPickerDialog } from './components/CustomerPickerDialog';
import { AddInventoryItemModal } from '../inventory/components/AddInventoryItemModal';
import { inventoryApi } from '../inventory/inventoryApi';
import { PettyCashDialog } from '../counter-session/components/PettyCashDialog';
import { counterSessionApi } from '../counter-session/counterSessionApi';
import { printingApi } from '../printing/printingApi';
import { BillingSessionStats } from './components/BillingSessionStats';
import { resolveBillingMode } from './domain/billingMode';
import { BillingModeBadge } from './components/BillingModeBadge';
import { BulkQuantityDialog } from './components/BulkQuantityDialog';
import { RestaurantOrderModeSelector, type RestaurantOrderMode } from './components/RestaurantOrderMode';
import { useRestaurantTables } from '../restaurant/useRestaurantTables';
import { RestaurantTableSelector } from '../restaurant/RestaurantTableSelector';
import type { RestaurantTable } from '../restaurant/types';
import { RestaurantItemDialog } from './components/RestaurantItemDialog';
import { PharmacyPrescriptionContext } from './components/PharmacyPrescriptionContext';
import { pharmacyProductStatus } from './domain/pharmacyProduct';
import { ServiceConfigurationDialog } from './components/ServiceConfigurationDialog';
import { ElectronicsItemDialog } from './components/ElectronicsItemDialog';
import { requiresDeviceDetails, validateTrackedDevices } from './domain/electronicsTracking';
import { formatCurrency } from '../../shared/utils/currency';
import { canManageWaybills } from '../logistics/permissions';
import { PharmacyBatchDialog } from './components/PharmacyBatchDialog';
import { ScrapExchangeDialog } from './components/ScrapExchangeDialog';
import type { ScrapExchange } from './types/billing';
import { canManageScrap } from '../scrap/permissions';

export function BillingScreen() {
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
  const [bulkProduct, setBulkProduct] = useState<Product>();
  const [restaurantOrderMode, setRestaurantOrderMode] = useState<RestaurantOrderMode>('DINE_IN');
  const [restaurantTable, setRestaurantTable] = useState<RestaurantTable>();
  const [restaurantProduct, setRestaurantProduct] = useState<Product>();
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionReference, setPrescriptionReference] = useState('');
  const [serviceProduct, setServiceProduct] = useState<Product>();
  const [electronicsProduct, setElectronicsProduct] = useState<Product>();
  const [pharmacyProduct, setPharmacyProduct] = useState<Product>();
  const [scrapOpen, setScrapOpen] = useState(false);
  const [scrapExchange, setScrapExchange] = useState<ScrapExchange>();
  const [cartOpen, setCartOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData>();
  const [heldOrdersOpen, setHeldOrdersOpen] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 700;
  const isWide = isTablet && width > height;
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const cartDialogTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scanHandled = useRef(false);
  const { setCenterItem } = useBottomNavigation();
  const { requestCounterDialog, setFeatureRefresh, setRefreshJob } = useAppHeader();
  const auth = useAuthSession();
  const policy = useMemo(
    () => billingPolicy(auth.session?.organization?.settings),
    [auth.session?.organization?.settings],
  );
  const cart = useBillingCart(policy);
  const billing = useBillingData();
  const heldOrders = useHeldOrders(billing.data?.key);
  const counterRequired = requiresOpenCounter(auth.session?.organization?.settings);
  const billingAllowed = !counterRequired || !!auth.session?.organization?.activeSession;
  const products = billing.data?.cache.products || [];
  const customers = billing.data?.cache.customers || [];
  const paymentMethods = billing.data?.cache.paymentMethods || [];
  const serviceUsers = billing.data?.cache.serviceUsers || [];
  const productBatches = billing.data?.cache.productBatches || [];
  const taxRates = billing.data?.cache.taxRates || [];
  const currencyCode = String(auth.session?.organization?.settings.currency || 'INR');
  const mode = useMemo(
    () => resolveBillingMode(auth.session?.organization?.settings.businessType),
    [auth.session?.organization?.settings.businessType],
  );
  const restaurantTables = useRestaurantTables(
    mode.mode === 'restaurant',
    auth.session?.organization?.activeSession?.branchId,
  );
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
      if (cartDialogTimer.current) clearTimeout(cartDialogTimer.current);
      setRefreshJob(undefined);
    },
    [setRefreshJob],
  );
  useEffect(() => {
    cart.clearCart();
    setCustomer(undefined);
    setCategory('All');
    setDoctorName('');
    setPrescriptionReference('');
    setScrapExchange(undefined);
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
    setCartOpen(false);
    sheetTranslateY.setValue(0);
  };
  const openFromCart = (openDialog: () => void) => {
    if (isWide) {
      openDialog();
      return;
    }

    closeCart();
    if (cartDialogTimer.current) clearTimeout(cartDialogTimer.current);
    InteractionManager.runAfterInteractions(() => {
      // Native Modal dismissal is asynchronous. Waiting for the sheet animation
      // prevents a second native modal from being presented behind the cart.
      cartDialogTimer.current = setTimeout(openDialog, 320);
    });
  };
  const checkout = () => {
    if (!cart.items.length || submitting) return;
    if (!billingAllowed) {
      requestCounterDialog();
      return;
    }
    if (mode.mode === 'restaurant' && restaurantOrderMode === 'DINE_IN' && !restaurantTable) {
      Alert.alert('Select a table', 'Choose a table before checking out a dine-in order.');
      return;
    }
    if (
      mode.mode === 'pharmacy' &&
      cart.items.some((item) => item.details?.prescriptionRequired || item.details?.scheduledDrug) &&
      !doctorName.trim()
    ) {
      Alert.alert('Prescription details required', 'Enter the prescribing doctor before checkout.');
      return;
    }
    if (mode.mode === 'electronics') {
      const trackingError = validateTrackedDevices(cart.items);
      if (trackingError) {
        Alert.alert('Device details required', trackingError);
        return;
      }
    }
    openFromCart(() => setCheckoutOpen(true));
  };
  const currentOrderContext = () =>
    mode.mode === 'restaurant'
      ? {
          orderMode: restaurantOrderMode,
          tableId: restaurantTable?.id,
          tableName: restaurantTable?.name,
        }
      : mode.mode === 'pharmacy'
        ? {
            doctorName: doctorName.trim() || undefined,
            prescriptionReference: prescriptionReference.trim() || undefined,
          }
        : mode.mode === 'wholesale' && customer?.address && canManageWaybills(auth.session?.tenant.role)
          ? {
              autoCreateWaybill: true,
              waybillSeller: {
                name: auth.session?.organization?.name || auth.session?.tenant.name,
                gstin: String(auth.session?.organization?.settings.gstin || ''),
                address: String(auth.session?.organization?.settings.address || ''),
                state: String(auth.session?.organization?.settings.state || ''),
              },
            }
          : undefined;
  const addStandardProduct = (product: Product) => {
    if (mode.mode === 'pharmacy' && pharmacyProductStatus(product).expired) {
      Alert.alert('Expired stock', `${product.name} cannot be added because its expiry date has passed.`);
      return;
    }
    cart.addItem(product);
  };
  const selectProduct = (product: Product) => {
    const batches = productBatches.filter((batch) => batch.productId === product.id);
    if (mode.mode === 'pharmacy' && batches.length) {
      setPharmacyProduct(product);
      return false;
    }
    if (mode.mode === 'electronics' && requiresDeviceDetails(product)) {
      setElectronicsProduct(product);
      return false;
    }
    addStandardProduct(product);
    return true;
  };
  const holdCurrentOrder = async () => {
    if (!cart.items.length) return;
    try {
      await heldOrders.hold(cart.items, cart.orderDiscount, customer, currentOrderContext(), scrapExchange);
      cart.clearCart();
      setCustomer(undefined);
      setRestaurantTable(undefined);
      setDoctorName('');
      setPrescriptionReference('');
      setScrapExchange(undefined);
      if (!isWide) closeCart();
    } catch (error) {
      Alert.alert('Could not hold order', error instanceof Error ? error.message : 'Try again.');
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
    const orderContext = currentOrderContext();
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
      setDoctorName('');
      setPrescriptionReference('');
      setScrapExchange(undefined);
      setCartOpen(false);
      setCheckoutOpen(false);
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
      setRestaurantTable(undefined);
      if (activeSession) {
        void printingApi
          .autoQueueReceipt(sale.receiptNumber, activeSession.counterId, activeSession.branchId)
          .catch(() => undefined);
      }
      await billing.reload();
    } catch (e) {
      Alert.alert('Sale not saved', e instanceof Error ? e.message : 'Please try again.');
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
      if (selectProduct(product)) Alert.alert('Added to cart', product.name);
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
        Alert.alert('Billing refresh failed', error instanceof Error ? error.message : 'Try again.');
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
            scanEnabled={
              auth.session?.organization?.settings.enableBarcodeScanning === undefined
                ? mode.scanByDefault
                : auth.session.organization.settings.enableBarcodeScanning !== false
            }
            onAddProduct={() => setQuickAddOpen(true)}
            statsVisible={statsVisible}
            onToggleStats={() => setStatsVisible((value) => !value)}
            searchPlaceholder={mode.searchPlaceholder}
          />
          <BillingModeBadge config={mode} />
          {mode.mode === 'restaurant' && (
            <RestaurantOrderModeSelector value={restaurantOrderMode} onChange={setRestaurantOrderMode} />
          )}
          {mode.mode === 'restaurant' && restaurantOrderMode === 'DINE_IN' && (
            <RestaurantTableSelector
              tables={restaurantTables}
              selectedId={restaurantTable?.id}
              onSelect={setRestaurantTable}
            />
          )}
          {mode.mode === 'pharmacy' && (
            <PharmacyPrescriptionContext
              doctorName={doctorName}
              prescriptionReference={prescriptionReference}
              onDoctorNameChange={setDoctorName}
              onPrescriptionReferenceChange={setPrescriptionReference}
            />
          )}
          {statsVisible && (
            <BillingSessionStats
              session={auth.session?.organization?.activeSession}
              pendingSales={billing.data?.cache.queue.length || 0}
              currencyCode={currencyCode}
            />
          )}
          <ProductCatalog
            category={category}
            products={visibleProducts}
            onAdd={
              mode.mode === 'wholesale'
                ? setBulkProduct
                : mode.mode === 'restaurant'
                  ? setRestaurantProduct
                  : mode.mode === 'service'
                    ? (product) =>
                        product.categoryType === 'SERVICE' ||
                        product.details?.serviceDurationMinutes ||
                        product.details?.serviceInstructions
                          ? setServiceProduct(product)
                          : addStandardProduct(product)
                    : selectProduct
            }
            defaultTitle={mode.catalogTitle}
            pharmacyMode={mode.mode === 'pharmacy'}
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
              onSelectCustomer={() => openFromCart(() => setCustomerPickerOpen(true))}
              onChange={cart.changeQuantity}
              onItemDiscount={cart.setItemDiscount}
              onItemTaxRate={cart.setItemTaxRate}
              orderDiscount={cart.orderDiscount}
              onOrderDiscount={cart.setOrderDiscount}
              allowItemDiscounts={auth.session?.organization?.settings.allowItemDiscounts === true}
              allowOrderDiscounts={auth.session?.organization?.settings.allowOrderDiscounts === true}
              heldOrderCount={heldOrders.orders.length}
              onShowHeldOrders={() => openFromCart(() => setHeldOrdersOpen(true))}
              onHold={holdCurrentOrder}
              onPettyCash={() =>
                openFromCart(() => (billingAllowed ? setPettyCashOpen(true) : requestCounterDialog()))
              }
              onClear={() => {
                cart.clearCart();
                setScrapExchange(undefined);
              }}
              onCheckout={checkout}
              counterClosed={!billingAllowed}
              onClose={closeCart}
              currencyCode={currencyCode}
              scrapValue={scrapExchange?.total}
              onScrap={
                canManageScrap(auth.session?.tenant.role)
                  ? () => openFromCart(() => setScrapOpen(true))
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
              <View style={[s.handle, { backgroundColor: themeColors.outline }]} />
            </View>
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
              onSelectCustomer={() => openFromCart(() => setCustomerPickerOpen(true))}
              onChange={cart.changeQuantity}
              onItemDiscount={cart.setItemDiscount}
              onItemTaxRate={cart.setItemTaxRate}
              orderDiscount={cart.orderDiscount}
              onOrderDiscount={cart.setOrderDiscount}
              allowItemDiscounts={auth.session?.organization?.settings.allowItemDiscounts === true}
              allowOrderDiscounts={auth.session?.organization?.settings.allowOrderDiscounts === true}
              heldOrderCount={heldOrders.orders.length}
              onShowHeldOrders={() => openFromCart(() => setHeldOrdersOpen(true))}
              onHold={holdCurrentOrder}
              onPettyCash={() =>
                openFromCart(() => (billingAllowed ? setPettyCashOpen(true) : requestCounterDialog()))
              }
              onClear={() => {
                cart.clearCart();
                setScrapExchange(undefined);
              }}
              onCheckout={checkout}
              counterClosed={!billingAllowed}
              onClose={closeCart}
              currencyCode={currencyCode}
              scrapValue={scrapExchange?.total}
              onScrap={
                canManageScrap(auth.session?.tenant.role)
                  ? () => openFromCart(() => setScrapOpen(true))
                  : undefined
              }
            />
          </Animated.View>
        </View>
      </Modal>
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScannedCode}
      />
      <BulkQuantityDialog
        product={bulkProduct}
        onClose={() => setBulkProduct(undefined)}
        onAdd={cart.addItem}
        currencyCode={currencyCode}
      />
      <RestaurantItemDialog
        product={restaurantProduct}
        onClose={() => setRestaurantProduct(undefined)}
        onAdd={cart.addItem}
        currencyCode={currencyCode}
      />
      <ServiceConfigurationDialog
        product={serviceProduct}
        products={products}
        technicians={serviceUsers}
        currencyCode={currencyCode}
        onClose={() => setServiceProduct(undefined)}
        onAdd={(product, customization, parts) => {
          cart.addItem(product, 1, customization);
          for (const part of parts) cart.addItem(part.product, part.quantity);
        }}
      />
      <ElectronicsItemDialog
        product={electronicsProduct}
        onClose={() => setElectronicsProduct(undefined)}
        onAdd={(product, customization) => cart.addItem(product, 1, customization)}
      />
      <PharmacyBatchDialog
        product={pharmacyProduct}
        batches={productBatches.filter((batch) => batch.productId === pharmacyProduct?.id)}
        currencyCode={currencyCode}
        onClose={() => setPharmacyProduct(undefined)}
        onAdd={(product, customization) => cart.addItem(product, 1, customization)}
      />
      <AddInventoryItemModal
        visible={quickAddOpen}
        busy={creatingProduct}
        onClose={() => !creatingProduct && setQuickAddOpen(false)}
        onSave={async (input) => {
          setCreatingProduct(true);
          try {
            const job = await inventoryApi.create(input);
            await billing.reload();
            setQuickAddOpen(false);
            const refreshed = await billingApi.load();
            const created = refreshed.cache.products.find((item) => item.id === job.entityId);
            if (created) cart.addItem(created);
            Alert.alert('Product created', `${input.name} is available in billing.`);
          } catch (error) {
            Alert.alert('Could not create product', error instanceof Error ? error.message : 'Try again.');
          } finally {
            setCreatingProduct(false);
          }
        }}
      />
      <PettyCashDialog
        visible={pettyCashOpen}
        busy={recordingPettyCash}
        onClose={() => !recordingPettyCash && setPettyCashOpen(false)}
        onSave={async (input) => {
          const session = auth.session;
          const counter = session?.organization?.activeSession;
          if (!session || !counter) {
            setPettyCashOpen(false);
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
            setPettyCashOpen(false);
            await auth.refreshSession();
            Alert.alert(
              'Cash entry recorded',
              `${input.type === 'EXPENSE' ? 'Expense' : 'Income'} of ${formatCurrency(input.amount, currencyCode)} recorded.`,
            );
          } catch (error) {
            Alert.alert('Could not record cash entry', error instanceof Error ? error.message : 'Try again.');
          } finally {
            setRecordingPettyCash(false);
          }
        }}
      />
      <CheckoutDialog
        visible={checkoutOpen}
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
        visible={scrapOpen}
        products={products.filter((product) => product.categoryType === 'SCRAP')}
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
                  Alert.alert(
                    job.status === 'COMPLETED' ? 'Print queued' : 'Print saved for retry',
                    `${job.printerName} · job ${job.serverId || job.id}${job.error ? `\n${job.error}` : ''}`,
                  );
                } catch (error) {
                  Alert.alert(
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
        visible={customerPickerOpen}
        customers={customers}
        selected={customer}
        onSelect={setCustomer}
        onCreate={async (input) => {
          if (!billing.data) throw new Error('Billing is not ready.');
          try {
            const created = await billingApi.createCustomer(billing.data.key, input);
            await billing.reload();
            return created;
          } catch (error) {
            Alert.alert('Could not create customer', error instanceof Error ? error.message : 'Try again.');
            throw error;
          }
        }}
        onClose={() => setCustomerPickerOpen(false)}
      />
      <HeldOrdersDialog
        visible={heldOrdersOpen}
        orders={heldOrders.orders}
        currencyCode={currencyCode}
        onClose={() => setHeldOrdersOpen(false)}
        onDelete={(id) => void heldOrders.remove(id)}
        onResume={(order) => {
          void (async () => {
            try {
              if (cart.items.length)
                await heldOrders.hold(
                  cart.items,
                  cart.orderDiscount,
                  customer,
                  currentOrderContext(),
                  scrapExchange,
                );
              cart.replaceCart(order.items, order.orderDiscount);
              setCustomer(order.customer);
              if (order.orderContext?.orderMode) setRestaurantOrderMode(order.orderContext.orderMode);
              setDoctorName(order.orderContext?.doctorName || '');
              setPrescriptionReference(order.orderContext?.prescriptionReference || '');
              setScrapExchange(order.scrapExchange);
              setRestaurantTable(
                order.orderContext?.tableId
                  ? {
                      id: order.orderContext.tableId,
                      name: order.orderContext.tableName || 'Table',
                      branchId: auth.session?.organization?.activeSession?.branchId || '',
                      capacity: 0,
                      status: 'AVAILABLE',
                    }
                  : undefined,
              );
              await heldOrders.remove(order.id);
              setHeldOrdersOpen(false);
              setCartOpen(true);
            } catch (error) {
              Alert.alert('Could not resume order', error instanceof Error ? error.message : 'Try again.');
            }
          })();
        }}
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
