import type { Product, ProductBusinessDetails } from '../billing/types/billing';

type CatalogRow = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  skuCode?: string;
  imageUrl?: string;
  details?: Record<string, unknown> | null;
  category?: { name?: string | null; type?: Product['categoryType'] | null } | null;
  tax?: { percentage?: number | null; rate?: number | null } | null;
};

export type ProductRequest = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const catalogQuery = `
  query Catalog($skip: Int!, $take: Int!) {
    products(categoryType: INVENTORY, skip: $skip, take: $take) {
      id name skuCode imageUrl price quantity barcode details category { name type } tax { percentage rate }
    }
  }
`;

function toProduct(row: CatalogRow): Product {
  const details = (row.details || undefined) as ProductBusinessDetails | undefined;
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    stock: Number(row.quantity),
    barcode: row.barcode,
    sku: row.skuCode,
    imageUrl: row.imageUrl,
    category: row.category?.name || 'Uncategorized',
    categoryType: row.category?.type || undefined,
    taxRate: Number(row.tax?.percentage ?? row.tax?.rate ?? 0),
    emoji: '📦',
    color: '#E7EDFF',
    quick: details?.isQuickItem === true || details?.isFavorite === true,
    details,
  };
}

/** Fetches every product page from the POS GraphQL catalog. */
export async function fetchCatalog(request: ProductRequest): Promise<Product[]> {
  const rows: CatalogRow[] = [];
  for (let skip = 0; ; skip += 100) {
    const data = await request<{ products: CatalogRow[] }>(catalogQuery, { skip, take: 100 });
    rows.push(...data.products);
    if (data.products.length < 100)
      return rows.filter((row) => row.category?.type === 'INVENTORY').map(toProduct);
  }
}
