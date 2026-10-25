import { customersApi } from '../customers/customersApi';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { useEffect, useState } from 'react';
import { OperationsScreen as SharedScreen } from '@indyzai/feature-organization/operations-screen';
import type { ResourceKey } from '@indyzai/feature-organization/operations-resources';
import type { NativePrintDocument } from '@indyzai/pos-printing';
import { LabelPrintDialog } from '@indyzai/feature-printers/label-dialog';
import { printerConfigurationApi } from '../printing/printerConfigurationApi';
import { operationsApi } from './operationsApi';
export function OperationsScreen({ resource }: { resource: ResourceKey }) {
  const [document, setDocument] = useState<NativePrintDocument>();
  const { session } = useAuthSession();
  useEffect(() => setDocument(undefined), [session?.tenant.id]);
  return (
    <>
      <SharedScreen
        resource={resource}
        api={operationsApi}
        createSeller={async (input) => (await customersApi.create({ ...input, type: 'SUPPLIER' })).record}
        surface="admin"
        onPrint={async (document) => {
          setDocument(document);
        }}
      />
      {document && (
        <LabelPrintDialog
          document={document}
          loadPrinters={printerConfigurationApi.load}
          onClose={() => setDocument(undefined)}
        />
      )}
    </>
  );
}
