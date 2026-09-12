export function formatCurrency(
    value: number,
    currencyCode = "INR",
    fractionDigits = 2,
): string {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: currencyCode.toUpperCase(),
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(value);
    } catch {
        return `${currencyCode.toUpperCase()} ${value.toFixed(fractionDigits)}`;
    }
}
