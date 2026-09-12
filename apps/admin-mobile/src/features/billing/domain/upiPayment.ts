export function buildUpiPaymentUri(input: {
    upiId?: string;
    payeeName?: string;
    amount: number;
    currencyCode?: string;
    reference?: string;
}) {
    const upiId = input.upiId?.trim();
    if (!upiId || !upiId.includes('@') || !Number.isFinite(input.amount) || input.amount <= 0)
        return undefined;
    const params = new URLSearchParams({
        pa: upiId,
        pn: input.payeeName?.trim() || upiId,
        am: input.amount.toFixed(2),
        cu: (input.currencyCode || 'INR').toUpperCase(),
    });
    if (input.reference?.trim()) params.set('tr', input.reference.trim());
    return `upi://pay?${params.toString()}`;
}
