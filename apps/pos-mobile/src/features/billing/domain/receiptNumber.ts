const cleanPrefix = (value?: string) => {
  const normalized = value
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return normalized?.slice(0, 8) || 'POS';
};

/**
 * Builds a readable, collision-resistant number for receipts created offline.
 * The API remains responsible for the final statutory/business invoice number.
 */
export function provisionalReceiptNumber(
  offlineId: string,
  createdAt: string,
  prefix?: string,
  counterId?: string,
) {
  const date = new Date(createdAt);
  const day = Number.isNaN(date.getTime())
    ? '00000000'
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const counter = String(counterId || '0')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-4)
    .toUpperCase();
  const unique = offlineId
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-6)
    .toUpperCase();
  return `${cleanPrefix(prefix)}-${day}-${counter}-${unique}`;
}
