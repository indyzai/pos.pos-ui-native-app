import { loadReportOrder } from '../features/orders/reportNavigation';
import { useLocalSearchParams } from 'expo-router';
import { reprintOrder } from '../features/orders/orderPrinting';
import { BottomNavigation } from '../shared/components/navigation/BottomNavigation';
import { BottomNavigationProvider } from '@indyzai/pos-ui-native';
import { OrdersScreen } from '@indyzai/feature-orders/orders-screen';

export default function OrdersRoute() {
  const params = useLocalSearchParams<{
    date: string;
    endDate: string;
    productId: string;
    timeZone: string;
    sessionId: string;
    metric: string;
    billId: string;
  }>();
  const reportFilter =
    params.date && params.timeZone
      ? {
          date: params.date,
          endDate: params.endDate,
          productId: params.productId,
          timeZone: params.timeZone,
          sessionId: params.sessionId,
          metric: params.metric || 'Orders',
          billId: params.billId,
        }
      : undefined;
  return (
    <BottomNavigationProvider>
      <OrdersScreen loadReportOrder={loadReportOrder} onReprint={reprintOrder} reportFilter={reportFilter} />
      <BottomNavigation />
    </BottomNavigationProvider>
  );
}
