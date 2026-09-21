import {
  Coffee,
  Package,
  Pill,
  Shirt,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react-native';

export const productIconRegistry = {
  package: { label: 'Package', icon: Package, color: '#8A5A24', fill: '#D9A066' },
  basket: { label: 'Grocery', icon: ShoppingBasket, color: '#278A55' },
  coffee: { label: 'Drink', icon: Coffee, color: '#8B5E3C' },
  food: { label: 'Food', icon: UtensilsCrossed, color: '#D05A3A' },
  clothing: { label: 'Clothing', icon: Shirt, color: '#6D5BD0' },
  medicine: { label: 'Medicine', icon: Pill, color: '#D14F76' },
  electronics: { label: 'Electronics', icon: Smartphone, color: '#3977C3' },
  service: { label: 'Service', icon: Wrench, color: '#596273' },
} as const satisfies Record<string, { label: string; icon: LucideIcon; color: string; fill?: string }>;

export type ProductIconKey = keyof typeof productIconRegistry;
export const productIconOptions = Object.entries(productIconRegistry) as Array<
  [ProductIconKey, (typeof productIconRegistry)[ProductIconKey]]
>;

export function ProductIcon({ iconKey = 'package', size = 24 }: { iconKey?: string; size?: number }) {
  const entry = productIconRegistry[iconKey as ProductIconKey] || productIconRegistry.package;
  const Icon = entry.icon;
  return (
    <Icon size={size} color={entry.color} fill={'fill' in entry ? entry.fill : 'none'} strokeWidth={1.8} />
  );
}
