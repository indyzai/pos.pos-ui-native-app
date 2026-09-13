import { useMemo } from 'react';
import { useAuthSession } from '@indyzai/pos-auth/session';
import { resolveBillingMode } from './domain/billingMode';
import { RetailBillingScreen } from './modes/RetailBillingScreen';
import { RestaurantBillingScreen } from './modes/RestaurantBillingScreen';
import { PharmacyBillingScreen } from './modes/PharmacyBillingScreen';
import { WholesaleBillingScreen } from './modes/WholesaleBillingScreen';
import { ElectronicsBillingScreen } from './modes/ElectronicsBillingScreen';
import { ServiceBillingScreen } from './modes/ServiceBillingScreen';

export function BillingScreen() {
  const auth = useAuthSession();
  const businessType = auth.session?.organization?.settings?.businessType;
  const mode = useMemo(() => resolveBillingMode(businessType), [businessType]);

  switch (mode.mode) {
    case 'restaurant':
      return <RestaurantBillingScreen mode={mode} />;
    case 'pharmacy':
      return <PharmacyBillingScreen mode={mode} />;
    case 'wholesale':
      return <WholesaleBillingScreen mode={mode} />;
    case 'electronics':
      return <ElectronicsBillingScreen mode={mode} />;
    case 'service':
      return <ServiceBillingScreen mode={mode} />;
    case 'retail':
    default:
      return <RetailBillingScreen mode={mode} />;
  }
}
