import type { Product } from '../types/billing';

export type PharmacyProductStatus = {
    expired: boolean;
    expiringSoon: boolean;
    daysUntilExpiry?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function pharmacyProductStatus(product: Product, now = new Date()): PharmacyProductStatus {
    const expiryText = product.details?.expiryDate;
    if (!expiryText) return { expired: false, expiringSoon: false };
    const expiry = new Date(expiryText);
    if (Number.isNaN(expiry.getTime())) return { expired: false, expiringSoon: false };
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / DAY_MS);
    return {
        expired: daysUntilExpiry < 0,
        expiringSoon: daysUntilExpiry >= 0 && daysUntilExpiry < 90,
        daysUntilExpiry,
    };
}
