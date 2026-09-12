import type { ProductBusinessDetails } from '../types/billing';

export type RestaurantModifier = NonNullable<ProductBusinessDetails['modifiers']>[number];

export function restaurantModifiers(details?: ProductBusinessDetails): RestaurantModifier[] {
    const seen = new Set<string>();
    return (details?.modifiers || []).filter((modifier) => {
        const valid =
            typeof modifier.id === 'string' &&
            modifier.id.trim().length > 0 &&
            typeof modifier.label === 'string' &&
            modifier.label.trim().length > 0 &&
            (modifier.price === undefined || (Number.isFinite(modifier.price) && modifier.price >= 0));
        if (!valid || seen.has(modifier.id)) return false;
        seen.add(modifier.id);
        return true;
    });
}

export function toggleRestaurantModifier(
    selected: string[],
    modifier: RestaurantModifier,
    available: RestaurantModifier[],
): string[] {
    if (selected.includes(modifier.id)) return selected.filter((id) => id !== modifier.id);
    const remaining =
        modifier.singleSelect && modifier.group
            ? selected.filter((id) => available.find((item) => item.id === id)?.group !== modifier.group)
            : selected;
    return [...remaining, modifier.id];
}
