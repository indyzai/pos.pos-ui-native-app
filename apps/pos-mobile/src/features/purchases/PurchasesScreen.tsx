import { PurchasesScreen as SharedPurchasesScreen } from '@indyzai/feature-purchase/screen';
import { purchasesApi } from './purchasesApi';
import { inventoryApi } from '../inventory/inventoryApi';

export function PurchasesScreen() {
    return <SharedPurchasesScreen surface="pos" api={purchasesApi} refreshProducts={inventoryApi.refresh} />;
}
