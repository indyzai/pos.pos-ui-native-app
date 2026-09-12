import type { CartItem, Product } from '../types/billing';

export function requiresDeviceDetails(product: Product): boolean {
    return Boolean(
        product.details?.serialRequired || product.details?.serialNumber || product.details?.warrantyMonths,
    );
}

export function validateTrackedDevices(items: CartItem[]): string | undefined {
    const serials = new Set<string>();
    for (const item of items) {
        const serial = String(item.customization?.metadata?.serialNumber || '')
            .trim()
            .toUpperCase();
        if (item.details?.serialRequired && !serial) return `Enter a serial number or IMEI for ${item.name}.`;
        if (serial && serials.has(serial)) return `Serial number ${serial} is already in this cart.`;
        if (serial) serials.add(serial);
    }
    return undefined;
}
