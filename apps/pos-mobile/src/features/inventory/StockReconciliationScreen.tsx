import { useEffect, useState } from 'react';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { StockReconciliationScreen as SharedScreen } from '@indyzai/feature-inventory/reconciliation-screen';
import { BarcodePrintDialog } from '@indyzai/feature-printers/barcode-dialog';
import type { BarcodeBatchItem } from '@indyzai/feature-printers/barcodeBatch';
import { printerConfigurationApi } from '../printing/printerConfigurationApi';
import { inventoryApi } from './inventoryApi';
export function StockReconciliationScreen() {
  const [labels, setLabels] = useState<BarcodeBatchItem[]>();
  const { session } = useAuthSession();
  useEffect(() => setLabels(undefined), [session?.tenant.id]);
  return (
    <>
      <SharedScreen surface="pos" inventoryApi={inventoryApi} onPrintAdded={setLabels} />
      {labels && (
        <BarcodePrintDialog
          initialItems={labels}
          loadPrinters={printerConfigurationApi.load}
          onClose={() => setLabels(undefined)}
        />
      )}
    </>
  );
}
