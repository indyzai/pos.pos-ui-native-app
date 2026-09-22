export function requiresOpenCounter(
    settings: Record<string, unknown> | undefined,
): boolean {
    const features = (settings?.features ?? {}) as Record<string, unknown>;
    const configured =
        features.requireOpenCounterForBilling ??
        features.requireCounterSessionForBilling ??
        settings?.requireOpenCounterForBilling ??
        settings?.requireCounterSessionForBilling;
    return configured === undefined ? true : configured !== false;
}
