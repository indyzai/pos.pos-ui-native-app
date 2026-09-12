import * as Crypto from 'expo-crypto';
import type { Product, ScrapExchange } from '../types/billing';

const money = (value: number) => Math.round(value * 100) / 100;

export function createScrapExchange(
    rows: Array<{ product: Product; quantity: number; unitPrice: number }>,
): ScrapExchange {
    const items = rows
        .filter(
            ({ quantity, unitPrice }) =>
                Number.isFinite(quantity) && quantity > 0 && Number.isFinite(unitPrice) && unitPrice >= 0,
        )
        .map(({ product, quantity, unitPrice }) => ({
            productId: product.id,
            productName: product.name,
            quantity,
            unitPrice: money(unitPrice),
        }));
    if (!items.length) throw new Error('Add at least one valid scrap item.');
    return {
        id: `SCRAP-${Crypto.randomUUID()}`,
        items,
        total: money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)),
    };
}
