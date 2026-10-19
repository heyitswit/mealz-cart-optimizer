const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const USER_AGENT =
  'mealz-cart-optimizer/0.1 (portfolio project; contact via github)';

export interface CatalogProduct {
  externalId: string;
  name: string;
  packAmount: number;
  packUnit: string;
  categoriesTags?: string[];
  pricePerPack?: number;
}

// Keyed by canonical ingredient key.
export type CatalogSnapshot = Record<string, CatalogProduct[]>;

interface OffHit {
  code?: string;
  product_name?: string;
  quantity?: string;
  categories_tags?: string[];
}

interface OffSearchResponse {
  hits?: OffHit[];
}

export function parseQuantity(
  raw: string | undefined,
): { amount: number; unit: string } | null {
  if (!raw) return null;
  const s = raw.toLowerCase().replace(',', '.').trim();

  // Multipacks like "6 x 125 g" become the total amount.
  const multi = s.match(
    /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/,
  );
  if (multi) {
    const count = parseFloat(multi[1]!);
    const size = parseFloat(multi[2]!);
    const unit = multi[3]!;
    return normalizeUnit(count * size, unit);
  }

  const single = s.match(/(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\b/);
  if (single) {
    return normalizeUnit(parseFloat(single[1]!), single[2]!);
  }

  const count =
    s.match(/^(\d+)\s*(?:œufs?|oeufs?|pi[eè]ces?|pcs?|unit[ée]s?)$/) ??
    s.match(/^[x×]\s*(\d+)$/);
  if (count) return { amount: parseInt(count[1]!, 10), unit: 'piece' };
  return null;
}

function normalizeUnit(
  amount: number,
  unit: string,
): { amount: number; unit: string } {
  switch (unit) {
    case 'kg':
      return { amount: amount * 1000, unit: 'g' };
    case 'l':
      return { amount: amount * 1000, unit: 'ml' };
    case 'cl':
      return { amount: amount * 10, unit: 'ml' };
    default:
      return { amount, unit };
  }
}

export interface OffClientOptions {
  fetchImpl?: typeof fetch;
  pageSize?: number;
}

export class OpenFoodFactsClient {
  private readonly fetchImpl: typeof fetch;
  private readonly pageSize: number;

  constructor(opts: OffClientOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.pageSize = opts.pageSize ?? 30;
  }

  // Most-scanned products sold in France for one OFF category; products without a readable pack size are skipped.
  async searchCategory(category: string): Promise<CatalogProduct[]> {
    const q = `categories_tags:"${category}" AND countries_tags:"en:france"`;
    const url =
      `${SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=${this.pageSize}` +
      `&sort_by=-unique_scans_n&fields=code,product_name,quantity,categories_tags`;

    const res = await this.fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      throw new Error(`Open Food Facts search failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as OffSearchResponse;

    const products: CatalogProduct[] = [];
    for (const hit of data.hits ?? []) {
      const pack = parseQuantity(hit.quantity);
      if (!pack || !hit.code || !hit.product_name) continue;
      products.push({
        externalId: hit.code,
        name: hit.product_name.trim(),
        packAmount: pack.amount,
        packUnit: pack.unit,
        categoriesTags: hit.categories_tags,
      });
    }
    return products;
  }
}
