import { PurchasesScreen as SharedPurchasesScreen } from '@indyzai/feature-purchase/screen';
import { purchasesApi } from './purchasesApi';

export function PurchasesScreen() {
    return <SharedPurchasesScreen surface="pos" api={purchasesApi} />;
}
