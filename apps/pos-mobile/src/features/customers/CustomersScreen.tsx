import { CustomersScreen as SharedCustomersScreen } from '@indyzai/feature-customers/screen';
import { customersApi } from './customersApi';

export function CustomersScreen() {
  return <SharedCustomersScreen api={customersApi} />;
}
