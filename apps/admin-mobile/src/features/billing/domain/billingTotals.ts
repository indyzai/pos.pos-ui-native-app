import type { CartItem } from '../types/billing';

export type BillingCalculationPolicy = {
    taxCalculation: 'inclusive' | 'exclusive';
    roundOffTotal: boolean;
};

export type BillingTotals = {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    rounding: number;
};

const money = (value: number) => Math.round(value * 100) / 100;

export function billingPolicy(settings?: Record<string, unknown>): BillingCalculationPolicy {
    return {
        taxCalculation: settings?.taxCalculation === 'exclusive' ? 'exclusive' : 'inclusive',
        roundOffTotal: settings?.roundOffTotal !== false,
    };
}

export function calculateBillingTotals(
    items: CartItem[],
    policy: BillingCalculationPolicy,
    orderDiscount = 0,
): BillingTotals {
    const subtotal = money(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    const itemDiscount = money(items.reduce((sum, item) => sum + Math.max(0, item.discount || 0), 0));
    const afterItemDiscount = Math.max(0, subtotal - itemDiscount);
    const appliedOrderDiscount = Math.min(afterItemDiscount, Math.max(0, orderDiscount));
    const discount = money(itemDiscount + appliedOrderDiscount);
    const orderDiscountRatio = afterItemDiscount > 0 ? appliedOrderDiscount / afterItemDiscount : 0;
    const tax = money(
        items.reduce((sum, item) => {
            const line = Math.max(0, item.price * item.quantity - (item.discount || 0));
            const discountedLine = line * (1 - orderDiscountRatio);
            const rate = Math.max(0, item.taxRate || 0);
            return (
                sum +
                (policy.taxCalculation === 'inclusive'
                    ? (discountedLine * rate) / (100 + rate)
                    : (discountedLine * rate) / 100)
            );
        }, 0),
    );
    const discountedSubtotal = money(subtotal - discount);
    const unroundedTotal =
        policy.taxCalculation === 'inclusive' ? discountedSubtotal : discountedSubtotal + tax;
    const total = policy.roundOffTotal ? Math.round(unroundedTotal) : money(unroundedTotal);
    return { subtotal, discount, tax, total, rounding: money(total - unroundedTotal) };
}
