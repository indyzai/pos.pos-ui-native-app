import * as Crypto from 'expo-crypto';
import { requestPos } from '../../core/api/posApi';
import { getActiveAuthSession } from '@indyzai/pos-auth/session';
import { appStorageKeys } from '@indyzai/pos-auth/storage-keys';
import { createPrintingApi } from '@indyzai/feature-printers/printingApi';
import { printerConfigurationApi } from './printerConfigurationApi';
import { sendNativePrint } from '@indyzai/feature-printers/nativeDelivery';
import { listPendingPrintJobs, savePrintJob } from '@indyzai/feature-printers/printJobRepository';

export const printingApi = createPrintingApi({
  request: requestPos,
  createId: () => Crypto.randomUUID(),
  readPrinters: () => printerConfigurationApi.load(),
  replacePrinters: async () => {
    throw new Error('Use the local-first printer configuration cache.');
  },
  refreshCachedPrinters: (counterId) => printerConfigurationApi.refresh(counterId),
  deliverNative: sendNativePrint,
  listPendingPrintJobs,
  savePrintJob,
  getContext: () => {
    const session = getActiveAuthSession();
    if (!session) throw new Error('Your workspace is still initializing.');
    return {
      scope: appStorageKeys.admin.billing(session.user.id, session.tenant.id),
      tenant: String(session.tenant.id),
      token: session.token,
    };
  },
});
