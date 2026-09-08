import type { Product } from '../billing/types/billing';

type CatalogRow = {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  category?: { name?: string | null } | null;
  tax?: { percentage?: number | null; rate?: number | null } | null;
};

export type ProductRequest = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

const catalogQuery = `
  query Catalog($skip: Int!, $take: Int!) {
    products(skip: $skip, take: $take) {
      id name price quantity barcode category { name } tax { percentage rate }
    }
  }
`;

function toProduct(row: CatalogRow): Product {
  return {
    id: String(row.id),
    name: row.name,
    price: Number(row.price),
    stock: Number(row.quantity),
    barcode: row.barcode,
    category: row.category?.name || 'Uncategorized',
    taxRate: Number(row.tax?.percentage ?? row.tax?.rate ?? 0),
    emoji: '📦',
    color: '#E7EDFF',
  };
}

/** Fetches every product page from the POS GraphQL catalog. */
export async function fetchCatalog(request: ProductRequest): Promise<Product[]> {
  const rows: CatalogRow[] = [];
  for (let skip = 0; ; skip += 100) {
    const data = await request<{ products: CatalogRow[] }>(catalogQuery, { skip, take: 100 });
    rows.push(...data.products);
    if (data.products.length < 100) return rows.map(toProduct);
  }
}
