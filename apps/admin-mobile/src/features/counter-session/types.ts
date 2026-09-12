export type CurrencyDenomination = {
    id: string;
    currencyCode: string;
    value: number;
    label: string;
    sortOrder: number;
};

export type DenominationCounts = Record<string, string>;
