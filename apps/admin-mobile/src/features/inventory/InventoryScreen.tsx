import { useEffect, useState } from 'react';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { BarcodePrintDialog } from '@indyzai/feature-printers/barcode-dialog';
import { InventoryScreen as SharedInventoryScreen } from '@indyzai/feature-inventory/screen';
import { printerConfigurationApi } from '../printing/printerConfigurationApi';
import { inventoryApi } from './inventoryApi';
export function InventoryScreen() {
  const [printing, setPrinting] = useState(false);
  const { session } = useAuthSession();
  useEffect(() => setPrinting(false), [session?.tenant.id]);
  return (
    <>
      <SharedInventoryScreen surface="admin" api={inventoryApi} onPrintLabels={() => setPrinting(true)} />
      {printing && (
        <BarcodePrintDialog loadPrinters={printerConfigurationApi.load} onClose={() => setPrinting(false)} />
      )}
    </>
  );
}
