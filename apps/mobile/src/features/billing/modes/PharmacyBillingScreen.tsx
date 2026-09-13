import { useState } from 'react';
import { BaseBillingLayout } from '../components/BaseBillingLayout';
import type { BillingModeConfig } from '../domain/billingMode';
import type { Product } from '../types/billing';
import { useFeatureToggles } from '../../organization/useFeatureToggles';
import { PharmacyPrescriptionContext } from '../components/PharmacyPrescriptionContext';
import { PharmacyBatchDialog } from '../components/PharmacyBatchDialog';
import { pharmacyProductStatus } from '../domain/pharmacyProduct';
import { showSnackbar } from '@indyzai/pos-ui/snackbar';

export function PharmacyBillingScreen({ mode }: { mode: BillingModeConfig }) {
  const { isEnabled } = useFeatureToggles();
  const [doctorName, setDoctorName] = useState('');
  const [prescriptionReference, setPrescriptionReference] = useState('');
  const [pharmacyProduct, setPharmacyProduct] = useState<Product>();

  return (
    <BaseBillingLayout
      mode={mode}
      pharmacyMode
      headerSlot={
        isEnabled('prescriptions') && (
          <PharmacyPrescriptionContext
            doctorName={doctorName}
            prescriptionReference={prescriptionReference}
            onDoctorNameChange={setDoctorName}
            onPrescriptionReferenceChange={setPrescriptionReference}
          />
        )
      }
      onSelectProduct={(product, { cart, addStandardProduct, billing }) => {
        if (isEnabled('batchExpiry') && pharmacyProductStatus(product).expired) {
          showSnackbar(
            'Expired stock',
            `${product.name} cannot be added because its expiry date has passed.`,
          );
          return false;
        }
        const batches =
          billing.data?.cache.productBatches.filter((batch) => batch.productId === product.id) || [];
        if (isEnabled('batchExpiry') && batches.length) {
          setPharmacyProduct(product);
          return false;
        }
        addStandardProduct(product);
        return true;
      }}
      onBeforeCheckout={({ cart }) => {
        if (
          cart.items.some((item) => item.details?.prescriptionRequired || item.details?.scheduledDrug) &&
          !doctorName.trim()
        ) {
          showSnackbar('Prescription details required', 'Enter the prescribing doctor before checkout.');
          return false;
        }
        return true;
      }}
      buildOrderContext={() => ({
        doctorName: doctorName.trim() || undefined,
        prescriptionReference: prescriptionReference.trim() || undefined,
      })}
      onOrderResumed={(order) => {
        setDoctorName(order.orderContext?.doctorName || '');
        setPrescriptionReference(order.orderContext?.prescriptionReference || '');
      }}
      onOrderCleared={() => {
        setDoctorName('');
        setPrescriptionReference('');
      }}
      dialogsSlot={({ cart, currencyCode, billing }) => (
        <PharmacyBatchDialog
          product={pharmacyProduct}
          batches={
            billing.data?.cache.productBatches.filter((batch) => batch.productId === pharmacyProduct?.id) ||
            []
          }
          currencyCode={currencyCode}
          onClose={() => setPharmacyProduct(undefined)}
          onAdd={(product, customization) => cart.addItem(product, 1, customization)}
        />
      )}
    />
  );
}
